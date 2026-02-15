import { useState, useEffect, useCallback } from 'react';
import * as economyService from '../services/economyService';

const useEconomy = () => {
    const [currentGems, setCurrentGems] = useState(0);

    const refreshBalance = useCallback(async () => {
        const balance = await economyService.getBalance();
        setCurrentGems(balance);
    }, []);

    useEffect(() => {
        refreshBalance();
        window.addEventListener('focusflow-gem-update', refreshBalance);
        return () => window.removeEventListener('focusflow-gem-update', refreshBalance);
    }, [refreshBalance]);

    const spendGems = async (amount: number, description: string) => {
        if (await economyService.canAfford(amount)) {
            await economyService.addTransaction({
                id: `spend-${Date.now()}`,
                date: new Date().toISOString(),
                type: 'SPEND',
                amount: -amount,
                description
            });
            return true;
        }
        return false;
    };

    const addBonus = async (amount: number, description: string) => {
        await economyService.addTransaction({
            id: `bonus-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'EARN',
            amount,
            description
        });
    };

    const canAfford = (amount: number) => currentGems >= amount;

    return { currentGems, spendGems, addBonus, canAfford, refreshBalance };
};

export default useEconomy;