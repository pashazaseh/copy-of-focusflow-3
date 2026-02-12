import { StudyLog, UserRank, Achievement, Task, Project } from '../types';

export const RANKS: UserRank[] = [
    { title: 'Novice I', minHours: 0, color: 'text-gray-500' },
    { title: 'Novice II', minHours: 2, color: 'text-gray-600' },
    { title: 'Novice III', minHours: 5, color: 'text-gray-700' },
    { title: 'Initiate', minHours: 10, color: 'text-stone-500' },
    { title: 'Apprentice I', minHours: 20, color: 'text-emerald-500' },
    { title: 'Apprentice II', minHours: 35, color: 'text-emerald-600' },
    { title: 'Student', minHours: 50, color: 'text-teal-500' },
    { title: 'Scholar I', minHours: 75, color: 'text-cyan-500' },
    { title: 'Scholar II', minHours: 100, color: 'text-cyan-600' },
    { title: 'Researcher', minHours: 150, color: 'text-sky-500' },
    { title: 'Specialist', minHours: 200, color: 'text-blue-500' },
    { title: 'Expert I', minHours: 300, color: 'text-indigo-500' },
    { title: 'Expert II', minHours: 400, color: 'text-indigo-600' },
    { title: 'Elite', minHours: 500, color: 'text-violet-500' },
    { title: 'Master', minHours: 750, color: 'text-purple-500' },
    { title: 'Grandmaster', minHours: 1000, color: 'text-fuchsia-500' },
    { title: 'Virtuoso', minHours: 1500, color: 'text-pink-500' },
    { title: 'Visionary', minHours: 2000, color: 'text-rose-500' },
    { title: 'Luminary', minHours: 3000, color: 'text-red-500' },
    { title: 'Oracle', minHours: 4000, color: 'text-orange-500' },
    { title: 'Sage', minHours: 5000, color: 'text-amber-500' },
    { title: 'Titan', minHours: 7500, color: 'text-yellow-500' },
    { title: 'Demigod', minHours: 10000, color: 'text-lime-500' },
    { title: 'Time Lord', minHours: 15000, color: 'text-green-500' },
    { title: 'Grand Architect', minHours: 20000, color: 'text-emerald-400' },
    { title: 'Eternal', minHours: 30000, color: 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' }
];

// Base Achievements
const STATIC_ACHIEVEMENTS: Achievement[] = [
    // --- Starting Out ---
    {
        id: 'first_step',
        title: 'First Step',
        description: 'Log your first study session',
        icon: '🌱',
        condition: (logs) => logs.length > 0
    },
    // --- Streaks ---
    {
        id: 'streak_3',
        title: 'Hat Trick',
        description: 'Maintain a 3-day streak',
        icon: '⚡',
        condition: (_, __, streak) => streak >= 3
    },
    {
        id: 'streak_7',
        title: 'Unstoppable',
        description: 'Maintain a 7-day streak',
        icon: '🚀',
        condition: (_, __, streak) => streak >= 7
    },
    {
        id: 'streak_14',
        title: 'On Fire',
        description: 'Maintain a 14-day streak',
        icon: '☄️',
        condition: (_, __, streak) => streak >= 14
    },
    {
        id: 'streak_30',
        title: 'Habitual',
        description: 'Maintain a 30-day streak',
        icon: '📅',
        condition: (_, __, streak) => streak >= 30
    },
    // --- Intensity ---
    {
        id: 'marathoner',
        title: 'Marathoner',
        description: 'Study for more than 6 hours in a single day',
        icon: '🏃',
        condition: (logs) => logs.some(l => l.hours >= 6)
    },
    {
        id: 'iron_mind',
        title: 'Iron Mind',
        description: 'Study for more than 10 hours in a single day',
        icon: '🧠',
        condition: (logs) => logs.some(l => l.hours >= 10)
    },
    // --- Timing ---
    {
        id: 'weekend_warrior',
        title: 'Weekender',
        description: 'Log a session on a Saturday or Sunday',
        icon: '🎉',
        condition: (logs) => logs.some(l => {
            const d = new Date(l.date).getDay();
            return d === 0 || d === 6;
        })
    },
    {
        id: 'early_bird',
        title: 'Early Bird',
        description: 'Log a study session before 8 AM', 
        icon: '🌅',
        condition: (logs) => logs.some(l => l.notes && l.notes.toLowerCase().includes("morning"))
    },
    {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Log a study session with "Night" in notes',
        icon: '🦉',
        condition: (logs) => logs.some(l => l.notes && l.notes.toLowerCase().includes("night"))
    },
    // --- Diversity ---
    {
        id: 'diversity_3',
        title: 'King of the Jungle',
        description: 'Log time in 3 different projects',
        icon: '🦁',
        condition: (logs) => new Set(logs.map(l => l.projectId)).size >= 3
    },
    {
        id: 'diversity_5',
        title: 'Octopus',
        description: 'Log time in 5 different projects',
        icon: '🐙',
        condition: (logs) => new Set(logs.map(l => l.projectId)).size >= 5
    },
    // --- Journaling ---
    {
        id: 'notes_10',
        title: 'Scribe',
        description: 'Add notes to 10 different sessions',
        icon: '📝',
        condition: (logs) => logs.filter(l => l.notes && l.notes.length > 0).length >= 10
    },
    {
        id: 'notes_50',
        title: 'Chronicler',
        description: 'Add notes to 50 different sessions',
        icon: '📖',
        condition: (logs) => logs.filter(l => l.notes && l.notes.length > 0).length >= 50
    },
    // --- Deep Work ---
    {
        id: 'deep_3h',
        title: 'Deep Diver',
        description: 'Complete a single session > 3 hours',
        icon: '🧘',
        condition: (logs) => logs.some(l => l.hours >= 3)
    },
    {
        id: 'deep_5h',
        title: 'Monk Mode',
        description: 'Complete a single session > 5 hours',
        icon: '⛩️',
        condition: (logs) => logs.some(l => l.hours >= 5)
    },
    // --- Volume & Consistency ---
    {
        id: 'volume_100',
        title: 'Centurion',
        description: 'Log 100 total study sessions',
        icon: '💯',
        condition: (logs) => logs.length >= 100
    },
    {
        id: 'streak_5',
        title: 'Consistency Is Key',
        description: 'Maintain a 5-day streak',
        icon: '🗓️',
        condition: (_, __, streak) => streak >= 5
    },
    // --- Special ---
    {
        id: 'midnight_oil',
        title: 'Midnight Oil',
        description: 'Log a session mentioning "night" or "late" in notes',
        icon: '🌑',
        condition: (logs) => logs.some(l => l.notes && (l.notes.toLowerCase().includes('night') || l.notes.toLowerCase().includes('late')))
    },
    {
        id: 'gem_hoarder',
        title: 'Gem Hoarder',
        description: 'Accumulate 1,000 Lifetime Gems value (100 hours)',
        icon: '💎',
        condition: (_, totalHours) => totalHours >= 100
    }
];

// Generate Rank-based Badges
const RANK_ICONS: Record<string, string> = {
    'Novice': '👶',
    'Initiate': '🕯️',
    'Apprentice': '🔨',
    'Student': '🎒',
    'Scholar': '📜',
    'Researcher': '⚗️',
    'Specialist': '🔬',
    'Expert': '👓',
    'Elite': '⚜️',
    'Master': '🥋',
    'Grandmaster': '🧘',
    'Virtuoso': '🎻',
    'Visionary': '🔮',
    'Luminary': '💡',
    'Oracle': '👁️',
    'Sage': '🧙',
    'Titan': '🗿',
    'Demigod': '⚡',
    'Time Lord': '⏳',
    'Grand Architect': '🏛️',
    'Eternal': '🌌'
};

const RANK_ACHIEVEMENTS: Achievement[] = RANKS.filter(r => r.minHours > 0).map(rank => {
    // Find best matching icon
    // Sort keys by length descending to ensure "Grandmaster" matches before "Master"
    let icon = '🎖️';
    const sortedKeys = Object.keys(RANK_ICONS).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
        if (rank.title.includes(key)) {
            icon = RANK_ICONS[key];
            break;
        }
    }

    return {
        id: `rank_badge_${rank.title.replace(/\s+/g, '_').toLowerCase()}`,
        title: rank.title,
        description: `Reach ${rank.minHours} total study hours`,
        icon: icon,
        condition: (_, totalHours) => totalHours >= rank.minHours
    };
});

