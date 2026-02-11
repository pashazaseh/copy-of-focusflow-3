import { StudyLog, UserGoals, CountdownItem, SessionRecord, TimerSettings, Project, Task, CustomEvent, MenuBarConfig, CountdownGroup, CountdownType, SidebarConfig, ShopItem } from '../types';

const STORAGE_KEY = 'focusflow_logs_v1';
const GOALS_KEY = 'focusflow_goals_v1';
const COUNTDOWNS_KEY = 'focusflow_countdowns_v1';
const COUNTDOWN_GROUPS_KEY = 'focusflow_countdown_groups_v1';
const SESSIONS_KEY = 'focusflow_sessions_v1';
const TIMER_SETTINGS_KEY = 'focusflow_timer_settings_v1';
const MENUBAR_CONFIG_KEY = 'focusflow_menubar_config_v1';
const SIDEBAR_CONFIG_KEY = 'focusflow_sidebar_config_v1';
const PROJECTS_KEY = 'focusflow_projects_v1';
const TASKS_KEY = 'focusflow_tasks_v1'; // Added Key
const CUSTOM_EVENTS_KEY = 'focusflow_custom_events_v1';
const INIT_KEY = 'focusflow_initialized_v1';
const CUSTOM_SHOP_ITEMS_KEY = 'focusflow_custom_shop_items_v1';
const DEFAULT_PROJECT_ID = 'default-project';

// --- IndexedDB Infrastructure ---
const DB_NAME = 'FocusFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyvalue';

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                dbPromise = null; // Reset promise so we can retry later
                reject(request.error);
            };
        });
    }
    return dbPromise;
};

const dbGet = async <T>(key: string, fallback: T): Promise<T> => {
    try {
        const db = await getDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => {
                resolve(request.result === undefined ? fallback : request.result);
            };
            request.onerror = () => resolve(fallback);
        });
    } catch (e) {
        console.error(`Storage read error (${key}):`, e);
        return fallback;
    }
};

const dbSet = async (key: string, value: any): Promise<void> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error(`Storage write error (${key}):`, e);
    }
};

const dbDelete = async (key: string): Promise<void> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error(`Storage delete error (${key}):`, e);
    }
};

// --- Migration Logic ---
const migrateFromLocalStorage = async () => {
    const initialized = await dbGet(INIT_KEY, false);
    if (initialized) return;

    console.log("Migrating from localStorage to IndexedDB...");
    const keys = [
        STORAGE_KEY, GOALS_KEY, COUNTDOWNS_KEY, COUNTDOWN_GROUPS_KEY,
        SESSIONS_KEY, TIMER_SETTINGS_KEY, MENUBAR_CONFIG_KEY, CUSTOM_SHOP_ITEMS_KEY,
        SIDEBAR_CONFIG_KEY, PROJECTS_KEY, TASKS_KEY, CUSTOM_EVENTS_KEY, INIT_KEY
    ];

    for (const key of keys) {
        const item = localStorage.getItem(key);
        if (item) {
            try {
                await dbSet(key, JSON.parse(item));
            } catch (e) {
                console.error(`Failed to migrate ${key}`, e);
            }
        }
    }
    await dbSet(INIT_KEY, true);
};

// --- Initialization State Management ---

export const isInitialized = async (): Promise<boolean> => {
    // Check if migration has run or if DB is seeded
    return dbGet(INIT_KEY, false);
};

export const setInitialized = async () => {
    await dbSet(INIT_KEY, true);
};

// --- Data Management (Export/Import) ---

export const exportData = async (): Promise<string> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const data: Record<string, string> = {};
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        tx.oncomplete = () => {
            resolve(JSON.stringify(data, null, 2));
        };
        tx.onerror = () => {
            reject(tx.error);
        };

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
                const key = cursor.key.toString();
                if (key.startsWith('focusflow_') || key.startsWith('heatmap_')) {
                    data[key] = JSON.stringify(cursor.value);
                }
                cursor.continue();
            }
        };
        cursorReq.onerror = () => {
            reject(cursorReq.error);
        }
    });
};

