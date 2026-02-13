import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as storage from '../services/storageService';
import { TimerSettings, SessionRecord, Project, MenuBarConfig, Transaction, Task } from '../types';
import { playAlarm, playTone } from '../services/audioService';
import { useTheme, useProjects } from '../AppContext';
import { handleSessionComplete } from '../services/gamificationService';
import { ControlDock } from './Timer/ControlDock';
import { TimerActionButtons } from './Timer/TimerControls';
import { TimerDisplay } from './Timer/TimerDisplay';
import { TimeWheel } from './TimeWheel';

interface TimerPanelProps {
    onSaveSession: (hours: number, note?: string, projectId?: string) => void;
    projectId: string; 
    projects: Project[]; 
    menuBarConfig: MenuBarConfig;
    externalStart?: { duration: number; timestamp: number } | null;
    onConsumeExternalStart?: () => void;
    currentGems: number;
    addTransaction: (t: Transaction) => void;
    isGhostMode?: boolean;
}

type TimerMode = 'POMO' | 'STOPWATCH';
type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

interface TimerModeTabsProps {
    mode: TimerMode;
    onModeSwitch: (mode: TimerMode) => void;
    isCyberpunk: boolean;
}

const TimerModeTabs: React.FC<TimerModeTabsProps> = ({ mode, onModeSwitch, isCyberpunk }) => {
    return (
        <div className={`flex p-1 rounded-2xl mb-4 md:mb-8 transition-all duration-300 ${isCyberpunk ? 'bg-black/40 border border-[#00f0ff]/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-gray-100 dark:bg-white/5'}`}>
            {(['POMO', 'STOPWATCH'] as TimerMode[]).map((m) => (
                <button
                    key={m}
                    onClick={() => onModeSwitch(m)}
                    className={`flex-1 py-2 px-6 rounded-xl text-xs font-bold transition-all duration-300 ${
                        mode === m
                            ? (isCyberpunk 
                                ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-[#00f0ff]/50 animate-pulse' 
                                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm')
                            : (isCyberpunk 
                                ? 'text-[#00f0ff]/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/5' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white')
                    }`}
                >
                    {m === 'POMO' ? 'Focus' : 'Stopwatch'}
                </button>
            ))}
        </div>
    );
};

