import React, { useState, useEffect, useRef } from 'react';
import { CountdownItem, CountdownType, CountdownGroup, Project } from '../types';
import * as storage from '../services/storageService';
import { useCountdowns, useProjects } from '../AppContext';
import { useTheme } from '../AppContext';

const ICONS: Record<CountdownType, React.ReactNode> = {
    countdown: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    anniversary: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    birthday: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>,
    holiday: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
};

const COLORS: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
};

type ViewStatus = 'active' | 'archived';

export const CountdownPanel: React.FC = () => {
    const { appTheme } = useTheme();
    const isCyberpunk = appTheme === 'cyberpunk';

    const { countdowns, saveCountdown, deleteCountdown } = useCountdowns();
    const { projects } = useProjects();
    const [groups, setGroups] = useState<CountdownGroup[]>([]);
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
    const [isImportChoiceOpen, setIsImportChoiceOpen] = useState(false); // New import menu
    const [viewStatus, setViewStatus] = useState<ViewStatus>('active');
    const [activeGroupFilter, setActiveGroupFilter] = useState<string>('all');
    const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all'); // New Type Filter
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [isGroupsVisible, setIsGroupsVisible] = useState(true); // Default visible
    
    // Item Form State
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [type, setType] = useState<CountdownType>('countdown');
    const [recurrence, setRecurrence] = useState<CountdownItem['recurrence']>('none');
    const [selectedGroupId, setSelectedGroupId] = useState('general');
    const [selectedProjectId, setSelectedProjectId] = useState('');

    // Group Management State
    const [newGroupName, setNewGroupName] = useState('');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [draggingGroupIndex, setDraggingGroupIndex] = useState<number | null>(null);

    // Google Calendar State
    const [googleClientId, setGoogleClientId] = useState('');
    const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
    const [, setTick] = useState(0); // Force re-render for timer

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const headerMenuRef = useRef<HTMLDivElement>(null);
    const importMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        storage.getCountdownGroups().then(setGroups);
        
        const storedClientId = localStorage.getItem('google_client_id');
        if (storedClientId) setGoogleClientId(storedClientId);

        const interval = setInterval(() => {
            setTick(t => t + 1); // Efficient re-render
        }, 60000);

        const handleClickOutside = (event: MouseEvent) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
                setIsHeaderMenuOpen(false);
            }
            if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
                setIsImportChoiceOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const calculateDiff = (targetDate: string, recurrenceRule: CountdownItem['recurrence'] = 'none') => {
        const now = new Date();
        now.setHours(0,0,0,0);
        let target = new Date(targetDate);
        target.setHours(0,0,0,0);
        
        if (recurrenceRule && recurrenceRule !== 'none' && target.getTime() < now.getTime()) {
            if (recurrenceRule === 'yearly') {
                target.setFullYear(now.getFullYear());
                if (target.getTime() < now.getTime()) target.setFullYear(now.getFullYear() + 1);
            } else if (recurrenceRule === 'monthly') {
                target.setMonth(now.getMonth());
                if (target.getTime() < now.getTime()) target.setMonth(now.getMonth() + 1);
            } else if (recurrenceRule === 'weekly') {
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                const diff = now.getTime() - target.getTime();
                const weeksToAdd = Math.ceil(diff / oneWeek);
                target = new Date(target.getTime() + weeksToAdd * oneWeek);
            } else if (recurrenceRule === 'daily') {
                target = new Date(now);
            }
        }

        const diff = target.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return { days: Math.abs(days), isFuture: days >= 0, displayDate: target };
    };

    const handleSave = async () => {
        if (!title || !date) return;
        
        let color = 'blue';
        if (type === 'birthday') color = 'orange';
        if (type === 'anniversary') color = 'pink';
        if (type === 'holiday') color = 'green';

        const item: CountdownItem = {
            id: editId || Date.now().toString(),
            title,
            date,
            type,
            color,
            isArchived: editId ? countdowns.find(c => c.id === editId)?.isArchived : false,
            recurrence,
            groupId: selectedGroupId,
            projectId: selectedProjectId
        };
        
        await saveCountdown(item);
        closeModal();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Permanently delete this countdown?')) {
            await deleteCountdown(id);
        }
    };

    const toggleArchive = async (id: string, archive: boolean) => {
        const item = countdowns.find(c => c.id === id);
        if (item) {
            const updatedItem = { ...item, isArchived: archive };
            await saveCountdown(updatedItem);
        }
    };

    // --- Import Logic ---
    const triggerCSVImport = () => {
        setIsImportChoiceOpen(false);
        fileInputRef.current?.click();
    };

    const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                const result = await storage.importCountdownsFromCSV(content);
                if (result.success) {
                    alert(result.message);
                } else {
                    alert(`Import Failed: ${result.message}`);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const triggerGoogleSync = () => {
        setIsImportChoiceOpen(false);
        if (!googleClientId) {
            alert("Please set your Google Client ID in Settings first.");
            return;
        }
        
        if (typeof (window as any).google === 'undefined') {
            alert("Google Services are not loaded. Please check your internet connection.");
            return;
        }

        setIsSyncingGoogle(true);
        const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'https://www.googleapis.com/auth/calendar',
            callback: (resp: any) => {
                if (resp.access_token) {
                    importFromGoogle(resp.access_token);
                } else {
                    setIsSyncingGoogle(false);
                    console.error("OAuth error:", resp);
                }
            },
        });
        client.requestAccessToken();
    };

    const importFromGoogle = async (accessToken: string) => {
        try {
            // Fetch Primary Calendar
            const now = new Date();
            const nextYear = new Date();
            nextYear.setFullYear(now.getFullYear() + 1);
            
            // Try fetching "Holidays" or similar
            const res = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${nextYear.toISOString()}&singleEvents=true&orderBy=startTime`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            
            if (!res.ok) throw new Error("Failed to fetch Google Calendar events");
            
            const data = await res.json();
            let count = 0;
            if (data.items) {
                for (const evt of data.items) {
                    if (evt.start?.date) {
                        const item = {
                            id: Date.now().toString() + Math.random().toString().slice(2,6),
                            title: evt.summary,
                            date: evt.start.date,
                            type: 'countdown', // Default
                            color: 'blue',
                            groupId: 'general'
                        };
                        count++;
                        await saveCountdown(item as any);
                    }
                }
                alert(`Imported ${count} events.`);
            }
        } catch (e) {
            console.error(e);
            alert("Sync failed. Check console for details.");
        } finally {
            setIsSyncingGoogle(false);
        }
    };

    // --- Group Management (Enhanced) ---
    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return;
        const newGroup: CountdownGroup = {
            id: Date.now().toString(),
            name: newGroupName.trim(),
            color: 'blue'
        };
        const updated = await storage.saveCountdownGroup(newGroup);
        setGroups(updated);
        setNewGroupName('');
    };

    const handleDeleteGroup = async (id: string) => {
        if (id === 'general') return; 
        if (confirm('Delete this group? Items will be moved to General.')) {
            const affectedItems = countdowns.filter(c => c.groupId === id);
            for (const item of affectedItems) {
                await saveCountdown({ ...item, groupId: 'general' });
            }
            
            const updated = await storage.deleteCountdownGroup(id);
            setGroups(updated);
            if (activeGroupFilter === id) setActiveGroupFilter('all');
        }
    };

    const startEditingGroup = async (group: CountdownGroup) => {
        setEditingGroupId(group.id);
        setEditingGroupName(group.name);
    };

    const saveGroupEdit = async () => {
        if (editingGroupId && editingGroupName.trim()) {
            const group = groups.find(g => g.id === editingGroupId);
            if (group) {
                await storage.saveCountdownGroup({ ...group, name: editingGroupName.trim() });
                setGroups(await storage.getCountdownGroups());
            }
        }
        setEditingGroupId(null);
        setEditingGroupName('');
    };

    const handleGroupDragStart = (e: React.DragEvent, index: number) => {
        setDraggingGroupIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleGroupDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggingGroupIndex === null || draggingGroupIndex === index) return;
        
        const newGroups = [...groups];
        const dragged = newGroups[draggingGroupIndex];
        newGroups.splice(draggingGroupIndex, 1);
        newGroups.splice(index, 0, dragged);
        
        setGroups(newGroups);
        setDraggingGroupIndex(index);
    };

    const handleGroupDragEnd = async () => {
        await storage.saveCountdownGroups(groups);
        setDraggingGroupIndex(null);
    };

    const openModal = (item?: CountdownItem) => {
        if (item) {
            setEditId(item.id);
            setTitle(item.title);
            setDate(item.date);
            setType(item.type);
            setRecurrence(item.recurrence || 'none');
            setSelectedGroupId(item.groupId || 'general');
            setSelectedProjectId(item.projectId || '');
        } else {
            setEditId(null);
            setTitle('');
            setDate('');
            setType('countdown');
            setRecurrence('none');
            setSelectedGroupId(activeGroupFilter === 'all' ? 'general' : activeGroupFilter);
            setSelectedProjectId('');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditId(null);
    };

    // --- Filtering ---
    const filteredCountdowns = countdowns.filter(item => {
        const matchesStatus = viewStatus === 'active' ? !item.isArchived : item.isArchived;
        const matchesGroup = activeGroupFilter === 'all' || (item.groupId || 'general') === activeGroupFilter;
        const matchesType = activeTypeFilter === 'all' || item.type === activeTypeFilter;
        return matchesStatus && matchesGroup && matchesType;
    });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 relative">
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">
                    
                    {/* Header Block */}
                    <div className="flex flex-col space-y-6 mb-4">
                        
                        {/* Row 1: Title (Left) & Actions (Right) */}
                        <div className="flex justify-between items-center w-full">
                            
                            {/* Title + View Switcher */}
                            <div className="relative group cursor-pointer shrink-0 z-20" onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}>
                                <h1 className={`text-3xl font-black tracking-tight flex items-center gap-3 ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-900 dark:text-white'}`}>
                                    Countdown
                                    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isHeaderMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                </h1>
                                {isHeaderMenuOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-[#2c2c2e] rounded-xl shadow-xl border border-gray-700 py-1 z-30 animate-fade-in-up">
                                        <button onClick={() => { setViewStatus('active'); setIsHeaderMenuOpen(false); }} className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors"><span>Active</span>{viewStatus === 'active' && <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}</button>
                                        <button onClick={() => { setViewStatus('archived'); setIsHeaderMenuOpen(false); }} className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors"><span>Archived</span>{viewStatus === 'archived' && <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}</button>
                                    </div>
                                )}
                            </div>

                            {/* Actions Buttons (Resized & Consistent) */}
                            <div className="flex items-center gap-3 z-20">
                                {/* Import Button */}
                                <div className="relative" ref={importMenuRef}>
                                    <button 
                                        onClick={() => setIsImportChoiceOpen(!isImportChoiceOpen)}
                                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm h-9 min-w-[100px] ${isCyberpunk ? 'bg-[#ff9900]/10 text-[#ff9900] border border-[#ff9900]/30 hover:bg-[#ff9900]/20' : 'bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20'}`}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4V4" /></svg>
                                        Import
                                    </button>
                                    {isImportChoiceOpen && (
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-[#2c2c2e] rounded-xl shadow-xl border border-gray-700 py-1 z-30 animate-fade-in-up origin-top-right">
                                            <button onClick={triggerCSVImport} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                                From CSV File
                                            </button>
                                            <button onClick={triggerGoogleSync} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-between">
                                                <span>From Google Calendar</span>
                                                {isSyncingGoogle && <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full ml-2"></div>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleCSVFileChange} accept=".csv" className="hidden" />

                                {/* Hide Group Button */}
                                <button 
                                    onClick={() => setIsGroupsVisible(!isGroupsVisible)}
                                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm h-9 min-w-[80px] ${
                                        !isGroupsVisible 
                                        ? (isCyberpunk ? 'bg-[#0a0a0a] text-[#00f0ff]/40 border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700')
                                        : (isCyberpunk ? 'bg-black text-[#00f0ff] border-[#00f0ff]/30 hover:bg-[#00f0ff]/10' : 'bg-white dark:bg-[#1c1c1e] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800')
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                    {isGroupsVisible ? 'Hide' : 'Show'}
                                </button>

                                {/* Add Button */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openModal(); }}
                                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg text-xs font-bold h-9 min-w-[80px] ${isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-white dark:bg-white text-gray-900 dark:text-gray-900'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Row 2: Central Filter Block (Stacked) */}
                        <div className="flex justify-center w-full animate-fade-in-down origin-top">
                            <div className="flex flex-col items-center gap-2">
                                {/* Type Filters */}
                                {isGroupsVisible && (
                                    <div className={`flex items-center p-1 rounded-xl border shadow-sm overflow-x-auto no-scrollbar transition-all duration-300 ${isCyberpunk ? 'bg-black/40 border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-[#151516] border-gray-200 dark:border-gray-800'}`}>
                                        {['all', 'countdown', 'anniversary', 'birthday', 'holiday'].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setActiveTypeFilter(t)}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all duration-300 whitespace-nowrap ${
                                                    activeTypeFilter === t 
                                                    ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-[#00f0ff]/50 animate-pulse' : 'bg-blue-600 text-white shadow-md shadow-blue-500/20')
                                                    : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/5' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5')
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Group Filters (Stacked Below) */}
                                {isGroupsVisible && (
                                    <div className={`inline-flex items-center p-1.5 rounded-2xl border shadow-sm overflow-x-auto custom-scrollbar max-w-full ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gradient-to-r from-gray-100 to-gray-50 dark:from-[#151516] dark:to-[#1c1c1e] border-gray-200 dark:border-gray-800/50'}`}>
                                        <button 
                                            onClick={() => setActiveGroupFilter('all')} 
                                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap mr-1 ${
                                                activeGroupFilter === 'all' 
                                                ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-blue-600 text-white shadow-md shadow-blue-500/20')
                                                : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-white dark:hover:bg-white/5')
                                            }`}
                                        >
                                            All
                                        </button>
                                        
                                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-2 shrink-0"></div>

                                        <div className="flex items-center gap-1">
                                            {groups.map((g) => (
                                                <button 
                                                    key={g.id} 
                                                    onClick={() => setActiveGroupFilter(g.id)} 
                                                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                                        activeGroupFilter === g.id 
                                                        ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-blue-600 text-white shadow-md shadow-blue-500/20')
                                                        : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-white dark:hover:bg-white/5')
                                                    }`}
                                                >
                                                    {g.name}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-2 shrink-0"></div>

                                        <button 
                                            onClick={() => setIsGroupManagerOpen(true)} 
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                            Manage
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                        {filteredCountdowns.length === 0 ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-300 dark:text-gray-600">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No {viewStatus} items found</p>
                                <p className="text-gray-400 dark:text-gray-600 text-sm mt-1">Try adjusting your filters or add a new countdown</p>
                            </div>
                        ) : (
                            filteredCountdowns.map((item) => {
                                const { days, isFuture, displayDate } = calculateDiff(item.date, item.recurrence);
                                const dateString = displayDate.toLocaleDateString('en-GB'); 
                                const linkedProject = projects.find(p => p.id === item.projectId);
                                
                                return (
                                    <div key={item.id} className={`relative group rounded-3xl p-8 border shadow-sm flex flex-col items-center justify-center text-center min-h-[240px] transition-all duration-300 hover:-translate-y-1 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 hover:border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-[#151516] border-gray-200 dark:border-gray-800 hover:shadow-xl dark:shadow-none hover:border-blue-200 dark:hover:border-gray-700'}`}>
                                        <div className="flex flex-col items-center mb-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`p-2 rounded-xl shadow-sm ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : (COLORS[item.color] || COLORS.blue)}`}>{ICONS[item.type]}</div>
                                                <span className={`text-lg font-bold truncate max-w-[180px] ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-gray-200'}`}>{item.title}</span>
                                            </div>
                                            {linkedProject && (
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-800 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                                                    {linkedProject.name}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="relative mb-6">
                                            <div className={`text-7xl font-black tracking-tighter drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400'}`}>
                                                {days}
                                            </div>
                                            <div className="text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mt-1">Days Left</div>
                                        </div>

                                        <div className={`text-sm font-medium flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isCyberpunk ? 'bg-[#00f0ff]/5 border-[#00f0ff]/20 text-[#00f0ff]/70' : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5'}`}>
                                            <span>{dateString}</span>
                                            {item.recurrence && item.recurrence !== 'none' && (
                                                <>
                                                    <span className={`w-1 h-1 rounded-full ${isCyberpunk ? 'bg-[#00f0ff]/50' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                                                    <span className={`capitalize text-xs ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-500 dark:text-blue-400'}`}>{item.recurrence}</span>
                                                </>
                                            )}
                                        </div>

                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1 transform translate-x-2 group-hover:translate-x-0">
                                            <button onClick={(e) => { e.stopPropagation(); openModal(item); }} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                            <button onClick={(e) => { e.stopPropagation(); toggleArchive(item.id, !item.isArchived); }} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">{item.isArchived ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Group Manager Modal (Enhanced) */}
            {isGroupManagerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className={`rounded-3xl w-[400px] shadow-2xl border overflow-hidden animate-scale-in p-6 ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-white dark:bg-[#151516] border-gray-200 dark:border-gray-700/50'}`}>
                        <h3 className={`font-bold text-xl mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Manage Groups</h3>
                        
                        {/* Add New Group */}
                        <div className="flex gap-2 mb-6">
                            <input 
                                type="text" 
                                value={newGroupName} 
                                onChange={e => setNewGroupName(e.target.value)} 
                                placeholder="New Group Name" 
                                className={`flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-[#2c2c2e] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`}
                            />
                            <button onClick={handleAddGroup} className={`px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'}`}>Add</button>
                        </div>

                        {/* List Groups */}
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                            {groups.map((g, index) => (
                                <div 
                                    key={g.id} 
                                    draggable
                                    onDragStart={(e) => handleGroupDragStart(e, index)}
                                    onDragOver={(e) => handleGroupDragOver(e, index)}
                                    onDragEnd={handleGroupDragEnd}
                                    className={`flex justify-between items-center p-3 rounded-xl border transition-colors group ${isCyberpunk ? 'bg-[#0a0a0a] border-transparent hover:border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-[#2c2c2e] border-transparent hover:border-gray-200 dark:hover:border-gray-600'} ${draggingGroupIndex === index ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                        </div>
                                        {editingGroupId === g.id ? (
                                            <input 
                                                autoFocus
                                                type="text" 
                                                value={editingGroupName}
                                                onChange={e => setEditingGroupName(e.target.value)}
                                                onBlur={saveGroupEdit}
                                                onKeyDown={e => e.key === 'Enter' && saveGroupEdit()}
                                                className={`text-sm px-2 py-1 rounded w-full border focus:outline-none shadow-sm ${isCyberpunk ? 'bg-black text-[#00f0ff] border-[#00f0ff]' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-blue-500'}`}
                                            />
                                        ) : (
                                            <span className={`text-sm font-medium ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-200'}`}>{g.name}</span>
                                        )}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {editingGroupId !== g.id && (
                                            <button onClick={() => startEditingGroup(g)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                        )}
                                        {g.id !== 'general' && (
                                            <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={`mt-6 pt-4 border-t flex justify-end ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-100 dark:border-gray-700/50'}`}>
                            <button onClick={() => setIsGroupManagerOpen(false)} className={`px-5 py-2 text-sm font-medium transition-colors ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Edit Modal (Redesigned) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`rounded-3xl w-full max-w-md border shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-white dark:bg-[#151516] border-gray-200 dark:border-gray-700/50'}`}>
                        <div className={`px-6 py-5 border-b flex justify-between items-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-[#1c1c1e] border-gray-100 dark:border-gray-800'}`}>
                            <h3 className={`font-bold text-lg ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{editId ? 'Edit Countdown' : 'New Countdown'}</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 pl-1">Title</label>
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Year's Day" className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 text-sm transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff] placeholder-[#00f0ff]/30' : 'bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 placeholder-gray-400'}`} />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 pl-1">Date</label>
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 text-sm transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff] [color-scheme:dark]' : 'bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]'}`} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1">Type</label>
                                <div className={`grid grid-cols-2 gap-3 border-t border-b border-dashed py-4 ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-200 dark:border-gray-700/50'}`}>
                                    {(Object.keys(ICONS) as CountdownType[]).map((t) => (
                                        <button key={t} onClick={() => setType(t)} className={`flex items-center space-x-3 p-3 rounded-xl border transition-all text-left group ${type === t ? (isCyberpunk ? 'border-[#00f0ff] bg-[#00f0ff]/10 ring-1 ring-[#00f0ff]' : 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500') : (isCyberpunk ? 'border-[#00f0ff]/20 bg-[#0a0a0a] hover:bg-[#00f0ff]/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2c2c2e] hover:bg-white dark:hover:bg-[#3a3a3c]')}`}>
                                            <div className={`p-1.5 rounded-lg shadow-sm ${type === t ? (isCyberpunk ? 'text-[#00f0ff] bg-black' : 'text-blue-600 dark:text-blue-400 bg-white dark:bg-black/20') : 'text-gray-400 dark:text-gray-500 bg-white dark:bg-black/20'}`}>{ICONS[t]}</div>
                                            <span className={`text-sm font-bold ${type === t ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-700 dark:text-white') : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                             <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 pl-1">Recurrence</label>
                                <div className="relative">
                                    <select value={recurrence || 'none'} onChange={(e) => setRecurrence(e.target.value as any)} className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 appearance-none text-sm transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`}>
                                        <option value="none">None</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 pl-1">Group</label>
                                    <div className="relative">
                                        <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 appearance-none text-sm transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`}>
                                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 pl-1">Link Project</label>
                                    <div className="relative">
                                        <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 appearance-none text-sm transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`}>
                                            <option value="">None</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={`p-6 border-t flex justify-end space-x-3 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-[#1c1c1e] border-gray-100 dark:border-gray-800'}`}>
                            <button onClick={closeModal} className={`px-6 py-3 rounded-xl text-sm font-bold transition-colors ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'}`}>Cancel</button>
                            <button onClick={handleSave} className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all transform active:scale-95 ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}>Save Event</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};