import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as storage from '../services/storageService';
import { TimerSettings, SessionRecord, Project, MenuBarConfig, Transaction, Task } from '../types';
import { playAlarm } from '../services/audioService';
import { useTheme } from '../AppContext';
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
    // Optional prop to force ghost mode style if passed from parent (though we use URL param mostly)
    isGhostMode?: boolean;
}

type TimerMode = 'POMO' | 'STOPWATCH';
type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

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
  
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [settings, setSettings] = useState<TimerSettings>({ pomoDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, pomosPerLongBreak: 4, autoStartNextPomo: false, autoStartBreak: false, quickDurations: [15, 25, 30, 45, 60, 90], shortBreakPresets: [5, 10, 15, 20, 30] });
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [pomosCompleted, setPomosCompleted] = useState(0); 
  const [workDuration, setWorkDuration] = useState(25);
  const [restDuration, setRestDuration] = useState(5);

  // Ghost Mode State
  const [isGhostMode, setIsGhostMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'ghost');
  const [enableGhostButton, setEnableGhostButton] = useState(() => localStorage.getItem('focusflow_enable_ghost_btn') !== 'false');
  const [isPinned, setIsPinned] = useState(true);

  // Wager State
  const [wager, setWager] = useState(0);
  const [isWagerActive, setIsWagerActive] = useState(false);
  const [wagerAmount, setWagerAmount] = useState(50);
  const [isWagerMenuOpen, setIsWagerMenuOpen] = useState(false);
  const [wagerWinAmount, setWagerWinAmount] = useState<number | null>(null);

  // Dock Visibility
  const [isDockVisible, setIsDockVisible] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isInteractingWithWheel, setIsInteractingWithWheel] = useState(false);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const endInteraction = () => setIsInteractingWithWheel(false);
      window.addEventListener('mouseup', endInteraction);
      window.addEventListener('touchend', endInteraction);
      return () => {
          window.removeEventListener('mouseup', endInteraction);
          window.removeEventListener('touchend', endInteraction);
      };
  }, []);

  useEffect(() => {
      let timeout: NodeJS.Timeout;
      const handleMouseMove = (e: MouseEvent) => {
          if (!containerRef.current) return;
          
          if (isInteractingWithWheel) {
              setIsDockVisible(true);
              clearTimeout(timeout);
              return;
          }

          const rect = containerRef.current.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const threshold = rect.width * 0.25;

          if (relativeX >= 0 && relativeX < threshold) {
              setIsDockVisible(true);
              clearTimeout(timeout);
          } else {
              clearTimeout(timeout);
              if (!isWagerMenuOpen && !isProjectSelectorOpen && !isTaskSelectorOpen && !isNoteOpen) {
                  timeout = setTimeout(() => setIsDockVisible(false), 500);
              }
          }
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          clearTimeout(timeout);
      };
  }, [isInteractingWithWheel, isWagerMenuOpen, isProjectSelectorOpen, isTaskSelectorOpen, isNoteOpen]);

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

  const [newPresetWork, setNewPresetWork] = useState('');
  const [newPresetRest, setNewPresetRest] = useState('');
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
  const wagerMenuRef = useRef<HTMLDivElement>(null);
  const hasSynced = useRef(false);
  const isMounted = useRef(true);

  // State Ref to prevent stale closures in setInterval
  const stateRef = useRef({
        sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode, tasks
  });
  // Keep ref synchronized with state
    stateRef.current = { sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode, tasks };

  // Use gems from props
  const currentGems = propGems;

  const currentProjectName = selectedProjectId === 'all' ? 'All Projects' : projects.find(p => p.id === selectedProjectId)?.name;
  const currentTaskTitle = tasks.find(t => t.id === selectedTaskId)?.title;

  const maxWager = Math.min(500, Math.max(1, currentGems));

  const wagerSteps = useMemo(() => {
      const steps = [1, 5, 10, 25, 50, 100, 250, 500];
      const available = steps.filter(s => s <= currentGems);
      return available.length > 0 ? available : [0];
  }, [currentGems]);

  useEffect(() => {
      if (wagerAmount > maxWager) {
          setWagerAmount(maxWager);
      }
  }, [maxWager, wagerAmount]);

