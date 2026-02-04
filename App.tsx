import React, { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { MacWindow } from './components/MacWindow';
import { Sidebar } from './components/Sidebar';
import { QuickTimerOverlay } from './components/QuickTimerOverlay';
import { ViewMode, HeatmapTheme, UserGoals } from './types';
import { AppProvider, useTheme, useProjects, useLogs, useUI, useTimerContext } from './AppContext';
import { TimerPanel } from './components/TimerPanel';

// Lazy load heavy components
const CalendarPanel = lazy(() => import('./components/CalendarPanel').then(m => ({ default: m.CalendarPanel })));
const StatisticsPanel = lazy(() => import('./components/StatisticsPanel').then(m => ({ default: m.StatisticsPanel })));
const CountdownPanel = lazy(() => import('./components/CountdownPanel').then(m => ({ default: m.CountdownPanel })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const Heatmap = lazy(() => import('./components/Heatmap').then(m => ({ default: m.Heatmap })));
const InsightsPanel = lazy(() => import('./components/InsightsPanel').then(m => ({ default: m.InsightsPanel })));

// Add loading fallback
const PanelLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

function FocusFlowContent() {
  // --- Context Hooks ---
  const { isDarkMode, toggleTheme } = useTheme();
  const { projects, currentProjectId, setCurrentProjectId, createProject, deleteProject, updateProjects } = useProjects();
  const { logs, goals, saveLog, deleteLog, updateGoals } = useLogs();
  const { currentView, setCurrentView, settingsTab, setSettingsTab, navConfig, setNavConfig, sidebarConfig, setSidebarConfig, menuBarConfig, setMenuBarConfig } = useUI();
  const { pendingQuickTimer, setPendingQuickTimer } = useTimerContext();

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
      const mergedNotes = existing ? (existing.notes ? existing.notes + '; ' + sessionNote : sessionNote) : sessionNote;
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

  // Helper for safe local date parsing
  const parseDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
  };

  // --- Calculations ---
  const currentYear = new Date().getFullYear();
  const projectLogs = useMemo(() => logs.filter(l => l.projectId === currentProjectId), [logs, currentProjectId]);
  const activeLog = useMemo(() => projectLogs.find(l => l.date === selectedDate), [projectLogs, selectedDate]);
  const totalHours = useMemo(() => logs.reduce((acc, curr) => acc + curr.hours, 0), [logs]); 
  
  const currentWeeklyHours = useMemo(() => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
      const monday = new Date(now.getTime());
      monday.setDate(diff);
      monday.setHours(0,0,0,0);
      return logs.filter(l => parseDate(l.date) >= monday).reduce((acc, curr) => acc + curr.hours, 0);
  }, [logs]);

  const streaks = useMemo(() => {
      if (logs.length === 0) return { current: 0, longest: 0 };
      const activeDates = Array.from(new Set<string>(logs.filter(l => l.hours > 0).map(l => l.date))).sort();
      if (activeDates.length === 0) return { current: 0, longest: 0 };
      const timestamps = activeDates.map((d: string) => parseDate(d).getTime());
      let longest = 1;
      let currentRun = 1;
      for (let i = 1; i < timestamps.length; i++) {
          const diffDays = (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60 * 24);
          if (diffDays === 1) currentRun++;
          else currentRun = 1;
          if (currentRun > longest) longest = currentRun;
      }
      const today = new Date().setHours(0,0,0,0);
      const yesterday = today - 86400000;
      const lastLogDate = timestamps[timestamps.length - 1];
      let current = 0;
      if (lastLogDate === today || lastLogDate === yesterday) {
          current = 1;
          for (let i = timestamps.length - 2; i >= 0; i--) {
              const diffDays = (timestamps[i+1] - timestamps[i]) / (1000 * 60 * 60 * 24);
              if (diffDays === 1) current++;
              else break;
          }
      }
      return { current, longest };
  }, [logs]);

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
          case 'today': text = `${todayHours.toFixed(1)}h`; break;
          case 'remaining': text = `${Math.max(0, (goals.weekly / 7) - todayHours).toFixed(1)}h Left`; break;
          case 'streak': text = `🔥 ${streaks.current}`; break;
          case 'xp': text = `XP ${(totalHours * 100).toFixed(0)}`; break;
          case 'motivation': text = "Focus ⚡️"; break;
          case 'countdown_closest':
          case 'countdown_custom':
              text = "Countdown"; 
              break;
      }
      
      if (text) window.electronAPI?.updateTrayTitle(text);
  }, [menuBarConfig, logs, goals, streaks, totalHours]);

  return (
    <div className={isElectron ? "w-screen h-screen overflow-hidden" : "min-h-screen flex items-center justify-center p-4 sm:p-8 transition-colors duration-500"}>
      <MacWindow isDarkMode={isDarkMode} onToggleTheme={toggleTheme}>
        <Sidebar 
            currentView={currentView} 
            onChangeView={setCurrentView} 
            weeklyGoal={effectiveWeeklyGoal}
            currentWeeklyHours={currentWeeklyHours}
            projects={projects}
            currentProjectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            navConfig={navConfig}
            onManageProjects={handleManageProjects}
            sidebarConfig={sidebarConfig}
        />
        
        <div className="flex-1 bg-white dark:bg-gray-900 relative overflow-hidden flex flex-col transition-colors duration-300">
          
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
              />
            </div>
          )}

          <Suspense fallback={<PanelLoader />}>
            {currentView === ViewMode.DASHBOARD && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gray-50/50 dark:bg-black/20">
              <div className="p-8 pb-0">
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
                  totalHours={totalHours}
                  streak={streaks.current}
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
              />
            )}
          </Suspense>
        </div>
      </MacWindow>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <FocusFlowContent />
    </AppProvider>
  );
}

export default App;