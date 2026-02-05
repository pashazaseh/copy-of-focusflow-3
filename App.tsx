import React, { Component, useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { MacWindow } from './components/MacWindow';
import { Sidebar } from './components/Sidebar';
import { QuickTimerOverlay } from './components/QuickTimerOverlay';
import { ViewMode, HeatmapTheme, UserGoals, CountdownItem, Achievement, Transaction, StudyLog } from './types';
import { AppProvider, useTheme, useProjects, useLogs, useUI, useTimerContext, useCountdowns } from './AppContext';
import { TimerPanel } from './components/TimerPanel';
import { getUnlockedAchievements, calculateTotalGems } from './services/gamificationService';
import { playWin } from './services/audioService';

// Lazy load heavy components
const CalendarPanel = lazy(() => import('./components/CalendarPanel').then(m => ({ default: m.CalendarPanel })));
const StatisticsPanel = lazy(() => import('./components/StatisticsPanel').then(m => ({ default: m.StatisticsPanel })));
const CountdownPanel = lazy(() => import('./components/CountdownPanel').then(m => ({ default: m.CountdownPanel })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const Heatmap = lazy(() => import('./components/Heatmap').then(m => ({ default: m.Heatmap })));
const InsightsPanel = lazy(() => import('./components/InsightsPanel').then(m => ({ default: m.InsightsPanel })));
const GamificationPanel = lazy(() => import('./components/GamificationPanel').then(m => ({ default: m.GamificationPanel })));
const GoalsPanel = lazy(() => import('./components/GoalsPanel').then(m => ({ default: m.GoalsPanel })));

// Add loading fallback
const PanelLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

// Helper for safe local date parsing
const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Toast Notification Component
const Toast = ({ title, icon, onClose, isCyberpunk }: { title: string, icon: string, onClose: () => void, isCyberpunk: boolean }) => (
    <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in-down pointer-events-none">
        <div className={`px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 backdrop-blur-xl pointer-events-auto transition-all ${isCyberpunk ? 'bg-black/90 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.4)]' : 'bg-gray-900/95 text-white border-white/10 shadow-xl'}`}>
            <div className={`text-3xl ${isCyberpunk ? 'drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]' : ''}`}>{icon}</div>
            <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-yellow-400'}`}>Achievement Unlocked</p>
                <p className="font-bold text-base leading-none">{title}</p>
            </div>
            <button onClick={onClose} className={`ml-2 p-1 rounded-full transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20 text-[#00f0ff]/50 hover:text-[#00f0ff]' : 'hover:bg-white/20 text-gray-400 hover:text-white'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    </div>
);

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  public state = { hasError: false };

  static getDerivedStateFromError(_: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="mb-4 text-gray-600 dark:text-gray-400">An error occurred while rendering the application.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Extracted Memoized Components to prevent re-renders on input change ---

const DashboardHeader = React.memo(({ activeProjectName, currentYear, activeProject, streaks }: { activeProjectName: string, currentYear: number, activeProject: any, streaks: any }) => (
    <header className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 border border-gray-200 dark:border-gray-700/50 shadow-sm flex flex-col justify-center h-32">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            {activeProjectName} 
            <span className="mx-3 text-gray-300 dark:text-gray-700 font-light text-2xl">|</span>
            <span className="text-gray-400 dark:text-gray-500 font-normal">{currentYear}</span>
        </h2>
        <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 dark:text-gray-400">Dashboard Overview</p>
            {activeProject?.weeklyGoal && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">Goal: {activeProject.weeklyGoal}h/wk</span>
            )}
        </div>
        </div>
        
        <div className="relative group overflow-hidden bg-gradient-to-r from-orange-500 to-rose-500 rounded-3xl shadow-xl h-32 transform transition-transform hover:scale-[1.02]">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-yellow-400 opacity-20 rounded-full blur-2xl"></div>
            <div className="relative p-6 h-full flex items-center justify-between">
                <div className="flex-1 border-r border-white/20 pr-6">
                    <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest opacity-90 mb-1">Current Streak</p>
                    <div className="flex items-baseline">
                        <span className="text-4xl font-black text-white tracking-tighter drop-shadow-sm leading-none">{streaks.current}</span>
                        <span className="ml-1.5 text-sm font-bold text-orange-50/90">Days</span>
                    </div>
                </div>
                <div className="flex-1 pl-6">
                        <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest opacity-90 mb-1">Longest Streak</p>
                    <div className="flex items-baseline">
                        <span className="text-4xl font-black text-white tracking-tighter drop-shadow-sm leading-none">{streaks.longest}</span>
                        <span className="ml-1.5 text-sm font-bold text-orange-50/90">Days</span>
                    </div>
                </div>
            </div>
        </div>
    </header>
));

const LogHistoryTable = React.memo(({ 
    paginatedHistory, 
    historySortField, 
    historySortDesc, 
    setHistorySortField, 
    setHistorySortDesc, 
    handleDayClick, 
    historyScope, 
    projects,
    unifiedHistoryLength,
    ITEMS_PER_PAGE,
    historyPage,
    setHistoryPage
}: any) => (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => {
                            if (historySortField === 'date') setHistorySortDesc(!historySortDesc);
                            else { setHistorySortField('date'); setHistorySortDesc(true); }
                        }}
                    >
                        <div className="flex items-center space-x-1">
                            <span>Date</span>
                            {historySortField === 'date' && <span>{historySortDesc ? '↓' : '↑'}</span>}
                        </div>
                    </th>
                    <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => {
                            if (historySortField === 'hours') setHistorySortDesc(!historySortDesc);
                            else { setHistorySortField('hours'); setHistorySortDesc(true); }
                        }}
                    >
                        <div className="flex items-center space-x-1">
                            <span>Value</span>
                            {historySortField === 'hours' && <span>{historySortDesc ? '↓' : '↑'}</span>}
                        </div>
                    </th>
                    <th className="p-4 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                    <th className="p-4 w-10"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedHistory.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">No logs found for this period.</td></tr>
                ) : (
                    paginatedHistory.map((item: any) => (
                        <tr key={item.kind === 'log' ? `log-${item.data.date}-${item.data.projectId}` : item.data.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="p-4 text-sm text-gray-900 dark:text-gray-200 font-medium">
                                {item.kind === 'log' ? item.data.date : new Date(item.data.date).toLocaleDateString()}
                                <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                    {item.kind === 'log' 
                                        ? new Date(item.data.date).toLocaleDateString('en-US', { weekday: 'long' })
                                        : new Date(item.data.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                    }
                                </div>
                            </td>
                            <td className="p-4 text-sm text-gray-900 dark:text-gray-200">
                                {item.kind === 'log' ? (
                                    <div className="flex flex-col items-start gap-1">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${item.data.hours >= 4 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : item.data.hours >= 1 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                            {item.data.hours} hrs
                                        </span>
                                        <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 ml-0.5">
                                            +{Math.floor(item.data.hours * 20)} 💎
                                        </span>
                                    </div>
                                ) : (
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                        item.data.type === 'SPEND' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                        item.data.type === 'UNLOCK' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                    }`}>
                                        {item.data.amount > 0 ? '+' : ''}{item.data.amount} 💎
                                    </span>
                                )}
                            </td>
                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                {item.kind === 'log' ? (
                                    <>
                                        {item.data.notes || <span className="text-gray-300 dark:text-gray-600 italic">-</span>}
                                        {historyScope === 'global' && (
                                            <span className="ml-2 text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 px-1 rounded">{projects.find((p: any) => p.id === item.data.projectId)?.name}</span>
                                        )}
                                    </>
                                ) : (
                                    <span>{item.data.description}</span>
                                )}
                            </td>
                            <td className="p-4 text-right">
                                {item.kind === 'log' && (
                                    <button onClick={() => handleDayClick(item.data.date)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all" title="Edit">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
        
        {/* Pagination Controls */}
        {unifiedHistoryLength > ITEMS_PER_PAGE && (
            <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <button 
                    onClick={() => setHistoryPage((p: number) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    Previous
                </button>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Page {historyPage} of {Math.ceil(unifiedHistoryLength / ITEMS_PER_PAGE)}
                </span>
                <button 
                    onClick={() => setHistoryPage((p: number) => Math.min(Math.ceil(unifiedHistoryLength / ITEMS_PER_PAGE), p + 1))}
                    disabled={historyPage >= Math.ceil(unifiedHistoryLength / ITEMS_PER_PAGE)}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    Next
                </button>
            </div>
        )}
    </div>
));

function FocusFlowContent() {
  // --- Context Hooks ---
  const { isDarkMode, toggleTheme, appTheme, setAppTheme } = useTheme();
  const { projects, currentProjectId, setCurrentProjectId, createProject, deleteProject, updateProjects } = useProjects();
  const { logs, goals, saveLog, deleteLog, updateGoals, transactions, addTransaction } = useLogs();
  const { currentView, setCurrentView, settingsTab, setSettingsTab, navConfig, setNavConfig, sidebarConfig, setSidebarConfig, menuBarConfig, setMenuBarConfig } = useUI();
  const { pendingQuickTimer, setPendingQuickTimer } = useTimerContext();
  const { countdowns } = useCountdowns();

  // --- Quick Timer Overlay Mode Check ---
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  if (searchParams.get('mode') === 'quick') {
      return <QuickTimerOverlay />;
  }

  const [timerViewInitialized, setTimerViewInitialized] = useState(false);
  
  // Dashboard state
  // Use local date string for initial selected date to match heatmap logic
  const [selectedDate, setSelectedDate] = useState<string>(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [hoursInput, setHoursInput] = useState<number | string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  
  // Gamification State (Lifted/Shared via LocalStorage)
  const [freezeDates, setFreezeDates] = useState<string[]>(() => {
      if (typeof window !== 'undefined') {
          try {
              return JSON.parse(localStorage.getItem('focusflow_freeze_dates') || '[]');
          } catch (e) {
              return [];
          }
      }
      return [];
  });

  // Goal History State (Lifted/Shared via LocalStorage)
  const [goalHistory, setGoalHistory] = useState<{date: string, goals: UserGoals}[]>(() => {
      if (typeof window !== 'undefined') {
          try {
              return JSON.parse(localStorage.getItem('focusflow_goal_history') || '[]');
          } catch { return []; }
      }
      return [];
  });

  // Log History State (Moved from StatisticsPanel)
  const [historyScope, setHistoryScope] = useState<'project' | 'global'>('project');
  const [historyFilter, setHistoryFilter] = useState<'all' | '7days' | '30days' | 'year'>('30days');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'study' | 'economy'>('all');
  const [historySortField, setHistorySortField] = useState<'date' | 'hours'>('date');
  const [historySortDesc, setHistorySortDesc] = useState(true);

  // Pagination State
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Toast State
  const [toast, setToast] = useState<{title: string, icon: string} | null>(null);
  const prevBadgeCount = useRef<number>(-1);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Economy State for TimerPanel
  const [economyState, setEconomyState] = useState({ bonus: 0, spent: 0 });

  // Poll for economy changes (since they happen in localStorage)
  useEffect(() => {
      const checkEconomy = () => {
          const bonus = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0;
          const spent = parseInt(localStorage.getItem('focusflow_spent_gems') || '0') || 0;
          if (bonus !== economyState.bonus || spent !== economyState.spent) {
              setEconomyState({ bonus, spent });
          }
      };
      const interval = setInterval(checkEconomy, 2000);
      return () => clearInterval(interval);
  }, [economyState]);

  // --- Daily Login Bonus ---
  useEffect(() => {
      const checkDailyBonus = () => {
          const today = new Date().toISOString().split('T')[0];
          const lastLogin = localStorage.getItem('focusflow_last_login_date');

          if (lastLogin !== today) {
              const bonusAmount = 50;
              
              // Update Bonus Gems (Direct localStorage manipulation to sync with GamificationPanel)
              const currentBonus = parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0;
              localStorage.setItem('focusflow_bonus_gems', (currentBonus + bonusAmount).toString());
              
              // Add Transaction
              addTransaction({
                  id: `daily-bonus-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'EARN',
                  amount: bonusAmount,
                  description: 'Daily Login Bonus'
              });

              localStorage.setItem('focusflow_last_login_date', today);
              
              setToast({ title: `Daily Bonus: +${bonusAmount} Gems`, icon: '🎁' });
              
              const savedVol = localStorage.getItem('focusflow_timer_volume');
              const vol = savedVol ? parseFloat(savedVol) : 0.5;
              playWin(vol);
              setTimeout(() => setToast(null), 5000);
          }
      };
      const timer = setTimeout(checkDailyBonus, 1500);
      return () => clearTimeout(timer);
  }, [addTransaction]);

  // Reset page when filters change
  useEffect(() => setHistoryPage(1), [historyFilter, historyScope, historySortField, historySortDesc, historyTypeFilter]);

  const formRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    if (currentView === ViewMode.TIMER) setTimerViewInitialized(true);
  }, [currentView]);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
      const projectLog = logs.find(l => l.date === selectedDate && l.projectId === currentProjectId);
      setHoursInput(projectLog ? projectLog.hours : '');
      setNotesInput(projectLog ? projectLog.notes || '' : '');
  }, [currentProjectId, projects, selectedDate, logs]);

  const handleUpdateGoals = (newGoals: UserGoals) => {
      const now = new Date().toISOString();
      const newHistory = [...goalHistory];
      
      // If history is empty, assume the *previous* goals applied from the beginning of time
      if (newHistory.length === 0) {
          newHistory.push({ date: '1970-01-01T00:00:00.000Z', goals: goals });
      }
      
      newHistory.push({ date: now, goals: newGoals });
      setGoalHistory(newHistory);
      localStorage.setItem('focusflow_goal_history', JSON.stringify(newHistory));
      updateGoals(newGoals);
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hoursInput);
    if (isNaN(h) || h < 0 || h > 24) return;
    saveLog(selectedDate, h, notesInput);
  };

  const handleTimerSave = (sessionHours: number, sessionNote?: string, sessionProjectId?: string) => {
      const targetProject = sessionProjectId || currentProjectId;
      if (!targetProject) return;
      const d = new Date();
      // Use local date string
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const existing = logs.find(l => l.date === today && l.projectId === targetProject);
      const totalHours = (existing ? existing.hours : 0) + sessionHours;
      const mergedNotes = [existing?.notes, sessionNote]
          .filter(n => n && n.trim().length > 0)
          .join('; ');

      saveLog(today, totalHours, mergedNotes, targetProject);
  };
  
  const handleDeleteLog = () => {
      const confirmed = window.confirm("Are you sure you want to delete this entry?");
      if (confirmed && currentProjectId) {
          deleteLog(selectedDate, currentProjectId);
          setHoursInput('');
          setNotesInput('');
      }
  };

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    // Logic to scroll or switch view is handled by effects or user action, 
    // but here we just set date. The effect above syncs inputs.
    // If we want to switch view:
    if (currentView !== ViewMode.DASHBOARD) setCurrentView(ViewMode.DASHBOARD);
    if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentView, setCurrentView]);
  
  const handleEditLogFromStats = (date: string) => {
      handleDayClick(date);
      setCurrentView(ViewMode.DASHBOARD);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const date = e.target.value;
      setSelectedDate(date);
  };

  const handleThemeChange = (newTheme: HeatmapTheme) => {
      const updated = projects.map(p => p.id === currentProjectId ? {...p, theme: newTheme} : p);
      updateProjects(updated);
      // Note: updateProjects in context also saves to storage
  };

  const handleConsumeQuickTimer = () => {
      setPendingQuickTimer(null);
  };

  const handleManageProjects = () => {
      setCurrentView(ViewMode.SETTINGS);
      setSettingsTab('projects');
  };

  // --- Calculations ---
  const currentYear = new Date().getFullYear();
  const projectLogs = useMemo(() => logs.filter(l => l.projectId === currentProjectId), [logs, currentProjectId]);
  const activeLog = useMemo(() => projectLogs.find(l => l.date === selectedDate), [projectLogs, selectedDate]);

  // Unified History Item Type
  type HistoryItem = 
    | { kind: 'log', date: string, data: StudyLog }
    | { kind: 'tx', date: string, data: Transaction };

  const unifiedHistory = useMemo(() => {
      let items: HistoryItem[] = [];

      // 1. Add Study Logs
      if (historyTypeFilter === 'all' || historyTypeFilter === 'study') {
          const targetLogs = historyScope === 'global' ? logs : projectLogs;
          items = items.concat(targetLogs.map(l => ({ kind: 'log', date: l.date, data: l })));
      }

      // 2. Add Transactions (Only in Global Scope or if explicitly requested, usually global)
      if (historyScope === 'global' && (historyTypeFilter === 'all' || historyTypeFilter === 'economy')) {
          items = items.concat((transactions || []).map(t => ({ kind: 'tx', date: t.date, data: t })));
      }

      // 3. Filter by Date Range
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let cutoff = new Date(0);
      
      if (historyFilter === '7days') {
          cutoff.setDate(now.getDate() - 7);
      } else if (historyFilter === '30days') {
          cutoff.setDate(now.getDate() - 30);
      } else if (historyFilter === 'year') {
          cutoff = new Date(now.getFullYear(), 0, 1);
      }

      if (cutoff.getTime() > 0) {
          // Optimization: Pre-calculate timestamps for filtering to avoid repeated new Date()
          items = items.filter(item => {
              const ts = item.kind === 'log' ? parseDate(item.date).getTime() : new Date(item.date).getTime();
              return ts >= cutoff.getTime();
          });
      }

      // Pre-calculate timestamps for sorting to avoid O(N log N) Date creations
      const itemsWithTs = items.map(item => ({
          ...item,
          timestamp: item.kind === 'log' ? parseDate(item.date).getTime() : new Date(item.date).getTime()
      }));

      // 4. Sort
      itemsWithTs.sort((a, b) => {
          if (historySortField === 'date') {
              return historySortDesc ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
          }
          
          // Sort by Value (Hours or Amount)
          const valA = a.kind === 'log' ? a.data.hours : Math.abs(a.data.amount);
          const valB = b.kind === 'log' ? b.data.hours : Math.abs(b.data.amount);
          return historySortDesc ? valB - valA : valA - valB;
      });

      return itemsWithTs;
  }, [logs, projectLogs, transactions, historyScope, historyFilter, historyTypeFilter, historySortField, historySortDesc]);

  const paginatedHistory = useMemo(() => {
      const start = (historyPage - 1) * ITEMS_PER_PAGE;
      return unifiedHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [unifiedHistory, historyPage]);

  const totalHours = useMemo(() => logs.reduce((acc, curr) => acc + curr.hours, 0), [logs]); 
  
  const currentDailyHours = useMemo(() => {
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return logs.filter(l => l.date === todayStr).reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);

  const currentWeeklyHours = useMemo(() => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
      const monday = new Date(now.getTime());
      monday.setDate(diff);
      monday.setHours(0,0,0,0);
      return logs.filter(l => parseDate(l.date) >= monday).reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);

  const currentMonthlyHours = useMemo(() => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return logs.filter(l => parseDate(l.date) >= startOfMonth).reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);

  const currentYearlyHours = useMemo(() => {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return logs.filter(l => parseDate(l.date) >= startOfYear).reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);

  const streaks = useMemo(() => {
      const activeLogDates = logs.filter(l => l.hours > 0).map(l => l.date);
      // Combine log dates and freeze dates
      const combinedDates = Array.from(new Set<string>([...activeLogDates, ...freezeDates])).sort();
      
      if (combinedDates.length === 0) return { current: 0, longest: 0 };
      const activeDates = combinedDates;
      
      // Use UTC for date calculations to avoid DST issues
      const timestamps = activeDates.map((d: string) => {
          const [y, m, day] = d.split('-').map(Number);
          return Date.UTC(y, m - 1, day);
      });

      let longest = 1;
      let currentRun = 1;
      for (let i = 1; i < timestamps.length; i++) {
          const diffDays = (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60 * 24);
          if (Math.round(diffDays) === 1) currentRun++;
          else currentRun = 1;
          if (currentRun > longest) longest = currentRun;
      }
      
      const now = new Date();
      const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = today - 86400000;
      const lastLogDate = timestamps[timestamps.length - 1];
      
      let current = 0;
      if (lastLogDate === today || lastLogDate === yesterday) {
          current = 1;
          for (let i = timestamps.length - 2; i >= 0; i--) {
              const diffDays = (timestamps[i+1] - timestamps[i]) / (1000 * 60 * 60 * 24);
              if (Math.round(diffDays) === 1) current++;
              else break;
          }
      }
      return { current, longest };
  }, [logs, freezeDates]);

  const currentGems = useMemo(() => calculateTotalGems(logs, totalHours, streaks.current, economyState.bonus, economyState.spent), [logs, totalHours, streaks.current, economyState]);

  const latestBadge = useMemo<Achievement | null>(() => {
      const all = getUnlockedAchievements(logs, totalHours, streaks.current);
      const unlocked = all.filter(a => a.isUnlocked);
      return unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
  }, [logs, totalHours, streaks.current]);

  // Badge Notification Effect
  useEffect(() => {
      const all = getUnlockedAchievements(logs, totalHours, streaks.current);
      const unlocked = all.filter(a => a.isUnlocked);
      const count = unlocked.length;

      if (prevBadgeCount.current === -1) {
          prevBadgeCount.current = count;
          return;
      }

      if (count > prevBadgeCount.current) {
          // Only toast if it's a small increment (user action), not a bulk load (import/sync)
          if (count - prevBadgeCount.current <= 2) {
              const latest = unlocked[unlocked.length - 1];
              if (latest) {
                  setToast({ title: latest.title, icon: latest.icon });
                  
                  const savedVol = localStorage.getItem('focusflow_timer_volume');
                  const vol = savedVol ? parseFloat(savedVol) : 0.5;
                  playWin(vol);

                  const timer = setTimeout(() => setToast(null), 5000);
                  return () => clearTimeout(timer);
              }
          }
      }
      prevBadgeCount.current = count;
  }, [logs, totalHours, streaks.current]);

  // Streak Freeze Logic: Check on mount/update if we missed yesterday and need to consume a freeze
  useEffect(() => {
      const checkStreakFreeze = () => {
          const inventory = JSON.parse(localStorage.getItem('focusflow_inventory') || '{}');
          const freezesOwned = inventory.streakFreeze || 0;
          
          if (freezesOwned <= 0) return;

          const today = new Date();
          // Use UTC to determine yesterday's date string consistently
          const yesterdayTs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1);
          const yesterdayStr = new Date(yesterdayTs).toISOString().split('T')[0];
          
          // Check if yesterday is already logged or frozen
          const hasLogYesterday = logs.some(l => l.date === yesterdayStr && l.hours > 0);
          const isFrozenYesterday = freezeDates.includes(yesterdayStr);

          if (!hasLogYesterday && !isFrozenYesterday) {
              // Only consume if there was a streak to save (day before yesterday was active)
              // This prevents consuming freezes when the user hasn't been active for weeks
              
              // Check day before yesterday
              const dayBeforeTs = yesterdayTs - 86400000;
              const dayBeforeStr = new Date(dayBeforeTs).toISOString().split('T')[0];
              const hasLogDayBefore = logs.some(l => l.date === dayBeforeStr && l.hours > 0) || freezeDates.includes(dayBeforeStr);

              if (hasLogDayBefore) {
                  // Consume Freeze
                  inventory.streakFreeze = freezesOwned - 1;
                  localStorage.setItem('focusflow_inventory', JSON.stringify(inventory));
                  
                  const newFreezeDates = [...freezeDates, yesterdayStr];
                  localStorage.setItem('focusflow_freeze_dates', JSON.stringify(newFreezeDates));
                  setFreezeDates(newFreezeDates);
              }
          }
      };
      checkStreakFreeze();
  }, [logs, freezeDates]); // Check when logs change or freezeDates update

  const activeProject = projects.find(p => p.id === currentProjectId);
  const activeProjectName = activeProject?.name || 'Project';
  
  // Effective Weekly Goal (Project overrides Global)
  const effectiveWeeklyGoal = activeProject?.weeklyGoal || goals.weekly;
  const heatmapTheme = activeProject?.theme || 'green';

  useEffect(() => {
      if (menuBarConfig.mode === 'none' || menuBarConfig.mode === 'timer') {
          if (menuBarConfig.mode === 'none') window.electronAPI?.updateTrayTitle('');
          return;
      }

      let text = '';
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const todayHours = logs.filter(l => l.date === todayStr).reduce((acc, curr) => acc + curr.hours, 0);

      switch (menuBarConfig.mode) {
          case 'today': text = `Today: ${todayHours.toFixed(1)}h`; break;
          case 'remaining': 
              const dailyGoal = goals.daily || 4;
              const remaining = Math.max(0, dailyGoal - todayHours);
              text = `${remaining.toFixed(1)}h Left`; 
              break;
          case 'streak': text = `🔥 ${streaks.current} Day Streak`; break;
          case 'xp': text = `✨ ${Math.floor(totalHours * 100)} XP`; break;
          case 'motivation': text = "💪 Focus & Win"; break;
          case 'countdown_closest':
              const now = new Date();
              now.setHours(0,0,0,0);
              const sorted = countdowns
                  .filter(c => !c.isArchived)
                  .map(c => {
                      const nextDate = getNextDate(c);
                      const diff = nextDate.getTime() - now.getTime();
                      return { ...c, diff, nextDate };
                  })
                  .filter(c => c.diff >= 0)
                  .sort((a, b) => a.diff - b.diff);
              
              if (sorted.length > 0) {
                  const closest = sorted[0];
                  const days = Math.ceil(closest.diff / (1000 * 60 * 60 * 24));
                  text = `${closest.title}: ${days}d`;
              } else {
                  text = 'No Events';
              }
              break;
          case 'countdown_custom':
              if (menuBarConfig.customCountdownId) {
                  const item = countdowns.find(c => c.id === menuBarConfig.customCountdownId);
                  if (item) {
                      const now = new Date();
                      now.setHours(0,0,0,0);
                      const nextDate = getNextDate(item);
                      const diff = nextDate.getTime() - now.getTime();
                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                      text = `${item.title}: ${days}d`;
                  } else {
                      text = 'Event not found';
                  }
              } else {
                  text = 'Select Event';
              }
              break;
      }
      
      if (text) window.electronAPI?.updateTrayTitle(text);
  }, [menuBarConfig, logs, goals, streaks, totalHours, countdowns]);

  const contentBgClass = appTheme === 'cyberpunk' 
    ? 'bg-[#050505] text-[#00f0ff] font-mono' 
    : 'bg-white dark:bg-gray-900';

  return (
    <div className={isElectron ? "w-screen h-screen overflow-hidden" : "min-h-screen flex items-center justify-center p-4 sm:p-8 transition-colors duration-500"}>
      {toast && <Toast title={toast.title} icon={toast.icon} onClose={() => setToast(null)} isCyberpunk={appTheme === 'cyberpunk'} />}
      <MacWindow isDarkMode={isDarkMode} onToggleTheme={toggleTheme} appTheme={appTheme}>
        <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView} 
            weeklyGoal={effectiveWeeklyGoal}
            currentWeeklyHours={currentWeeklyHours}
            currentDailyHours={currentDailyHours}
            currentMonthlyHours={currentMonthlyHours}
            goals={goals}
            projects={projects}
            currentProjectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            navConfig={navConfig}
            onManageProjects={handleManageProjects}
            sidebarConfig={sidebarConfig}
            appTheme={appTheme}
            latestBadge={latestBadge}
            logs={logs}
        />
        
        <div className={`flex-1 relative overflow-hidden flex flex-col transition-colors duration-300 ${contentBgClass}`}>
          
          {/* TimerPanel must be outside Suspense to prevent unmounting when other tabs load */}
          {(currentView === ViewMode.TIMER || timerViewInitialized) && (
            <div className={currentView === ViewMode.TIMER ? "h-full" : "hidden"}>
                <TimerPanel 
                  onSaveSession={handleTimerSave} 
                  projectId={currentProjectId} 
                  projects={projects}
                  menuBarConfig={menuBarConfig}
                  externalStart={pendingQuickTimer}
                  onConsumeExternalStart={handleConsumeQuickTimer}
                  currentGems={currentGems}
                  addTransaction={addTransaction}
              />
            </div>
          )}

          <Suspense fallback={<PanelLoader />}>
            {currentView === ViewMode.DASHBOARD && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gray-50/50 dark:bg-black/20">
              <div className="p-8 pb-0">
                <DashboardHeader 
                    activeProjectName={activeProjectName} 
                    currentYear={currentYear} 
                    activeProject={activeProject} 
                    streaks={streaks} 
                />

                <div ref={formRef} className="w-full bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-200 dark:border-gray-700/50 shadow-lg mb-4 relative overflow-hidden group transition-colors">
                    <form onSubmit={handleSaveLog} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest pl-1">Date</label>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={handleDateChange} 
                                className="w-full h-11 px-3 bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm text-gray-900 dark:text-gray-200 transition-all [color-scheme:light] dark:[color-scheme:dark]" 
                            />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest pl-1">Hours</label>
                            <input 
                                type="number" 
                                step="0.1" 
                                min="0" 
                                max="24" 
                                value={hoursInput} 
                                onChange={(e) => setHoursInput(e.target.value)} 
                                placeholder="0.0" 
                                className="w-full h-11 px-3 bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm text-gray-900 dark:text-gray-200 transition-all placeholder-gray-400 dark:placeholder-gray-600 font-mono" 
                            />
                        </div>
                        <div className="md:col-span-6 space-y-1.5">
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest pl-1">Notes</label>
                            <input 
                                type="text" 
                                value={notesInput} 
                                onChange={(e) => setNotesInput(e.target.value)} 
                                placeholder="What did you work on?" 
                                className="w-full h-11 px-3 bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm text-gray-900 dark:text-gray-200 transition-all placeholder-gray-400 dark:placeholder-gray-600" 
                            />
                        </div>
                        <div className="md:col-span-2 flex gap-2 h-11">
                            <button 
                                type="submit" 
                                className="flex-1 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95 h-full flex items-center justify-center"
                            >
                                {activeLog ? 'Update' : 'Save'}
                            </button>
                            {activeLog && (
                                <button 
                                    type="button" 
                                    onClick={handleDeleteLog} 
                                    className="h-11 w-11 shrink-0 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 dark:hover:text-red-300 rounded-xl transition-all active:scale-95 border border-red-200 dark:border-red-500/20 flex items-center justify-center aspect-square" 
                                    title="Delete Entry"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="mb-8 w-full"><Heatmap data={projectLogs} year={currentYear} onDayClick={handleDayClick} isDarkMode={isDarkMode} theme={heatmapTheme} onThemeChange={handleThemeChange} /></div>
                
                {/* Log History Table */}
                <div className="mb-8 w-full">
                    <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Log History</h3>
                        <div className="flex gap-2">
                             <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                                <button onClick={() => setHistoryScope('project')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyScope === 'project' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Project</button>
                                <button onClick={() => setHistoryScope('global')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyScope === 'global' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Global</button>
                             </div>
                             <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                                <button onClick={() => setHistoryTypeFilter('all')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyTypeFilter === 'all' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>All</button>
                                <button onClick={() => setHistoryTypeFilter('study')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyTypeFilter === 'study' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Study</button>
                                {historyScope === 'global' && (
                                    <button onClick={() => setHistoryTypeFilter('economy')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyTypeFilter === 'economy' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Economy</button>
                                )}
                             </div>
                             <select 
                                value={historyFilter} 
                                onChange={(e) => setHistoryFilter(e.target.value as any)}
                                className="bg-gray-200 dark:bg-gray-800 border-none text-xs font-bold rounded-lg px-3 py-1 text-gray-700 dark:text-gray-300 focus:ring-0 outline-none"
                             >
                                 <option value="7days">7 Days</option>
                                 <option value="30days">30 Days</option>
                                 <option value="year">Year</option>
                                 <option value="all">All Time</option>
                             </select>
                        </div>
                    </div>
                    
                    <LogHistoryTable 
                        paginatedHistory={paginatedHistory}
                        historySortField={historySortField}
                        historySortDesc={historySortDesc}
                        setHistorySortField={setHistorySortField}
                        setHistorySortDesc={setHistorySortDesc}
                        handleDayClick={handleDayClick}
                        historyScope={historyScope}
                        projects={projects}
                        unifiedHistoryLength={unifiedHistory.length}
                        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                        historyPage={historyPage}
                        setHistoryPage={setHistoryPage}
                    />
                </div>
              </div>
              </div>
            )}

            {currentView === ViewMode.STATISTICS && (
              <StatisticsPanel 
                  logs={projectLogs} 
                  allLogs={logs}
                  projects={projects}
                  goals={goals} 
                  onUpdateGoals={handleUpdateGoals}
                  onEditLog={handleEditLogFromStats}
                  projectId={currentProjectId}
                  goalHistory={goalHistory}
              />
            )}

            {currentView === ViewMode.GOALS && (
              <GoalsPanel 
                  goals={goals}
                  onUpdateGoals={handleUpdateGoals}
                  currentDailyHours={currentDailyHours}
                  currentWeeklyHours={currentWeeklyHours}
                  currentMonthlyHours={currentMonthlyHours}
                  currentYearlyHours={currentYearlyHours}
                  goalHistory={goalHistory}
              />
            )}

            {currentView === ViewMode.COUNTDOWN && (
              <CountdownPanel />
            )}

            {currentView === ViewMode.CALENDAR && (
              <CalendarPanel 
                  logs={logs} 
                  projects={projects}
              />
            )}

            {currentView === ViewMode.INSIGHTS && (
              <InsightsPanel logs={projectLogs} />
            )}

            {currentView === ViewMode.GAMIFICATION && (
              <GamificationPanel 
                  allLogs={logs}
                  totalHours={totalHours}
                  streak={streaks.current}
                  isDataLoaded={isDataLoaded}
              />
            )}

            {currentView === ViewMode.SETTINGS && (
              <SettingsPanel 
                  navConfig={navConfig} 
                  onUpdateNavConfig={setNavConfig}
                  isDarkMode={isDarkMode}
                  onToggleTheme={toggleTheme}
                  menuBarConfig={menuBarConfig}
                  onUpdateMenuBarConfig={setMenuBarConfig}
                  projects={projects}
                  onCreateProject={createProject}
                  onDeleteProject={deleteProject}
                  onUpdateProjects={updateProjects}
                  activeTab={settingsTab}
                  onTabChange={setSettingsTab}
                  sidebarConfig={sidebarConfig}
                  onUpdateSidebarConfig={setSidebarConfig}
                  appTheme={appTheme}
                  setAppTheme={setAppTheme}
              />
            )}
          </Suspense>
        </div>
      </MacWindow>
    </div>
  );
}

// Helper for recurrence calculation
const getNextDate = (item: CountdownItem): Date => {
    const now = new Date();
    now.setHours(0,0,0,0);
    let target = new Date(item.date);
    target.setHours(0,0,0,0);
    
    if (item.recurrence && item.recurrence !== 'none' && target.getTime() < now.getTime()) {
        if (item.recurrence === 'yearly') {
            target.setFullYear(now.getFullYear());
            if (target.getTime() < now.getTime()) target.setFullYear(now.getFullYear() + 1);
        } else if (item.recurrence === 'monthly') {
            target.setMonth(now.getMonth());
            if (target.getTime() < now.getTime()) target.setMonth(now.getMonth() + 1);
        } else if (item.recurrence === 'weekly') {
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            const diff = now.getTime() - target.getTime();
            const weeksToAdd = Math.ceil(diff / oneWeek);
            target = new Date(target.getTime() + weeksToAdd * oneWeek);
        } else if (item.recurrence === 'daily') {
            target = new Date(now);
        }
    }
    return target;
};

export default function App() {
    return (
        <AppProvider>
            <ErrorBoundary>
                <FocusFlowContent />
            </ErrorBoundary>
        </AppProvider>
    );
}