export const ACHIEVEMENTS_LIST: Achievement[] = [
    ...STATIC_ACHIEVEMENTS,
    ...RANK_ACHIEVEMENTS
];

export const getUnlockedAchievements = (logs: StudyLog[], totalHours: number, currentStreak: number): Achievement[] => {
    return ACHIEVEMENTS_LIST.map(achievement => ({
        ...achievement,
        isUnlocked: achievement.condition(logs, totalHours, currentStreak)
    }));
};

export function getDailyQuests(logs: StudyLog[]) {
    const today = new Date().toISOString().split('T')[0];
    const todaysLogs = logs.filter(l => l.date === today);
    const todayHours = todaysLogs.reduce((acc, curr) => acc + curr.hours, 0);
    
    return [
        { 
            id: 1, 
            title: "Focus Scholar", 
            desc: "Study for 1 hour", 
            target: 1, 
            current: todayHours, 
            icon: "📚",
            color: "bg-blue-500",
            reward: 25
        },
        { 
            id: 2, 
            title: "Session Master", 
            desc: "Complete 2 sessions", 
            target: 2, 
            current: todaysLogs.length, 
            icon: "⏱️",
            color: "bg-purple-500",
            reward: 40
        },
        { 
            id: 3, 
            title: "Streak Keeper", 
            desc: "Extend your streak", 
            target: 1, 
            current: todayHours > 0 ? 1 : 0, 
            icon: "🔥",
            color: "bg-orange-500",
            reward: 15
        }
    ];
}

