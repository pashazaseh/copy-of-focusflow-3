import { StudyLog } from '../../../types';

export interface Quest {
    id: string;
    title: string;
    description: string;
    target: number;
    current: number;
    reward: number;
    type: 'focus_time' | 'sessions';
    isClaimed: boolean;
    icon: string;
}

const QUEST_TEMPLATES = [
    { title: 'Focus Master', description: 'Focus for {target} hours', type: 'focus_time', baseTarget: 2, rewardPerUnit: 20, icon: '⏱️' },
    { title: 'Session Sprinter', description: 'Complete {target} sessions', type: 'sessions', baseTarget: 3, rewardPerUnit: 15, icon: '🔥' },
    { title: 'Deep Work', description: 'Focus for {target} hours', type: 'focus_time', baseTarget: 4, rewardPerUnit: 25, icon: '🧠' },
    { title: 'Consistency', description: 'Complete {target} sessions', type: 'sessions', baseTarget: 1, rewardPerUnit: 10, icon: '⚡' }
];

export const generateDailyQuests = (): Quest[] => {
    const shuffled = [...QUEST_TEMPLATES].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    return selected.map((template, index) => {
        const multiplier = Math.floor(Math.random() * 2) + 1;
        const target = template.baseTarget * multiplier;
        const reward = Math.floor(target * template.rewardPerUnit);
        
        return {
            id: `quest_${Date.now()}_${index}`,
            title: template.title,
            description: template.description.replace('{target}', target.toString()),
            target: target,
            current: 0,
            reward: reward,
            type: template.type as any,
            isClaimed: false,
            icon: template.icon
        };
    });
};

export const calculateQuestProgress = (quests: Quest[], logs: StudyLog[]): Quest[] => {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.date === today);
    
    const focusTime = todayLogs.reduce((acc, log) => acc + log.hours, 0);
    const sessions = todayLogs.length;

    return quests.map(q => {
        if (q.isClaimed) return q;
        let progress = 0;
        if (q.type === 'focus_time') progress = focusTime;
        else if (q.type === 'sessions') progress = sessions;
        return { ...q, current: progress };
    });
};

// Deprecated: Kept for compatibility if needed
export const getDailyQuests = (logs: StudyLog[]): Quest[] => {
    return [];
};