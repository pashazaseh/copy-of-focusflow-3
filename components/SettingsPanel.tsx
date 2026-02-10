import React, { useState, useEffect, useMemo, lazy } from 'react';
import { StoredNavConfig } from './Sidebar';
import { MenuBarConfig, Project, HeatmapTheme, SidebarConfig, SettingsTab, AppTheme } from '../types';
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
    const { countdowns } = useCountdowns();
    const isCyberpunk = appTheme === 'cyberpunk';

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
        setTestStatus('testing');
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}`);
            if (res.ok) {
                const data = await res.json();
                setTestStatus('success');
                if (data.default_branch) {
                    setUpdateBranch(data.default_branch);
                    localStorage.setItem('focusflow_update_branch', data.default_branch);
                }
                setTimeout(() => setTestStatus('idle'), 2000);
            } else {
                setTestStatus('error');
                setTimeout(() => setTestStatus('idle'), 2000);
            }
        } catch (e) {
            setTestStatus('error');
            setTimeout(() => setTestStatus('idle'), 2000);
        }
    };

    const checkForUpdates = async () => {
        setUpdateStatus('checking');
        try {
            // Try fetching from branch first
            const branchRes = await fetch(`https://raw.githubusercontent.com/${repoName}/${updateBranch}/package.json`);
            if (branchRes.ok) {
                const data = await branchRes.json();
                setLatestVersion(data.version);
                if (data.version !== '1.0.0') setUpdateStatus('available');
                else setUpdateStatus('latest');
                return;
            }

            const res = await fetch(`https://api.github.com/repos/${repoName}/releases/latest`);
            if (!res.ok) throw new Error('Failed to check');
            const data = await res.json();
            setLatestVersion(data.tag_name);
            
            if (data.tag_name.replace('v', '') !== '1.0.0') {
                setUpdateStatus('available');
            } else {
                setUpdateStatus('latest');
            }
        } catch (e) {
            setUpdateStatus('error');
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-900 dark:text-white'}`}>Settings</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage preferences, projects, and data.</p>
                        </div>
                        
                        {/* Tab Navigation */}
                        <div className={`flex p-1 rounded-2xl shadow-inner transition-all duration-300 ${isCyberpunk ? 'bg-black/40 border border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-gray-200 dark:bg-gray-800'}`}>
                            {(['general', 'timer', 'projects', 'sync', 'data', 'debug'] as any[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => onTabChange(tab as SettingsTab)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 uppercase tracking-wide whitespace-nowrap ${
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
                            <GeneralSettings navConfig={navConfig} onUpdateNavConfig={onUpdateNavConfig} isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} appTheme={appTheme} setAppTheme={setAppTheme} inventory={inventory} sidebarConfig={sidebarConfig} onUpdateSidebarConfig={onUpdateSidebarConfig} menuBarConfig={menuBarConfig} onUpdateMenuBarConfig={onUpdateMenuBarConfig} countdowns={countdowns} />
                        )}
                        {activeTab === 'projects' && <ProjectSettings projects={projects} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onUpdateProjects={onUpdateProjects} appTheme={appTheme} />}
                        {activeTab === 'timer' && (
                            <>
                                <TimerSettingsPanel appTheme={appTheme} />
                                <div className={`p-6 rounded-2xl border shadow-sm ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                    <h3 className={`text-xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update App</h3>
                                    <p className={`text-sm mb-6 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>
                                        Update FocusFlow to the latest version. Your data will be preserved.
                                    </p>
                                    
                                    <div className="space-y-4">
                                        <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                                            <div>
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>GitHub Repository</div>
                                                <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>owner/repo name</div>
                                            </div>
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
                                                />
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

                                        <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
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

                                        <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
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

                                        <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                                            <div>
                                                <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update from Local File</div>
                                                <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Select a .dmg, .pkg, or .zip file</div>
                                            </div>
                                            <button onClick={async () => { const path = await (window.electronAPI as any)?.selectUpdateFile(); if (path) (window.electronAPI as any)?.installUpdate(path); }} className={`px-4 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Select File</button>
                                        </div>

                                        <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
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