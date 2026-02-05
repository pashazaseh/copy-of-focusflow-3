import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, StudyLog, UserGoals, ViewMode, SettingsTab, SidebarConfig, MenuBarConfig, HeatmapTheme } from './types';
import { NAV_ITEMS_DEF } from './components/Sidebar';
import * as storage from './services/storageService';

// --- Theme Context ---
interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | null>(null);
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within AppProvider');
    return context;
};

// --- Project Context ---
interface ProjectContextType {
    projects: Project[];
    currentProjectId: string;
    setCurrentProjectId: (id: string) => void;
    createProject: (name: string, theme: HeatmapTheme) => void;
    deleteProject: (id: string) => void;
    updateProjects: (projects: Project[]) => void;
}
const ProjectContext = createContext<ProjectContextType | null>(null);
export const useProjects = () => {
    const context = useContext(ProjectContext);
    if (!context) throw new Error('useProjects must be used within AppProvider');
    return context;
};

// --- Log Context ---
interface LogContextType {
    logs: StudyLog[];
    goals: UserGoals;
    saveLog: (date: string, hours: number, notes?: string, projectId?: string) => void;
    deleteLog: (date: string, projectId: string) => void;
    updateGoals: (goals: UserGoals) => void;
}
const LogContext = createContext<LogContextType | null>(null);
export const useLogs = () => {
    const context = useContext(LogContext);
    if (!context) throw new Error('useLogs must be used within AppProvider');
    return context;
};

export interface StoredNavConfig {
    view: ViewMode;
    isVisible: boolean;
}

// --- UI Context ---
interface UIContextType {
    currentView: ViewMode;
    setCurrentView: (view: ViewMode) => void;
    settingsTab: SettingsTab;
    setSettingsTab: (tab: SettingsTab) => void;
    navConfig: StoredNavConfig[];
    setNavConfig: (config: StoredNavConfig[]) => void;
    sidebarConfig: SidebarConfig;
    setSidebarConfig: (config: SidebarConfig) => void;
    menuBarConfig: MenuBarConfig;
    setMenuBarConfig: (config: MenuBarConfig) => void;
}
const UIContext = createContext<UIContextType | null>(null);
export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within AppProvider');
    return context;
};

