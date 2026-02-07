import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppTheme } from '../../types';
import * as storage from '../../services/storageService';
import { useCountdowns } from '../../AppContext';
import { exchangeCodeForToken, fetchTickTickTasks } from '../../services/tickTickService';
import { getGoogleAuthUrl, exchangeGoogleCode, GOOGLE_REDIRECT_URI } from '../../services/googleService';
import ObsidianSection from '../Settings/sync/ObsidianSection';

interface SyncSettingsProps {
    appTheme: AppTheme;
    setLastBackup: (date: string) => void;
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({ appTheme, setLastBackup }) => {
    const isCyberpunk = appTheme === 'cyberpunk';
    const { countdowns, importCountdowns } = useCountdowns();
    
    // State
    const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('google_client_id') || '');
    const [googleClientSecret, setGoogleClientSecret] = useState(() => localStorage.getItem('google_client_secret') || '');
    const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [tickTickClientId, setTickTickClientId] = useState(() => localStorage.getItem('ticktick_client_id') || '');
    const [tickTickClientSecret, setTickTickClientSecret] = useState(() => localStorage.getItem('ticktick_client_secret') || '');
    const [tickTickRedirectUri, setTickTickRedirectUri] = useState(() => {
        const stored = localStorage.getItem('ticktick_redirect_uri');
        if (stored) return stored;
        // Default to custom protocol in Electron, localhost in Web
        return (typeof window !== 'undefined' && window.electronAPI) ? 'http://localhost:54321/callback' : (typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost');
    });
    const [manualAuthCode, setManualAuthCode] = useState('');
    const [tickTickAutoSync, setTickTickAutoSync] = useState(() => localStorage.getItem('focusflow_ticktick_auto_sync') === 'true');
    const [cloudKitContainerId, setCloudKitContainerId] = useState(() => localStorage.getItem('cloudkit_container_id') || '');
    const [cloudKitApiToken, setCloudKitApiToken] = useState(() => localStorage.getItem('cloudkit_api_token') || '');
    const [isICloudLoggedIn, setIsICloudLoggedIn] = useState(false);
    const [isUploadingICloud, setIsUploadingICloud] = useState(false);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [backupPath, setBackupPath] = useState(() => localStorage.getItem('focusflow_backup_path') || '');
    const [autoObsidianSync, setAutoObsidianSync] = useState(() => localStorage.getItem('focusflow_auto_obsidian_sync') === 'true');
    const [obsidianMode, setObsidianMode] = useState(() => localStorage.getItem('focusflow_obsidian_mode') || 'dashboard');
    const [obsidianTemplate, setObsidianTemplate] = useState(() => localStorage.getItem('focusflow_obsidian_template') || '- [x] {time} - **{label}** ({duration}m) [{project}] #focusflow');
    const [obsidianHeader, setObsidianHeader] = useState(() => localStorage.getItem('focusflow_obsidian_header') || '');
    const [obsidianPosition, setObsidianPosition] = useState<'append' | 'prepend'>(() => (localStorage.getItem('focusflow_obsidian_position') as 'append' | 'prepend') || 'append');
    const [obsidianDateFormat, setObsidianDateFormat] = useState(() => localStorage.getItem('focusflow_obsidian_date_format') || 'YYYY-MM-DD');
    
    const [isUploadingDrive, setIsUploadingDrive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [driveFiles, setDriveFiles] = useState<any[]>([]);
    const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [restoreFileCandidate, setRestoreFileCandidate] = useState<{id: string, name: string} | null>(null);
    const [driveSearchQuery, setDriveSearchQuery] = useState('');
    const [driveSortOrder, setDriveSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
    
    const googleActionRef = useRef<'calendar' | 'drive' | 'login' | 'restore' | 'none'>('none');
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const handleGoogleCodeRef = useRef((code: string) => {});
    

    const handleGoogleCode = async (code: string) => {
        try {
            const data = await exchangeGoogleCode(googleClientId, googleClientSecret, code, GOOGLE_REDIRECT_URI);
            
            if (data.access_token) {
                if (isMounted.current) setAccessToken(data.access_token);
                
                if (googleActionRef.current === 'drive') uploadToDrive(data.access_token);
                else if (googleActionRef.current === 'login') alert("Google Account connected successfully.");
                else if (googleActionRef.current === 'restore') listDriveBackups(data.access_token);
                
                googleActionRef.current = 'none';
            }
        } catch (e: any) {
            console.error(e);
            alert(`Google Auth Failed: ${e.message}`);
            googleActionRef.current = 'none';
        }
    };

    useEffect(() => { handleGoogleCodeRef.current = handleGoogleCode; }, [handleGoogleCode]);

    // Listen for OAuth Code (Electron / Loopback)
    useEffect(() => {
        if (window.electronAPI?.onOAuthCode) {
            window.electronAPI.onOAuthCode((codeOrUrl) => {
                if (googleActionRef.current === 'none') return;
                
                let code = codeOrUrl;
                if (codeOrUrl.includes('code=')) {
                    const match = codeOrUrl.match(/code=([^&]+)/);
                    if (match) code = match[1];
                }

                if (code) handleGoogleCodeRef.current(code);
            });
        }
        
        if (typeof (window as any).CloudKit === 'undefined') {
            if (navigator.onLine && !document.querySelector('script[src*="cloudkit.js"]')) {
                const ckScript = document.createElement('script');
                ckScript.src = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';
                ckScript.async = true;
                ckScript.onload = () => { if (cloudKitContainerId && cloudKitApiToken) initCloudKit(); };
                document.body.appendChild(ckScript);
            }
        } else if (cloudKitContainerId && cloudKitApiToken) {
            initCloudKit();
        }
    }, []);

    const initCloudKit = () => {
        const CK = (window as any).CloudKit;
        if (!CK) return;
        try {
            CK.configure({
                containers: [{
                    containerIdentifier: cloudKitContainerId,
                    apiTokenAuth: { apiToken: cloudKitApiToken, persist: true },
                    environment: 'development'
                }]
            });
            CK.getDefaultContainer().setUpAuth().then((user: any) => setIsICloudLoggedIn(!!user)).catch(() => setIsICloudLoggedIn(false));
        } catch (e) { console.error("CloudKit Init Error", e); }
    };

    const handleSaveClientId = () => {
        localStorage.setItem('google_client_id', googleClientId);
        localStorage.setItem('google_client_secret', googleClientSecret);
        alert("Client ID Saved.");
    };

    const handleSaveGeminiKey = () => {
        localStorage.setItem('gemini_api_key', geminiApiKey);
        alert("Gemini API Key Saved.");
    };

    const handleSaveTickTickConfig = () => {
        localStorage.setItem('ticktick_client_id', tickTickClientId);
        localStorage.setItem('ticktick_client_secret', tickTickClientSecret);
        localStorage.setItem('ticktick_redirect_uri', tickTickRedirectUri);
        alert("TickTick Configuration Saved.");
    };

    const handleManualTickTickCode = async () => {
        if (!manualAuthCode.trim()) return;
        try {
            const tokenData = await exchangeCodeForToken(tickTickClientId, tickTickClientSecret, manualAuthCode.trim(), tickTickRedirectUri);
            if (tokenData.access_token) {
                localStorage.setItem('ticktick_access_token', tokenData.access_token);
                alert("TickTick Linked Successfully!");
                setManualAuthCode('');
                // Trigger a sync
                window.dispatchEvent(new Event('focusflow-task-update'));
            }
        } catch (e: any) {
            console.error(e);
            alert(`Link failed: ${e.message}`);
        }
    };

    const handleTickTickAutoSyncChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTickTickAutoSync(e.target.checked);
        localStorage.setItem('focusflow_ticktick_auto_sync', String(e.target.checked));
    };

    const handleSaveCloudKitConfig = () => {
        localStorage.setItem('cloudkit_container_id', cloudKitContainerId);
        localStorage.setItem('cloudkit_api_token', cloudKitApiToken);
        initCloudKit();
        alert("CloudKit Configuration Saved.");
    };

    const handleGoogleLogin = () => {
        if (!googleClientId || !googleClientSecret) return alert("Please enter Google Client ID and Secret first.");
        googleActionRef.current = 'login';
        startGoogleAuth();
    };

    const handleDriveBackupClick = () => {
        if (!googleClientId || !googleClientSecret) return alert("Please enter Google Client ID and Secret first.");
        setIsUploadingDrive(true);
        googleActionRef.current = 'drive';
        startGoogleAuth();
    };

    const handleRestoreFromDriveClick = () => {
        if (!googleClientId || !googleClientSecret) return alert("Please enter Google Client ID and Secret first.");
        googleActionRef.current = 'restore';
        startGoogleAuth();
    };

    const startGoogleAuth = () => {
        const scope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.file';
        const url = getGoogleAuthUrl(googleClientId, GOOGLE_REDIRECT_URI, scope);
        window.open(url, '_blank');
    };

    const uploadToDrive = async (token: string, silent = false) => {
        setUploadProgress(0);
        try {
            const data = await storage.exportData();
            const fileContent = new Blob([data], { type: 'application/json' });
            const metadata = { name: `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`, mimeType: 'application/json' };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', fileContent);

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100); };
                xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new Error('Upload failed'));
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(form);
            });

            if (!silent) alert(`Backup uploaded to Google Drive successfully!`);
            const now = Date.now();
            localStorage.setItem('focusflow_last_backup', now.toString());
            setLastBackup(new Date(now).toLocaleString());
        } catch (e: any) {
            if (!silent) alert(`Drive Backup Failed: ${e.message}`);
        } finally {
            if (isMounted.current) { setIsUploadingDrive(false); setUploadProgress(0); }
        }
    };

    const listDriveBackups = async (token: string) => {
        setIsLoadingDriveFiles(true);
        setIsRestoreModalOpen(true);
        try {
            const q = "mimeType = 'application/json' and name contains 'focusflow_backup' and trashed = false";
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name, createdTime, size)&orderBy=createdTime desc`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to list files');
            const data = await response.json();
            if (isMounted.current) setDriveFiles(data.files || []);
        } catch (e: any) {
            alert(`Failed to list backups: ${e.message}`);
            if (isMounted.current) setIsRestoreModalOpen(false);
        } finally {
            if (isMounted.current) setIsLoadingDriveFiles(false);
        }
    };

    const performRestore = async () => {
        if (!accessToken || !restoreFileCandidate) return;
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${restoreFileCandidate.id}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error('Failed to download file');
            const content = await response.text();
            const result = await storage.importData(content);
            if (result.success) {
                alert('Data restored successfully. Reloading...');
                window.location.reload();
            } else {
                alert(`Restore Failed: ${result.message}`);
            }
        } catch (e: any) {
            alert(`Restore Failed: ${e.message}`);
        } finally {
            if (isMounted.current) setRestoreFileCandidate(null);
        }
    };

    const handleDeleteDriveFile = async (fileId: string) => {
        if (!accessToken || !confirm("Delete this backup permanently?")) return;
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error('Failed to delete file');
            if (isMounted.current) setDriveFiles(prev => prev.filter(f => f.id !== fileId));
        } catch (e: any) {
            alert(`Delete Failed: ${e.message}`);
        }
    };

    const handleICloudLogin = async () => {
        const CK = (window as any).CloudKit;
        if (!CK) return;
        try {
            await CK.getDefaultContainer().getAuth().signIn();
            setIsICloudLoggedIn(true);
            alert("Signed in to iCloud!");
        } catch (e) { alert("iCloud Sign-in failed"); }
    };

    const uploadToICloud = async (silent = false) => {
        setIsUploadingICloud(true);
        try {
            const data = await storage.exportData();
            const CK = (window as any).CloudKit;
            const record = { recordType: 'Backup', fields: { jsonContent: { value: data }, deviceName: { value: 'FocusFlow App' } } };
            await CK.getDefaultContainer().privateCloudDatabase.saveRecords([record]);
            if (!silent) alert("Backup saved to iCloud!");
            const now = Date.now();
            localStorage.setItem('focusflow_last_backup', now.toString());
            setLastBackup(new Date(now).toLocaleString());
        } catch (e: any) {
            if (!silent) alert(`iCloud Backup Failed: ${e.message}`);
        } finally {
            if (isMounted.current) setIsUploadingICloud(false);
        }
    };

    const restoreFromICloud = async () => {
        try {
            const CK = (window as any).CloudKit;
            const query = { recordType: 'Backup', sortBy: [{ fieldName: 'created', ascending: false }] };
            const response = await CK.getDefaultContainer().privateCloudDatabase.performQuery(query, { limit: 1 });
            if (response.records.length === 0) return alert("No backups found in iCloud.");
            
            if (confirm(`Restore backup from ${new Date(response.records[0].created.timestamp).toLocaleString()}?`)) {
                const result = await storage.importData(response.records[0].fields.jsonContent.value);
                if (result.success) {
                    alert('Restored successfully. Reloading...');
                    window.location.reload();
                } else {
                    alert('Import failed.');
                }
            }
        } catch (e: any) {
            alert(`iCloud Restore Failed: ${e.message}`);
        }
    };

    const handleSelectBackupFolder = async () => {
        const path = await (window as any).electronAPI?.selectBackupFolder();
        if (path) {
            setBackupPath(path);
            localStorage.setItem('focusflow_backup_path', path);
        }
    };

    const handleBackupToFolder = async (silent = false) => {
        const currentPath = localStorage.getItem('focusflow_backup_path') || backupPath;
        if (!currentPath) return;
        const data = await storage.exportData();
        const result = await (window as any).electronAPI?.saveBackupFile(backupPath, data);
        if (result?.success) {
            if (!silent) alert(`Backup saved successfully to:\n${result.path}`);
            setLastBackup(new Date().toLocaleString());
        } else {
            if (!silent) alert(`Backup failed: ${result?.error}`);
        }
    };

    const handleObsidianSync = async (silent = false) => {
        const currentPath = localStorage.getItem('focusflow_backup_path') || backupPath;
        if (!currentPath) return;
        const sessions = await storage.getSessions();
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = sessions.filter(s => s.startTime.startsWith(today));
        const totalHours = sessions.reduce((acc, s) => acc + s.duration, 0) / 3600;
        const todayHours = todaySessions.reduce((acc, s) => acc + s.duration, 0) / 3600;
        
        const mdContent = `# 🍅 FocusFlow Dashboard
**Last Updated:** ${new Date().toLocaleString()}

## 📊 Stats
- **Total Focus:** ${totalHours.toFixed(1)} hours
- **Today:** ${todayHours.toFixed(1)} hours
- **Sessions:** ${sessions.length}

## 📅 Today's Sessions
${todaySessions.length === 0 ? '_No sessions yet today._' : todaySessions.map(s => `- **${new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}** - ${s.label || 'Focus'} (${Math.round(s.duration/60)}m)`).join('\n')}
`;
        const result = await (window as any).electronAPI?.saveFileToFolder(backupPath, 'FocusFlow_Stats.md', mdContent);
        if (result?.success) { if (!silent) alert("Synced 'FocusFlow_Stats.md' to your folder!"); }
        else { if (!silent) alert("Sync failed: " + result?.error); }
    };

    const handleSyncAll = async () => {
        if (isSyncingAll) return;
        setIsSyncingAll(true);
        try {
            const promises = [];
            if (backupPath) {
                promises.push(handleBackupToFolder(true));
                promises.push(handleObsidianSync(true));
            }
            if (cloudKitContainerId && cloudKitApiToken && isICloudLoggedIn) promises.push(uploadToICloud(true));
            if (googleClientId && accessToken) promises.push(uploadToDrive(accessToken, true));
            await Promise.all(promises);
            alert("Sync All Completed Successfully.");
        } catch (e) {
            console.error(e);
            alert("Errors occurred during Sync All. Check console.");
        } finally {
            setIsSyncingAll(false);
        }
    };

    const sortedDriveFiles = useMemo(() => {
        let sorted = [...driveFiles];
        if (driveSortOrder === 'newest') sorted.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
        else if (driveSortOrder === 'oldest') sorted.sort((a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());
        else if (driveSortOrder === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
        return sorted.filter(f => f.name.toLowerCase().includes(driveSearchQuery.toLowerCase()));
    }, [driveFiles, driveSortOrder, driveSearchQuery]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button 
                    onClick={handleSyncAll}
                    disabled={isSyncingAll}
                    className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2 ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                    {isSyncingAll ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                    Sync All Now
                </button>
            </div>

            {/* Gemini Integration */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">AI Integration</h3>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gemini API Key</label>
                            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">AI Coach</span>
                        </div>
                        <div className="flex gap-2">
                            <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="Enter Gemini API Key" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white transition-all font-mono" />
                            <button onClick={handleSaveGeminiKey} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* TickTick Integration */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">TickTick Integration</h3>
                <div className="space-y-6">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Sync your tasks from TickTick. You need to register an app at <a href="https://developer.ticktick.com/manage" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">developer.ticktick.com</a> to get these credentials.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Client ID</label>
                                <input type="text" value={tickTickClientId} onChange={(e) => setTickTickClientId(e.target.value)} placeholder="TickTick Client ID" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Client Secret</label>
                                <div className="flex gap-2">
                                    <input type="password" value={tickTickClientSecret} onChange={(e) => setTickTickClientSecret(e.target.value)} placeholder="TickTick Client Secret" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Redirect URI</label>
                                <div className="flex gap-2">
                                    <input type="text" value={tickTickRedirectUri} onChange={(e) => setTickTickRedirectUri(e.target.value)} placeholder={typeof window !== 'undefined' && window.electronAPI ? "http://localhost:54321/callback" : "http://localhost"} className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                                    <button onClick={handleSaveTickTickConfig} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Manual Auth Code</label>
                                <div className="flex gap-2">
                                    <input type="text" value={manualAuthCode} onChange={(e) => setManualAuthCode(e.target.value)} placeholder="Paste code if auto-sync fails" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                                    <button 
                                        onClick={handleManualTickTickCode}
                                        disabled={!manualAuthCode}
                                        className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Link
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={tickTickAutoSync} onChange={handleTickTickAutoSyncChange} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-black/20 border-gray-300 dark:border-gray-600" />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auto-sync in background (Every 5m)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Google Drive Integration */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Google Drive</h3>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Google Client ID</label>
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Cloud Sync</span>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="apps.googleusercontent.com" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white transition-all font-mono" />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <input type="password" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} placeholder="Client Secret" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white transition-all font-mono" />
                            <button onClick={handleSaveClientId} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button>
                        </div>
                        <div className="flex justify-between items-center mt-3">
                            <p className="text-xs text-gray-400">Required for Drive backups and Calendar sync.</p>
                            <button onClick={handleGoogleLogin} className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                                <span>Connect Account</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleDriveBackupClick} disabled={isUploadingDrive} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden">
                            {isUploadingDrive && <div className="absolute left-0 top-0 bottom-0 bg-blue-500/10 transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />}
                            <div className="text-left relative z-10"><span className="block font-bold text-gray-900 dark:text-white">{isUploadingDrive ? `Uploading... ${Math.round(uploadProgress)}%` : 'Backup to Drive'}</span></div>
                            <div className="relative z-10">{isUploadingDrive ? <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div> : <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}</div>
                        </button>
                        <button onClick={handleRestoreFromDriveClick} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                            <div className="text-left"><span className="block font-bold text-gray-900 dark:text-white">Restore from Drive</span></div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* iCloud Integration */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">iCloud (CloudKit)</h3>
                    <button onClick={handleICloudLogin} className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                        <span>{isICloudLoggedIn ? 'Signed In' : 'Sign In to iCloud'}</span>
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <input type="text" value={cloudKitContainerId} onChange={(e) => setCloudKitContainerId(e.target.value)} placeholder="Container ID (iCloud.com.example.app)" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                        <div className="flex gap-2">
                            <input type="text" value={cloudKitApiToken} onChange={(e) => setCloudKitApiToken(e.target.value)} placeholder="API Token" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                            <button onClick={handleSaveCloudKitConfig} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => uploadToICloud()} disabled={isUploadingICloud || !isICloudLoggedIn} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden">
                            <div className="text-left relative z-10"><span className="block font-bold text-gray-900 dark:text-white">{isUploadingICloud ? 'Uploading...' : 'Backup to iCloud'}</span></div>
                            <div className="relative z-10">{isUploadingICloud ? <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div> : <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>}</div>
                        </button>
                        <button onClick={restoreFromICloud} disabled={!isICloudLoggedIn} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all disabled:opacity-50">
                            <div className="text-left"><span className="block font-bold text-gray-900 dark:text-white">Restore from iCloud</span></div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Obsidian / Local Folder Sync */}
            <ObsidianSection appTheme={appTheme} setLastBackup={setLastBackup} />

            {/* Restore Modal */}
            {isRestoreModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in flex flex-col max-h-[80vh]">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252527] flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Restore from Google Drive</h3>
                            <button onClick={() => setIsRestoreModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1c1e] flex gap-2">
                            <div className="relative flex-1">
                                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input type="text" placeholder="Search backups..." value={driveSearchQuery} onChange={(e) => setDriveSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500" />
                            </div>
                            <select value={driveSortOrder} onChange={(e) => setDriveSortOrder(e.target.value as any)} className="bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none px-3 py-2 cursor-pointer">
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="name">Name</option>
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {isLoadingDriveFiles ? (
                                <div className="flex flex-col items-center justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div><p className="text-sm text-gray-500">Loading backups...</p></div>
                            ) : sortedDriveFiles.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">No backup files found.</div>
                            ) : (
                                <div className="space-y-2">
                                    {sortedDriveFiles.map((file) => (
                                        <div key={file.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                                            <button onClick={() => setRestoreFileCandidate({ id: file.id, name: file.name })} className="flex-1 flex items-center justify-between p-2 text-left">
                                                <div><p className="font-bold text-sm text-gray-900 dark:text-white">{file.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{new Date(file.createdTime).toLocaleString()} • {(parseInt(file.size)/1024).toFixed(1)} KB</p></div>
                                            </button>
                                            <button onClick={() => handleDeleteDriveFile(file.id)} className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Backup"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252527] flex justify-end">
                            <button onClick={() => setIsRestoreModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Restore Confirmation Modal */}
            {restoreFileCandidate && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 animate-scale-in">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm Restore</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to restore <span className="font-bold text-gray-900 dark:text-white">{restoreFileCandidate.name}</span>?<br/><br/><span className="text-red-500 font-bold">Warning:</span> This will overwrite all current data.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setRestoreFileCandidate(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">Cancel</button>
                            <button onClick={performRestore} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg transition-colors">Restore Data</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
