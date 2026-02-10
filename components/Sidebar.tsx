import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ViewMode, Project, HeatmapTheme, SidebarConfig, AppTheme, Achievement, StudyLog, UserGoals } from '../types';
import { getDailyQuests } from '../services/gamificationService';
import { useTimerContext, useCountdowns } from '../AppContext';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  weeklyGoal: number;
  currentWeeklyHours: number;
  currentDailyHours: number;
  currentMonthlyHours: number;
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string, theme: HeatmapTheme) => void;
  onDeleteProject: (id: string) => void;
  navConfig: StoredNavConfig[];
  onManageProjects: () => void;
  sidebarConfig: SidebarConfig;
  appTheme: AppTheme;
  latestBadge?: Achievement | null;
  logs?: StudyLog[];
  goals: UserGoals;
  onSync?: () => void;
}

// Configuration structure for navigation items
export interface StoredNavConfig {
    view: ViewMode;
    isVisible: boolean;
}

interface NavItemConfig {
    view: ViewMode;
    label: string;
    icon: React.ReactNode;
}

// Default items definition - Exported for SettingsPanel
export const NAV_ITEMS_DEF: NavItemConfig[] = [
    {
        view: ViewMode.DASHBOARD,
        label: 'Dashboard',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
    },
    {
        view: ViewMode.TIMER,
        label: 'Timer',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        view: ViewMode.TASKS,
        label: 'Tasks',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
    },
    {
        view: ViewMode.CALENDAR,
        label: 'Calendar',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    },
    {
        view: ViewMode.STATISTICS,
        label: 'Statistics',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00 2 2h2a2 2 0 00 2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 00 2 2h2a2 2 0 00 2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
        view: ViewMode.GOALS,
        label: 'Goals',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        view: ViewMode.COUNTDOWN,
        label: 'Countdown',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        view: ViewMode.INSIGHTS,
        label: 'AI Coach',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
    },
    {
        view: 'QUICK_CAPTURE' as any, // Ensure types.ts is updated with QUICK_CAPTURE in ViewMode enum
        label: 'Capture',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    },
    {
        view: ViewMode.GAMIFICATION,
        label: 'Gamification',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
    }
];

