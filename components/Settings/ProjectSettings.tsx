import React, { useState, useMemo } from 'react';
import { Project, HeatmapTheme, AppTheme } from '../../types';

interface ProjectSettingsProps {
    projects: Project[];
    onCreateProject: (name: string, theme: HeatmapTheme) => void;
    onDeleteProject: (id: string) => void;
    onUpdateProjects: (projects: Project[]) => void;
    appTheme: AppTheme;
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({
    projects,
    onCreateProject,
    onDeleteProject,
    onUpdateProjects,
    appTheme
}) => {
    const isCyberpunk = appTheme === 'cyberpunk';
    const [managerTab, setManagerTab] = useState<'active' | 'archived'>('active');
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editTheme, setEditTheme] = useState<HeatmapTheme>('green');
    const [editGoal, setEditGoal] = useState<number>(0);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectTheme, setNewProjectTheme] = useState<HeatmapTheme>('green');

    const displayedManagerProjects = useMemo(() => {
        const list = managerTab === 'active'
            ? projects.filter(p => !p.isArchived)
            : projects.filter(p => p.isArchived);
        return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }, [projects, managerTab]);

    const moveProject = (index: number, direction: 'up' | 'down') => {
        const newList = [...displayedManagerProjects];
        if (direction === 'up' && index > 0) {
            [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
        } else if (direction === 'down' && index < newList.length - 1) {
            [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
        } else {
            return;
        }
        const updates = new Map(newList.map((p, i) => [p.id, i]));
        const newProjects = projects.map(p => {
            if (updates.has(p.id)) {
                return { ...p, sortOrder: updates.get(p.id)! };
            }
            return p;
        });
        newProjects.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        onUpdateProjects(newProjects);
    };

    const startEditingProject = (p: Project) => {
        setEditingProjectId(p.id);
        setEditName(p.name);
        setEditTheme(p.theme);
        setEditGoal(p.weeklyGoal || 0);
    };

    const saveProjectEdit = () => {
        if (editingProjectId) {
            const newProjects = projects.map(p => {
                if (p.id === editingProjectId) {
                    return { ...p, name: editName, theme: editTheme, weeklyGoal: editGoal > 0 ? editGoal : undefined };
                }
                return p;
            });
            onUpdateProjects(newProjects);
            setEditingProjectId(null);
        }
    };

    const toggleProjectArchive = (id: string) => {
        const newProjects = projects.map(p => {
            if (p.id === id) return { ...p, isArchived: !p.isArchived };
            return p;
        });
        onUpdateProjects(newProjects);
    };

    const handleCreateNewProject = () => {
        if (!newProjectName.trim()) return;
        onCreateProject(newProjectName, newProjectTheme);
        setNewProjectName('');
        setIsCreatingProject(false);
    };

    return (
        <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm min-h-[500px] flex flex-col`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Project Manager</h3>
                <div className={`flex p-1 rounded-xl transition-all duration-300 ${isCyberpunk ? 'bg-black/40 border border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <button onClick={() => setManagerTab('active')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${managerTab === 'active' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-[#00f0ff]/50 animate-pulse' : 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/5' : 'text-gray-500 dark:text-gray-400')}`}>
                        Active
                    </button>
                    <button onClick={() => setManagerTab('archived')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${managerTab === 'archived' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-[#00f0ff]/50 animate-pulse' : 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/5' : 'text-gray-500 dark:text-gray-400')}`}>
                        Archived
                    </button>
                </div>
            </div>
            
            {managerTab === 'active' && (
                <div className="mb-4">
                    {!isCreatingProject ? (
                        <button onClick={() => setIsCreatingProject(true)} className={`w-full py-3 border-2 border-dashed rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff]/60 hover:border-[#00f0ff] hover:text-[#00f0ff]' : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add New Project
                        </button>
                    ) : (
                        <div className={`rounded-xl p-4 border shadow-lg animate-fade-in-down ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-white dark:bg-[#1c1c1e] border-blue-200 dark:border-blue-900/50'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className={`text-sm font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>New Project</h4>
                                <button onClick={() => setIsCreatingProject(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                                    <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`} placeholder="Project Name" autoFocus />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Theme</label>
                                    <div className="flex gap-3">
                                        {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                            <button key={t} onClick={() => setNewProjectTheme(t)} className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${ t === 'green' ? 'bg-green-500 border-green-200 dark:border-green-900' : t === 'blue' ? 'bg-blue-500 border-blue-200 dark:border-blue-900' : t === 'orange' ? 'bg-orange-500 border-orange-200 dark:border-orange-900' : 'bg-purple-500 border-purple-200 dark:border-purple-900' } ${newProjectTheme === t ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`} >
                                                {newProjectTheme === t && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleCreateNewProject} disabled={!newProjectName.trim()} className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}>
                                    Create Project
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                {displayedManagerProjects.length === 0 && (
                    <div className="text-center py-20 text-gray-400 text-sm">No projects found.</div>
                )}
                {displayedManagerProjects.map((p, index) => (
                    <div key={p.id} className={`rounded-xl p-4 border group transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20 hover:border-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-500/50'}`}>
                        {editingProjectId === p.id ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Project Name</label>
                                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 outline-none transition-all shadow-sm ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`} placeholder="e.g. Work, Study" autoFocus />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Color Theme</label>
                                        <div className="flex gap-3">
                                            {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                                <button key={t} onClick={() => setEditTheme(t)} className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${ t === 'green' ? 'bg-green-500 border-green-200 dark:border-green-900' : t === 'blue' ? 'bg-blue-500 border-blue-200 dark:border-blue-900' : t === 'orange' ? 'bg-orange-500 border-orange-200 dark:border-orange-900' : 'bg-purple-500 border-purple-200 dark:border-purple-900' } ${editTheme === t ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`} >
                                                    {editTheme === t && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Weekly Goal (Hrs)</label>
                                        <div className="relative">
                                            <input type="number" value={editGoal || ''} onChange={(e) => setEditGoal(parseInt(e.target.value))} placeholder="Global Default" className={`w-full px-4 py-2.5 rounded-xl text-sm focus:ring-2 outline-none transition-all shadow-sm ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700/50">
                                    <button onClick={() => setEditingProjectId(null)} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>Cancel</button>
                                    <button onClick={saveProjectEdit} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors shadow-lg ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}>Save Changes</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="flex flex-col gap-1">
                                        {managerTab === 'active' && (
                                            <button onClick={() => moveProject(index, 'up')} disabled={index === 0} className="text-gray-300 hover:text-blue-500 disabled:opacity-20"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg></button>
                                        )}
                                        {managerTab === 'active' && (
                                            <button onClick={() => moveProject(index, 'down')} disabled={index === displayedManagerProjects.length - 1} className="text-gray-300 hover:text-blue-500 disabled:opacity-20"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                                        )}
                                    </div>
                                    <div className={`w-3 h-3 rounded-full shrink-0 ${p.theme === 'green' ? 'bg-green-500' : p.theme === 'blue' ? 'bg-blue-500' : p.theme === 'orange' ? 'bg-orange-500' : 'bg-purple-500'}`}></div>
                                    <div className="truncate">
                                        <p className={`font-bold text-base truncate ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{p.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.weeklyGoal ? `Goal: ${p.weeklyGoal}h/wk` : 'Global Goal'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => startEditingProject(p)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                    <button onClick={() => toggleProjectArchive(p.id)} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors" title={p.isArchived ? "Restore" : "Archive"}>{p.isArchived ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}</button>
                                    <button onClick={() => { if(confirm('Delete project permanently?')) onDeleteProject(p.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};