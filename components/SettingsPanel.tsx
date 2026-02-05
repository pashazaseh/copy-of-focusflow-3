import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as storage from '../services/storageService';
import { StoredNavConfig, NAV_ITEMS_DEF } from './Sidebar';
import { TimerSettings, CountdownItem, MenuBarConfig, MenuBarMode, Project, HeatmapTheme, SidebarConfig, SettingsTab, AppTheme } from '../types';

interface SettingsPanelProps {
    navConfig: StoredNavConfig[];
    onUpdateNavConfig: (config: StoredNavConfig[]) => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    menuBarConfig: MenuBarConfig;
    onUpdateMenuBarConfig: (config: MenuBarConfig) => void;
    projects: Project[];
    onCreateProject: (name: string, theme: HeatmapTheme) => void;
    onDeleteProject: (id: string) => void;
    onUpdateProjects: (projects: Project[]) => void;
    activeTab: SettingsTab;
    onTabChange: (tab: SettingsTab) => void;
    sidebarConfig: SidebarConfig;
    onUpdateSidebarConfig: (config: SidebarConfig) => void;
    appTheme: AppTheme;
    setAppTheme: (theme: AppTheme) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    navConfig, 
    onUpdateNavConfig, 
    isDarkMode, 
    onToggleTheme, 
    menuBarConfig, 
    onUpdateMenuBarConfig,
    projects,
    onCreateProject,
    onDeleteProject,
    onUpdateProjects,
    activeTab,
    onTabChange,
    sidebarConfig,
    onUpdateSidebarConfig,
    appTheme,
    setAppTheme
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [copyStatus, setCopyStatus] = useState<string>('');
    const [isSafetyLocked, setIsSafetyLocked] = useState(true);

