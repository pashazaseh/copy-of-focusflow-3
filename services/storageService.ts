import { StudyLog, UserGoals, CountdownItem, SessionRecord, TimerSettings, Project, CustomEvent, MenuBarConfig, CountdownGroup, CountdownType, SidebarConfig } from '../types';

const STORAGE_KEY = 'focusflow_logs_v1';
const GOALS_KEY = 'focusflow_goals_v1';
const COUNTDOWNS_KEY = 'focusflow_countdowns_v1';
const COUNTDOWN_GROUPS_KEY = 'focusflow_countdown_groups_v1';
const SESSIONS_KEY = 'focusflow_sessions_v1';
const TIMER_SETTINGS_KEY = 'focusflow_timer_settings_v1';
const MENUBAR_CONFIG_KEY = 'focusflow_menubar_config_v1';
const SIDEBAR_CONFIG_KEY = 'focusflow_sidebar_config_v1';
const PROJECTS_KEY = 'focusflow_projects_v1';
const CUSTOM_EVENTS_KEY = 'focusflow_custom_events_v1';
const INIT_KEY = 'focusflow_initialized_v1';
const DEFAULT_PROJECT_ID = 'default-project';

// Helper for safe parsing
const safeParse = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (error) {
        console.error(`Error parsing key "${key}":`, error);
        return fallback;
    }
};

// --- Initialization State Management ---

export const isInitialized = (): boolean => {
    return localStorage.getItem(INIT_KEY) === 'true';
};

export const setInitialized = () => {
    localStorage.setItem(INIT_KEY, 'true');
};

// --- Data Management (Export/Import) ---

export const exportData = (): string => {
    const data: Record<string, string | null> = {};
    // Collect all keys related to the app
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('focusflow_') || key.startsWith('heatmap_'))) {
            data[key] = localStorage.getItem(key);
        }
    }
    return JSON.stringify(data, null, 2);
};

export const exportLogsToCSV = (): string => {
    const logs = getLogs();
    const projects = getProjects();
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const header = ['Date', 'Hours', 'Project', 'Notes'];
    const rows = logs.map(log => {
        const projectName = projectMap.get(log.projectId) || 'Unknown Project';
        // CSV escaping: wrap in quotes, escape existing quotes with double quotes
        const cleanProject = `"${projectName.replace(/"/g, '""')}"`;
        const cleanNotes = log.notes ? `"${log.notes.replace(/"/g, '""')}"` : '""';
        return [log.date, log.hours, cleanProject, cleanNotes].join(',');
    });

    return [header.join(','), ...rows].join('\n');
};

export const exportBirthdaysToCSV = (): string => {
    const items = getCountdowns();
    const header = ['Title', 'Date', 'Type', 'Recurrence'];
    const rows = items.map(item => {
        const cleanTitle = `"${item.title.replace(/"/g, '""')}"`;
        return [cleanTitle, item.date, item.type, item.recurrence || 'none'].join(',');
    });
    return [header.join(','), ...rows].join('\n');
};

export const importCountdownsFromCSV = (csvText: string): { success: boolean, message: string } => {
    try {
        const lines = csvText.split('\n');
        if (lines.length < 2) return { success: false, message: "Empty or invalid CSV file." };
        
        // Simple CSV parsing (assuming headers are somewhat standard or we just take columns 0-3)
        // Expected: Title, Date, Type, Recurrence
        const newItems: CountdownItem[] = [];
        
        for(let i=1; i<lines.length; i++) {
            const line = lines[i].trim();
            if(!line) continue;
            
            // Handle simple quotes
            const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!parts) {
                 // Fallback split if regex fails
                 const simpleParts = line.split(',');
                 if (simpleParts.length < 2) continue;
                 
                 const title = simpleParts[0].trim();
                 const date = simpleParts[1].trim();
                 const type = (simpleParts[2]?.trim() || 'countdown') as CountdownType;
                 const recurrence = (simpleParts[3]?.trim() || 'none') as any;
                 
                 if (title && date) {
                     newItems.push({
                        id: Date.now().toString() + Math.random().toString().slice(2,6),
                        title, date, type, recurrence, color: 'blue', groupId: 'general'
                     });
                 }
                 continue;
            }

            const cleanParts = parts.map(p => p.replace(/^"|"$/g, '').trim());
            const title = cleanParts[0];
            const date = cleanParts[1];
            
            if (title && date) {
                 const type = (cleanParts[2] || 'countdown') as CountdownType;
                 const recurrence = (cleanParts[3] || 'none') as any;
                 newItems.push({
                    id: Date.now().toString() + Math.random().toString().slice(2,6),
                    title, date, type, recurrence, color: 'blue', groupId: 'general'
                 });
            }
        }
        
        if (newItems.length === 0) return { success: false, message: "No valid events found in CSV." };
        
        const current = getCountdowns();
        // Merge strategy: just append for now
        const merged = [...current, ...newItems];
        localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(merged));
        return { success: true, message: `Successfully imported ${newItems.length} events.` };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Failed to parse CSV file." };
    }
};

