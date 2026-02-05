import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, StudyLog, UserGoals, ViewMode, SettingsTab, SidebarConfig, MenuBarConfig, HeatmapTheme, AppTheme, CountdownItem } from './types';
import { NAV_ITEMS_DEF } from './components/Sidebar';
import * as storage from './services/storageService';

// --- Theme Context ---
interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
    appTheme: AppTheme;
    setAppTheme: (theme: AppTheme) => void;
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

// --- Countdown Context ---
interface CountdownContextType {
    countdowns: CountdownItem[];
    saveCountdown: (item: CountdownItem) => Promise<void>;
    deleteCountdown: (id: string) => Promise<void>;
    importCountdowns: (items: CountdownItem[]) => Promise<void>;
}
const CountdownContext = createContext<CountdownContextType | null>(null);
export const useCountdowns = () => {
    const context = useContext(CountdownContext);
    if (!context) throw new Error('useCountdowns must be used within AppProvider');
    return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- Initialization & Global Effects ---
    const notifiedEventsRef = useRef<Set<string>>(new Set());

    const checkReminders = useCallback(async () => {
        if (Notification.permission !== "granted") return;
        const events = await storage.getCustomEvents();
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

    // --- App Theme State (Cyberpunk, etc) ---
    const [appTheme, setAppTheme] = useState<AppTheme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('focusflow_app_theme') as AppTheme) || 'default';
        }
        return 'default';
    });

    const handleSetAppTheme = useCallback((theme: AppTheme) => {
        setAppTheme(theme);
        localStorage.setItem('focusflow_app_theme', theme);
        // Cyberpunk is inherently a dark theme
        if (theme === 'cyberpunk') {
            setIsDarkMode(true);
            localStorage.setItem('focusflow_theme', 'dark');
        }
    }, []);

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
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string>('default-project');

    const createProject = useCallback(async (name: string, theme: HeatmapTheme) => {
        const newProject: Project = { id: Date.now().toString(), name, theme, createdAt: new Date().toISOString(), sortOrder: projects.length, isArchived: false };
        const updated = await storage.saveProject(newProject);
        setProjects(updated);
        setCurrentProjectId(newProject.id);
    }, [projects.length]);

    const deleteProject = useCallback(async (id: string) => {
        const updated = await storage.deleteProject(id);
        setProjects(updated);
        if (currentProjectId === id && updated.length > 0) {
            setCurrentProjectId(updated[0].id);
        }
    }, [currentProjectId]);

    const updateProjects = useCallback(async (updated: Project[]) => {
        setProjects(updated);
        await storage.updateProjectsList(updated);
        const current = updated.find(p => p.id === currentProjectId);
        if (current && current.isArchived) {
            const firstActive = updated.find(p => !p.isArchived);
            if (firstActive) setCurrentProjectId(firstActive.id);
        }
    }, [currentProjectId]);

    // --- Log State ---
    const [logs, setLogs] = useState<StudyLog[]>([]);
    const [goals, setGoals] = useState<UserGoals>({ daily: 4, weekly: 40, monthly: 160, yearly: 2000 });

    const saveLog = useCallback(async (date: string, hours: number, notes?: string, projectId?: string) => {
        const targetProject = projectId || currentProjectId;
        if (!targetProject) return;
        const newLogs = await storage.saveLog({ date, hours, notes, projectId: targetProject });
        setLogs(newLogs);
    }, [currentProjectId]);

    const deleteLog = useCallback(async (date: string, projectId: string) => {
        const newLogs = await storage.deleteLog(date, projectId);
        setLogs(newLogs);
    }, []);

    const updateGoals = useCallback(async (newGoals: UserGoals) => {
        setGoals(newGoals);
        await storage.saveGoals(newGoals);
    }, []);

    // --- UI State ---
    const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
    const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
    const [navConfig, setNavConfigState] = useState<StoredNavConfig[]>([]);
    const [sidebarConfig, setSidebarConfigState] = useState<SidebarConfig>({ showWeeklyGoalWidget: true });
    const [menuBarConfig, setMenuBarConfigState] = useState<MenuBarConfig>({ mode: 'none' });

    const setNavConfig = useCallback((newConfig: StoredNavConfig[]) => {
        setNavConfigState(newConfig);
        localStorage.setItem('focusflow_sidebar_config_v1', JSON.stringify(newConfig));
    }, []);

    const setSidebarConfig = useCallback(async (newConfig: SidebarConfig) => {
        setSidebarConfigState(newConfig);
        await storage.saveSidebarConfig(newConfig);
    }, []);

    const setMenuBarConfig = useCallback(async (newConfig: MenuBarConfig) => {
        setMenuBarConfigState(newConfig);
        await storage.saveMenuBarConfig(newConfig);
    }, []);

    // --- Timer State ---
    const [pendingQuickTimer, setPendingQuickTimer] = useState<{ duration: number; timestamp: number } | null>(null);

    // --- Countdown State ---
    const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);

    const saveCountdown = useCallback(async (item: CountdownItem) => {
        const updated = await storage.saveCountdown(item);
        setCountdowns(updated);
    }, []);

    const deleteCountdown = useCallback(async (id: string) => {
        const updated = await storage.deleteCountdown(id);
        setCountdowns(updated);
    }, []);

    const importCountdowns = useCallback(async (items: CountdownItem[]) => {
        for (const item of items) await storage.saveCountdown(item);
        setCountdowns(await storage.getCountdowns());
    }, []);

    // --- Global Init Effect ---
    useEffect(() => {
        const init = async () => {
          try {
            const initialized = await storage.isInitialized();
            if (!initialized) {
                console.log("First time initialization: Seeding sample data...");
                await storage.seedData();
                await storage.seedCountdowns();
                await storage.setInitialized();
            }

            // Load all data async
            const [p, l, g, sb, mb, c] = await Promise.all([
                storage.getProjects(),
                storage.getLogs(),
                storage.getGoals(),
                storage.getSidebarConfig(),
                storage.getMenuBarConfig(),
                storage.getCountdowns()
            ]);

            setProjects(p);
            setLogs(l);
            setGoals(g);
            setSidebarConfigState(sb);
            setMenuBarConfigState(mb);
            setCountdowns(c);

            // Set initial project if needed
            if (p.length > 0 && currentProjectId === 'default-project') {
                const active = p.find(proj => !proj.isArchived);
                if (active) setCurrentProjectId(active.id);
                else setCurrentProjectId(p[0].id);
            }
          } catch (error) {
            console.error("Failed to initialize app data:", error);
          }
        };
        init();

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

    // --- Auto Backup ---
    useEffect(() => {
        const performAutoBackup = async () => {
            const lastBackup = localStorage.getItem('focusflow_last_backup');
            const now = Date.now();
            const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

            if (!lastBackup || now - parseInt(lastBackup) > ONE_WEEK) {
                try {
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
                    
                    localStorage.setItem('focusflow_last_backup', now.toString());
                    if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
                        new Notification("FocusFlow", { body: "Weekly backup saved successfully." });
                    }
                } catch (e) {
                    console.error("Auto-backup failed:", e);
                }
            }
        };
        
        const timer = setTimeout(performAutoBackup, 5000);
        return () => clearTimeout(timer);
    }, []);

    // --- Memoized Values ---
    const themeValue = useMemo(() => ({ isDarkMode, toggleTheme, appTheme, setAppTheme: handleSetAppTheme }), [isDarkMode, toggleTheme, appTheme, handleSetAppTheme]);
    const projectValue = useMemo(() => ({ projects, currentProjectId, setCurrentProjectId, createProject, deleteProject, updateProjects }), [projects, currentProjectId, createProject, deleteProject, updateProjects]);
    const logValue = useMemo(() => ({ logs, goals, saveLog, deleteLog, updateGoals }), [logs, goals, saveLog, deleteLog, updateGoals]);
    const uiValue = useMemo(() => ({ currentView, setCurrentView, settingsTab, setSettingsTab, navConfig, setNavConfig, sidebarConfig, setSidebarConfig, menuBarConfig, setMenuBarConfig }), [currentView, settingsTab, navConfig, sidebarConfig, menuBarConfig, setNavConfig, setSidebarConfig, setMenuBarConfig]);
    const timerValue = useMemo(() => ({ pendingQuickTimer, setPendingQuickTimer }), [pendingQuickTimer]);
    const countdownValue = useMemo(() => ({ countdowns, saveCountdown, deleteCountdown, importCountdowns }), [countdowns, saveCountdown, deleteCountdown, importCountdowns]);

    return (
        <ThemeContext.Provider value={themeValue}>
            <ProjectContext.Provider value={projectValue}>
                <LogContext.Provider value={logValue}>
                    <UIContext.Provider value={uiValue}>
                        <TimerContext.Provider value={timerValue}>
                            <CountdownContext.Provider value={countdownValue}>
                                {children}
                            </CountdownContext.Provider>
                        </TimerContext.Provider>
                    </UIContext.Provider>
                </LogContext.Provider>
            </ProjectContext.Provider>
        </ThemeContext.Provider>
    );
};