export const exportLogsToCSV = async (): Promise<string> => {
    const logs = await getLogs();
    const projects = await getProjects();
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

export const exportBirthdaysToCSV = async (): Promise<string> => {
    const items = await getCountdowns();
    const header = ['Title', 'Date', 'Type', 'Recurrence'];
    const rows = items.map(item => {
        const cleanTitle = `"${item.title.replace(/"/g, '""')}"`;
        return [cleanTitle, item.date, item.type, item.recurrence || 'none'].join(',');
    });
    return [header.join(','), ...rows].join('\n');
};

export const importCountdownsFromCSV = async (csvText: string): Promise<{ success: boolean, message: string }> => {
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
        
        const current = await getCountdowns();
        // Merge strategy: just append for now
        const merged = [...current, ...newItems];
        await dbSet(COUNTDOWNS_KEY, merged);
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

export const importData = async (jsonString: string): Promise<{ success: boolean; message: string }> => {
    try {
        const data = JSON.parse(jsonString);
        
        if (!validateBackupData(data)) {
            return { success: false, message: "Invalid backup file: Missing FocusFlow data." };
        }

        await clearAllData();

        // Restore data
        for (const key of Object.keys(data)) {
            if (data[key] !== null) {
                await dbSet(key, JSON.parse(data[key]));
            }
        }
        return { success: true, message: "Data restored successfully." };
    } catch (e) {
        console.error("Import failed", e);
        return { success: false, message: "Failed to parse JSON data." };
    }
};

export const clearAllData = async () => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const clearLogs = async () => {
    await dbDelete(STORAGE_KEY);
    await dbDelete(SESSIONS_KEY);
};

export const clearSettings = async () => {
    await dbDelete(TIMER_SETTINGS_KEY);
    await dbDelete(GOALS_KEY);
};

export const clearCountdowns = async () => {
    await dbDelete(COUNTDOWNS_KEY);
    await dbDelete(COUNTDOWN_GROUPS_KEY);
    await dbDelete(CUSTOM_EVENTS_KEY);
};

// --- Projects ---

export const getProjects = async (): Promise<Project[]> => {
    const defaultProject: Project = {
        id: DEFAULT_PROJECT_ID,
        name: 'Main Project',
        theme: 'green',
        createdAt: new Date().toISOString(),
        sortOrder: 0,
        isArchived: false,
        streak: { current: 0, best: 0, lastActiveDate: '' },
        xp: 0,
        unlockedTrophies: []
    };
    
    let projects = await dbGet<Project[]>(PROJECTS_KEY, [defaultProject]);
    
    if (!Array.isArray(projects) || projects.length === 0) {
        // Repair state if invalid
        await dbSet(PROJECTS_KEY, [defaultProject]);
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

export const saveProject = async (project: Project): Promise<Project[]> => {
  const projects = await getProjects();
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
  await dbSet(PROJECTS_KEY, newProjects);
  return newProjects;
};

export const updateProjectsList = async (projects: Project[]): Promise<Project[]> => {
    await dbSet(PROJECTS_KEY, projects);
    return projects;
};

export const deleteProject = async (id: string): Promise<Project[]> => {
    // Prevent deleting the last project
    const projects = await getProjects();
    if (projects.length <= 1) return projects;
    
    const newProjects = projects.filter(p => p.id !== id);
    await dbSet(PROJECTS_KEY, newProjects);
    return newProjects;
};
// --- Tasks ---

export const getTasks = async (): Promise<Task[]> => {
    return dbGet<Task[]>(TASKS_KEY, []);
};

export const saveTask = async (task: Task): Promise<Task[]> => {
    const tasks = await getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    let newTasks;

    const taskToSave = { ...task };
    const originalTask = index >= 0 ? tasks[index] : null;

    // If the task is being marked as completed, set the completion date
    if (taskToSave.isCompleted && (!originalTask || !originalTask.isCompleted)) {
        taskToSave.completionDate = new Date().toISOString();
    }
    // If a task is being marked as not completed, remove the completion date
    if (!taskToSave.isCompleted && originalTask && originalTask.isCompleted) {
        taskToSave.completionDate = undefined;
    }

    if (index >= 0) {
        newTasks = [...tasks];
        newTasks[index] = taskToSave;
    } else {
        newTasks = [...tasks, taskToSave];
    }
    await dbSet(TASKS_KEY, newTasks);
    // Dispatch event so other components know data changed
    window.dispatchEvent(new Event('focusflow-task-update'));
    return newTasks;
};

export const deleteTask = async (id: string): Promise<Task[]> => {
    const tasks = await getTasks();
    const newTasks = tasks.filter(t => t.id !== id);
    await dbSet(TASKS_KEY, newTasks);
    window.dispatchEvent(new Event('focusflow-task-update'));
    return newTasks;
};

export const mergeTasks = async (newTasks: Task[]): Promise<{ saved: Task[], count: number }> => {
    const existingTasks = await getTasks();
    const taskMap = new Map(existingTasks.map(t => [t.id, t]));
    let newCount = 0;
    newTasks.forEach(t => {
        if (!taskMap.has(t.id)) {
            newCount++;
        }
        taskMap.set(t.id, t);
    });
    const saved = Array.from(taskMap.values());
    await dbSet(TASKS_KEY, saved);
    window.dispatchEvent(new Event('focusflow-task-update'));
    return { saved, count: newCount };
};

export const saveTasks = async (tasks: Task[]): Promise<Task[]> => {
    await dbSet(TASKS_KEY, tasks);
    window.dispatchEvent(new Event('focusflow-task-update'));
    return tasks;
};

// --- Logs ---

export const getLogs = async (): Promise<StudyLog[]> => {
    let logs = await dbGet<StudyLog[]>(STORAGE_KEY, []);
    
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
        await dbSet(STORAGE_KEY, logs);
    }

    return logs;
};

export const saveLog = async (log: StudyLog): Promise<StudyLog[]> => {
  const logs = await getLogs();
  
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
  
  await dbSet(STORAGE_KEY, newLogs);
  return newLogs;
};

export const deleteLog = async (date: string, projectId: string): Promise<StudyLog[]> => {
  const logs = await getLogs();
  // Only delete log for specific project and date
  const newLogs = logs.filter(l => !(l.date === date && l.projectId === projectId));
  await dbSet(STORAGE_KEY, newLogs);
  return newLogs;
};

export const getGoals = async (): Promise<UserGoals> => {
    const defaultGoals = { daily: 4, weekly: 40, monthly: 160, yearly: 2000 };
    const saved = await dbGet<any>(GOALS_KEY, {});
    return {
        daily: saved.daily || defaultGoals.daily,
        weekly: saved.weekly || defaultGoals.weekly,
        monthly: saved.monthly || defaultGoals.monthly,
        yearly: saved.yearly || defaultGoals.yearly
    };
};

export const saveGoals = async (goals: UserGoals): Promise<UserGoals> => {
  await dbSet(GOALS_KEY, goals);
  return goals;
};

// --- Countdown Groups ---
export const getCountdownGroups = async (): Promise<CountdownGroup[]> => {
    return dbGet<CountdownGroup[]>(COUNTDOWN_GROUPS_KEY, [
        { id: 'general', name: 'General', color: 'blue' }
    ]);
};

export const saveCountdownGroup = async (group: CountdownGroup): Promise<CountdownGroup[]> => {
    const groups = await getCountdownGroups();
    const idx = groups.findIndex(g => g.id === group.id);
    let newGroups = [...groups];
    if (idx >= 0) newGroups[idx] = group;
    else newGroups.push(group);
    await dbSet(COUNTDOWN_GROUPS_KEY, newGroups);
    return newGroups;
};

export const saveCountdownGroups = async (groups: CountdownGroup[]): Promise<CountdownGroup[]> => {
    await dbSet(COUNTDOWN_GROUPS_KEY, groups);
    return groups;
};

export const deleteCountdownGroup = async (id: string): Promise<CountdownGroup[]> => {
    const groups = await getCountdownGroups();
    const newGroups = groups.filter(g => g.id !== id);
    await dbSet(COUNTDOWN_GROUPS_KEY, newGroups);
    return newGroups;
};

// --- Countdowns ---

export const getCountdowns = async (): Promise<CountdownItem[]> => {
    return dbGet<CountdownItem[]>(COUNTDOWNS_KEY, []);
};

export const saveCountdown = async (item: CountdownItem): Promise<CountdownItem[]> => {
  const items = await getCountdowns();
  const index = items.findIndex(i => i.id === item.id);
  let newItems;
  if (index >= 0) {
    newItems = [...items];
    newItems[index] = item;
  } else {
    newItems = [...items, item];
  }
  await dbSet(COUNTDOWNS_KEY, newItems);
  return newItems;
};

export const deleteCountdown = async (id: string): Promise<CountdownItem[]> => {
  const items = await getCountdowns();
  const newItems = items.filter(i => i.id !== id);
  await dbSet(COUNTDOWNS_KEY, newItems);
  return newItems;
};

export const seedCountdowns = async (): Promise<CountdownItem[]> => {
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
    await dbSet(COUNTDOWNS_KEY, items);
    return items;
}

// Session Records
export const getSessions = async (): Promise<SessionRecord[]> => {
    return dbGet<SessionRecord[]>(SESSIONS_KEY, []);
};

export const saveSessionRecord = async (session: SessionRecord): Promise<SessionRecord[]> => {
  const sessions = await getSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  let newSessions;
  if (idx >= 0) {
      newSessions = [...sessions];
      newSessions[idx] = session;
  } else {
      newSessions = [session, ...sessions];
  }
  await dbSet(SESSIONS_KEY, newSessions);
  return newSessions;
};

export const deleteSessionRecord = async (id: string): Promise<SessionRecord[]> => {
    const sessions = await getSessions();
    const newSessions = sessions.filter(s => s.id !== id);
    await dbSet(SESSIONS_KEY, newSessions);
    return newSessions;
};

export const batchDeleteSessions = async (ids: string[]): Promise<SessionRecord[]> => {
    const sessions = await getSessions();
    const newSessions = sessions.filter(s => !ids.includes(s.id));
    await dbSet(SESSIONS_KEY, newSessions);
    return newSessions;
}

// Timer Settings
export const getTimerSettings = async (): Promise<TimerSettings> => {
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
    const saved = await dbGet<TimerSettings>(TIMER_SETTINGS_KEY, defaultSettings);
    return { ...defaultSettings, ...saved };
};

export const saveTimerSettings = async (settings: TimerSettings): Promise<TimerSettings> => {
    await dbSet(TIMER_SETTINGS_KEY, settings);
    return settings;
};

// Menu Bar Configuration
export const getMenuBarConfig = async (): Promise<MenuBarConfig> => {
    return dbGet<MenuBarConfig>(MENUBAR_CONFIG_KEY, { mode: 'none' });
};

export const saveMenuBarConfig = async (config: MenuBarConfig): Promise<MenuBarConfig> => {
    await dbSet(MENUBAR_CONFIG_KEY, config);
    return config;
};

// Sidebar Configuration
export const getSidebarConfig = async (): Promise<SidebarConfig> => {
    return dbGet<SidebarConfig>(SIDEBAR_CONFIG_KEY, { 
        showWeeklyGoalWidget: true,
        showDailyGoalWidget: false,
        showMonthlyGoalWidget: false,
        showTimerWidget: false,
        showCountdownWidget: false,
        showQuestsWidget: true,
        questsWidgetSize: 'standard',
        widgetOrder: [
            'showTimerWidget',
            'showQuestsWidget',
            'showCountdownWidget',
            'showDailyGoalWidget',
            'showWeeklyGoalWidget',
            'showMonthlyGoalWidget'
        ]
    });
};

export const saveSidebarConfig = async (config: SidebarConfig): Promise<SidebarConfig> => {
    await dbSet(SIDEBAR_CONFIG_KEY, config);
    return config;
};

// Custom Events (Calendar)
export const getCustomEvents = async (): Promise<CustomEvent[]> => {
    return dbGet<CustomEvent[]>(CUSTOM_EVENTS_KEY, []);
};

export const saveCustomEvent = async (event: CustomEvent): Promise<CustomEvent[]> => {
    const events = await getCustomEvents();
    // Check if updating
    const idx = events.findIndex(e => e.id === event.id);
    let newEvents;
    if (idx >= 0) {
        newEvents = [...events];
        newEvents[idx] = event;
    } else {
        newEvents = [...events, event];
    }
    await dbSet(CUSTOM_EVENTS_KEY, newEvents);
    return newEvents;
};

export const deleteCustomEvent = async (id: string): Promise<CustomEvent[]> => {
    const events = await getCustomEvents();
    const newEvents = events.filter(e => e.id !== id);
    await dbSet(CUSTOM_EVENTS_KEY, newEvents);
    return newEvents;
};

// --- Custom Shop Items ---
export const getCustomShopItems = async (): Promise<ShopItem[]> => {
    return dbGet<ShopItem[]>(CUSTOM_SHOP_ITEMS_KEY, []);
};

export const saveCustomShopItem = async (item: ShopItem): Promise<ShopItem[]> => {
    const items = await getCustomShopItems();
    const idx = items.findIndex(i => i.id === item.id);
    let newItems;
    if (idx >= 0) {
        newItems = [...items];
        newItems[idx] = item;
    } else {
        newItems = [...items, item];
    }
    await dbSet(CUSTOM_SHOP_ITEMS_KEY, newItems);
    return newItems;
};

export const deleteCustomShopItem = async (id: string): Promise<ShopItem[]> => {
    const items = await getCustomShopItems();
    const newItems = items.filter(i => i.id !== id);
    await dbSet(CUSTOM_SHOP_ITEMS_KEY, newItems);
    return newItems;
};

// Seed some data for visualization purposes if empty
export const seedData = async (): Promise<StudyLog[]> => {
  await migrateFromLocalStorage(); // Ensure migration happens before seeding check

  // Check if migration populated data
  const existingLogs = await getLogs();
  if (existingLogs.length > 0) return existingLogs;

  const logs: StudyLog[] = [];
  const sessions: SessionRecord[] = [];
  const today = new Date();
  
  const projects = await getProjects();
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

  await dbSet(STORAGE_KEY, logs);
  await dbSet(SESSIONS_KEY, sessions);
  
  return logs;
};