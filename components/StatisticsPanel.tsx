import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StudyLog, UserGoals, Project, SessionRecord } from '../types';
import { 
    BarChart, Bar, LineChart, Line, AreaChart, Area, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import { getSessions } from '../services/storageService';
import { useTheme } from '../AppContext';
import { Heatmap } from './Heatmap';

interface StatisticsPanelProps {
  logs: StudyLog[];
  allLogs: StudyLog[];
  projects: Project[];
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
  onEditLog: (date: string) => void;
  projectId: string;
  goalHistory?: { date: string; goals: UserGoals }[];
}

type SortField = 'date' | 'hours';
type FilterRange = 'all' | '7days' | '30days' | 'year';
type ChartType = 'bar' | 'line' | 'area';
type ScopeType = 'project' | 'global';
type GoalPeriod = 'daily' | 'weekly' | 'monthly';

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];
const CYBERPUNK_COLORS = ['#00f0ff', '#ff00ff', '#00ff00', '#ffff00', '#ff0099', '#9900ff', '#0099ff'];

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ logs, allLogs, projects, goals, onUpdateGoals, onEditLog, projectId, goalHistory = [] }) => {
  const { appTheme, isDarkMode } = useTheme();
  const isCyberpunk = appTheme === 'cyberpunk';
  const COLORS = isCyberpunk ? CYBERPUNK_COLORS : DEFAULT_COLORS;

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
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>('daily');
  const [showHeatmapComparison, setShowHeatmapComparison] = useState(false);
  
  // Session Data for Scatter Plot
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const chartSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      // Load sessions for advanced analytics
      getSessions().then(setSessions);

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

      // Trend Calculation
      const now = new Date();
      let startCurrent = new Date(0);
      let startPrevious = new Date(0);
      let endPrevious = new Date(0);

      if (filterRange === '7days') {
          startCurrent = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          startPrevious = new Date(startCurrent.getTime() - 7 * 24 * 60 * 60 * 1000);
          endPrevious = startCurrent;
      } else if (filterRange === '30days') {
          startCurrent = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          startPrevious = new Date(startCurrent.getTime() - 30 * 24 * 60 * 60 * 1000);
          endPrevious = startCurrent;
      } else if (filterRange === 'year') {
          startCurrent = new Date(now.getFullYear(), 0, 1);
          startPrevious = new Date(now.getFullYear() - 1, 0, 1);
          endPrevious = new Date(now.getFullYear() - 1, 11, 31);
      }

      let trend = 0;
      if (filterRange !== 'all') {
          const prevLogs = targetLogs.filter(l => {
              const d = new Date(l.date);
              return d >= startPrevious && d < endPrevious;
          });
          const prevTotal = prevLogs.reduce((acc, curr) => acc + curr.hours, 0);
          trend = prevTotal > 0 ? ((totalHours - prevTotal) / prevTotal) * 100 : 0;
      }

      return { totalHours, avgHours, avgWeekday, avgWeekend, trend };
  }, [filteredLogs, targetLogs, filterRange]);

  // Productivity Pulse
  const productivityPulse = useMemo(() => {
      const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
      sessions.forEach(s => {
          const hour = new Date(s.startTime).getHours();
          const duration = s.duration;
          if (hour >= 5 && hour < 12) buckets.Morning += duration;
          else if (hour >= 12 && hour < 17) buckets.Afternoon += duration;
          else if (hour >= 17 && hour < 22) buckets.Evening += duration;
          else buckets.Night += duration;
      });
      const total = Object.values(buckets).reduce((a, b) => a + b, 0);
      if (total === 0) return null;
      const maxKey = Object.keys(buckets).reduce((a, b) => buckets[a as keyof typeof buckets] > buckets[b as keyof typeof buckets] ? a : b);
      return { timeOfDay: maxKey, percent: Math.round((buckets[maxKey as keyof typeof buckets] / total) * 100) };
  }, [sessions]);

  // Helper to get goal for a specific date from history
  const getGoalForDate = (date: Date) => {
      if (!goalHistory || goalHistory.length === 0) return goals;
      
      const dateStr = date.toISOString();
      // Find the latest goal setting that is before or equal to this date
      // We assume history is sorted or we filter and sort to find the effective one
      const applicable = goalHistory
          .filter(h => h.date <= dateStr)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
          
      return applicable ? applicable.goals : (goalHistory[0]?.goals || goals);
  };

  // Goal Adherence Data
  const goalData = useMemo(() => {
      const data: { label: string; hours: number; goal: number }[] = [];
      const now = new Date();

      if (goalPeriod === 'daily') {
          // Last 14 days
          for (let i = 13; i >= 0; i--) {
              const d = new Date(now);
              d.setDate(d.getDate() - i);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const hours = targetLogs.filter(l => l.date === dateStr).reduce((acc, curr) => acc + curr.hours, 0);
              const historicalGoal = getGoalForDate(d);
              data.push({
                  label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
                  hours,
                  goal: historicalGoal.daily || 4
              });
          }
      } else if (goalPeriod === 'weekly') {
          // Last 8 weeks
          for (let i = 7; i >= 0; i--) {
              const d = new Date(now);
              d.setDate(d.getDate() - (i * 7));
              const day = d.getDay();
              const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
              const monday = new Date(d.setDate(diff));
              const nextSunday = new Date(monday);
              nextSunday.setDate(monday.getDate() + 6);
              
              const startStr = monday.toISOString().split('T')[0]; // Approximate check
              // Better to use timestamps for range
              const startTs = monday.setHours(0,0,0,0);
              const endTs = nextSunday.setHours(23,59,59,999);

              const hours = targetLogs.filter(l => {
                  const lTs = new Date(l.date).getTime();
                  return lTs >= startTs && lTs <= endTs;
              }).reduce((acc, curr) => acc + curr.hours, 0);
              
              const historicalGoal = getGoalForDate(monday);
              data.push({
                  label: `W${8-i}`,
                  hours,
                  goal: historicalGoal.weekly
              });
          }
      } else if (goalPeriod === 'monthly') {
          // Last 6 months
          for (let i = 5; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const month = d.getMonth();
              const year = d.getFullYear();
              
              const hours = targetLogs.filter(l => {
                  const ld = new Date(l.date);
                  return ld.getMonth() === month && ld.getFullYear() === year;
              }).reduce((acc, curr) => acc + curr.hours, 0);
              
              const historicalGoal = getGoalForDate(d);
              data.push({
                  label: d.toLocaleDateString('en-US', { month: 'short' }),
                  hours,
                  goal: historicalGoal.monthly
              });
          }
      }
      return data;
  }, [targetLogs, goalPeriod, goals, goalHistory]);

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleExportReport = () => {
      const now = new Date();
      const reportWindow = window.open('', '_blank');
      if (!reportWindow) return;

      const html = `
        <html>
          <head>
            <title>FocusFlow Report</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1f2937; }
              h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
              .meta { color: #6b7280; margin-bottom: 30px; }
              .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
              .card { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
              .val { font-size: 24px; font-weight: bold; color: #111827; }
              .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { text-align: left; padding: 12px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb; font-size: 14px; }
              td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
              @media print { body { padding: 0; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <h1>Activity Report</h1>
            <div class="meta">Generated on ${now.toLocaleDateString()} • Scope: ${scope.toUpperCase()}</div>
            
            <div class="grid">
              <div class="card"><div class="label">Total Hours</div><div class="val">${stats.totalHours.toFixed(1)}h</div></div>
              <div class="card"><div class="label">Daily Average</div><div class="val">${stats.avgHours.toFixed(1)}h</div></div>
              <div class="card"><div class="label">Sessions</div><div class="val">${sessions.length}</div></div>
            </div>

            <h2>Project Breakdown</h2>
            <table>
              <thead><tr><th>Project</th><th>Hours</th><th>%</th></tr></thead>
              <tbody>
                ${projectDistData.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.value.toFixed(1)}</td>
                    <td>${((p.value / stats.totalHours) * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>window.print();</script>
          </body>
        </html>
      `;
      reportWindow.document.write(html);
      reportWindow.document.close();
  };
  
  const renderChart = () => {
    const commonProps = {
        data: chartData,
        margin: { top: 10, right: 10, left: -20, bottom: 0 }
    };

    if (chartType === 'line') {
        return (
            <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isCyberpunk ? "#00f0ff" : "#e5e7eb"} opacity={isCyberpunk ? 0.1 : 0.5} />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ stroke: isCyberpunk ? '#00f0ff' : '#3b82f6', strokeWidth: 1 }}
                    contentStyle={{borderRadius: '12px', border: isCyberpunk ? '1px solid rgba(0, 240, 255, 0.3)' : 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: isCyberpunk ? '#000' : '#ffffff', color: isCyberpunk ? '#00f0ff' : '#1f2937'}} 
                    itemStyle={{ color: isCyberpunk ? '#00f0ff' : '#1f2937' }}
                />
                <Line type="monotone" dataKey="hours" stroke={isCyberpunk ? "#00f0ff" : "#3b82f6"} strokeWidth={3} dot={{r: 3, fill: isCyberpunk ? "#00f0ff" : "#3b82f6", strokeWidth: 2, stroke: isCyberpunk ? '#000' : '#fff'}} activeDot={{r: 6}} />
            </LineChart>
        );
    } else if (chartType === 'area') {
        return (
            <AreaChart {...commonProps}>
                <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isCyberpunk ? "#00f0ff" : "#8b5cf6"} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={isCyberpunk ? "#00f0ff" : "#8b5cf6"} stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isCyberpunk ? "#00f0ff" : "#e5e7eb"} opacity={isCyberpunk ? 0.1 : 0.5} />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ stroke: isCyberpunk ? '#00f0ff' : '#8b5cf6', strokeWidth: 1 }}
                    contentStyle={{borderRadius: '12px', border: isCyberpunk ? '1px solid rgba(0, 240, 255, 0.3)' : 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: isCyberpunk ? '#000' : '#ffffff', color: isCyberpunk ? '#00f0ff' : '#1f2937'}} 
                    itemStyle={{ color: isCyberpunk ? '#00f0ff' : '#1f2937' }}
                />
                <Area type="monotone" dataKey="hours" stroke={isCyberpunk ? "#00f0ff" : "#8b5cf6"} fillOpacity={1} fill="url(#colorHours)" strokeWidth={3} />
            </AreaChart>
        );
    }
    return (
        <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isCyberpunk ? "#00f0ff" : "#e5e7eb"} opacity={isCyberpunk ? 0.1 : 0.5} />
            <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
            <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
            <Tooltip 
                cursor={{fill: isCyberpunk ? 'rgba(0, 240, 255, 0.1)' : 'rgba(59, 130, 246, 0.1)'}} 
                contentStyle={{borderRadius: '12px', border: isCyberpunk ? '1px solid rgba(0, 240, 255, 0.3)' : 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: isCyberpunk ? '#000' : '#ffffff', color: isCyberpunk ? '#00f0ff' : '#1f2937'}} 
                itemStyle={{ color: isCyberpunk ? '#00f0ff' : '#1f2937' }}
            />
            <Bar dataKey="hours" fill={isCyberpunk ? "#00f0ff" : "#3b82f6"} radius={[4, 4, 0, 0]} barSize={32} />
        </BarChart>
    );
  };

  // Session Duration Data
  const durationData = useMemo(() => {
      const now = new Date();
      let cutoff = new Date(0); 
      if (filterRange === '7days') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (filterRange === '30days') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (filterRange === 'year') cutoff = new Date(now.getFullYear(), 0, 1);

      const relevantSessions = sessions.filter(s => {
          const sDate = new Date(s.startTime);
          const dateMatch = sDate >= cutoff;
          const scopeMatch = scope === 'global' || s.projectId === projectId;
          return dateMatch && scopeMatch;
      });

      const buckets = [
          { name: '< 25m', count: 0 },
          { name: '25-50m', count: 0 },
          { name: '50-90m', count: 0 },
          { name: '> 90m', count: 0 },
      ];

      relevantSessions.forEach(s => {
          const m = s.duration / 60;
          if (m < 25) buckets[0].count++;
          else if (m < 50) buckets[1].count++;
          else if (m < 90) buckets[2].count++;
          else buckets[3].count++;
      });

      return buckets;
  }, [sessions, scope, projectId, filterRange]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300">
      <div className="p-8 h-full overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* --- Charts Header & Controls --- */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div>
                    <h2 className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-gray-900 dark:text-white'}`}>Statistics</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Detailed breakdown of your study sessions.</p>
                </div>
                
                <div className="flex gap-4">
                    {/* Scope Toggle */}
                    <div className={`flex p-1 rounded-xl shadow-inner ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-800'}`}>
                        <button
                            onClick={() => setScope('project')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${scope === 'project' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm') : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            Project
                        </button>
                        <button
                            onClick={() => setScope('global')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${scope === 'global' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm') : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            Global
                        </button>
                    </div>

                    {/* Range Filter */}
                    <div className={`flex p-1 rounded-xl border shadow-sm ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                        {(['all', 'year', '30days', '7days'] as FilterRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setFilterRange(range)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    filterRange === range 
                                    ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm')
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                {range === 'all' ? 'All' : range === 'year' ? 'Year' : range === '30days' ? '30d' : '7d'}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={handleExportReport}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Export
                    </button>
                </div>
            </div>

            {/* Stats Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-5 rounded-2xl border shadow-sm flex flex-col`}>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Total Hours ({scope})</p>
                    <div className="flex items-baseline mt-auto">
                        <p className={`text-3xl font-bold tracking-tight ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{stats.totalHours.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-gray-400 font-medium">hrs</span>
                    </div>
                    {filterRange !== 'all' && (
                        <div className={`text-xs font-bold mt-2 ${stats.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {stats.trend > 0 ? '+' : ''}{stats.trend.toFixed(1)}% <span className="text-gray-400 font-normal">vs prev</span>
                        </div>
                    )}
                </div>
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-5 rounded-2xl border shadow-sm flex flex-col`}>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Daily Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className={`text-3xl font-bold tracking-tight ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{stats.avgHours.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-gray-400 font-medium">hrs</span>
                    </div>
                </div>
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-5 rounded-2xl border shadow-sm flex flex-col`}>
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mb-2">Weekday Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className={`text-3xl font-bold tracking-tight ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400'}`}>{stats.avgWeekday.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-blue-400/70 font-medium">hrs</span>
                    </div>
                </div>
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-5 rounded-2xl border shadow-sm flex flex-col`}>
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 font-bold uppercase tracking-wider mb-2">Weekend Avg</p>
                    <div className="flex items-baseline mt-auto">
                        <p className={`text-3xl font-bold tracking-tight ${isCyberpunk ? 'text-[#f0f]' : 'text-purple-600 dark:text-purple-400'}`}>{stats.avgWeekend.toFixed(1)}</p>
                        <span className="ml-1 text-sm text-purple-400/70 font-medium">hrs</span>
                    </div>
                </div>
                {productivityPulse && (
                    <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-5 rounded-2xl border shadow-sm flex flex-col`}>
                        <p className="text-[10px] text-green-500 dark:text-green-400 font-bold uppercase tracking-wider mb-2">Productivity Pulse</p>
                        <div className="flex flex-col mt-auto">
                            <p className={`text-xl font-bold tracking-tight ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{productivityPulse.percent}% in {productivityPulse.timeOfDay}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Goal Adherence Chart */}
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-6 rounded-2xl border shadow-sm`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`font-bold text-lg ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Goal Adherence</h3>
                    <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#000] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        {(['daily', 'weekly', 'monthly'] as GoalPeriod[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setGoalPeriod(p)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all capitalize ${
                                    goalPeriod === p 
                                    ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm')
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={goalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isCyberpunk ? "#00f0ff" : "#e5e7eb"} opacity={isCyberpunk ? 0.1 : 0.5} />
                            <XAxis dataKey="label" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} />
                            <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                            <Tooltip 
                                cursor={{fill: isCyberpunk ? 'rgba(0, 240, 255, 0.1)' : 'rgba(59, 130, 246, 0.1)'}} 
                                contentStyle={{borderRadius: '12px', border: isCyberpunk ? '1px solid rgba(0, 240, 255, 0.3)' : 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: isCyberpunk ? '#000' : '#ffffff', color: isCyberpunk ? '#00f0ff' : '#1f2937'}}
                                itemStyle={{ color: isCyberpunk ? '#00f0ff' : '#1f2937' }}
                            />
                            <Bar dataKey="hours" fill={isCyberpunk ? "#00f0ff" : "#3b82f6"} radius={[4, 4, 0, 0]} barSize={20} />
                            <Line type="stepAfter" dataKey="goal" stroke={isCyberpunk ? "#ff00ff" : "#ef4444"} strokeWidth={2} dot={false} activeDot={false} strokeDasharray="5 5" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- Charts Grid --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Activity Trend (Full Width) */}
                <div className={`w-full ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-6 rounded-2xl border shadow-sm lg:col-span-2`}>
                    <div className="flex justify-between items-center mb-8">
                        <h3 className={`font-bold text-lg ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Activity Trend</h3>
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
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-6 rounded-2xl border shadow-sm lg:col-span-2`}>
                    <h3 className={`font-bold text-lg mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Activity by Day</h3>
                    <div className="space-y-4">
                        {activityByDay.map((item) => (
                            <div key={item.day} className="flex items-center text-sm">
                                <div className="w-16 font-medium text-gray-500 dark:text-gray-400">{item.day}</div>
                                <div className={`flex-1 h-3 rounded-full overflow-hidden mx-3 ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                    <div 
                                        className={`h-full rounded-full relative group transition-all duration-1000 ease-out ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-blue-500'}`}
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
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-6 rounded-2xl border shadow-sm relative`}>
                    <h3 className={`font-bold text-lg mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Focus Patterns</h3>
                    <p className="text-xs text-gray-500 mb-6">Session Frequency: Day vs Hour</p>
                    <div className="h-64 w-full flex items-center justify-center">
                        {scatterData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={isCyberpunk ? "#00f0ff" : "#e5e7eb"} opacity={isCyberpunk ? 0.1 : 0.3} />
                                    <XAxis type="number" dataKey="hour" name="Hour" unit=":00" domain={[0, 23]} tickCount={12} tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                                    <YAxis type="number" dataKey="day" name="Day" domain={[0, 6]} ticks={[0,1,2,3,4,5,6]} tickFormatter={(val) => weekDayLabels[val]} tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                                    <ZAxis type="number" dataKey="value" range={[50, 400]} name="Sessions" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{borderRadius: '12px', border: isCyberpunk ? '1px solid rgba(0, 240, 255, 0.3)' : 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: isCyberpunk ? '#000' : '#ffffff', color: isCyberpunk ? '#00f0ff' : '#1f2937'}} itemStyle={{ color: isCyberpunk ? '#00f0ff' : '#1f2937' }} />
                                    <Scatter name="Sessions" data={scatterData} fill={isCyberpunk ? "#00f0ff" : "#8884d8"} shape="circle">
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

                {/* Session Duration Chart */}
                <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-6 rounded-2xl border shadow-sm`}>
                    <h3 className={`font-bold text-lg mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Session Duration</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={durationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isCyberpunk ? "#00f0ff" : "#e5e7eb"} opacity={isCyberpunk ? 0.1 : 0.5} />
                                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} dy={10} />
                                <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip 
                                    cursor={{fill: isCyberpunk ? 'rgba(0, 240, 255, 0.1)' : 'rgba(59, 130, 246, 0.1)'}} 
                                    contentStyle={{borderRadius: '12px', border: isCyberpunk ? '1px solid rgba(0, 240, 255, 0.3)' : 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: isCyberpunk ? '#000' : '#ffffff', color: isCyberpunk ? '#00f0ff' : '#1f2937'}}
                                    itemStyle={{ color: isCyberpunk ? '#00f0ff' : '#1f2937' }}
                                />
                                <Bar dataKey="count" fill={isCyberpunk ? "#00f0ff" : "#8b5cf6"} radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Project Distribution (Donut) - Only visible if Global Scope */}
                {scope === 'global' ? (
                    <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-6 rounded-2xl border shadow-sm flex flex-col`}>
                        <h3 className={`font-bold text-lg mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Project Split</h3>
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
                                        nameKey="name"
                                    >
                                        {projectDistData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{borderRadius: '12px', border: isCyberpunk ? '1px solid rgba(0, 240, 255, 0.3)' : 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: isCyberpunk ? '#000' : '#ffffff', color: isCyberpunk ? '#00f0ff' : '#1f2937'}} 
                                        itemStyle={{ color: isCyberpunk ? '#00f0ff' : '#1f2937' }}
                                        formatter={(val: number, name: any) => [`${val.toFixed(1)} hrs`, name]} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{stats.totalHours.toFixed(0)}</span>
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

            {/* Heatmap Comparison */}
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-6 rounded-2xl border shadow-sm`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`font-bold text-lg ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Yearly Comparison</h3>
                    <button 
                        onClick={() => setShowHeatmapComparison(!showHeatmapComparison)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${showHeatmapComparison ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400')}`}
                    >
                        {showHeatmapComparison ? 'Hide Comparison' : 'Compare Years'}
                    </button>
                </div>
                
                <div className="space-y-8">
                    <div>
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">{new Date().getFullYear()}</p>
                        <Heatmap data={targetLogs} year={new Date().getFullYear()} onDayClick={onEditLog} isDarkMode={isDarkMode} theme="green" onThemeChange={() => {}} />
                    </div>
                    {showHeatmapComparison && (
                        <div className="animate-fade-in-down">
                            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">{new Date().getFullYear() - 1}</p>
                            <Heatmap data={targetLogs} year={new Date().getFullYear() - 1} onDayClick={onEditLog} isDarkMode={isDarkMode} theme="blue" onThemeChange={() => {}} />
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};