useEffect(() => {
      isMounted.current = true;
      return () => { isMounted.current = false; };
  }, []);

  // --- Power Save Blocker ---
  useEffect(() => {
      if (isActive) window.electronAPI?.preventAppSuspension?.(true);
      else window.electronAPI?.preventAppSuspension?.(false);
      return () => { window.electronAPI?.preventAppSuspension?.(false); };
  }, [isActive]);

  // --- Do Not Disturb ---
  useEffect(() => {
      const shouldDND = isActive && mode === 'POMO' && phase === 'FOCUS';
      window.electronAPI?.setDoNotDisturb?.(shouldDND);
      return () => { window.electronAPI?.setDoNotDisturb?.(false); };
  }, [isActive, mode, phase]);

  // --- Initialization ---
  useEffect(() => {
      const initTimer = setTimeout(async () => {
          const [sSessions, sSettings, sTasks] = await Promise.all([storage.getSessions(), storage.getTimerSettings(), storage.getTasks()]);
          if (isMounted.current) {
              setSessions(sSessions);
              setSettings({
                  ...sSettings,
                  quickDurations: sSettings.quickDurations && sSettings.quickDurations.length > 0 ? sSettings.quickDurations : [15, 25, 30, 45, 60, 90],
                  shortBreakPresets: sSettings.shortBreakPresets && sSettings.shortBreakPresets.length > 0 ? sSettings.shortBreakPresets : [5, 10, 15, 20, 30]
              });
              setWorkDuration(sSettings.pomoDuration);
              setRestDuration(sSettings.shortBreakDuration);

              // Restore Timer State from LocalStorage (Robustness Fix)
              const savedEndTime = localStorage.getItem('focusflow_timer_end_time');
              const savedStartTime = localStorage.getItem('focusflow_timer_start_time');
              const savedMode = localStorage.getItem('focusflow_timer_mode');

              if (savedEndTime && savedMode === 'POMO') {
                  const end = parseInt(savedEndTime);
                  if (end > Date.now()) {
                      endTimeRef.current = end;
                      setMode('POMO');
                      setPhase((localStorage.getItem('focusflow_timer_phase') as TimerPhase) || 'FOCUS');
                      setSelectedProjectId(localStorage.getItem('focusflow_timer_project') || projectId);
                      setSelectedTaskId(localStorage.getItem('focusflow_timer_task') || '');
                      setSessionLabel(localStorage.getItem('focusflow_timer_label') || '');
                      setIsActive(true);
                      setTimeLeft(Math.ceil((end - Date.now()) / 1000));
                  } else {
                      localStorage.removeItem('focusflow_timer_end_time');
                  }
              } else if (savedStartTime && savedMode === 'STOPWATCH') {
                  const start = parseInt(savedStartTime);
                  startTimeRef.current = start;
                  setMode('STOPWATCH');
                  setSelectedProjectId(localStorage.getItem('focusflow_timer_project') || projectId);
                  setSelectedTaskId(localStorage.getItem('focusflow_timer_task') || '');
                  setSessionLabel(localStorage.getItem('focusflow_timer_label') || '');
                  setIsActive(true);
                  setTimeLeft(Math.floor((Date.now() - start) / 1000));
              } else if (!isGhostMode && !hasSynced.current) {
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
          if (wagerMenuRef.current && !wagerMenuRef.current.contains(event.target as Node)) {
              setIsWagerMenuOpen(false);
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

  // --- Sync State (Ghost Mode) ---
  useEffect(() => {
      if (window.electronAPI?.onSyncTimerState) {
          const cleanup = window.electronAPI.onSyncTimerState((state: any) => {
              hasSynced.current = true;
              if (state.timeLeft !== undefined) setTimeLeft(state.timeLeft);
              if (state.initialTime !== undefined) setInitialTime(state.initialTime);
              if (state.isActive !== undefined) setIsActive(state.isActive);
              if (state.mode !== undefined) setMode(state.mode);
              if (state.phase !== undefined) setPhase(state.phase);
              if (state.sessionLabel !== undefined) setSessionLabel(state.sessionLabel);
              if (state.selectedProjectId !== undefined) setSelectedProjectId(state.selectedProjectId);
              
              // Synchronize Timer Engine Refs to prevent drift/desync
              if (state.isActive) {
                  const targetMode = state.mode || 'POMO';
                  if (targetMode === 'POMO') {
                      const durationMS = (state.timeLeft || 0) * 1000;
                      endTimeRef.current = Date.now() + durationMS;
                      startTimeRef.current = null;
                  } else {
                      const elapsedMS = (state.timeLeft || 0) * 1000;
                      startTimeRef.current = Date.now() - elapsedMS;
                      endTimeRef.current = null;
                  }
              } else {
                  endTimeRef.current = null;
                  startTimeRef.current = null;
              }

              // Restart timer interval if it was active
              if (state.isActive) setIsActive(true);
          });

          if (window.electronAPI.getTimerState) {
              window.electronAPI.getTimerState();
          }

          return cleanup;
      }
  }, []);

  // Update selected project if prop changes
  useEffect(() => {
      if (!isActive) {
          setSelectedProjectId(projectId);
          setSelectedTaskId('');
          setSessionLabel('');
      }
      setManualProject(projectId);
  }, [projectId]);

  // Handle Quick Start from Tray
  useEffect(() => {
      if (externalStart && externalStart.duration > 0) {
          setMode('POMO');
          setPhase('FOCUS');
          const seconds = externalStart.duration * 60;
          setInitialTime(seconds);
          setTimeLeft(seconds);
          setIsActive(true);
          setSessionLabel('Quick Focus Session');
          if (onConsumeExternalStart) onConsumeExternalStart();
      }
  }, [externalStart, onConsumeExternalStart]);

  // Tray Title Update
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

  // --- Timer Engine ---
  useEffect(() => {
    if (isActive) {
      if (mode === 'POMO') {
          if (!endTimeRef.current) {
              const durationMS = timeLeft * 1000;
              endTimeRef.current = Date.now() + durationMS;
          }
          // Persist State
          localStorage.setItem('focusflow_timer_end_time', endTimeRef.current.toString());
          localStorage.setItem('focusflow_timer_mode', 'POMO');
          localStorage.setItem('focusflow_timer_phase', phase);
          localStorage.setItem('focusflow_timer_project', selectedProjectId);
          localStorage.setItem('focusflow_timer_task', selectedTaskId);
          localStorage.setItem('focusflow_timer_label', sessionLabel);
      } else {
          if (!startTimeRef.current) {
              const elapsedMS = timeLeft * 1000;
              startTimeRef.current = Date.now() - elapsedMS;
          }
          // Persist State
          localStorage.setItem('focusflow_timer_start_time', startTimeRef.current.toString());
          localStorage.setItem('focusflow_timer_mode', 'STOPWATCH');
          localStorage.setItem('focusflow_timer_project', selectedProjectId);
          localStorage.setItem('focusflow_timer_task', selectedTaskId);
          localStorage.setItem('focusflow_timer_label', sessionLabel);
      }

      timerRef.current = setInterval(() => {
        if (mode === 'POMO') {
            if (endTimeRef.current) {
                const now = Date.now();
                const diff = Math.ceil((endTimeRef.current - now) / 1000);
                if (diff <= 0) {
                    setTimeLeft(0);
                    handleTimerComplete();
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
        // Clear persistence
        localStorage.removeItem('focusflow_timer_end_time');
        localStorage.removeItem('focusflow_timer_start_time');
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, mode, phase, selectedProjectId, selectedTaskId, sessionLabel]);

const handleTimerComplete = async () => {
      // READ LATEST DATA FROM REF (Fixing stale closure)
      const currentData = stateRef.current;
      
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      endTimeRef.current = null;
      localStorage.removeItem('focusflow_timer_end_time');
      triggerAlarm();
      
      if (isGhostMode) {
          window.electronAPI?.playSoundEffect?.();
      }

      if (Notification.permission === "granted") {
          new Notification("Timer Finished!", {
              body: currentData.sessionLabel || "Focus session complete.",
              silent: false 
          });
      }

      // Handle Wager Win
      if (currentData.isWagerActive && currentData.wager > 0) {
          const durationInMinutes = currentData.initialTime / 60;
          const multiplier = 1 + (durationInMinutes / 120);
          const reward = Math.floor(currentData.wager * multiplier);
          const type = multiplier >= 2 ? ' (Double!)' : multiplier >= 1.5 ? ' (Solid)' : '';

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
      setIsActive(false);
      setMode(newMode);
      endTimeRef.current = null;
      startTimeRef.current = null;
      setWager(0); 
      
      if (newMode === 'POMO') {
          setPhase('FOCUS');
          const duration = settings.pomoDuration * 60;
          setInitialTime(duration);
          setTimeLeft(duration);
      } else {
          setInitialTime(0);
          setTimeLeft(0);
      }
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
      setIsActive(false);
      endTimeRef.current = null;
      startTimeRef.current = null;
      
      if (isWagerActive) {
          alert("Wager Lost! You stopped the timer early.");
          setIsWagerActive(false);
          setWager(0);
      }

      if (mode === 'POMO') {
          let duration = settings.pomoDuration * 60;
          if (phase === 'SHORT_BREAK') duration = settings.shortBreakDuration * 60;
          if (phase === 'LONG_BREAK') duration = settings.longBreakDuration * 60;
          setTimeLeft(duration);
          setInitialTime(duration);
      } else {
          setTimeLeft(0);
          setInitialTime(0);
      }
  };

  const toggleTimer = () => {
      if (!isActive) {
          if (wager > 0) {
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
      }
      setIsActive(!isActive);
  };

  const handleToggleGhostMode = () => {
      const state = {
          timeLeft,
          initialTime,
          isActive,
          mode,
          phase,
          sessionLabel,
          selectedProjectId
      };
      window.electronAPI?.toggleGhostMode(state);
  };

  const togglePin = () => {
      const newState = !isPinned;
      setIsPinned(newState);
      window.electronAPI?.setAlwaysOnTop(newState);
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
      // Note: We don't auto-update timeLeft for breaks here to avoid disrupting flow, unless explicitly needed.
  };

  const handleLockInBet = () => {
      setWager(wagerAmount);
      setIsWagerMenuOpen(false);
  };

  const triggerAlarm = () => { 
      const savedVol = localStorage.getItem('focusflow_timer_volume');
      const vol = savedVol ? parseFloat(savedVol) : 0.5;
      playAlarm(vol);
  };
  
  const formatTime = (seconds: number) => { 
      const m = Math.floor(seconds / 60); 
      const s = seconds % 60; 
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; 
  };
// --- Settings Logic ---
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
  
  // --- Add Session Logic ---
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

  // --- Editing Logic ---
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
// --- History Management ---
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

  // --- Stats & Groups ---
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

  // Filter tasks for current project
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

  // --- Visuals ---
  const radius = 95; 
  const circumference = 2 * Math.PI * radius;
  let progress = 0;
  if (mode === 'POMO') {
      progress = initialTime > 0 ? (initialTime - timeLeft) / initialTime : 0;
  } else {
      progress = (timeLeft % 60) / 60;
  }
  const dashOffset = circumference * (1 - progress);
  const isUrgent = mode === 'POMO' && initialTime > 0 && (timeLeft / initialTime) <= 0.15;
  const themeColor = mode === 'STOPWATCH' ? 'text-orange-500' : isUrgent ? 'text-red-500' : phase === 'FOCUS' ? 'text-blue-500' : 'text-green-500';
  const shouldAnimate = progress !== 0;

  const isCyberpunk = appTheme === 'cyberpunk';

  // --- GHOST MODE RENDER ---
  if (isGhostMode) {
      const ghostRadius = 70; 
      const ghostCircumference = 2 * Math.PI * ghostRadius;
      const ghostDashOffset = ghostCircumference * (1 - progress);

      return (
          <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-transparent" style={{ WebkitAppRegion: 'drag' } as any}>
              
              {/* Window Controls - Visible on Hover */}
              <div className="absolute top-0 left-0 w-full p-3 flex justify-between opacity-0 hover:opacity-100 transition-opacity duration-300 z-50" style={{ WebkitAppRegion: 'no-drag' } as any}>
                  <button 
                      onClick={togglePin}
                      className={`p-2 rounded-full transition-all hover:scale-110 backdrop-blur-md ${isCyberpunk ? 'text-[#00f0ff] bg-black/60 hover:bg-[#00f0ff]/20' : 'text-white bg-black/20 hover:bg-black/40'}`}
                      title={isPinned ? "Unpin" : "Pin"}
                  >
                      <svg className="w-4 h-4" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  </button>
                  <button 
                      onClick={handleToggleGhostMode}
                      className={`p-2 rounded-full transition-all hover:scale-110 backdrop-blur-md ${isCyberpunk ? 'text-[#00f0ff] bg-black/60 hover:bg-[#00f0ff]/20' : 'text-white bg-black/20 hover:bg-black/40'}`}
                      title="Exit"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                  </button>
              </div>

              {/* Floating Timer Ring */}
              <div className="relative group">
                  {/* Ambient Glow */}
                  <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${isActive ? 'animate-pulse' : ''} ${isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-500'}`} style={{ transform: 'scale(0.85)' }}></div>

                  <svg className="w-[160px] h-[160px] transform -rotate-90 drop-shadow-2xl">
                      {/* Track */}
                      <circle cx="80" cy="80" r={ghostRadius} className={isCyberpunk ? "stroke-[#00f0ff]/10" : "stroke-white/10"} strokeWidth="8" fill="transparent" />
                      {/* Progress */}
                      <circle 
                        cx="80" cy="80" r={ghostRadius} 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        fill="transparent" 
                        strokeDasharray={ghostCircumference} 
                        strokeDashoffset={ghostDashOffset} 
                        strokeLinecap="round" 
                        className={`transition-all duration-1000 ease-linear ${isCyberpunk ? 'text-[#00f0ff]' : (isActive ? 'text-white' : 'text-white/50')}`}
                        style={{ filter: isCyberpunk ? 'drop-shadow(0 0 10px #00f0ff)' : 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' }}
                      />
                  </svg>
                  
                  {/* Center Time Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <div className={`text-5xl font-black tracking-tighter tabular-nums select-none ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.8)]' : 'text-white drop-shadow-lg'}`}>
                          {formatTime(timeLeft)}
                      </div>
                      
                      {/* Play/Pause Controls (Visible on Hover) */}
                      <div className="absolute bottom-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ WebkitAppRegion: 'no-drag' } as any}>
                          <button onClick={toggleTimer} className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg ${isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-white text-black'}`}>
                              {isActive ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                          </button>
                          <button onClick={resetTimer} className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${isCyberpunk ? 'bg-black/60 text-[#00f0ff]' : 'bg-black/40 text-white'}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

return (
    <div ref={containerRef} className={`flex h-full w-full overflow-hidden relative transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white'}`}>
        
        {/* Dock Hover Indicator */}
        <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1.5 h-32 rounded-r-full transition-all duration-500 pointer-events-none z-40 ${isDockVisible ? 'opacity-0 -translate-x-full' : 'opacity-100 translate-x-0'} ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_15px_#00f0ff]' : 'bg-white/40 shadow-[0_0_15px_rgba(255,255,255,0.4)]'}`}></div>

        {/* --- SETTINGS MODAL --- */}
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

        {/* --- ADD SESSION MODAL --- */}
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
                    <div className="p-6 border-t border-white/10"><button onClick={handleSaveManualSession} className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-lg">Save Session</button></div>
                </div>
            </div>
        )}

        {/* --- PROJECT SELECTOR MODAL --- */}
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

        {/* --- TASK SELECTOR MODAL --- */}
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

        {/* --- EDIT MODAL --- */}
        {isEditModalOpen && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
                 <div className="bg-[#1c1c1e] w-[450px] rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col text-white animate-scale-in">
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold text-lg">Edit Session</h3><button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                    <div className="p-6 space-y-4">
                         <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Project</label><select value={editProject} onChange={(e) => setEditProject(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                         <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Label</label><input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
                    </div>
                    <div className="p-6 border-t border-white/10 flex gap-3"><button onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-transparent border border-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/5 transition-colors">Cancel</button><button onClick={handleSaveEdit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg">Save</button></div>
                 </div>
             </div>
        )}
{/* LEFT COLUMN: Timer Display */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 pb-32 pl-24 relative transition-colors duration-300 group">
             {/* Main Content Centered */}
             <div className="flex flex-col items-center justify-center w-full max-w-xl z-10">
                 
                 {/* Selected Context Info */}
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

                 {/* Mode Tabs */}
                 <div className={`flex p-1.5 rounded-2xl mb-10 ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
                     <button onClick={() => switchMode('POMO')} className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'POMO' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200')}`}>Pomodoro</button>
                     <button onClick={() => switchMode('STOPWATCH')} className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'STOPWATCH' ? (isCyberpunk ? 'bg-[#f0f]/20 text-[#f0f] shadow-[0_0_10px_rgba(255,0,255,0.3)]' : 'bg-white dark:bg-gray-700 text-orange-500 dark:text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200')}`}>Stopwatch</button>
                 </div>

                 {/* Timer Circle - Responsive */}
                 <div className="relative w-full max-w-[380px] aspect-square flex items-center justify-center mb-4 group">
                     <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                         <defs>
                             <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={isCyberpunk ? "#00f0ff" : "#60A5FA"} /><stop offset="100%" stopColor={isCyberpunk ? "#0099ff" : "#3B82F6"} /></linearGradient>
                             <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#34D399" /><stop offset="100%" stopColor="#10B981" /></linearGradient>
                             <linearGradient id="stopwatchGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FBBF24" /><stop offset="100%" stopColor="#F59E0B" /></linearGradient>
                             <linearGradient id="urgentGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={isCyberpunk ? "#ff0055" : "#F87171"} /><stop offset="100%" stopColor={isCyberpunk ? "#ff0000" : "#EF4444"} /></linearGradient>
                             <filter id="cyberGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="coloredBlur" in="SourceGraphic" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                             <filter id="pinkGlow" x="-50%" y="-50%" width="200%" height="200%">
                                 <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                                 <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -5" result="goo" />
                                 <feBlend in="SourceGraphic" in2="goo" />
                             </filter>
                         </defs>
                         
                         {/* Background Track */}
                         <circle cx="100" cy="100" r={radius} className={isCyberpunk ? 'stroke-gray-800' : 'stroke-gray-200 dark:stroke-gray-800'} strokeWidth="3" fill="transparent" strokeDasharray="4 4" />

                        {/* Tick Marks */}
                        {Array.from({ length: 12 }).map((_, i) => {
                            const angle = (i / 12) * 2 * Math.PI;
                            const x1 = 100 + Math.cos(angle) * (radius - 4);
                            const y1 = 100 + Math.sin(angle) * (radius - 4);
                            const x2 = 100 + Math.cos(angle) * (radius + 4);
                            const y2 = 100 + Math.sin(angle) * (radius + 4);
                            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={isCyberpunk ? 'stroke-[#00f0ff]/20' : 'stroke-gray-300 dark:stroke-gray-700'} strokeWidth="1.5" />;
                        })}

                         {/* Progress Circle */}
                         <circle cx="100" cy="100" r={radius} stroke={`url(#${isUrgent ? 'urgentGradient' : mode === 'POMO' ? (phase === 'FOCUS' ? 'focusGradient' : 'breakGradient') : 'stopwatchGradient'})`} strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" className={`${shouldAnimate ? 'transition-all duration-1000 ease-linear' : ''}`} style={{ filter: isCyberpunk ? (isUrgent ? 'url(#pinkGlow)' : 'url(#cyberGlow)') : `drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))` }}/>
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                         <div className={`text-7xl md:text-8xl font-black tracking-tighter tabular-nums select-none transition-colors duration-300 ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.6)]' : themeColor} drop-shadow-sm`}>{formatTime(timeLeft)}</div>
                         <div className={`mt-2 text-sm font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400 dark:text-gray-500'}`}>{mode === 'POMO' ? (phase === 'FOCUS' ? 'Focus' : phase === 'SHORT_BREAK' ? 'Short Break' : 'Long Break') : 'Stopwatch'}</div>
                     </div>
                 </div>

                 {/* Main Controls */}
                 <div className="flex items-center gap-6">
                     <button onClick={resetTimer} className={`p-4 rounded-full transition-all active:scale-95 shadow-sm hover:shadow-md ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'bg-gray-100 dark:bg-[#1c1c1e] hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                     </button>
                     <button onClick={toggleTimer} className={`h-24 w-24 rounded-full font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${isCyberpunk ? 'bg-black border-2 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:bg-[#00f0ff] hover:text-black' : (mode === 'STOPWATCH' ? 'bg-orange-500 hover:bg-orange-600' : (phase === 'FOCUS' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'))}`}>{isActive ? 
                        (<svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>) : 
                        (<svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>)}
                     </button>
                     {mode === 'STOPWATCH' && (isActive || timeLeft > 0) ? (<button onClick={handleStopwatchFinish} className="p-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-all active:scale-95" title="Save & Finish"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></button>) : <div className="w-14 h-14"></div>}
                 </div>
             </div>

            {/* NEW DOCK RIBBON */}
            <div className={`absolute left-6 top-1/2 transform -translate-y-1/2 w-16 h-auto min-h-[400px] py-6 bg-[#0a0a0a]/40 backdrop-blur-2xl border border-white/5 rounded-full flex flex-col items-center justify-between gap-6 shadow-2xl z-50 transition-all duration-500 ease-in-out hover:bg-[#0a0a0a]/60 ${(isDockVisible || isWagerMenuOpen || isProjectSelectorOpen || isTaskSelectorOpen || isNoteOpen) ? 'translate-x-0 opacity-100' : '-translate-x-40 opacity-0 pointer-events-none'}`}>
                
                {/* Top: Wager & Note */}
                <div className={`flex flex-col items-center gap-4 w-full pb-4 border-b ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-white/10'}`}>
                    <div className="relative" ref={wagerMenuRef}>
                        <button
                            onClick={() => setIsWagerMenuOpen(!isWagerMenuOpen)}
                            disabled={isActive}
                            className={`p-2 rounded-lg transition-all ${isActive ? 'opacity-50 cursor-not-allowed' : ''} ${isWagerActive || wager > 0 ? 'text-amber-400 bg-amber-400/10 shadow-[0_0_10px_rgba(251,191,36,0.2)]' : 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10'}`}
                            title="Wager"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        {isWagerMenuOpen && (
                            <div className="fixed left-24 top-0 w-16 h-full bg-[#050505]/95 backdrop-blur-3xl border border-amber-500/30 rounded-full shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)] flex flex-col items-center justify-between py-6 z-50 origin-left animate-in slide-in-from-left-4 fade-in duration-300">
                                
                                {/* Connection Line */}
                                <div className="absolute -left-8 top-[60px] w-8 h-[1px] bg-amber-500/50">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,1)]"></div>
                                </div>

                                {/* Top: Potential Win */}
                                <div className="flex flex-col items-center justify-center w-full h-24 border-b border-amber-500/20 mb-2 gap-1">
                                    <span className="font-mono text-[9px] text-green-400/60 tracking-[0.2em] uppercase rotate-180" style={{ writingMode: 'vertical-rl' }}>POTENTIAL WIN</span>
                                    <div className="font-mono font-bold text-lg text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] flex flex-col items-center">
                                        <span>{Math.floor(wagerAmount * (1 + (initialTime / 60) / 120))}</span>
                                        <span className="text-xs text-green-500/50">💎</span>
                                    </div>
                                </div>

                                {/* Middle: Vertical Ruler Slider */}
                                <div className="relative flex-1 w-full flex justify-center my-2 group">
                                    {/* Ruler Track Marks */}
                                    <div className="absolute inset-y-0 w-10 h-full bg-transparent flex justify-center pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                                        <div className="w-full h-full border-r border-amber-500/20"
                                            style={{
                                                backgroundImage: 'repeating-linear-gradient(to bottom, rgba(245,158,11,0.3) 0px, rgba(245,158,11,0.3) 1px, transparent 1px, transparent 10px)'
                                            }}
                                        ></div>
                                    </div>

                                    {/* Invisible Native Input */}
                                    <input
                                        type="range"
                                        min={1}
                                        max={maxWager}
                                        step={1}
                                        value={wagerAmount}
                                        onChange={(e) => setWagerAmount(parseInt(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                        style={{ WebkitAppearance: 'slider-vertical' }}
                                    />
                                    
                                    {/* Custom Thumb */}
                                    <div 
                                        className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-amber-500 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.8)] border-2 border-amber-100 pointer-events-none z-10 transition-transform duration-75 ease-out flex items-center justify-center"
                                        style={{ 
                                            bottom: `calc(${((wagerAmount - 1) / (maxWager - 1 || 1)) * 100}% - 16px)` 
                                        }}
                                    >
                                        <div className="w-2 h-2 bg-white/50 rounded-full blur-[1px]" />
                                    </div>
                                </div>

                                {/* Bottom: Bet Amount & Lock */}
                                <div className="flex flex-col items-center justify-center w-full h-32 border-t border-amber-500/20 pt-4 gap-4">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="font-mono text-[9px] text-amber-500/60 tracking-[0.2em] uppercase">BET</span>
                                        <span className="font-mono text-lg font-bold text-amber-400 drop-shadow-md">
                                            {wagerAmount}
                                        </span>
                                    </div>

                                    <button 
                                        onClick={handleLockInBet}
                                        className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group"
                                        title="Lock In Bet"
                                    >
                                        <svg className="w-5 h-5 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setIsNoteOpen(!isNoteOpen)}
                            className={`p-2 rounded-lg transition-colors ${isNoteOpen ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/20' : 'text-white bg-white/20') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10')}`} 
                            title={sessionLabel || "Add Note"}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {/* Sliding Note Panel */}
                        <div className={`absolute top-0 left-20 w-64 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl transition-all duration-300 origin-left ${isNoteOpen ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-4 scale-95 pointer-events-none'}`}>
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-400'}`}>Session Note</h4>
                            <textarea 
                                value={sessionLabel}
                                onChange={(e) => setSessionLabel(e.target.value)}
                                placeholder="What are you working on?"
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none h-20 ${isCyberpunk ? 'text-[#00f0ff] placeholder-[#00f0ff]/30' : 'text-white placeholder-gray-500'}`}
                                autoFocus={isNoteOpen}
                            />
                        </div>
                    </div>
                </div>

                {/* Middle: Time Wheels */}
                <div className="flex flex-col items-center justify-center gap-4 flex-1 w-full">
                    {/* Time Wheels */}
                    <div className="flex flex-col items-center gap-2">
                        <TimeWheel 
                            items={settings.quickDurations || [15, 25, 30, 45, 60, 90]} 
                            selectedValue={workDuration} 
                            onChange={handleWorkDurationChange} 
                            label="Focus"
                            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                            labelPosition="right"
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                            labelPosition="top"
                            className="w-14"
                            onInteractionStart={() => setIsInteractingWithWheel(true)}
                            activeTextColor={isCyberpunk ? "text-[#00f0ff]" : "text-blue-400"}
                        />
                        <TimeWheel 
                            items={settings.shortBreakPresets || [5, 10, 15, 20, 30]} 
                            selectedValue={restDuration} 
                            onChange={handleRestDurationChange} 
                            label="Rest"
                            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" /></svg>}
                            labelPosition="right"
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" /></svg>}
                            labelPosition="top"
                            onInteractionStart={() => setIsInteractingWithWheel(true)}
                            className="w-14" 
                            activeTextColor={isCyberpunk ? "text-[#00ff00]" : "text-green-400"} 
                        />
                    </div>
                </div>

                {/* Bottom: Controls */}
                <div className={`flex flex-col items-center gap-4 w-full pt-4 border-t ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-white/10'}`}>
                    <div className="relative group">
                        <button 
                            onClick={() => setIsProjectSelectorOpen(true)} 
                            disabled={isActive}
                            className={`p-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${isActive ? 'opacity-50 cursor-not-allowed' : (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-white/80 bg-white/5 hover:bg-white/10 hover:text-white hover:shadow-lg')} ${(!selectedProjectId || selectedProjectId === 'all') && !isActive ? 'animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </button>
                    </div>
                    
                    <div className="relative group">
                        <button 
                            onClick={() => setIsTaskSelectorOpen(true)} 
                            disabled={isActive}
                            className={`p-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${isActive ? 'opacity-50 cursor-not-allowed' : (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-white/80 bg-white/5 hover:bg-white/10 hover:text-white hover:shadow-lg')} ${!selectedTaskId && !isActive ? 'animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>

                    <div className="w-8 h-px bg-white/10 my-1"></div>

                    <button onClick={openSettings} className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:text-white hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Settings">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    {enableGhostButton && (
                        <button onClick={handleToggleGhostMode} className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:text-white hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Ghost Mode">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </button>
                    )}
                    <button onClick={() => setShowSidebar(!showSidebar)} className={`p-2 rounded-lg transition-colors ${showSidebar ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10' : 'text-blue-400 bg-blue-500/10') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-white hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10')}`} title="Toggle Sidebar">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M21 18H3"/></svg>
                    </button>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Stats & History */}
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
                    <div className="flex justify-between items-center mb-4 shrink-0 relative"><h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Session History</h3><div className="flex items-center space-x-3"><button onClick={() => setIsAddSessionOpen(true)} className="text-gray-400 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button><div className="relative" ref={historyMenuRef}><button onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)} className="text-gray-400 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg></button>{isHistoryMenuOpen && (<div className="absolute right-0 top-full mt-2 w-48 bg-[#2c2c2e] border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">{selectedSessionIds.size > 0 && (<><button onClick={openEditBatch} className="w-full text-left px-4 py-2.5 text-xs font-medium text-white hover:bg-white/5 transition-colors border-b border-gray-700">Edit Selected ({selectedSessionIds.size})</button><button onClick={handleDeleteSelected} className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border-b border-gray-700">Delete Selected ({selectedSessionIds.size})</button></>)}<button onClick={handleClearHistory} className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors">Clear All History</button></div>)}</div></div></div>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {historyGroups.length === 0 ? (<div className="flex flex-col items-center justify-center h-48 text-gray-600 text-xs"><span className="mb-2 opacity-50">No sessions recorded</span></div>) : (<div className="space-y-6 pb-4">{historyGroups.map((group: { dateLabel: string; sessions: SessionRecord[] }) => { const allIds = group.sessions.map((s: SessionRecord) => s.id); const isAllSelected = allIds.every((id: string) => selectedSessionIds.has(id)); return (<div key={group.dateLabel}><div className="flex items-center mb-3"><button onClick={() => toggleGroupSelection(group.sessions)} className={`w-3 h-3 rounded-sm mr-2 flex items-center justify-center transition-colors ${isAllSelected ? 'bg-blue-600 border-blue-600' : 'border border-gray-600 hover:border-gray-400'}`}>{isAllSelected && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}</button><span className="text-[10px] font-bold text-gray-500 tracking-wider">{group.dateLabel}</span></div><div className="space-y-4 border-l border-gray-800 ml-[5.5px] pl-4 relative">{group.sessions.map((session: SessionRecord) => { const projectName = projects.find((p: Project) => p.id === session.projectId)?.name || 'Main Project'; const isSelected = selectedSessionIds.has(session.id); return (<div key={session.id} className="relative group"><div className={`absolute -left-[21px] top-1.5 w-1.5 h-1.5 rounded-full transition-colors ring-4 ring-[#151516] ${isSelected ? 'bg-blue-500' : 'bg-gray-600 group-hover:bg-white'}`}></div><div className="flex justify-between items-start"><div className="min-w-0 pr-2"><div className={`text-sm font-bold mb-0.5 truncate transition-colors ${isSelected ? 'text-blue-400' : 'text-white'}`}>{session.label || 'Session'}</div><div className="text-[10px] text-gray-500 flex items-center gap-1 flex-wrap"><span className={session.type === 'POMO' ? 'text-blue-400' : 'text-orange-400'}>{session.type === 'POMO' ? 'Focus' : 'Timer'}</span><span>•</span><span className="truncate">{projectName}</span></div></div><div className="flex-shrink-0 flex items-center gap-2"><div className="text-[10px] font-bold text-gray-500">{Math.round(session.duration/60)}m</div><button onClick={() => openEditSingle(session)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button><input type="checkbox" checked={isSelected} onChange={() => toggleGroupSelection([session])} className="w-3.5 h-3.5 rounded-sm bg-transparent border-gray-600 checked:bg-blue-600 focus:ring-0" /></div></div></div>)})}</div></div>) })}</div>)}
                    </div>
                </div>
             </div>
        </div>

        {/* Wager Win Overlay */}
        {wagerWinAmount !== null && (
            <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in pointer-events-none">
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