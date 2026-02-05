import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StudyLog } from '../types';
import { getUnlockedAchievements, RANKS } from '../services/gamificationService';
import { playSpinTick, playWin } from '../services/audioService';
import { useTheme } from '../AppContext';

interface GamificationPanelProps {
  allLogs: StudyLog[];
  totalHours: number;
  streak: number;
}

interface Transaction {
    id: string;
    date: string;
    type: 'EARN' | 'SPEND' | 'UNLOCK' | 'WIN';
    amount: number;
    description: string;
    relatedId?: string;
}

export const GamificationPanel: React.FC<GamificationPanelProps> = ({ allLogs = [], totalHours = 0, streak = 0 }) => {
  const { appTheme } = useTheme();
  const isCyberpunk = appTheme === 'cyberpunk';
  const achievements = useMemo(() => getUnlockedAchievements(allLogs, totalHours, streak), [allLogs, totalHours, streak]);
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  const [isEconomyInfoOpen, setIsEconomyInfoOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // --- Slot Machine State ---
  const [lastSpinStreak, setLastSpinStreak] = useState(() => {
      if (typeof window === 'undefined') return 0;
      return parseInt(localStorage.getItem('focusflow_last_spin_streak') || '0');
  });
  const [isSlotMachineOpen, setIsSlotMachineOpen] = useState(false);
  const [slotRolling, setSlotRolling] = useState(false);
  const [slotItems, setSlotItems] = useState(['🍒', '7️⃣', '💎']);
  const [reelStatuses, setReelStatuses] = useState([true, true, true]); // true = stopped
  const [slotMessage, setSlotMessage] = useState('');

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

  // --- Transaction History State ---
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
      if (typeof window === 'undefined') return [];
      try {
          return JSON.parse(localStorage.getItem('focusflow_transactions') || '[]');
      } catch { return []; }
  });

  // --- Filters ---
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  // Reset spin eligibility if streak breaks
  useEffect(() => {
      if (streak < lastSpinStreak) {
          // Fix: Prevent reset on initial load when streak is 0 due to async data fetching
          if (streak === 0 && allLogs.length === 0) return;

          setLastSpinStreak(0);
          localStorage.setItem('focusflow_last_spin_streak', '0');
      }
  }, [streak, lastSpinStreak, allLogs.length]);

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

  // Helper to add transaction
  const addTransaction = (t: Transaction) => {
      setTransactions(prev => {
          const updated = [t, ...prev];
          localStorage.setItem('focusflow_transactions', JSON.stringify(updated));
          return updated;
      });
  };

  // Effect: Detect and Log Badge Unlocks
  useEffect(() => {
      const unlockedIds = new Set(transactions.filter(t => t.type === 'UNLOCK').map(t => t.relatedId));
      let newTx: Transaction[] = [];
      
      achievements.forEach(badge => {
          if (badge.isUnlocked && !unlockedIds.has(badge.id)) {
              newTx.push({
                  id: `unlock-${badge.id}-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'UNLOCK',
                  amount: badge.rewardConfig.gems,
                  description: `Unlocked: ${badge.title}`,
                  relatedId: badge.id
              });
          }
      });

      if (newTx.length > 0) {
          setTransactions(prev => {
              const updated = [...newTx, ...prev];
              localStorage.setItem('focusflow_transactions', JSON.stringify(updated));
              return updated;
          });
      }
  }, [achievements]); // transactions excluded to prevent loop, logic relies on functional update or stable check

  // --- Rewards Logic ---
  const getAchievementReward = (achievement: { id: string, title: string, description: string }) => {
      const title = achievement.title.toLowerCase();
      const desc = achievement.description.toLowerCase();
      const id = achievement.id.toLowerCase();

      // Tier 1: Legendary (5000 Gems - Huge Vault Value)
      if (title.includes('legend') || desc.includes('365-day') || id === 'rank_legend') {
          return { gems: 5000, rarity: 'legendary', label: 'Legendary' };
      }
      
      // Tier 2: Mythic (2500 Gems - Multiple Unlocks)
      if (title.includes('grandmaster') || title.includes('master') || desc.includes('100-day')) {
          return { gems: 2500, rarity: 'mythic', label: 'Mythic' };
      }

      // Tier 3: Epic (1000 Gems - Vacation Ticket Equivalent)
      if (title.includes('expert') || desc.includes('30-day') || id === 'iron_mind') {
          return { gems: 1000, rarity: 'epic', label: 'Epic' };
      }

      // Tier 4: Rare (500 Gems - Cyberpunk Theme Equivalent)
      if (title.includes('journeyman') || desc.includes('14-day') || id === 'marathoner') {
          return { gems: 500, rarity: 'rare', label: 'Rare' };
      }

      // Tier 5: Uncommon (250 Gems - Fine Dining Equivalent)
      if (title.includes('apprentice') || desc.includes('7-day')) {
          return { gems: 250, rarity: 'uncommon', label: 'Uncommon' };
      }

      // Tier 6: Common (50 Gems - 1x Streak Freeze)
      return { gems: 50, rarity: 'common', label: 'Common' };
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
          rewardConfig: getAchievementReward(a),
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
      achievementsWithRewards.filter(a => a.isUnlocked).reduce((acc, curr) => acc + curr.rewardConfig.gems, 0)
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
      { id: 'theme_cyber', name: 'Cyberpunk Theme', icon: '🌆', cost: 500, desc: 'Unlock the futuristic Cyberpunk visual theme.', type: 'unlock' },
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

          // Log Transaction
          addTransaction({
              id: `buy-${item.id}-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'SPEND',
              amount: -item.cost,
              description: `Purchased ${item.name}`
          });
      }
  };

  const canSpin = streak > 0 && streak % 7 === 0 && lastSpinStreak < streak;
  const daysToNextSpin = 7 - (streak % 7);

  const handleSlotSpin = () => {
      if (slotRolling) return;
      setSlotRolling(true);
      setSlotMessage('');
      setReelStatuses([false, false, false]);
      
      const savedVol = localStorage.getItem('focusflow_timer_volume');
      const vol = savedVol ? parseFloat(savedVol) : 0.5;
      
      let ticks = 0;
      const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣', '🔔'];
      
      const interval = setInterval(() => {
          ticks++;
          setSlotItems(prev => {
              // Play tick sound on change
              if (ticks % 2 === 0) playSpinTick(vol);

              const next = [...prev];
              // Spin Reel 1 until tick 20
              if (ticks < 20) next[0] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 20) { next[0] = '💎'; setReelStatuses(s => [true, false, false]); }
              
              // Spin Reel 2 until tick 35
              if (ticks < 35) next[1] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 35) { next[1] = '💎'; setReelStatuses(s => [true, true, false]); }
              
              // Spin Reel 3 until tick 50
              if (ticks < 50) next[2] = symbols[Math.floor(Math.random() * symbols.length)];
              else if (ticks === 50) { next[2] = '💎'; setReelStatuses(s => [true, true, true]); }
              
              return next;
          });
          if (ticks >= 50) {
              clearInterval(interval);
              finalizeSpin();
          }
      }, 60);
  };

  const finalizeSpin = () => {
      const savedVol = localStorage.getItem('focusflow_timer_volume');
      const vol = savedVol ? parseFloat(savedVol) : 0.5;
      playWin(vol);

      // Random gems between 50 and 1000
      const amount = Math.floor(Math.random() * 951) + 50;

      // Count up animation
      let current = 0;
      const step = Math.max(1, Math.floor(amount / 20));
      const counterInterval = setInterval(() => {
          current += step;
          if (current >= amount) {
              current = amount;
              clearInterval(counterInterval);
              setBonusGems(prev => {
                  const newVal = prev + amount;
                  localStorage.setItem('focusflow_bonus_gems', newVal.toString());
                  return newVal;
              });
              setSlotMessage(`You won: ${amount} Gems!`);
              setSlotRolling(false);
          } else {
              setSlotMessage(`WIN: ${current} Gems`);
          }
      }, 30);

      // Log Transaction
      addTransaction({
          id: `spin-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'WIN',
          amount: amount,
          description: 'Weekly Jackpot Win'
      });
      
      setLastSpinStreak(streak);
      localStorage.setItem('focusflow_last_spin_streak', streak.toString());
  };

  const RARITY_COLORS: Record<string, string> = {
      common: 'text-slate-400 border-slate-600',
      uncommon: 'text-green-400 border-green-600',
      rare: 'text-blue-400 border-blue-600',
      epic: 'text-purple-400 border-purple-600',
      mythic: 'text-red-400 border-red-600',
      legendary: 'text-yellow-400 border-yellow-600'
  };

  // Combine stored transactions with virtual log transactions for display
  const historyDisplay = useMemo(() => {
      const logTxs: Transaction[] = allLogs.map((l, i) => ({
          id: `log-${l.date}-${i}`,
          date: l.date, // YYYY-MM-DD
          type: 'EARN',
          amount: Math.floor(l.hours * 10),
          description: `Study Session (${l.hours}h)`
      }));
      
      return [...transactions, ...logTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, allLogs]);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300 relative ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-[#0f172a] text-white'}`}>
      {/* Background effects */}
      <div className={`absolute inset-0 pointer-events-none ${isCyberpunk ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00f0ff]/10 via-[#050505] to-[#050505]' : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0f172a] to-[#0f172a]'}`}></div>
      
      <div className="p-6 h-full overflow-y-auto custom-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Casino Header */}
            <div className={`flex flex-col md:flex-row justify-between items-center gap-6 p-6 rounded-3xl border backdrop-blur-md shadow-2xl ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white/5 border-white/10'}`}>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className={`text-4xl font-black drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600'}`}>
                            High Roller's Lounge
                        </h2>
                        <button 
                            onClick={() => setIsHistoryOpen(true)}
                            className={`p-2 rounded-full transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-blue-200 hover:bg-white/10'}`}
                            title="Transaction History"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button 
                            onClick={() => setIsEconomyInfoOpen(true)}
                            className={`p-2 rounded-full transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-blue-200 hover:bg-white/10'}`}
                            title="Economy Guide"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>
                    <p className={`mt-1 font-medium ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-blue-200'}`}>Place your bets on productivity.</p>
                </div>
                
                <div className="flex gap-4">
                    {/* Streak Counter */}
                    <div className={`flex flex-col items-center p-3 rounded-2xl border min-w-[100px] ${isCyberpunk ? 'bg-black border-[#ff00ff]/30' : 'bg-black/40 border-red-500/30'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#ff00ff]' : 'text-red-400'}`}>Streak</span>
                        <div className={`text-2xl font-black drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] ${isCyberpunk ? 'text-[#ff00ff] drop-shadow-[0_0_8px_rgba(255,0,255,0.5)]' : 'text-red-500'}`}>
                            {streak} <span className="text-sm">🔥</span>
                        </div>
                    </div>

                    {/* Gem Counter */}
                    <div className={`flex flex-col items-center p-3 rounded-2xl border min-w-[120px] ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/40 border-yellow-500/30'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>Bankroll</span>
                        <div className={`text-2xl font-black drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' : 'text-yellow-400'}`}>
                            {currentGems} <span className="text-sm">💎</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-10">
                
                {/* Slot Machine Banner */}
                <div className={`relative overflow-hidden rounded-3xl p-1 shadow-2xl ${isCyberpunk ? 'bg-gradient-to-r from-[#00f0ff] via-[#ff00ff] to-[#00f0ff]' : 'bg-gradient-to-r from-yellow-500 via-red-500 to-pink-500'}`}>
                    <div className={`rounded-[20px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 ${isCyberpunk ? 'bg-black' : 'bg-[#0f172a]'}`}>
                        <div className="flex items-center gap-4">
                            <div className="text-5xl">🎰</div>
                            <div>
                                <h3 className={`text-2xl font-black ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Weekly Jackpot</h3>
                                <p className={`text-sm ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Spin every 7 days of streak for Gems!</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {canSpin ? (
                                <button 
                                    onClick={() => setIsSlotMachineOpen(true)}
                                    className={`px-8 py-3 font-black text-lg rounded-xl shadow-lg transform hover:scale-105 transition-all animate-pulse ${isCyberpunk ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.5)]' : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black shadow-orange-500/20'}`}
                                >
                                    SPIN NOW
                                </button>
                            ) : (
                                <div className={`px-6 py-3 rounded-xl border text-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-500'}`}>Next Spin In</p>
                                    <p className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{daysToNextSpin} Days</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Daily Missions */}
                <div className="w-full">
                    <div className={`rounded-3xl p-1 border shadow-xl ${isCyberpunk ? 'bg-gradient-to-b from-[#00f0ff]/20 to-black border-[#00f0ff]/30' : 'bg-gradient-to-b from-indigo-900/80 to-slate-900/80 border-indigo-500/30'}`}>
                        <div className={`rounded-[20px] p-6 md:p-8 h-full ${isCyberpunk ? 'bg-black' : 'bg-[#0f172a]'}`}>
                            <h3 className={`text-2xl font-bold mb-6 flex items-center gap-3 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>
                                <span className="text-3xl">🎯</span> Daily Quests
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {quests.map(quest => {
                                    const progress = Math.min(100, (quest.current / quest.target) * 100);
                                    const isCompleted = progress >= 100;
                                    
                                    return (
                                        <div key={quest.id} className={`relative group overflow-hidden rounded-2xl border-2 transition-all duration-300 flex flex-col ${isCompleted ? (isCyberpunk ? 'border-[#00f0ff] bg-[#00f0ff]/10' : 'border-yellow-500 bg-yellow-900/10') : (isCyberpunk ? 'border-[#00f0ff]/20 bg-[#0a0a0a] hover:border-[#00f0ff]/50' : 'border-slate-700 bg-slate-800/50 hover:border-indigo-500/50')}`}>
                                            <div className="p-5 relative z-10 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className={`text-3xl ${isCompleted ? 'animate-bounce' : ''}`}>{quest.icon}</div>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-md border ${isCompleted ? (isCyberpunk ? 'bg-[#00f0ff] text-black border-[#00f0ff]' : 'bg-yellow-500 text-black border-yellow-400') : (isCyberpunk ? 'bg-black text-[#00f0ff] border-[#00f0ff]/30' : 'bg-slate-900 text-yellow-500 border-yellow-500/30')}`}>
                                                        +{quest.reward} 💎
                                                    </span>
                                                </div>
                                                
                                                <h4 className={`font-bold text-lg mb-1 ${isCompleted ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400') : (isCyberpunk ? 'text-[#00f0ff]/80' : 'text-slate-200')}`}>{quest.title}</h4>
                                                <p className={`text-xs mb-4 flex-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>{quest.desc}</p>

                                                <div className="mt-auto">
                                                    <div className="flex justify-between text-xs font-bold mb-1">
                                                        <span className={isCompleted ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400') : (isCyberpunk ? 'text-[#00f0ff]/60' : 'text-indigo-400')}>Progress</span>
                                                        <span className={isCompleted ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400') : (isCyberpunk ? 'text-[#00f0ff]' : 'text-white')}>{quest.current}/{quest.target}</span>
                                                    </div>
                                                    <div className={`h-2 w-full rounded-full overflow-hidden border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-black/50 border-white/5'}`}>
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? (isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-gradient-to-r from-yellow-400 to-orange-500') : (isCyberpunk ? 'bg-[#00f0ff]/50' : 'bg-gradient-to-r from-indigo-500 to-purple-500')}`} 
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
                <div className={`rounded-3xl p-8 border ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-slate-800/50 border-white/5'}`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-6 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Streak History</h3>
                    <div className="flex justify-between items-center max-w-4xl mx-auto">
                        {streakCalendar.map((day, i) => (
                            <div key={i} className="flex flex-col items-center gap-3">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base font-bold border-2 transition-all ${
                                    day.active 
                                    ? (isCyberpunk ? 'bg-[#ff00ff] border-[#ff00ff] text-black shadow-[0_0_15px_rgba(255,0,255,0.6)]' : 'bg-red-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]')
                                    : (day.isToday ? (isCyberpunk ? 'bg-transparent border-[#00f0ff] text-[#00f0ff]' : 'bg-transparent border-white/20 text-white') : (isCyberpunk ? 'bg-transparent border-[#00f0ff]/20 text-[#00f0ff]/40' : 'bg-transparent border-slate-700 text-slate-600'))
                                }`}>
                                    {day.active ? '✓' : day.date}
                                </div>
                                <span className={`text-[10px] md:text-xs font-bold uppercase ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-slate-500'}`}>{day.day}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* The Vault (Shop) */}
                <div className={`rounded-3xl p-8 border shadow-2xl relative overflow-hidden ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-gradient-to-br from-slate-900 to-slate-800 border-white/10'}`}>
                    <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-purple-500/10'}`}></div>
                    
                    <h3 className={`text-2xl font-bold mb-8 flex items-center gap-3 relative z-10 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>
                        <span className="text-3xl">🏦</span> The Vault <span className={`text-sm font-normal ml-2 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>(Spend your winnings)</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                        {shopItems.map(item => (
                            <div key={item.id} className={`group rounded-2xl p-5 transition-all duration-300 flex flex-col gap-4 ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 hover:border-[#00f0ff]' : 'bg-black/20 hover:bg-white/5 border-white/5 hover:border-purple-500/50'} ${inventory[item.id] && item.type === 'unlock' ? (isCyberpunk ? 'border-[#00ff00]/50 bg-[#00ff00]/10' : 'border-green-500/30 bg-green-900/10') : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-inner border group-hover:scale-110 transition-transform ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-gradient-to-br from-purple-900 to-slate-900 border-white/10'}`}>
                                        {item.icon}
                                    </div>
                                    {inventory[item.id] && item.type === 'unlock' ? (
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${isCyberpunk ? 'text-[#00ff00] bg-[#00ff00]/20' : 'text-green-400 bg-green-900/20'}`}>Owned</span>
                                    ) : (
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${currentGems >= item.cost ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/20' : 'text-yellow-400 bg-yellow-900/20') : (isCyberpunk ? 'text-red-500 bg-red-500/20' : 'text-red-400 bg-red-900/20')}`}>
                                            {item.cost} 💎
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex-1">
                                    <h4 className={`font-bold text-base mb-1 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-slate-200'}`}>{item.name}</h4>
                                    <p className={`text-xs leading-relaxed ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>{item.desc}</p>
                                    {item.id === 'freeze' && inventory.streakFreeze > 0 && (
                                        <p className={`text-[10px] font-bold mt-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-400'}`}>In Inventory: {inventory.streakFreeze}</p>
                                    )}
                                    {item.id === 'dessert' && inventory.cheatDessert > 0 && (
                                        <p className={`text-[10px] font-bold mt-2 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-pink-400'}`}>In Inventory: {inventory.cheatDessert}</p>
                                    )}
                                </div>
                                
                                <button 
                                    onClick={() => handleBuy(item)}
                                    disabled={currentGems < item.cost || (item.type === 'unlock' && inventory[item.id])}
                                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                                        item.type === 'unlock' && inventory[item.id]
                                        ? (isCyberpunk ? 'bg-[#00ff00]/20 text-[#00ff00] cursor-default' : 'bg-green-600/20 text-green-500 cursor-default')
                                        :
                                        currentGems >= item.cost 
                                        ? (isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20')
                                        : (isCyberpunk ? 'bg-[#0a0a0a] text-[#00f0ff]/30 cursor-not-allowed border border-[#00f0ff]/10' : 'bg-slate-800 text-slate-600 cursor-not-allowed')
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
                        <h3 className={`text-xl font-bold flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>
                            <span className="text-2xl">🏆</span> Trophy Room
                        </h3>
                        <div className="flex gap-2">
                            <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-slate-800'}`}>
                                {(['all', 'unlocked', 'locked'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setBadgeFilter(f)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all capitalize ${
                                            badgeFilter === f 
                                            ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-sm' : 'bg-blue-600 text-white shadow-sm')
                                            : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-slate-400 hover:text-white')
                                        }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className={`px-3 py-1 rounded-lg border flex items-center ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-slate-800 border-slate-700'}`}>
                                <span className={`text-xs font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-slate-300'}`}>
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
                                    ? (isCyberpunk ? 'bg-black border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:border-[#00f0ff]' : `bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:-translate-y-1 ${RARITY_COLORS[badge.rewardConfig.rarity].replace('text-', 'border-').split(' ')[1] || 'border-slate-700'}`)
                                    : (isCyberpunk ? 'bg-black border-[#00f0ff]/10 opacity-40 grayscale' : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale')
                                }`}
                            >
                                {/* Main Content - Fades out on hover */}
                                <div className="flex flex-col items-center transition-opacity duration-300 group-hover:opacity-0">
                                    <div className={`text-4xl mb-2 transition-transform duration-300 ${badge.isUnlocked ? (isCyberpunk ? 'drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]') : 'opacity-50'}`}>
                                        {badge.icon}
                                    </div>
                                    
                                    <h4 className={`font-bold text-xs mb-1 line-clamp-1 ${badge.isUnlocked ? (isCyberpunk ? 'text-[#00f0ff]' : RARITY_COLORS[badge.rewardConfig.rarity].split(' ')[0]) : (isCyberpunk ? 'text-[#00f0ff]/40' : 'text-slate-500')}`}>
                                        {badge.title}
                                    </h4>
                                    
                                    {badge.isUnlocked && (
                                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]'}`}></div>
                                    )}

                                    <div className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/30 border-[#00f0ff]/10' : 'bg-slate-800 text-slate-600 border-slate-700')}`}>
                                        {badge.rewardConfig.gems} 💎
                                    </div>
                                </div>

                                {/* Info Overlay - Fades in on hover */}
                                <div className={`absolute inset-0 flex flex-col items-center justify-center p-3 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 ${isCyberpunk ? 'bg-black/95' : 'bg-slate-900/95'}`}>
                                    <p className={`text-xs font-bold mb-1 line-clamp-1 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{badge.title}</p>
                                    <p className={`text-[10px] leading-relaxed line-clamp-3 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-slate-300'}`}>{badge.description}</p>
                                    
                                    {!badge.isUnlocked && badge.progress > 0 && (
                                        <div className="w-full mt-2 px-1">
                                            <div className={`flex justify-between text-[8px] mb-0.5 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>
                                                <span>Progress</span>
                                                <span>{Math.floor(badge.progress)}%</span>
                                            </div>
                                            <div className={`h-1 w-full rounded-full overflow-hidden ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-slate-700'}`}>
                                                <div className={`h-full ${isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-500'}`} style={{ width: `${badge.progress}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.isUnlocked ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/20' : 'bg-slate-800 ' + RARITY_COLORS[badge.rewardConfig.rarity]) : (isCyberpunk ? 'bg-black text-[#00f0ff]/40 border-[#00f0ff]/10' : 'bg-slate-800 text-slate-500 border-slate-700')}`}>
                                        {badge.rewardConfig.gems} 💎
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
      </div>

      {/* Slot Machine Modal */}
      {isSlotMachineOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`w-full max-w-md rounded-3xl border-4 shadow-[0_0_50px_rgba(234,179,8,0.3)] p-8 relative overflow-hidden flex flex-col items-center ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_50px_rgba(0,240,255,0.3)]' : 'bg-[#1c1c1e] border-yellow-500'}`}>
                  <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-b to-transparent pointer-events-none ${isCyberpunk ? 'from-[#00f0ff]/20' : 'from-yellow-500/20'}`}></div>
                  
                  <h3 className={`text-3xl font-black mb-8 drop-shadow-sm ${isCyberpunk ? 'text-[#00f0ff]' : 'text-yellow-400'}`}>JACKPOT SLOTS</h3>
                  
                  <div className={`flex gap-4 mb-8 p-6 rounded-2xl border shadow-inner ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-black/50 border-white/10'}`}>
                      {slotItems.map((item, i) => (
                          <div key={i} className={`w-20 h-24 bg-white text-6xl flex items-center justify-center rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] border-b-4 border-slate-300 overflow-hidden relative transition-transform duration-200 ${reelStatuses[i] ? 'scale-100' : 'scale-95'} ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff]' : ''}`}>
                              <div className={`transition-all duration-100 ${!reelStatuses[i] ? 'blur-[2px] -translate-y-1' : ''}`}>
                                  {item}
                              </div>
                          </div>
                      ))}
                  </div>

                  {slotMessage ? (
                      <div className="text-center mb-8 animate-bounce">
                          <p className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{slotMessage}</p>
                          <p className={`text-sm mt-1 ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-yellow-400'}`}>Prize added to inventory!</p>
                      </div>
                  ) : (
                      <p className={`mb-8 text-sm ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>Good Luck!</p>
                  )}

                  <div className="flex gap-4 w-full">
                      {!slotMessage && (
                          <button 
                              onClick={handleSlotSpin}
                              disabled={slotRolling}
                              className={`flex-1 py-4 font-black text-xl rounded-2xl shadow-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isCyberpunk ? 'bg-[#00f0ff] text-black border-[#0099ff] hover:bg-[#00f0ff]/90' : 'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white border-red-900'}`}
                          >
                              {slotRolling ? 'ROLLING...' : 'PULL LEVER'}
                          </button>
                      )}
                      {slotMessage && (
                          <button 
                              onClick={() => setIsSlotMachineOpen(false)}
                              className={`flex-1 py-4 font-bold rounded-2xl transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                          >
                              Collect & Close
                          </button>
                      )}
                  </div>
                  
                  <button onClick={() => setIsSlotMachineOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
          </div>
      )}

      {/* Economy Guide Modal */}
      {isEconomyInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-8 relative overflow-hidden ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Economy Guide</h3>
                      <button onClick={() => setIsEconomyInfoOpen(false)} className={`p-1 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-slate-400 hover:text-white'}`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                          <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-400'}`}>
                              <span>⏱️</span> Time is Money
                          </h4>
                          <p className={`text-sm ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-slate-300'}`}>
                              Earn <span className="font-bold">10 Gems</span> for every <span className="font-bold">1 Hour</span> of focused study time logged.
                          </p>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#ff00ff]/10 border-[#ff00ff]/30' : 'bg-slate-800 border-slate-700'}`}>
                          <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#ff00ff]' : 'text-red-400'}`}>
                              <span>🔥</span> Streak Jackpot
                          </h4>
                          <p className={`text-sm ${isCyberpunk ? 'text-[#ff00ff]/80' : 'text-slate-300'}`}>
                              Every <span className="font-bold">7 Days</span> of streak unlocks a Jackpot Spin. Win between <span className="font-bold">50 - 1000 Gems</span>!
                          </p>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isCyberpunk ? 'bg-[#00ff00]/10 border-[#00ff00]/30' : 'bg-slate-800 border-slate-700'}`}>
                          <h4 className={`font-bold mb-2 flex items-center gap-2 ${isCyberpunk ? 'text-[#00ff00]' : 'text-green-400'}`}>
                              <span>🏆</span> Bonuses
                          </h4>
                          <ul className={`text-sm space-y-1 ${isCyberpunk ? 'text-[#00ff00]/80' : 'text-slate-300'}`}>
                              <li>• Daily Quests: <span className="font-bold">~80 Gems/day</span></li>
                              <li>• Achievements: <span className="font-bold">50 - 5000 Gems</span> (Tiered)</li>
                          </ul>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* History Modal */}
      {isHistoryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[80vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-[#1c1c1e] border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-6 shrink-0">
                      <h3 className={`text-2xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>Transaction History</h3>
                      <button onClick={() => setIsHistoryOpen(false)} className={`p-1 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-slate-400 hover:text-white'}`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                      {historyDisplay.length === 0 ? (
                          <div className="text-center py-10 text-slate-500">No transactions yet.</div>
                      ) : (
                          historyDisplay.map((tx) => (
                              <div key={tx.id} className={`flex items-center justify-between p-3 rounded-xl border ${isCyberpunk ? 'bg-[#00f0ff]/5 border-[#00f0ff]/20' : 'bg-white/5 border-white/5'}`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                                          tx.type === 'SPEND' ? (isCyberpunk ? 'bg-red-900/30 text-red-500' : 'bg-red-500/20 text-red-400') :
                                          tx.type === 'UNLOCK' ? (isCyberpunk ? 'bg-purple-900/30 text-purple-500' : 'bg-purple-500/20 text-purple-400') :
                                          (isCyberpunk ? 'bg-green-900/30 text-green-500' : 'bg-green-500/20 text-green-400')
                                      }`}>
                                          {tx.type === 'SPEND' ? '🛒' : tx.type === 'UNLOCK' ? '🏆' : tx.type === 'WIN' ? '🎰' : '📚'}
                                      </div>
                                      <div>
                                          <p className={`text-sm font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{tx.description}</p>
                                          <p className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-slate-400'}`}>{new Date(tx.date).toLocaleDateString()}</p>
                                      </div>
                                  </div>
                                  <div className={`font-mono font-bold ${tx.amount > 0 ? (isCyberpunk ? 'text-green-500' : 'text-green-400') : (isCyberpunk ? 'text-red-500' : 'text-red-400')}`}>
                                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};