    // Project Manager State
    const [managerTab, setManagerTab] = useState<'active'|'archived'>('active');
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editTheme, setEditTheme] = useState<HeatmapTheme>('green');
    const [editGoal, setEditGoal] = useState<number>(0);
    
    // Project Creation State
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectTheme, setNewProjectTheme] = useState<HeatmapTheme>('green');

    // Timer Settings State
    const [timerSettings, setTimerSettings] = useState<TimerSettings>({ pomoDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, pomosPerLongBreak: 4, autoStartNextPomo: false, autoStartBreak: false, quickDurations: [25, 45, 60], shortBreakPresets: [5, 10, 15] });
    const [timerVolume, setTimerVolume] = useState<number>(() => {
        const v = localStorage.getItem('focusflow_timer_volume');
        return v ? parseFloat(v) : 0.5;
    });

    // Permission States
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    // Menu Bar Data
    const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);

    // Calendar Integration State
    const [googleClientId, setGoogleClientId] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('google_client_id') || '';
        return '';
    });
    // Gemini Integration State
    const [geminiApiKey, setGeminiApiKey] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('gemini_api_key') || '';
        return '';
    });
    const [isImportingBirthdays, setIsImportingBirthdays] = useState(false);
    const [isUploadingDrive, setIsUploadingDrive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [lastBackup, setLastBackup] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const ts = localStorage.getItem('focusflow_last_backup');
            if (ts) return new Date(parseInt(ts)).toLocaleString();
        }
        return null;
    });
    
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [driveFiles, setDriveFiles] = useState<any[]>([]);
    const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [restoreFileCandidate, setRestoreFileCandidate] = useState<{id: string, name: string} | null>(null);
    const [driveSearchQuery, setDriveSearchQuery] = useState('');

    const googleActionRef = useRef<'calendar' | 'drive' | 'login' | 'restore'>('none');
    const [tokenClient, setTokenClient] = useState<any>(null);

    // Inventory State for Themes
    const [inventory, setInventory] = useState<Record<string, any>>({});

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                setInventory(JSON.parse(localStorage.getItem('focusflow_inventory') || '{}'));
            } catch {}
        }
    }, []);

    // Init Data
    useEffect(() => {
        storage.getCountdowns().then(setCountdowns);
        storage.getTimerSettings().then(setTimerSettings);
        
        if (typeof (window as any).google === 'undefined') {
            // Only attempt to load external scripts if online
            if (navigator.onLine) {
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    if (googleClientId) initTokenClient(googleClientId);
                };
                script.onerror = () => console.warn("Google Script failed to load (offline)");
                document.body.appendChild(script);
            }
        } else if (googleClientId) {
            initTokenClient(googleClientId);
        }
    }, [googleClientId]);

    const initTokenClient = (clientId: string) => {
        if (typeof (window as any).google !== 'undefined' && (window as any).google.accounts && (window as any).google.accounts.oauth2) {
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                // Request broader scope for reading calendars
                scope: 'https://www.googleapis.com/auth/calendar.readonly', 
                ux_mode: 'popup',
                error_callback: (err: any) => {
                    console.error("Google Auth Error:", err);
                    alert(`Google Auth Error: ${err.type} ${err.message ? `- ${err.message}` : ''}. \n\nEnsure '${window.location.origin}' is added to Authorized JavaScript Origins in Google Cloud Console.`);
                },
                callback: (resp: any) => {
                    if (resp.access_token) {
                        setAccessToken(resp.access_token);
                        if (googleActionRef.current === 'calendar') {
                            importBirthdays(resp.access_token);
                        } else if (googleActionRef.current === 'drive') {
                            uploadToDrive(resp.access_token);
                        } else if (googleActionRef.current === 'login') {
                            alert("Google Account connected successfully.");
                        } else if (googleActionRef.current === 'restore') {
                            listDriveBackups(resp.access_token);
                        }
                    }
                    else {
                        setIsImportingBirthdays(false);
                        console.error("OAuth error:", resp);
                    }
                },
            });
            setTokenClient(client);
            googleActionRef.current = 'none';
        }
    };

    const handleGoogleLogin = () => {
        if (!googleClientId) {
            alert("Please enter a Google Client ID first.");
            return;
        }
        googleActionRef.current = 'login';
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            initTokenClient(googleClientId);
            setTimeout(() => {
                if (tokenClient) tokenClient.requestAccessToken();
            }, 500);
        }
    };

    const handleRestoreFromDriveClick = () => {
        if (!googleClientId) {
            alert("Please enter a Google Client ID in the 'Integrations & API' section first.");
            return;
        }
        googleActionRef.current = 'restore';
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            initTokenClient(googleClientId);
            setTimeout(() => {
                if ((window as any).google && (window as any).google.accounts) {
                    alert("Google Services are initializing. Please try again.");
                }
            }, 1000);
        }
    };

    const listDriveBackups = async (token: string) => {
        setIsLoadingDriveFiles(true);
        setIsRestoreModalOpen(true);
        setDriveSearchQuery('');
        try {
            const q = "mimeType = 'application/json' and name contains 'focusflow_backup' and trashed = false";
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name, createdTime, size)&orderBy=createdTime desc`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to list files');
            
            const data = await response.json();
            setDriveFiles(data.files || []);
        } catch (e: any) {
            console.error(e);
            alert(`Failed to list backups: ${e.message}`);
            setIsRestoreModalOpen(false);
        } finally {
            setIsLoadingDriveFiles(false);
        }
    };

    const onSelectRestoreFile = (fileId: string, fileName: string) => {
        setRestoreFileCandidate({ id: fileId, name: fileName });
    };

    const performRestore = async () => {
        if (!accessToken || !restoreFileCandidate) return;
        const fileId = restoreFileCandidate.id;
        
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (!response.ok) throw new Error('Failed to download file');
            
            const content = await response.text();
            const result = await storage.importData(content);
            
            if (result.success) {
                alert('Data restored successfully. The application will now reload.');
                window.location.reload();
            } else {
                alert(`Restore Failed: ${result.message}`);
            }
        } catch (e: any) {
            console.error(e);
            alert(`Restore Failed: ${e.message}`);
        } finally {
            setRestoreFileCandidate(null);
        }
    };

    // --- Export Handlers ---

    const handleExportJSON = async () => {
        const data = await storage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const now = Date.now();
        localStorage.setItem('focusflow_last_backup', now.toString());
        setLastBackup(new Date(now).toLocaleString());
    };

    const handleExportCSV = async () => {
        const csv = await storage.exportLogsToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportBirthdaysCSV = async () => {
        const csv = await storage.exportBirthdaysToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_birthdays_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopyToClipboard = async () => {
        const data = await storage.exportData();
        navigator.clipboard.writeText(data).then(() => {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            setCopyStatus('Failed');
        });
    };

    // --- Import Handlers ---

    const handleImportClick = () => {
        if (confirm("WARNING: Importing data will completely OVERWRITE your current logs, settings, and projects.\n\nAre you sure you want to proceed?")) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                const result = await storage.importData(content);
                if (result.success) {
                    alert('Data imported successfully. The application will now reload.');
                    window.location.reload();
                } else {
                    alert(`Import Failed: ${result.message}`);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // --- Timer Settings Handlers ---
    const handleTimerSettingChange = async (key: keyof TimerSettings, value: any) => {
        const newSettings = { ...timerSettings, [key]: value };
        setTimerSettings(newSettings);
        await storage.saveTimerSettings(newSettings);
    };

    const handlePresetChange = async (type: 'quickDurations' | 'shortBreakPresets', index: number, value: number) => {
        const newPresets = [...timerSettings[type]];
        newPresets[index] = value;
        const newSettings = { ...timerSettings, [type]: newPresets };
        setTimerSettings(newSettings);
        await storage.saveTimerSettings(newSettings);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setTimerVolume(val);
        localStorage.setItem('focusflow_timer_volume', val.toString());
    };

    // --- Permissions Logic ---
    const requestNotificationPermission = () => {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notifications.");
            return;
        }
        Notification.requestPermission().then((permission) => {
            setNotificationPermission(permission);
            if (permission === "granted") {
                new Notification("FocusFlow", { body: "Notifications enabled successfully!" });
            }
        });
    };

    const testNotification = () => {
        if (notificationPermission === "granted") {
            new Notification("Test Alert", { body: "This is a test notification from FocusFlow." });
        } else {
            alert("Notifications are not enabled. Please enable them first.");
        }
    };

    const testSound = () => {
        // Changed to local asset for offline support
        const audio = new Audio('./assets/alarm.mp3');
        audio.volume = timerVolume;
        audio.play().catch(e => alert("Could not play sound. Check if 'alarm.mp3' exists in assets."));
    };

    // --- Project Management Handlers ---
    const displayedManagerProjects = useMemo(() => {
        const list = managerTab === 'active' 
            ? projects.filter(p => !p.isArchived) 
            : projects.filter(p => p.isArchived);
        return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }, [projects, managerTab]);

    const moveProject = (index: number, direction: 'up' | 'down') => {
        const newList = [...displayedManagerProjects];

        if (direction === 'up' && index > 0) {
            [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
        } else if (direction === 'down' && index < newList.length - 1) {
            [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
        } else {
            return;
        }

        const updates = new Map(newList.map((p, i) => [p.id, i]));

        const newProjects = projects.map(p => {
            if (updates.has(p.id)) {
                return { ...p, sortOrder: updates.get(p.id)! };
            }
            return p;
        });
        
        // Sort global list to ensure consistency
        newProjects.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        onUpdateProjects(newProjects);
    };

    const startEditingProject = (p: Project) => {
        setEditingProjectId(p.id);
        setEditName(p.name);
        setEditTheme(p.theme);
        setEditGoal(p.weeklyGoal || 0);
    };

    const saveProjectEdit = () => {
        if (editingProjectId) {
            const newProjects = projects.map(p => {
                if (p.id === editingProjectId) {
                    return { ...p, name: editName, theme: editTheme, weeklyGoal: editGoal > 0 ? editGoal : undefined };
                }
                return p;
            });
            onUpdateProjects(newProjects);
            setEditingProjectId(null);
        }
    };

    const toggleProjectArchive = (id: string) => {
        const newProjects = projects.map(p => {
            if (p.id === id) return { ...p, isArchived: !p.isArchived };
            return p;
        });
        onUpdateProjects(newProjects);
    };

    const handleCreateNewProject = () => {
        if (!newProjectName.trim()) return;
        onCreateProject(newProjectName, newProjectTheme);
        setNewProjectName('');
        setIsCreatingProject(false);
    };


    // --- Danger Zone ---
    const handleClearLogs = async () => {
        if(confirm("Are you sure you want to delete ALL study logs? This cannot be undone.")) {
            await storage.clearLogs();
            if (!await storage.isInitialized()) await storage.setInitialized();
            window.location.reload();
        }
    };

    const handleClearSettings = async () => {
        if(confirm("Are you sure you want to reset timer settings and goals?")) {
            await storage.clearSettings();
            window.location.reload();
        }
    };

    const handleClearCountdowns = async () => {
        if(confirm("Are you sure you want to delete all countdowns and calendar events?")) {
            await storage.clearCountdowns();
            window.location.reload();
        }
    };

    const handleFactoryReset = async () => {
        if (confirm("DANGER: This will delete ALL your data, logs, projects, and settings. This action cannot be undone.\n\nType 'DELETE' to confirm.")) {
            const check = prompt("Type 'DELETE' to confirm factory reset:");
            if (check === 'DELETE') {
                await storage.clearAllData();
                await storage.setInitialized(); 
                window.location.reload();
            }
        }
    };

    // --- Google Calendar Logic ---

    const handleSaveClientId = () => {
        localStorage.setItem('google_client_id', googleClientId);
        initTokenClient(googleClientId);
        alert("Client ID Saved.");
    };

    const handleSaveGeminiKey = () => {
        localStorage.setItem('gemini_api_key', geminiApiKey);
        alert("Gemini API Key Saved.");
    };

    const handleImportBirthdaysClick = () => {
        if (!googleClientId) {
            alert("Please enter a Google Client ID in the 'Integrations & API' section first.");
            return;
        }
        googleActionRef.current = 'calendar';
        setIsImportingBirthdays(true);
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
             // Fallback if client wasn't ready
             initTokenClient(googleClientId);
             setTimeout(() => {
                 if ((window as any).google && (window as any).google.accounts) {
                     alert("Google Services are initializing. Please try again.");
                 }
                 setIsImportingBirthdays(false);
             }, 1000);
        }
    };

    const handleDriveBackupClick = () => {
        if (!googleClientId) {
            alert("Please enter a Google Client ID in the 'Integrations & API' section first.");
            return;
        }
        setIsUploadingDrive(true);
        googleActionRef.current = 'drive';
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            initTokenClient(googleClientId);
            setTimeout(() => {
                if ((window as any).google && (window as any).google.accounts) {
                    alert("Google Services are initializing. Please try again.");
                }
                setIsUploadingDrive(false);
            }, 1000);
        }
    };

    const uploadToDrive = async (accessToken: string) => {
        setUploadProgress(0);
        try {
            const data = await storage.exportData();
            const fileContent = new Blob([data], { type: 'application/json' });
            const metadata = {
                name: `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`,
                mimeType: 'application/json',
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', fileContent);

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
                xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
                
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = (event.loaded / event.total) * 100;
                        setUploadProgress(percent);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(new Error(err.error?.message || 'Upload failed'));
                        } catch {
                            reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                    }
                };

                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.send(form);
            });

            alert(`Backup uploaded to Google Drive successfully!`);
            
            const now = Date.now();
            localStorage.setItem('focusflow_last_backup', now.toString());
            setLastBackup(new Date(now).toLocaleString());
        } catch (e: any) {
            console.error(e);
            alert(`Drive Backup Failed: ${e.message}`);
        } finally {
            setIsUploadingDrive(false);
            setUploadProgress(0);
        }
    };

    const importBirthdays = async (accessToken: string) => {
        try {
            let targetCalendarId = 'addressbook#contacts@group.v.calendar.google.com';
            let calendarFound = false;

            // 1. List Calendars
            const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (calListRes.ok) {
                const calList = await calListRes.json();
                const birthdayCal = calList.items.find((c: any) => 
                    c.id === 'addressbook#contacts@group.v.calendar.google.com' || 
                    c.id === '#contacts@group.v.calendar.google.com' ||
                    (c.summary && c.summary.toLowerCase().includes('birthday'))
                );
                if (birthdayCal) {
                    targetCalendarId = birthdayCal.id;
                    calendarFound = true;
                }
            }

            // 2. Fetch Events
            const now = new Date();
            const nextYear = new Date();
            nextYear.setFullYear(now.getFullYear() + 1);
            
            const eventsRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events?timeMin=${now.toISOString()}&timeMax=${nextYear.toISOString()}&singleEvents=true&orderBy=startTime`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            
            if (!eventsRes.ok) {
                throw new Error(calendarFound ? 'Failed to fetch events from Birthday calendar.' : 'Could not find Birthday calendar.');
            }
            
            const eventsData = await eventsRes.json();
            let importedCount = 0;
            
            if (eventsData.items) {
                const currentCountdowns = await storage.getCountdowns();
                const newItems: CountdownItem[] = [];
                
                eventsData.items.forEach((evt: any) => {
                    if (!evt.start || !evt.start.date) return;
                    const cleanTitle = evt.summary.replace(/'s Birthday|’s Birthday/gi, "").trim();
                    
                    const exists = currentCountdowns.some(c => c.title === cleanTitle && c.type === 'birthday') || newItems.some(n => n.title === cleanTitle);
                    
                    if (!exists) {
                        newItems.push({
                            id: Date.now().toString() + Math.random().toString().slice(2, 8),
                            title: cleanTitle,
                            date: evt.start.date,
                            type: 'birthday',
                            color: 'orange',
                            recurrence: 'yearly',
                            isArchived: false
                        });
                        importedCount++;
                    }
                });
                
                for (const item of newItems) { await storage.saveCountdown(item); }
            }
            alert(`Successfully imported ${importedCount} birthdays.`);
        } catch (e: any) {
            console.error(e);
            alert(`Error importing: ${e.message}`);
        } finally {
            setIsImportingBirthdays(false);
        }
    };

    // --- Navigation Customization Handlers ---
    
    const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggingIndex(index);
      e.dataTransfer.effectAllowed = "move";  
      // FIXED: Create a proper ghost element with dimensions and content
      // This prevents the yellow rectangle bug caused by browser fallback
      const ghost = document.createElement('div');
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';  // Position off-screen
      ghost.style.width = '200px';
      ghost.style.height = '40px';
      ghost.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';  // Blue tint
      ghost.style.border = '2px dashed rgba(59, 130, 246, 0.5)';
      ghost.style.borderRadius = '12px';
      ghost.style.display = 'flex';
      ghost.style.alignItems = 'center';
      ghost.style.justifyContent = 'center';
      ghost.style.fontSize = '14px';
      ghost.style.fontWeight = '600';
      ghost.style.color = '#3b82f6';
      ghost.textContent = '↕️ Moving...';
      
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 100, 20);  // Center the drag image
      
      // FIXED: Remove after a safe delay (was 0ms, now 100ms)
      // This gives browser time to capture the drag image before removal
      setTimeout(() => {
          if (document.body.contains(ghost)) {
              document.body.removeChild(ghost);
          }
      }, 100);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggingIndex === null || draggingIndex === index) return;
      
      const newConfig = [...navConfig];
      const draggedItem = newConfig[draggingIndex];
      newConfig.splice(draggingIndex, 1);
      newConfig.splice(index, 0, draggedItem);
      
      onUpdateNavConfig(newConfig);
      setDraggingIndex(index);
    };

    const handleDragEnd = () => {
      setDraggingIndex(null);
    };

    const toggleVisibility = (index: number) => {
      const newConfig = [...navConfig];
      newConfig[index].isVisible = !newConfig[index].isVisible;
      onUpdateNavConfig(newConfig);
    };

    const handleResetConfig = () => {
        const defaultConf = NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true }));
        onUpdateNavConfig(defaultConf);
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage preferences, projects, and data.</p>
                        </div>
                        
                        {/* Tab Navigation */}
                        <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl shadow-inner overflow-x-auto no-scrollbar">
                            {(['general', 'timer', 'projects', 'integrations', 'data'] as SettingsTab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => onTabChange(tab)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide whitespace-nowrap ${
                                        activeTab === tab 
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Content Area */}
                    <div className="space-y-6">
                        
                        {/* === GENERAL TAB === */}
                        {activeTab === 'general' && (
                            <>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Appearance</h3>
                                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">Dark Mode</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Toggle application appearance</p>
                                        </div>
                                        <button 
                                            onClick={onToggleTheme}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Theme Selector */}
                                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                        <div className="mb-3">
                                            <p className="font-semibold text-gray-900 dark:text-white">Visual Theme</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Select your preferred interface style</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setAppTheme('default')}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${appTheme === 'default' ? 'bg-white dark:bg-gray-700 border-blue-500 text-blue-600 dark:text-white shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                                            >
                                                Default
                                            </button>
                                            <button 
                                                onClick={() => setAppTheme('cyberpunk')}
                                                disabled={!inventory.theme_cyber}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 ${appTheme === 'cyberpunk' ? 'bg-slate-900 border-purple-500 text-purple-400 shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                            >
                                                <span>Cyberpunk</span>
                                                {!inventory.theme_cyber && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 rounded text-gray-500">Locked</span>}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Navigation & Sidebar</h3>
                                        <button onClick={handleResetConfig} className="text-xs text-gray-500 hover:text-blue-500 underline">Reset Default</button>
                                    </div>
                                    <div className="space-y-4">
                                        {/* Sidebar Widgets */}
                                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">Weekly Goal Widget</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Show weekly progress at sidebar bottom</p>
                                            </div>
                                            <button 
                                                onClick={() => onUpdateSidebarConfig({ ...sidebarConfig, showWeeklyGoalWidget: !sidebarConfig.showWeeklyGoalWidget })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${sidebarConfig.showWeeklyGoalWidget ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sidebarConfig.showWeeklyGoalWidget ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>

                                        {/* Nav Items */}
                                        <div className="space-y-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                            {navConfig.map((item, index) => {
                                                const def = NAV_ITEMS_DEF.find(d => d.view === item.view);
                                                if (!def) return null;
                                                
                                                return (
                                                    <div 
                                                        key={item.view}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, index)}
                                                        onDragOver={(e) => handleDragOver(e, index)}
                                                        onDragEnd={handleDragEnd}
                                                        className={`flex items-center p-3 rounded-xl bg-white dark:bg-[#252527] border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 cursor-move transition-all ${draggingIndex === index ? 'opacity-50' : 'opacity-100 shadow-sm'}`}
                                                    >
                                                        <div className="mr-3 text-gray-400 cursor-move shrink-0">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                                        </div>
                                                        <div className={`p-1.5 rounded-lg mr-3 shrink-0 ${item.isVisible ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-50'}`}>
                                                            {def.icon}
                                                        </div>
                                                        <span className={`flex-1 font-bold text-sm ${item.isVisible ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}>
                                                            {def.label}
                                                        </span>
                                                        <div className="relative flex items-center justify-end w-10">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={item.isVisible} 
                                                                onChange={() => toggleVisibility(index)}
                                                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Menu Bar Display</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Mode</label>
                                            <select 
                                                value={menuBarConfig.mode} 
                                                onChange={(e) => onUpdateMenuBarConfig({ ...menuBarConfig, mode: e.target.value as MenuBarMode })}
                                                className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="none">None (Icon Only)</option>
                                                <option value="today">Today's Hours</option>
                                                <option value="remaining">Remaining (Daily Goal)</option>
                                                <option value="streak">Current Streak</option>
                                                <option value="xp">Total XP</option>
                                                <option value="motivation">Motivation</option>
                                                <option value="timer">Active Timer</option>
                                                <option value="countdown_closest">Closest Countdown</option>
                                                <option value="countdown_custom">Custom Countdown</option>
                                            </select>
                                        </div>
                                        {menuBarConfig.mode === 'countdown_custom' && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Countdown</label>
                                                <select 
                                                    value={menuBarConfig.customCountdownId || ''} 
                                                    onChange={(e) => onUpdateMenuBarConfig({ ...menuBarConfig, customCountdownId: e.target.value })}
                                                    className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    <option value="">Select an event...</option>
                                                    {countdowns.map(c => (
                                                        <option key={c.id} value={c.id}>{c.title}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* === PROJECTS TAB === */}
                        {activeTab === 'projects' && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm min-h-[500px] flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Project Manager</h3>
                                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setManagerTab('active')} 
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${managerTab === 'active' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                                        >
                                            Active
                                        </button>
                                        <button 
                                            onClick={() => setManagerTab('archived')} 
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${managerTab === 'archived' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                        >
                                            Archived
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Add Project Button / Form */}
                                {managerTab === 'active' && (
                                    <div className="mb-4">
                                        {!isCreatingProject ? (
                                            <button 
                                                onClick={() => setIsCreatingProject(true)}
                                                className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 dark:text-gray-500 font-bold text-sm hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                Add New Project
                                            </button>
                                        ) : (
                                            <div className="bg-white dark:bg-[#1c1c1e] rounded-xl p-4 border border-blue-200 dark:border-blue-900/50 shadow-lg animate-fade-in-down">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">New Project</h4>
                                                    <button onClick={() => setIsCreatingProject(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                                                        <input 
                                                            type="text" 
                                                            value={newProjectName} 
                                                            onChange={(e) => setNewProjectName(e.target.value)} 
                                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                                                            placeholder="Project Name"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Theme</label>
                                                        <div className="flex gap-3">
                                                            {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                                                <button 
                                                                    key={t} 
                                                                    onClick={() => setNewProjectTheme(t)} 
                                                                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                                                                        t === 'green' ? 'bg-green-500 border-green-200 dark:border-green-900' : 
                                                                        t === 'blue' ? 'bg-blue-500 border-blue-200 dark:border-blue-900' : 
                                                                        t === 'orange' ? 'bg-orange-500 border-orange-200 dark:border-orange-900' : 
                                                                        'bg-purple-500 border-purple-200 dark:border-purple-900'
                                                                    } ${newProjectTheme === t ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`} 
                                                                >
                                                                    {newProjectTheme === t && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={handleCreateNewProject}
                                                        disabled={!newProjectName.trim()}
                                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all"
                                                    >
                                                        Create Project
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                                    {displayedManagerProjects.length === 0 && (
                                        <div className="text-center py-20 text-gray-400 text-sm">No projects found.</div>
                                    )}
                                    {displayedManagerProjects.map((p, index) => (
                                        <div key={p.id} className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 group transition-all hover:border-blue-300 dark:hover:border-blue-500/50">
                                            {editingProjectId === p.id ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Project Name</label>
                                                        <input 
                                                            type="text" 
                                                            value={editName} 
                                                            onChange={(e) => setEditName(e.target.value)} 
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                                                            placeholder="e.g. Work, Study"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Color Theme</label>
                                                            <div className="flex gap-3">
                                                                {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                                                    <button 
                                                                        key={t} 
                                                                        onClick={() => setEditTheme(t)} 
                                                                        className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                                                                            t === 'green' ? 'bg-green-500 border-green-200 dark:border-green-900' : 
                                                                            t === 'blue' ? 'bg-blue-500 border-blue-200 dark:border-blue-900' : 
                                                                            t === 'orange' ? 'bg-orange-500 border-orange-200 dark:border-orange-900' : 
                                                                            'bg-purple-500 border-purple-200 dark:border-purple-900'
                                                                        } ${editTheme === t ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`} 
                                                                    >
                                                                        {editTheme === t && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Weekly Goal (Hrs)</label>
                                                            <div className="relative">
                                                                <input 
                                                                    type="number" 
                                                                    value={editGoal || ''} 
                                                                    onChange={(e) => setEditGoal(parseInt(e.target.value))} 
                                                                    placeholder="Global Default"
                                                                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700/50">
                                                        <button onClick={() => setEditingProjectId(null)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-bold py-2.5 rounded-xl transition-colors">Cancel</button>
                                                        <button onClick={saveProjectEdit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-500/20">Save Changes</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4 overflow-hidden">
                                                        <div className="flex flex-col gap-1">
                                                            {managerTab === 'active' && (
                                                                <button onClick={() => moveProject(index, 'up')} disabled={index === 0} className="text-gray-300 hover:text-blue-500 disabled:opacity-20"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                                                            )}
                                                            {managerTab === 'active' && (
                                                                <button onClick={() => moveProject(index, 'down')} disabled={index === displayedManagerProjects.length - 1} className="text-gray-300 hover:text-blue-500 disabled:opacity-20"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                                                            )}
                                                        </div>
                                                        <div className={`w-3 h-3 rounded-full shrink-0 ${p.theme === 'green' ? 'bg-green-500' : p.theme === 'blue' ? 'bg-blue-500' : p.theme === 'orange' ? 'bg-orange-500' : 'bg-purple-500'}`}></div>
                                                        <div className="truncate">
                                                            <p className="font-bold text-base text-gray-900 dark:text-white truncate">{p.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {p.weeklyGoal ? `Goal: ${p.weeklyGoal}h/wk` : 'Global Goal'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => startEditingProject(p)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                        <button onClick={() => toggleProjectArchive(p.id)} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors" title={p.isArchived ? "Restore" : "Archive"}>
                                                            {p.isArchived ? (
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                            ) : (
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                                            )}
                                                        </button>
                                                        <button onClick={() => { if(confirm('Delete project permanently?')) onDeleteProject(p.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* === TIMER TAB === */}
                        {activeTab === 'timer' && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Timer Configuration</h3>
                                
                                <div className="space-y-6">
                                    {/* ... Timer settings ... */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Focus</label>
                                            <div className="relative">
                                                <input type="number" value={timerSettings.pomoDuration} onChange={(e) => handleTimerSettingChange('pomoDuration', parseInt(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white font-bold" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Short Break</label>
                                            <div className="relative">
                                                <input type="number" value={timerSettings.shortBreakDuration} onChange={(e) => handleTimerSettingChange('shortBreakDuration', parseInt(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white font-bold" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Long Break</label>
                                            <div className="relative">
                                                <input type="number" value={timerSettings.longBreakDuration} onChange={(e) => handleTimerSettingChange('longBreakDuration', parseInt(e.target.value))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white font-bold" />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Volume</label>
                                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center space-x-3 h-[42px]">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="1" 
                                                step="0.1" 
                                                value={timerVolume} 
                                                onChange={handleVolumeChange} 
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600" 
                                            />
                                            <span className="text-xs font-mono text-gray-500 w-8 text-right">{(timerVolume * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    {/* Audio Check */}
                                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">Audio Playback</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Verify sound is working</p>
                                        </div>
                                        <button 
                                            onClick={testSound}
                                            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-200"
                                        >
                                            Test Sound
                                        </button>
                                    </div>

                                    <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Access Presets</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Focus Presets */}
                                            <div className="space-y-2">
                                                <span className="text-xs text-gray-400 font-medium">Focus Timer Shortcuts</span>
                                                <div className="flex gap-2">
                                                    {timerSettings.quickDurations.map((duration, index) => (
                                                        <div key={`focus-${index}`} className="relative flex-1">
                                                            <input 
                                                                type="number" 
                                                                value={duration}
                                                                onChange={(e) => handlePresetChange('quickDurations', index, parseInt(e.target.value))}
                                                                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                            <span className="absolute right-1 top-1.5 text-[10px] text-gray-400 pointer-events-none">m</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Short Break Presets */}
                                            <div className="space-y-2">
                                                <span className="text-xs text-gray-400 font-medium">Short Break Shortcuts</span>
                                                <div className="flex gap-2">
                                                    {timerSettings.shortBreakPresets.map((duration, index) => (
                                                        <div key={`break-${index}`} className="relative flex-1">
                                                            <input 
                                                                type="number" 
                                                                value={duration}
                                                                onChange={(e) => handlePresetChange('shortBreakPresets', index, parseInt(e.target.value))}
                                                                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                                            />
                                                            <span className="absolute right-1 top-1.5 text-[10px] text-gray-400 pointer-events-none">m</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ... (Integrations and Data Tabs remain same but updated with activeTab logic if needed) ... */}
                        {/* === INTEGRATIONS TAB === */}
                        {activeTab === 'integrations' && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Integrations & API</h3>
                                <div className="space-y-6">
                                    {/* Google Client ID */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Google Client ID</label>
                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Calendar</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={googleClientId}
                                                onChange={(e) => setGoogleClientId(e.target.value)}
                                                placeholder="apps.googleusercontent.com"
                                                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white transition-all font-mono"
                                            />
                                            <button 
                                                onClick={handleSaveClientId}
                                                className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors"
                                            >
                                                Save
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center mt-3">
                                            <p className="text-xs text-gray-400">Required for syncing birthdays, events, and Drive backups.</p>
                                            <button 
                                                onClick={handleGoogleLogin}
                                                className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                                                <span>Connect Account</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>

                                    {/* Gemini API Key */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gemini API Key</label>
                                            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">AI Coach</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="password" 
                                                value={geminiApiKey}
                                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                                placeholder="Enter Gemini API Key"
                                                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white transition-all font-mono"
                                            />
                                            <button 
                                                onClick={handleSaveGeminiKey}
                                                className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors"
                                            >
                                                Save
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <p className="text-xs text-gray-400">Required for AI insights and analysis.</p>
                                            <div className="flex items-center space-x-2">
                                                <div className={`h-2 w-2 rounded-full ${geminiApiKey ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                                <span className={`text-xs font-bold uppercase tracking-wide ${geminiApiKey ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {geminiApiKey ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === DATA TAB === */}
                        {activeTab === 'data' && (
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Backup & Export</h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* JSON Column */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Full Backup (JSON)</h4>
                                                {lastBackup && <span className="text-[10px] text-gray-400 font-mono">Last: {lastBackup}</span>}
                                            </div>
                                            
                                            <button onClick={handleExportJSON} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                                <div className="text-left">
                                                    <span className="block font-bold text-gray-900 dark:text-white">Download Backup</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Save full state to file</span>
                                                </div>
                                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>

                                            <button onClick={handleDriveBackupClick} disabled={isUploadingDrive} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden">
                                                {isUploadingDrive && (
                                                    <div 
                                                        className="absolute left-0 top-0 bottom-0 bg-blue-500/10 transition-all duration-300 ease-out"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                )}
                                                <div className="text-left relative z-10">
                                                    <span className="block font-bold text-gray-900 dark:text-white">
                                                        {isUploadingDrive ? `Uploading... ${Math.round(uploadProgress)}%` : 'Backup to Google Drive'}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Upload backup to cloud</span>
                                                </div>
                                                <div className="relative z-10">
                                                    {isUploadingDrive ? (
                                                        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                                                    ) : (
                                                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                    )}
                                                </div>
                                            </button>

                                            <button onClick={handleRestoreFromDriveClick} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                                <div className="text-left">
                                                    <span className="block font-bold text-gray-900 dark:text-white">Restore from Drive</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Load backup from cloud</span>
                                                </div>
                                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                            </button>

                                            <button onClick={handleCopyToClipboard} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                                <div className="text-left">
                                                    <span className="block font-bold text-gray-900 dark:text-white">{copyStatus || 'Copy to Clipboard'}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Copy JSON for quick transfer</span>
                                                </div>
                                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                            </button>

                                            <button onClick={handleImportClick} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                                <div className="text-left">
                                                    <span className="block font-bold text-gray-900 dark:text-white">Restore Backup</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Overwrite current data</span>
                                                </div>
                                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                            </button>
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                                        </div>

                                        {/* CSV Column */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">CSV Exports</h4>
                                            <button onClick={handleExportCSV} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                                <div className="text-left">
                                                    <span className="block font-bold text-gray-900 dark:text-white">Export Logs</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Study sessions data</span>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-[10px] font-bold text-gray-600 dark:text-gray-300">.CSV</span>
                                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                </div>
                                            </button>
                                            <button onClick={handleExportBirthdaysCSV} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                                                <div className="text-left">
                                                    <span className="block font-bold text-gray-900 dark:text-white">Export Birthdays</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Calendar events data</span>
                                                </div>
                                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                                            <p className="text-sm text-red-600/70 dark:text-red-400/70">Irreversible actions regarding your data.</p>
                                        </div>
                                        
                                        {/* Safety Lock */}
                                        <div className="flex items-center bg-white dark:bg-red-900/20 px-3 py-1.5 rounded-full border border-red-100 dark:border-red-800/30">
                                            <span className="text-xs font-bold text-red-600 dark:text-red-400 mr-2 uppercase tracking-wide">Safety Lock</span>
                                            <button 
                                                onClick={() => setIsSafetyLocked(!isSafetyLocked)}
                                                className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${isSafetyLocked ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                            >
                                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isSafetyLocked ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <button 
                                            onClick={handleClearLogs}
                                            disabled={isSafetyLocked}
                                            className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                                                isSafetyLocked 
                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                                                : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800'
                                            }`}
                                        >
                                            Clear Logs
                                        </button>
                                        <button 
                                            onClick={handleClearSettings}
                                            disabled={isSafetyLocked}
                                            className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                                                isSafetyLocked 
                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                                                : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800'
                                            }`}
                                        >
                                            Clear Settings
                                        </button>
                                        <button 
                                            onClick={handleClearCountdowns}
                                            disabled={isSafetyLocked}
                                            className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                                                isSafetyLocked 
                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                                                : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800'
                                            }`}
                                        >
                                            Clear Countdown
                                        </button>
                                        <button 
                                            onClick={handleFactoryReset}
                                            disabled={isSafetyLocked}
                                            className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                                                isSafetyLocked 
                                                ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                                                : 'bg-red-600 hover:bg-red-700 text-white border border-red-600'
                                            }`}
                                        >
                                            Factory Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Restore Modal */}
            {isRestoreModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in flex flex-col max-h-[80vh]">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252527] flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Restore from Google Drive</h3>
                            <button onClick={() => setIsRestoreModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1c1e]">
                            <div className="relative">
                                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input 
                                    type="text" 
                                    placeholder="Search backups..." 
                                    value={driveSearchQuery}
                                    onChange={(e) => setDriveSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {isLoadingDriveFiles ? (
                                <div className="flex flex-col items-center justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                    <p className="text-sm text-gray-500">Loading backups...</p>
                                </div>
                            ) : driveFiles.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">No backup files found.</div>
                            ) : (
                                <div className="space-y-2">
                                    {driveFiles.filter(f => f.name.toLowerCase().includes(driveSearchQuery.toLowerCase())).map((file) => (
                                        <button 
                                            key={file.id}
                                            onClick={() => onSelectRestoreFile(file.id, file.name)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-left group border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                                        >
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{file.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(file.createdTime).toLocaleString()} • {(parseInt(file.size)/1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </button>
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Are you sure you want to restore <span className="font-bold text-gray-900 dark:text-white">{restoreFileCandidate.name}</span>?
                            <br/><br/>
                            <span className="text-red-500 font-bold">Warning:</span> This will overwrite all current data.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setRestoreFileCandidate(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={performRestore}
                                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg transition-colors"
                            >
                                Restore Data
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};