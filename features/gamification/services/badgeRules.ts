import { SessionRecord, Achievement } from '../../../types';

export interface AchievementWithProgress extends Achievement {
    progress: number;
    rewardConfig: {
        gems: number;
        rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
    };
}

export const SPECIAL_BADGES: AchievementWithProgress[] = [
    {
        id: 'early_bird',
        title: 'Early Bird',
        description: 'Complete a focus session before 8:00 AM.',
        icon: '🌅',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 100, rarity: 'uncommon' }
    },
    {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Complete a focus session after 11:00 PM.',
        icon: '🦉',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 100, rarity: 'uncommon' }
    },
    {
        id: 'marathon_runner',
        title: 'Marathon Runner',
        description: 'Complete a single session longer than 2 hours.',
        icon: '🏃',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 200, rarity: 'rare' }
    },
    {
        id: 'consistency_king',
        title: 'Consistency King',
        description: 'Reach a 7-day streak.',
        icon: '👑',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 500, rarity: 'epic' }
    },
    {
        id: 'weekend_warrior',
        title: 'Weekend Warrior',
        description: 'Accumulate 5+ hours on a Saturday or Sunday.',
        icon: '⚔️',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 150, rarity: 'rare' }
    },
    {
        id: 'deep_diver',
        title: 'Deep Diver',
        description: 'Complete 4 focus sessions in a single day.',
        icon: '🤿',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 150, rarity: 'rare' }
    },
    {
        id: 'task_slayer',
        title: 'Task Slayer',
        description: 'Complete 10 sessions linked to a task.',
        icon: '⚔️',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 200, rarity: 'rare' }
    },
    {
        id: 'project_devotee',
        title: 'Project Devotee',
        description: 'Spend 10+ hours on a single project.',
        icon: '🏗️',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 300, rarity: 'epic' }
    },
    {
        id: 'zen_master',
        title: 'Zen Master',
        description: 'Accumulate 100 total hours of focus time.',
        icon: '🧘',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 1000, rarity: 'legendary' }
    },
    {
        id: 'centurion',
        title: 'Centurion',
        description: 'Complete 100 focus sessions.',
        icon: '💯',
        isUnlocked: false,
        progress: 0,
        rewardConfig: { gems: 500, rarity: 'epic' }
    }
];

export const checkSpecialBadges = (sessions: SessionRecord[], streak: number): AchievementWithProgress[] => {
    const badges = JSON.parse(JSON.stringify(SPECIAL_BADGES)) as AchievementWithProgress[];

    // 1. Early Bird
    const hasEarlySession = sessions.some(s => {
        const date = new Date(s.startTime);
        return date.getHours() < 8;
    });
    badges[0].isUnlocked = hasEarlySession;
    badges[0].progress = hasEarlySession ? 100 : 0;

    // 2. Night Owl
    const hasLateSession = sessions.some(s => {
        const date = new Date(s.startTime);
        return date.getHours() >= 23;
    });
    badges[1].isUnlocked = hasLateSession;
    badges[1].progress = hasLateSession ? 100 : 0;

    // 3. Marathon Runner
    const hasLongSession = sessions.some(s => s.duration >= 2 * 60 * 60); // 2 hours in seconds
    badges[2].isUnlocked = hasLongSession;
    badges[2].progress = hasLongSession ? 100 : 0;

    // 4. Consistency King
    badges[3].isUnlocked = streak >= 7;
    badges[3].progress = Math.min(100, (streak / 7) * 100);

    // 5. Weekend Warrior
    const weekendHours: Record<string, number> = {};
    sessions.forEach(s => {
        const date = new Date(s.startTime);
        const day = date.getDay();
        if (day === 0 || day === 6) { // Sun or Sat
            const dateStr = date.toDateString();
            weekendHours[dateStr] = (weekendHours[dateStr] || 0) + s.duration;
        }
    });
    const hasWeekendWarrior = Object.values(weekendHours).some(duration => duration >= 5 * 60 * 60);
    badges[4].isUnlocked = hasWeekendWarrior;
    badges[4].progress = hasWeekendWarrior ? 100 : 0;

    // 6. Deep Diver
    const sessionsByDay: Record<string, number> = {};
    sessions.forEach(s => {
        const dateStr = new Date(s.startTime).toDateString();
        sessionsByDay[dateStr] = (sessionsByDay[dateStr] || 0) + 1;
    });
    const maxSessionsInDay = Math.max(0, ...Object.values(sessionsByDay));
    badges[5].isUnlocked = maxSessionsInDay >= 4;
    badges[5].progress = Math.min(100, (maxSessionsInDay / 4) * 100);

    // 7. Task Slayer
    const taskSessions = sessions.filter(s => !!s.taskId).length;
    badges[6].isUnlocked = taskSessions >= 10;
    badges[6].progress = Math.min(100, (taskSessions / 10) * 100);

    // 8. Project Devotee
    const projectHours: Record<string, number> = {};
    sessions.forEach(s => {
        if (s.projectId) {
            projectHours[s.projectId] = (projectHours[s.projectId] || 0) + s.duration;
        }
    });
    const maxProjectDuration = Math.max(0, ...Object.values(projectHours));
    const hoursOnProject = maxProjectDuration / 3600;
    badges[7].isUnlocked = hoursOnProject >= 10;
    badges[7].progress = Math.min(100, (hoursOnProject / 10) * 100);

    // 9. Zen Master
    const totalSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
    const totalHours = totalSeconds / 3600;
    badges[8].isUnlocked = totalHours >= 100;
    badges[8].progress = Math.min(100, (totalHours / 100) * 100);

    // 10. Centurion
    const totalSessions = sessions.length;
    badges[9].isUnlocked = totalSessions >= 100;
    badges[9].progress = Math.min(100, (totalSessions / 100) * 100);

    return badges;
};