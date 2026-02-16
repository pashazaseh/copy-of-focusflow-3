import React, { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef, Suspense } from 'react';
import { Project, ShopItem, Transaction, StudyLog } from '../../types';
import * as storage from '../../services/storageService';
import { playSpinTick, playWin, playTone } from '../../services/audioService';
import { useTheme, useLogs, useProjects } from '../../AppContext';
import { useEconomy } from './hooks/useEconomy';
import { useGamificationData } from './hooks/useGamificationData';
import { GamificationHeader } from './components/GamificationHeader';
import { FocusGarden } from './components/FocusGarden';
import { getNextLevelProgress, XP_PER_HOUR } from './services/levelingService';
import { GemCounter } from '../../components/GemCounter';
import { getUnlockedAchievements, getAchievementReward } from './services/achievementService';
import { RANKS, STREAK_BADGES, SPECIAL_BADGES } from './achievements';

// --- INTERFACES ---
interface GamificationPanelProps {
  activeProject?: Project | null;
  userState?: { totalFocusTime: number };
  projects?: Project[];
  onSelectProject?: (id: string) => void;
  freezeDates?: string[];
  onRepairStreak?: (date: string) => void;
}

interface Particle { id: string; x: number; y: number; color: string; text?: string; tx: number; ty: number; }
interface Challenge { id: string; title: string; reward: number; dueDate?: string; completedDate?: string; penalized?: boolean; difficulty?: 'Easy' | 'Medium' | 'Hard'; }
interface Quest { id: string; title: string; target: number; current: number; reward: number; claimed: boolean; type: 'focus' | 'sessions'; }
interface ParticleSystemHandle { spawn: (x: number, y: number, color: string, count?: number, text?: string) => void; }

const LoadingSpinner = () => <div className="p-10 text-center text-gray-500">Loading Market...</div>;
// --- VISUAL CONSTANTS ---
const RARITY_STYLES = {
    common: {
        text: 'text-slate-500 dark:text-slate-400',
        border: 'border-slate-400 dark:border-slate-600'
    },
    uncommon: {
        text: 'text-green-600 dark:text-green-400',
        border: 'border-green-500 dark:border-green-500'
    },
    rare: {
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-500 dark:border-blue-500'
    },
    epic: {
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-500 dark:border-purple-500'
    },
    mythic: {
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-500 dark:border-red-500'
    },
    legendary: {
        text: 'text-yellow-500 dark:text-yellow-400',
        border: 'border-yellow-500 dark:border-yellow-500'
    }
};

const getCategoryColor = (cat: string, isCyberpunk: boolean) => {
    if (isCyberpunk) {
        // Neon Cyberpunk Palette
        switch(cat) {
            case 'Gamble': return 'text-[#ff00ff] border-[#ff00ff]/50 bg-[#ff00ff]/10';
            case 'Micro': return 'text-[#00ff00] border-[#00ff00]/50 bg-[#00ff00]/10';
            case 'Minor': return 'text-[#00f0ff] border-[#00f0ff]/50 bg-[#00f0ff]/10';
            case 'Major': return 'text-[#f97316] border-[#f97316]/50 bg-[#f97316]/10';
            default: return 'text-gray-400 border-gray-600';
        }
    } else {
        // Default Casino/Clean Palette
        switch(cat) {
            case 'Gamble': return 'text-pink-600 bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300';
            case 'Micro': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-300';
            case 'Minor': return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300';
            case 'Major': return 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300';
            default: return 'text-gray-500 bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-400';
        }
    }
};