export const validateBackupData = (data: any): boolean => {
    if (typeof data !== 'object' || data === null) return false;
    // Check if it contains at least one known critical key to verify it's a valid backup
    const keys = Object.keys(data);
    return keys.some(k => k.startsWith('focusflow_') || k.startsWith('heatmap_'));
};

export const importData = (jsonString: string): { success: boolean; message: string } => {
    try {
        const data = JSON.parse(jsonString);
        
        if (!validateBackupData(data)) {
            return { success: false, message: "Invalid backup file: Missing FocusFlow data." };
        }

        clearAllData();

        // Restore data
        Object.keys(data).forEach(key => {
            if (data[key] !== null) {
                localStorage.setItem(key, data[key]);
            }
        });
        return { success: true, message: "Data restored successfully." };
    } catch (e) {
        console.error("Import failed", e);
        return { success: false, message: "Failed to parse JSON data." };
    }
};

export const clearAllData = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('focusflow_') || key.startsWith('heatmap_'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
};

export const clearLogs = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSIONS_KEY);
};

export const clearSettings = () => {
    localStorage.removeItem(TIMER_SETTINGS_KEY);
    localStorage.removeItem(GOALS_KEY);
};

export const clearCountdowns = () => {
    localStorage.removeItem(COUNTDOWNS_KEY);
    localStorage.removeItem(COUNTDOWN_GROUPS_KEY);
    localStorage.removeItem(CUSTOM_EVENTS_KEY);
};

// --- Projects ---

export const getProjects = (): Project[] => {
    const defaultProject: Project = {
        id: DEFAULT_PROJECT_ID,
        name: 'Main Project',
        theme: 'green',
        createdAt: new Date().toISOString(),
        sortOrder: 0,
        isArchived: false
    };
    
    let projects = safeParse<Project[]>(PROJECTS_KEY, [defaultProject]);
    
    if (!Array.isArray(projects) || projects.length === 0) {
        // Repair state if invalid
        localStorage.setItem(PROJECTS_KEY, JSON.stringify([defaultProject]));
        projects = [defaultProject];
    }

    // Sort by sortOrder, then by createdAt as fallback
    return projects.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
            return a.sortOrder - b.sortOrder;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
};

export const saveProject = (project: Project): Project[] => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === project.id);
  let newProjects;
  if (index >= 0) {
    newProjects = [...projects];
    newProjects[index] = project;
  } else {
    // New project gets highest sort order
    const maxOrder = projects.length > 0 ? Math.max(...projects.map(p => p.sortOrder || 0)) : 0;
    const projectWithOrder = { ...project, sortOrder: maxOrder + 1, isArchived: false };
    newProjects = [...projects, projectWithOrder];
  }
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(newProjects));
  return newProjects;
};

export const updateProjectsList = (projects: Project[]): Project[] => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return projects;
};

export const deleteProject = (id: string): Project[] => {
    // Prevent deleting the last project
    const projects = getProjects();
    if (projects.length <= 1) return projects;
    
    const newProjects = projects.filter(p => p.id !== id);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(newProjects));
    return newProjects;
};

// --- Logs ---

