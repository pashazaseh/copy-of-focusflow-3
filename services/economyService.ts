import * as storage from './storageService';
import { getUnlockedAchievements, getAchievementReward } from '../features/gamification/services/achievementService';
import { getDailyQuests } from '../features/gamification/services/questService';
import { calculateStreaks } from './streakService';
import { Transaction } from '../types';

const STORAGE_KEYS = {
    SPENT: 'focusflow_spent_gems',
    BONUS: 'focusflow_bonus_gems',
};

export const getBalance = async (): Promise<number> => {
    const logs = await storage.getLogs();
    const spent = parseInt(localStorage.getItem(STORAGE_KEYS.SPENT) || '0') || 0;
    const bonus = parseInt(localStorage.getItem(STORAGE_KEYS.BONUS) || '0') || 0;

    const totalHours = logs.reduce((acc, curr) => acc + curr.hours, 0);
    
    const freezeDates = JSON.parse(localStorage.getItem('focusflow_freeze_dates') || '[]');
    const activeDates = [...logs.filter(l => l.hours > 0).map(l => l.date), ...freezeDates];
    const streaks = calculateStreaks(activeDates);

    const achievements = getUnlockedAchievements(logs, totalHours, streaks.current);
    const achievementGems = achievements.filter(a => a.isUnlocked).reduce((acc, curr) => acc + getAchievementReward(curr).gems, 0);

    const quests = getDailyQuests(logs);
    const questGems = quests.filter(q => q.current >= q.target).reduce((acc, curr) => acc + curr.reward, 0);

    const earningRate = 10;
    const earned = Math.floor(totalHours * earningRate) + achievementGems + questGems + bonus;
    
    return Math.max(0, earned - spent);
};

export const addTransaction = async (transaction: Transaction): Promise<void> => {
    if (transaction.type === 'SPEND') {
        const currentSpent = parseInt(localStorage.getItem(STORAGE_KEYS.SPENT) || '0') || 0;
        localStorage.setItem(STORAGE_KEYS.SPENT, (currentSpent + Math.abs(transaction.amount)).toString());
    } else if (transaction.type === 'EARN') {
        const currentBonus = parseInt(localStorage.getItem(STORAGE_KEYS.BONUS) || '0') || 0;
        localStorage.setItem(STORAGE_KEYS.BONUS, (currentBonus + transaction.amount).toString());
    }

    await storage.addTransaction(transaction);
    window.dispatchEvent(new Event('focusflow-gem-update'));
};

export const canAfford = async (cost: number): Promise<boolean> => {
    const balance = await getBalance();
    return balance >= cost;
};