const STATIC_SHOP_ITEMS: ShopItem[] = [
    // --- GAMBLE TIER (Casino Logic) ---
    { id: 'vault_mystery', name: 'Mystery Vault', icon: '📦', cost: 50, desc: 'Random loot. Chance for Gems or Streak Freezes.', type: 'consumable', category: 'Gamble' },
    { id: 'vault_mega', name: 'Mega Vault', icon: '💎', cost: 150, desc: 'High stakes. 3x loot pool. Chance for Jackpot.', type: 'consumable', category: 'Gamble' },
    { id: 'mech_double', name: 'Double or Nothing', icon: '🎲', cost: 50, desc: 'Bet 50 Gems. Win 100 or lose it all.', type: 'consumable', category: 'Gamble' },

    // --- MICRO TIER (Quick Rewards) ---
    { id: 'boba', name: 'Boba Tea', icon: '🧋', cost: 50, desc: 'Guilt-free treat. Requires ~5 hours of focus.', type: 'consumable', category: 'Micro' },
    { id: 'app_purchase', name: 'App Purchase', icon: '📱', cost: 20, desc: 'Small digital tool or game ($1-2 value).', type: 'consumable', category: 'Micro' },
    { id: 'uber', name: 'Uber Ride', icon: '🚖', cost: 40, desc: 'The "Lazy Tax". Pay gems to avoid walking.', type: 'consumable', category: 'Micro' },
    { id: 'repair_combo', name: 'Repair Combo', icon: '🔧', cost: 60, desc: 'Repair a streak gap (Last 24h only).', type: 'consumable', category: 'Micro' },
    { id: 'screen_free', name: 'Screen-Free Eve', icon: '🌙', cost: 60, desc: 'Purchase a guilt-free night off screens.', type: 'consumable', category: 'Micro' },

    // --- MINOR TIER (Lifestyle) ---
    { id: 'freeze', name: 'Streak Freeze', icon: '🛡️', cost: 100, desc: 'Protect your streak for 24h. Auto-activates.', type: 'consumable', category: 'Minor' },
    { id: 'temu', name: 'Temu / Amazon', icon: '📦', cost: 100, desc: 'Order a small gadget or trinket.', type: 'consumable', category: 'Minor' },
    { id: 'chiro', name: 'Self Care / Chiro', icon: '🦴', cost: 150, desc: 'Massage or Chiropractor visit.', type: 'consumable', category: 'Minor' },
    { id: 'dessert', name: 'Cheat Dessert', icon: '🍰', cost: 150, desc: 'High-calorie reward meal.', type: 'consumable', category: 'Minor' },
    { id: 'cloth_shopping', name: 'New Clothes', icon: '👕', cost: 200, desc: 'Permission to buy a new outfit.', type: 'consumable', category: 'Minor' },

    // --- MODERATE TIER (Experiences) ---
    { id: 'streak_repair', name: 'Streak Repair', icon: '🩹', cost: 300, desc: 'Retroactively repair a missed day from the last 30 days.', type: 'consumable', category: 'Moderate' },
    { id: 'day_trip', name: 'Lone Day Trip', icon: '🗺️', cost: 350, desc: 'Solo adventure day. Gas/Train ticket.', type: 'consumable', category: 'Moderate' },
    { id: 'theme_cyber', name: 'Cyberpunk Theme', icon: '🌆', cost: 500, desc: 'Unlock the Neon Cyberpunk visual theme.', type: 'unlock', category: 'Moderate' },
    { id: 'vacation', name: 'Vacation Ticket', icon: '✈️', cost: 500, desc: 'Buy a "Zero Guilt" vacation day.', type: 'consumable', category: 'Moderate' },
    { id: 'app_coding', name: 'Coding Sprint', icon: '👨‍💻', cost: 550, desc: 'Invest in a premium dev tool or course.', type: 'consumable', category: 'Moderate' },

    // --- MAJOR TIER (Big Goals) ---
    { id: 'netflix_series', name: 'Netflix Binge', icon: '🎬', cost: 1000, desc: 'Permission to binge an entire series.', type: 'consumable', category: 'Major' },
    { id: 'videogame', name: 'New Video Game', icon: '🎮', cost: 1500, desc: 'AAA Title ($60-70 value).', type: 'consumable', category: 'Major' },
    { id: 'streaming_sub', name: 'Yearly Sub', icon: '📺', cost: 2000, desc: 'Pay for a full year of streaming.', type: 'consumable', category: 'Major' },
    { id: 'photo_upgrade', name: 'Photo Gear', icon: '📸', cost: 3500, desc: 'New Lens or Camera Body investment.', type: 'consumable', category: 'Major' },
    { id: 'laptop', name: 'New Tech', icon: '💻', cost: 4000, desc: 'New Laptop or Phone upgrade.', type: 'consumable', category: 'Major' },
    { id: 'yes_man', name: '"Yes Man" Day', icon: '👍', cost: 6000, desc: 'Say YES to everything for 24 hours.', type: 'consumable', category: 'Major' },

    // 🎨 VISUAL THEMES
    { 
        id: 'theme_nature', 
        name: 'Zen Nature', 
        icon: '🎋', 
        cost: 400, 
        desc: 'Unlock the peaceful Green/Bamboo theme.', 
        type: 'unlock', 
        category: 'Visuals' 
    },
    { 
        id: 'theme_midnight', 
        name: 'Midnight Purple', 
        icon: '🌑', 
        cost: 400, 
        desc: 'A high-contrast dark purple theme.', 
        type: 'unlock', 
        category: 'Visuals' 
    },

    // 🧪 CONSUMABLES / BOOSTS
    { 
        id: 'xp_potion_small', 
        name: 'Potion of Wisdom', 
        icon: '🧪', 
        cost: 150, 
        desc: 'Double XP gain for the next 24 hours.', 
        type: 'consumable', 
        category: 'Boosts' 
    },
    { 
        id: 'gem_magnet', 
        name: 'Gem Magnet', 
        icon: '🧲', 
        cost: 300, 
        desc: 'Increase gem drop rate by 20% for 3 days.', 
        type: 'consumable', 
        category: 'Boosts' 
    },
    
    // ⚙️ UTILITIES
    { 
        id: 'chart_pro', 
        name: 'Pro Analytics', 
        icon: '📊', 
        cost: 2000, 
        desc: 'Unlock advanced heatmap & trend charts.', 
        type: 'unlock', 
        category: 'Features' 
    },
    { 
        id: 'sound_pack_lofi', 
        name: 'Lo-Fi Pack', 
        icon: '🎧', 
        cost: 600, 
        desc: 'Unlock Lo-Fi beats for the focus timer.', 
        type: 'unlock', 
        category: 'Audio' 
    }
];

