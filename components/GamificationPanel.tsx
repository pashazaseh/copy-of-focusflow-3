import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StudyLog } from '../types';
import { getUnlockedAchievements, RANKS } from '../services/gamificationService';

interface GamificationPanelProps {
  allLogs: StudyLog[];
  totalHours: number;
  streak: number;
}

export const GamificationPanel: React.FC<GamificationPanelProps> = ({ allLogs = [], totalHours = 0, streak = 0 }) => {
  const achievements = useMemo(() => getUnlockedAchievements(allLogs, totalHours, streak), [allLogs, totalHours, streak]);
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  // --- Inventory & Economy State ---
  const [spentGems, setSpentGems] = useState(() => {
      if (typeof window === 'undefined') return 0;
      const val = parseInt(localStorage.getItem('focusflow_spent_gems') || '0');
      return isNaN(val) ? 0 : val;
  });
  const [bonusGems, setBonusGems] = useState(() => {
      if (typeof window === 'undefined') return 0;
      const val = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0');
      return isNaN(val) ? 0 : val;
  });
  const [inventory, setInventory] = useState<Record<string, any>>(() => {
      if (typeof window === 'undefined') return {};
      try {
          return JSON.parse(localStorage.getItem('focusflow_inventory') || '{}');
      } catch (e) {
          return {};
      }
  });

  // --- Filters ---
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  // Optimization: Track last known inventory string to avoid unnecessary parsing
  const lastInventoryStr = useRef(typeof window !== 'undefined' ? localStorage.getItem('focusflow_inventory') || '{}' : '{}');

  // Sync ref when inventory changes (e.g. from buying items)
  useEffect(() => {
      if (typeof window !== 'undefined') {
          lastInventoryStr.current = JSON.stringify(inventory);
      }
  }, [inventory]);

  // Refresh inventory from local storage periodically to sync with App.tsx
  useEffect(() => {
      const interval = setInterval(() => {
          if (typeof window === 'undefined') return;
          
          const rawInv = localStorage.getItem('focusflow_inventory') || '{}';
          const storedBonusVal = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0');
          const storedBonus = isNaN(storedBonusVal) ? 0 : storedBonusVal;
          
          if (rawInv !== lastInventoryStr.current) {
              try {
                  setInventory(JSON.parse(rawInv));
                  lastInventoryStr.current = rawInv;
              } catch (e) { /* ignore */ }
          }
          if (storedBonus !== bonusGems) {
              setBonusGems(storedBonus);
          }
      }, 2000);
      return () => clearInterval(interval);
  }, [bonusGems]);


  // --- Rewards Logic ---
  const getAchievementReward = (achievement: { title: string, description: string }) => {
      // Rank based rewards
      const rank = RANKS.find(r => r.title === achievement.title);
      if (rank) {
          return Math.max(50, rank.minHours * 10);
      }

      // Streak based
      const desc = achievement.description.toLowerCase();
      if (desc.includes('streak')) {
          if (desc.includes('30-day')) return 500;
          if (desc.includes('14-day')) return 250;
          if (desc.includes('7-day')) return 100;
          return 50;
      }

      // Intensity based
      if (desc.includes('hours in a single day')) {
          if (desc.includes('10 hours')) return 300;
          if (desc.includes('6 hours')) return 150;
      }

      return 25; // Default
  };

  const achievementsWithRewards = useMemo(() => {
      const getProgress = (achievement: typeof achievements[0]) => {
          if (achievement.isUnlocked) return 100;
          
          // Rank based
          const rank = RANKS.find(r => r.title === achievement.title);
          if (rank) {
              if (rank.minHours === 0) return 100; // Avoid division by zero
              return Math.min(100, (totalHours / rank.minHours) * 100);
          }

          // Streak based
          if (achievement.id.startsWith('streak_')) {
              const target = parseInt(achievement.id.split('_')[1]);
              return Math.min(100, (streak / target) * 100);
          }

          // Intensity based
          if (achievement.id === 'marathoner' || achievement.id === 'iron_mind') {
              const dailyTotals = new Map<string, number>();
              allLogs.forEach(l => {
                  dailyTotals.set(l.date, (dailyTotals.get(l.date) || 0) + l.hours);
              });
              const maxDaily = Math.max(0, ...Array.from(dailyTotals.values()));
              
              if (achievement.id === 'marathoner') return Math.min(100, (maxDaily / 6) * 100);
              if (achievement.id === 'iron_mind') return Math.min(100, (maxDaily / 10) * 100);
          }

          return 0;
      };

      return achievements.map(a => ({
          ...a,
          reward: getAchievementReward(a),
          progress: getProgress(a) || 0 // Ensure no NaN
      }));
  }, [achievements, totalHours, streak, allLogs]);

  const filteredAchievements = useMemo(() => {
      return achievementsWithRewards.filter(badge => {
          if (badgeFilter === 'unlocked') return badge.isUnlocked;
          if (badgeFilter === 'locked') return !badge.isUnlocked;
          return true;
      });
  }, [achievementsWithRewards, badgeFilter]);

  const achievementGems = useMemo(() => 
      achievementsWithRewards.filter(a => a.isUnlocked).reduce((acc, curr) => acc + curr.reward, 0)
  , [achievementsWithRewards]);

  // --- Daily Quests Logic ---
  const today = new Date().toISOString().split('T')[0];
  const todaysLogs = useMemo(() => allLogs.filter(l => l.date === today), [allLogs, today]);
  const todayHours = useMemo(() => todaysLogs.reduce((acc, curr) => acc + curr.hours, 0), [todaysLogs]);
  
  const quests = useMemo(() => [
      { 
          id: 1, 
          title: "Focus Scholar", 
          desc: "Study for 1 hour", 
          target: 1, 
          current: todayHours, 
          icon: "📚",
          color: "bg-blue-500",
          reward: 25
      },
      { 
          id: 2, 
          title: "Session Master", 
          desc: "Complete 2 sessions", 
          target: 2, 
          current: todaysLogs.length, 
          icon: "⏱️",
          color: "bg-purple-500",
          reward: 40
      },
      { 
          id: 3, 
          title: "Streak Keeper", 
          desc: "Extend your streak", 
          target: 1, 
          current: todayHours > 0 ? 1 : 0, 
          icon: "🔥",
          color: "bg-orange-500",
          reward: 15
      }
  ], [todayHours, todaysLogs.length]);

  const questGems = useMemo(() => 
      quests.filter(q => q.current >= q.target).reduce((acc, curr) => acc + curr.reward, 0)
  , [quests]);

  const currentGems = Math.max(0, Math.floor(totalHours * 10) + achievementGems + questGems + bonusGems - spentGems);

  // --- Streak Calendar Logic ---
  const streakCalendar = useMemo(() => {
      return Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split('T')[0];
          const hasLog = allLogs.some(l => l.date === dateStr && l.hours > 0);
          const isToday = dateStr === today;
          return {
              day: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
              date: d.getDate(),
              active: hasLog,
              isToday
          };
      });
  }, [allLogs, today]);

  // --- Shop Items ---
  const shopItems = [
      { id: 'freeze', name: 'Streak Freeze', icon: '❄️', cost: 50, desc: 'Auto-used if you miss a day.', type: 'consumable' },
      { id: 'dessert', name: 'Cheat Dessert', icon: '🍰', cost: 150, desc: 'A guilt-free reward for your hard work.', type: 'consumable' },
      { id: 'vacation', name: 'Vacation Ticket', icon: '✈️', cost: 1000, desc: 'Take a break! Adds 7 streak freezes.', type: 'consumable' },
      { id: 'restaurant', name: 'Fine Dining', icon: '🍽️', cost: 300, desc: 'A well-deserved treat for your hard work.', type: 'unlock' },
  ];

  const handleBuy = (item: typeof shopItems[0]) => {
      if (currentGems >= item.cost) {
          const newSpent = spentGems + item.cost;
          setSpentGems(newSpent);
          localStorage.setItem('focusflow_spent_gems', newSpent.toString());

          const newInventory = { ...inventory };
          if (item.id === 'freeze') {
               newInventory.streakFreeze = (newInventory.streakFreeze || 0) + 1;
          } else if (item.id === 'vacation') {
               newInventory.streakFreeze = (newInventory.streakFreeze || 0) + 7;
          } else if (item.id === 'dessert') {
               newInventory.cheatDessert = (newInventory.cheatDessert || 0) + 1;
          } else {
               newInventory[item.id] = true;
          }
          setInventory(newInventory);
          localStorage.setItem('focusflow_inventory', JSON.stringify(newInventory));
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0f172a] text-white transition-colors duration-300 relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0f172a] to-[#0f172a] pointer-events-none"></div>
      
      <div className="p-6 h-full overflow-y-auto custom-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Casino Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
                <div>
                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 drop-shadow-sm">
                        High Roller's Lounge
                    </h2>
                    <p className="text-blue-200 mt-1 font-medium">Place your bets on productivity.</p>
                </div>
                
                <div className="flex gap-4">
                    {/* Streak Counter */}
                    <div className="flex flex-col items-center bg-black/40 p-3 rounded-2xl border border-red-500/30 min-w-[100px]">
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Streak</span>
                        <div className="text-2xl font-black text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                            {streak} <span className="text-sm">🔥</span>
                        </div>
                    </div>

                    {/* Gem Counter */}
                    <div className="flex flex-col items-center bg-black/40 p-3 rounded-2xl border border-yellow-500/30 min-w-[120px]">
                        <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Bankroll</span>
                        <div className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                            {currentGems} <span className="text-sm">💎</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-10">
                
                {/* Daily Missions */}
                <div className="w-full">
                    <div className="bg-gradient-to-b from-indigo-900/80 to-slate-900/80 rounded-3xl p-1 border border-indigo-500/30 shadow-xl">
                        <div className="bg-[#0f172a] rounded-[20px] p-6 md:p-8 h-full">
                            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="text-3xl">🎰</span> Daily Spins
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {quests.map(quest => {
                                    const progress = Math.min(100, (quest.current / quest.target) * 100);
                                    const isCompleted = progress >= 100;
                                    
                                    return (
                                        <div key={quest.id} className={`relative group overflow-hidden rounded-2xl border-2 transition-all duration-300 flex flex-col ${isCompleted ? 'border-yellow-500 bg-yellow-900/10' : 'border-slate-700 bg-slate-800/50 hover:border-indigo-500/50'}`}>
                                            <div className="p-5 relative z-10 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className={`text-3xl ${isCompleted ? 'animate-bounce' : ''}`}>{quest.icon}</div>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-md border ${isCompleted ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-slate-900 text-yellow-500 border-yellow-500/30'}`}>
                                                        +{quest.reward} 💎
                                                    </span>
                                                </div>
                                                
                                                <h4 className={`font-bold text-lg mb-1 ${isCompleted ? 'text-yellow-400' : 'text-slate-200'}`}>{quest.title}</h4>
                                                <p className="text-xs text-slate-400 mb-4 flex-1">{quest.desc}</p>

                                                <div className="mt-auto">
                                                    <div className="flex justify-between text-xs font-bold mb-1">
                                                        <span className={isCompleted ? 'text-yellow-400' : 'text-indigo-400'}>Progress</span>
                                                        <span className={isCompleted ? 'text-yellow-400' : 'text-white'}>{quest.current}/{quest.target}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} 
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            {isCompleted && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Streak Calendar */}
                <div className="bg-slate-800/50 rounded-3xl p-8 border border-white/5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Streak History</h3>
                    <div className="flex justify-between items-center max-w-4xl mx-auto">
                        {streakCalendar.map((day, i) => (
                            <div key={i} className="flex flex-col items-center gap-3">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base font-bold border-2 transition-all ${
                                    day.active 
                                    ? 'bg-red-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                                    : (day.isToday ? 'bg-transparent border-white/20 text-white' : 'bg-transparent border-slate-700 text-slate-600')
                                }`}>
                                    {day.active ? '✓' : day.date}
                                </div>
                                <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">{day.day}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* The Vault (Shop) */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    
                    <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3 relative z-10">
                        <span className="text-3xl">🏦</span> The Vault <span className="text-sm font-normal text-slate-400 ml-2">(Spend your winnings)</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                        {shopItems.map(item => (
                            <div key={item.id} className={`group bg-black/20 hover:bg-white/5 border rounded-2xl p-5 transition-all duration-300 flex flex-col gap-4 ${inventory[item.id] && item.type === 'unlock' ? 'border-green-500/30 bg-green-900/10' : 'border-white/5 hover:border-purple-500/50'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-900 to-slate-900 flex items-center justify-center text-3xl shadow-inner border border-white/10 group-hover:scale-110 transition-transform">
                                        {item.icon}
                                    </div>
                                    {inventory[item.id] && item.type === 'unlock' ? (
                                        <span className="text-xs font-bold text-green-400 bg-green-900/20 px-2 py-1 rounded">Owned</span>
                                    ) : (
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${currentGems >= item.cost ? 'text-yellow-400 bg-yellow-900/20' : 'text-red-400 bg-red-900/20'}`}>
                                            {item.cost} 💎
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex-1">
                                    <h4 className="font-bold text-base text-slate-200 mb-1">{item.name}</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                                    {item.id === 'freeze' && inventory.streakFreeze > 0 && (
                                        <p className="text-[10px] text-blue-400 font-bold mt-2">In Inventory: {inventory.streakFreeze}</p>
                                    )}
                                    {item.id === 'dessert' && inventory.cheatDessert > 0 && (
                                        <p className="text-[10px] text-pink-400 font-bold mt-2">In Inventory: {inventory.cheatDessert}</p>
                                    )}
                                </div>
                                
                                <button 
                                    onClick={() => handleBuy(item)}
                                    disabled={currentGems < item.cost || (item.type === 'unlock' && inventory[item.id])}
                                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                                        item.type === 'unlock' && inventory[item.id]
                                        ? 'bg-green-600/20 text-green-500 cursor-default'
                                        :
                                        currentGems >= item.cost 
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20' 
                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                    }`}
                                >
                                    {item.type === 'unlock' && inventory[item.id] ? 'Purchased' : 'Buy'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trophy Room (Achievements) */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-2xl">🏆</span> Trophy Room
                        </h3>
                        <div className="flex gap-2">
                            <div className="flex bg-slate-800 p-1 rounded-lg">
                                {(['all', 'unlocked', 'locked'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setBadgeFilter(f)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${
                                            badgeFilter === f 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className="px-3 py-1 bg-slate-800 rounded-lg border border-slate-700 flex items-center">
                                <span className="text-xs font-bold text-slate-300">
                                    {unlockedCount} / {achievements.length}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredAchievements.map((badge) => (
                            <div 
                                key={badge.id}
                                className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center text-center p-2 transition-all duration-300 group overflow-hidden ${
                                    badge.isUnlocked 
                                    ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-yellow-500/20 shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:border-yellow-500/50' 
                                    : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale'
                                }`}
                            >
                                {/* Main Content - Fades out on hover */}
                                <div className="flex flex-col items-center transition-opacity duration-300 group-hover:opacity-0">
                                    <div className={`text-4xl mb-2 transition-transform duration-300 ${badge.isUnlocked ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]' : ''}`}>
                                        {badge.icon}
                                    </div>
                                    
                                    <h4 className={`font-bold text-xs mb-1 line-clamp-1 ${badge.isUnlocked ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {badge.title}
                                    </h4>
                                    
                                    {badge.isUnlocked && (
                                        <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_5px_rgba(234,179,8,0.8)]"></div>
                                    )}

                                    <div className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-slate-800 text-slate-600 border-slate-700'}`}>
                                        {badge.reward} 💎
                                    </div>
                                </div>

                                {/* Info Overlay - Fades in on hover */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-slate-900/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                    <p className="text-xs font-bold text-white mb-1 line-clamp-1">{badge.title}</p>
                                    <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-3">{badge.description}</p>
                                    
                                    {!badge.isUnlocked && badge.progress > 0 && (
                                        <div className="w-full mt-2 px-1">
                                            <div className="flex justify-between text-[8px] text-slate-400 mb-0.5">
                                                <span>Progress</span>
                                                <span>{Math.floor(badge.progress)}%</span>
                                            </div>
                                            <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: `${badge.progress}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                        {badge.reward} 💎
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};