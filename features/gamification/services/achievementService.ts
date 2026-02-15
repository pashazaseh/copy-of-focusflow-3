import { StudyLog } from '../../../types';
import { ACHIEVEMENTS_LIST } from '../data/achievements';
import { Achievement } from '../types';

/**
 * Takes a list of study logs and user stats and returns a full list of achievements with their unlocked status.
 * @param logs - Array of all study logs for the user.
 * @param totalHours - Total focused hours for the user.
 * @param currentStreak - The user's current daily streak.
 * @returns An array of all achievements, with an `isUnlocked` flag.
 */
export const getUnlockedAchievements = (
  logs: StudyLog[],
  totalHours: number,
  currentStreak: number
): Achievement[] => {
  const safeLogs = Array.isArray(logs) ? logs : [];
  
  return ACHIEVEMENTS_LIST.map(achievement => ({
    ...achievement,
    isUnlocked: achievement.condition(safeLogs, totalHours, currentStreak),
  }));
};

export const getAchievementReward = (achievement: { id: string, title: string, description: string, reward?: number }) => {
    if (achievement.reward !== undefined) {
        let rarity = 'common';
        if (achievement.reward >= 5000) rarity = 'legendary';
        else if (achievement.reward >= 2500) rarity = 'mythic';
        else if (achievement.reward >= 1000) rarity = 'epic';
        else if (achievement.reward >= 500) rarity = 'rare';
        else if (achievement.reward >= 250) rarity = 'uncommon';
        return { gems: achievement.reward, rarity, label: rarity.charAt(0).toUpperCase() + rarity.slice(1) };
    }

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
