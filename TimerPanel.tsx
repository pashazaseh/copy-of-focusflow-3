import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as storage from './services/storageService';
import { TimerSettings, SessionRecord, Project, MenuBarConfig, Transaction, Task } from './types';
import { playAlarm } from './services/audioService';
import { useTheme } from './AppContext';

interface TimerPanelProps {
    onSaveSession: (hours: number, note?: string, projectId?: string) => void;
    projectId: string; 
    projects: Project[]; 
    menuBarConfig: MenuBarConfig;
    externalStart?: { duration: number; timestamp: number } | null;
    onConsumeExternalStart?: () => void;
    currentGems: number;
    addTransaction: (t: Transaction) => void;
}

type TimerMode = 'POMO' | 'STOPWATCH';
type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

const DEFAULT_SETTINGS: TimerSettings = {
    pomoDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    pomosPerLongBreak: 4,
    autoStartNextPomo: false,
    autoStartBreak: false,
    quickDurations: [15, 25, 45],
    shortBreakPresets: [5, 10, 15]
};

export const TimerPanel: React.FC<TimerPanelProps> = ({ 
    onSaveSession, projectId, projects, menuBarConfig, externalStart, onConsumeExternalStart, currentGems: propGems, addTransaction 
}) => {
    // --- Core State ---
    const { appTheme } = useTheme();
    
    const [mode, setMode] = useState<TimerMode>('POMO');
    const [phase, setPhase] = useState<TimerPhase>('FOCUS');
    const [timeLeft, setTimeLeft] = useState(25 * 60); 
    const [initialTime, setInitialTime] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [sessionLabel, setSessionLabel] = useState('');
    const [stopwatchTime, setStopwatchTime] = useState(0);
    
    const [selectedProjectId, setSelectedProjectId] = useState(projectId);
    const [settings, setSettings] = useState<TimerSettings>({ pomoDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, pomosPerLongBreak: 4, autoStartNextPomo: false, autoStartBreak: false, quickDurations: [25, 45, 60], shortBreakPresets: [5, 10, 15] });
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');
    const [pomosCompleted, setPomosCompleted] = useState(0); 

    // Wager State
    const [wager, setWager] = useState(0);
    const [isWagerActive, setIsWagerActive] = useState(false);

    // --- UI State ---
    const [showSidebar, setShowSidebar] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
    const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
    const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
    
    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSessionIds, setEditingSessionIds] = useState<string[]>([]);
    const [editProject, setEditProject] = useState('');
    const [editLabel, setEditLabel] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');

    // Settings Modal Temp State
    const [tempSettings, setTempSettings] = useState<TimerSettings>(settings);

    // Manual Session Form State
    const [manualProject, setManualProject] = useState(projectId);
    const [manualDesc, setManualDesc] = useState('');
    const [manualDate, setManualDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    const [manualTime, setManualTime] = useState('12:00');
    const [manualDuration, setManualDuration] = useState(25);
    const [manualType, setManualType] = useState<'POMO'|'STOPWATCH'>('POMO');

    // Refs for Robust Timing
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const endTimeRef = useRef<number | null>(null); 
    const startTimeRef = useRef<number | null>(null);
    const historyMenuRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef(true);

    // State Ref to prevent stale closures in setInterval
    const stateRef = useRef({
        sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode
    });
    stateRef.current = { sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode };

    const currentGems = propGems;

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Assuming storage service has this method, otherwise fallback to defaults
                const saved = (storage as any).getTimerSettings ? await (storage as any).getTimerSettings() : null;
                if (saved) setSettings(saved);
            } catch (error) {
                console.error("Failed to load timer settings:", error);
            }
        };
        loadSettings();
    }, []);

    // Handle External Start (e.g. from Tray)
    useEffect(() => {
        if (externalStart && onConsumeExternalStart) {
            setMode('POMO');
            setPhase('FOCUS');
            setTimeLeft(externalStart.duration * 60);
            setIsActive(true);
            onConsumeExternalStart();
        }
    }, [externalStart, onConsumeExternalStart]);

    // Timer Logic
    useEffect(() => {
        if (isActive) {
            timerRef.current = setInterval(() => {
                if (mode === 'POMO') {
                    setTimeLeft((prev) => {
                        if (prev <= 1) {
                            handleTimerComplete();
                            return 0;
                        }
                        return prev - 1;
                    });
                } else {
                    setStopwatchTime((prev) => prev + 1);
                }
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, mode, settings]);

    // Update Tray Title
    useEffect(() => {
        if (window.electronAPI?.updateTrayTitle) {
            const time = mode === 'POMO' ? timeLeft : stopwatchTime;
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            const symbol = isActive ? '▶' : '⏸';
            window.electronAPI.updateTrayTitle(`${symbol} ${timeStr}`);
        }
    }, [timeLeft, stopwatchTime, isActive, mode]);

    const handleTimerComplete = () => {
        setIsActive(false);
        playAlarm(1);

        if (phase === 'FOCUS') {
            // Save Session
            const durationHours = settings.pomoDuration / 60;
            onSaveSession(durationHours, 'Pomodoro Session', projectId);

            // Award Gems
            addTransaction({
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                type: 'EARN',
                amount: 10,
                description: 'Completed Pomodoro'
            });

            const newCompleted = pomosCompleted + 1;
            setPomosCompleted(newCompleted);

            // Determine Next Phase
            if (newCompleted % settings.pomosPerLongBreak === 0) {
                setPhase('LONG_BREAK');
                setTimeLeft(settings.longBreakDuration * 60);
                if (settings.autoStartBreak) setIsActive(true);
            } else {
                setPhase('SHORT_BREAK');
                setTimeLeft(settings.shortBreakDuration * 60);
                if (settings.autoStartBreak) setIsActive(true);
            }
        } else {
            // Break Over
            setPhase('FOCUS');
            setTimeLeft(settings.pomoDuration * 60);
            if (settings.autoStartNextPomo) setIsActive(true);
        }
    };

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        if (mode === 'POMO') {
            if (phase === 'FOCUS') setTimeLeft(settings.pomoDuration * 60);
            else if (phase === 'SHORT_BREAK') setTimeLeft(settings.shortBreakDuration * 60);
            else setTimeLeft(settings.longBreakDuration * 60);
        } else {
            setStopwatchTime(0);
        }
    };

    const handleStopwatchSave = () => {
        if (stopwatchTime > 60) {
            const hours = stopwatchTime / 3600;
            onSaveSession(hours, 'Stopwatch Session', projectId);
            setStopwatchTime(0);
            setIsActive(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getPhaseLabel = () => {
        switch (phase) {
            case 'FOCUS': return 'Focus Time';
            case 'SHORT_BREAK': return 'Short Break';
            case 'LONG_BREAK': return 'Long Break';
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center p-6 rounded-2xl shadow-xl transition-colors duration-300 ${
            appTheme === 'cyberpunk' 
                ? 'bg-gray-900 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]' 
                : 'bg-white border border-gray-100'
        }`}>
            {/* Mode Switcher */}
            <div className="flex space-x-2 mb-8 bg-gray-100/50 p-1 rounded-xl dark:bg-gray-800/50">
                <button
                    onClick={() => { setMode('POMO'); setIsActive(false); }}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                        mode === 'POMO'
                            ? (appTheme === 'cyberpunk' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/50' : 'bg-blue-600 text-white shadow-md')
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    Pomodoro
                </button>
                <button
                    onClick={() => { setMode('STOPWATCH'); setIsActive(false); }}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                        mode === 'STOPWATCH'
                            ? (appTheme === 'cyberpunk' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/50' : 'bg-purple-600 text-white shadow-md')
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    Stopwatch
                </button>
            </div>

            {/* Timer Display */}
            <div className="relative mb-8 group">
                <div className={`text-8xl font-mono font-bold tracking-tighter tabular-nums transition-colors ${
                    appTheme === 'cyberpunk' 
                        ? 'text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]' 
                        : 'text-gray-800'
                }`}>
                    {mode === 'POMO' ? formatTime(timeLeft) : formatTime(stopwatchTime)}
                </div>
                <div className={`text-center text-sm font-bold uppercase tracking-[0.2em] mt-2 ${
                    appTheme === 'cyberpunk' ? 'text-cyan-600' : 'text-gray-400'
                }`}>
                    {mode === 'POMO' ? getPhaseLabel() : 'Stopwatch Active'}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
                <button
                    onClick={toggleTimer}
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${
                        isActive 
                            ? 'bg-red-500 text-white shadow-red-500/30' 
                            : (appTheme === 'cyberpunk' ? 'bg-cyan-500 text-white shadow-cyan-500/30' : 'bg-blue-600 text-white shadow-blue-600/30')
                    }`}
                >
                    {isActive ? '⏸' : '▶'}
                </button>

                <button
                    onClick={resetTimer}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl transition-all hover:bg-gray-200 dark:hover:bg-gray-700 ${
                        appTheme === 'cyberpunk' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                    }`}
                    title="Reset"
                >
                    ↺
                </button>

                {mode === 'STOPWATCH' && (
                    <button
                        onClick={handleStopwatchSave}
                        className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl transition-all hover:bg-green-100 text-green-600 dark:hover:bg-green-900/30`}
                        title="Save Session"
                    >
                        💾
                    </button>
                )}
            </div>

            {/* Quick Presets */}
            {mode === 'POMO' && phase === 'FOCUS' && !isActive && (
                <div className="mt-8 flex gap-3">
                    {settings.quickDurations.map(min => (
                        <button
                            key={min}
                            onClick={() => setTimeLeft(min * 60)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                appTheme === 'cyberpunk'
                                    ? 'border-gray-700 text-gray-400 hover:border-cyan-500 hover:text-cyan-400'
                                    : 'border-gray-200 text-gray-600 hover:border-blue-500 hover:text-blue-600'
                            }`}
                        >
                            {min}m
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};