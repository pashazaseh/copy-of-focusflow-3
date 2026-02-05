import React, { useMemo, useState, useEffect } from 'react';
import { StudyLog, UserGoals } from '../types';
import { getUnlockedAchievements } from '../services/gamificationService';
import { useTheme } from '../AppContext';

const RARITY_COLORS: Record<string, string> = {
    common: 'text-slate-400 border-slate-600',
    uncommon: 'text-green-400 border-green-600',
    rare: 'text-blue-400 border-blue-600',
    epic: 'text-purple-400 border-purple-600',
    mythic: 'text-red-400 border-red-600',
    legendary: 'text-yellow-400 border-yellow-600'
};

interface ProfilePanelProps {
    logs: StudyLog[];
    streak: number;
    totalHours: number;
    goals: UserGoals;
    onUpdateGoals: (goals: UserGoals) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ logs, streak, totalHours, goals, onUpdateGoals }) => {
    const { appTheme } = useTheme();
    const isCyberpunk = appTheme === 'cyberpunk';
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    const [tempGoals, setTempGoals] = useState<UserGoals>(goals);

    const getAchievementReward = (achievement: { id: string, title: string, description: string }) => {
        const title = achievement.title.toLowerCase();
        const desc = achievement.description.toLowerCase();
        const id = achievement.id.toLowerCase();

        if (title.includes('legend') || desc.includes('365-day') || id === 'rank_legend') {
            return { gems: 5000, rarity: 'legendary', label: 'Legendary' };
        }
        if (title.includes('grandmaster') || title.includes('master') || desc.includes('100-day')) {
            return { gems: 2500, rarity: 'mythic', label: 'Mythic' };
        }
        if (title.includes('expert') || desc.includes('30-day') || id === 'iron_mind') {
            return { gems: 1000, rarity: 'epic', label: 'Epic' };
        }
        if (title.includes('journeyman') || desc.includes('14-day') || id === 'marathoner') {
            return { gems: 500, rarity: 'rare', label: 'Rare' };
        }
        if (title.includes('apprentice') || desc.includes('7-day')) {
            return { gems: 250, rarity: 'uncommon', label: 'Uncommon' };
        }
        return { gems: 50, rarity: 'common', label: 'Common' };
    };

    const achievements = useMemo(() => getUnlockedAchievements(logs, totalHours, streak).map(a => ({
        ...a, rewardConfig: getAchievementReward(a)
    })), [logs, totalHours, streak]);
    const unlockedCount = achievements.filter(a => a.isUnlocked).length;

    const latestBadge = useMemo(() => {
        const unlocked = achievements.filter(a => a.isUnlocked);
        return unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
    }, [achievements]);

    // Calculate Goal Progress
    const currentWeeklyHours = useMemo(() => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.getTime());
        monday.setDate(diff);
        monday.setHours(0,0,0,0);
        return logs.filter(l => new Date(l.date) >= monday).reduce((acc, curr) => acc + curr.hours, 0);
    }, [logs]);

    const currentMonthlyHours = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return logs.filter(l => new Date(l.date) >= startOfMonth).reduce((acc, curr) => acc + curr.hours, 0);
    }, [logs]);
    
    const currentYearlyHours = useMemo(() => {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        return logs.filter(l => new Date(l.date) >= startOfYear).reduce((acc, curr) => acc + curr.hours, 0);
    }, [logs]);

    const weeklyPercent = Math.min(100, (currentWeeklyHours / goals.weekly) * 100);
    const monthlyPercent = Math.min(100, (currentMonthlyHours / goals.monthly) * 100);
    const yearlyPercent = Math.min(100, (currentYearlyHours / goals.yearly) * 100);

    const handleSaveGoals = () => {
        onUpdateGoals(tempGoals);
        setIsEditingGoals(false);
    };

    const RingProgress = ({ percent, color, label, value, target }: { percent: number, color: string, label: string, value: number, target: number }) => {
        const radius = 30;
        const stroke = 6;
        const normalizedRadius = radius - stroke * 2;
        const circumference = normalizedRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (percent / 100) * circumference;

        return (
            <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
                        <circle
                            stroke="currentColor"
                            fill="transparent"
                            strokeWidth={stroke}
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                            className={isCyberpunk ? 'text-[#00f0ff]/20' : 'text-gray-200 dark:text-gray-700'}
                        />
                        <circle
                            stroke="currentColor"
                            fill="transparent"
                            strokeWidth={stroke}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset }}
                            strokeLinecap="round"
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                            className={`${isCyberpunk ? (color.includes('blue') ? 'text-[#00f0ff]' : color.includes('purple') ? 'text-[#ff00ff]' : 'text-[#ff9900]') : color} transition-all duration-1000 ease-out`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-sm font-bold opacity-80 ${isCyberpunk ? (color.includes('blue') ? 'text-[#00f0ff]' : color.includes('purple') ? 'text-[#ff00ff]' : 'text-[#ff9900]') : color}`}>{Math.round(percent)}%</span>
                    </div>
                </div>
                <div className="text-center mt-2">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>{label}</p>
                    <p className={`text-sm font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{value.toFixed(0)} <span className={`${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'} text-xs`}>/ {target}</span></p>
                </div>
            </div>
        );
    };

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-gray-50/50 dark:bg-gray-900'}`}>
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
                    
                    {/* Goals Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className={`lg:col-span-2 rounded-3xl p-6 border shadow-sm ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Goals & Activity
                                </h3>
                                <button 
                                    onClick={() => setIsEditingGoals(!isEditingGoals)}
                                    className={`text-sm font-medium ${isCyberpunk ? 'text-[#00f0ff] hover:text-[#00f0ff]/80' : 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'}`}
                                >
                                    {isEditingGoals ? 'Cancel' : 'Edit Targets'}
                                </button>
                            </div>

                            {isEditingGoals ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Weekly</label>
                                            <input type="number" value={tempGoals.weekly} onChange={e => setTempGoals({...tempGoals, weekly: parseInt(e.target.value)})} className={`w-full p-2 rounded-lg border ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-white'}`} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Monthly</label>
                                            <input type="number" value={tempGoals.monthly} onChange={e => setTempGoals({...tempGoals, monthly: parseInt(e.target.value)})} className={`w-full p-2 rounded-lg border ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-white'}`} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Yearly</label>
                                            <input type="number" value={tempGoals.yearly} onChange={e => setTempGoals({...tempGoals, yearly: parseInt(e.target.value)})} className={`w-full p-2 rounded-lg border ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-white'}`} />
                                        </div>
                                    </div>
                                    <button onClick={handleSaveGoals} className={`w-full py-2 rounded-lg font-bold transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Save Targets</button>
                                </div>
                            ) : (
                                <div className="flex justify-around items-center py-4">
                                    <RingProgress 
                                        percent={weeklyPercent} 
                                        color="text-blue-500" 
                                        label="Weekly" 
                                        value={currentWeeklyHours}
                                        target={goals.weekly}
                                    />
                                    <div className={`w-px h-24 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-700'}`}></div>
                                    <RingProgress 
                                        percent={monthlyPercent} 
                                        color="text-purple-500" 
                                        label="Monthly" 
                                        value={currentMonthlyHours}
                                        target={goals.monthly}
                                    />
                                    <div className={`w-px h-24 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-700'}`}></div>
                                    <RingProgress 
                                        percent={yearlyPercent} 
                                        color="text-orange-500" 
                                        label="Yearly" 
                                        value={currentYearlyHours}
                                        target={goals.yearly}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Streak Card */}
                         <div className={`rounded-3xl p-6 shadow-lg flex flex-col justify-between transform transition-transform hover:scale-[1.02] ${isCyberpunk ? 'bg-black border border-[#ff00ff]/50 text-[#ff00ff] shadow-[0_0_15px_rgba(255,0,255,0.3)]' : 'bg-gradient-to-br from-orange-500 to-red-600 text-white'}`}>
                            <div>
                                <h3 className="text-lg font-bold opacity-90 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                                    Current Streak
                                </h3>
                            </div>
                            <div className="text-center py-4">
                                <span className="text-6xl font-black">{streak}</span>
                                <span className="text-xl font-medium opacity-80 ml-2">Days</span>
                            </div>
                            <div className={`rounded-xl p-3 text-sm text-center font-medium backdrop-blur-sm ${isCyberpunk ? 'bg-[#ff00ff]/10 text-[#ff00ff]' : 'bg-white/20'}`}>
                                Keep it up! Consistency is key.
                            </div>
                         </div>
                    </div>

                    {/* Achievements Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Badges & Achievements</h3>
                            <div className={`px-4 py-1.5 rounded-full border ${isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'}`}>
                                <span className={`text-sm font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400'}`}>
                                    {unlockedCount} / {achievements.length} Unlocked
                                </span>
                            </div>
                        </div>
                        
                        {latestBadge && (
                            <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-4 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm'}`}>
                                <div className={`text-4xl ${isCyberpunk ? 'drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]' : ''}`}>{latestBadge.icon}</div>
                                <div>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>Latest Unlock</p>
                                    <h4 className={`text-lg font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{latestBadge.title}</h4>
                                    <p className={`text-sm ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-gray-600 dark:text-gray-300'}`}>{latestBadge.description}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                            {achievements.map((badge) => (
                                <div 
                                    key={badge.id}
                                    className={`relative p-5 rounded-2xl border flex flex-col items-center text-center transition-all duration-300 group overflow-hidden ${
                                        badge.isUnlocked 
                                        ? (isCyberpunk ? 'bg-black border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:border-[#00f0ff]' : 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1')
                                        : (isCyberpunk ? 'bg-black border-[#00f0ff]/10 opacity-40 grayscale' : 'bg-gray-100 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-60')
                                    }`}
                                >
                                    
                                    <div className={`w-20 h-20 flex items-center justify-center rounded-full text-4xl shadow-inner mb-4 transition-transform duration-500 group-hover:scale-110 ${
                                        badge.isUnlocked 
                                        ? (isCyberpunk ? 'bg-[#00f0ff]/10 ring-2 ring-[#00f0ff]/50' : 'bg-gradient-to-tr from-blue-100 to-white dark:from-gray-700 dark:to-gray-600 ring-2 ring-blue-500/20')
                                        : (isCyberpunk ? 'bg-[#0a0a0a] grayscale' : 'bg-gray-200 dark:bg-gray-800 grayscale')
                                    }`}>
                                        {badge.icon}
                                    </div>
                                    
                                    <div className="w-full z-10">
                                        <div className="flex items-center justify-center gap-1.5 mb-2">
                                            <h4 className={`font-bold text-base truncate ${badge.isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white') : (isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-500 dark:text-gray-500')}`}>
                                                {badge.title}
                                            </h4>
                                        </div>
                                        <p className={`text-xs leading-snug px-1 h-8 line-clamp-2 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {badge.description}
                                        </p>
                                    </div>

                                    {/* Unlocked Effect */}
                                    {badge.isUnlocked && (
                                        <>
                                            <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rounded-full blur-xl pointer-events-none ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gradient-to-bl from-blue-500/20 to-transparent'}`}></div>
                                            <div className={`absolute top-3 right-3 p-1 rounded-full shadow-lg transform scale-90 group-hover:scale-110 transition-transform ${isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-blue-500 text-white'}`}>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}