interface NavItemProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    appTheme?: AppTheme;
    collapsed?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ 
  active, 
  onClick, 
  icon, 
  label,
  appTheme,
  collapsed
}) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg transition-all duration-200 group ${
      appTheme === 'cyberpunk'
        ? (active 
            ? 'bg-[#00f0ff]/10 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.2)] border border-[#00f0ff]/30' 
            : 'text-[#00f0ff]/60 hover:bg-[#00f0ff]/5 hover:text-[#00f0ff]')
        : (active 
            ? 'bg-blue-500 text-white shadow-md' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')
    }`}
  >
    <div className={`${
        appTheme === 'cyberpunk'
        ? (active ? 'text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'text-[#00f0ff]/60 group-hover:text-[#00f0ff]')
        : (active ? 'text-white' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300')
    }`}>
      {icon}
    </div>
    {!collapsed && <span className="font-medium text-sm">{label}</span>}
  </button>
);

const ThemeDot = ({ theme }: { theme: HeatmapTheme }) => {
    const colors = {
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        orange: 'bg-orange-500',
        purple: 'bg-purple-500'
    };
    return <div className={`w-2 h-2 rounded-full ${colors[theme] || 'bg-gray-400'}`}></div>;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    onChangeView, 
    weeklyGoal, 
    currentWeeklyHours,
    projects,
    currentProjectId,
    onSelectProject,
    onCreateProject,
    onDeleteProject,
    navConfig,
    onManageProjects,
    sidebarConfig,
    appTheme,
    latestBadge,
    logs = [],
    goals,
    currentDailyHours,
    currentMonthlyHours,
    onSync
}) => {
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTheme, setNewProjectTheme] = useState<HeatmapTheme>('green');
  const [isCollapsed, setIsCollapsed] = useState(() => {
      if (typeof window !== 'undefined') return localStorage.getItem('focusflow_sidebar_collapsed') === 'true';
      return false;
  });

  const toggleSidebar = () => {
      const newState = !isCollapsed;
      setIsCollapsed(newState);
      localStorage.setItem('focusflow_sidebar_collapsed', String(newState));
      setIsProjectMenuOpen(false);
  };

  const { setPendingQuickTimer } = useTimerContext();
  const { countdowns } = useCountdowns();
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Ensure config has defaults to prevent crashes or missing widgets
  const safeConfig = useMemo(() => {
      const defaultOrder = [
          'showTimerWidget',
          'showQuestsWidget',
          'showCountdownWidget',
          'showDailyGoalWidget',
          'showWeeklyGoalWidget',
          'showMonthlyGoalWidget',
          'showLatestBadgeWidget'
      ];

      const config = {
          showWeeklyGoalWidget: true,
          showDailyGoalWidget: false,
          showMonthlyGoalWidget: false,
          showTimerWidget: false,
          showCountdownWidget: false,
          showQuestsWidget: true,
          showLatestBadgeWidget: true,
          questsWidgetSize: 'standard',
          widgetOrder: defaultOrder,
          ...sidebarConfig
      };

      // Ensure new widgets are added to order if missing from saved config
      if (sidebarConfig.widgetOrder) {
          const missing = defaultOrder.filter(k => !sidebarConfig.widgetOrder!.includes(k));
          if (missing.length > 0) {
              config.widgetOrder = [...sidebarConfig.widgetOrder, ...missing];
          }
      }

      return config;
  }, [sidebarConfig]);
  
  // Safe access to active project
  const activeProject = projects.find(p => p.id === currentProjectId) || projects[0] || {
    id: 'loading',
    name: 'Loading...',
    theme: 'green' as HeatmapTheme,
    createdAt: ''
  };

  const weeklyProgress = Math.min(100, (currentWeeklyHours / weeklyGoal) * 100);
  const dailyProgress = Math.min(100, (currentDailyHours / (goals.daily || 4)) * 100);
  const monthlyProgress = Math.min(100, (currentMonthlyHours / (goals.monthly || 160)) * 100);

  // --- Daily Quests Logic (Mirrored from GamificationPanel) ---
  const quests = useMemo(() => getDailyQuests(logs), [logs]);

  // Filter projects for dropdown
  const activeProjects = projects.filter(p => !p.isArchived);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsProjectMenuOpen(false);
            setIsCreating(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'ghost') {
          // Force view switch on next tick to ensure App is ready
          setTimeout(() => onChangeView(ViewMode.TIMER), 0);
          
          // Ensure body is transparent for the shaped window
          document.body.style.backgroundColor = 'transparent';
          document.documentElement.style.backgroundColor = 'transparent';
      }

      // Listen for ghost mode exit to switch back to timer view
      if ((window.electronAPI as any)?.onSyncTimerState) {
          const cleanup = (window.electronAPI as any).onSyncTimerState(() => {
              onChangeView(ViewMode.TIMER);
          });
          return cleanup;
      }
  }, []);

  // Don't render the sidebar UI in ghost mode
  if (new URLSearchParams(window.location.search).get('mode') === 'ghost') return null;

  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      if(newProjectName.trim()) {
          onCreateProject(newProjectName.trim(), newProjectTheme);
          setNewProjectName('');
          setIsCreating(false);
          setIsProjectMenuOpen(false);
      }
  };

  const getClosestCountdown = () => {
      const now = new Date();
      now.setHours(0,0,0,0);
      const sorted = countdowns
          .filter(c => !c.isArchived)
          .map(c => {
              const target = new Date(c.date);
              return { ...c, diff: target.getTime() - now.getTime() };
          })
          .filter(c => c.diff >= 0)
          .sort((a, b) => a.diff - b.diff);
      return sorted[0];
  };

  const renderGoalWidget = (period: string, current: number, target: number, key: string) => {
      const progress = Math.min(100, (current / target) * 100);
      return (
          <div key={key} className={`w-full mb-4 rounded-xl p-4 border shadow-sm ${appTheme === 'cyberpunk' ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-blue-50 dark:bg-gray-800 border-blue-100 dark:border-gray-700'}`}>
              <div className="flex justify-between items-end mb-2">
                  <p className={`text-xs font-semibold ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400'}`}>{period} Goal</p>
                  <p className={`text-xs text-right ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/80' : 'text-blue-500 dark:text-blue-400'}`}>{current.toFixed(1)} / {target} hrs</p>
              </div>
              <div className={`w-full rounded-full h-2 mb-1 overflow-hidden ${appTheme === 'cyberpunk' ? 'bg-[#00f0ff]/20' : 'bg-blue-200 dark:bg-gray-700'}`}>
                <div 
                    className={`h-2 rounded-full transition-all duration-500 ease-out ${appTheme === 'cyberpunk' ? 'bg-[#00f0ff] shadow-[0_0_5px_rgba(0,240,255,0.5)]' : 'bg-blue-500 dark:bg-blue-400'}`} 
                    style={{ width: `${progress}%` }}
                ></div>
              </div>
          </div>
      );
  };

  const renderWidget = (key: string) => {
      switch (key) {
          case 'showQuestsWidget':
              const size = safeConfig.questsWidgetSize || 'standard';
              const completedCount = quests.filter(q => q.current >= q.target).length;
              const totalCount = quests.length;
              const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
              const containerClass = `w-full mb-4 rounded-2xl border shadow-sm text-left transition-all group ${appTheme === 'cyberpunk' ? 'bg-[#0a0a0a] border-[#00f0ff]/30 hover:border-[#00f0ff] hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'}`;

              if (size === 'compact') {
                  return (
                      <button 
                        key="quests"
                        onClick={(e) => { e.stopPropagation(); onChangeView(ViewMode.GAMIFICATION); }}
                        className={`${containerClass} p-3 flex items-center justify-between`}
                      >
                          <div className="flex items-center gap-2">
                              <span className="text-lg">🎯</span>
                              <div>
                                  <p className={`text-xs font-bold uppercase tracking-wider ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-200'}`}>Quests</p>
                                  <p className={`text-[10px] ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>{completedCount}/{totalCount} Done</p>
                              </div>
                          </div>
                          <div className="relative w-8 h-8 flex items-center justify-center">
                               <svg className="w-full h-full transform -rotate-90">
                                   <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="transparent" className={appTheme === 'cyberpunk' ? 'text-[#00f0ff]/20' : 'text-gray-200 dark:text-gray-700'} />
                                   <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={75.39} strokeDashoffset={75.39 * (1 - overallProgress / 100)} className={appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-blue-500'} />
                               </svg>
                          </div>
                      </button>
                  );
              }

              if (size === 'standard') {
                   return (
                    <button 
                        key="quests"
                        onClick={(e) => { e.stopPropagation(); onChangeView(ViewMode.GAMIFICATION); }}
                        className={`${containerClass} p-4`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🎯</span>
                                <p className={`text-xs font-bold uppercase tracking-wider ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-200'}`}>Daily Quests</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${appTheme === 'cyberpunk' ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                {completedCount}/{totalCount}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {quests.map(quest => {
                                const isCompleted = quest.current >= quest.target;
                                return (
                                    <div key={quest.id} className="flex items-center justify-between">
                                        <span className={`text-[10px] font-medium truncate max-w-[140px] ${isCompleted ? (appTheme === 'cyberpunk' ? 'text-[#00f0ff] line-through opacity-70' : 'text-gray-400 line-through') : (appTheme === 'cyberpunk' ? 'text-[#00f0ff]/80' : 'text-gray-600 dark:text-gray-300')}`}>
                                            {quest.title}
                                        </span>
                                        {isCompleted ? (
                                            <span className={appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-green-500'}>✓</span>
                                        ) : (
                                            <span className={`text-[9px] font-mono ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/60' : 'text-gray-400'}`}>{quest.current}/{quest.target}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </button>
                   );
              }

              return (
                <button 
                    key="quests"
                    onClick={(e) => { e.stopPropagation(); onChangeView(ViewMode.GAMIFICATION); }}
                    className={`${containerClass} p-4`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🎯</span>
                            <p className={`text-xs font-bold uppercase tracking-wider ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-200'}`}>Daily Quests</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${appTheme === 'cyberpunk' ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                            {completedCount}/{totalCount}
                        </span>
                    </div>
                    
                    <div className="space-y-3">
                        {quests.map(quest => {
                            const progress = Math.min(100, (quest.current / quest.target) * 100);
                            const isCompleted = progress >= 100;
                            
                            return (
                                <div key={quest.id} className="relative" title={`Reward: ${quest.reward} Gems`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[10px] font-medium truncate max-w-[120px] ${isCompleted ? (appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-green-600 dark:text-green-400') : (appTheme === 'cyberpunk' ? 'text-[#00f0ff]/80' : 'text-gray-600 dark:text-gray-400')}`}>
                                            {quest.title}
                                        </span>
                                        <span className={`text-[9px] font-mono ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/60' : 'text-gray-400'}`}>
                                            {quest.current}/{quest.target}
                                        </span>
                                    </div>
                                    <div className={`h-1.5 w-full rounded-full overflow-hidden ${appTheme === 'cyberpunk' ? 'bg-[#00f0ff]/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? (appTheme === 'cyberpunk' ? 'bg-[#00f0ff] shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'bg-green-500') : (appTheme === 'cyberpunk' ? 'bg-[#00f0ff]/50' : 'bg-blue-500')}`} 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className={`mt-3 text-[10px] text-center font-medium transition-colors ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/40 group-hover:text-[#00f0ff]/80' : 'text-gray-400 group-hover:text-blue-500'}`}>
                        Click to view rewards
                    </div>
                </button>
              );
          case 'showWeeklyGoalWidget': return renderGoalWidget('Weekly', currentWeeklyHours, weeklyGoal, 'weekly');
          case 'showDailyGoalWidget': return renderGoalWidget('Daily', currentDailyHours, goals.daily || 4, 'daily');
          case 'showMonthlyGoalWidget': return renderGoalWidget('Monthly', currentMonthlyHours, goals.monthly || 160, 'monthly');
          case 'showCountdownWidget':
              const closest = getClosestCountdown();
              if (!closest) return null;
              const days = Math.ceil(closest.diff / (1000 * 60 * 60 * 24));
              return (
                  <button key="countdown" onClick={(e) => { e.stopPropagation(); onChangeView(ViewMode.COUNTDOWN); }} className={`w-full mb-4 p-4 rounded-xl border shadow-sm text-left transition-all group ${appTheme === 'cyberpunk' ? 'bg-[#0a0a0a] border-[#00f0ff]/30 hover:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}`}>
                      <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs font-bold uppercase tracking-wider ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>Upcoming</span>
                          <span className={`text-xs font-bold ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400'}`}>{days} Days</span>
                      </div>
                      <div className={`font-bold truncate ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{closest.title}</div>
                  </button>
              );
          case 'showTimerWidget':
              return (
                  <div key="timer" className={`w-full mb-4 p-4 rounded-xl border shadow-sm ${appTheme === 'cyberpunk' ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>Quick Focus</p>
                      <div className="flex gap-2">{[25, 45, 60].map(min => (<button key={min} onClick={(e) => { e.stopPropagation(); setPendingQuickTimer({ duration: min, timestamp: Date.now() }); onChangeView(ViewMode.TIMER); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${appTheme === 'cyberpunk' ? 'bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40'}`}>{min}m</button>))}</div>
                  </div>
              );
          case 'showLatestBadgeWidget':
              if (!latestBadge) return null;
              return (
                  <div key="latestBadge" className={`w-full mb-4 p-3 rounded-xl border flex items-center gap-3 shadow-sm ${appTheme === 'cyberpunk' ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                      <div className="text-2xl">{latestBadge.icon}</div>
                      <div className="overflow-hidden">
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>Latest Badge</p>
                          <p className={`text-xs font-bold truncate ${appTheme === 'cyberpunk' ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{latestBadge.title}</p>
                      </div>
                  </div>
              );
          default: return null;
      }
  };

  const sidebarClass = appTheme === 'cyberpunk'
    ? 'bg-[#020202] border-r border-[#00f0ff]/20 text-[#00f0ff] font-mono'
    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700';

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} shrink-0 border-r flex flex-col p-4 transition-all duration-300 relative ${sidebarClass}`}>
      
      {/* Toggle Button */}
      <button 
        onClick={toggleSidebar}
        className={`absolute -right-3 top-9 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center z-50 transition-colors cursor-pointer ${appTheme === 'cyberpunk' ? 'bg-black border-[#00f0ff] text-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
      >
        <svg className={`w-3 h-3 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      
      {/* Project Selector */}
      <div className="mb-6 mt-2 relative" ref={menuRef}>
        <button 
            onClick={() => !isCollapsed && setIsProjectMenuOpen(!isProjectMenuOpen)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-xl hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors group`}
            title={isCollapsed ? activeProject.name : undefined}
        >
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'} overflow-hidden`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm ${
                    activeProject.theme === 'green' ? 'bg-green-500' :
                    activeProject.theme === 'blue' ? 'bg-blue-500' :
                    activeProject.theme === 'orange' ? 'bg-orange-500' : 'bg-purple-500'
                }`}>
                    <span className="font-bold text-sm">{activeProject.name.substring(0, 2).toUpperCase()}</span>
                </div>
                {!isCollapsed && (
                    <div className="text-left truncate">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Project</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{activeProject.name}</p>
                    </div>
                )}
            </div>
            {!isCollapsed && <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isProjectMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
        </button>

        {/* Dropdown Menu */}
        {isProjectMenuOpen && !isCollapsed && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-fade-in-up">
                {!isCreating ? (
                    <>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {activeProjects.map(project => (
                                <button 
                                    key={project.id}
                                    onClick={() => {
                                        onSelectProject(project.id);
                                        setIsProjectMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${project.id === currentProjectId ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    <ThemeDot theme={project.theme} />
                                    <span className={`text-sm truncate ${project.id === currentProjectId ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                        {project.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="p-1 border-t border-gray-100 dark:border-gray-700 space-y-1">
                            <button 
                                onClick={() => setIsCreating(true)}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span>New Project</span>
                            </button>
                            <button 
                                onClick={() => { onManageProjects(); setIsProjectMenuOpen(false); }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span>Manage Projects</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Create Project</p>
                        <form onSubmit={handleCreate} className="space-y-3">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Project Name"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Theme</span>
                                <div className="flex space-x-1">
                                    {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setNewProjectTheme(t)}
                                            className={`w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600 ${t === 'green' ? 'bg-green-500' : t === 'blue' ? 'bg-blue-500' : t === 'orange' ? 'bg-orange-500' : 'bg-purple-500'} ${newProjectTheme === t ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex space-x-2 pt-1">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {navConfig.map((item) => {
            if (!item.isVisible) return null;
            const def = NAV_ITEMS_DEF.find(d => d.view === item.view);
            if (!def) return null;

            return (
                <NavItem
                    key={item.view}
                    active={currentView === item.view}
                    onClick={() => onChangeView(item.view)}
                    icon={def.icon}
                    label={def.label}
                    appTheme={appTheme}
                    collapsed={isCollapsed}
                />
            );
        })}

        {/* Footer Actions */}
        <div className={`mt-1 flex ${isCollapsed ? 'flex-col' : ''} gap-2`}>
            {/* Settings Button */}
            <button
                onClick={() => onChangeView(ViewMode.SETTINGS)}
                className={`${isCollapsed ? 'justify-center' : 'flex-1 space-x-3'} flex items-center px-3 py-2 rounded-lg transition-all duration-200 group ${
                    appTheme === 'cyberpunk'
                    ? (currentView === ViewMode.SETTINGS ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30' : 'text-[#00f0ff]/60 hover:bg-[#00f0ff]/5')
                    : (currentView === ViewMode.SETTINGS ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')
                }`}
                title={isCollapsed ? "Settings" : undefined}
            >
                <div className={`${
                    appTheme === 'cyberpunk' ? (currentView === ViewMode.SETTINGS ? 'text-[#00f0ff]' : 'text-[#00f0ff]/60') : (currentView === ViewMode.SETTINGS ? 'text-white' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300')
                }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                {!isCollapsed && <span className="font-medium text-sm">Settings</span>}
            </button>

            {/* Sync Button */}
            {onSync && (
                <button
                    onClick={onSync}
                    className={`p-2 rounded-lg transition-all duration-200 group ${isCollapsed ? 'w-full flex justify-center' : ''} ${
                        appTheme === 'cyberpunk'
                        ? 'text-[#00f0ff]/60 hover:bg-[#00f0ff]/5 hover:text-[#00f0ff]'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500'
                    }`}
                    title="Sync Now"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
            )}
        </div>
      </nav>

      {/* Widget Area */}
      {!isCollapsed && (
      <div className={`mt-4 px-1 pt-4 border-t ${appTheme === 'cyberpunk' ? 'border-[#00f0ff]/20' : 'border-gray-200 dark:border-gray-700'}`}>
          {safeConfig.widgetOrder.map(key => {
              if (!safeConfig[key as keyof SidebarConfig]) return null;
              return renderWidget(key);
          })}
      </div>
      )}
    </div>
  );
};
