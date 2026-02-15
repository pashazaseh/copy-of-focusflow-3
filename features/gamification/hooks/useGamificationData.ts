import { useState, useEffect, useCallback } from 'react';
import * as storageService from '../../../services/storageService';
import { getLevelFromXP } from '../services/levelingService';
import { calculateStreaks } from '../../../services/streakService';
import { getUnlockedAchievements } from '../services/achievementService';
import { InventoryItem, Transaction, Achievement } from '../types';

// Define a local UserProfile type for the hook's state
interface UserProfile {
  name: string;
  avatar: string;
  level: number;
}

/**
 * A hook to fetch and manage all core gamification data.
 * It pulls data from storage and services, and listens for updates.
 */
export const useGamificationData = () => {
  const [profile, setProfile] = useState<UserProfile>({ name: 'User', avatar: '', level: 1 });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const refreshData = useCallback(async () => {
    const logs = await storageService.getLogs();
    
    // Profile & Level
    const totalFocusHours = logs.reduce((acc, log) => acc + log.hours, 0);
    const xp = totalFocusHours * 100;
    const level = getLevelFromXP(xp);
    setProfile({
      name: 'Focus Master',
      avatar: `https://api.pravatar.cc/150?u=${level}`,
      level: level,
    });

    // Achievements
    const { current: streak } = calculateStreaks(logs.map(log => log.date));
    const achievementData = getUnlockedAchievements(logs, totalFocusHours, streak);
    setAchievements(achievementData);

    // Inventory
    try {
      const inventoryData = JSON.parse(localStorage.getItem('focusflow_inventory') || '[]');
      setInventory(Array.isArray(inventoryData) ? inventoryData : []);
    } catch (e) {
      console.error("Failed to parse inventory from localStorage", e);
      setInventory([]);
    }

    // Transactions
    try {
      const transactionsData = JSON.parse(localStorage.getItem('focusflow_transactions') || '[]');
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
    } catch (e) {
      console.error("Failed to parse transactions from localStorage", e);
      setTransactions([]);
    }
  }, []);

  useEffect(() => {
    refreshData();
    
    window.addEventListener('focusflow-gem-update', refreshData);

    return () => {
      window.removeEventListener('focusflow-gem-update', refreshData);
    };
  }, [refreshData]);

  return {
    profile,
    inventory,
    transactions,
    achievements,
    refreshData,
  };
};
