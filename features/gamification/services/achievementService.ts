import { Achievement, StudyLog, SessionRecord } from '../../../types';
import { ACHIEVEMENTS_LIST, RANKS } from '../data/achievements';
import { checkSpecialBadges, SPECIAL_BADGES, AchievementWithProgress } from './badgeRules';

type ProcessedAchievement = Achievement & { isUnlocked: boolean; progress: number };

export const getUnlockedAchievements = (
  logs: StudyLog[],
  totalHours: number,
  streak: number,
  sessions: SessionRecord[] = []
): ProcessedAchievement[] => {
  const regularAchievements = ACHIEVEMENTS_LIST.map(ach => {
    const isUnlocked = ach.condition ? ach.condition(logs, totalHours, streak) : false;
    
    let progress = isUnlocked ? 100 : 0;

    if (!isUnlocked) {
        if (ach.id.startsWith('rank_badge_')) {
            const rankTitle = ach.title;
            const rankInfo = RANKS.find(r => r.title === rankTitle);
            if (rankInfo && rankInfo.minHours > 0) {
                progress = Math.floor(Math.min(100, (totalHours / rankInfo.minHours) * 100));
            }
        } else if (ach.id.startsWith('streak_')) {
            const streakDays = parseInt(ach.id.split('_')[1], 10);
            if (!isNaN(streakDays) && streakDays > 0) {
                progress = Math.floor(Math.min(100, (streak / streakDays) * 100));
            }
        }
    }
    
    return { ...ach, isUnlocked, progress } as ProcessedAchievement;
  });

  // For special badges, they need session records for more granular checks.
  // The `logs` (StudyLog[]) are aggregates per day, not suitable for time-based checks.
  const specialBadges: ProcessedAchievement[] = checkSpecialBadges(sessions, streak).map(b => ({
      ...b,
      isUnlocked: b.isUnlocked || false,
  }));

  return [...regularAchievements, ...specialBadges];
};

const getRarityFromGems = (gems: number): string => {
    if (gems >= 1000) return 'legendary';
    if (gems >= 500) return 'epic';
    if (gems >= 200) return 'rare';
    if (gems >= 100) return 'uncommon';
    return 'common';
}

export const getAchievementReward = (badge: Achievement): { gems: number; rarity: string } => {
    const specialBadge = (SPECIAL_BADGES as AchievementWithProgress[]).find(b => b.id === badge.id);
    if (specialBadge) {
        return specialBadge.rewardConfig;
    }

    const gems = badge.reward || 0;
    return {
        gems,
        rarity: getRarityFromGems(gems),
    };
};