export const TimerPanel: React.FC<TimerPanelProps> = ({ 
    onSaveSession, projectId, projects, menuBarConfig, externalStart, onConsumeExternalStart, currentGems: propGems, addTransaction 
}) => {
  const { appTheme } = useTheme();
  const { updateProjects } = useProjects();
  
  const [mode, setMode] = useState<TimerMode>('POMO');
  const [phase, setPhase] = useState<TimerPhase>('FOCUS');
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  const [initialTime, setInitialTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');
  
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [settings, setSettings] = useState<TimerSettings>({ pomoDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, pomosPerLongBreak: 4, autoStartNextPomo: false, autoStartBreak: false, quickDurations: [15, 25, 30, 45, 60, 90], shortBreakPresets: [5, 10, 15, 20, 30], focusMode: true, autoMinimize: false } as any);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [pomosCompleted, setPomosCompleted] = useState(0); 
  const [workDuration, setWorkDuration] = useState(25);
  const [restDuration, setRestDuration] = useState(5);

  const [isGhostMode, setIsGhostMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'ghost');
  const [enableGhostButton, setEnableGhostButton] = useState(() => localStorage.getItem('focusflow_enable_ghost_btn') !== 'false');
  const [isPinned, setIsPinned] = useState(true);

  const [wager, setWager] = useState(0);
  const [isWagerActive, setIsWagerActive] = useState(false);
  const [wagerWinAmount, setWagerWinAmount] = useState<number | null>(null);

  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);

  const [showSidebar, setShowSidebar] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSessionIds, setEditingSessionIds] = useState<string[]>([]);
  const [editProject, setEditProject] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  const [newPresetWork, setNewPresetWork] = useState('');
  const [newPresetRest, setNewPresetRest] = useState('');
  const [tempSettings, setTempSettings] = useState<TimerSettings>(settings);

  const [manualProject, setManualProject] = useState(projectId);
  const [manualDesc, setManualDesc] = useState('');
  const [manualDate, setManualDate] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [manualTime, setManualTime] = useState('12:00');
  const [manualDuration, setManualDuration] = useState(25);
  const [manualType, setManualType] = useState<'POMO'|'STOPWATCH'>('POMO');

  const [alwaysOnTopActive, setAlwaysOnTopActive] = useState(false);

  useEffect(() => {
      const checkSetting = () => {
          const enabled = localStorage.getItem('focusflow_always_on_top_active') === 'true';
          setAlwaysOnTopActive(enabled);
      };
      checkSetting();
      window.addEventListener('focusflow-aot-setting-update', checkSetting);
      return () => window.removeEventListener('focusflow-aot-setting-update', checkSetting);
  }, []);

  useEffect(() => {
      if (alwaysOnTopActive) {
          setIsPinned(isActive);
          (window.electronAPI as any)?.setAlwaysOnTop(isActive);
      }
  }, [isActive, alwaysOnTopActive]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number | null>(null); 
  const startTimeRef = useRef<number | null>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const hasSynced = useRef(false);
  const isMounted = useRef(true);
  const trayActionHandlerRef = useRef<(action: { type: string; duration?: number }) => void>();

  const stateRef = useRef({
        sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode, tasks
  });
    stateRef.current = { sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode, tasks };

  const currentGems = propGems;

  const currentProjectName = selectedProjectId === 'all' ? 'All Projects' : projects.find(p => p.id === selectedProjectId)?.name;
  const currentTaskTitle = tasks.find(t => t.id === selectedTaskId)?.title;

useEffect(() => {
      isMounted.current = true;
      return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
      if (isActive) window.electronAPI?.preventAppSuspension?.(true);
      else window.electronAPI?.preventAppSuspension?.(false);
      return () => { window.electronAPI?.preventAppSuspension?.(false); };
  }, [isActive]);

  useEffect(() => {
      const shouldDND = isActive && mode === 'POMO' && phase === 'FOCUS' && (settings as any).focusMode;
      (window.electronAPI as any)?.setDoNotDisturb?.(shouldDND);
      return () => { (window.electronAPI as any)?.setDoNotDisturb?.(false); };
  }, [isActive, mode, phase, settings]);

  useEffect(() => {

      const initTimer = setTimeout(async () => {
          const [sSessions, sSettings, sTasks] = await Promise.all([storage.getSessions(), storage.getTimerSettings(), storage.getTasks()]);
          if (isMounted.current) {
              setSessions(sSessions);
              setSettings({
                  ...sSettings,
                  quickDurations: sSettings.quickDurations && sSettings.quickDurations.length > 0 ? sSettings.quickDurations : [15, 25, 30, 45, 60, 90],
                  shortBreakPresets: sSettings.shortBreakPresets && sSettings.shortBreakPresets.length > 0 ? sSettings.shortBreakPresets : [5, 10, 15, 20, 30],
                  focusMode: (sSettings as any).focusMode ?? true,
                  autoMinimize: (sSettings as any).autoMinimize ?? false
              } as any);
              setWorkDuration(sSettings.pomoDuration);
              setRestDuration(sSettings.shortBreakDuration);

              const savedEndTime = localStorage.getItem('focusflow_timer_end_time');
              const savedStartTime = localStorage.getItem('focusflow_timer_start_time');
              const savedMode = localStorage.getItem('focusflow_timer_mode');

              if (savedEndTime && !Number.isNaN(Number(savedEndTime)) && savedMode === 'POMO') {
                  const end = parseInt(savedEndTime, 10);
                  if (end > Date.now()) {
                      endTimeRef.current = end;
                      setMode('POMO');
                      setPhase((localStorage.getItem('focusflow_timer_phase') as TimerPhase) || 'FOCUS');
                      setSelectedProjectId(localStorage.getItem('focusflow_timer_project') || projectId);
                      setSelectedTaskId(localStorage.getItem('focusflow_timer_task') || '');
                      setSessionLabel(localStorage.getItem('focusflow_timer_label') || '');
                      const savedInitial = localStorage.getItem('focusflow_timer_initial_time');
                      if (savedInitial && !Number.isNaN(Number(savedInitial))) {
                        setInitialTime(parseInt(savedInitial, 10));
                      }

                      setIsActive(true);
                      setTimeLeft(Math.ceil((end - Date.now()) / 1000));
                      
                      // Broadcast restored state to main process for Ghost Mode
                      window.electronAPI?.broadcastTimerAction('START_TIMER', {
                          mode: 'POMO',
                          phase: localStorage.getItem('focusflow_timer_phase') || 'FOCUS',
                          timeLeft: Math.ceil((end - Date.now()) / 1000),
                          initialTime: parseInt(savedInitial || '1500', 10),
                          sessionLabel: localStorage.getItem('focusflow_timer_label') || '',
                          selectedProjectId: localStorage.getItem('focusflow_timer_project') || projectId,
                          endTime: end
                      });
                  } else {
                      localStorage.removeItem('focusflow_timer_end_time');
                      localStorage.removeItem('focusflow_timer_initial_time');
                  }
              } else if (savedStartTime && !Number.isNaN(Number(savedStartTime)) && savedMode === 'STOPWATCH') {
                  const start = parseInt(savedStartTime, 10);
                  startTimeRef.current = start;
                  setMode('STOPWATCH');
                  setSelectedProjectId(localStorage.getItem('focusflow_timer_project') || projectId);
                  setSelectedTaskId(localStorage.getItem('focusflow_timer_task') || '');
                  setSessionLabel(localStorage.getItem('focusflow_timer_label') || '');
                  setIsActive(true);
                  setTimeLeft(Math.floor((Date.now() - start) / 1000));
              } else if (!hasSynced.current) {
                  const duration = sSettings.pomoDuration * 60;
                  setInitialTime(duration);
                  setTimeLeft(duration);
              }
              setTasks(sTasks);
          }
      }, 10);

      const handleClickOutside = (event: MouseEvent) => {
          if (historyMenuRef.current && !historyMenuRef.current.contains(event.target as Node)) {
              setIsHistoryMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      
      const handleTaskUpdate = async () => { setTasks(await storage.getTasks()); };
      window.addEventListener('focusflow-task-update', handleTaskUpdate);
      
      return () => {
          clearTimeout(initTimer);
          document.removeEventListener('mousedown', handleClickOutside);
          window.removeEventListener('focusflow-task-update', handleTaskUpdate);
      };
  }, []);

  useEffect(() => {
      const handleSettingsUpdate = async () => {
          const sSettings = await storage.getTimerSettings();
          if (isMounted.current) {
              setSettings({
                  ...sSettings,
                  quickDurations: sSettings.quickDurations && sSettings.quickDurations.length > 0 ? sSettings.quickDurations : [15, 25, 30, 45, 60, 90],
                  shortBreakPresets: sSettings.shortBreakPresets && sSettings.shortBreakPresets.length > 0 ? sSettings.shortBreakPresets : [5, 10, 15, 20, 30],
                  focusMode: (sSettings as any).focusMode ?? true,
                  autoMinimize: (sSettings as any).autoMinimize ?? false
              } as any);
              setWorkDuration(sSettings.pomoDuration);
              setRestDuration(sSettings.shortBreakDuration);
          }
      };
      window.addEventListener('focusflow-timer-settings-update', handleSettingsUpdate);
      return () => window.removeEventListener('focusflow-timer-settings-update', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    const handleTimerUpdate = (action: string, payload: any) => {
        hasSynced.current = true;
        switch(action) {
          case 'START_TIMER':
            if (payload.mode === 'POMO') {
              endTimeRef.current = payload.endTime;
              startTimeRef.current = null;
            } else {
              startTimeRef.current = payload.startTime;
              endTimeRef.current = null;
            }
            setIsActive(true);
            setMode(payload.mode);
            setPhase(payload.phase);
            setTimeLeft(payload.timeLeft);
            setInitialTime(payload.initialTime);
            setSessionLabel(payload.sessionLabel);
            setSelectedProjectId(payload.selectedProjectId);
            break;
            
          case 'PAUSE_TIMER':
            endTimeRef.current = null;
            startTimeRef.current = null;
            setIsActive(false);
            setTimeLeft(payload.timeLeft);
            break;
          case 'SKIP_PHASE':
            setTimeLeft(0);
            break;
          case 'UPDATE_LABEL':
            setSessionLabel(payload.sessionLabel);
            break;
            
          case 'RESET_TIMER':
            endTimeRef.current = null;
            startTimeRef.current = null;
            setIsActive(false);
            setMode(payload.mode);
            setPhase(payload.phase);
            setTimeLeft(payload.initialTime);
            setInitialTime(payload.initialTime);
            break;
        }
    };

    const handleSyncState = (state: any) => {
        hasSynced.current = true;
        setIsActive(state.isActive);
        setMode(state.mode);
        setPhase(state.phase);
        setTimeLeft(state.timeLeft);
        setInitialTime(state.initialTime);
        setSessionLabel(state.sessionLabel);
        setSelectedProjectId(state.selectedProjectId);
        
        if (state.isActive) {
            endTimeRef.current = state.endTime;
            startTimeRef.current = state.startTime;
        } else {
            endTimeRef.current = null;
            startTimeRef.current = null;
        }
    };

    let cleanupUpdate: (() => void) | undefined;
    let cleanupSync: (() => void) | undefined;

    if (window.electronAPI?.onTimerUpdate) {
        cleanupUpdate = window.electronAPI.onTimerUpdate(handleTimerUpdate);
    }

    if (window.electronAPI?.onSyncTimerState) {
        cleanupSync = window.electronAPI.onSyncTimerState(handleSyncState);
    }

    if ((window.electronAPI as any)?.getTimerState) {
        (window.electronAPI as any).getTimerState();
    }

    return () => {
        if (cleanupUpdate) cleanupUpdate();
        if (cleanupSync) cleanupSync();
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      window.electronAPI?.broadcastTimerAction('UPDATE_LABEL', { sessionLabel });
    }
  }, [sessionLabel, isActive]);

  useEffect(() => {
      if (!isActive) {
          setSelectedProjectId(projectId);
          setSelectedTaskId('');
          setSessionLabel('');
      }
      setManualProject(projectId);
  }, [projectId]);

  useEffect(() => {
      if (externalStart && externalStart.duration > 0) {
          const seconds = externalStart.duration * 60;

          if (isActive && mode === 'POMO' && phase === 'FOCUS') {
              // Add to active focus timer
              const newTimeLeft = timeLeft + seconds;
              const newInitialTime = initialTime + seconds;
              
              setTimeLeft(newTimeLeft);
              setInitialTime(newInitialTime);
              
              let newEndTime = endTimeRef.current;
              if (newEndTime) {
                  newEndTime += seconds * 1000;
              } else {
                  newEndTime = Date.now() + newTimeLeft * 1000;
              }
              endTimeRef.current = newEndTime;
              localStorage.setItem('focusflow_timer_end_time', newEndTime.toString());
              localStorage.setItem('focusflow_timer_initial_time', newInitialTime.toString());

              window.electronAPI?.broadcastTimerAction('START_TIMER', {
                  mode,
                  phase,
                  timeLeft: newTimeLeft,
                  initialTime: newInitialTime,
                  sessionLabel,
                  selectedProjectId,
                  endTime: newEndTime,
                  startTime: null
              });
          } else {
              const newTimeLeft = seconds;
              const newInitialTime = seconds;
              const newEndTime = Date.now() + seconds * 1000;

              setMode('POMO');
              setPhase('FOCUS');
              setInitialTime(newInitialTime);
              setTimeLeft(newTimeLeft);
              setIsActive(true);
              setSessionLabel('Quick Focus Session');
              
              endTimeRef.current = newEndTime;
              startTimeRef.current = null;

              window.electronAPI?.broadcastTimerAction('START_TIMER', {
                  mode: 'POMO',
                  phase: 'FOCUS',
                  timeLeft: newTimeLeft,
                  initialTime: newInitialTime,
                  sessionLabel: 'Quick Focus Session',
                  selectedProjectId: selectedProjectId || projectId,
                  endTime: newEndTime,
                  startTime: null
              });
          }
          if (onConsumeExternalStart) onConsumeExternalStart();
      }
  }, [externalStart, onConsumeExternalStart, isActive, mode, phase, timeLeft, initialTime, sessionLabel, selectedProjectId, projectId]);

  const handleTrayAction = useCallback((action: { type: string; duration?: number }) => {
      if (action.type === 'TOGGLE_TIMER') {
          toggleTimer();
      } else if (action.type === 'SKIP_PHASE') {
          skipPhase();
      }
      // START_FOCUS is handled by App.tsx setting externalStart via pendingQuickTimer
  }, [isActive, mode, phase, timeLeft, initialTime, sessionLabel, selectedProjectId]);

  useEffect(() => {
      trayActionHandlerRef.current = handleTrayAction;
  }, [handleTrayAction]);

  useEffect(() => {
    // This effect sets up the listener once
    if (window.electronAPI?.onTrayAction) {
        const cleanup = window.electronAPI.onTrayAction((action) => {
            if (trayActionHandlerRef.current) {
                trayActionHandlerRef.current(action);
            }
        });
        return () => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        }
    }
  }, []);

  useEffect(() => {
      if (menuBarConfig.mode === 'timer') {
          const m = Math.floor(timeLeft / 60);
          const s = timeLeft % 60;
          const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          const icon = isActive ? '▶' : '⏸';
          const modeIcon = mode === 'POMO' ? (phase === 'FOCUS' ? '🍅' : '☕') : '⏱';
          window.electronAPI?.updateTrayTitle(`${modeIcon} ${timeStr}`);
      }
  }, [timeLeft, isActive, mode, phase, menuBarConfig]);
  
  useEffect(() => {
    if (isActive) {
      if (mode === 'POMO') {
          if (!endTimeRef.current) {
              const durationMS = timeLeft * 1000;
              endTimeRef.current = Date.now() + durationMS;
          }
          if (!isGhostMode) {
              localStorage.setItem('focusflow_timer_end_time', endTimeRef.current.toString());
              localStorage.setItem('focusflow_timer_mode', 'POMO');
              localStorage.setItem('focusflow_timer_phase', phase);
              localStorage.setItem('focusflow_timer_project', selectedProjectId);
              localStorage.setItem('focusflow_timer_task', selectedTaskId);
              localStorage.setItem('focusflow_timer_label', sessionLabel);
              localStorage.setItem('focusflow_timer_initial_time', initialTime.toString());
          }
      } else {
          if (!startTimeRef.current) {
              const elapsedMS = timeLeft * 1000;
              startTimeRef.current = Date.now() - elapsedMS;
          }
          if (!isGhostMode) {
              localStorage.setItem('focusflow_timer_start_time', startTimeRef.current.toString());
              localStorage.setItem('focusflow_timer_mode', 'STOPWATCH');
              localStorage.setItem('focusflow_timer_project', selectedProjectId);
              localStorage.setItem('focusflow_timer_task', selectedTaskId);
              localStorage.setItem('focusflow_timer_label', sessionLabel);
          }
      }

      timerRef.current = setInterval(() => {
        if (mode === 'POMO') {
            if (endTimeRef.current) {
                const now = Date.now();
                const diff = Math.ceil((endTimeRef.current - now) / 1000);
                if (diff <= 0) {
                    setTimeLeft(0);
                    (async () => {
                        await handleTimerComplete();
                    })();
                } else {
                    setTimeLeft(diff);
                }
            }
        } else {
            if (startTimeRef.current) {
                const now = Date.now();
                const elapsed = Math.floor((now - startTimeRef.current) / 1000);
                setTimeLeft(elapsed);
            }
        }
      }, 1000); 
    } else {
        endTimeRef.current = null;
        startTimeRef.current = null;
        if (!isGhostMode) {
            localStorage.removeItem('focusflow_timer_end_time');
            localStorage.removeItem('focusflow_timer_start_time');
            localStorage.removeItem('focusflow_timer_initial_time');
        }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, mode, phase, selectedProjectId, selectedTaskId, sessionLabel, initialTime, isGhostMode]);

const handleTimerComplete = async () => {
      const currentData = stateRef.current;
      
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      endTimeRef.current = null;
      
      if (isGhostMode) {
          (window.electronAPI as any)?.playSoundEffect?.();
          return;
      }

      localStorage.removeItem('focusflow_timer_end_time');
      localStorage.removeItem('focusflow_timer_initial_time');
      triggerAlarm();

      if (Notification.permission === "granted") {
          new Notification("Timer Finished!", {
              body: currentData.sessionLabel || "Focus session complete.",
              silent: false 
          });
      }

      if (currentData.isWagerActive && currentData.wager > 0) {
          const durationInMinutes = currentData.initialTime / 60;
          const multiplier = 1 + (durationInMinutes / 120);
          const reward = Math.floor(currentData.wager * multiplier);

          const newBonus = (parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0) + reward;
          localStorage.setItem('focusflow_bonus_gems', newBonus.toString());
          
          window.dispatchEvent(new Event('focusflow-gem-update'));
          
          addTransaction({
              id: `wager-win-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'WIN',
              amount: reward,
              description: `Focus Wager Won (${multiplier.toFixed(2)}x)`
          });
          setIsWagerActive(false);
          setWager(0);
          if (isMounted.current) setWagerWinAmount(reward);
          setTimeout(() => {
              if (isMounted.current) setWagerWinAmount(null);
          }, 5000);
      }

      const now = new Date();
      const endTime = now.toISOString();
      const durationSecs = currentData.initialTime; 
      const startTime = new Date(now.getTime() - durationSecs * 1000).toISOString();

      if (currentData.phase === 'FOCUS') {
          const labelText = currentData.sessionLabel.trim() || 'Focus Session';
          const newSession = {
              id: Date.now().toString(),
              startTime,
              endTime,
              duration: durationSecs,
              type: 'POMO',
              label: labelText,
              projectId: currentData.selectedProjectId,
              taskId: currentData.selectedTaskId || undefined
          } as unknown as SessionRecord;
          const updatedSessions = await storage.saveSessionRecord(newSession);
          if (isMounted.current) setSessions(updatedSessions);
          
          const hours = Math.round((durationSecs / 3600) * 10) / 10;
          onSaveSession(hours, labelText, currentData.selectedProjectId);

          // --- RPG Integration: Update Project Stats ---
          if (currentData.selectedProjectId && currentData.selectedProjectId !== 'all') {
              const project = projects.find(p => p.id === currentData.selectedProjectId);
              if (project) {
                  const durationMinutes = Math.floor(durationSecs / 60);
                  // Calculate new stats
                  const { updatedProject } = handleSessionComplete(project, currentGems, durationMinutes);
                  // Save to storage and update global context
                  const updatedList = await storage.saveProject(updatedProject);
                  updateProjects(updatedList);
              }
          }

          if (currentData.selectedTaskId) {
              const task = currentData.tasks.find(t => t.id === currentData.selectedTaskId);
              if (task && !task.isCompleted) {
                  await storage.saveTask({ ...task, isCompleted: true });
                  window.dispatchEvent(new Event('focusflow-task-update'));
              }
          }

          const newPomos = currentData.pomosCompleted + 1;
          setPomosCompleted(newPomos);

          if (newPomos % currentData.settings.pomosPerLongBreak === 0) {
              setPhase('LONG_BREAK');
              const duration = currentData.settings.longBreakDuration * 60;
              setInitialTime(duration);
              setTimeLeft(duration);
              if (currentData.settings.autoStartBreak) setIsActive(true);
          } else {
              setPhase('SHORT_BREAK');
              const duration = currentData.settings.shortBreakDuration * 60;
              setInitialTime(duration);
              setTimeLeft(duration);
              if (currentData.settings.autoStartBreak) setIsActive(true);
          }
      } else {
          setPhase('FOCUS');
          const duration = currentData.settings.pomoDuration * 60;
          setInitialTime(duration);
          setTimeLeft(duration);
          if (currentData.settings.autoStartNextPomo) setIsActive(true);
      }
  };

  const switchMode = (newMode: TimerMode) => {
      if (mode === newMode) return;

      setWager(0);
      let duration = 0;
      if (newMode === 'POMO') {
          duration = settings.pomoDuration * 60;
      }
      
      const payload = {
        mode: newMode,
        phase: 'FOCUS',
        initialTime: duration,
      };
      window.electronAPI?.broadcastTimerAction('RESET_TIMER', payload);

      setIsActive(false);
      setMode(newMode);
      setPhase('FOCUS');
      setInitialTime(duration);
      setTimeLeft(duration);
      endTimeRef.current = null;
      startTimeRef.current = null;
  };

  const handleStopwatchFinish = async () => {
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      const durationSecs = timeLeft;
      if (durationSecs > 0) {
          const now = new Date();
          const endTime = now.toISOString();
          const startTime = new Date(now.getTime() - durationSecs * 1000).toISOString();
          
          const labelText = sessionLabel.trim() || 'Stopwatch Session';
          const newSession = {
              id: Date.now().toString(),
              startTime,
              endTime,
              duration: durationSecs,
              type: 'STOPWATCH',
              label: labelText,
              projectId: selectedProjectId,
              taskId: selectedTaskId || undefined
          } as unknown as SessionRecord;
          
          const updatedSessions = await storage.saveSessionRecord(newSession);
          
          const hours = Math.round((durationSecs / 3600) * 10) / 10;
          onSaveSession(hours, labelText, selectedProjectId);

          if (isMounted.current) {
              setSessions(updatedSessions);
              setTimeLeft(0);
              setInitialTime(0);
              startTimeRef.current = null;
          }
      } else {
          setTimeLeft(0);
          setInitialTime(0);
          startTimeRef.current = null;
      }
  };

  const resetTimer = () => {
      if (isWagerActive) {
          alert("Wager Lost! You stopped the timer early.");
          setIsWagerActive(false);
          setWager(0);
      }

      let duration = settings.pomoDuration * 60;
      if (mode === 'POMO') {
        if (phase === 'SHORT_BREAK') duration = settings.shortBreakDuration * 60;
        if (phase === 'LONG_BREAK') duration = settings.longBreakDuration * 60;
      } else {
        duration = 0;
      }
      
      const payload = {
        mode,
        phase,
        initialTime: duration,
      };
      window.electronAPI?.broadcastTimerAction('RESET_TIMER', payload);

      setIsActive(false);
      setTimeLeft(duration);
      setInitialTime(duration);
      endTimeRef.current = null;
      startTimeRef.current = null;
  };

  const toggleTimer = () => {
    const newIsActive = !isActive;
    
    if (newIsActive) {
      if (wager > 0 && !isWagerActive) {
          const newSpent = (parseInt(localStorage.getItem('focusflow_spent_gems') || '0') || 0) + wager;
          localStorage.setItem('focusflow_spent_gems', newSpent.toString());
          window.dispatchEvent(new Event('focusflow-gem-update'));
          addTransaction({
              id: `wager-start-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'SPEND',
              amount: -wager,
              description: `Focus Wager Placed`
          });
          setIsWagerActive(true);
      }

      if ((settings as any).autoMinimize) {
          (window.electronAPI as any)?.minimizeWindow();
      }

      const payload = {
        mode,
        phase,
        timeLeft,
        initialTime,
        sessionLabel,
        selectedProjectId,
        endTime: mode === 'POMO' ? Date.now() + timeLeft * 1000 : null,
        startTime: mode === 'STOPWATCH' ? Date.now() - timeLeft * 1000 : null,
      };
      window.electronAPI?.broadcastTimerAction('START_TIMER', payload);

    } else {
      const payload = { timeLeft, sessionLabel };
      window.electronAPI?.broadcastTimerAction('PAUSE_TIMER', payload);
    }
    
    setIsActive(newIsActive);
  };

  const skipPhase = () => {
    if (mode === 'POMO') {
      setTimeLeft(0);
      window.electronAPI?.broadcastTimerAction('SKIP_PHASE', {
        ...stateRef.current,
        timeLeft: 0,
      });
    }
  };

  const handleToggleGhostMode = () => {
      const state = {
          timeLeft,
          initialTime,
          isActive,
          mode,
          phase,
          sessionLabel,
          selectedProjectId,
          endTime: endTimeRef.current,
          startTime: startTimeRef.current
      };
      (window.electronAPI as any)?.send('ghost-mode-enable', state);
  };

  const togglePin = () => {
      const newState = !isPinned;
      setIsPinned(newState);
      (window.electronAPI as any)?.setAlwaysOnTop(newState);
  };

  const handleWorkDurationChange = (val: number) => {
      setWorkDuration(val);
      const newSettings = { ...settings, pomoDuration: val };
      setSettings(newSettings);
      storage.saveTimerSettings(newSettings);
      
      if (!isActive && mode === 'POMO' && phase === 'FOCUS') {
          setTimeLeft(val * 60);
          setInitialTime(val * 60);
      }
  };

  const handleRestDurationChange = (val: number) => {
      setRestDuration(val);
      const newSettings = { ...settings, shortBreakDuration: val };
      setSettings(newSettings);
      storage.saveTimerSettings(newSettings);
  };

  const triggerAlarm = () => { 
      const savedVol = localStorage.getItem('focusflow_timer_volume');
      const vol = savedVol ? parseFloat(savedVol) : 0.5;
      playAlarm(vol);
  };
  
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  const openSettings = () => { setTempSettings(settings); setIsSettingsOpen(true); };
  const saveSettings = async () => {
      await storage.saveTimerSettings(tempSettings);
      setSettings(tempSettings);
      if (!isActive) {
          let newDuration = tempSettings.pomoDuration * 60;
          if (phase === 'SHORT_BREAK') newDuration = tempSettings.shortBreakDuration * 60;
          else if (phase === 'LONG_BREAK') newDuration = tempSettings.longBreakDuration * 60;
          setTimeLeft(newDuration);
          setInitialTime(newDuration);
      }
      setIsSettingsOpen(false);
      window.dispatchEvent(new Event('focusflow-timer-settings-update'));
  };

  const toggleGhostButtonSetting = (checked: boolean) => {
      setEnableGhostButton(checked);
      localStorage.setItem('focusflow_enable_ghost_btn', String(checked));
  };

  const handleSettingChange = (k: keyof TimerSettings, v: any) => setTempSettings((p: TimerSettings) => ({...p, [k]: v}));

  const addPreset = (type: 'work' | 'rest') => {
      const val = parseInt(type === 'work' ? newPresetWork : newPresetRest);
      if (!isNaN(val) && val > 0) {
          if (type === 'work') {
              if (!tempSettings.quickDurations.includes(val)) {
                  setTempSettings(s => ({ ...s, quickDurations: [...(s.quickDurations || []), val].sort((a,b) => a-b) }));
              }
              setNewPresetWork('');
          } else {
              if (!tempSettings.shortBreakPresets.includes(val)) {
                  setTempSettings(s => ({ ...s, shortBreakPresets: [...(s.shortBreakPresets || []), val].sort((a,b) => a-b) }));
              }
              setNewPresetRest('');
          }
      }
  };

  const removePreset = (type: 'work' | 'rest', val: number) => {
      if (type === 'work') {
          setTempSettings(s => ({ ...s, quickDurations: (s.quickDurations || []).filter(d => d !== val) }));
      } else {
          setTempSettings(s => ({ ...s, shortBreakPresets: (s.shortBreakPresets || []).filter(d => d !== val) }));
      }
  };
  
  const handleSaveManualSession = async () => {
      if (manualDuration <= 0) return;
      const startDateTime = new Date(`${manualDate}T${manualTime}`);
      const durationSecs = manualDuration * 60;
      const endDateTime = new Date(startDateTime.getTime() + durationSecs * 1000);
      
      const newSession: SessionRecord = {
          id: Date.now().toString(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          duration: durationSecs,
          type: manualType,
          label: manualDesc || (manualType === 'POMO' ? 'Focus Session' : 'Study Session'),
          projectId: manualProject
      };
      
      const updated = await storage.saveSessionRecord(newSession);
      const hours = Math.round((durationSecs / 3600) * 10) / 10;
      onSaveSession(hours, manualDesc, manualProject);
      
      if (isMounted.current) {
          setSessions(updated);
          setIsAddSessionOpen(false);
          setManualDesc('');
          setManualDuration(25);
      }
  };

  const openEditSingle = (session: SessionRecord) => {
      setEditingSessionIds([session.id]);
      setEditProject(session.projectId || projectId);
      setEditLabel(session.label || '');
      const startDate = new Date(session.startTime);
      const endDate = new Date(session.endTime);
      setEditDate(startDate.toISOString().split('T')[0]);
      setEditStartTime(`${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`);
      setEditEndTime(`${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`);
      setIsEditModalOpen(true);
  };

  const openEditBatch = () => {
      const ids = Array.from(selectedSessionIds);
      setEditingSessionIds(ids);
      setEditProject(''); 
      setEditLabel('');
      setEditDate('');
      setEditStartTime(''); 
      setEditEndTime('');
      setIsEditModalOpen(true);
      setIsHistoryMenuOpen(false);
  };

  const handleSaveEdit = async () => {
      const promises: Promise<any>[] = [];

      sessions.forEach(s => {
          if (editingSessionIds.includes(s.id)) {
              let updatedSession: SessionRecord;
              if (editingSessionIds.length === 1) {
                  const startDateTime = new Date(`${editDate}T${editStartTime}`);
                  const endDateTime = new Date(`${editDate}T${editEndTime}`);
                  updatedSession = {
                      ...s,
                      projectId: editProject || s.projectId,
                      label: editLabel,
                      startTime: startDateTime.toISOString(),
                      endTime: endDateTime.toISOString(),
                      duration: (endDateTime.getTime() - startDateTime.getTime()) / 1000
                  };
              } else {
                  let startDateTime = new Date(s.startTime);
                  let endDateTime = new Date(s.endTime);

                  if (editDate) {
                      const timeStart = startDateTime.toTimeString().split(' ')[0];
                      const timeEnd = endDateTime.toTimeString().split(' ')[0];
                      startDateTime = new Date(`${editDate}T${timeStart}`);
                      endDateTime = new Date(`${editDate}T${timeEnd}`);
                  }

                  updatedSession = {
                      ...s,
                      projectId: editProject || s.projectId,
                      label: editLabel || s.label,
                      startTime: startDateTime.toISOString(),
                      endTime: endDateTime.toISOString(),
                      duration: (endDateTime.getTime() - startDateTime.getTime()) / 1000
                  };
              }
              promises.push(storage.saveSessionRecord(updatedSession));
          }
      });

      await Promise.all(promises);

      if (isMounted.current) {
          const newSessions = await storage.getSessions();
          setSessions(newSessions);
          setIsEditModalOpen(false);
          setEditingSessionIds([]);
          setSelectedSessionIds(new Set());
      }
  };
  const toggleGroupSelection = (groupSessions: SessionRecord[]) => {
      const ids = groupSessions.map(s => s.id);
      const allSelected = ids.every(id => selectedSessionIds.has(id));
      const newSet = new Set(selectedSessionIds);
      if (allSelected) { ids.forEach(id => newSet.delete(id)); } else { ids.forEach(id => newSet.add(id)); }
      setSelectedSessionIds(newSet);
  };

  const handleDeleteSelected = async () => {
      if (selectedSessionIds.size === 0) return;
      if (confirm(`Delete ${selectedSessionIds.size} sessions?`)) {
          const updated = await storage.batchDeleteSessions(Array.from(selectedSessionIds));
          if (isMounted.current) {
              setSessions(updated);
              setSelectedSessionIds(new Set());
              setIsHistoryMenuOpen(false);
          }
      }
  };

  const handleClearHistory = async () => {
      if (confirm("Clear all session history? This cannot be undone.")) {
          const allIds = sessions.map(s => s.id);
          const updated = await storage.batchDeleteSessions(allIds);
          if (isMounted.current) {
              setSessions(updated);
              setSelectedSessionIds(new Set());
              setIsHistoryMenuOpen(false);
          }
      }
  };

  const stats = useMemo(() => {
      const now = new Date();
      const isToday = (dateStr: string) => {
          const d = new Date(dateStr);
          return d.getDate() === now.getDate() &&
                 d.getMonth() === now.getMonth() &&
                 d.getFullYear() === now.getFullYear();
      };
      const todaySessions = sessions.filter(s => isToday(s.startTime) && s.type === 'POMO');
      const todayFocusSeconds = sessions.filter(s => isToday(s.startTime)).reduce((acc, curr) => acc + curr.duration, 0);
      return { todayPomos: todaySessions.length, todayFocus: Math.round(todayFocusSeconds / 60) };
  }, [sessions]);

  const activeTasks = useMemo(() => {
      if (selectedProjectId === 'all') return tasks.filter(t => !t.isCompleted);
      return tasks.filter(t => !t.isCompleted && (t.projectId === selectedProjectId || (!t.projectId && !selectedProjectId)));
  }, [tasks, selectedProjectId]);

  const handleTaskSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const tId = e.target.value;
      setSelectedTaskId(tId);
      if (tId) {
          const t = tasks.find(task => task.id === tId);
          if (t) {
              setSessionLabel(t.title);
              if (t.projectId && t.projectId !== selectedProjectId) {
                  setSelectedProjectId(t.projectId);
              } else if (!t.projectId && selectedProjectId !== '' && selectedProjectId !== 'all') {
                  setSelectedProjectId('');
              }
          }
      } else {
          setSessionLabel('');
      }
  };

  const historyGroups = useMemo(() => {
      const sorted = [...sessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      const groups: { dateLabel: string; sessions: SessionRecord[] }[] = [];
      sorted.forEach(session => {
          const dateLabel = new Date(session.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
          let lastGroup = groups[groups.length - 1];
          if (!lastGroup || lastGroup.dateLabel !== dateLabel) {
              lastGroup = { dateLabel, sessions: [] };
              groups.push(lastGroup);
          }
          lastGroup.sessions.push(session);
      });
      return groups;
  }, [sessions]);

  const isCyberpunk = appTheme === 'cyberpunk';

  const [isDraggingGhost, setIsDraggingGhost] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
      if (!isDraggingGhost) return;
      const handleMouseMove = (e: MouseEvent) => {
          const x = e.screenX - dragOffset.current.x;
          const y = e.screenY - dragOffset.current.y;
          (window.electronAPI as any)?.setWindowPosition(x, y);
      };
      const handleMouseUp = () => { setIsDraggingGhost(false); };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDraggingGhost]);

  const handleGhostMouseDown = (e: React.MouseEvent) => {
      if (e.button === 0) {
          setIsDraggingGhost(true);
          dragOffset.current = { x: e.clientX, y: e.clientY };
      }
  };

  const isUrgent = mode === 'POMO' && initialTime > 0 && (timeLeft / initialTime) <= 0.15;
  let phaseColor = isCyberpunk ? "#00f0ff" : "#3B82F6";
  if (isUrgent) phaseColor = isCyberpunk ? "#ff0055" : "#EF4444";
  else if (mode === 'STOPWATCH') phaseColor = isCyberpunk ? "#F59E0B" : "#F59E0B";
  else if (phase === 'SHORT_BREAK' || phase === 'LONG_BREAK') phaseColor = isCyberpunk ? "#10B981" : "#10B981";

  const getGhostColor = (current: number, total: number) => {
      const progress = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
      const hue = Math.floor(progress * 220); // 220 (Blue) -> 0 (Red)
      return {
          hue,
          primary: `hsl(${hue}, 100%, 60%)`,
          glow: `hsla(${hue}, 100%, 60%, 0.3)`
      };
  };

  // Heartbeat sound effect for urgent ghost mode
  useEffect(() => {
      if (!isGhostMode || !isActive || !isUrgent) return;

      let intervalId: ReturnType<typeof setInterval>;
      
      const playHeartbeat = () => {
          const savedVol = localStorage.getItem('focusflow_timer_volume');
          const vol = savedVol ? parseFloat(savedVol) : 0.5;
          // Double thump for heartbeat effect
          playTone(150, 0.1, vol * 0.4, 'sine');
          setTimeout(() => playTone(100, 0.1, vol * 0.3, 'sine'), 150);
      };

      const timeoutId = setTimeout(() => {
          playHeartbeat();
          intervalId = setInterval(playHeartbeat, 3000);
      }, 1500);

      return () => {
          clearTimeout(timeoutId);
          if (intervalId) clearInterval(intervalId);
      };
  }, [isGhostMode, isActive, isUrgent]);

  if (isGhostMode) {
      let primary, glow, progress;

      if (mode === 'STOPWATCH') {
          progress = (timeLeft % 60) / 60;
          primary = '#F59E0B'; // Orange
          glow = 'rgba(245, 158, 11, 0.3)';
      } else {
          const colors = getGhostColor(timeLeft, initialTime);
          primary = colors.primary;
          glow = colors.glow;
          progress = initialTime > 0 ? Math.max(0, Math.min(1, timeLeft / initialTime)) : 0;
      }

      const radius = 88;
      const circumference = 2 * Math.PI * radius;
      const dashOffset = circumference * (1 - progress);

      return (
          <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-transparent">
              <div 
                className="relative flex items-center justify-center w-48 h-48 rounded-full transition-all duration-1000 ease-in-out group"
                style={{
                  WebkitAppRegion: 'drag'
                } as any}
                onDoubleClick={toggleTimer}
              >
                {/* 1. Background Layer */}
                <div 
                    className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-md animate-pulse-slow"
                    style={{
                        background: `radial-gradient(circle, ${glow} 0%, rgba(0,0,0,0.6) 70%)`,
                        boxShadow: `0 0 30px ${glow}`
                    }}
                />

                {/* 2. SVG Layer */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                    <circle 
                        cx="96" cy="96" r={radius} 
                        fill="none" 
                        stroke="rgba(255,255,255,0.1)" 
                        strokeWidth="4" 
                    />
                    <circle 
                        cx="96" cy="96" r={radius} 
                        fill="none" 
                        stroke={primary} 
                        strokeWidth="4" 
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        style={{
                            filter: `drop-shadow(0 0 4px ${primary})`,
                            transition: 'stroke-dashoffset 1s linear, stroke 1s linear'
                        }}
                    />
                </svg>

                {/* Window Controls (Top) */}
                <div 
                    className="absolute top-4 left-0 right-0 flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                     <button 
                        onClick={togglePin} 
                        className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${isPinned ? 'text-white' : 'text-white/50'}`} 
                        title={isPinned ? "Unpin" : "Pin"}
                     >
                        <svg className="w-3.5 h-3.5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                     </button>
                     <button 
                        onClick={() => window.electronAPI?.close()} 
                        className="p-1.5 rounded-full hover:bg-red-500/20 text-white/50 hover:text-red-500 transition-colors" 
                        title="Close"
                     >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                </div>

                {/* 3. Content Layer */}
                <div className="z-10 text-center relative" style={{ WebkitAppRegion: 'no-drag' } as any}>
                   {/* Time Display */}
                   <div 
                     className="text-4xl font-mono font-bold tracking-wider drop-shadow-md select-none"
                     style={{ color: primary, textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                   >
                     {formatTime(timeLeft)}
                   </div>
                </div>
                
                {/* Controls (Visible on Hover) */}
                <div 
                    className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <button onClick={toggleTimer} className="p-2 hover:text-white text-white/70 transition-colors">
                    {isActive ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                    </button>
                    <button onClick={handleToggleGhostMode} className="p-2 hover:text-white text-white/70 transition-colors" title="Expand">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4" /></svg>
                    </button>
                </div>
              </div>
          </div>
      );
  }

return (
    <div className={`flex h-full w-full overflow-hidden relative transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white'}`}>
        
        {isSettingsOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
                <div className="bg-[#1c1c1e] w-[420px] rounded-2xl shadow-2xl border border-gray-700/50 p-6 animate-scale-in flex flex-col text-white max-h-[85vh]">
                      <div className="flex justify-between items-center mb-6 shrink-0">
                        <h2 className="text-lg font-bold">Timer Settings</h2>
                        <button onClick={saveSettings} className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">Done</button>
                    </div>
                    <div className="space-y-6 overflow-y-auto custom-scrollbar pr-1">
                        <div className="space-y-2">
                             <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Durations</h3>
                             <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Focus</span><div className="flex items-center bg-[#2c2c2e] rounded-lg px-2 border border-white/10"><input type="number" value={tempSettings.pomoDuration} onChange={e => handleSettingChange('pomoDuration', parseInt(e.target.value))} className="w-12 bg-transparent text-right font-bold text-white focus:outline-none py-1.5"/><span className="text-xs text-gray-500 ml-1">min</span></div></div>
                             <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Short Break</span><div className="flex items-center bg-[#2c2c2e] rounded-lg px-2 border border-white/10"><input type="number" value={tempSettings.shortBreakDuration} onChange={e => handleSettingChange('shortBreakDuration', parseInt(e.target.value))} className="w-12 bg-transparent text-right font-bold text-white focus:outline-none py-1.5"/><span className="text-xs text-gray-500 ml-1">min</span></div></div>
                             <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Long Break</span><div className="flex items-center bg-[#2c2c2e] rounded-lg px-2 border border-white/10"><input type="number" value={tempSettings.longBreakDuration} onChange={e => handleSettingChange('longBreakDuration', parseInt(e.target.value))} className="w-12 bg-transparent text-right font-bold text-white focus:outline-none py-1.5"/><span className="text-xs text-gray-500 ml-1">min</span></div></div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Automation</h3>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Auto-start next Pomo</span><div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in"><input type="checkbox" checked={tempSettings.autoStartNextPomo} onChange={e => handleSettingChange('autoStartNextPomo', e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-5"/><div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${tempSettings.autoStartNextPomo ? 'bg-blue-600' : 'bg-gray-600'}`}></div></div></div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Auto-start Break</span><div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in"><input type="checkbox" checked={tempSettings.autoStartBreak} onChange={e => handleSettingChange('autoStartBreak', e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-5"/><div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${tempSettings.autoStartBreak ? 'bg-blue-600' : 'bg-gray-600'}`}></div></div></div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Focus Mode (Auto DND)</span><div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in"><input type="checkbox" checked={(tempSettings as any).focusMode ?? true} onChange={e => handleSettingChange('focusMode' as any, e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-5"/><div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${(tempSettings as any).focusMode ?? true ? 'bg-blue-600' : 'bg-gray-600'}`}></div></div></div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Auto-minimize on Start</span><div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in"><input type="checkbox" checked={(tempSettings as any).autoMinimize ?? false} onChange={e => handleSettingChange('autoMinimize' as any, e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-5"/><div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${(tempSettings as any).autoMinimize ?? false ? 'bg-blue-600' : 'bg-gray-600'}`}></div></div></div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Work Presets</h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(tempSettings.quickDurations || []).map(d => (
                                    <span key={d} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold flex items-center gap-1">
                                        {d}m <button onClick={() => removePreset('work', d)} className="hover:text-white">×</button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2"><input type="number" value={newPresetWork} onChange={e => setNewPresetWork(e.target.value)} placeholder="Add min..." className="w-full bg-[#2c2c2e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none border border-white/10" onKeyDown={e => e.key === 'Enter' && addPreset('work')} /><button onClick={() => addPreset('work')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">Add</button></div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Rest Presets</h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(tempSettings.shortBreakPresets || []).map(d => (
                                    <span key={d} className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold flex items-center gap-1">
                                        {d}m <button onClick={() => removePreset('rest', d)} className="hover:text-white">×</button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2"><input type="number" value={newPresetRest} onChange={e => setNewPresetRest(e.target.value)} placeholder="Add min..." className="w-full bg-[#2c2c2e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none border border-white/10" onKeyDown={e => e.key === 'Enter' && addPreset('rest')} /><button onClick={() => addPreset('rest')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold">Add</button></div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Features</h3>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"><span className="text-sm font-medium text-gray-300">Enable Ghost Mode Button</span><div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in"><input type="checkbox" checked={enableGhostButton} onChange={e => toggleGhostButtonSetting(e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-5"/><div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${enableGhostButton ? 'bg-blue-600' : 'bg-gray-600'}`}></div></div></div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isAddSessionOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
                <div className="bg-[#1c1c1e] w-[450px] rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col text-white animate-scale-in">
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold text-lg">Add Session</h3><button onClick={() => setIsAddSessionOpen(false)} className="text-gray-400 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                    <div className="p-6 space-y-4">
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Project</label><select value={manualProject} onChange={(e) => setManualProject(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">{projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Description</label><input type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Design Review" className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Date</label><input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"/></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Time</label><input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Duration (Min)</label><input type="number" value={manualDuration} onChange={e => setManualDuration(parseInt(e.target.value))} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Type</label><div className="flex bg-[#2c2c2e] rounded-lg p-1 border border-white/10"><button onClick={() => setManualType('POMO')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${manualType === 'POMO' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Pomo</button><button onClick={() => setManualType('STOPWATCH')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${manualType === 'STOPWATCH' ? 'bg-orange-600 text-white' : 'text-gray-400'}`}>Stop</button></div></div>
                        </div>
                    </div>
                    <div className="p-6 border-t border-white/10"><button onClick={() => { (async () => await handleSaveManualSession())(); }} className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-lg">Save Session</button></div>
                </div>
            </div>
        )}

        {isProjectSelectorOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4" onClick={() => setIsProjectSelectorOpen(false)}>
                <div className={`w-[350px] rounded-2xl shadow-2xl border flex flex-col animate-scale-in max-h-[60vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]/50 text-[#00f0ff]' : 'bg-[#1c1c1e] border-gray-700/50 text-white'}`} onClick={e => e.stopPropagation()}>
                    <div className={`px-4 py-3 border-b font-bold ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-white/10'}`}>Select Project</div>
                    <div className="p-2 overflow-y-auto custom-scrollbar">
                        <button onClick={() => { setSelectedProjectId('all'); setIsProjectSelectorOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedProjectId === 'all' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-600') : (isCyberpunk ? 'hover:bg-[#00f0ff]/10' : 'hover:bg-white/5')}`}>All Projects</button>
                        <button onClick={() => { setSelectedProjectId(''); setIsProjectSelectorOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedProjectId === '' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-600') : (isCyberpunk ? 'hover:bg-[#00f0ff]/10' : 'hover:bg-white/5')}`}>No Project</button>
                        <div className={`h-px my-1 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-white/10'}`}></div>
                        {projects.map(p => (
                            <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setIsProjectSelectorOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${selectedProjectId === p.id ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-600') : (isCyberpunk ? 'hover:bg-[#00f0ff]/10' : 'hover:bg-white/5')}`}>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {isTaskSelectorOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4" onClick={() => setIsTaskSelectorOpen(false)}>
                <div className={`w-[350px] rounded-2xl shadow-2xl border flex flex-col animate-scale-in max-h-[60vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]/50 text-[#00f0ff]' : 'bg-[#1c1c1e] border-gray-700/50 text-white'}`} onClick={e => e.stopPropagation()}>
                    <div className={`px-4 py-3 border-b font-bold ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-white/10'}`}>Select Task</div>
                    <div className="p-2 overflow-y-auto custom-scrollbar">
                        <button onClick={() => { setSelectedTaskId(''); setSessionLabel(''); setIsTaskSelectorOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedTaskId === '' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-600') : (isCyberpunk ? 'hover:bg-[#00f0ff]/10' : 'hover:bg-white/5')}`}>No Task</button>
                        <div className={`h-px my-1 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-white/10'}`}></div>
                        {activeTasks.length === 0 ? (
                            <div className="px-3 py-2 text-sm opacity-50">No active tasks found.</div>
                        ) : (
                            activeTasks.map(t => (
                                <button key={t.id} onClick={() => { setSelectedTaskId(t.id); setSessionLabel(t.title); setIsTaskSelectorOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${selectedTaskId === t.id ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-600') : (isCyberpunk ? 'hover:bg-[#00f0ff]/10' : 'hover:bg-white/5')}`}>
                                    {t.title}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {isEditModalOpen && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
                 <div className="bg-[#1c1c1e] w-[450px] rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col text-white animate-scale-in">
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold text-lg">Edit Session</h3><button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                    <div className="p-6 space-y-4">
                         <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Project</label><select value={editProject} onChange={(e) => setEditProject(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                         <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Label</label><input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
                    </div>
                    <div className="p-6 border-t border-white/10 flex gap-3"><button onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-transparent border border-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/5 transition-colors">Cancel</button><button onClick={() => { (async () => await handleSaveEdit())(); }} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg">Save</button></div>
                 </div>
             </div>
        )}
        <div className={`flex-1 flex flex-col items-center justify-center p-4 md:p-8 md:pb-32 md:pl-24 relative transition-colors duration-300 group ${isCyberpunk ? 'bg-radial-cyber' : 'bg-radial-light dark:bg-radial-dark'}`}>
             <div className="flex flex-col items-center justify-center w-full max-w-xl z-10">
                 
                 <div className="flex flex-col items-center w-full mb-6 min-h-[24px] z-20">
                     {selectedProjectId && currentProjectName && (
                         <div className={`flex items-center gap-3 px-5 py-2 rounded-full border backdrop-blur-md animate-fade-in-down shadow-lg mb-2 ${isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'bg-white/10 border-white/20 text-white shadow-black/10'}`}>
                             <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                             <span className="text-sm font-bold tracking-wide">{currentProjectName}</span>
                             <button 
                                 onClick={() => setSelectedProjectId('')} 
                                 className={`ml-1 p-1 rounded-full transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-white/20'}`}
                                 title="Clear Project"
                             >
                                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                     )}
                     
                     {selectedProjectId && currentProjectName && selectedTaskId && currentTaskTitle && (
                         <div className={`w-px h-3 mb-2 ${isCyberpunk ? 'bg-[#00f0ff]/30' : 'bg-white/20'}`}></div>
                     )}
                     
                     {selectedTaskId && currentTaskTitle && (
                         <div className={`flex items-center gap-3 px-5 py-2 rounded-full border backdrop-blur-md animate-fade-in-down shadow-lg ${isCyberpunk ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'bg-white/10 border-white/20 text-white shadow-black/10'}`}>
                             <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {tasks.find(t => t.id === selectedTaskId)?.tickTickId && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${isCyberpunk ? 'bg-[#00f0ff]/20 border-[#00f0ff]/40 text-[#00f0ff]' : 'bg-blue-500/20 border-blue-400/30 text-blue-300'}`} title="Synced from TickTick">TT</span>
                                )}
                             </div>
                             <span className="text-sm font-bold tracking-wide max-w-[200px] truncate">{currentTaskTitle}</span>
                             <button 
                                 onClick={() => setSelectedTaskId('')} 
                                 className={`ml-1 p-1 rounded-full transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-white/20'}`}
                                 title="Clear Task"
                             >
                                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                     )}
                 </div>

                 <TimerModeTabs
                    mode={mode}
                    onModeSwitch={switchMode}
                    isCyberpunk={isCyberpunk}
                />
                 
                 <div className="relative flex justify-center items-center w-full max-w-[300px] md:max-w-[520px] aspect-square mx-auto mb-4 md:mb-8">
                    {isActive && (
                        <div className={`absolute -inset-4 rounded-full blur-3xl animate-pulse transition-all duration-1000 pointer-events-none ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-blue-500/20 dark:bg-blue-400/10'}`}></div>
                    )}
                     <TimerDisplay 
                        timeLeft={timeLeft}
                        initialTime={initialTime}
                        mode={mode}
                        phase={phase}
                        isActive={isActive}
                        isCyberpunk={isCyberpunk}
                        formatTime={formatTime}
                     />
                 </div>

                 <TimerActionButtons
                    isActive={isActive}
                    mode={mode}
                    phase={phase}
                    timeLeft={timeLeft}
                    onToggle={toggleTimer}
                    onReset={resetTimer}
                    onStopwatchFinish={() => { (async () => await handleStopwatchFinish())(); }}
                    isCyberpunk={isCyberpunk}
                />
             </div>

            <ControlDock 
                isActive={isActive}
                isCyberpunk={isCyberpunk}
                wager={wager}
                isWagerActive={isWagerActive}
                currentGems={currentGems}
                sessionLabel={sessionLabel}
                setSessionLabel={setSessionLabel}
                onWagerLock={setWager}
                onSettingsOpen={openSettings}
                onSidebarToggle={() => setShowSidebar(!showSidebar)}
                onProjectSelectOpen={() => setIsProjectSelectorOpen(true)}
                onTaskSelectOpen={() => setIsTaskSelectorOpen(true)}
                isProjectSelectorOpen={isProjectSelectorOpen}
                isTaskSelectorOpen={isTaskSelectorOpen}
                settings={settings}
                workDuration={workDuration}
                onWorkDurationChange={handleWorkDurationChange}
                restDuration={restDuration}
                onRestDurationChange={handleRestDurationChange}
                initialTime={initialTime}
                handleToggleGhostMode={handleToggleGhostMode}
                enableGhostButton={enableGhostButton}
                showSidebar={showSidebar}
                selectedProjectId={selectedProjectId}
                selectedTaskId={selectedTaskId}
            />
        </div>

        <div className={`${isCyberpunk ? 'bg-[#020202] border-[#00f0ff]/20' : 'bg-[#151516] border-gray-800'} border-l flex flex-col overflow-hidden transition-all duration-300 absolute md:relative right-0 h-full z-30 shadow-2xl md:shadow-none ${showSidebar ? 'w-[320px] md:w-[360px] translate-x-0' : 'w-0 translate-x-full md:translate-x-0 md:w-0'}`}>
             <div className="p-6 h-full flex flex-col w-[320px] md:w-[360px]"> 
                <div className="mb-8 shrink-0">
                    <h3 className={`${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400'} font-bold text-[10px] uppercase tracking-wider mb-4`}>Today's Overview</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-[#1c1c1e] border-gray-800'} p-4 rounded-xl border`}><div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Sessions</div><div className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{stats.todayPomos}</div></div>
                        <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-[#1c1c1e] border-gray-800'} p-4 rounded-xl border`}><div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Focus Time</div><div className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{stats.todayFocus} <span className={`text-sm font-medium ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>min</span></div></div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="flex justify-between items-center mb-4 shrink-0 relative"><h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Session History</h3><div className="flex items-center space-x-3"><button onClick={() => setIsAddSessionOpen(true)} className="text-gray-400 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button><div className="relative" ref={historyMenuRef}><button onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)} className="text-gray-400 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg></button>{isHistoryMenuOpen && (<div className="absolute right-0 top-full mt-2 w-48 bg-[#2c2c2e] border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">{selectedSessionIds.size > 0 && (<><button onClick={openEditBatch} className="w-full text-left px-4 py-2.5 text-xs font-medium text-white hover:bg-white/5 transition-colors border-b border-gray-700">Edit Selected ({selectedSessionIds.size})</button><button onClick={() => { (async () => await handleDeleteSelected())(); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border-b border-gray-700">Delete Selected ({selectedSessionIds.size})</button></>)}<button onClick={() => { (async () => await handleClearHistory())(); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">Clear All History</button></div>)}</div></div></div>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {historyGroups.length === 0 ? (<div className="flex flex-col items-center justify-center h-48 text-gray-600 text-xs"><span className="mb-2 opacity-50">No sessions recorded</span></div>) : (<div className="space-y-6 pb-4">{historyGroups.map((group: { dateLabel: string; sessions: SessionRecord[] }) => { const allIds = group.sessions.map((s: SessionRecord) => s.id); const isAllSelected = allIds.every((id: string) => selectedSessionIds.has(id)); return (<div key={group.dateLabel}><div className="flex items-center mb-3"><button onClick={() => toggleGroupSelection(group.sessions)} className={`w-3 h-3 rounded-sm mr-2 flex items-center justify-center transition-colors ${isAllSelected ? 'bg-blue-600 border-blue-600' : 'border border-gray-600 hover:border-gray-400'}`}>{isAllSelected && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}</button><span className="text-[10px] font-bold text-gray-500 tracking-wider">{group.dateLabel}</span></div><div className="space-y-4 border-l border-gray-800 ml-[5.5px] pl-4 relative">{group.sessions.map((session: SessionRecord) => { const projectName = projects.find((p: Project) => p.id === session.projectId)?.name || 'Main Project'; const isSelected = selectedSessionIds.has(session.id); return (<div key={session.id} className="relative group"><div className={`absolute -left-[21px] top-1.5 w-1.5 h-1.5 rounded-full transition-colors ring-4 ring-[#151516] ${isSelected ? 'bg-blue-500' : 'bg-gray-600 group-hover:bg-white'}`}></div><div className="flex justify-between items-start"><div className="min-w-0 pr-2"><div className={`text-sm font-bold mb-0.5 truncate transition-colors ${isSelected ? 'text-blue-400' : 'text-white'}`}>{session.label || 'Session'}</div><div className="text-[10px] text-gray-500 flex items-center gap-1 flex-wrap"><span className={session.type === 'POMO' ? 'text-blue-400' : 'text-orange-400'}>{Math.round(session.duration/60)}min</span><span className="text-gray-600">&middot;</span><span>{projectName}</span></div></div><div className="text-sm text-gray-400 font-mono pl-2">{new Date(session.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div><div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"><button onClick={() => openEditSingle(session)} className="p-1 text-gray-500 hover:text-white rounded-md transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg></button></div></div>);
                        })}</div></div>);
                        })}</div>)}
                    </div>
                </div>
             </div>
        </div>

        {wagerWinAmount !== null && (
            <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in pointer-events-none">
                <div className="text-9xl mb-6 animate-bounce filter drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]">💎</div>
                <h2 className={`text-7xl font-black mb-4 animate-pulse ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_30px_rgba(0,240,255,0.8)]' : 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-2xl'}`}>
                    +{wagerWinAmount}
                </h2>
                <p className={`text-2xl font-bold uppercase tracking-[0.5em] ${isCyberpunk ? 'text-[#00f0ff]/80' : 'text-white/90'}`}>
                    Wager Won
                </p>
            </div>
        )}
    </div>
  );
};