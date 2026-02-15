import React, { useState } from 'react';
import { UserGoals } from '../types';
import { useTheme } from '../AppContext';

interface GoalsPanelProps {
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
  currentDailyHours: number;
  currentWeeklyHours: number;
  currentMonthlyHours: number;
  currentYearlyHours: number;
  goalHistory?: { date: string; goals: UserGoals }[];
}

export const GoalsPanel: React.FC<GoalsPanelProps> = ({ 
    goals, 
    onUpdateGoals, 
    currentDailyHours,
    currentWeeklyHours, 
    currentMonthlyHours, 
    currentYearlyHours,
    goalHistory = []
}) => {
  const { appTheme } = useTheme();
  const isCyberpunk = appTheme === 'cyberpunk';

  const [dailyInput, setDailyInput] = useState((goals.daily || 4).toString());
  const [weeklyInput, setWeeklyInput] = useState(goals.weekly.toString());
  const [monthlyInput, setMonthlyInput] = useState(goals.monthly.toString());
  const [yearlyInput, setYearlyInput] = useState(goals.yearly.toString());

  const handleDailySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(dailyInput);
    if (!isNaN(val) && val > 0) {
      onUpdateGoals({ ...goals, daily: val });
    }
  };

  const handleWeeklySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(weeklyInput);
    if (!isNaN(val) && val > 0) {
      onUpdateGoals({ ...goals, weekly: val });
    }
  };

  const handleMonthlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(monthlyInput);
    if (!isNaN(val) && val > 0) {
      onUpdateGoals({ ...goals, monthly: val });
    }
  };

  const handleYearlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(yearlyInput);
    if (!isNaN(val) && val > 0) {
      onUpdateGoals({ ...goals, yearly: val });
    }
  };

  const dailyPercent = Math.min(100, (currentDailyHours / (goals.daily || 4)) * 100);
  const weeklyPercent = Math.min(100, (currentWeeklyHours / goals.weekly) * 100);
  const monthlyPercent = Math.min(100, (currentMonthlyHours / goals.monthly) * 100);
  const yearlyPercent = Math.min(100, (currentYearlyHours / goals.yearly) * 100);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-white'}`}>
      <div className="p-8 h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className={`text-3xl font-bold mb-2 ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-900 dark:text-white'}`}>Goal Settings</h2>
            <p className="text-gray-500 dark:text-gray-400">Set ambitious targets to keep your momentum going.</p>
          </div>

          <div className="grid gap-6">
            {/* Daily Goal Card */}
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-800 dark:text-white'}`}>Daily Goal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours per day</p>
                </div>
                <div className={`p-3 rounded-xl ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>

              <div className="mb-6">
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Progress</span>
                    <span className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-green-600 dark:text-green-400'}`}>{currentDailyHours.toFixed(1)} / {goals.daily || 4} hrs</span>
                 </div>
                 <div className={`w-full rounded-full h-4 overflow-hidden ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <div 
                        className={`h-4 rounded-full transition-all duration-700 ease-out relative ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-green-500'}`}
                        style={{ width: `${dailyPercent}%` }}
                    >
                         <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                 </div>
              </div>

              <form onSubmit={handleDailySubmit} className="flex items-center space-x-4">
                  <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target Hours</label>
                      <input 
                        type="number"
                        value={dailyInput}
                        onChange={(e) => setDailyInput(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-green-500'}`}
                      />
                  </div>
                  <button type="submit" className={`mt-5 px-6 py-2 rounded-lg font-medium transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-200'}`}>
                      Update
                  </button>
              </form>
            </div>

            {/* Weekly Goal Card */}
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-800 dark:text-white'}`}>Weekly Goal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours per week (Mon-Sun)</p>
                </div>
                <div className={`p-3 rounded-xl ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>

              <div className="mb-6">
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Progress</span>
                    <span className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400'}`}>{currentWeeklyHours.toFixed(1)} / {goals.weekly} hrs</span>
                 </div>
                 <div className={`w-full rounded-full h-4 overflow-hidden ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <div 
                        className={`h-4 rounded-full transition-all duration-700 ease-out relative ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-blue-500'}`}
                        style={{ width: `${weeklyPercent}%` }}
                    >
                         <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                 </div>
              </div>

              <form onSubmit={handleWeeklySubmit} className="flex items-center space-x-4">
                  <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target Hours</label>
                      <input 
                        type="number"
                        value={weeklyInput}
                        onChange={(e) => setWeeklyInput(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500'}`}
                      />
                  </div>
                  <button type="submit" className={`mt-5 px-6 py-2 rounded-lg font-medium transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 hover:bg-[#00f0ff]/30' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-200'}`}>
                      Update
                  </button>
              </form>
            </div>

            {/* Monthly Goal Card */}
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-800 dark:text-white'}`}>Monthly Goal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours per month</p>
                </div>
                <div className={`p-3 rounded-xl ${isCyberpunk ? 'bg-[#f0f]/10 text-[#f0f]' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              </div>

              <div className="mb-6">
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Progress</span>
                    <span className={`font-bold ${isCyberpunk ? 'text-[#f0f]' : 'text-purple-600 dark:text-purple-400'}`}>{currentMonthlyHours.toFixed(1)} / {goals.monthly} hrs</span>
                 </div>
                 <div className={`w-full rounded-full h-4 overflow-hidden ${isCyberpunk ? 'bg-[#f0f]/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <div 
                        className={`h-4 rounded-full transition-all duration-700 ease-out relative ${isCyberpunk ? 'bg-[#f0f] shadow-[0_0_10px_rgba(255,0,255,0.5)]' : 'bg-purple-500'}`}
                        style={{ width: `${monthlyPercent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                 </div>
              </div>

              <form onSubmit={handleMonthlySubmit} className="flex items-center space-x-4">
                  <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target Hours</label>
                      <input 
                        type="number"
                        value={monthlyInput}
                        onChange={(e) => setMonthlyInput(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border border-[#f0f]/30 text-[#f0f] focus:ring-[#f0f]' : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-purple-500'}`}
                      />
                  </div>
                  <button type="submit" className={`mt-5 px-6 py-2 rounded-lg font-medium transition-colors ${isCyberpunk ? 'bg-[#f0f]/20 text-[#f0f] border border-[#f0f]/50 hover:bg-[#f0f]/30' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-200'}`}>
                      Update
                  </button>
              </form>
            </div>

            {/* Yearly Goal Card */}
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-800 dark:text-white'}`}>Yearly Goal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours per year</p>
                </div>
                <div className={`p-3 rounded-xl ${isCyberpunk ? 'bg-[#ff9900]/10 text-[#ff9900]' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
              </div>

              <div className="mb-6">
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Progress</span>
                    <span className={`font-bold ${isCyberpunk ? 'text-[#ff9900]' : 'text-orange-600 dark:text-orange-400'}`}>{currentYearlyHours.toFixed(1)} / {goals.yearly} hrs</span>
                 </div>
                 <div className={`w-full rounded-full h-4 overflow-hidden ${isCyberpunk ? 'bg-[#ff9900]/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <div 
                        className={`h-4 rounded-full transition-all duration-700 ease-out relative ${isCyberpunk ? 'bg-[#ff9900] shadow-[0_0_10px_rgba(255,153,0,0.5)]' : 'bg-orange-500'}`}
                        style={{ width: `${yearlyPercent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                 </div>
              </div>

              <form onSubmit={handleYearlySubmit} className="flex items-center space-x-4">
                  <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Target Hours</label>
                      <input 
                        type="number"
                        value={yearlyInput}
                        onChange={(e) => setYearlyInput(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border border-[#ff9900]/30 text-[#ff9900] focus:ring-[#ff9900]' : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-orange-500'}`}
                      />
                  </div>
                  <button type="submit" className={`mt-5 px-6 py-2 rounded-lg font-medium transition-colors ${isCyberpunk ? 'bg-[#ff9900]/20 text-[#ff9900] border border-[#ff9900]/50 hover:bg-[#ff9900]/30' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-200'}`}>
                      Update
                  </button>
              </form>
            </div>

            {/* History Section */}
            {goalHistory.length > 0 && (
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm mt-2`}>
                    <h3 className={`text-lg font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Goal History</h3>
                    <div className={`space-y-0 divide-y max-h-60 overflow-y-auto custom-scrollbar ${isCyberpunk ? 'divide-[#00f0ff]/10' : 'divide-gray-100 dark:divide-gray-700'}`}>
                        {[...goalHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, i) => (
                            <div key={i} className="flex justify-between items-center py-3 text-sm">
                                <div className="text-gray-500 dark:text-gray-400 font-medium">
                                    {entry.date.startsWith('1970') ? 'Initial Setup' : new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className={`flex gap-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Daily</span>
                                        <span className="font-bold">{entry.goals.daily || '-'}h</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Weekly</span>
                                        <span className="font-bold">{entry.goals.weekly}h</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
