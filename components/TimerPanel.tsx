import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as storage from '../services/storageService';
import { TimerSettings, SessionRecord, Project, MenuBarConfig, Transaction, Task } from '../types';
import { playAlarm } from '../services/audioService';
import { useTheme } from '../AppContext';

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
        sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode, tasks
  });
  // Keep ref synchronized with state
    stateRef.current = { sessionLabel, selectedProjectId, selectedTaskId, settings, pomosCompleted, wager, isWagerActive, initialTime, phase, mode, tasks };

  // Use gems from props
  const currentGems = propGems;
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

  // --- Initialization ---
  useEffect(() => {
      const initTimer = setTimeout(async () => {
          const [sSessions, sSettings, sTasks] = await Promise.all([storage.getSessions(), storage.getTimerSettings(), storage.getTasks()]);
          if (isMounted.current) {
              setSessions(sSessions);
              setSettings(sSettings);
              const duration = sSettings.pomoDuration * 60;
              setInitialTime(duration);
              setTimeLeft(duration);
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
      } else {
          if (!startTimeRef.current) {
              const elapsedMS = timeLeft * 1000;
              startTimeRef.current = Date.now() - elapsedMS;
          }
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
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, mode]);
const handleTimerComplete = async () => {
      // READ LATEST DATA FROM REF (Fixing stale closure)
      const currentData = stateRef.current;
      
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      endTimeRef.current = null;
      triggerAlarm();

      if (Notification.permission === "granted") {
          new Notification("Timer Finished!", {
              body: currentData.sessionLabel || "Focus session complete.",
              silent: false 
          });
      }

      // Handle Wager Win
      if (currentData.isWagerActive && currentData.wager > 0) {
          const roll = Math.random();
          let multiplier = 2;
          let type = '';

          if (roll > 0.95) { multiplier = 5; type = ' (JACKPOT!)'; }
          else if (roll > 0.85) { multiplier = 3; type = ' (CRITICAL!)'; }
          else if (roll > 0.60) { multiplier = 2.5; type = ' (Great!)'; }

          const reward = Math.floor(currentData.wager * multiplier);

          const newBonus = (parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0) + reward;
          localStorage.setItem('focusflow_bonus_gems', newBonus.toString());
          
          window.dispatchEvent(new Event('focusflow-gem-update'));
          
          addTransaction({
              id: `wager-win-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'WIN',
              amount: reward,
              description: `Focus Wager Won (${multiplier}x${type})`
          });
          setIsWagerActive(false);
          setWager(0);
          alert(`WAGER WON!${type} You earned ${reward} Gems!`);
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

  const handleSettingChange = (k: keyof TimerSettings, v: any) => setTempSettings((p: TimerSettings) => ({...p, [k]: v}));
  
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

  const handleQuickAction = (minutes: number) => {
    setMode('POMO');
    setPhase('FOCUS');
    const seconds = minutes * 60;
    setInitialTime(seconds);
    setTimeLeft(seconds);
    setIsActive(false);
  };

  const isCyberpunk = appTheme === 'cyberpunk';
return (
    <div className={`flex h-full w-full overflow-hidden relative transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white'}`}>
        
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
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative transition-colors duration-300 group">
            {/* Top Header */}
            <div className={`absolute top-8 left-0 right-0 flex flex-col items-center z-20 transition-opacity duration-300 ${isActive ? 'opacity-20 hover:opacity-100' : 'opacity-100'}`}>
                <div className={`pointer-events-auto flex flex-col items-center gap-2 max-w-xs p-4 rounded-xl ${isCyberpunk ? 'border border-[#00f0ff]/30' : ''}`}>
                    <div className="relative group">
                        <select
                            value={selectedProjectId}
                            onChange={(e) => {
                                setSelectedProjectId(e.target.value);
                                setSelectedTaskId('');
                                setSessionLabel('');
                            }}
                            disabled={isActive}
                            className={`appearance-none pl-3 pr-8 py-1 bg-transparent text-lg font-bold cursor-pointer focus:ring-0 transition-colors text-center ${isCyberpunk ? 'text-[#00f0ff] hover:text-[#00f0ff]/80' : 'text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300'} ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="all">All Projects</option>
                            <option value="">No Project</option>
                            {projects.map((p: Project) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                        {!isActive && <div className={`absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>}
                    </div>
                     <div className="relative group w-full">
                         <select value={selectedTaskId} onChange={handleTaskSelect} disabled={isActive || activeTasks.length === 0} className={`appearance-none pl-3 pr-8 py-1 bg-transparent text-sm font-medium cursor-pointer focus:ring-0 transition-colors w-full truncate text-center ${isCyberpunk ? 'text-[#00f0ff]/80 hover:text-[#00f0ff]' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'} ${isActive || activeTasks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                             {activeTasks.length === 0 ? (
                                <option value="" disabled>-- No Tasks Available --</option>
                             ) : (
                                <>
                                 <option value="">-- Select Task --</option>
                                 {activeTasks.map((t: Task) => <option key={t.id} value={t.id}>{t.title}</option>)}
                                </>
                             )}
                         </select>
                     </div>
                    <input
                        type="text"
                        value={sessionLabel}
                        onChange={(e) => setSessionLabel(e.target.value)}
                        placeholder={isCyberpunk ? "MISSION OBJECTIVE" : "What are you working on?"}
                        className={`w-full bg-transparent p-0 text-sm focus:ring-0 transition-colors text-center ${isCyberpunk ? 'text-[#00f0ff]/80 placeholder-[#00f0ff]/30 border-b border-transparent focus:border-[#00f0ff]/30' : 'text-gray-600 dark:text-gray-300 placeholder-gray-400 border-b border-transparent focus:border-gray-300'}`}
                        disabled={isActive}
                    />
                </div>
            </div>

             {/* Bottom Dock */}
            <div className={`absolute bottom-8 right-8 flex gap-2 z-30 backdrop-blur-md bg-black/30 p-2 rounded-2xl transition-opacity duration-300 ${isActive ? 'opacity-20 hover:opacity-100' : 'opacity-100'} ${isCyberpunk ? 'border border-[#00f0ff]/30' : ''}`}>
                <button onClick={openSettings} className={`p-3 rounded-xl transition-all ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                <button onClick={() => setShowSidebar(!showSidebar)} className={`p-3 rounded-xl transition-all ${showSidebar ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/20') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white')}`}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M21 18H3"/></svg>
                </button>
            </div>

             {/* Main Content Centered */}
             <div className="flex flex-col items-center justify-center w-full max-w-xl z-10">
                 
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

                {/* Quick Actions */}
                 <div className="flex items-center gap-2 mb-10">
                     {(settings.quickDurations || [15, 25, 45, 60]).map((mins: number) => (
                         <button
                             key={mins}
                             onClick={() => handleQuickAction(mins)}
                             disabled={isActive}
                             className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all border ${isActive ? 'opacity-50 cursor-not-allowed' : ''} ${isCyberpunk ? 'bg-transparent border-[#00f0ff]/30 text-[#00f0ff]/80 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff]' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400'}`}
                         >
                             {mins}
                         </button>
                     ))}
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

                 {/* Wager Controls */}
                 {mode === 'POMO' && phase === 'FOCUS' && !isActive && (
                     <div className={`mt-8 flex flex-col items-center animate-fade-in ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-600 dark:text-gray-300'}`}>
                         <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold uppercase tracking-wider">Wager Gems</span><span className="text-xs opacity-60">(Win 2x)</span></div>
                         <div className="flex items-center gap-2">{[0, 10, 50, 100].map((amount: number) => (<button key={amount} onClick={() => setWager(amount)} disabled={currentGems < amount} className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${wager === amount ? (isCyberpunk ? 'bg-[#00f0ff] text-black border-[#00f0ff]' : 'bg-blue-600 text-white border-blue-600') : (isCyberpunk ? 'bg-black border-[#00f0ff]/30 hover:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400')} ${currentGems < amount ? 'opacity-50 cursor-not-allowed' : ''}`}>{amount === 0 ? 'None' : amount} 💎</button>))}</div>
                         {wager > 0 && <p className="text-[10px] mt-1 text-orange-500 font-bold">Risk: Lose {wager} if stopped early!</p>}
                     </div>
                 )}
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
    </div>
  );
};