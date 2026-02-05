import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StudyLog, UserGoals, Project, SessionRecord } from '../types';
import { 
    BarChart, Bar, LineChart, Line, AreaChart, Area, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { calculateLevel, getUnlockedAchievements } from '../services/gamificationService';
import { getSessions } from '../services/storageService';

interface StatisticsPanelProps {
  logs: StudyLog[];
  allLogs: StudyLog[];
  projects: Project[];
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
  onEditLog: (date: string) => void;
  projectId: string;
  totalHours: number;
  streak: number;
}

type SortField = 'date' | 'hours';
type FilterRange = 'all' | '7days' | '30days' | 'year';
type ChartType = 'bar' | 'line' | 'area';
type ScopeType = 'project' | 'global';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ logs, allLogs, projects, goals, onUpdateGoals, onEditLog, projectId, totalHours, streak }) => {
  // Persisted State
  const [scope, setScope] = useState<ScopeType>(() => {
      if (typeof window !== 'undefined') return (localStorage.getItem('focusflow_stats_scope') as ScopeType) || 'project';
      return 'project';
  });
  
  const [filterRange, setFilterRange] = useState<FilterRange>(() => {
      if (typeof window !== 'undefined') return (localStorage.getItem('focusflow_stats_filter_range') as FilterRange) || '30days';
      return '30days';
  });

  const [chartType, setChartType] = useState<ChartType>(() => {
      if (typeof window !== 'undefined') return (localStorage.getItem('focusflow_stats_chart_type') as ChartType) || 'bar';
      return 'bar';
  });

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [showChartSettings, setShowChartSettings] = useState(false);
  
  // Session Data for Scatter Plot
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const chartSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      // Load sessions for advanced analytics
      setSessions(getSessions());

      const handleClickOutside = (event: MouseEvent) => {
          if (chartSettingsRef.current && !chartSettingsRef.current.contains(event.target as Node)) {
              setShowChartSettings(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save Preferences
  useEffect(() => { localStorage.setItem('focusflow_stats_scope', scope); }, [scope]);
  useEffect(() => { localStorage.setItem('focusflow_stats_filter_range', filterRange); }, [filterRange]);
  useEffect(() => { localStorage.setItem('focusflow_stats_chart_type', chartType); }, [chartType]);

  // Determine which logs to use based on scope
  const targetLogs = scope === 'global' ? allLogs : logs;

  // Gamification Data (Always Global based on totalHours passed)
  const levelData = useMemo(() => calculateLevel(totalHours), [totalHours]);
  const achievements = useMemo(() => getUnlockedAchievements(allLogs, totalHours, streak), [allLogs, totalHours, streak]);
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  const filteredLogs = useMemo(() => {
    let filtered = [...targetLogs];
    const now = new Date();
    
    // Filter
    if (filterRange === '7days') {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 7);
        filtered = filtered.filter(l => new Date(l.date) >= cutoff);
    } else if (filterRange === '30days') {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 30);
        filtered = filtered.filter(l => new Date(l.date) >= cutoff);
    } else if (filterRange === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filtered = filtered.filter(l => new Date(l.date) >= startOfYear);
    }

    // Sort for Table (User Interaction)
    filtered.sort((a, b) => {
        let valA = sortField === 'date' ? new Date(a.date).getTime() : a.hours;
        let valB = sortField === 'date' ? new Date(b.date).getTime() : b.hours;
        return sortDesc ? valB - valA : valA - valB;
    });

    return filtered;
  }, [targetLogs, filterRange, sortField, sortDesc]);

  // Data prepared for charts
  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredLogs.forEach(log => {
        const dateKey = log.date;
        grouped.set(dateKey, (grouped.get(dateKey) || 0) + log.hours);
    });

    const sortedDates = Array.from(grouped.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    return sortedDates.map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours: grouped.get(date) || 0
    }));
  }, [filteredLogs]);

  // Activity By Day Data
  const activityByDay = useMemo(() => {
      const totals = [0, 0, 0, 0, 0, 0, 0];
      filteredLogs.forEach(log => {
          const d = new Date(log.date).getDay();
          totals[d] += log.hours;
      });
      const max = Math.max(...totals, 0.1); 
      const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      return labels.map((label, i) => ({
          day: label,
          hours: totals[i],
          percent: (totals[i] / max) * 100
      }));
  }, [filteredLogs]);

  // Project Distribution Data (Global Only)
  const projectDistData = useMemo(() => {
      if (scope !== 'global') return [];
      const map = new Map<string, number>();
      filteredLogs.forEach(l => {
          map.set(l.projectId, (map.get(l.projectId) || 0) + l.hours);
      });
      
      return Array.from(map.entries()).map(([pid, hours], index) => {
          const project = projects.find(p => p.id === pid);
          return {
              name: project ? project.name : 'Unknown',
              value: hours,
              color: COLORS[index % COLORS.length]
          };
      }).sort((a,b) => b.value - a.value);
  }, [filteredLogs, scope, projects]);

  // Scatter Plot Data
  const scatterData = useMemo(() => {
      const now = new Date();
      let cutoff = new Date(0); 
      if (filterRange === '7days') cutoff = new Date(now.setDate(now.getDate() - 7));
      if (filterRange === '30days') cutoff = new Date(now.setDate(now.getDate() - 30));
      if (filterRange === 'year') cutoff = new Date(now.getFullYear(), 0, 1);

      const relevantSessions = sessions.filter(s => {
          const sDate = new Date(s.startTime);
          const dateMatch = sDate >= cutoff;
          const scopeMatch = scope === 'global' || s.projectId === projectId;
          return dateMatch && scopeMatch;
      });

      const matrix: Record<string, number> = {}; 
      
      relevantSessions.forEach(s => {
          const date = new Date(s.startTime);
          const day = date.getDay(); // 0 = Sun
          const hour = date.getHours();
          const key = `${day}-${hour}`;
          matrix[key] = (matrix[key] || 0) + 1; 
      });

      const data = [];
      for (let d = 0; d < 7; d++) {
          for (let h = 0; h < 24; h++) {
              const val = matrix[`${d}-${h}`];
              if (val) {
                  data.push({ day: d, hour: h, value: val });
              }
          }
      }
      return data;
  }, [sessions, scope, projectId, filterRange]);

  // Statistics Calculation
  const stats = useMemo(() => {
      const weekdays = filteredLogs.filter(l => {
          const day = new Date(l.date).getDay();
          return day !== 0 && day !== 6;
      });
      const weekends = filteredLogs.filter(l => {
          const day = new Date(l.date).getDay();
          return day === 0 || day === 6;
      });

      const totalHours = filteredLogs.reduce((acc, curr) => acc + curr.hours, 0);
      
      const uniqueDates = new Set(filteredLogs.map(l => l.date)).size;
      const avgHours = uniqueDates > 0 ? totalHours / uniqueDates : 0;

      const avgWeekday = weekdays.length ? weekdays.reduce((a, b) => a + b.hours, 0) / weekdays.length : 0;
      const avgWeekend = weekends.length ? weekends.reduce((a, b) => a + b.hours, 0) / weekends.length : 0;

      return { totalHours, avgHours, avgWeekday, avgWeekend };
  }, [filteredLogs]);

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderChart = () => {
    const commonProps = {
        data: chartData,
        margin: { top: 10, right: 10, left: -20, bottom: 0 }
    };

    if (chartType === 'line') {
        return (
            <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)'}} 
                />
                <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={3} dot={{r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
            </LineChart>
        );
    } else if (chartType === 'area') {
        return (
            <AreaChart {...commonProps}>
                <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ stroke: '#8b5cf6', strokeWidth: 1 }}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)'}} 
                />
                <Area type="monotone" dataKey="hours" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorHours)" strokeWidth={3} />
            </AreaChart>
        );
    }
    return (
        <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
            <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
            <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
            <Tooltip 
                cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} 
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)'}} 
            />
            <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
        </BarChart>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
      <div className="p-8 h-full overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* --- Hero Section (Level & XP) --- */}
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0 relative group/rank">
                        <div className="w-36 h-36 rounded-full p-2 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-sm shadow-2xl flex items-center justify-center">
                            <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-5xl shadow-inner text-white font-black ring-4 ring-white dark:ring-gray-800 transform group-hover/rank:rotate-12 transition-transform duration-500 relative overflow-hidden">
                                {levelData.rank.title.charAt(0)}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                            </div>
                        </div>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white dark:border-gray-800 z-10 min-w-[60px] text-center">
                            Lvl {Math.floor(totalHours / 10) + 1}
                        </div>
                    </div>
                    <div className="flex-1 w-full text-center md:text-left">
                        <h3 className={`text-5xl font-black ${levelData.rank.color} mb-1 tracking-tight drop-shadow-sm`}>{levelData.rank.title}</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-6">
                            Total Focus Time: <span className="text-gray-900 dark:text-white font-bold">{totalHours.toFixed(1)} Hours</span>
                        </p>
                        <div className="relative pt-1 max-w-xl mx-auto md:mx-0">
                            <div className="flex mb-2 items-center justify-between">
                                <div><span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">XP Progress</span></div>
                                <div className="text-right"><span className="text-xs font-bold inline-block text-blue-600 dark:text-blue-400">{levelData.currentXP} / {levelData.nextLevelXP} XP</span></div>
                            </div>
                            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-blue-100 dark:bg-gray-700 shadow-inner relative">
                                <div style={{ width: `${levelData.progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out relative z-10">
                                    <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite]"></div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">{levelData.hoursToNext > 0 ? `${levelData.hoursToNext.toFixed(1)} more hours to reach ${levelData.nextRank?.title}` : 'Max Rank Achieved!'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Charts Header & Controls --- */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Statistics</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Detailed breakdown of your study sessions.</p>
                </div>
                
                <div className="flex gap-4">
                    {/* Scope Toggle */}
                    <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl shadow-inner">
                        <button
                            onClick={() => setScope('project')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${scope === 'project' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            Project
                        </button>
                        <button
                            onClick={() => setScope('global')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${scope === 'global' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            Global
                        </button>
                    </div>

                    {/* Range Filter */}
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        {(['all', 'year', '30days', '7days'] as FilterRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setFilterRange(range)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    filterRange === range 
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                {range === 'all' ? 'All' : range === 'year' ? 'Year' : range === '30days' ? '30d' : '7d'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Total Hours ({scope})</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.totalHours.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-gray-400 font-medium">hrs</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Daily Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.avgHours.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-gray-400 font-medium">hrs</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mb-2">Weekday Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">{stats.avgWeekday.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-blue-400/70 font-medium">hrs</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 font-bold uppercase tracking-wider mb-2">Weekend Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">{stats.avgWeekend.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-purple-400/70 font-medium">hrs</span>
                    </div>
                </div>
            </div>

            {/* --- Charts Grid --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Activity Trend (Full Width) */}
                <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm lg:col-span-2">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Activity Trend</h3>
                        <div className="relative" ref={chartSettingsRef}>
                            <button 
                                onClick={() => setShowChartSettings(!showChartSettings)}
                                className={`p-1.5 rounded-lg transition-all ${
                                    showChartSettings 
                                    ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' 
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            </button>
                            {showChartSettings && (
                                <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700/50 p-2 z-20 animate-fade-in-up">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1.5 mb-1">Chart Type</div>
                                    <div className="space-y-1">
                                        <button onClick={() => { setChartType('bar'); setShowChartSettings(false); }} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300">Bar Chart</button>
                                        <button onClick={() => { setChartType('line'); setShowChartSettings(false); }} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300">Line Chart</button>
                                        <button onClick={() => { setChartType('area'); setShowChartSettings(false); }} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300">Area Chart</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {renderChart()}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity by Day (Fixed Widths) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm lg:col-span-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-6">Activity by Day</h3>
                    <div className="space-y-4">
                        {activityByDay.map((item) => (
                            <div key={item.day} className="flex items-center text-sm">
                                <div className="w-16 font-medium text-gray-500 dark:text-gray-400">{item.day}</div>
                                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mx-3">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full relative group transition-all duration-1000 ease-out" 
                                        style={{ width: `${item.percent}%` }}
                                    >
                                    </div>
                                </div>
                                <div className="w-16 text-right font-mono text-gray-700 dark:text-gray-300 text-xs">{item.hours.toFixed(1)}h</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Focus Patterns (Punch Card) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">Focus Patterns</h3>
                    <p className="text-xs text-gray-500 mb-6">Session Frequency: Day vs Hour</p>
                    <div className="h-64 w-full flex items-center justify-center">
                        {scatterData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                                    <XAxis type="number" dataKey="hour" name="Hour" unit=":00" domain={[0, 23]} tickCount={12} tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                                    <YAxis type="number" dataKey="day" name="Day" domain={[0, 6]} ticks={[0,1,2,3,4,5,6]} tickFormatter={(val) => weekDayLabels[val]} tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                                    <ZAxis type="number" dataKey="value" range={[50, 400]} name="Sessions" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)'}} />
                                    <Scatter name="Sessions" data={scatterData} fill="#8884d8" shape="circle">
                                        {scatterData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.value > 2 ? '#3b82f6' : '#93c5fd'} />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center p-4">
                                <div className="text-gray-300 dark:text-gray-600 mb-2">
                                    <svg className="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-sm text-gray-500">No timer sessions recorded yet.</p>
                                <p className="text-xs text-gray-400 mt-1">Use the Timer to populate this chart.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Project Distribution (Donut) - Only visible if Global Scope */}
                {scope === 'global' ? (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-6">Project Split</h3>
                        <div className="flex-1 flex items-center justify-center relative">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={projectDistData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {projectDistData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff'}} 
                                        formatter={(val: number) => [`${val.toFixed(1)} hrs`, '']} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalHours.toFixed(0)}</span>
                                <span className="text-xs text-gray-500 uppercase tracking-widest">Total Hrs</span>
                            </div>
                        </div>
                        {/* Legend */}
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                            {projectDistData.slice(0, 6).map((item, idx) => (
                                <div key={idx} className="flex items-center">
                                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                                    <span className="text-gray-600 dark:text-gray-300 truncate">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm flex flex-col items-center justify-center text-center opacity-70">
                        <div className="p-4 bg-gray-200 dark:bg-gray-700 rounded-full mb-3">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                        </div>
                        <p className="text-sm text-gray-500">Project Split is available in Global View</p>
                    </div>
                )}
            </div>

            {/* Badges Section */}
            {/* ... (Badges section remains unchanged) ... */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Badges & Achievements</h3>
                    <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {unlockedCount} / {achievements.length} Unlocked
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {achievements.map((badge) => (
                        <div 
                            key={badge.id}
                            className={`relative p-5 rounded-2xl border flex flex-col items-center text-center transition-all duration-300 group overflow-hidden ${
                                badge.isUnlocked 
                                ? 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1' 
                                : 'bg-gray-100 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-60'
                            }`}
                        >
                            <div className={`w-20 h-20 flex items-center justify-center rounded-full text-4xl shadow-inner mb-4 transition-transform duration-500 group-hover:scale-110 ${
                                badge.isUnlocked 
                                ? 'bg-gradient-to-tr from-blue-100 to-white dark:from-gray-700 dark:to-gray-600 ring-2 ring-blue-500/20' 
                                : 'bg-gray-200 dark:bg-gray-800 grayscale'
                            }`}>
                                {badge.icon}
                            </div>
                            
                            <div className="w-full z-10">
                                <div className="flex items-center justify-center gap-1.5 mb-2">
                                    <h4 className={`font-bold text-base truncate ${badge.isUnlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'}`}>
                                        {badge.title}
                                    </h4>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug px-1 h-8 line-clamp-2">
                                    {badge.description}
                                </p>
                            </div>

                            {badge.isUnlocked && (
                                <>
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/20 to-transparent -mr-8 -mt-8 rounded-full blur-xl pointer-events-none"></div>
                                    <div className="absolute top-3 right-3 bg-blue-500 text-white p-1 rounded-full shadow-lg transform scale-90 group-hover:scale-110 transition-transform">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Table */}
            {/* ... (Table section remains unchanged) ... */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mt-8">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Log History ({scope})</h3>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => {
                                    if (sortField === 'date') setSortDesc(!sortDesc);
                                    else { setSortField('date'); setSortDesc(true); }
                                }}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Date</span>
                                    {sortField === 'date' && (
                                        <span>{sortDesc ? '↓' : '↑'}</span>
                                    )}
                                </div>
                            </th>
                            <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => {
                                    if (sortField === 'hours') setSortDesc(!sortDesc);
                                    else { setSortField('hours'); setSortDesc(true); }
                                }}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>Hours</span>
                                    {sortField === 'hours' && (
                                        <span>{sortDesc ? '↓' : '↑'}</span>
                                    )}
                                </div>
                            </th>
                            <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Notes
                            </th>
                            <th className="p-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No logs found for this period.
                                </td>
                            </tr>
                        ) : (
                            filteredLogs.map((log) => (
                                <tr key={`${log.date}-${log.projectId}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4 text-sm text-gray-900 dark:text-gray-200 font-medium">
                                        {log.date}
                                        <div className="text-xs text-gray-400 font-normal">
                                            {new Date(log.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-900 dark:text-gray-200">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                            log.hours >= 4 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                            log.hours >= 1 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                        }`}>
                                            {log.hours} hrs
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {log.notes || <span className="text-gray-300 dark:text-gray-600 italic">-</span>}
                                        {scope === 'global' && (
                                            <span className="ml-2 text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 px-1 rounded">
                                                {projects.find(p => p.id === log.projectId)?.name}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => onEditLog(log.date)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all"
                                            title="Edit"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
      </div>
    </div>
  );
};