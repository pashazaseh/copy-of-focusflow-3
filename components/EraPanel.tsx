import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types';
import { PROJECT_TROPHIES } from '../services/gamificationService';

interface EraPanelProps {
    activeProject: Project | null; // Can be null if in "Overview" mode
    globalBalance: number;
    isCyberpunk: boolean;
    projects?: Project[];
    onSelectProject?: (id: string) => void;
}

export const EraPanel: React.FC<EraPanelProps> = ({ activeProject, globalBalance, isCyberpunk, projects, onSelectProject }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // If no project selected, show Global Bank + Aggregate Stats
    if (!activeProject) {
        return (
            <div className={`p-6 border rounded-3xl ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <h2 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-500'}`}>🏦 Global Vault</h2>
                <div className={`text-4xl font-mono mt-2 font-black ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{globalBalance} 💎</div>
                <p className={`text-sm mt-4 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>Select a project to view streaks and trophies.</p>
            </div>
        );
    }

    // PROJECT SPECIFIC VIEW
    return (
        <div className={`p-6 rounded-3xl border transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_20px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            
            {/* Header: Project Name + Global Bank (Always visible context) */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    {projects && onSelectProject ? (
                        <div className="relative" ref={dropdownRef}>
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={`text-xl font-bold flex items-center gap-2 transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:text-white' : 'text-gray-900 dark:text-white hover:text-blue-600'}`}
                            >
                                {activeProject.name}
                                <svg className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {isDropdownOpen && (
                                <div className={`absolute top-full left-0 mt-2 w-64 rounded-xl shadow-xl border z-50 max-h-60 overflow-y-auto custom-scrollbar ${isCyberpunk ? 'bg-black border-[#00f0ff] text-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                    {projects.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                onSelectProject(p.id);
                                                setIsDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors flex items-center justify-between ${p.id === activeProject.id ? (isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-blue-50 dark:bg-blue-900/20') : (isCyberpunk ? 'hover:bg-[#00f0ff]/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700')}`}
                                        >
                                            <span className="truncate">{p.name}</span>
                                            {p.id === activeProject.id && <span>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <h2 className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                            {activeProject.name}
                        </h2>
                    )}
                    <span className={`text-xs uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Era Panel</span>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-mono font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-500'}`}>
                        {globalBalance} 💎
                    </div>
                    <span className={`text-[10px] ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'}`}>Global Funds</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* 1. Project Streak (Scoped) */}
                <div className={`p-4 rounded-2xl ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-red-600 dark:text-red-400'}`}>
                        <span className="text-xl">🔥</span>
                        <span className="font-bold text-sm">Streak</span>
                    </div>
                    <div className={`text-3xl font-bold font-mono ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                        {activeProject.streak?.current || 0}
                        <span className={`text-sm font-normal ml-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>days</span>
                    </div>
                    <div className={`text-[10px] mt-1 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'}`}>
                        Best: {activeProject.streak?.best || 0}
                    </div>
                </div>

                {/* 2. Project Mastery / XP (Scoped) */}
                <div className={`p-4 rounded-2xl ${isCyberpunk ? 'bg-[#ff00ff]/10' : 'bg-purple-50 dark:bg-purple-900/10'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-purple-600 dark:text-purple-400'}`}>
                        <span className="text-xl">⚔️</span>
                        <span className="font-bold text-sm">Mastery</span>
                    </div>
                    <div className={`text-3xl font-bold font-mono ${isCyberpunk ? 'text-[#ff00ff]' : 'text-gray-900 dark:text-white'}`}>
                        Lvl {Math.floor((activeProject.xp || 0) / 1000) + 1}
                    </div>
                    <div className={`w-full h-1.5 mt-2 rounded-full overflow-hidden ${isCyberpunk ? 'bg-[#ff00ff]/20' : 'bg-purple-200 dark:bg-purple-900/30'}`}>
                        <div 
                            className={`h-full ${isCyberpunk ? 'bg-[#ff00ff]' : 'bg-purple-500'}`}
                            style={{ width: `${((activeProject.xp || 0) % 1000) / 10}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 3. Project Trophy Room (Scoped) */}
            <div className="mt-6">
                <h3 className={`text-sm font-bold mb-3 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>🏆 Trophy Room</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {PROJECT_TROPHIES.map(trophy => {
                        const isUnlocked = activeProject.unlockedTrophies?.includes(trophy.id);
                        
                        return (
                            <div 
                                key={trophy.id} 
                                className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center border text-xl transition-all ${
                                    isUnlocked 
                                    ? (isCyberpunk ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-yellow-100 border-yellow-400 text-yellow-600 shadow-sm') 
                                    : (isCyberpunk ? 'bg-black border-[#00f0ff]/20 text-[#00f0ff]/20 border-dashed' : 'bg-gray-100 border-gray-300 text-gray-300 border-dashed dark:bg-gray-800 dark:border-gray-700')
                                }`} 
                                title={isUnlocked ? trophy.name : `${trophy.name} (Locked)`}
                            >
                                {isUnlocked ? trophy.icon : '🔒'}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};