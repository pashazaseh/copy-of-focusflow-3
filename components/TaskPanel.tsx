import React, { useState, useEffect, useRef } from 'react';
import * as storage from '../services/storageService';
import { Task, Project, Subtask } from '../types';
import { useTheme, useProjects } from '../AppContext';
import { getTickTickAuthUrl, exchangeCodeForToken, fetchTickTickTasks } from '../services/tickTickService';
import { calculateDailyTickTickProgress } from '../services/gamificationService';
import { DailyProgressBar } from './DailyProgressBar';

interface TaskPanelProps {
    projects: Project[];
}

export const TaskPanel: React.FC<TaskPanelProps> = ({ projects }) => {
    const { appTheme } = useTheme();
    const { currentProjectId } = useProjects();
    const isCyberpunk = appTheme === 'cyberpunk';
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedProject, setSelectedProject] = useState(currentProjectId);
    const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [sortBy, setSortBy] = useState<'default' | 'dueDate'>('default');
    
    // TickTick State
    const [isTickTickModalOpen, setIsTickTickModalOpen] = useState(false);
    const [ttClientId, setTtClientId] = useState(() => localStorage.getItem('ticktick_client_id') || '');
    const [ttClientSecret, setTtClientSecret] = useState(() => localStorage.getItem('ticktick_client_secret') || '');
    const [ttRedirectUri, setTtRedirectUri] = useState(() => {
        const stored = localStorage.getItem('ticktick_redirect_uri');
        if (stored) return stored;
        // Default to custom protocol in Electron, localhost in Web
        return (window.electronAPI) 
            ? 'http://localhost:54321/callback' 
            : (typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost');
    });
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [isCustomizationMenuOpen, setIsCustomizationMenuOpen] = useState(false);
    const [manualAuthCode, setManualAuthCode] = useState('');
    const [draggingTaskIndex, setDraggingTaskIndex] = useState<number | null>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({});

    // Move filtering logic up so it can be used by handlers
    const filteredTasks = tasks.filter(t => {
        if (filterPriority === 'all') return true;
        return t.priority === filterPriority;
    }).sort((a, b) => {
        if (sortBy === 'dueDate') {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
    });

    const activeTasks = filteredTasks.filter(t => !t.isCompleted);
    const completedTasks = filteredTasks.filter(t => t.isCompleted);

    useEffect(() => {
        const loadTasks = () => storage.getTasks().then(setTasks);
        loadTasks();
        window.addEventListener('focusflow-task-update', loadTasks);
        return () => window.removeEventListener('focusflow-task-update', loadTasks);
    }, []);

    useEffect(() => {
        setSelectedProject(currentProjectId);
    }, [currentProjectId]);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            const newTask: Task = {
                id: Date.now().toString(),
                title: newTaskTitle,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                projectId: selectedProject || undefined
            };

            const updated = await storage.saveTask(newTask);
            setTasks(updated);
            setNewTaskTitle('');
            window.dispatchEvent(new Event('focusflow-task-update'));
        } catch (error) {
            console.error("Failed to add task:", error);
            alert("Failed to add task. Please try again.");
        }
    };

    const toggleCompletion = async (task: Task) => {
        const updated = await storage.saveTask({ ...task, isCompleted: !task.isCompleted });
        setTasks(updated);
        window.dispatchEvent(new Event('focusflow-task-update'));
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this task?')) {
            const updated = await storage.deleteTask(id);
            setTasks(updated);
            window.dispatchEvent(new Event('focusflow-task-update'));
        }
    };

    const handleUpdateTaskProject = async (task: Task, projectId: string) => {
        const updated = await storage.saveTask({ ...task, projectId: projectId || undefined });
        setTasks(updated);
        window.dispatchEvent(new Event('focusflow-task-update'));
    };

    const handleTickTickCode = async (code: string, redirectUri: string) => {
        try {
            const tokenData = await exchangeCodeForToken(ttClientId, ttClientSecret, code, redirectUri);
            if (tokenData.access_token) {
                localStorage.setItem('ticktick_access_token', tokenData.access_token);
                const importedTasks = await fetchTickTickTasks(tokenData.access_token);
                
                // Use efficient batch merge
                const { saved, count } = await storage.mergeTasks(importedTasks.map(t => ({
                    ...t,
                    projectId: projects[0]?.id || undefined
                })));
                
                setTasks(saved);
                window.dispatchEvent(new Event('focusflow-task-update'));
                alert(`Successfully synced ${count} tasks from TickTick!`);
            }
        } catch (e: any) {
            console.error(e);
            alert(`Sync failed: ${e.message}`);
        }
    };

    const handleTickTickCodeRef = useRef(handleTickTickCode);
    useEffect(() => { handleTickTickCodeRef.current = handleTickTickCode; }, [handleTickTickCode]);

    // Listen for Deep Link Code (Electron)
    useEffect(() => {
        if (window.electronAPI?.onOAuthCode) {
            return window.electronAPI.onOAuthCode((codeOrUrl) => {
                // Handle both raw code (from local server) and URL (from deep link)
                let code = codeOrUrl;
                
                // If it's a URL, extract the code
                if (codeOrUrl.includes('code=')) {
                    const match = codeOrUrl.match(/code=([^&]+)/);
                    if (match) code = match[1];
                }

                if (code) {
                    // Auto-close modal if open and trigger sync
                    setIsTickTickModalOpen(false);
                    handleTickTickCodeRef.current(code, ttRedirectUri);
                }
            });
        }
    }, []);

    const handleTickTickSync = async () => {
        if (!ttClientId || !ttClientSecret) {
            setIsTickTickModalOpen(true);
            return;
        }

        // 1. Start OAuth Flow
        // In a real electron app, we'd use shell.openExternal and intercept the callback via deep linking.
        // For this web-based/hybrid setup, we might need a manual code copy-paste or a popup.
        // Let's try a popup approach or prompt for the code if the redirect is manual.
        
        const redirectUri = ttRedirectUri;
        const authUrl = getTickTickAuthUrl(ttClientId, redirectUri);
        
        // Open auth window
        window.open(authUrl, '_blank');
        
        // Only prompt if NOT in Electron (Electron uses deep linking)
        if (!window.electronAPI) {
            setIsTickTickModalOpen(true);
        }
    };

    const saveTickTickConfig = () => {
        localStorage.setItem('ticktick_client_id', ttClientId);
        localStorage.setItem('ticktick_client_secret', ttClientSecret);
        localStorage.setItem('ticktick_redirect_uri', ttRedirectUri);
        setIsTickTickModalOpen(false);
        handleTickTickSync();
    };

    const handleManualCodeSubmit = () => {
        if (manualAuthCode.trim()) {
            handleTickTickCode(manualAuthCode.trim(), ttRedirectUri);
            setIsTickTickModalOpen(false);
            setManualAuthCode('');
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggingTaskIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = async () => {
        setDraggingTaskIndex(null);
        await storage.saveTasks(tasks);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggingTaskIndex === null || draggingTaskIndex === index) return;

        // Find the actual tasks in the main list based on the visual activeTasks list
        const draggedTask = activeTasks[draggingTaskIndex];
        const targetTask = activeTasks[index];
        
        if (!draggedTask || !targetTask) return;

        const mainDragIdx = tasks.findIndex(t => t.id === draggedTask.id);
        const mainTargetIdx = tasks.findIndex(t => t.id === targetTask.id);

        if (mainDragIdx === -1 || mainTargetIdx === -1) return;

        const newTasks = [...tasks];
        const [removed] = newTasks.splice(mainDragIdx, 1);
        newTasks.splice(mainTargetIdx, 0, removed);
        
        setTasks(newTasks);
        setDraggingTaskIndex(index);
    };

    const toggleTaskSelection = (id: string) => {
        const newSet = new Set(selectedTaskIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedTaskIds(newSet);
    };

    const handleBulkProjectUpdate = async (projectId: string) => {
        if (selectedTaskIds.size === 0) return;
        const updatedTasks = tasks.map(t => 
            selectedTaskIds.has(t.id) ? { ...t, projectId: projectId || undefined } : t
        );
        await storage.saveTasks(updatedTasks);
        setTasks(updatedTasks);
        setSelectedTaskIds(new Set());
        window.dispatchEvent(new Event('focusflow-task-update'));
    };

    const handleBulkDelete = async () => {
        if (selectedTaskIds.size === 0) return;
        if (confirm(`Delete ${selectedTaskIds.size} tasks?`)) {
            const updatedTasks = tasks.filter(t => !selectedTaskIds.has(t.id));
            await storage.saveTasks(updatedTasks);
            setTasks(updatedTasks);
            setSelectedTaskIds(new Set());
            window.dispatchEvent(new Event('focusflow-task-update'));
        }
    };

    const toggleSelectAll = () => {
        if (selectedTaskIds.size === activeTasks.length && activeTasks.length > 0) {
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(activeTasks.map(t => t.id)));
        }
    };

    const toggleTaskExpansion = (id: string) => {
        const newSet = new Set(expandedTaskIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedTaskIds(newSet);
    };

    const handleAddSubtask = async (e: React.FormEvent, taskId: string) => {
        e.preventDefault();
        const title = subtaskInputs[taskId]?.trim();
        if (!title) return;

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const newSubtask: Subtask = {
            id: Date.now().toString(),
            title,
            isCompleted: false
        };

        const updatedTask = { ...task, subtasks: [...(task.subtasks || []), newSubtask] };
        const updated = await storage.saveTask(updatedTask);
        setTasks(updated);
        setSubtaskInputs(prev => ({ ...prev, [taskId]: '' }));
        window.dispatchEvent(new Event('focusflow-task-update'));
    };

    const toggleSubtaskCompletion = async (taskId: string, subtaskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const updatedSubtasks = (task.subtasks || []).map(st => 
            st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
        );
        
        const updatedTask = { ...task, subtasks: updatedSubtasks };
        const updated = await storage.saveTask(updatedTask);
        setTasks(updated);
        window.dispatchEvent(new Event('focusflow-task-update'));
    };

    const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
        const updatedTask = { ...task, subtasks: updatedSubtasks };
        const updated = await storage.saveTask(updatedTask);
        setTasks(updated);
        window.dispatchEvent(new Event('focusflow-task-update'));
    };
    
    const getPriorityColor = (priority: 'high' | 'medium' | 'low' | undefined) => {
        if (isCyberpunk) {
            switch (priority) {
                case 'high': return 'bg-red-500';
                case 'medium': return 'bg-yellow-500';
                case 'low': return 'bg-blue-500';
                default: return 'bg-transparent';
            }
        } else {
            switch (priority) {
                case 'high': return 'bg-red-500';
                case 'medium': return 'bg-orange-500';
                case 'low': return 'bg-blue-500';
                default: return 'bg-gray-300 dark:bg-gray-700';
            }
        }
    };

    const dailyProgress = calculateDailyTickTickProgress(tasks);
    const hasTickTickTasks = tasks.some(t => !!t.tickTickId);

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-gray-50/50 dark:bg-gray-900'}`}>
            <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
                    
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h2 className={`text-3xl font-black tracking-tight ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-900 dark:text-white'}`}>Tasks</h2>
                            <p className={`text-sm mt-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>Stay focused and organized.</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Filters Group */}
                            <div className={`flex p-1 rounded-xl ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm'}`}>
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer outline-none ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-600 dark:text-gray-300'}`}
                                >
                                    <option value="all">All Priorities</option>
                                    <option value="high">High Priority</option>
                                    <option value="medium">Medium Priority</option>
                                    <option value="low">Low Priority</option>
                                </select>
                                <div className={`w-px my-1 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer outline-none ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-600 dark:text-gray-300'}`}
                                >
                                    <option value="default">Default Sort</option>
                                    <option value="dueDate">Sort by Date</option>
                                </select>
                            </div>

                            {/* Actions Group */}
                            <div className="flex gap-2">
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsCustomizationMenuOpen(prev => !prev)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff]/20' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </button>
                                    {isCustomizationMenuOpen && (
                                        <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 z-20 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
                                            <a
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setIsSelectMode(!isSelectMode);
                                                    setIsCustomizationMenuOpen(false);
                                                    if (isSelectMode) { // If turning off, clear selection
                                                        setSelectedTaskIds(new Set());
                                                    }
                                                }}
                                                className={`block px-4 py-2 text-sm ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                {isSelectMode ? 'Cancel Batch Edit' : 'Batch Edit'}
                                            </a>
                                            {isSelectMode && (
                                                 <a
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        toggleSelectAll();
                                                    }}
                                                    className={`block px-4 py-2 text-sm ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                >
                                                    {selectedTaskIds.size === activeTasks.length && activeTasks.length > 0 ? 'Deselect All' : 'Select All'}
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleTickTickSync} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Sync TickTick
                                </button>
                            </div>
                        </div>
                    </div>

                    {hasTickTickTasks && <DailyProgressBar progress={dailyProgress} />}

                    {/* Add Task Form - Redesigned */}
                    <form onSubmit={handleAddTask} className={`group relative p-1.5 rounded-2xl border shadow-sm transition-all focus-within:shadow-md focus-within:scale-[1.01] focus-within:ring-2 focus-within:ring-blue-500 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 focus-within:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus-within:border-blue-500/50'}`}>
                        <div className="flex items-center gap-2">
                            <div className={`pl-3 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </div>
                            <input 
                                type="text" 
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="Add a new task..."
                                className={`flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 ${isCyberpunk ? 'text-[#00f0ff] placeholder-[#00f0ff]/30' : 'text-gray-900 dark:text-white placeholder-gray-400'}`}
                            />
                            <div className="flex items-center gap-2 pr-2">
                                <select 
                                    value={selectedProject} 
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                    className={`text-xs rounded-lg px-3 py-1.5 border-none focus:ring-0 cursor-pointer transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                >
                                    <option value="">No Project</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <button 
                                    type="submit"
                                    disabled={!newTaskTitle.trim()}
                                    className={`p-2 rounded-xl transition-all ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 disabled:opacity-50' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm'}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Active Tasks */}
                    <div className="space-y-3">
                        {activeTasks.length === 0 && (
                            <div className={`text-center py-16 rounded-3xl border border-dashed ${isCyberpunk ? 'border-[#00f0ff]/20 bg-[#00f0ff]/5' : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30'}`}>
                                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className={`text-sm font-medium ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>All caught up! No active tasks.</p>
                            </div>
                        )}
                        {activeTasks.map((task, index) => {
                            return (
                                <div
                                    key={task.id}
                                    draggable={sortBy === 'default'}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`relative group rounded-2xl border transition-all duration-200 overflow-hidden ${isCyberpunk ? 'bg-gradient-to-b from-[#0c0c0c] to-[#0a0a0a] border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)] hover:shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-gradient-to-b from-white to-gray-50/80 border-gray-200/80 dark:border-[rgba(255,255,255,0.05)] dark:from-[#1a1a1a] dark:to-[#161616] hover:border-blue-300 dark:hover:border-[rgba(255,255,255,0.1)] hover:shadow-md hover:shadow-blue-500/10 dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.3)]'} ${draggingTaskIndex === index ? 'opacity-50 scale-95' : ''}`}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPriorityColor(task.priority)}`}></div>
                                    <div className="flex items-center p-3 pl-4">
                                    {/* Drag Handle */}
                                    {sortBy === 'default' && (
                                        <div className={`mr-3 cursor-move opacity-0 group-hover:opacity-100 transition-opacity ${isCyberpunk ? 'text-white/40' : 'text-gray-300 dark:text-gray-600'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                        </div>
                                    )}



                                    {/* Completion Circle */}
                                    <button 
                                        onClick={() => toggleCompletion(task)}
                                        className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-all ${isCyberpunk ? 'border-white/80 hover:bg-white/10' : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                                    >
                                    </button>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm font-medium transition-all ${isCyberpunk ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{task.title}</p>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-3">
                                                {/* Project Badge */}
                                                <div className="relative group/proj">
                                                    <select
                                                        value={task.projectId || ''}
                                                        onChange={(e) => handleUpdateTaskProject(task, e.target.value)}
                                                        className={`text-xs pl-2 pr-1 py-0.5 rounded-md cursor-pointer border-none focus:ring-0 max-w-[120px] truncate appearance-none font-normal ${isCyberpunk ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <option value="">No Project</option>
                                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>

                                                {/* Tags */}
                                                {task.tags && task.tags.map(tag => (
                                                    <span key={tag} className={`text-xs px-2 py-0.5 rounded-full border ${isCyberpunk ? 'border-white/20 text-white/50' : 'border-gray-300/50 text-gray-500'}`}>
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Due Date & Reminder */}
                                            {task.dueDate && (() => {
                                                const dueDate = new Date(task.dueDate);
                                                const isPast = dueDate < new Date() && !task.isCompleted;
                                                
                                                const isToday = dueDate.toDateString() === new Date().toDateString();
                                                
                                                // Check if time is specified (not midnight)
                                                const hasTime = dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0;

                                                let dateText = isToday ? 'Today' : dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                let timeText = hasTime ? dueDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

                                                return (
                                                    <span className={`text-xs flex items-center gap-1.5 ${
                                                        isPast 
                                                        ? 'text-red-500 font-medium' 
                                                        : (isCyberpunk ? 'text-white/50' : 'text-gray-400 dark:text-gray-500')
                                                    }`}>
                                                        {timeText && (
                                                            <>
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                <span>{timeText}</span>
                                                            </>
                                                        )}
                                                        {!timeText && (
                                                             <>
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                <span>{dateText}</span>
                                                             </>
                                                        )}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                    </div>

                                    {/* Actions & Expand */}
                                    <div className="flex items-center gap-1">
                                        <div className={`transition-all duration-300 ${isSelectMode ? 'opacity-100' : 'opacity-0'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedTaskIds.has(task.id)} 
                                                onChange={() => toggleTaskSelection(task.id)}
                                                className={`w-4 h-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${isCyberpunk ? 'bg-black border-white/30 checked:bg-blue-500 checked:border-blue-500' : 'dark:bg-gray-700 dark:border-gray-600'}`}
                                            />
                                        </div>
                                        <button onClick={() => toggleTaskExpansion(task.id)} className={`p-2 rounded-lg transition-all ${isCyberpunk ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
                                            <svg className={`w-4 h-4 transition-transform ${expandedTaskIds.has(task.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        <button onClick={() => handleDelete(task.id)} className={`opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all ${isCyberpunk ? 'text-white/40 hover:text-red-500 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Completed Tasks */}
                    {completedTasks.length > 0 && (
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                            <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'}`}>Completed ({completedTasks.length})</h3>
                            <div className="space-y-2">
                                {completedTasks.map(task => (
                                    <div key={task.id} className={`flex items-center p-3 rounded-xl border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/10' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'}`}>
                                        <button 
                                            onClick={() => toggleCompletion(task)}
                                            className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-colors ${isCyberpunk ? 'bg-[#00f0ff] border-[#00f0ff] text-black' : 'bg-blue-500 border-blue-500 text-white'}`}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        </button>
                                        <span className={`text-sm line-through transition-all opacity-40 ${isCyberpunk ? 'text-[#00f0ff]/50' : 'text-gray-500'}`}>{task.title}</span>
                                        <button onClick={() => handleDelete(task.id)} className="ml-auto text-gray-400 hover:text-red-500 transition-all p-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TickTick Config Modal */}
            {isTickTickModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}>
                        <h3 className={`text-xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>TickTick Setup</h3>
                        <p className="text-xs text-gray-500 mb-4">Enter your TickTick App credentials. You can create one at developer.ticktick.com.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client ID</label>
                                <input type="text" value={ttClientId} onChange={e => setTtClientId(e.target.value)} className={`w-full px-3 py-2 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client Secret</label>
                                <input type="password" value={ttClientSecret} onChange={e => setTtClientSecret(e.target.value)} className={`w-full px-3 py-2 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Redirect URI</label>
                                <input type="text" value={ttRedirectUri} onChange={e => setTtRedirectUri(e.target.value)} placeholder={window.electronAPI ? "http://localhost:54321/callback" : "http://localhost"} className={`w-full px-3 py-2 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`} />
                            </div>
                            
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><div className={`w-full border-t ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-200 dark:border-gray-700'}`}></div></div>
                                <div className="relative flex justify-center text-xs"><span className={`px-2 ${isCyberpunk ? 'bg-black text-[#00f0ff]/60' : 'bg-white dark:bg-[#1c1c1e] text-gray-500'}`}>OR PASTE CODE</span></div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Manual Auth Code</label>
                                <div className="flex gap-2">
                                    <input type="text" value={manualAuthCode} onChange={e => setManualAuthCode(e.target.value)} placeholder="Paste code here..." className={`flex-1 px-3 py-2 rounded-lg border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`} />
                                    <button 
                                        onClick={handleManualCodeSubmit}
                                        disabled={!manualAuthCode}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                                    >
                                        Submit
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsTickTickModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                                <button onClick={saveTickTickConfig} className={`px-4 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-blue-600 text-white'}`}>Save & Sync</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedTaskIds.size > 0 && (
                <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-4 z-50 animate-fade-in-up ${isCyberpunk ? 'bg-black border-[#00f0ff] text-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`}>
                    <span className="text-sm font-bold whitespace-nowrap">{selectedTaskIds.size} Selected</span>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-700"></div>
                    <select 
                        onChange={(e) => handleBulkProjectUpdate(e.target.value)}
                        value=""
                        className={`text-xs rounded-lg px-3 py-1.5 border-none focus:ring-0 cursor-pointer ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-gray-700'}`}
                    >
                        <option value="" disabled>Move to Project...</option>
                        <option value="">No Project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={handleBulkDelete} className="text-xs text-red-500 hover:text-red-600 font-bold ml-4">Delete</button>
                    <button onClick={() => setSelectedTaskIds(new Set())} className="text-xs hover:underline opacity-60 ml-2">Cancel</button>
                </div>
            )}
        </div>
    );
};
