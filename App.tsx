/// <reference path="./electron.d.ts" />
import React, { Component, useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { MacWindow } from './components/MacWindow';
import { Sidebar } from './components/Sidebar';
import { QuickTimerOverlay } from './components/QuickTimerOverlay';
import { MiniCaptureWindow } from './components/MiniCaptureWindow';
import { ViewMode, HeatmapTheme, UserGoals, CountdownItem, Achievement, Transaction, StudyLog, Task } from './types';
import { AppProvider, useTheme, useProjects, useLogs, useUI, useTimerContext, useCountdowns } from './AppContext';
import { getUnlockedAchievements, getAchievementReward, getDailyQuests } from './services/gamificationService';
import * as storage from './services/storageService';
import { playWin } from './services/audioService';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// Lazy load heavy components
const TimerPanel = lazy(() => import('./components/TimerPanel').then(m => ({ default: m.TimerPanel })));
const CalendarPanel = lazy(() => import('./components/CalendarPanel').then(m => ({ default: m.CalendarPanel })));
const StatisticsPanel = lazy(() => import('./components/StatisticsPanel').then(m => ({ default: m.StatisticsPanel })));
const CountdownPanel = lazy(() => import('./components/CountdownPanel').then(m => ({ default: m.CountdownPanel })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const Heatmap = lazy(() => import('./components/Heatmap').then(m => ({ default: m.Heatmap })));
const InsightsPanel = lazy(() => import('./components/InsightsPanel').then(m => ({ default: m.InsightsPanel })));
const GamificationPanel = lazy(() => import('./components/GamificationPanel').then(m => ({ default: m.GamificationPanel })));
const GoalsPanel = lazy(() => import('./components/GoalsPanel').then(m => ({ default: m.GoalsPanel })));
const TaskPanel = lazy(() => import('./components/TaskPanel').then(m => ({ default: m.TaskPanel })));
const QuickCapturePanel = lazy(() => import('./components/QuickCapturePanel').then(m => ({ default: m.QuickCapturePanel })));

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
const Toast = ({ title, subtitle = "Achievement Unlocked", icon, onClose, isCyberpunk }: { title: string, subtitle?: string, icon: string, onClose: () => void, isCyberpunk: boolean }) => (
    <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in-down pointer-events-none">
        <div className={`px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 backdrop-blur-xl pointer-events-auto transition-all ${isCyberpunk ? 'bg-black/90 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.4)]' : 'bg-gray-900/95 text-white border-white/10 shadow-xl'}`}>
            <div className="text-3xl">{icon}</div>
            <div>
                <div className="font-bold text-sm">{title}</div>
                <div className="text-xs opacity-75">{subtitle}</div>
            </div>
        </div>
    </div>
);

// Tutorial Component
const Tutorial = ({ onComplete, isCyberpunk }: { onComplete: () => void, isCyberpunk: boolean }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to FocusFlow",
            description: "Your AI-powered productivity app. Let's get started!",
            target: "sidebar"
        },
        {
            title: "Start a Timer",
            description: "Click the play button to begin a Pomodoro session.",
            target: "timer"
        },
        {
            title: "Track Your Progress",
            description: "View stats, streaks, and achievements in the dashboard.",
            target: "stats"
        }
    ];

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-md rounded-3xl p-8 border shadow-2xl relative overflow-hidden ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-blue-100 dark:bg-blue-500/10'}`}></div>
                
                <h2 className={`text-2xl font-bold mb-2 relative z-10 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                    {steps[step].title}
                </h2>
                <p className={`mb-8 relative z-10 ${isCyberpunk ? 'text-[#00f0ff]/70' : 'text-gray-600 dark:text-gray-400'}`}>
                    {steps[step].description}
                </p>

                <div className="flex gap-3 relative z-10">
                    {step > 0 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className={`flex-1 py-2 rounded-lg font-bold transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className={`flex-1 py-2 rounded-lg font-bold transition-colors ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        {step === steps.length - 1 ? 'Get Started' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// OAuth Callback Component
const OAuthCallback = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-8">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    ✓
                </div>
                <h2 className="text-2xl font-bold mb-2">Authorization Successful</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Please copy the code below and paste it back into FocusFlow to complete the setup.
                </p>
                
                <div className="relative mb-6">
                    <input 
                        type="text" 
                        readOnly 
                        value={code} 
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.currentTarget.select()}
                    />
                </div>

                <button 
                    onClick={handleCopy}
                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                    {copied ? (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Copied!
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            Copy Code
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// Interfaces defined OUTSIDE the class for clarity
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: any): ErrorBoundaryState {
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
        <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                    {activeProjectName}
                </span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Year {currentYear}</p>
        </div>
        <div className="flex gap-4 justify-end items-start">
            {activeProject && (
                <>
                    <div className="text-right">
                        <div className="text-3xl font-black text-red-500">{streaks?.current || 0}</div>
                        <div className="text-xs uppercase tracking-widest text-gray-500">Current Streak</div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black text-orange-500">{streaks?.best || 0}</div>
                        <div className="text-xs uppercase tracking-widest text-gray-500">Best Streak</div>
                    </div>
                </>
            )}
        </div>
    </header>
));

// GhostMode Component - syncs with main timer
const GhostModeView = () => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [initialTime, setInitialTime] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'POMO' | 'STOPWATCH'>('POMO');
    const [phase, setPhase] = useState<'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK'>('FOCUS');
    const [sessionLabel, setSessionLabel] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const endTimeRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Request initial timer state from main app
    useEffect(() => {
        window.electronAPI?.getTimerState();
    }, []);

    // Listen for timer state sync from main app
    useEffect(() => {
        const cleanup = window.electronAPI?.onSyncTimerState((state: any) => {
            if (!state) return;
            
            setTimeLeft(state.timeLeft || 0);
            setInitialTime(state.initialTime || 0);
            setIsActive(state.isActive);
            setMode(state.mode || 'POMO');
            setPhase(state.phase || 'FOCUS');
            setSessionLabel(state.sessionLabel || '');
            setSelectedProjectId(state.selectedProjectId || '');
            
            if (state.isActive) {
                if (state.mode === 'STOPWATCH') {
                    startTimeRef.current = state.startTime;
                    endTimeRef.current = null;
                } else {
                    endTimeRef.current = state.endTime;
                    startTimeRef.current = null;
                }
            } else {
                endTimeRef.current = null;
                startTimeRef.current = null;
            }
        });
        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    // Listen for timer updates from main app
    useEffect(() => {
        const cleanup = window.electronAPI?.onTimerUpdate((action: string, payload: any) => {
            switch(action) {
                case 'START_TIMER':
                    setIsActive(true);
                    setMode(payload.mode);
                    setPhase(payload.phase);
                    setTimeLeft(payload.timeLeft);
                    setInitialTime(payload.initialTime);
                    setSessionLabel(payload.sessionLabel);
                    setSelectedProjectId(payload.selectedProjectId);
                    endTimeRef.current = payload.endTime || null;
                    startTimeRef.current = payload.startTime || null;
                    break;
                case 'PAUSE_TIMER':
                    setIsActive(false);
                    setTimeLeft(payload.timeLeft);
                    endTimeRef.current = null;
                    startTimeRef.current = null;
                    break;
                case 'RESET_TIMER':
                    setIsActive(false);
                    setMode(payload.mode);
                    setPhase(payload.phase);
                    setTimeLeft(payload.initialTime);
                    setInitialTime(payload.initialTime);
                    endTimeRef.current = null;
                    startTimeRef.current = null;
                    break;
                case 'SKIP_PHASE':
                    setTimeLeft(0);
                    break;
            }
        });
        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    // Local timer sync - update display based on end/start time
    useEffect(() => {
        if (!isActive) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            if (endTimeRef.current) {
                const now = Date.now();
                const diff = Math.ceil((endTimeRef.current - now) / 1000);
                setTimeLeft(Math.max(0, diff));
            } else if (startTimeRef.current) {
                const now = Date.now();
                const elapsed = Math.floor((now - startTimeRef.current) / 1000);
                setTimeLeft(elapsed);
            }
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive]);

    const toggleTimer = () => {
        if (isActive) {
            window.electronAPI?.broadcastTimerAction('PAUSE_TIMER', { timeLeft, mode, phase });
        } else {
            const now = Date.now();
            const payload: any = {
                mode: mode || 'POMO',
                phase: phase || 'FOCUS',
                timeLeft: timeLeft || 0,
                initialTime: initialTime || 0,
                sessionLabel: sessionLabel || '',
                selectedProjectId: selectedProjectId || ''
            };
            
            if (mode === 'STOPWATCH') {
                payload.startTime = now - (timeLeft * 1000);
                payload.endTime = null;
            } else {
                payload.endTime = now + (timeLeft * 1000);
                payload.startTime = null;
            }
            
            window.electronAPI?.broadcastTimerAction('START_TIMER', payload);
        }
    };

    const handleExitGhostMode = () => {
        const state = {
            timeLeft: timeLeft || 0,
            initialTime: initialTime || 0,
            isActive: !!isActive,
            mode: mode || 'POMO',
            phase: phase || 'FOCUS',
            sessionLabel: sessionLabel || '',
            selectedProjectId: selectedProjectId || '',
            endTime: endTimeRef.current || null,
            startTime: startTimeRef.current || null
        };
        window.electronAPI?.toggleGhostMode(state);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const safeTimeLeft = Number.isFinite(timeLeft) ? timeLeft : 0;
    const safeInitialTime = Number.isFinite(initialTime) ? initialTime : 0;

    const progress = mode === 'POMO' 
        ? (safeInitialTime > 0 ? Math.max(0, Math.min(1, safeTimeLeft / safeInitialTime)) : 0)
        : ((safeTimeLeft % 60) / 60);

    const hue = Math.floor(progress * 220);
    const primaryColor = `hsl(${hue}, 100%, 60%)`;
    const glowColor = `hsla(${hue}, 100%, 60%, 0.3)`;
    const radius = 88;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-transparent cursor-default select-none" style={{ WebKitAppRegion: 'drag' } as any}>
            <div className="relative flex items-center justify-center w-48 h-48 rounded-full transition-all duration-1000 ease-in-out group" onDoubleClick={toggleTimer}>
                <div className="absolute inset-0 rounded-full bg-black/50 backdrop-blur-md animate-pulse-slow" style={{ background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0.6) 70%)`, boxShadow: `0 0 30px ${glowColor}` }} />
                
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                    <circle cx="96" cy="96" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                    <circle cx="96" cy="96" r={radius} fill="none" stroke={primaryColor} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
                </svg>
                
                <div className="z-10 text-center relative" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <div className="text-4xl font-mono font-bold tracking-wider drop-shadow-md select-none" style={{ color: primaryColor, textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>{formatTime(safeTimeLeft)}</div>
                </div>
                
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button onClick={toggleTimer} className="p-2 hover:text-white text-white/70 transition-colors">
                        {isActive ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                    </button>
                    <button onClick={handleExitGhostMode} className="p-2 hover:text-white text-white/70 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main FocusFlow Content Component
const FocusFlowContent = () => {
    const { appTheme } = useTheme();
    const { projects, currentProjectId } = useProjects();
    const { logs: allLogs, transactions } = useLogs();
    const { isShowingTutorial, setIsShowingTutorial, ghostMode } = useUI();
    
    const [toasts, setToasts] = useState<Array<{ id: string, title: string, subtitle?: string, icon: string }>>([]);
    const [view, setView] = useState<ViewMode>('TIMER');

    const isCyberpunk = appTheme === 'cyberpunk';
    const activeProject = projects.find(p => p.id === currentProjectId);
    const activeProjectName = activeProject?.name || 'All Projects';
    const currentYear = new Date().getFullYear();

    // Track achievements
    useEffect(() => {
        const checkAchievements = async () => {
            const userState = {
                globalBalance: transactions.reduce((sum, t) => sum + (t.type === 'WIN' ? t.amount : -t.amount), 0),
                totalFocusTime: allLogs.reduce((sum, log) => sum + log.focusMinutes, 0) * 60
            };

            const achievements = getUnlockedAchievements(userState);
            const newAchievements = achievements.filter(a => {
                const savedIds = JSON.parse(localStorage.getItem('focusflow_achievement_ids') || '[]');
                return !savedIds.includes(a.id);
            });

            for (const achievement of newAchievements) {
                playWin();
                addToast(achievement.title, achievement.description, achievement.icon);
                
                const savedIds = JSON.parse(localStorage.getItem('focusflow_achievement_ids') || '[]');
                localStorage.setItem('focusflow_achievement_ids', JSON.stringify([...savedIds, achievement.id]));
            }
        };

        checkAchievements();
    }, [allLogs, transactions]);

    const addToast = (title: string, subtitle?: string, icon: string = '⭐') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, title, subtitle, icon }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    if (ghostMode) {
        return <GhostModeView />;
    }

    return (
        <ErrorBoundary>
            {isShowingTutorial && (
                <Tutorial 
                    onComplete={() => setIsShowingTutorial(false)}
                    isCyberpunk={isCyberpunk}
                />
            )}

            <MacWindow onToggleTheme={() => {}} isDarkMode={appTheme === 'dark'} title="FocusFlow">
                <div className="flex h-full">
                    <Sidebar activeView={view} onViewChange={setView} />
                    
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 md:p-8">
                            <Suspense fallback={<PanelLoader />}>
                                {view === 'TIMER' && (
                                    <div className="max-w-6xl mx-auto">
                                        <DashboardHeader 
                                            activeProjectName={activeProjectName}
                                            currentYear={currentYear}
                                            activeProject={activeProject}
                                            streaks={activeProject?.streak}
                                        />
                                        <TimerPanel projects={projects} />
                                    </div>
                                )}
                                {view === 'CALENDAR' && <CalendarPanel />}
                                {view === 'STATISTICS' && <StatisticsPanel />}
                                {view === 'HEATMAP' && <Heatmap />}
                                {view === 'COUNTDOWN' && <CountdownPanel />}
                                {view === 'INSIGHTS' && <InsightsPanel />}
                                {view === 'GAMIFICATION' && (
                                    <GamificationPanel 
                                        activeProject={activeProject} 
                                        userState={{
                                            globalBalance: transactions.reduce((sum, t) => sum + (t.type === 'WIN' ? t.amount : -t.amount), 0),
                                            totalFocusTime: allLogs.reduce((sum, log) => sum + log.focusMinutes, 0)
                                        }}
                                        isCyberpunk={isCyberpunk}
                                        projects={projects}
                                        onSelectProject={(id) => {}}
                                    />
                                )}
                                {view === 'GOALS' && (
                                    <GoalsPanel 
                                        goals={{
                                            daily: 4,
                                            weekly: 30,
                                            monthly: 120,
                                            yearly: 1460
                                        }}
                                        onUpdateGoals={() => {}}
                                        currentDailyHours={0}
                                        currentWeeklyHours={0}
                                        currentMonthlyHours={0}
                                        currentYearlyHours={0}
                                    />
                                )}
                                {view === 'TASKS' && <TaskPanel projects={projects} />}
                                {view === 'QUICK_CAPTURE' && <QuickCapturePanel />}
                                {view === 'SETTINGS' && <SettingsPanel />}
                            </Suspense>
                        </div>
                    </div>
                </div>
            </MacWindow>

            <QuickTimerOverlay />
            {isElectron && <MiniCaptureWindow />}

            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    title={toast.title}
                    subtitle={toast.subtitle}
                    icon={toast.icon}
                    onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    isCyberpunk={isCyberpunk}
                />
            ))}
        </ErrorBoundary>
    );
};

// Main App Component
export default function App() {
    return (
        <AppProvider>
            <FocusFlowContent />
        </AppProvider>
    );
}
