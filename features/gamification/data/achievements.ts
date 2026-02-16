import { Achievement, UserRank } from '../../../types';

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

const RANK_ICONS: Record<string, string> = {
    'Novice': '👶', 'Initiate': '🕯️', 'Apprentice': '🔨', 'Student': '🎒',
    'Scholar': '📜', 'Researcher': '⚗️', 'Specialist': '🔬', 'Expert': '👓',
    'Elite': '⚜️', 'Master': '🥋', 'Grandmaster': '🧘', 'Virtuoso': '🎻',
    'Visionary': '🔮', 'Luminary': '💡', 'Oracle': '👁️', 'Sage': '🧙',
    'Titan': '🗿', 'Demigod': '⚡', 'Time Lord': '⏳', 'Grand Architect': '🏛️',
    'Eternal': '🌌'
};

const STATIC_ACHIEVEMENTS: Omit<Achievement, 'isUnlocked'>[] = [
    { id: 'first_step', title: 'First Step', description: 'Log your first study session', icon: '🌱', reward: 50, condition: (logs) => logs.length > 0 },
    { id: 'streak_3', title: 'Hat Trick', description: 'Maintain a 3-day streak', icon: '⚡', reward: 100, condition: (_, __, s) => s >= 3 },
    { id: 'streak_7', title: 'Unstoppable', description: 'Maintain a 7-day streak', icon: '🚀', reward: 350, condition: (_, __, s) => s >= 7 },
    { id: 'streak_14', title: 'On Fire', description: 'Maintain a 14-day streak', icon: '☄️', reward: 1000, condition: (_, __, s) => s >= 14 },
    { id: 'streak_30', title: 'Habitual', description: 'Maintain a 30-day streak', icon: '📅', reward: 3000, condition: (_, __, s) => s >= 30 },
    { id: 'marathoner', title: 'Marathoner', description: 'Study for 6+ hours in a day', icon: '🏃', reward: 500, condition: (logs) => logs.some(l => l.hours >= 6) },
    { id: 'iron_mind', title: 'Iron Mind', description: 'Study for 10+ hours in a day', icon: '🧠', reward: 1500, condition: (logs) => logs.some(l => l.hours >= 10) },

    // 🧠 DIVERSITY & MANAGEMENT
    { 
        id: 'polymath', 
        title: 'Polymath', 
        description: 'Log time across 3 different projects', 
        icon: '🎨', 
        reward: 300, 
        condition: (logs) => new Set(logs.map(l => l.projectId)).size >= 3 
    },
    { 
        id: 'specialist', 
        title: 'Deep Diver', 
        description: 'Log 50+ hours in a single project', 
        icon: '🤿', 
        reward: 600, 
        condition: (logs) => {
            const projectHours: Record<string, number> = {};
            logs.forEach(l => {
                projectHours[l.projectId] = (projectHours[l.projectId] || 0) + l.hours;
            });
            return Object.values(projectHours).some(h => h >= 50);
        }
    },

    // 🗓️ TIMING & CONSISTENCY
    { 
        id: 'weekend_warrior', 
        title: 'Weekend Warrior', 
        description: 'Log a session on a Saturday and Sunday', 
        icon: '⛺', 
        reward: 150, 
        condition: (logs) => {
            const hasSat = logs.some(l => new Date(l.date).getDay() === 6);
            const hasSun = logs.some(l => new Date(l.date).getDay() === 0);
            return hasSat && hasSun;
        }
    },
    { 
        id: 'centurion', 
        title: 'Centurion', 
        description: 'Complete 100 study sessions', 
        icon: '💯', 
        reward: 1000, 
        condition: (logs) => logs.length >= 100 
    },
    { 
        id: 'streak_60', 
        title: 'Discipline Master', 
        description: 'Maintain a 60-day streak', 
        icon: '👑', 
        reward: 5000, 
        condition: (_, __, s) => s >= 60 
    },

    // 🏋️ ENDURANCE
    { 
        id: 'grind_lord', 
        title: 'Grind Lord', 
        description: 'Study for 12+ hours in a single day', 
        icon: '🦾', 
        reward: 2000, 
        condition: (logs) => logs.some(l => l.hours >= 12) 
    }
];

const RANK_ACHIEVEMENTS: Omit<Achievement, 'isUnlocked'>[] = RANKS.filter(r => r.minHours > 0).map(rank => {
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
        reward: rank.minHours > 0 ? Math.floor(rank.minHours * 2) : 50,
        condition: (_, totalHours) => totalHours >= rank.minHours,
    };
});

export const ACHIEVEMENTS_LIST: Omit<Achievement, 'isUnlocked'>[] = [
    ...STATIC_ACHIEVEMENTS,
    ...RANK_ACHIEVEMENTS
];