export const getLogs = (): StudyLog[] => {
    let logs = safeParse<StudyLog[]>(STORAGE_KEY, []);
    
    // Migration: If logs exist but have no projectId, assign them to default
    let needsMigration = false;
    logs = logs.map(log => {
        if (!log.projectId) {
            needsMigration = true;
            return { ...log, projectId: DEFAULT_PROJECT_ID };
        }
        return log;
    });

    if (needsMigration) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }

    return logs;
};

export const saveLog = (log: StudyLog): StudyLog[] => {
  const logs = getLogs();
  
  // Check if entry exists for this date AND this project
  const existingIndex = logs.findIndex(l => l.date === log.date && l.projectId === log.projectId);
  
  let newLogs;
  if (existingIndex >= 0) {
    newLogs = [...logs];
    newLogs[existingIndex] = log;
  } else {
    newLogs = [...logs, log];
  }
  
  // Sort logs by date
  newLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  return newLogs;
};

export const deleteLog = (date: string, projectId: string): StudyLog[] => {
  const logs = getLogs();
  // Only delete log for specific project and date
  const newLogs = logs.filter(l => !(l.date === date && l.projectId === projectId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  return newLogs;
};

export const getGoals = (): UserGoals => {
    const defaultGoals = { weekly: 40, monthly: 160, yearly: 2000 };
    const saved = safeParse<any>(GOALS_KEY, {});
    return {
        weekly: saved.weekly || defaultGoals.weekly,
        monthly: saved.monthly || defaultGoals.monthly,
        yearly: saved.yearly || defaultGoals.yearly
    };
};

export const saveGoals = (goals: UserGoals): UserGoals => {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  return goals;
};

// --- Countdown Groups ---
export const getCountdownGroups = (): CountdownGroup[] => {
    return safeParse<CountdownGroup[]>(COUNTDOWN_GROUPS_KEY, [
        { id: 'general', name: 'General', color: 'blue' }
    ]);
};

export const saveCountdownGroup = (group: CountdownGroup): CountdownGroup[] => {
    const groups = getCountdownGroups();
    const idx = groups.findIndex(g => g.id === group.id);
    let newGroups = [...groups];
    if (idx >= 0) newGroups[idx] = group;
    else newGroups.push(group);
    localStorage.setItem(COUNTDOWN_GROUPS_KEY, JSON.stringify(newGroups));
    return newGroups;
};

export const saveCountdownGroups = (groups: CountdownGroup[]): CountdownGroup[] => {
    localStorage.setItem(COUNTDOWN_GROUPS_KEY, JSON.stringify(groups));
    return groups;
};

export const deleteCountdownGroup = (id: string): CountdownGroup[] => {
    const groups = getCountdownGroups();
    const newGroups = groups.filter(g => g.id !== id);
    localStorage.setItem(COUNTDOWN_GROUPS_KEY, JSON.stringify(newGroups));
    return newGroups;
};

// --- Countdowns ---

export const getCountdowns = (): CountdownItem[] => {
    return safeParse<CountdownItem[]>(COUNTDOWNS_KEY, []);
};

export const saveCountdown = (item: CountdownItem): CountdownItem[] => {
  const items = getCountdowns();
  const index = items.findIndex(i => i.id === item.id);
  let newItems;
  if (index >= 0) {
    newItems = [...items];
    newItems[index] = item;
  } else {
    newItems = [...items, item];
  }
  localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(newItems));
  return newItems;
};

export const deleteCountdown = (id: string): CountdownItem[] => {
  const items = getCountdowns();
  const newItems = items.filter(i => i.id !== id);
  localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(newItems));
  return newItems;
};

export const seedCountdowns = (): CountdownItem[] => {
    const nextYear = new Date().getFullYear() + 1;
    const items: CountdownItem[] = [
        {
            id: '1',
            title: "New Year's Day",
            date: `${nextYear}-01-01`,
            type: 'holiday',
            color: 'blue',
            groupId: 'general'
        }
    ];
    localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(items));
    return items;
}

// Session Records
export const getSessions = (): SessionRecord[] => {
    return safeParse<SessionRecord[]>(SESSIONS_KEY, []);
};

