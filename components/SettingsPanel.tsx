import React, { useState, useEffect, useMemo, lazy, useRef } from 'react';
import { StoredNavConfig } from './Sidebar';
import { MenuBarConfig, Project, HeatmapTheme, SidebarConfig, SettingsTab, AppTheme, Transaction } from '../types';
import { useCountdowns } from '../AppContext';
import { GeneralSettings } from './Settings/GeneralSettings';
import { TimerSettingsPanel } from './Settings/TimerSettings';
import { SyncSettings } from './Settings/SyncSettings';
import { DataSettings } from './Settings/DataSettings';
import { ProjectSettings } from './Settings/ProjectSettings';
const DebugSettings = lazy(() => import('./Settings/DebugSettings').then(module => ({ default: module.DebugSettings })));

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
    currentGems: number;
    addTransaction: (t: Transaction) => void;
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
    setAppTheme,
    currentGems,
    addTransaction
}) => {
    const { countdowns } = useCountdowns();
    const isCyberpunk = appTheme === 'cyberpunk';

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const [lastBackup, setLastBackup] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const ts = localStorage.getItem('focusflow_last_backup');
            if (ts) return new Date(parseInt(ts)).toLocaleString();
        }
        return null;
    });

    // Inventory State for Themes
    const [inventory, setInventory] = useState<Record<string, any>>({});

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                setInventory(JSON.parse(localStorage.getItem('focusflow_inventory') || '{}'));
            } catch {}
        }
    }, []);

    const [shortcut, setShortcut] = useState('');
    const [shortcutStatus, setShortcutStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [isRecording, setIsRecording] = useState(false);

    useEffect(() => {
        (window as any).electronAPI?.invoke?.('get-global-shortcut').then((s: string) => {
            if (isMounted.current) setShortcut(s);
        });
    }, []);

    const handleSaveShortcut = async (value?: string) => {
        const s = value !== undefined ? value : shortcut;
        if (isMounted.current) setShortcutStatus('saving');
        try {
            const success = await (window as any).electronAPI?.invoke?.('update-global-shortcut', s);
            if (!isMounted.current) return;
            if (success) {
                setShortcutStatus('success');
                setTimeout(() => { if (isMounted.current) setShortcutStatus('idle'); }, 2000);
            } else {
                setShortcutStatus('error');
                // Revert to fetched if failed
                (window as any).electronAPI?.invoke?.('get-global-shortcut').then((s: string) => {
                    if (isMounted.current) setShortcut(s);
                });
            }
        } catch (e) {
            if (isMounted.current) setShortcutStatus('error');
        }
    };

    useEffect(() => {
        if (!isRecording) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape') {
                setIsRecording(false);
                // Revert visual state to saved
                (window as any).electronAPI?.invoke?.('get-global-shortcut').then((s: string) => setShortcut(s));
                return;
            }

            const modifiers: string[] = [];
            const isMac = (window.electronAPI as any)?.platform === 'darwin' || (navigator.platform && navigator.platform.toLowerCase().includes('mac'));

            if (e.metaKey) modifiers.push(isMac ? 'CommandOrControl' : 'Super');
            if (e.ctrlKey) modifiers.push(isMac ? 'Control' : 'CommandOrControl');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');

            let key = '';
            const code = e.code;

            if (code.startsWith('Key')) key = code.slice(3);
            else if (code.startsWith('Digit')) key = code.slice(5);
            else if (code.startsWith('Numpad')) key = 'Num' + code.slice(6);
            else if (code.startsWith('F') && code.length <= 3) key = code;
            else {
                const map: Record<string, string> = {
                    'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
                    'Space': 'Space', 'Enter': 'Return', 'Backspace': 'Backspace', 'Delete': 'Delete', 'Tab': 'Tab',
                    'Insert': 'Insert', 'Home': 'Home', 'End': 'End', 'PageUp': 'PageUp', 'PageDown': 'PageDown',
                    'Minus': '-', 'Equal': '=', 'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\',
                    'Semicolon': ';', 'Quote': '\'', 'Backquote': '`', 'Comma': ',', 'Period': '.', 'Slash': '/'
                };
                key = map[code] || '';
            }

            // If only modifiers, show them with placeholder
            if (!key && modifiers.length > 0) {
                setShortcut(modifiers.join('+') + ' + ...');
                return;
            }

            if (key) {
                const combo = [...new Set([...modifiers, key])].join('+');
                setShortcut(combo);
                handleSaveShortcut(combo);
                setIsRecording(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRecording]);

    const formatShortcut = (s: string) => {
        if (!s) return 'None';
        const isMac = (window.electronAPI as any)?.platform === 'darwin' || (navigator.platform && navigator.platform.toLowerCase().includes('mac'));
        return s.split('+').map(part => {
            if (part === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl';
            if (part === 'Command') return '⌘';
            if (part === 'Control') return '⌃';
            if (part === 'Alt') return isMac ? '⌥' : 'Alt';
            if (part === 'Shift') return '⇧';
            if (part === 'Super') return 'Win';
            return part;
        }).join(isMac ? '' : ' + ');
    };

    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle');
    const [latestVersion, setLatestVersion] = useState<string>('');
    const [updateBranch, setUpdateBranch] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('focusflow_update_branch') || 'main';
        return 'main';
    });
    const [repoName, setRepoName] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('focusflow_github_repo') || 'yourname/focusflow';
        return 'yourname/focusflow';
    });

    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

    const testRepoConnection = async (repoOverride?: string) => {
        const repo = typeof repoOverride === 'string' ? repoOverride : repoName;
        if (!repo) return;
        if (!navigator.onLine) {
            if (isMounted.current) setTestStatus('error');
            return;
        }
        if (isMounted.current) setTestStatus('testing');
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}`);
            if (!isMounted.current) return;
            if (res.ok) {
                const data = await res.json();
                if (isMounted.current) {
                    setTestStatus('success');
                    if (data.default_branch) {
                        setUpdateBranch(data.default_branch);
                        localStorage.setItem('focusflow_update_branch', data.default_branch);
                    }
                    setTimeout(() => { if (isMounted.current) setTestStatus('idle'); }, 2000);
                }
            } else {
                setTestStatus('error');
                setTimeout(() => { if (isMounted.current) setTestStatus('idle'); }, 2000);
            }
        } catch (e) {
            if (isMounted.current) {
                setTestStatus('error');
                setTimeout(() => { if (isMounted.current) setTestStatus('idle'); }, 2000);
            }
        }
    };

    const checkForUpdates = async () => {
        if (!navigator.onLine) {
            if (isMounted.current) setUpdateStatus('error');
            return;
        }
        if (isMounted.current) setUpdateStatus('checking');
        try {
            // Try fetching from branch first
            const branchRes = await fetch(`https://raw.githubusercontent.com/${repoName}/${updateBranch}/package.json`);
            if (branchRes.ok) {
                const data = await branchRes.json();
                if (isMounted.current) {
                    setLatestVersion(data.version);
                    if (data.version !== '1.0.0') setUpdateStatus('available');
                    else setUpdateStatus('latest');
                }
                return;
            }

            const res = await fetch(`https://api.github.com/repos/${repoName}/releases/latest`);
            if (!res.ok) throw new Error('Failed to check');
            const data = await res.json();
            if (isMounted.current) {
                setLatestVersion(data.tag_name);
                
                if (data.tag_name.replace('v', '') !== '1.0.0') {
                    setUpdateStatus('available');
                } else {
                    setUpdateStatus('latest');
                }
            }
        } catch (e) {
            if (isMounted.current) setUpdateStatus('error');
        }
    };

    const handleUnlockTheme = (themeKey: string, cost: number, name: string) => {
        if (currentGems >= cost) {
            // 1. Update Inventory
            const newInventory = { ...inventory, [themeKey]: true };
            setInventory(newInventory);
            localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
            
            // 2. Update Spent
            const currentSpent = parseInt(localStorage.getItem('focusflow_spent_gems') || '0') || 0;
            localStorage.setItem('focusflow_spent_gems', (currentSpent + cost).toString());
            
            // 3. Add Transaction
            addTransaction({
                id: `unlock-${themeKey}-${Date.now()}`,
                date: new Date().toISOString(),
                type: 'SPEND',
                amount: -cost,
                description: `Unlocked ${name} Theme`
            });
            
            // 4. Trigger Update
            window.dispatchEvent(new Event('focusflow-gem-update'));
        }
    };

    const cardClass = `p-6 rounded-2xl border shadow-sm ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`;
    const itemClass = `p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`;

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-white'}`}>
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-900 dark:text-white'}`}>Settings</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage preferences, projects, and data.</p>
                        </div>
                        
                        {/* Tab Navigation */}
                        <div className={`flex p-1 rounded-2xl shadow-inner transition-all duration-300 overflow-x-auto no-scrollbar ${isCyberpunk ? 'bg-black/40 border border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-gray-200 dark:bg-gray-800'}`}>
                            {(['general', 'timer', 'projects', 'sync', 'data', 'debug'] as any[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => onTabChange(tab as SettingsTab)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 uppercase tracking-wide whitespace-nowrap flex-shrink-0 ${
                                        activeTab === tab 
                                        ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-[#00f0ff]/50 animate-pulse' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm')
                                        : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/5' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200')
                                    }`}
                                >
                                    {tab === 'timer' ? 'Configuration' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Content Area */}
                    <div className="space-y-6">
                        {activeTab === 'general' && (
                            <>
                                <GeneralSettings navConfig={navConfig} onUpdateNavConfig={onUpdateNavConfig} isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} appTheme={appTheme} setAppTheme={setAppTheme} inventory={inventory} sidebarConfig={sidebarConfig} onUpdateSidebarConfig={onUpdateSidebarConfig} menuBarConfig={menuBarConfig} onUpdateMenuBarConfig={onUpdateMenuBarConfig} countdowns={countdowns} onUnlockTheme={handleUnlockTheme} currentGems={currentGems} />
                            </>
                        )}
                        {activeTab === 'projects' && <ProjectSettings projects={projects} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onUpdateProjects={onUpdateProjects} appTheme={appTheme} />}
                        {activeTab === 'timer' && (
                            <>
                                <TimerSettingsPanel appTheme={appTheme} />
                                <div className={cardClass}>
                                    <h3 className={`text-xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Shortcuts</h3>
                                    <div className={itemClass}>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Quick Capture</div>
                                                <div className="group relative">
                                                    <svg className={`w-3.5 h-3.5 cursor-help ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-900 text-white'}`}>
                                                        Click to record. Press keys (e.g. Cmd+Shift+C). Esc to cancel.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Global keyboard shortcut</div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setIsRecording(true);
                                                        setShortcutStatus('idle');
                                                    }}
                                                    className={`min-w-[140px] px-4 py-2 rounded-lg text-sm font-mono font-bold border transition-all relative overflow-hidden ${
                                                        isRecording 
                                                        ? (isCyberpunk ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] animate-pulse' : 'bg-blue-100 border-blue-500 text-blue-700 animate-pulse')
                                                        : (isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] hover:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-400')
                                                    }`}
                                                >
                                                    {isRecording ? (shortcut || 'Press keys...') : (formatShortcut(shortcut) || 'Click to Record')}
                                                    {isRecording && <div className="absolute inset-0 bg-current opacity-10"></div>}
                                                </button>
                                                
                                                {isRecording && (
                                                    <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsRecording(false)}></div>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-2">
                                                <button
                                                    onClick={() => {
                                                        const def = 'CommandOrControl+Shift+C';
                                                        setShortcut(def);
                                                        handleSaveShortcut(def);
                                                    }}
                                                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff]/60 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                >
                                                    Reset Default
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const api = (window as any).electronAPI;
                                                        if (api?.invoke) {
                                                            api.invoke('open-quick-capture');
                                                        } else {
                                                            alert("Quick Capture is only available in the desktop app.");
                                                        }
                                                    }}
                                                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                >
                                                    Test Capture
                                                </button>
                                            </div>
                                            {shortcutStatus === 'error' && <span className="text-[10px] text-red-500 mt-1">Invalid or taken</span>}
                                            {shortcutStatus === 'success' && <span className="text-[10px] text-green-500 mt-1">Saved</span>}
                                            {shortcutStatus === 'saving' && <span className="text-[10px] text-gray-500 mt-1">Saving...</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className={cardClass}>
                                    <h3 className={`text-xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update App</h3>
                                    <p className={`text-sm mb-6 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>
                                        Update FocusFlow to the latest version. Your data will be preserved.
                                    </p>
                                    
                                    <div className="space-y-4">
                                        <div className={itemClass}>
                                            <div>
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>GitHub Repository</div>
                                                <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>owner/repo name</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={repoName}
                                                        onChange={(e) => { 
                                                            let val = e.target.value;
                                                            let isUrl = false;
                                                            if (val.includes('github.com/')) {
                                                                val = val.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
                                                                isUrl = true;
                                                            }
                                                            setRepoName(val); 
                                                            localStorage.setItem('focusflow_github_repo', val); 
                                                            if (isUrl && val.includes('/')) {
                                                                testRepoConnection(val);
                                                            }
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-sm border focus:outline-none w-48 text-right ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                                                        placeholder="owner/repo"
                                                    />
                                                    {/* Auto-test on paste/type if it looks like a repo is handled in onChange */}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const def = 'yourname/focusflow';
                                                            setRepoName(def);
                                                            localStorage.setItem('focusflow_github_repo', def);
                                                            setTestStatus('idle');
                                                        }}
                                                        className={`text-[10px] hover:underline ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                                    >
                                                        Reset Default
                                                    </button>
                                                    <button 
                                                        onClick={() => testRepoConnection()}
                                                        disabled={testStatus === 'testing' || !repoName}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                            testStatus === 'success' ? 'bg-green-500 text-white' :
                                                            testStatus === 'error' ? 'bg-red-500 text-white' :
                                                            (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600')
                                                        }`}
                                                    >
                                                        {testStatus === 'testing' ? '...' : testStatus === 'success' ? 'OK' : testStatus === 'error' ? 'Fail' : 'Test'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={itemClass}>
                                            <div>
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update Branch</div>
                                                <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Branch to check for updates</div>
                                            </div>
                                            <input 
                                                type="text" 
                                                value={updateBranch}
                                                onChange={(e) => { setUpdateBranch(e.target.value); localStorage.setItem('focusflow_update_branch', e.target.value); }}
                                                className={`px-3 py-1.5 rounded-lg text-sm border focus:outline-none w-32 text-right ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                                            />
                                        </div>

                                        <div className={itemClass}>
                                            <div>
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Check for Updates</div>
                                                <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>
                                                    {updateStatus === 'idle' && 'Current version: 1.0.0'}
                                                    {updateStatus === 'checking' && 'Checking GitHub...'}
                                                    {updateStatus === 'latest' && `Up to date (${latestVersion})`}
                                                    {updateStatus === 'available' && `Update available: ${latestVersion}`}
                                                    {updateStatus === 'error' && 'Could not fetch releases'}
                                                </div>
                                            </div>
                                            <button onClick={checkForUpdates} disabled={updateStatus === 'checking'} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30 disabled:opacity-50' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}>
                                                {updateStatus === 'checking' ? 'Checking...' : 'Check Now'}
                                            </button>
                                        </div>

                                        <div className={itemClass}>
                                            <div>
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update from Local File</div>
                                                <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Select a .dmg, .pkg, or .zip file</div>
                                            </div>
                                            <button onClick={async () => { const path = await (window.electronAPI as any)?.selectUpdateFile(); if (path) (window.electronAPI as any)?.installUpdate(path); }} className={`px-4 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Select File</button>
                                        </div>

                                        <div className={itemClass}>
                                            <div>
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update from GitHub</div>
                                                <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Download latest release</div>
                                            </div>
                                            <button onClick={() => (window.electronAPI as any)?.openExternal(`https://github.com/${repoName}/releases`)} className={`px-4 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Open GitHub</button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'sync' && <SyncSettings appTheme={appTheme} setLastBackup={setLastBackup} />}
                        {activeTab === 'data' && <DataSettings appTheme={appTheme} lastBackup={lastBackup} setLastBackup={setLastBackup} />}
                        {activeTab === 'debug' && (
                            <DebugSettings 
                                sidebarConfig={sidebarConfig} 
                                menuBarConfig={menuBarConfig} 
                                appTheme={appTheme} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};