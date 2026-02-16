export interface Rank {
    id: string;
    title: string;
    minHours: number;
    icon: string;
    reward: number;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'mythic' | 'legendary';
}

export interface Badge {
    id: string;
    title: string;
    icon: string;
    reward: number;
    desc?: string;
    days?: number;
    type?: 'rank' | 'streak' | 'special';
}

export const RANKS: Rank[] = [
    { id: 'iron', title: 'Iron', minHours: 0, icon: '🛡️', reward: 0, rarity: 'common' },
    { id: 'bronze', title: 'Bronze', minHours: 10, icon: '🥉', reward: 50, rarity: 'common' },
    { id: 'silver', title: 'Silver', minHours: 50, icon: '🥈', reward: 150, rarity: 'uncommon' },
    { id: 'gold', title: 'Gold', minHours: 100, icon: '🥇', reward: 300, rarity: 'rare' },
    { id: 'platinum', title: 'Platinum', minHours: 250, icon: '💠', reward: 500, rarity: 'rare' },
    { id: 'diamond', title: 'Diamond', minHours: 500, icon: '💎', reward: 1000, rarity: 'epic' },
    { id: 'master', title: 'Master', minHours: 1000, icon: '👑', reward: 2500, rarity: 'mythic' },
    { id: 'grandmaster', title: 'Grandmaster', minHours: 2500, icon: '👹', reward: 5000, rarity: 'legendary' },
    { id: 'radiant', title: 'Radiant', minHours: 5000, icon: '🌟', reward: 10000, rarity: 'legendary' }
];

export const STREAK_BADGES: Badge[] = [
    { id: 'streak_3', title: 'Momentum', days: 3, icon: '🔥', reward: 50, desc: 'Maintain a 3-day streak.' },
    { id: 'streak_7', title: 'On Fire', days: 7, icon: '🧨', reward: 150, desc: 'Maintain a 7-day streak.' },
    { id: 'streak_30', title: 'Unstoppable', days: 30, icon: '🚀', reward: 1000, desc: 'Maintain a 30-day streak.' },
    { id: 'streak_100', title: 'Godlike', days: 100, icon: '⚡', reward: 5000, desc: 'Maintain a 100-day streak.' }
];

export const SPECIAL_BADGES: Badge[] = [
    { id: 'early_bird', title: 'Early Bird', icon: '🌅', reward: 100, desc: 'Complete a session before 6 AM.' },
    { id: 'night_owl', title: 'Night Owl', icon: '🦉', reward: 100, desc: 'Complete a session after 2 AM.' },
    { id: 'marathoner', title: 'Marathoner', icon: '🏃', reward: 300, desc: 'Record a single session > 4 hours.' },
    { id: 'weekend_warrior', title: 'Weekend Warrior', icon: '⚔️', reward: 200, desc: 'Log 10 hours in a single weekend.' }
];

export const ACHIEVEMENTS = [
    ...STREAK_BADGES,
    ...SPECIAL_BADGES
];

export const getAllBadges = () => {
    return [
        ...RANKS.map(r => ({ ...r, type: 'rank' })),
        ...STREAK_BADGES.map(b => ({ ...b, type: 'streak' })),
        ...SPECIAL_BADGES.map(b => ({ ...b, type: 'special' }))
    ];
};