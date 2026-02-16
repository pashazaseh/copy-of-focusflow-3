import { useState, useEffect, useCallback } from 'react';
import { useLogs } from '../../../AppContext';
import { Transaction } from '../../../types';

export const validateEconomy = () => {
    console.log("Running economy validation...");
    if (typeof window === 'undefined') return;

    try {
        let bonusGems = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0', 10);
        let spentGems = parseInt(localStorage.getItem('focusflow_spent_gems') || '0', 10);
        let needsUpdate = false;

        if (isNaN(bonusGems)) {
            bonusGems = 0;
            localStorage.setItem('focusflow_bonus_gems', '0');
            needsUpdate = true;
        }

        if (isNaN(spentGems)) {
            spentGems = 0;
            localStorage.setItem('focusflow_spent_gems', '0');
            needsUpdate = true;
        }

        const logsRaw = localStorage.getItem('focusflow_logs');
        let logs: any[] = [];
        try {
            logs = logsRaw ? JSON.parse(logsRaw) : [];
        } catch (e) {
            console.error("Failed to parse logs for economy validation", e);
        }
        
        if (Array.isArray(logs)) {
            const totalHours = logs.reduce((acc: number, log: any) => acc + (log.hours || 0), 0);
            const earnedGems = Math.floor(totalHours * 10);
            const totalAvailable = earnedGems + bonusGems;

            if (spentGems > totalAvailable) {
                console.warn(`Economy Validation: Resetting spentGems from ${spentGems} to ${totalAvailable} to prevent negative balance.`);
                spentGems = totalAvailable;
                localStorage.setItem('focusflow_spent_gems', spentGems.toString());
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            window.dispatchEvent(new Event('focusflow-gem-update'));
        }
    } catch (e) {
        console.error('Economy validation failed:', e);
    }
};

export const useEconomy = () => {
    const { logs, addTransaction } = useLogs();

    // Initialize state from localStorage to avoid hydration mismatch or delay
    const [bonusGems, setBonusGems] = useState(() => {
        if (typeof window !== 'undefined') {
            return parseInt(localStorage.getItem('focusflow_bonus_gems') || '0', 10);
        }
        return 0;
    });

    const [spentGems, setSpentGems] = useState(() => {
        if (typeof window !== 'undefined') {
            return parseInt(localStorage.getItem('focusflow_spent_gems') || '0', 10);
        }
        return 0;
    });

    useEffect(() => {
        validateEconomy();
    }, []);

    // Sync with localStorage changes (cross-tab or other components)
    useEffect(() => {
        const handleStorageUpdate = () => {
            const savedBonus = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0', 10);
            const savedSpent = parseInt(localStorage.getItem('focusflow_spent_gems') || '0', 10);
            setBonusGems(savedBonus);
            setSpentGems(savedSpent);
        };

        window.addEventListener('focusflow-gem-update', handleStorageUpdate);
        window.addEventListener('storage', handleStorageUpdate);

        return () => {
            window.removeEventListener('focusflow-gem-update', handleStorageUpdate);
            window.removeEventListener('storage', handleStorageUpdate);
        };
    }, []);

    // Calculate Earned Gems (10 Gems per hour)
    const totalHours = logs.reduce((acc, log) => acc + log.hours, 0);
    const earnedGems = Math.floor(totalHours * 10);

    // Calculate Current Balance
    const currentGems = Math.max(0, earnedGems + bonusGems - spentGems);

    const canAfford = useCallback((amount: number) => {
        return currentGems >= amount;
    }, [currentGems]);

    const spendGems = useCallback((amount: number, description: string) => {
        if (currentGems < amount) {
            console.error('Insufficient Funds: Cannot spend ' + amount + ' gems. Current balance: ' + currentGems);
            return false;
        }

        setSpentGems(prev => {
            const newSpent = prev + amount;
            localStorage.setItem('focusflow_spent_gems', newSpent.toString());
            return newSpent;
        });

        const transaction: Transaction = {
            id: `spend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            type: 'SPEND',
            amount: -amount,
            description
        };
        addTransaction(transaction);
        
        // Dispatch event to notify other components
        window.dispatchEvent(new Event('focusflow-gem-update'));
        return true;
    }, [currentGems, addTransaction]);

    const addBonus = useCallback((amount: number, description: string) => {
        setBonusGems(prev => {
            const newBonus = prev + amount;
            localStorage.setItem('focusflow_bonus_gems', newBonus.toString());
            return newBonus;
        });

        const transaction: Transaction = {
            id: `bonus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            type: 'WIN',
            amount: amount,
            description
        };
        addTransaction(transaction);

        window.dispatchEvent(new Event('focusflow-gem-update'));
    }, [addTransaction]);

    return {
        currentGems,
        earnedGems,
        bonusGems,
        spentGems,
        spendGems,
        addBonus,
        canAfford
    };
};