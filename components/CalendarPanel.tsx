import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { StudyLog, CustomEvent, GoogleEvent, Project, CountdownItem } from '../types';
import * as storage from '../services/storageService';
import { useCountdowns } from '../AppContext';
import { useTheme } from '../AppContext';
import { getGoogleAuthUrl, exchangeGoogleCode, GOOGLE_REDIRECT_URI } from '../services/googleService';

declare const google: any;

interface CalendarPanelProps {
  logs: StudyLog[];
  projects: Project[];
}

interface CalendarEventDisplay {
    id: string;
    originalId?: string; 
    title: string;
    date: Date;
    type: 'study' | 'custom' | 'google' | 'countdown';
    customType?: string;
    color: string;
    isCustom?: boolean;
    time?: string;
    description?: string;
    location?: string;
    link?: string;
    recurrence?: CustomEvent['recurrence'];
    calendar?: string;
    reminderMinutes?: number;
}

const EVENT_COLORS = [
    { name: 'Blue', value: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200 border-blue-200 dark:border-blue-500/30', picker: 'bg-blue-500' },
    { name: 'Red', value: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200 border-red-200 dark:border-red-500/30', picker: 'bg-red-500' },
    { name: 'Green', value: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200 border-green-200 dark:border-green-500/30', picker: 'bg-green-500' },
    { name: 'Purple', value: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200 border-purple-200 dark:border-purple-500/30', picker: 'bg-purple-500' },
    { name: 'Orange', value: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200 border-orange-200 dark:border-orange-500/30', picker: 'bg-orange-500' },
];

const getCalendarColor = (summary: string, isCyberpunk: boolean) => {
    let hash = 0;
    for (let i = 0; i < summary.length; i++) {
        hash = summary.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % EVENT_COLORS.length;
    const colorObj = EVENT_COLORS[index];
    
    if (isCyberpunk) {
         const neonColors: Record<string, string> = {
             Blue: 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30',
             Red: 'bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/30',
             Green: 'bg-[#00ff00]/10 text-[#00ff00] border border-[#00ff00]/30',
             Purple: 'bg-[#ff00ff]/10 text-[#ff00ff] border border-[#ff00ff]/30',
             Orange: 'bg-[#ff9900]/10 text-[#ff9900] border border-[#ff9900]/30',
         };
         return neonColors[colorObj.name] || neonColors['Blue'];
    }
    return colorObj.value;
};

export const CalendarPanel: React.FC<CalendarPanelProps> = ({ logs, projects }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { appTheme } = useTheme();
    const isCyberpunk = appTheme === 'cyberpunk';
    const { countdowns } = useCountdowns();
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const [searchQuery, setSearchQuery] = useState('');
    const [hiddenProjectIds, setHiddenProjectIds] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('focusflow_calendar_hidden_projects') || '[]');
        } catch { return []; }
    });

    useEffect(() => { localStorage.setItem('focusflow_calendar_hidden_projects', JSON.stringify(hiddenProjectIds)); }, [hiddenProjectIds]);
    
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
    const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
    const [weekStartDay, setWeekStartDay] = useState<0 | 1>(0); // 0 = Sunday, 1 = Monday
    // Google Integration State
    const [isConnected, setIsConnected] = useState(false);
    const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
    const [googleClientId, setGoogleClientId] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('google_client_id') || '';
        }
        return '';
    });
    const [googleClientSecret, setGoogleClientSecret] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('google_client_secret') || '';
        }
        return '';
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [configTab, setConfigTab] = useState<'view' | 'filters' | 'connections'>('view');
    const [googleCalendars, setGoogleCalendars] = useState<{id: string, summary: string, color: string, visible: boolean}[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('focusflow_google_calendars') || '[]');
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem('focusflow_google_calendars', JSON.stringify(googleCalendars));
    }, [googleCalendars]);

    const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
    
    // Calendar Visibility States
    const [calendars, setCalendars] = useState({
        studyLogs: true,
        personal: true,
        google: true,
        countdowns: true,
    });

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [viewEvent, setViewEvent] = useState<CalendarEventDisplay | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null); 
    const [selectedDateForEvent, setSelectedDateForEvent] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventTime, setNewEventTime] = useState('');
    const [newEventType, setNewEventType] = useState<CustomEvent['type']>('meeting');
    const [newEventColor, setNewEventColor] = useState(EVENT_COLORS[0].value);
    const [newEventDesc, setNewEventDesc] = useState('');
    const [newEventLoc, setNewEventLoc] = useState('');
    const [newEventRecurrence, setNewEventRecurrence] = useState<CustomEvent['recurrence']>('none');
    const [newEventCalendar, setNewEventCalendar] = useState<string>('Personal');
    const [newEventReminder, setNewEventReminder] = useState<number>(0);

    useEffect(() => {
        storage.getCustomEvents().then(setCustomEvents);
        // Check for existing token
        const savedToken = localStorage.getItem('google_access_token');
        if (savedToken) {
            setIsConnected(true);
        }
    }, []);

    // Listen for OAuth Code (Electron / Loopback)
    useEffect(() => {
        if (window.electronAPI?.onOAuthCode) {
            return window.electronAPI.onOAuthCode((codeOrUrl) => {
                if (!isConfigOpen) return; // Only handle if this panel initiated it
                
                let code = codeOrUrl;
                if (codeOrUrl.includes('code=')) {
                    const match = codeOrUrl.match(/code=([^&]+)/);
                    if (match) code = match[1];
                }

                if (code) handleGoogleCode(code);
            });
        }
    }, [isConfigOpen, googleClientId, googleClientSecret]);

    const handleGoogleCode = async (code: string) => {
        try {
            const data = await exchangeGoogleCode(googleClientId, googleClientSecret, code, GOOGLE_REDIRECT_URI);
            if (data.access_token) {
                localStorage.setItem('google_access_token', data.access_token);
                setIsConnected(true);
                setIsConfigOpen(false);
                await fetchGoogleEvents(data.access_token, currentDate);
                alert("Google Calendar Connected!");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to connect Google Account.");
        }
    };

    const handleGoogleConnect = () => {
        if (!googleClientId || !googleClientSecret) {
            setIsConfigOpen(true);
            return;
        }
        const scope = 'https://www.googleapis.com/auth/calendar';
        const url = getGoogleAuthUrl(googleClientId, GOOGLE_REDIRECT_URI, scope);
        window.open(url, '_blank');
    };

    const fetchGoogleEvents = useCallback(async (accessToken: string, date: Date) => {
        try {
            const startOfMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1).toISOString();
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 2, 0).toISOString();

            // 1. Fetch Calendar List
            const calendarListRes = await fetch(
                `https://www.googleapis.com/calendar/v3/users/me/calendarList`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            
            if (!calendarListRes.ok) {
                const errText = await calendarListRes.text();
                throw new Error(`Failed to fetch calendar list: ${calendarListRes.status} ${errText}`);
            }
            const calendarList = await calendarListRes.json();
            
            if (!calendarList.items || calendarList.items.length === 0) {
                console.warn("No calendars found in Google Calendar list.");
            }

            setGoogleCalendars(prev => {
                return (calendarList.items || []).map((cal: any) => {
                    const existing = prev.find(p => p.id === cal.id);
                    return {
                        id: cal.id,
                        summary: cal.summary,
                        color: cal.backgroundColor,
                        visible: existing ? existing.visible : true
                    };
                });
            });
            
            const allEvents: GoogleEvent[] = [];

            // 2. Fetch events for each calendar
            const fetchPromises = (calendarList.items || []).map(async (cal: any) => {
                if (!cal.id) return;

                const eventsRes = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${startOfMonth}&timeMax=${endOfMonth}&singleEvents=true&orderBy=startTime`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                
                if (eventsRes.ok) {
                    const data = await eventsRes.json();
                    if (data.items) {
                        allEvents.push(...data.items.map((e: any) => ({ ...e, calendarSummary: cal.summary, calendarColor: cal.backgroundColor, calendarId: cal.id })));
                    }
                }
            });

            await Promise.all(fetchPromises);

            if (isMounted.current) {
                setGoogleEvents(allEvents);
            }
        } catch (error: any) {
            console.error("Error fetching Google Calendar events:", error);
            const msg = error instanceof Error ? error.message : "Unknown error";
            alert(`Failed to sync Google Calendar: ${msg}. Please check your Client ID and permissions.`);
            if (isMounted.current) setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        if (isConnected) {
            const token = localStorage.getItem('google_access_token');
            if (token) fetchGoogleEvents(token, currentDate);
        }
    }, [currentDate, isConnected, fetchGoogleEvents]);

    const handleRefresh = async () => {
        const token = localStorage.getItem('google_access_token');
        if (token) {
            setIsRefreshing(true);
            await fetchGoogleEvents(token, currentDate);
            setTimeout(() => setIsRefreshing(false), 800);
        }
    };

    const handleSaveClientId = () => {
        if(!googleClientId.trim() || !googleClientSecret.trim()) {
            alert("Please enter Client ID and Secret");
            return;
        }
        localStorage.setItem('google_client_id', googleClientId);
        localStorage.setItem('google_client_secret', googleClientSecret);
        setIsConfigOpen(false);
    };
    
    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const getWeekDays = (date: Date) => {
        const current = new Date(date);
        const day = current.getDay();
        const diff = current.getDate() - day + (day < weekStartDay ? -7 : 0) + weekStartDay;
        const startOfWeek = new Date(current.setDate(diff));
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        });
    };

    const prevMonth = () => {
        if (viewMode === 'month' || viewMode === 'agenda') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    };

    const nextMonth = () => {
        if (viewMode === 'month' || viewMode === 'agenda') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const toggleCalendar = (key: keyof typeof calendars) => {
        setCalendars(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleProjectVisibility = (projectId: string) => {
        setHiddenProjectIds(prev => {
            if (prev.includes(projectId)) return prev.filter(id => id !== projectId);
            return [...prev, projectId];
        });
    };

    // --- Data merging ---
    const events = useMemo(() => {
        const allEvents: CalendarEventDisplay[] = [];

        // Study Logs
        if (calendars.studyLogs) {
            // Optimization: Filter logs by visible date range to improve performance
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            // Buffer: 1 month before and after to cover grid edges
            const minDateStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const maxDateStr = new Date(year, month + 2, 0).toISOString().split('T')[0];

            logs.filter(log => {
                if (log.date < minDateStr || log.date > maxDateStr) return false;
                return !hiddenProjectIds.includes(log.projectId);
            }).forEach(log => {
                if (log.hours > 0 && log.date) {
                    // Fix: Parse date components manually to ensure Local Time construction
                    // This prevents UTC timezone shifts (e.g. 2024-05-20 becoming May 19th)
                    const [y, m, d] = log.date.split('-').map(Number);
                    
                    allEvents.push({
                        id: `log-${log.date}-${log.projectId}`,
                        title: `${log.hours}h Study`,
                        date: new Date(y, m - 1, d),
                        type: 'study',
                        color: isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 shadow-[0_0_5px_rgba(0,240,255,0.2)]' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 border-indigo-200 dark:border-indigo-500/30',
                        description: log.notes,
                        calendar: 'Study Logs'
                    });
                }
            });
        }

        // Custom Events with Recurrence Logic
        if (calendars.personal) {
            const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const viewEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 31);

            customEvents.forEach(evt => {
                let color = evt.color;
                
                // Cyberpunk override for custom events
                if (isCyberpunk && color) {
                     const foundColor = EVENT_COLORS.find(c => c.value === color);
                     if (foundColor) {
                          const neonColors: Record<string, string> = {
                             Blue: 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30',
                             Red: 'bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/30',
                             Green: 'bg-[#00ff00]/10 text-[#00ff00] border border-[#00ff00]/30',
                             Purple: 'bg-[#ff00ff]/10 text-[#ff00ff] border border-[#ff00ff]/30',
                             Orange: 'bg-[#ff9900]/10 text-[#ff9900] border border-[#ff9900]/30',
                         };
                         if (neonColors[foundColor.name]) color = neonColors[foundColor.name];
                     }
                }

                if (!color) {
                    if (evt.type === 'meeting') color = EVENT_COLORS[3].value;
                    else if (evt.type === 'deadline') color = EVENT_COLORS[1].value;
                    else if (evt.type === 'reminder') color = EVENT_COLORS[4].value;
                    else color = EVENT_COLORS[2].value;
                }

                const displayCalendar = evt.calendar || 'Personal';

                if (!evt.recurrence || evt.recurrence === 'none') {
                    allEvents.push({
                        id: evt.id,
                        originalId: evt.id,
                        title: evt.title,
                        date: new Date(evt.date),
                        time: evt.time,
                        type: 'custom',
                        customType: evt.type,
                        color: color || 'bg-gray-100',
                        isCustom: true,
                        description: evt.description,
                        location: evt.location,
                        recurrence: evt.recurrence,
                        calendar: displayCalendar,
                        reminderMinutes: evt.reminderMinutes
                    });
                } else {
                    const startDate = new Date(evt.date);
                    const startMidnight = new Date(startDate);
                    startMidnight.setHours(0,0,0,0);

                    for (let d = new Date(viewStart); d <= viewEnd; d.setDate(d.getDate() + 1)) {
                         const currentMidnight = new Date(d);
                         currentMidnight.setHours(0,0,0,0);
                         
                        if (currentMidnight < startMidnight) continue;

                        let isMatch = false;
                        if (evt.recurrence === 'daily') isMatch = true;
                        if (evt.recurrence === 'weekly' && d.getDay() === startDate.getDay()) isMatch = true;
                        if (evt.recurrence === 'monthly' && d.getDate() === startDate.getDate()) isMatch = true;

                        if (isMatch) {
                            allEvents.push({
                                id: `${evt.id}-${d.toISOString().split('T')[0]}`,
                                originalId: evt.id,
                                title: evt.title,
                                date: new Date(d),
                                time: evt.time,
                                type: 'custom',
                                customType: evt.type,
                                color: color || 'bg-gray-100',
                                isCustom: true,
                                description: evt.description,
                                location: evt.location,
                                recurrence: evt.recurrence,
                                calendar: displayCalendar,
                                reminderMinutes: evt.reminderMinutes
                            });
                        }
                    }
                }
            });
        }

        // Countdowns
        const viewStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const viewEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 31);

        countdowns.forEach(item => {
            if (!calendars.countdowns) return;
            if (item.isArchived) return;
            if (item.projectId && hiddenProjectIds.includes(item.projectId)) return;

            // Map color name to tailwind classes
            const colorObj = EVENT_COLORS.find(c => c.name.toLowerCase() === item.color) || EVENT_COLORS[0];
            const color = colorObj.value;
            
            let displayColor = color;
            if (isCyberpunk) {
                 const neonColors: Record<string, string> = {
                     blue: 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30',
                     red: 'bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/30',
                     green: 'bg-[#00ff00]/10 text-[#00ff00] border border-[#00ff00]/30',
                     purple: 'bg-[#ff00ff]/10 text-[#ff00ff] border border-[#ff00ff]/30',
                     orange: 'bg-[#ff9900]/10 text-[#ff9900] border border-[#ff9900]/30',
                     pink: 'bg-[#ff0099]/10 text-[#ff0099] border border-[#ff0099]/30',
                 };
                 displayColor = neonColors[item.color] || neonColors['blue'];
            }

            if (!item.recurrence || item.recurrence === 'none') {
                 allEvents.push({
                    id: item.id,
                    title: item.title,
                    date: new Date(item.date),
                    type: 'countdown',
                    customType: item.type,
                    color: displayColor,
                    calendar: 'Countdown'
                });
            } else {
                const startDate = new Date(item.date);
                const startMidnight = new Date(startDate);
                startMidnight.setHours(0,0,0,0);

                for (let d = new Date(viewStart); d <= viewEnd; d.setDate(d.getDate() + 1)) {
                     const currentMidnight = new Date(d);
                     currentMidnight.setHours(0,0,0,0);
                     
                    if (currentMidnight < startMidnight) continue;

                    let isMatch = false;
                    if (item.recurrence === 'daily') isMatch = true;
                    if (item.recurrence === 'weekly' && d.getDay() === startDate.getDay()) isMatch = true;
                    if (item.recurrence === 'monthly' && d.getDate() === startDate.getDate()) isMatch = true;
                    if (item.recurrence === 'yearly' && d.getMonth() === startDate.getMonth() && d.getDate() === startDate.getDate()) isMatch = true;

                    if (isMatch) {
                        allEvents.push({
                            id: `${item.id}-${d.toISOString().split('T')[0]}`,
                            title: item.title,
                            date: new Date(d),
                            type: 'countdown',
                            customType: item.type,
                            color: displayColor,
                            calendar: 'Countdown'
                        });
                    }
                }
            }
        });

        if (calendars.google && googleEvents.length > 0) {
            googleEvents.forEach(evt => {
                // Check visibility
                const calConfig = googleCalendars.find(c => c.id === evt.calendarId);
                if (calConfig && !calConfig.visible) return;

                const start = evt.start.dateTime || evt.start.date;
                if (start) {
                    const dateObj = new Date(start);
                    const timeStr = evt.start.dateTime 
                        ? dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) 
                        : undefined;

                    const colorClass = evt.calendarSummary ? getCalendarColor(evt.calendarSummary, isCyberpunk) : (isCyberpunk ? 'bg-[#00ff00]/10 text-[#00ff00] border border-[#00ff00]/30 shadow-[0_0_5px_rgba(0,255,0,0.2)]' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 border-emerald-200 dark:border-emerald-500/30');

                    allEvents.push({
                        id: evt.id,
                        title: evt.summary,
                        date: dateObj,
                        time: timeStr,
                        type: 'google',
                        color: colorClass,
                        description: evt.description,
                        location: evt.location,
                        link: evt.htmlLink,
                        calendar: evt.calendarSummary || 'Google'
                    });
                }
            });
        }

        // Apply Search Filter
        let result = allEvents;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e => 
                e.title.toLowerCase().includes(q) || 
                (e.description && e.description.toLowerCase().includes(q)) || 
                (e.location && e.location.toLowerCase().includes(q))
            );
        }

        return result.sort((a,b) => {
             if (a.date.getTime() === b.date.getTime()) {
                 if (a.time && b.time) return a.time.localeCompare(b.time);
                 return 0;
             }
             return a.date.getTime() - b.date.getTime();
        });
    }, [logs, calendars, currentDate, customEvents, googleEvents, countdowns, searchQuery, hiddenProjectIds, isCyberpunk, googleCalendars, viewMode]);

    // Pre-group events by date for O(1) lookup during render
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEventDisplay[]>();
        events.forEach(evt => {
            const dateStr = evt.date.toDateString();
            if (!map.has(dateStr)) map.set(dateStr, []);
            map.get(dateStr)!.push(evt);
        });
        return map;
    }, [events]);

    // --- Handlers ---
    const handleDayClick = (dateStr: string) => {
        resetForm();
        setSelectedDateForEvent(dateStr);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setNewEventTitle('');
        setNewEventTime('');
        setNewEventDesc('');
        setNewEventLoc('');
        setNewEventType('meeting');
        setNewEventRecurrence('none');
        setNewEventColor(EVENT_COLORS[0].value);
        setNewEventCalendar('Personal');
        setNewEventReminder(0);
    };

    const handleEventClick = (event: CalendarEventDisplay) => {
        setViewEvent(event);
        setIsDetailsOpen(true);
    };

    const switchToEditMode = () => {
        if (!viewEvent || !viewEvent.isCustom || !viewEvent.originalId) return;
        
        const rawEvent = customEvents.find(e => e.id === viewEvent.originalId);
        if (!rawEvent) return;

        setEditingId(rawEvent.id);
        setNewEventTitle(rawEvent.title);
        setSelectedDateForEvent(rawEvent.date);
        setNewEventTime(rawEvent.time || '');
        setNewEventDesc(rawEvent.description || '');
        setNewEventLoc(rawEvent.location || '');
        setNewEventType(rawEvent.type);
        setNewEventRecurrence(rawEvent.recurrence || 'none');
        setNewEventColor(rawEvent.color || EVENT_COLORS[0].value);
        setNewEventCalendar(rawEvent.calendar || 'Personal');
        setNewEventReminder(rawEvent.reminderMinutes || 0);
        
        setIsDetailsOpen(false); // Close details modal
        setIsModalOpen(true); // Open form modal
    };

    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventTitle) return;

        const eventData: CustomEvent = {
            id: editingId || Date.now().toString(),
            title: newEventTitle,
            date: selectedDateForEvent,
            time: newEventTime,
            type: newEventType,
            description: newEventDesc,
            location: newEventLoc,
            color: newEventColor,
            recurrence: newEventRecurrence,
            calendar: newEventCalendar,
            reminderMinutes: newEventReminder
        };
        
        const updatedEvents = await storage.saveCustomEvent(eventData);
        setCustomEvents(updatedEvents);
        setIsModalOpen(false);
        resetForm();
    };

    const handleDeleteEvent = async () => {
         const idToDelete = editingId || viewEvent?.originalId;

         if (idToDelete && confirm('Are you sure you want to delete this event?')) {
             const updatedEvents = await storage.deleteCustomEvent(idToDelete);
             setCustomEvents(updatedEvents);
             setIsModalOpen(false);
             setIsDetailsOpen(false);
             resetForm();
         }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const toggleGoogleCalendarVisibility = (id: string) => {
        setGoogleCalendars(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
    };

    // --- Drag and Drop Handlers ---
    const onEventDragStart = (e: React.DragEvent, eventId: string) => {
        e.dataTransfer.setData('text/plain', eventId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingEventId(eventId);
    };

    const onCellDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'move';
    };

    const onCellDrop = async (e: React.DragEvent, dateStr: string) => {
        e.preventDefault();
        const eventId = e.dataTransfer.getData('text/plain');
        setDraggingEventId(null);

        // Find the event object
        const evt = events.find(e => e.id === eventId);
        if (!evt || !evt.isCustom || !evt.originalId) return;

        // Update the event date
        const rawEvent = customEvents.find(e => e.id === evt.originalId);
        if (rawEvent) {
            const updatedEvent = { ...rawEvent, date: dateStr };
            const newEvents = await storage.saveCustomEvent(updatedEvent);
            setCustomEvents(newEvents);
        }
    };

    const renderEventsForDay = (d: Date, maxEvents = 4) => {
        const dayStr = d.toDateString();
        const dayEvents = eventsByDate.get(dayStr) || [];

        // In week view, we can show more events
        const limit = viewMode === 'week' ? 20 : maxEvents;
        const visibleEvents = dayEvents.slice(0, limit);
        const hiddenCount = dayEvents.length - limit;

        return (
            <>
            {visibleEvents.map((evt, idx) => (
             <button 
                key={`${evt.id}-${idx}`}
                draggable={evt.isCustom}
                onDragStart={(e) => onEventDragStart(e, evt.id)}
                onClick={(e) => { e.stopPropagation(); handleEventClick(evt); }}
                className={`text-[10px] w-full text-left px-2 py-1 rounded-md truncate mb-1 border-l-[3px] transition-all hover:brightness-95 hover:scale-[1.02] shadow-sm ${evt.color} ${draggingEventId === evt.id ? 'opacity-50' : ''} ${evt.isCustom ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                title={evt.title}
             >
                 {evt.time && <span className="mr-1.5 opacity-75 font-mono">{evt.time}</span>}
                 <span className="font-semibold">{evt.title}</span>
             </button>
            ))}
            {hiddenCount > 0 && <div className={`text-[9px] text-center ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400'}`}>+ {hiddenCount} more</div>}
            </>
        );
    };

    const renderAgendaView = () => {
        const days = [];
        const start = new Date(currentDate);
        // Show next 30 days starting from selected date
        for (let i = 0; i < 30; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }

        return (
            <div className="space-y-4 pb-20">
                {days.map(d => {
                    const dateStr = d.toDateString();
                    const dayEvents = eventsByDate.get(dateStr) || [];
                    if (dayEvents.length === 0) return null;

                    const isToday = d.toDateString() === new Date().toDateString();

                    return (
                        <div key={dateStr} className={`rounded-xl border p-4 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'} ${isToday ? (isCyberpunk ? 'border-[#00f0ff]' : 'border-blue-500 ring-1 ring-blue-500/20') : ''}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`text-2xl font-bold ${isToday ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400') : (isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400')}`}>
                                    {d.getDate()}
                                </div>
                                <div>
                                    <div className={`text-xs font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-gray-500 dark:text-gray-400'}`}>{d.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                                    <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'}`}>{d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {dayEvents.map((evt, idx) => (
                                    <div 
                                        key={`${evt.id}-${idx}`}
                                        onClick={() => handleEventClick(evt)}
                                        className={`flex items-center p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:brightness-95 ${evt.color} ${isCyberpunk ? 'bg-opacity-10' : ''}`}
                                    >
                                        <div className="flex-1">
                                            <div className="font-bold text-sm">{evt.title}</div>
                                            <div className="flex gap-2 text-xs opacity-80">
                                                {evt.time && <span>{evt.time}</span>}
                                                {evt.calendar && <span>• {evt.calendar}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {days.every(d => (eventsByDate.get(d.toDateString()) || []).length === 0) && (
                    <div className="text-center py-10 text-gray-500">No upcoming events in the next 30 days.</div>
                )}
            </div>
        );
    };

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-gray-50/50 dark:bg-gray-900'}`}>
             
             {/* Header Redesign */}
             <div className={`flex flex-col md:flex-row justify-between items-center p-6 border-b shadow-sm shrink-0 z-10 relative ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-4 mb-4 md:mb-0 w-full md:w-auto justify-between md:justify-start">
                    <div className={`flex items-center p-1 rounded-xl ${isCyberpunk ? 'bg-black border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <button onClick={prevMonth} className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'hover:bg-white dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={goToToday} className={`text-xs font-bold px-3 py-1.5 transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>
                            Today
                        </button>
                        <button onClick={nextMonth} className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'hover:bg-white dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <h2 className={`text-2xl font-bold whitespace-nowrap ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-900 dark:text-white'}`}>
                        {viewMode === 'month' 
                            ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                            : viewMode === 'week' ? `Week of ${getWeekDays(currentDate)[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Agenda'
                        }
                    </h2>
                </div>

                {/* Right: Actions & Filters */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {/* Search */}
                    <div className={`relative hidden lg:block ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>
                        <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-48 pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 focus:border-[#00f0ff] placeholder-[#00f0ff]/30' : 'bg-gray-100 dark:bg-gray-700/50 border-transparent focus:bg-white dark:focus:bg-gray-800 focus:ring-blue-500'}`}
                        />
                    </div>

                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

                    {/* Sync Button */}
                    {isConnected && (
                        <button 
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className={`p-2 rounded-xl transition-all border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            title="Sync Calendar"
                        >
                            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    )}

                    {/* Settings Button */}
                     <button 
                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                        className={`p-2 rounded-xl transition-all border flex items-center gap-2 ${isConfigOpen ? (isCyberpunk ? 'bg-[#00f0ff]/20 border-[#00f0ff]' : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600') : (isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700')} ${!isConnected ? 'animate-pulse ring-2 ring-blue-500/50' : ''}`}
                        title="Customize Calendar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        <span className="hidden lg:inline text-xs font-bold">Customize</span>
                     </button>

                    {/* Add Event Button */}
                     <button 
                        onClick={() => handleDayClick(new Date().toISOString().split('T')[0])}
                        className={`px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2 ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/90' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        <span className="hidden sm:inline">Add Event</span>
                     </button>
                </div>
             </div>

             <div className="flex flex-1 overflow-hidden relative">
                {/* Grid */}
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {viewMode === 'month' ? (
                    <div className={`grid grid-cols-7 gap-px rounded-2xl overflow-hidden border shadow-sm ${isCyberpunk ? 'bg-[#00f0ff]/20 border-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700/50'}`}>
                        {/* Week Days */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                            <div key={day} className={`p-3 text-center text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm ${isCyberpunk ? 'bg-[#0a0a0a] text-[#00f0ff]/60' : 'bg-gray-50/80 dark:bg-[#252527] text-gray-400 dark:text-gray-500'} ${(i < weekStartDay) ? 'order-last' : ''}`}>
                                {day}
                            </div>
                        ))}

                        {/* Days */}
                        {(() => {
                            const days = daysInMonth(currentDate);
                            const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
                            const offset = (startDay - weekStartDay + 7) % 7;
                            const totalSlots = Math.ceil((days + offset) / 7) * 7;

                            return Array.from({ length: totalSlots }).map((_, index) => {
                                const dayNumber = index - offset + 1;
                                const isCurrentMonth = dayNumber > 0 && dayNumber <= days;
                                const isToday = isCurrentMonth && dayNumber === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                                
                                if (!isCurrentMonth) {
                                    return <div key={index} className={`min-h-[120px] ${isCyberpunk ? 'bg-black/80' : 'bg-gray-50/30 dark:bg-[#1a1a1c]/50'}`}></div>;
                                }

                                const dObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
                                const dateStr = dObj.toISOString().split('T')[0];
                                const dayEvents = eventsByDate.get(dObj.toDateString()) || [];
                                const countdownEvent = dayEvents.find(e => e.type === 'countdown');

                                return (
                                    <div 
                                        key={index} 
                                        className={`group min-h-[120px] p-2 transition-colors duration-200 cursor-pointer border border-transparent ${isCyberpunk ? 'bg-[#0a0a0a] hover:border-[#00f0ff]/50' : 'bg-white dark:bg-[#1c1c1e] hover:bg-blue-50/30 dark:hover:bg-[#252527] hover:border-blue-200 dark:hover:border-blue-900/30'} ${isToday ? (isCyberpunk ? 'bg-[#00f0ff]/5' : 'bg-blue-50/20 dark:bg-blue-900/5') : ''}`}
                                        onClick={() => handleDayClick(dateStr)}
                                        onDragOver={onCellDragOver}
                                        onDrop={(e) => onCellDrop(e, dateStr)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="relative">
                                                <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isToday ? (isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-blue-600 text-white shadow-md shadow-blue-500/30') : (isCyberpunk ? 'text-[#00f0ff]/60 group-hover:text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300 group-hover:bg-gray-100 dark:group-hover:bg-gray-700')}`}>
                                                    {dayNumber}
                                                </span>
                                                {countdownEvent && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleEventClick(countdownEvent); }} className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white dark:border-[#1c1c1e] hover:scale-125 transition-transform cursor-pointer z-10" title={`Countdown: ${countdownEvent.title}`} />
                                                )}
                                            </div>
                                            <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-blue-500 transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
                                        </div>
                                        <div className="space-y-1">{renderEventsForDay(dObj)}</div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                ) : viewMode === 'week' ? (
                    <div className="flex flex-col h-full">
                        <div className={`grid grid-cols-7 gap-px rounded-t-2xl overflow-hidden border-b ${isCyberpunk ? 'bg-[#00f0ff]/20 border-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700/50'}`}>
                            {getWeekDays(currentDate).map((d, i) => (
                                <div key={i} className={`p-3 text-center text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm ${isCyberpunk ? 'bg-[#0a0a0a] text-[#00f0ff]/60' : 'bg-gray-50/80 dark:bg-[#252527] text-gray-400 dark:text-gray-500'} ${d.toDateString() === new Date().toDateString() ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400') : ''}`}>
                                    {d.toLocaleDateString('en-US', { weekday: 'short' })} {d.getDate()}
                                </div>
                            ))}
                        </div>
                        <div className={`grid grid-cols-7 gap-px flex-1 rounded-b-2xl overflow-hidden ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-700/50'}`}>
                            {getWeekDays(currentDate).map((d, i) => {
                                const isToday = d.toDateString() === new Date().toDateString();
                                return (
                                    <div 
                                        key={i} 
                                        className={`group p-3 transition-colors duration-200 cursor-pointer border-l border-transparent ${isCyberpunk ? 'bg-[#0a0a0a] hover:bg-[#00f0ff]/5' : 'bg-white dark:bg-[#1c1c1e] hover:bg-gray-50 dark:hover:bg-[#252527]'} ${isToday ? (isCyberpunk ? 'bg-[#00f0ff]/5' : 'bg-blue-50/20 dark:bg-blue-900/5') : ''}`}
                                        onClick={() => handleDayClick(d.toISOString().split('T')[0])}
                                        onDragOver={onCellDragOver}
                                        onDrop={(e) => onCellDrop(e, d.toISOString().split('T')[0])}
                                    >
                                        <div className="space-y-2">{renderEventsForDay(d, 20)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    renderAgendaView()
                )}
                </div>

                {/* Customization Sidebar */}
                <div className={`transition-all duration-300 ease-in-out border-l ${isConfigOpen ? 'w-80 opacity-100' : 'w-0 opacity-0'} overflow-hidden flex flex-col ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className="w-80 flex flex-col h-full">
                        <div className={`px-6 py-4 border-b flex justify-between items-center shrink-0 ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-100 dark:border-gray-700'}`}>
                             <h3 className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Customize</h3>
                             <button onClick={() => setIsConfigOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                        </div>
                        
                        <div className={`flex p-1 mx-6 mt-4 rounded-xl shadow-inner shrink-0 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-900'}`}>
                             {(['view', 'filters', 'connections'] as const).map(tab => (
                                 <button key={tab} onClick={() => setConfigTab(tab)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${configTab === tab ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-sm' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm') : 'text-gray-500 dark:text-gray-400'}`}>{tab}</button>
                             ))}
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                             {configTab === 'view' && (
                                 <div className="space-y-6">
                                     <div>
                                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">View Mode</label>
                                         <div className="grid grid-cols-1 gap-3">
                                             <button onClick={() => setViewMode('month')} className={`p-3 rounded-xl border text-left transition-all ${viewMode === 'month' ? (isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff]' : 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300') : (isCyberpunk ? 'bg-black border-[#00f0ff]/20 text-[#00f0ff]/60' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')}`}>
                                                 <div className="font-bold text-sm mb-1">Month View</div>
                                                 <div className="text-[10px] opacity-70">Traditional grid overview</div>
                                             </button>
                                             <button onClick={() => setViewMode('week')} className={`p-3 rounded-xl border text-left transition-all ${viewMode === 'week' ? (isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff]' : 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300') : (isCyberpunk ? 'bg-black border-[#00f0ff]/20 text-[#00f0ff]/60' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')}`}>
                                                 <div className="font-bold text-sm mb-1">Week View</div>
                                                 <div className="text-[10px] opacity-70">Detailed 7-day focus</div>
                                             </button>
                                             <button onClick={() => setViewMode('agenda')} className={`p-3 rounded-xl border text-left transition-all ${viewMode === 'agenda' ? (isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff]' : 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300') : (isCyberpunk ? 'bg-black border-[#00f0ff]/20 text-[#00f0ff]/60' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')}`}>
                                                 <div className="font-bold text-sm mb-1">Agenda View</div>
                                                 <div className="text-[10px] opacity-70">List of upcoming events</div>
                                             </button>
                                         </div>
                                     </div>
                                     <div>
                                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Start Week On</label>
                                         <div className={`flex p-1 rounded-lg w-full ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                             <button onClick={() => setWeekStartDay(0)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${weekStartDay === 0 ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white dark:bg-gray-700 shadow-sm') : 'text-gray-500'}`}>Sunday</button>
                                             <button onClick={() => setWeekStartDay(1)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${weekStartDay === 1 ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white dark:bg-gray-700 shadow-sm') : 'text-gray-500'}`}>Monday</button>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {configTab === 'filters' && (
                                 <div className="space-y-4">
                                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Event Sources</label>
                                     <div className="space-y-2">
                                         {[
                                             { key: 'studyLogs', label: 'Study Logs', icon: '📚' },
                                             { key: 'personal', label: 'Personal Events', icon: '🗓️' },
                                             { key: 'countdowns', label: 'Countdowns', icon: '⏳' },
                                             { key: 'google', label: 'Google Calendar', icon: '☁️' }
                                         ].map(item => (
                                             <label key={item.key} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20 hover:border-[#00f0ff]/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                                                 <div className="flex items-center gap-3">
                                                     <span className="text-lg">{item.icon}</span>
                                                     <span className={`font-medium text-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-200'}`}>{item.label}</span>
                                                 </div>
                                                 <div className="relative">
                                                     <input type="checkbox" checked={calendars[item.key as keyof typeof calendars]} onChange={() => toggleCalendar(item.key as keyof typeof calendars)} className="sr-only peer" />
                                                     <div className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isCyberpunk ? 'bg-gray-800 border-gray-600 peer-checked:bg-[#00f0ff]' : 'bg-gray-200 dark:bg-gray-700 peer-checked:bg-blue-600'}`}></div>
                                                 </div>
                                             </label>
                                         ))}
                                     </div>

                                     <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Projects</label>
                                         <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                             {projects.map(p => (
                                                 <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                     <div className="flex items-center gap-2 overflow-hidden">
                                                         <div className={`w-3 h-3 rounded-full shrink-0 ${p.theme === 'green' ? 'bg-green-500' : p.theme === 'blue' ? 'bg-blue-500' : p.theme === 'orange' ? 'bg-orange-500' : 'bg-purple-500'}`}></div>
                                                         <span className={`text-sm truncate ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>{p.name}</span>
                                                     </div>
                                                     <input type="checkbox" checked={!hiddenProjectIds.includes(p.id)} onChange={() => toggleProjectVisibility(p.id)} className={`rounded cursor-pointer ${isCyberpunk ? 'bg-black border-[#00f0ff]/50 checked:bg-[#00f0ff]' : 'text-blue-600 focus:ring-blue-500'}`} />
                                                 </div>
                                             ))}
                                             {projects.length === 0 && <p className="text-xs text-gray-400 italic px-2">No projects found.</p>}
                                         </div>
                                     </div>

                                     {calendars.google && googleCalendars.length > 0 && (
                                         <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Google Calendars</label>
                                             <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                 {googleCalendars.map(cal => (
                                                     <div key={cal.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                         <div className="flex items-center gap-2 overflow-hidden">
                                                             <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cal.color }}></div>
                                                             <span className={`text-sm truncate ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>{cal.summary}</span>
                                                         </div>
                                                         <input type="checkbox" checked={cal.visible} onChange={() => toggleGoogleCalendarVisibility(cal.id)} className={`rounded cursor-pointer ${isCyberpunk ? 'bg-black border-[#00f0ff]/50 checked:bg-[#00f0ff]' : 'text-blue-600 focus:ring-blue-500'}`} />
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}

                             {configTab === 'connections' && (
                                 <>
                             <p className={`text-sm mb-4 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-gray-600 dark:text-gray-400'}`}>
                                 To view your Google Calendar events, you need to provide a Google Cloud Client ID.
                                 <br/>
                                 1. Create OAuth 2.0 Client ID (Web Application).<br/>
                                 2. Add <b>{GOOGLE_REDIRECT_URI}</b> to Authorized Redirect URIs.<br/>
                                 3. Paste Client ID and Secret below.
                             </p>
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Client ID</label>
                             <input 
                                type="text" 
                                value={googleClientId}
                                onChange={(e) => setGoogleClientId(e.target.value)}
                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500'}`}
                                placeholder="apps.googleusercontent.com"
                             />
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Client Secret</label>
                             <input 
                                type="password" 
                                value={googleClientSecret}
                                onChange={(e) => setGoogleClientSecret(e.target.value)}
                                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500'}`}
                                placeholder="Client Secret"
                             />

                             {!isConnected && (
                                 <div className="mt-4">
                                     <button onClick={handleGoogleConnect} className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                                         Connect Google Account
                                     </button>
                                 </div>
                                 )}
                                 <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                     <button onClick={handleSaveClientId} className={`px-4 py-2 font-medium rounded-lg text-sm ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Save Credentials</button>
                                 </div>
                                 </>
                             )}
                        </div>
                    </div>
                </div>
             </div>

             {/* Details Modal */}
             {isDetailsOpen && viewEvent && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
                     <div className={`w-full max-w-sm rounded-3xl shadow-2xl border overflow-hidden animate-scale-in flex flex-col ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}>
                         {/* Details Header with dynamic color */}
                         <div className={`p-6 pb-8 ${viewEvent.color} relative border-b ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-100 dark:border-gray-700/50'}`}>
                             <div className="absolute top-4 right-4">
                                 <button onClick={() => setIsDetailsOpen(false)} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-current transition-colors">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                             </div>
                             <div className="mt-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 bg-white/30 backdrop-blur-sm text-current border border-white/20 ${isCyberpunk ? 'text-black' : ''}`}>
                                   {viewEvent.type === 'study' ? 'Study Log' : viewEvent.type === 'countdown' ? (viewEvent.customType || 'Countdown') : (viewEvent.customType || viewEvent.type)}
                                </span>
                                <h3 className="text-2xl font-bold leading-tight opacity-95">{viewEvent.title}</h3>
                             </div>
                         </div>
                         
                         <div className={`p-6 -mt-4 rounded-t-3xl flex-1 ${isCyberpunk ? 'bg-[#0a0a0a]' : 'bg-white dark:bg-[#1c1c1e]'}`}>
                             <div className="space-y-5">
                                 <div className={`flex items-center ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>
                                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                     </div>
                                     <div>
                                         <p className="text-sm font-semibold">{viewEvent.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                         {viewEvent.time && <p className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>{viewEvent.time}</p>}
                                     </div>
                                 </div>

                                 {viewEvent.location && (
                                     <div className={`flex items-center ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>
                                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                         </div>
                                         <p className="text-sm">{viewEvent.location}</p>
                                     </div>
                                 )}

                                 {viewEvent.description && (
                                     <div className={`flex items-start ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>
                                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0 mt-0.5 ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                         </div>
                                         <p className={`text-sm leading-relaxed ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-gray-600 dark:text-gray-400'}`}>{viewEvent.description}</p>
                                     </div>
                                 )}

                                 {viewEvent.link && (
                                     <a href={viewEvent.link} target="_blank" rel="noreferrer" className={`flex items-center hover:underline text-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600'}`}>
                                         <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                         Open in Google Calendar
                                     </a>
                                 )}
                             </div>
                         </div>

                         {/* Footer Actions */}
                         <div className={`p-4 border-t flex justify-end gap-3 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-[#252527] border-gray-100 dark:border-gray-800'}`}>
                             {viewEvent.isCustom ? (
                                 <>
                                     <button 
                                        onClick={handleDeleteEvent}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isCyberpunk ? 'text-red-500 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                     >
                                         Delete
                                     </button>
                                     <button 
                                        onClick={switchToEditMode}
                                        className={`px-6 py-2 rounded-xl text-sm font-bold hover:shadow-lg transition-all ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'}`}
                                     >
                                         Edit Event
                                     </button>
                                 </>
                             ) : (
                                <button 
                                    onClick={() => setIsDetailsOpen(false)}
                                    className={`px-6 py-2 rounded-xl text-sm font-medium transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                                >
                                    Close
                                </button>
                             )}
                         </div>
                     </div>
                 </div>
             )}

             {/* Add/Edit Event Modal */}
             {isModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
                     <div className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-scale-in ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}>
                         {/* ... Edit Form ... */}
                         <div className={`px-6 py-4 border-b flex justify-between items-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-[#252527] border-gray-200 dark:border-gray-700'}`}>
                             <h3 className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{editingId ? 'Edit Event' : 'New Event'}</h3>
                             <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                         <form onSubmit={handleSaveEvent} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                                 <input type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500'}`} placeholder="Event Title" required />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                    <input type="date" value={selectedDateForEvent} onChange={(e) => setSelectedDateForEvent(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff] [color-scheme:dark]' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]'}`} required />
                                 </div>
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Time (Optional)</label>
                                    <input type="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff] [color-scheme:dark]' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]'}`} />
                                 </div>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Color</label>
                                 <div className="flex space-x-2">
                                     {EVENT_COLORS.map(c => (
                                         <button 
                                            key={c.name} 
                                            type="button"
                                            onClick={() => setNewEventColor(c.value)}
                                            className={`w-8 h-8 rounded-full ${c.picker} ${newEventColor === c.value ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : ''}`}
                                            title={c.name}
                                         />
                                     ))}
                                 </div>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Recurrence</label>
                                    <select value={newEventRecurrence} onChange={(e) => setNewEventRecurrence(e.target.value as any)} className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500'}`}>
                                        <option value="none">None</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                 </div>
                                 <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reminder (mins)</label>
                                    <input type="number" value={newEventReminder} onChange={(e) => setNewEventReminder(parseInt(e.target.value))} className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500'}`} placeholder="0" />
                                 </div>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                                 <textarea rows={3} value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500'}`} placeholder="Notes..."></textarea>
                             </div>
                         </form>
                         <div className={`px-6 py-4 border-t flex justify-between ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-[#252527] border-gray-200 dark:border-gray-700'}`}>
                             {editingId ? (
                                 <button onClick={handleDeleteEvent} className="text-red-500 hover:text-red-600 font-medium text-sm">Delete Event</button>
                             ) : <div></div>}
                             <div className="flex space-x-3">
                                 <button onClick={closeModal} className={`px-4 py-2 text-sm font-medium ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>Cancel</button>
                                 <button onClick={handleSaveEvent} className={`px-4 py-2 font-bold rounded-lg text-sm shadow-md ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Save Event</button>
                             </div>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};