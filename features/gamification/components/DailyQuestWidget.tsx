import React, { useState, useEffect, useCallback } from 'react';
import { useEconomy } from '../hooks/useEconomy';
import { generateDailyQuests, calculateQuestProgress, Quest } from '../services/questService';
import { useLogs } from '../../../AppContext';

export const DailyQuestWidget: React.FC = () => {
    const [quests, setQuests] = useState<Quest[]>([]);
    const { addBonus } = useEconomy();
    const { logs } = useLogs();

    const loadQuests = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        const storedQuestsItem = localStorage.getItem('focusflow_daily_quests');
        
        let currentQuests: Quest[] = [];

        if (storedQuestsItem) {
            try {
                const parsed = JSON.parse(storedQuestsItem);
                if (parsed.date === today && Array.isArray(parsed.quests)) {
                    currentQuests = parsed.quests;
                }
            } catch (e) {
                console.error("Failed to parse daily quests", e);
            }
        }

        if (currentQuests.length === 0) {
            currentQuests = generateDailyQuests();
            localStorage.setItem('focusflow_daily_quests', JSON.stringify({ date: today, quests: currentQuests }));
        }

        // Update progress based on logs
        const updatedQuests = calculateQuestProgress(currentQuests, logs);
        setQuests(updatedQuests);
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
                const progress = isComplete ? 100 : (quest.target > 0 ? (quest.current / quest.target) * 100 : 0);
                
                return (
                    <div key={quest.id} className="bg-black/40 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
\
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
                             <p className="text-xs text-gray-400">{quest.description}</p>
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
