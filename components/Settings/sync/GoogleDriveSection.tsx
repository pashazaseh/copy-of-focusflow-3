import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppTheme } from '../../../types';
import * as storage from '../../../services/storageService';
import { getGoogleAuthUrl, exchangeGoogleCode, GOOGLE_REDIRECT_URI } from '../../../services/googleService';

interface GoogleDriveSectionProps {
    appTheme: AppTheme;
    setLastBackup: (date: string) => void;
}

const GoogleDriveSection: React.FC<GoogleDriveSectionProps> = ({ appTheme, setLastBackup }) => {
    const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('google_client_id') || '');
    const [googleClientSecret, setGoogleClientSecret] = useState(() => localStorage.getItem('google_client_secret') || '');
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

    const handleGoogleCodeRef = useRef(handleGoogleCode);
    useEffect(() => { handleGoogleCodeRef.current = handleGoogleCode; }, [handleGoogleCode]);

    useEffect(() => {
        if (window.electronAPI?.onOAuthCode) {
            return window.electronAPI.onOAuthCode((codeOrUrl) => {
                if (googleActionRef.current === 'none') return;
                let code = codeOrUrl;
                if (codeOrUrl.includes('code=')) {
                    const match = codeOrUrl.match(/code=([^&]+)/);
                    if (match) code = match[1];
                }
                if (code) handleGoogleCodeRef.current(code);
            });
        }
    }, []);

    const handleSaveClientId = () => {
        localStorage.setItem('google_client_id', googleClientId);
        localStorage.setItem('google_client_secret', googleClientSecret);
        alert("Client ID Saved.");
    };

    const startGoogleAuth = () => {
        const scope = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.file';
        const url = getGoogleAuthUrl(googleClientId, GOOGLE_REDIRECT_URI, scope);
        window.open(url, '_blank');
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

    const uploadToDrive = async (token: string) => {
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

            alert(`Backup uploaded to Google Drive successfully!`);
            const now = Date.now();
            localStorage.setItem('focusflow_last_backup', now.toString());
            setLastBackup(new Date(now).toLocaleString());
        } catch (e: any) {
            alert(`Drive Backup Failed: ${e.message}`);
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

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Google Drive</h3>
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Google Client ID</label><span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Cloud Sync</span></div>
                    <div className="flex gap-2"><input type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="apps.googleusercontent.com" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white transition-all font-mono" /></div>
                    <div className="flex gap-2 mt-2"><input type="password" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} placeholder="Client Secret" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white transition-all font-mono" /><button onClick={handleSaveClientId} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button></div>
                    <div className="flex justify-between items-center mt-3"><p className="text-xs text-gray-400">Required for Drive backups and Calendar sync.</p><button onClick={handleGoogleLogin} className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg><span>Connect Account</span></button></div>
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
    );
};

export default GoogleDriveSection;
