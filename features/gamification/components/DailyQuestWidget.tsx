import React, { useState, useEffect, useCallback } from 'react';
import { useEconomy } from '../hooks/useEconomy';
import { getDailyQuests } from '../services/questService';
import { useLogs } from '../../../AppContext';

interface Quest {
    id: number;
    title: string;
    desc: string;
    target: number;
    current: number;
    icon: string;
    color: string;
    reward: number;
    isClaimed?: boolean;
}

export const DailyQuestWidget: React.FC = () => {
    const [quests, setQuests] = useState<Quest[]>([]);
    const { addBonus } = useEconomy();
    const { logs } = useLogs();

    const loadQuests = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        const storedQuestsItem = localStorage.getItem('focusflow_daily_quests');
        
        if (storedQuestsItem) {
            const { date, quests: storedQuests } = JSON.parse(storedQuestsItem);
            if (date === today) {
                // To ensure progress is updated, re-evaluate `current` property
                const dailyQuests = getDailyQuests(logs);
                const updatedQuests = storedQuests.map((sq: Quest) => {
                    const freshQuest = dailyQuests.find(q => q.id === sq.id);
                    return { ...sq, current: freshQuest ? freshQuest.current : sq.current };
                });

                setQuests(updatedQuests);
                return;
            }
        }

        // No valid quests for today, generate new ones
        const newQuests = getDailyQuests(logs).map(q => ({ ...q, isClaimed: false }));
        localStorage.setItem('focusflow_daily_quests', JSON.stringify({ date: today, quests: newQuests }));
        setQuests(newQuests);
    }, [logs]);

    useEffect(() => {
        loadQuests();
    }, [loadQuests]);

    const handleClaim = (quest: Quest) => {
        if (quest.current >= quest.target && !quest.isClaimed) {
            addBonus(quest.reward, `Daily Quest: ${quest.title}`);
            
            const updatedQuests = quests.map(q => 
                q.id === quest.id ? { ...q, isClaimed: true } : q
            );
            setQuests(updatedQuests);
            
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('focusflow_daily_quests', JSON.stringify({ date: today, quests: updatedQuests }));
        }
    };

    return (
        <div className="bg-gray-900/50 border border-purple-500/20 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-purple-300 text-center">Daily Quests</h2>
            {quests.map(quest => {
                const isComplete = quest.current >= quest.target;
                const progress = isComplete ? 100 : (quest.current / quest.target) * 100;
                
                return (
                    <div key={quest.id} className="bg-black/40 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{quest.icon}</span>
                                <p className="font-semibold text-white">{quest.title}</p>
                            </div>
                            <span className="font-mono text-purple-400 text-sm">+{quest.reward} 💎</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-2.5 w-full rounded-full bg-gray-700 mb-2">
                            <div 
                                className={`h-2.5 rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-purple-600'}`}
                                style={{ width: `${progress}%`}}
                            ></div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                             <p className="text-xs text-gray-400">{quest.desc}</p>
                             <button
                                onClick={() => handleClaim(quest)}
                                disabled={!isComplete || quest.isClaimed}
                                className="text-xs font-bold py-1 px-3 rounded-md transition-all duration-200 disabled:bg-gray-600 disabled:text-gray-400 enabled:bg-green-600 enabled:hover:bg-green-500 text-white"
                            >
                                {quest.isClaimed ? 'Claimed' : 'Claim Reward'}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
