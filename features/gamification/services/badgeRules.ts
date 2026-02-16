import { SessionRecord, Achievement } from '../../../types';

/**
 * This file contains the logic for detecting specific, complex user behaviors
 * that result in unlocking "Special Badges". It operates on raw session data
 * to enable time-based and fine-grained analysis.
 */

/**
 * A richer achievement object that includes dynamic progress and detailed reward info.
 * This is used to provide more context to the UI than a static Achievement object.
 */
export interface AchievementWithProgress extends Achievement {
    progress: number;
    rewardConfig: {
        gems: number;
        rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
    };
}

/**
 * A static list of all special badges available. This serves as the definition
 * for what `checkSpecialBadges` will test against.
 */
export const SPECIAL_BADGES: Omit<AchievementWithProgress, 'isUnlocked' | 'progress'>[] = [
    {
        id: 'early_bird',
        title: 'Early Bird',
        description: 'Complete a focus session before 6:00 AM.',
        icon: '🌅',
        rewardConfig: { gems: 100, rarity: 'uncommon' }
    },
    {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Complete a focus session after 10:00 PM or before 4:00 AM.',
        icon: '🦉',
        rewardConfig: { gems: 100, rarity: 'uncommon' }
    },
    {
        id: 'marathoner',
        title: 'Marathoner',
        description: 'Complete a single session longer than 4 hours.',
        icon: '🏃',
        rewardConfig: { gems: 200, rarity: 'rare' }
    },
    {
        id: 'weekend_warrior',
        title: 'Weekend Warrior',
        description: 'Accumulate 10+ hours on a single weekend (Sat+Sun).',
        icon: '⚔️',
        rewardConfig: { gems: 150, rarity: 'rare' }
    }
];

/**
 * Helper function to get the ISO week number for a given date.
 * @param d The date to process.
 * @returns The week number.
 */
function getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

/**
 * Processes a user's session history to check which special badges they have earned.
 *
 * @param sessions An array of the user's study sessions. Using SessionRecord allows for precise time-based checks.
 * @param streak The user's current streak (some badges might depend on it).
 * @returns An array of badge objects, each updated with their unlocked status and progress.
 */
export const checkSpecialBadges = (sessions: SessionRecord[], streak: number): AchievementWithProgress[] => {
    const unlockedBadgeIds = new Set<string>();

    // --- Badge Logic Implementation ---

    // 1. Early Bird: Checks for any session that started before 6 AM.
    if (sessions.some(s => new Date(s.startTime).getHours() < 6)) {
        unlockedBadgeIds.add('early_bird');
    }

    // 2. Night Owl: Checks for sessions after 10 PM or before 4 AM.
    if (sessions.some(s => {
        const hour = new Date(s.startTime).getHours();
        return hour > 22 || hour < 4; // >22 means 23:00 (11 PM) onwards
    })) {
        unlockedBadgeIds.add('night_owl');
    }

    // 3. Marathoner: Checks for any single session longer than 4 hours (14400 seconds).
    if (sessions.some(s => s.duration > 4 * 60 * 60)) {
        unlockedBadgeIds.add('marathoner');
    }

    // 4. Weekend Warrior: Groups session hours by week to check for 10+ hours on a Sat/Sun.
    const weeklyHours: { [weekKey: string]: number } = {};
    sessions.forEach(s => {
        const d = new Date(s.startTime);
        const day = d.getDay(); // 0=Sun, 6=Sat
        if (day === 0 || day === 6) {
            const year = d.getFullYear();
            const week = getWeekNumber(d);
            const weekKey = `${year}-${week}`;
            weeklyHours[weekKey] = (weeklyHours[weekKey] || 0) + (s.duration / 3600);
        }
    });

    for (const weekKey in weeklyHours) {
        if (weeklyHours[weekKey] > 10) {
            unlockedBadgeIds.add('weekend_warrior');
            break;
        }
    }
    
    // --- Result Mapping ---

    // Map the static badge definitions to a dynamic result array,
    // including the calculated unlocked status and progress.
    return SPECIAL_BADGES.map(badge => {
        const isUnlocked = unlockedBadgeIds.has(badge.id);
        return {
            ...badge,
            isUnlocked,
            // For these simple badges, progress is binary: 0% or 100%.
            progress: isUnlocked ? 100 : 0, 
        };
    });
};