export const saveSessionRecord = (session: SessionRecord): SessionRecord[] => {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  let newSessions;
  if (idx >= 0) {
      newSessions = [...sessions];
      newSessions[idx] = session;
  } else {
      newSessions = [session, ...sessions];
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));
  return newSessions;
};

export const deleteSessionRecord = (id: string): SessionRecord[] => {
    const sessions = getSessions();
    const newSessions = sessions.filter(s => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));
    return newSessions;
};

export const batchDeleteSessions = (ids: string[]): SessionRecord[] => {
    const sessions = getSessions();
    const newSessions = sessions.filter(s => !ids.includes(s.id));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));
    return newSessions;
}

// Timer Settings
export const getTimerSettings = (): TimerSettings => {
    const defaultSettings: TimerSettings = {
        pomoDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        pomosPerLongBreak: 4,
        autoStartNextPomo: false,
        autoStartBreak: false,
        quickDurations: [25, 45, 60],
        shortBreakPresets: [5, 10, 15]
    };
    const saved = safeParse<TimerSettings>(TIMER_SETTINGS_KEY, defaultSettings);
    return { ...defaultSettings, ...saved };
};

export const saveTimerSettings = (settings: TimerSettings): TimerSettings => {
    localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(settings));
    return settings;
};

// Menu Bar Configuration
export const getMenuBarConfig = (): MenuBarConfig => {
    return safeParse<MenuBarConfig>(MENUBAR_CONFIG_KEY, { mode: 'none' });
};

export const saveMenuBarConfig = (config: MenuBarConfig): MenuBarConfig => {
    localStorage.setItem(MENUBAR_CONFIG_KEY, JSON.stringify(config));
    return config;
};

// Sidebar Configuration
export const getSidebarConfig = (): SidebarConfig => {
    return safeParse<SidebarConfig>(SIDEBAR_CONFIG_KEY, { showWeeklyGoalWidget: true });
};

export const saveSidebarConfig = (config: SidebarConfig): SidebarConfig => {
    localStorage.setItem(SIDEBAR_CONFIG_KEY, JSON.stringify(config));
    return config;
};

// Custom Events (Calendar)
export const getCustomEvents = (): CustomEvent[] => {
    return safeParse<CustomEvent[]>(CUSTOM_EVENTS_KEY, []);
};

export const saveCustomEvent = (event: CustomEvent): CustomEvent[] => {
    const events = getCustomEvents();
    // Check if updating
    const idx = events.findIndex(e => e.id === event.id);
    let newEvents;
    if (idx >= 0) {
        newEvents = [...events];
        newEvents[idx] = event;
    } else {
        newEvents = [...events, event];
    }
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(newEvents));
    return newEvents;
};

export const deleteCustomEvent = (id: string): CustomEvent[] => {
    const events = getCustomEvents();
    const newEvents = events.filter(e => e.id !== id);
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(newEvents));
    return newEvents;
};


// Seed some data for visualization purposes if empty
export const seedData = (): StudyLog[] => {
  const logs: StudyLog[] = [];
  const sessions: SessionRecord[] = [];
  const today = new Date();
  
  const projects = getProjects();
  const pid = projects[0]?.id || DEFAULT_PROJECT_ID;

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    
    // Simulate some randomness: 30% chance of 0 hours, else 1-8 hours
    if (Math.random() > 0.3) {
      logs.push({
        date: d.toISOString().split('T')[0],
        hours: Math.round((Math.random() * 6 + 1) * 10) / 10,
        notes: Math.random() > 0.8 ? "Focused study session" : undefined,
        projectId: pid
      });
    }
  }
  
  // Seed Sessions for Charts (Last 30 days)
  for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - Math.floor(Math.random() * 30));
      d.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60)); // 8am - 10pm
      
      const duration = 25 * 60;
      const end = new Date(d.getTime() + duration * 1000);
      
      sessions.push({
          id: `seed-${i}`,
          startTime: d.toISOString(),
          endTime: end.toISOString(),
          duration: duration,
          type: 'POMO',
          label: 'Study Session',
          projectId: pid
      });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  
  return logs;
};