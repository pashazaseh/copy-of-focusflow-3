import React, { useState, useEffect, Suspense, lazy } from 'react';
import { StoredNavConfig, useCountdowns } from '../../AppContext';
import { MenuBarConfig, Project, HeatmapTheme, SidebarConfig, SettingsTab, AppTheme } from '../../types';

const GeneralSettings = lazy(() => import('./GeneralSettings').then(module => ({ default: module.GeneralSettings })));
const TimerSettingsPanel = lazy(() => import('./TimerSettings').then(module => ({ default: module.TimerSettingsPanel })));
const SyncSettings = lazy(() => import('./SyncSettings').then(module => ({ default: module.SyncSettings })));
const DataSettings = lazy(() => import('./DataSettings').then(module => ({ default: module.DataSettings })));
const ProjectSettings = lazy(() => import('./ProjectSettings').then(module => ({ default: module.ProjectSettings })));

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

export const SettingsPanel = ({ 
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
}: SettingsPanelProps) => {
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
                        <div className={`flex p-1 rounded-xl shadow-inner overflow-x-auto no-scrollbar ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-800'}`}>
                            {(['general', 'timer', 'projects', 'sync', 'data'] as any[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => onTabChange(tab as SettingsTab)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide whitespace-nowrap ${
                                        activeTab === tab 
                                        ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm')
                                        : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200')
                                    }`}
                                >
                                    {tab === 'timer' ? 'Preferences' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Content Area */}
                    <div className="space-y-6">
                        <Suspense fallback={<div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div></div>}>
                            {/* === GENERAL TAB === */}
                            {activeTab === 'general' && (
                                <GeneralSettings 
                                    navConfig={navConfig}
                                    onUpdateNavConfig={onUpdateNavConfig}
                                    isDarkMode={isDarkMode}
                                    onToggleTheme={onToggleTheme}
                                    appTheme={appTheme}
                                    setAppTheme={setAppTheme}
                                    inventory={inventory}
                                    sidebarConfig={sidebarConfig}
                                    onUpdateSidebarConfig={onUpdateSidebarConfig}
                                    menuBarConfig={menuBarConfig}
                                    onUpdateMenuBarConfig={onUpdateMenuBarConfig}
                                    countdowns={countdowns}
                                />
                            )}

                            {/* === PROJECTS TAB === */}
                            {activeTab === 'projects' && (
                                <ProjectSettings 
                                    projects={projects} 
                                    onCreateProject={onCreateProject} 
                                    onDeleteProject={onDeleteProject} 
                                    onUpdateProjects={onUpdateProjects} 
                                    appTheme={appTheme} 
                                />
                            )}
                            
                            {activeTab === 'timer' && <TimerSettingsPanel appTheme={appTheme} />}
                            {activeTab === ('sync' as SettingsTab) && <SyncSettings appTheme={appTheme} setLastBackup={setLastBackup} />}
                            {activeTab === ('data' as SettingsTab) && <DataSettings appTheme={appTheme} lastBackup={lastBackup} setLastBackup={setLastBackup} />}
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
};