// --- PARTICLE SYSTEM ---
const ParticleSystem = forwardRef<ParticleSystemHandle, {}>((_, ref) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const isMounted = useRef(true);
    useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
    useImperativeHandle(ref, () => ({
        spawn: (x, y, color, count = 12, text) => {
            const newParticles = Array.from({ length: count }).map(() => ({
                id: Math.random().toString(36).substr(2, 9),
                x, y, color, text,
                tx: (Math.random() - 0.5) * 150, ty: (Math.random() - 0.5) * 150
            }));
            if (isMounted.current) setParticles(prev => [...prev, ...newParticles]);
            setTimeout(() => { if (isMounted.current) setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id))); }, 1000);
        }
    }));
    return (
        <>
        <style>{`@keyframes particle-explode { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } } .particle { position: fixed; pointer-events: none; animation: particle-explode 0.8s ease-out forwards; z-index: 9999; border-radius: 50%; }`}</style>
        {particles.map(p => (<div key={p.id} className="particle" style={{ left: p.x, top: p.y, backgroundColor: p.color, width: '6px', height: '6px', '--tx': `${p.tx}px`, '--ty': `${p.ty}px` } as React.CSSProperties}>{p.text && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-bold" style={{color: p.color}}>{p.text}</span>}</div>))}
        </>
    );
});

// --- DAILY QUEST WIDGET (INLINE) ---
const DailyQuestWidget: React.FC<{ isCyberpunk: boolean; onClaim: (amount: number) => void }> = ({ isCyberpunk, onClaim }) => {
    const [quests, setQuests] = useState<Quest[]>([]);
    const today = new Date().toDateString();

    useEffect(() => {
        const stored = localStorage.getItem('focusflow_daily_quests');
        const storedDate = localStorage.getItem('focusflow_quest_date');
        
        let parsedQuests: Quest[] | null = null;
        try {
            const parsed = stored ? JSON.parse(stored) : null;
            if (Array.isArray(parsed)) parsedQuests = parsed;
        } catch (e) {
            console.error("Failed to parse daily quests", e);
        }

        if (parsedQuests && storedDate === today) {
            setQuests(parsedQuests);
        } else {
            // Generate New Quests
            const newQuests: Quest[] = [
                { id: 'q1', title: 'Deep Focus', target: 60, current: 0, reward: 50, claimed: false, type: 'focus' },
                { id: 'q2', title: 'Consistency', target: 2, current: 0, reward: 30, claimed: false, type: 'sessions' },
                { id: 'q3', title: 'Iron Will', target: 120, current: 0, reward: 100, claimed: false, type: 'focus' }
            ];
            setQuests(newQuests);
            localStorage.setItem('focusflow_daily_quests', JSON.stringify(newQuests));
            localStorage.setItem('focusflow_quest_date', today);
        }
    }, [today]);

    const handleClaim = (id: string) => {
        const quest = quests.find(q => q.id === id);
        if (quest && !quest.claimed) {
            onClaim(quest.reward);
            const updated = quests.map(q => q.id === id ? { ...q, claimed: true } : q);
            setQuests(updated);
            localStorage.setItem('focusflow_daily_quests', JSON.stringify(updated));
        }
    };

    return (
        <div className={`p-5 rounded-2xl border mb-6 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}><span>📜</span> Daily Quests</h3>
            <div className="space-y-3">
                {Array.isArray(quests) && quests.map(q => (
                    <div key={q.id} className={`flex justify-between items-center p-3 rounded-xl border ${q.claimed ? 'opacity-50' : ''} ${isCyberpunk ? 'border-[#00f0ff]/20 bg-[#00f0ff]/5' : 'border-gray-100 bg-gray-50 dark:bg-slate-700 dark:border-slate-600'}`}>
                        <div>
                            <p className={`text-sm font-bold ${isCyberpunk ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{q.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Reward: {q.reward} 💎</p>
                        </div>
                        <button onClick={() => handleClaim(q.id)} disabled={q.claimed} className={`px-3 py-1 rounded text-xs font-bold ${q.claimed ? 'bg-gray-700 text-gray-400' : (isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-blue-500 text-white')}`}>
                            {q.claimed ? 'Claimed' : 'Claim'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
// --- WEEKLY PUNCH CARD ---
const WeeklyPunchCard: React.FC<{ logs: StudyLog[], freezeDates: string[], isCyberpunk: boolean }> = ({ logs, freezeDates, isCyberpunk }) => {
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const hasLog = logs.some(l => l.date === dateStr && l.hours > 0);
        const isFrozen = freezeDates.includes(dateStr);
        return { date: d, hasLog, isFrozen, dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }) };
    });
    return (
        <div className={`flex justify-between items-center p-4 rounded-2xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
            {days.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${day.hasLog ? (isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-green-500 text-white') : day.isFrozen ? (isCyberpunk ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'bg-cyan-100 text-cyan-600') : (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]/30' : 'bg-gray-100 dark:bg-slate-700 text-gray-400')}`}>
                        {day.hasLog ? '✓' : day.isFrozen ? '🧊' : day.dayName[0]}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- TROPHY ROOM ---
const TrophyRoom: React.FC<{ 
    achievements: any[]; 
    unlockedCount: number; 
    isCyberpunk: boolean; 
    filter: 'all' | 'unlocked' | 'locked'; 
    setFilter: (f: 'all' | 'unlocked' | 'locked') => void;
    totalFocusTime: number;
    lastActiveDate: string;
}> = ({ achievements, unlockedCount, isCyberpunk, filter, setFilter, totalFocusTime, lastActiveDate }) => (
    <div>
        <FocusGarden totalFocusTime={totalFocusTime} lastActiveDate={lastActiveDate} />
        <div className="flex items-center justify-between mb-6">
            <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}><span className="text-2xl">🏆</span> Trophy Room</h3>
            <div className="flex gap-2">
                <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                    {(['all', 'unlocked', 'locked'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-[10px] font-bold rounded-md capitalize ${filter === f ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white text-blue-600 shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-500 dark:text-gray-400')}`}>{f}</button>
                    ))}
                </div>
                <div className={`px-3 py-1 rounded-lg border flex items-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}><span className={`text-xs font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>{unlockedCount} / {achievements.length}</span></div>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.filter(a => filter === 'all' || (filter === 'unlocked' && a.isUnlocked) || (filter === 'locked' && !a.isUnlocked)).map((badge) => {
                const rarity = badge.rewardConfig?.rarity || 'common';
                const styles = RARITY_STYLES[rarity] || RARITY_STYLES.common;
                const isUnlocked = badge.isUnlocked;
                
                return (
                <div key={badge.id} className={`group rounded-2xl p-5 transition-all duration-300 flex flex-col gap-4 relative ${isUnlocked ? (isCyberpunk ? 'bg-black border-[#00f0ff]/20 hover:border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md') : (isCyberpunk ? 'bg-black/50 border-[#00f0ff]/5 opacity-60' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-100 dark:border-slate-800 opacity-60')}`}>
                    <div className="flex justify-between items-start">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner border ${isUnlocked ? (isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-slate-700 border-gray-100 dark:border-slate-600') : (isCyberpunk ? 'bg-black border-[#00f0ff]/10 grayscale' : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 grayscale')}`}>
                            {badge.icon}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border capitalize ${isUnlocked ? (isCyberpunk ? 'text-[#00f0ff] border-[#00f0ff]/30 bg-[#00f0ff]/10' : styles.text + ' ' + styles.border) : (isCyberpunk ? 'text-gray-600 border-gray-800' : 'text-gray-400 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800')}`}>
                            {rarity}
                        </span>
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex justify-between items-baseline mb-1">
                            <h4 className={`font-bold text-base ${isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white') : (isCyberpunk ? 'text-gray-600' : 'text-gray-500 dark:text-gray-400')}`}>
                                {badge.title}
                            </h4>
                            <span className={`font-mono font-bold text-xs ${isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-500') : 'text-gray-400'}`}>
                                {badge.rewardConfig.gems} 💎
                            </span>
                        </div>
                        <p className={`text-xs ${isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400') : 'text-gray-400 dark:text-gray-600'}`}>
                            {badge.description}
                        </p>
                    </div>

                    {/* Progress Bar for Locked Items */}
                    {!isUnlocked && badge.progress !== undefined && badge.progress > 0 && (
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(100, Math.max(0, badge.progress))}%` }}
                            />
                        </div>
                    )}

                    {/* Status Footer */}
                    <div className={`w-full py-2 rounded-xl text-xs font-bold text-center ${isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400') : (isCyberpunk ? 'bg-gray-900 text-gray-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-400')}`}>
                        {isUnlocked ? 'Unlocked' : `${badge.progress ? Math.floor(badge.progress) + '% Complete' : 'Locked'}`}
                    </div>
                </div>
                );
            })}
        </div>
    </div>
);
// --- INVENTORY GRID ---
const InventoryGrid: React.FC<{ inventory: Record<string, any>; items: ShopItem[]; handleConsume: (id: string, e?: React.MouseEvent) => void; handleSell: (id: string, e: React.MouseEvent) => void; isCyberpunk: boolean; }> = ({ inventory, items, handleConsume, handleSell, isCyberpunk }) => (
    <div className={`rounded-3xl p-8 border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-white/5'}`}>
        <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}><span className="text-2xl">🎒</span> Inventory</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.filter(item => (item.type === 'unlock' ? inventory[item.id] : (inventory[item.id] || 0) > 0)).map(item => {
                let count = item.type !== 'unlock' ? inventory[item.id] : 1;
                return (
                    <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">{item.icon}</div>
                            <div><p className={`font-bold text-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{item.name}</p>{item.type !== 'unlock' && <p className="text-xs opacity-60">Owned: {count}</p>}</div>
                        </div>
                        <div className="flex gap-2">
                            {item.type !== 'unlock' && <button onClick={(e) => handleConsume(item.id, e)} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white border dark:border-slate-600 text-gray-700 dark:bg-slate-700 dark:text-gray-300'}`}>Use</button>}
                            <button onClick={(e) => handleSell(item.id, e)} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${isCyberpunk ? 'bg-red-500/20 text-red-500' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>Sell</button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

// --- SHOP GRID (With Drag & Drop) ---
const ShopGrid: React.FC<{ inventory: Record<string, any>; items: ShopItem[]; currentGems: number; handleBuy: (item: ShopItem, e: React.MouseEvent) => void; handleDeleteCustom: (id: string) => void; isCyberpunk: boolean; onAddCustom?: () => void; onReorder: (ids: string[]) => void; shakeItemId?: string | null; }> = ({ inventory, items, currentGems, handleBuy, handleDeleteCustom, isCyberpunk, onAddCustom, onReorder, shakeItemId }) => {
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const handleDragStart = (e: React.DragEvent, index: number) => { setDraggingIndex(index); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggingIndex === null || draggingIndex === index) return;
        const newItems = [...items];
        const draggedItem = newItems[draggingIndex];
        newItems.splice(draggingIndex, 1);
        newItems.splice(index, 0, draggedItem);
        onReorder(newItems.map(i => i.id));
        setDraggingIndex(index);
    };

    return (
    <div className={`rounded-3xl p-8 border shadow-2xl relative overflow-hidden ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
        <div className="flex justify-between items-center mb-8 relative z-10">
            <h3 className={`text-2xl font-bold flex items-center gap-3 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}><span className="text-3xl">🏦</span> Market</h3>
            {onAddCustom && <button onClick={onAddCustom} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-slate-700'}`}>+ Custom</button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
            {items.map((item, index) => {
                const isExpired = item.expiryDate ? new Date(item.expiryDate) < new Date() : false;
                return (
                <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index)} onDragEnd={() => setDraggingIndex(null)} className={`group rounded-2xl p-5 transition-all duration-300 flex flex-col gap-4 relative cursor-move ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 hover:border-[#00f0ff]' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700/80 hover:border-purple-300 dark:hover:border-purple-500'} ${inventory[item.id] && item.type === 'unlock' ? 'opacity-50' : ''}`}>
                    {item.isCustom && <button onClick={(e) => { e.stopPropagation(); handleDeleteCustom(item.id); }} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">✕</button>}
                    <div className="flex justify-between items-start">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>{item.icon}</div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${getCategoryColor(item.category || '', isCyberpunk)}`}>{item.category}</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-baseline mb-1"><h4 className={`font-bold text-base ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-slate-200'}`}>{item.name}</h4><span className="font-mono font-bold">{item.cost} 💎</span></div>
                        <p className="text-xs opacity-60">{item.desc}</p>
                    </div>
                    <button onClick={(e) => handleBuy(item, e)} disabled={isExpired || (item.type === 'unlock' && inventory[item.id])} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${shakeItemId === item.id ? 'animate-shake bg-red-500 text-white' : ''} ${currentGems >= item.cost ? (isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80' : 'bg-purple-600 text-white') : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
                        {item.type === 'unlock' && inventory[item.id] ? 'Purchased' : isExpired ? 'Expired' : currentGems >= item.cost ? 'Purchase' : `Need ${item.cost - currentGems} 💎`}
                    </button>
                </div>
                );
            })}
        </div>
    </div>
    );
};
// --- MODALS ---
const SlotMachineModal: React.FC<{ isOpen: boolean; onClose: () => void; isCyberpunk: boolean; slotItems: string[]; reelStatuses: boolean[]; slotMessage: string; slotRolling: boolean; onSpin: () => void; }> = ({ isOpen, onClose, isCyberpunk, slotItems, reelStatuses, slotMessage, slotRolling, onSpin }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-md rounded-3xl border-4 p-8 relative overflow-hidden flex flex-col items-center ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_50px_rgba(0,240,255,0.3)]' : 'bg-[#1c1c1e] border-yellow-500'}`}>
                <h3 className={`text-3xl font-black mb-8 drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>JACKPOT SLOTS</h3>
                <div className="flex gap-4 mb-8">
                    {slotItems.map((item, i) => (
                        <div key={i} className={`w-20 h-24 bg-white text-6xl flex items-center justify-center rounded-xl border-b-4 border-slate-300 overflow-hidden relative ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff]' : ''}`}>
                            <div className={`${!reelStatuses[i] ? 'animate-bounce' : ''}`}>{item}</div>
                        </div>
                    ))}
                </div>
                {slotMessage && <p className={`text-2xl font-bold mb-8 animate-bounce ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{slotMessage}</p>}
                <div className="flex gap-4 w-full">
                    {!slotMessage && <button onClick={onSpin} disabled={slotRolling} className={`flex-1 py-4 font-black text-xl rounded-2xl shadow-xl transition-all ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/90' : 'bg-red-600 hover:bg-red-500 text-white'}`}>{slotRolling ? 'ROLLING...' : 'PULL LEVER'}</button>}
                    {slotMessage && <button onClick={onClose} className={`flex-1 py-4 font-bold rounded-2xl ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-slate-700 text-white'}`}>Collect</button>}
                </div>
            </div>
        </div>
    );
};

const LevelUpModal: React.FC<{ isOpen: boolean; onClose: () => void; level: number; isCyberpunk: boolean }> = ({ isOpen, onClose, level, isCyberpunk }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-8 relative overflow-hidden flex flex-col items-center text-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-yellow-500'}`}>
                <div className="text-6xl mb-4 animate-bounce">🆙</div>
                <h3 className={`text-4xl font-black mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>LEVEL UP!</h3>
                <p className={`text-xl font-bold mb-6 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-white'}`}>You reached Level {level}</p>
                <button onClick={onClose} className={`px-8 py-3 font-bold rounded-xl shadow-lg transition-transform hover:scale-105 ${isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-yellow-500 text-black'}`}>AWESOME!</button>
            </div>
        </div>
    );
};
const CreateItemModal: React.FC<{ isOpen: boolean; onClose: () => void; onCreate: (item: ShopItem) => void; isCyberpunk: boolean; }> = ({ isOpen, onClose, onCreate, isCyberpunk }) => {
    const [name, setName] = useState('');
    const [cost, setCost] = useState(100);
    const [desc, setDesc] = useState('');
    const [icon, setIcon] = useState('🎁');
    if (!isOpen) return null;
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onCreate({ id: `custom_${Date.now()}`, name, cost, desc, icon, type: 'consumable', category: 'Custom', isCustom: true }); onClose(); };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`w-full max-w-md rounded-3xl border p-6 ${isCyberpunk ? 'bg-black border-[#00f0ff]' : 'bg-[#1c1c1e] border-gray-700'}`}>
                <h3 className={`text-xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Create Custom Item</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Item Name" className="w-full p-2 rounded bg-gray-800 text-white" required />
                    <input type="number" value={cost} onChange={e => setCost(parseInt(e.target.value))} placeholder="Cost" className="w-full p-2 rounded bg-gray-800 text-white" required />
                    <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder="Icon (Emoji)" className="w-full p-2 rounded bg-gray-800 text-white" />
                    <button type="submit" className="w-full py-2 bg-blue-600 rounded text-white font-bold">Create</button>
                    <button type="button" onClick={onClose} className="w-full py-2 text-gray-400">Cancel</button>
                </form>
            </div>
        </div>
    );
};

const HistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; isCyberpunk: boolean; history: Transaction[] }> = ({ isOpen, onClose, isCyberpunk, history }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`w-full max-w-lg rounded-3xl border p-6 flex flex-col max-h-[80vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]' : 'bg-[#1c1c1e] border-gray-700'}`}>
                <div className="flex justify-between mb-4"><h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>History</h3><button onClick={onClose} className="text-gray-400">✕</button></div>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {history.map(tx => (
                        <div key={tx.id} className="flex justify-between p-2 border-b border-gray-700">
                            <div><p className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{tx.description}</p><p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</p></div>
                            <div className={tx.amount > 0 ? 'text-green-500' : 'text-red-500'}>{tx.amount}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const EconomyGuideModal: React.FC<{ isOpen: boolean; onClose: () => void; isCyberpunk: boolean }> = ({ isOpen, onClose, isCyberpunk }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`w-full max-w-md rounded-3xl border p-6 ${isCyberpunk ? 'bg-black border-[#00f0ff]' : 'bg-[#1c1c1e] border-gray-700'}`}>
                <h3 className={`text-2xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Economy Guide</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                    <li>⏱️ 1 Hour Focus = 10 Gems</li>
                    <li>🔥 7-Day Streak = Jackpot Spin</li>
                    <li>🛡️ Streak Freeze = Protects streaks</li>
                </ul>
                <button onClick={onClose} className="mt-6 w-full py-2 bg-gray-700 rounded text-white">Close</button>
            </div>
        </div>
    );
};
// --- MAIN COMPONENT ---
export const GamificationPanel: React.FC<GamificationPanelProps> = ({ activeProject, userState, projects, onSelectProject, freezeDates, onRepairStreak }) => {
  const { appTheme } = useTheme();
  const isCyberpunk = appTheme === 'cyberpunk';
  const { logs: allLogs, transactions, addTransaction } = useLogs();
  const { updateProjects } = useProjects();
  const { currentGems, spendGems, addBonus } = useEconomy();
  const { profile, inventory: hookInventory, refreshData } = useGamificationData();

  const [activeTab, setActiveTab] = useState<'earn' | 'shop' | 'inventory' | 'achievements'>('shop');
  const [customShopItems, setCustomShopItems] = useState<ShopItem[]>([]);
  const [shopOrder, setShopOrder] = useState<string[]>([]);
  const [shakeItemId, setShakeItemId] = useState<string | null>(null);
  
  // Modals & UI State
  const [isSlotMachineOpen, setIsSlotMachineOpen] = useState(false);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEconomyInfoOpen, setIsEconomyInfoOpen] = useState(false);
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [isChallengeHistoryOpen, setIsChallengeHistoryOpen] = useState(false);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  
  // Challenges State
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [newChallengeTitle, setNewChallengeTitle] = useState('');
  const [newChallengeReward, setNewChallengeReward] = useState(50);
  const [isAddChallengeMenuOpen, setIsAddChallengeMenuOpen] = useState(false);
  
  // Local Inventory State
  const [inventory, setInventory] = useState<Record<string, any>>({});
  
  // Slot Machine Logic State
  const [slotRolling, setSlotRolling] = useState(false);
  const [slotItems, setSlotItems] = useState(['🍒', '7️⃣', '💎']);
  const [reelStatuses, setReelStatuses] = useState([true, true, true]);
  const [slotMessage, setSlotMessage] = useState('');
  const spinIntervalRef = useRef<any>(null);

  const particleSystemRef = useRef<ParticleSystemHandle>(null);
  const spawnParticles = (x: number, y: number, color: string, count: number = 12, text?: string) => {
      particleSystemRef.current?.spawn(x, y, color, count, text);
  };

  useEffect(() => {
      storage.getCustomShopItems().then(items => setCustomShopItems(items || []));
      try {
          setInventory(JSON.parse(localStorage.getItem('focusflow_inventory') || '{}'));
          const savedChallenges = JSON.parse(localStorage.getItem('focusflow_challenges') || '[]');
          setChallenges(savedChallenges);
          setShopOrder(JSON.parse(localStorage.getItem('focusflow_shop_order') || '[]'));
      } catch { setInventory({}); setChallenges([]); }
  }, []);

  const [achievements, setAchievements] = useState<any[]>([]);

  // ...

  const totalFocusTime = useMemo(() => allLogs.reduce((acc, log) => acc + log.hours, 0), [allLogs]);
  const levelProgress = useMemo(() => getNextLevelProgress(totalFocusTime * XP_PER_HOUR), [totalFocusTime]);
  
  const streak = activeProject?.streak ? activeProject.streak.current : 0;
  
  useEffect(() => {
    const list = getUnlockedAchievements(allLogs, totalFocusTime, streak);
    const processedAchievements = list.map(item => ({
        ...item,
        rewardConfig: getAchievementReward(item) || { gems: 0, rarity: 'common' }
    }));
    setAchievements(processedAchievements);
  }, [allLogs, totalFocusTime, streak]);

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  // Actions
  const handleAddChallenge = (e: React.FormEvent) => {
      e.preventDefault();
      const newChal: Challenge = { id: Date.now().toString(), title: newChallengeTitle, reward: newChallengeReward };
      const updated = [...challenges, newChal];
      setChallenges(updated);
      localStorage.setItem('focusflow_challenges', JSON.stringify(updated));
      setNewChallengeTitle('');
      setIsAddChallengeMenuOpen(false);
  };

  const handleCompleteChallenge = (id: string, e?: React.MouseEvent) => {
      const c = challenges.find(ch => ch.id === id);
      if (!c || c.completedDate) return;
      if (confirm(`Complete "${c.title}"?`)) {
          addBonus(c.reward, `Challenge: ${c.title}`);
          const updated = challenges.map(ch => ch.id === id ? { ...ch, completedDate: new Date().toISOString() } : ch);
          setChallenges(updated);
          localStorage.setItem('focusflow_challenges', JSON.stringify(updated));
          if (e) spawnParticles(e.clientX, e.clientY, '#00ff00', 15, `+${c.reward}`);
      }
  };

  const orderedShopItems = useMemo(() => {
      const all = [...STATIC_SHOP_ITEMS, ...customShopItems];
      if (shopOrder.length === 0) return all;
      const itemMap = new Map(all.map(i => [i.id, i]));
      const result: ShopItem[] = [];
      shopOrder.forEach(id => { const item = itemMap.get(id); if (item) { result.push(item); itemMap.delete(id); } });
      all.forEach(item => { if (itemMap.has(item.id)) result.push(item); });
      return result;
  }, [customShopItems, shopOrder]);

  const handleBuy = useCallback(async (item: ShopItem, e?: React.MouseEvent) => {
      if (item.expiryDate && new Date(item.expiryDate) < new Date()) return;
      const success = await spendGems(item.cost, item.id === 'mech_double' ? 'Double or Nothing Bet' : `Purchased ${item.name}`);
      if (!success) {
          setShakeItemId(item.id); setTimeout(() => setShakeItemId(null), 500);
          playTone(150, 0.1, 0.5, 'sawtooth');
          return;
      }

      if (item.id === 'mech_double') {
          const win = Math.random() > 0.5;
          const isCrit = Math.random() > 0.9;
          if (win) {
              const winAmount = isCrit ? 250 : 100;
              playWin(0.5);
              addBonus(winAmount, isCrit ? `Won Double (CRIT)` : `Won Double`);
              alert(`JACKPOT! +${winAmount} Gems`);
          } else {
              playTone(200, 0.3, 0.5, 'sawtooth');
              alert("Lost 50 Gems...");
          }
          return;
      }

      if (e) spawnParticles(e.clientX, e.clientY, isCyberpunk ? '#00f0ff' : '#ef4444');
      const newInventory = { ...inventory };
      if (item.id === 'freeze') newInventory.streakFreeze = (newInventory.streakFreeze || 0) + 1;
      else if (item.type === 'unlock') newInventory[item.id] = true;
      else newInventory[item.id] = (newInventory[item.id] || 0) + 1;
      setInventory(newInventory);
      localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
      refreshData();
  }, [currentGems, inventory, isCyberpunk, spendGems, addBonus, refreshData]);

  const handleConsume = (itemId: string, e?: React.MouseEvent) => {
      const item = orderedShopItems.find(i => i.id === itemId);
      if (!confirm(`Use ${item ? item.name : 'item'}?`)) return;
      const newInventory = { ...inventory };
      let key = itemId === 'freeze' ? 'streakFreeze' : itemId;
      
      if ((newInventory[key] || 0) > 0) {
          newInventory[key] -= 1;
          if (itemId === 'streak_repair') {
             const date = prompt("Enter date YYYY-MM-DD to repair:");
             if (date && onRepairStreak) { onRepairStreak(date); alert("Repaired!"); }
          }
          if (itemId === 'vault_mystery') {
              const amount = Math.floor(80 * (0.5 + Math.random() * 2));
              addBonus(amount, "Mystery Vault Loot");
              alert(`You found ${amount} Gems!`);
          }
          setInventory(newInventory);
          localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
          refreshData();
      }
  };

  const handleSell = (itemId: string, e?: React.MouseEvent) => {
      const item = orderedShopItems.find(i => i.id === itemId);
      if (!item) return;
      const sellPrice = Math.floor(item.cost * 0.6);
      if(!confirm(`Sell for ${sellPrice}?`)) return;
      addBonus(sellPrice, `Sold ${item.name}`);
      const newInventory = { ...inventory };
      let key = itemId === 'freeze' ? 'streakFreeze' : itemId;
      if (newInventory[key]) { if (typeof newInventory[key] === 'boolean') delete newInventory[key]; else newInventory[key] -= 1; }
      setInventory(newInventory);
      localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
      refreshData();
  };

  const handleSlotSpin = () => {
      if (slotRolling) return;
      setSlotRolling(true);
      setSlotMessage('');
      setReelStatuses([false, false, false]);
      playTone(600, 0.2, 0.5, 'sine');
      let ticks = 0;
      const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣', '🔔'];
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = setInterval(() => {
          ticks++;
          setSlotItems(prev => [symbols[Math.floor(Math.random()*6)], symbols[Math.floor(Math.random()*6)], symbols[Math.floor(Math.random()*6)]]);
          if (ticks === 20) setReelStatuses(s => [true, false, false]);
          if (ticks === 35) setReelStatuses(s => [true, true, false]);
          if (ticks >= 50) {
              setReelStatuses([true, true, true]);
              clearInterval(spinIntervalRef.current);
              const amount = Math.floor(Math.random() * 500) + 50;
              addBonus(amount, 'Weekly Jackpot Win');
              setSlotMessage(`You won: ${amount} Gems!`);
              setSlotRolling(false);
              playWin(0.5);
          }
      }, 60);
  };
  return (
    <div className={`flex flex-col h-full overflow-hidden transition-colors duration-300 relative ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-white'}`}>
        <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } } .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }`}</style>
        <ParticleSystem ref={particleSystemRef} />
        
        <div className="p-6 h-full overflow-y-auto custom-scrollbar relative z-10">
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
                
                {/* Header Area */}
                <div className={`flex flex-col md:flex-row justify-between items-center gap-6 p-6 rounded-3xl border backdrop-blur-md shadow-2xl ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white/5 border-white/10'}`}>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className={`text-4xl font-black drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600'}`}>Marketplace</h2>
                            <button onClick={() => setIsHistoryOpen(true)} className={`p-2 rounded-full transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-blue-200 hover:bg-white/10'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                            <button onClick={() => setIsEconomyInfoOpen(true)} className={`p-2 rounded-full transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-blue-200 hover:bg-white/10'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                        </div>
                        <p className={`mt-1 font-medium ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-blue-200'}`}>Earn 10 Gems per hour of focus.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className={`flex flex-col items-center p-3 rounded-2xl border min-w-[100px] ${isCyberpunk ? 'bg-black border-[#ff00ff]/30' : 'bg-black/40 border-red-500/30'}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#ff00ff]' : 'text-red-400'}`}>Streak</span>
                            <div className={`text-2xl font-black drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] ${isCyberpunk ? 'text-[#ff00ff] drop-shadow-[0_0_8px_rgba(255,0,255,0.5)]' : 'text-red-500'}`}>{streak} <span className="text-sm">🔥</span></div>
                        </div>
                        <div className={`flex flex-col items-center p-3 rounded-2xl border min-w-[120px] ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/40 border-yellow-500/30'}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>Bankroll</span>
                            <div className={`text-2xl font-black drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' : 'text-yellow-400'}`}><GemCounter value={currentGems} /> <span className="text-sm">💎</span></div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className={`flex p-1 rounded-2xl mb-8 transition-all duration-300 ${isCyberpunk ? 'bg-black/40 border border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-gray-100 dark:bg-white/5'}`}>
                    {(['shop', 'earn', 'achievements', 'inventory'] as const).map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-2 px-6 rounded-xl text-sm font-bold transition-all duration-300 capitalize ${activeTab === tab ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-[#00f0ff]/50 animate-pulse' : 'bg-white text-gray-900 shadow-lg') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/5' : 'text-gray-400 hover:bg-white/5')}`}>{tab}</button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-10">
                    {activeTab === 'earn' && (
                        <>
                            <DailyQuestWidget isCyberpunk={isCyberpunk} onClaim={(amount) => { addBonus(amount, "Daily Quest"); spawnParticles(window.innerWidth/2, window.innerHeight/2, "#00ff00", 20); }} />
                            <div className={`relative overflow-hidden rounded-3xl p-1 shadow-2xl ${isCyberpunk ? 'bg-gradient-to-r from-[#00f0ff] via-[#ff00ff] to-[#00f0ff]' : 'bg-gradient-to-r from-yellow-500 via-red-500 to-pink-500'}`}>
                                <div className={`rounded-[20px] p-6 flex flex-col gap-6 relative z-10 ${isCyberpunk ? 'bg-black' : 'bg-[#0f172a]'}`}>
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="text-5xl">🎰</div>
                                            <div>
                                                <h3 className={`text-2xl font-black ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Slot Machine</h3>
                                                <p className={`text-sm ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Streak {'>'} 7 Days • Spin Daily • Win Big</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsSlotMachineOpen(true)} className={`px-8 py-3 font-black text-lg rounded-xl shadow-lg transform hover:scale-105 transition-all ${isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.5)]' : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black shadow-orange-500/20'}`}>SPIN</button>
                                    </div>
                                    <div className="w-full border-t border-white/10 pt-4">
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-500'}`}>Weekly Punch Card</p>
                                        <WeeklyPunchCard logs={allLogs} freezeDates={freezeDates || []} isCyberpunk={isCyberpunk} />
                                    </div>
                                </div>
                            </div>
                            <div className={`rounded-3xl p-8 border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-white/5'}`}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}><span className="text-2xl">⚔️</span> Self-Challenges</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsChallengeHistoryOpen(true)} className={`p-2 rounded-xl transition-all ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-slate-700'}`}>History</button>
                                        <button onClick={() => setIsAddChallengeMenuOpen(!isAddChallengeMenuOpen)} className={`p-2 rounded-xl transition-all ${isAddChallengeMenuOpen ? (isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-blue-600 text-white') : (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-slate-700')}`}>+ New</button>
                                    </div>
                                </div>
                                {isAddChallengeMenuOpen && (
                                    <form onSubmit={handleAddChallenge} className={`mb-8 p-4 rounded-2xl border animate-fade-in ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200'}`}>
                                        <div className="flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex-1 w-full">
                                                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block">Title</label>
                                                <input value={newChallengeTitle} onChange={(e) => setNewChallengeTitle(e.target.value)} className={`w-full px-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white border-gray-300'}`} />
                                            </div>
                                            <div className="w-full md:w-32">
                                                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block">Reward</label>
                                                <input type="number" value={newChallengeReward} onChange={(e) => setNewChallengeReward(parseInt(e.target.value))} className={`w-full px-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white border-gray-300'}`} />
                                            </div>
                                            <button type="submit" className={`w-full md:w-auto px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80' : 'bg-blue-600 text-white'}`}>Set Challenge</button>
                                        </div>
                                    </form>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {challenges.filter(c => !c.completedDate).map(c => (
                                        <div key={c.id} className={`group relative p-5 rounded-2xl border transition-all ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 hover:border-[#00f0ff]' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:shadow-md'}`}>
                                            <div className="mb-4">
                                                <h4 className={`font-bold text-lg ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{c.title}</h4>
                                                <p className={`text-xs font-mono mt-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>Reward: {c.reward} 💎</p>
                                            </div>
                                            <button onClick={(e) => handleCompleteChallenge(c.id, e)} className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff]/20' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'}`}>Complete & Claim</button>
                                        </div>
                                    ))}
                                    {challenges.length === 0 && <div className={`col-span-full text-center py-10 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400 dark:text-gray-500'}`}>No active challenges.</div>}
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'shop' && (
                        <div className="space-y-8">
                            <ShopGrid items={orderedShopItems} inventory={inventory} currentGems={currentGems} handleBuy={handleBuy} handleDeleteCustom={async (id) => { const u = await storage.deleteCustomShopItem(id); setCustomShopItems(u||[]); }} isCyberpunk={isCyberpunk} onAddCustom={() => setIsCreateItemModalOpen(true)} onReorder={(ids) => { setShopOrder(ids); localStorage.setItem('focusflow_shop_order', JSON.stringify(ids)); }} shakeItemId={shakeItemId} />
                        </div>
                    )}

                    {activeTab === 'inventory' && <InventoryGrid inventory={inventory} items={orderedShopItems} handleConsume={handleConsume} handleSell={handleSell} isCyberpunk={isCyberpunk} />}

                    {activeTab === 'achievements' && <TrophyRoom 
                        achievements={achievements} 
                        unlockedCount={unlockedCount} 
                        isCyberpunk={isCyberpunk} 
                        filter={badgeFilter} 
                        setFilter={setBadgeFilter}
                        totalFocusTime={totalFocusTime}
                        lastActiveDate={activeProject?.streak?.lastActiveDate || new Date().toISOString()}
                    />}

                </div>
            </div>
        </div>

        {/* Modals */}
        <SlotMachineModal isOpen={isSlotMachineOpen} onClose={() => setIsSlotMachineOpen(false)} isCyberpunk={isCyberpunk} slotItems={slotItems} reelStatuses={reelStatuses} slotMessage={slotMessage} slotRolling={slotRolling} onSpin={handleSlotSpin} />
        <LevelUpModal isOpen={isLevelUpModalOpen} onClose={() => setIsLevelUpModalOpen(false)} level={levelProgress.currentLevel} isCyberpunk={isCyberpunk} />
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} isCyberpunk={isCyberpunk} history={transactions} />
        <EconomyGuideModal isOpen={isEconomyInfoOpen} onClose={() => setIsEconomyInfoOpen(false)} isCyberpunk={isCyberpunk} />
        <CreateItemModal isOpen={isCreateItemModalOpen} onClose={() => setIsCreateItemModalOpen(false)} onCreate={async (item) => { const updated = await storage.saveCustomShopItem(item); setCustomShopItems(updated || []); }} isCyberpunk={isCyberpunk} />
    </div>
  );
};