// --- Timer Context ---
interface TimerContextType {
    pendingQuickTimer: { duration: number; timestamp: number } | null;
    setPendingQuickTimer: (val: { duration: number; timestamp: number } | null) => void;
}
const TimerContext = createContext<TimerContextType | null>(null);
export const useTimerContext = () => {
    const context = useContext(TimerContext);
    if (!context) throw new Error('useTimerContext must be used within AppProvider');
    return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- Initialization & Global Effects ---
    const notifiedEventsRef = useRef<Set<string>>(new Set());

    const checkReminders = useCallback(() => {
        if (Notification.permission !== "granted") return;
        const events = storage.getCustomEvents();
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        events.forEach(event => {
            if (!event.reminderMinutes || !event.time) return;
            
            const parts = event.date.split('-');
            const eventDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            
            let occursToday = false;
            if (event.recurrence === 'daily') occursToday = now >= eventDateObj;
            else if (event.recurrence === 'weekly') occursToday = now >= eventDateObj && now.getDay() === eventDateObj.getDay();
            else if (event.recurrence === 'monthly') occursToday = now >= eventDateObj && now.getDate() === eventDateObj.getDate();
            else occursToday = event.date === todayStr;

            if (occursToday) {
                const [h, min] = (event.time?.split(':') || ['0', '0']).map(Number);
                const eventTime = new Date(now);
                eventTime.setHours(h, min, 0, 0);
                const triggerTime = new Date(eventTime.getTime() - (event.reminderMinutes! * 60 * 1000));
                const diff = now.getTime() - triggerTime.getTime();
                
                if (diff >= 0 && diff < 90000) {
                    const occurrenceId = `${event.id}-${todayStr}`;
                    if (!notifiedEventsRef.current.has(occurrenceId)) {
                        new Notification(`Reminder: ${event.title}`, {
                            body: `Event starts in ${event.reminderMinutes} minutes.`,
                            icon: '/favicon.ico' 
                        });
                        notifiedEventsRef.current.add(occurrenceId);
                    }
                }
            }
        });
    }, []);

    // --- Theme State ---
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('focusflow_theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    const toggleTheme = useCallback(() => {
        setIsDarkMode(prev => {
            const newMode = !prev;
            localStorage.setItem('focusflow_theme', newMode ? 'dark' : 'light');
            return newMode;
        });
    }, []);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    // --- Project State ---
    const [projects, setProjects] = useState<Project[]>(() => storage.getProjects());
    const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
        // Use the projects we just loaded if possible, or read efficiently
        const allProjects = storage.getProjects();
        const active = allProjects.find(proj => !proj.isArchived);
        return active ? active.id : allProjects[0]?.id || 'default';
    });

    const createProject = useCallback((name: string, theme: HeatmapTheme) => {
        const newProject: Project = { id: Date.now().toString(), name, theme, createdAt: new Date().toISOString(), sortOrder: projects.length, isArchived: false };
        const updated = storage.saveProject(newProject);
        setProjects(updated);
        setCurrentProjectId(newProject.id);
    }, [projects.length]);

    const deleteProject = useCallback((id: string) => {
        const updated = storage.deleteProject(id);
        setProjects(updated);
        if (currentProjectId === id && updated.length > 0) {
            setCurrentProjectId(updated[0].id);
        }
    }, [currentProjectId]);

    const updateProjects = useCallback((updated: Project[]) => {
        setProjects(updated);
        storage.updateProjectsList(updated);
        const current = updated.find(p => p.id === currentProjectId);
        if (current && current.isArchived) {
            const firstActive = updated.find(p => !p.isArchived);
            if (firstActive) setCurrentProjectId(firstActive.id);
        }
    }, [currentProjectId]);

    // --- Log State ---
    const [logs, setLogs] = useState<StudyLog[]>(() => storage.getLogs());
    const [goals, setGoals] = useState<UserGoals>(() => storage.getGoals());

    const saveLog = useCallback((date: string, hours: number, notes?: string, projectId?: string) => {
        const targetProject = projectId || currentProjectId;
        if (!targetProject) return;
        const newLogs = storage.saveLog({ date, hours, notes, projectId: targetProject });
        setLogs(newLogs);
    }, [currentProjectId]);

    const deleteLog = useCallback((date: string, projectId: string) => {
        const newLogs = storage.deleteLog(date, projectId);
        setLogs(newLogs);
    }, []);

    const updateGoals = useCallback((newGoals: UserGoals) => {
        setGoals(newGoals);
        storage.saveGoals(newGoals);
    }, []);

    // --- UI State ---
    const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
    const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
    const [navConfig, setNavConfigState] = useState<StoredNavConfig[]>([]);
    const [sidebarConfig, setSidebarConfigState] = useState<SidebarConfig>(() => storage.getSidebarConfig());
    const [menuBarConfig, setMenuBarConfigState] = useState<MenuBarConfig>(() => storage.getMenuBarConfig());

    const setNavConfig = useCallback((newConfig: StoredNavConfig[]) => {
        setNavConfigState(newConfig);
        localStorage.setItem('focusflow_sidebar_config_v1', JSON.stringify(newConfig));
    }, []);

    const setSidebarConfig = useCallback((newConfig: SidebarConfig) => {
        setSidebarConfigState(newConfig);
        storage.saveSidebarConfig(newConfig);
    }, []);

    const setMenuBarConfig = useCallback((newConfig: MenuBarConfig) => {
        setMenuBarConfigState(newConfig);
        storage.saveMenuBarConfig(newConfig);
    }, []);

    // --- Timer State ---
    const [pendingQuickTimer, setPendingQuickTimer] = useState<{ duration: number; timestamp: number } | null>(null);

    // --- Global Init Effect ---
    useEffect(() => {
        if (!storage.isInitialized()) {
            console.log("First time initialization: Seeding sample data...");
            storage.seedData();
            storage.seedCountdowns();
            storage.setInitialized();
            // Refresh state
            setProjects(storage.getProjects());
            setLogs(storage.getLogs());
            setGoals(storage.getGoals());
        }

        // Load Nav Config
        const savedConfig = localStorage.getItem('focusflow_sidebar_config_v1');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig) as StoredNavConfig[];
                const merged = [...parsed];
                NAV_ITEMS_DEF.forEach(def => {
                    if (!merged.find(item => item.view === def.view)) {
                        merged.push({ view: def.view, isVisible: true });
                    }
                });
                setNavConfigState(merged);
            } catch (e) {
                setNavConfigState(NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true })));
            }
        } else {
            setNavConfigState(NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true })));
        }

        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        if (window.electronAPI && window.electronAPI.onQuickTimerTriggered) {
            window.electronAPI.onQuickTimerTriggered((minutes) => {
                setPendingQuickTimer({ duration: minutes, timestamp: Date.now() });
            });
        }

        const reminderInterval = setInterval(checkReminders, 30000);
        return () => clearInterval(reminderInterval);
    }, [checkReminders]);

    // --- Memoized Values ---
    const themeValue = useMemo(() => ({ isDarkMode, toggleTheme }), [isDarkMode, toggleTheme]);
    const projectValue = useMemo(() => ({ projects, currentProjectId, setCurrentProjectId, createProject, deleteProject, updateProjects }), [projects, currentProjectId, createProject, deleteProject, updateProjects]);
    const logValue = useMemo(() => ({ logs, goals, saveLog, deleteLog, updateGoals }), [logs, goals, saveLog, deleteLog, updateGoals]);
    const uiValue = useMemo(() => ({ currentView, setCurrentView, settingsTab, setSettingsTab, navConfig, setNavConfig, sidebarConfig, setSidebarConfig, menuBarConfig, setMenuBarConfig }), [currentView, settingsTab, navConfig, sidebarConfig, menuBarConfig, setNavConfig, setSidebarConfig, setMenuBarConfig]);
    const timerValue = useMemo(() => ({ pendingQuickTimer, setPendingQuickTimer }), [pendingQuickTimer]);

    return (
        <ThemeContext.Provider value={themeValue}>
            <ProjectContext.Provider value={projectValue}>
                <LogContext.Provider value={logValue}>
                    <UIContext.Provider value={uiValue}>
                        <TimerContext.Provider value={timerValue}>
                            {children}
                        </TimerContext.Provider>
                    </UIContext.Provider>
                </LogContext.Provider>
            </ProjectContext.Provider>
        </ThemeContext.Provider>
    );
};