import React from 'react';
import { Project, UserState } from '../types';

interface GamificationPanelProps {
    activeProject: Project | null;
    userState: UserState; // For global bank balance
    isCyberpunk: boolean;
}

export const GamificationPanel: React.FC<GamificationPanelProps> = ({ 
    activeProject, 
    userState, 
    isCyberpunk 
}) => {
    
    // --- VIEW: GLOBAL VAULT (No Project Selected) ---
    if (!activeProject) {
        return (
            <div className={`h-full p-6 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.15)] text-[#00f0ff]' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100'}`}>
                
                <div className="mb-6 opacity-80">
                    <div className="text-6xl mb-4">🏦</div>
                    <h2 className="text-2xl font-bold uppercase tracking-wider">Global Vault</h2>
                </div>

                <div className="mb-8">
                    <div className={`text-5xl font-mono font-bold ${isCyberpunk ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'text-yellow-500'}`}>
                        {userState?.globalBalance || 0} <span className="text-3xl">🪙</span>
                    </div>
                    <div className="text-sm opacity-50 mt-2 uppercase tracking-widest">Available Credits</div>
                </div>

                <div className={`max-w-xs p-4 rounded-lg text-sm border ${isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10'}`}>
                    <p className="opacity-70">
                        Select a specific project from the sidebar to view its <strong>Streak</strong>, <strong>Mastery Level</strong>, and <strong>Badges</strong>.
                    </p>
                </div>
            </div>
        );
    }

    // --- VIEW: PROJECT SPECIFIC (Project Selected) ---
    // Calculate Level based on XP (e.g., 1000 XP per level)
    const currentLevel = Math.floor((activeProject.xp || 0) / 1000) + 1;
    const progressToNextLevel = ((activeProject.xp || 0) % 1000) / 10; // Percentage 0-100

    return (
        <div className={`h-full flex flex-col p-6 rounded-2xl border transition-all duration-300 ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.15)]' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}>
            
            {/* Header: Project Context + Global Bank */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: activeProject.color }} />
                        <h2 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                            {activeProject.name}
                        </h2>
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>
                        Operative Status
                    </span>
                </div>

                {/* Mini Bank Display (Always visible) */}
                <div className="text-right">
                    <div className={`text-xl font-bold font-mono ${isCyberpunk ? 'text-yellow-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                        {userState?.globalBalance || 0} 🪙
                    </div>
                    <span className="text-[10px] opacity-50 uppercase">Vault</span>
                </div>
            </div>

            {/* Main Grid: Streak & Mastery */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                
                {/* 1. STREAK CARD */}
                <div className={`relative overflow-hidden p-5 rounded-xl border flex flex-col justify-between group ${isCyberpunk ? 'bg-[#00f0ff]/5 border-[#00f0ff]/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20'}`}>
                    {/* Background Icon */}
                    <div className="absolute -right-4 -bottom-4 text-9xl opacity-5 pointer-events-none select-none">🔥</div>
                    
                    <div className="flex justify-between items-start z-10">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-orange-600/70 dark:text-orange-400/70'}`}>Current Streak</span>
                        {/* Status Indicator */}
                        <div className={`w-2 h-2 rounded-full ${activeProject.streak?.current > 0 ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-400'}`} />
                    </div>

                    <div className="z-10 mt-4">
                        <div className={`text-5xl font-black font-mono leading-none tracking-tight ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-orange-500'}`}>
                            {activeProject.streak?.current || 0}
                        </div>
                        <div className="text-xs opacity-50 mt-2 font-mono">
                            BEST RECORD: {activeProject.streak?.best || 0} DAYS
                        </div>
                    </div>
                </div>

                {/* 2. MASTERY CARD */}
                <div className={`relative overflow-hidden p-5 rounded-xl border flex flex-col justify-between ${isCyberpunk ? 'bg-purple-900/10 border-purple-500/30' : 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/20'}`}>
                    <div className="absolute -right-4 -bottom-4 text-9xl opacity-5 pointer-events-none select-none">⚔️</div>

                    <div className="flex justify-between items-start z-10">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isCyberpunk ? 'text-purple-400' : 'text-purple-600/70 dark:text-purple-400/70'}`}>Mastery Level</span>
                    </div>

                    <div className="z-10 mt-4">
                        <div className={`text-4xl font-black font-mono mb-3 ${isCyberpunk ? 'text-purple-400' : 'text-purple-600 dark:text-purple-400'}`}>
                            LVL {currentLevel}
                        </div>
                        
                        {/* XP Progress Bar */}
                        <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ease-out ${isCyberpunk ? 'bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'bg-purple-500'}`}
                                style={{ width: `${progressToNextLevel}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] opacity-50 mt-1 font-mono">
                            <span>{Math.floor(activeProject.xp || 0)} XP</span>
                            <span>{currentLevel * 1000} XP</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. TROPHY CASE */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xs font-bold uppercase tracking-wider opacity-70 ${isCyberpunk ? 'text-[#00f0ff]' : ''}`}>
                        🏆 Trophy Case
                    </h3>
                    <span className="text-[10px] opacity-40 font-mono">
                        {activeProject.unlockedTrophies?.length || 0} UNLOCKED
                    </span>
                </div>

                <div className={`flex-1 rounded-xl border p-4 overflow-y-auto custom-scrollbar ${isCyberpunk ? 'bg-[#00f0ff]/5 border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10'}`}>
                    {activeProject.unlockedTrophies?.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                            {activeProject.unlockedTrophies.map((trophyId, i) => (
                                <div key={i} className="aspect-square flex flex-col items-center justify-center gap-1 group relative cursor-help">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl border transition-transform group-hover:scale-110 ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-gray-800 border-yellow-400 shadow-sm'}`}>
                                        🌟
                                    </div>
                                    <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 whitespace-nowrap bg-black px-2 py-0.5 rounded text-white z-20 pointer-events-none">
                                        {trophyId}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 text-center p-4">
                            <div className="text-4xl mb-2 grayscale opacity-50">🏆</div>
                            <p className="text-xs">No badges earned yet.</p>
                            <p className="text-[10px] mt-1">Complete sessions to unlock rewards.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