export const getAchievementReward = (achievement: { id: string, title: string, description: string }) => {
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

export const calculateTotalGems = (logs: StudyLog[], totalHours: number, streak: number, bonusGems: number, spentGems: number): number => {
    const earningRate = 10;
    const achievements = getUnlockedAchievements(logs, totalHours, streak);
    const achievementGems = achievements.filter(a => a.isUnlocked).reduce((acc, curr) => acc + getAchievementReward(curr).gems, 0);
    
    const quests = getDailyQuests(logs);
    const questGems = quests.filter(q => q.current >= q.target).reduce((acc, curr) => acc + curr.reward, 0);

    const rawBalance = Math.floor(totalHours * earningRate) + achievementGems + questGems + bonusGems - spentGems;
    return Math.max(0, rawBalance);
};

export const calculateDailyTickTickProgress = (tasks: Task[]): number => {
    const tickTickTasks = tasks.filter(t => t.tickTickId);
    if (tickTickTasks.length === 0) return 0;
    const completed = tickTickTasks.filter(t => t.isCompleted).length;
    return Math.round((completed / tickTickTasks.length) * 100);
};

// Helper to match App.tsx local date format (YYYY-MM-DD)
const getLocalDate = (date: Date = new Date()) => {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

// Helper
const isYesterday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterdayStr = getLocalDate(d);
    return dateStr === yesterdayStr;
};

// Project Trophies Definition
export const PROJECT_TROPHIES = [
    { id: 'streak_3', icon: '🔥', name: 'Momentum', description: '3 Day Streak', condition: (p: Project) => (p.streak?.current || 0) >= 3 },
    { id: 'streak_7', icon: '🚀', name: 'Dedicated', description: '7 Day Streak', condition: (p: Project) => (p.streak?.current || 0) >= 7 },
    { id: 'hours_10', icon: '⚔️', name: 'Novice', description: '10 Hours', condition: (p: Project) => (p.totalHours || 0) >= 10 },
    { id: 'hours_50', icon: '🛡️', name: 'Expert', description: '50 Hours', condition: (p: Project) => (p.totalHours || 0) >= 50 },
];

export const handleSessionComplete = (
    currentProject: Project, 
    userBank: number, 
    minutes: number
) => {
    const today = getLocalDate();
    const earnedCoins = Math.floor(minutes / 5); // Example: 1 coin per 5 mins

    // 1. Update Global Economy
    const newGlobalBank = userBank + earnedCoins;

    // 2. Update Project Specific Streak
    let newStreak = currentProject.streak?.current || 0;
    const lastActive = currentProject.streak?.lastActiveDate || '';

    if (lastActive === today) {
        // Already worked on this today, do nothing
    } else if (isYesterday(lastActive)) {
        // Continued streak
        newStreak += 1;
    } else {
        // Broken streak (for this project only!)
        newStreak = 1;
    }
    
    const newTotalHours = (currentProject.totalHours || 0) + (minutes / 60);

    // 3. Check Project Specific Trophies
    const unlockedTrophies = new Set(currentProject.unlockedTrophies || []);
    // Create a temporary object to test conditions against the *new* stats
    const tempProjectState = { 
        ...currentProject, 
        streak: { current: newStreak, best: 0, lastActiveDate: today },
        totalHours: newTotalHours
    };

    PROJECT_TROPHIES.forEach(trophy => {
        if (!unlockedTrophies.has(trophy.id) && trophy.condition(tempProjectState)) {
            unlockedTrophies.add(trophy.id);
        }
    });

    return {
        updatedProject: {
            ...currentProject,
            streak: { current: newStreak, best: Math.max(newStreak, currentProject.streak?.best || 0), lastActiveDate: today },
            totalHours: newTotalHours,
            unlockedTrophies: Array.from(unlockedTrophies)
        },
        updatedGlobalBank: newGlobalBank
    };
};