import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as storage from '../services/storageService';
import { TimerSettings, SessionRecord, Project, MenuBarConfig, Transaction } from '../types';
import { playAlarm } from '../services/audioService';
import { useTheme, useLogs } from '../AppContext';

interface TimerPanelProps {
    onSaveSession: (hours: number, note?: string, projectId?: string) => void;
    projectId: string; 
    projects: Project[]; 
    menuBarConfig: MenuBarConfig;
    externalStart?: { duration: number; timestamp: number } | null;
    onConsumeExternalStart?: () => void;
}

type TimerMode = 'POMO' | 'STOPWATCH';
type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

export const TimerPanel: React.FC<TimerPanelProps> = ({ onSaveSession, projectId, projects, menuBarConfig, externalStart, onConsumeExternalStart }) => {
  // --- Core State ---
  const { appTheme } = useTheme();
  const { logs } = useLogs(); // [FIX] Import logs to calculate total hours
  
  const [mode, setMode] = useState<TimerMode>('POMO');
  const [phase, setPhase] = useState<TimerPhase>('FOCUS');
  const [timeLeft, setTimeLeft] = useState(25 * 60); 
  const [initialTime, setInitialTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');
  
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [settings, setSettings] = useState<TimerSettings>({ pomoDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, pomosPerLongBreak: 4, autoStartNextPomo: false, autoStartBreak: false, quickDurations: [25, 45, 60], shortBreakPresets: [5, 10, 15] });
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [pomosCompleted, setPomosCompleted] = useState(0); 

  // [FIX] Calculate currentGems state for the Wager UI
  const [bonusGems, setBonusGems] = useState(() => parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0);
  const [spentGems, setSpentGems] = useState(() => parseInt(localStorage.getItem('focusflow_spent_gems') || '0') || 0);
  
  const totalHours = useMemo(() => logs.reduce((acc, log) => acc + log.hours, 0), [logs]);
  // Note: Using simplified calculation (10 gems/hr) to match Hard Mode base rate to prevent crashes.
  // Ideally this should share logic with GamificationPanel, but this is safe for now.
  const currentGems = Math.max(0, Math.floor(totalHours * 10) + bonusGems - spentGems);

  // Wager State
  const [wager, setWager] = useState(0);
  const [isWagerActive, setIsWagerActive] = useState(false);

  // --- UI State ---
  const [showSidebar, setShowSidebar] = useState(true);
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

  // --- Initialization ---
  useEffect(() => {
      setTimeout(async () => {
          setSessions(await storage.getSessions());
          const s = await storage.getTimerSettings();
          setSettings(s);
          const duration = s.pomoDuration * 60;
          setInitialTime(duration);
          setTimeLeft(duration);
      }, 10);

      const handleClickOutside = (event: MouseEvent) => {
          if (historyMenuRef.current && !historyMenuRef.current.contains(event.target as Node)) {
              setIsHistoryMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      
      // [FIX] Listen for storage events to update gems if they change in other tabs/components
      const handleStorageUpdate = () => {
          setBonusGems(parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0);
          setSpentGems(parseInt(localStorage.getItem('focusflow_spent_gems') || '0') || 0);
      };
      window.addEventListener('focusflow-gem-update', handleStorageUpdate);
      
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          window.removeEventListener('focusflow-gem-update', handleStorageUpdate);
      };
  }, []);

  // Update selected project if prop changes
  useEffect(() => {
      if (!isActive) setSelectedProjectId(projectId);
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
      }, 200); 
    } else {
        endTimeRef.current = null;
        startTimeRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, mode]);

  const handleTimerComplete = async () => {
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      endTimeRef.current = null;
      triggerAlarm();

      // Handle Wager Win
      if (isWagerActive && wager > 0) {
          const reward = wager * 2; 
          const newBonus = (parseInt(localStorage.getItem('focusflow_bonus_gems') || '0') || 0) + reward;
          localStorage.setItem('focusflow_bonus_gems', newBonus.toString());
          
          // [FIX] Update local state
          setBonusGems(newBonus);
          window.dispatchEvent(new Event('focusflow-gem-update'));
          
          addTransaction({
              id: `wager-win-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'WIN',
              amount: reward,
              description: `Focus Wager Won (2x)`
          });
          setIsWagerActive(false);
          setWager(0);
          alert(`WAGER WON! You earned ${reward} Gems!`);
      }

      const now = new Date();
      const endTime = now.toISOString();
      const durationSecs = initialTime; 
      const startTime = new Date(now.getTime() - durationSecs * 1000).toISOString();

      if (phase === 'FOCUS') {
          const labelText = sessionLabel.trim() || 'Focus Session';
          const newSession: SessionRecord = {
              id: Date.now().toString(),
              startTime,
              endTime,
              duration: durationSecs,
              type: 'POMO',
              label: labelText,
              projectId: selectedProjectId
          };
          const updatedSessions = await storage.saveSessionRecord(newSession);
          setSessions(updatedSessions);
          
          const hours = Math.round((durationSecs / 3600) * 10) / 10;
          onSaveSession(hours, labelText, selectedProjectId);

          const newPomos = pomosCompleted + 1;
          setPomosCompleted(newPomos);

          if (newPomos % settings.pomosPerLongBreak === 0) {
              setPhase('LONG_BREAK');
              const duration = settings.longBreakDuration * 60;
              setInitialTime(duration);
              setTimeLeft(duration);
              if (settings.autoStartBreak) setIsActive(true);
          } else {
              setPhase('SHORT_BREAK');
              const duration = settings.shortBreakDuration * 60;
              setInitialTime(duration);
              setTimeLeft(duration);
              if (settings.autoStartBreak) setIsActive(true);
          }
      } else {
          setPhase('FOCUS');
          const duration = settings.pomoDuration * 60;
          setInitialTime(duration);
          setTimeLeft(duration);
          if (settings.autoStartNextPomo) setIsActive(true);
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
          const newSession: SessionRecord = {
              id: Date.now().toString(),
              startTime,
              endTime,
              duration: durationSecs,
              type: 'STOPWATCH',
              label: labelText,
              projectId: selectedProjectId
          };
          
          const updatedSessions = await storage.saveSessionRecord(newSession);
          setSessions(updatedSessions);
          
          const hours = Math.round((durationSecs / 3600) * 10) / 10;
          onSaveSession(hours, labelText, selectedProjectId);
      }
      
      setTimeLeft(0);
      setInitialTime(0);
      startTimeRef.current = null;
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
          // Starting
          if (wager > 0) {
              const newSpent = (parseInt(localStorage.getItem('focusflow_spent_gems') || '0') || 0) + wager;
              localStorage.setItem('focusflow_spent_gems', newSpent.toString());
              
              // [FIX] Update local state
              setSpentGems(newSpent);
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

  const addTransaction = (transaction: Transaction) => {
      const existing = JSON.parse(localStorage.getItem('focusflow_transactions') || '[]');
      localStorage.setItem('focusflow_transactions', JSON.stringify([transaction, ...existing]));
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
  const closeSettings = () => setIsSettingsOpen(false);
  
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

  const handleSettingChange = (k: keyof TimerSettings, v: any) => setTempSettings(p => ({...p, [k]: v}));
  
  const handlePresetUpdate = (type: 'quickDurations' | 'shortBreakPresets', idx: number, val: number) => {
      const arr = [...tempSettings[type]];
      arr[idx] = val;
      setTempSettings(p => ({...p, [type]: arr}));
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
      setSessions(updated);
      
      const hours = Math.round((durationSecs / 3600) * 10) / 10;
      onSaveSession(hours, manualDesc, manualProject);
      
      setIsAddSessionOpen(false);
      setManualDesc('');
      setManualDuration(25);
  };

  // --- Editing Logic ---
  const openEditSingle = (session: SessionRecord) => {
      setEditingSessionIds([session.id]);
      setEditProject(session.projectId || projectId);
      setEditLabel(session.label || '');
      
      const startDate = new Date(session.startTime);
      const endDate = new Date(session.endTime);
      
      setEditDate(startDate.toISOString().split('T')[0]);
      setEditStartTime(startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
      setEditEndTime(endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
      
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
      let updatedSessions = [...sessions];

      if (editingSessionIds.length === 1) {
          const id = editingSessionIds[0];
          const index = updatedSessions.findIndex(s => s.id === id);
          if (index !== -1) {
              const startDateTime = new Date(`${editDate}T${editStartTime}`);
              const endDateTime = new Date(`${editDate}T${editEndTime}`);
              
              const updatedSession = {
                  ...updatedSessions[index],
                  projectId: editProject || updatedSessions[index].projectId,
                  label: editLabel,
                  startTime: startDateTime.toISOString(),
                  endTime: endDateTime.toISOString(),
                  duration: (endDateTime.getTime() - startDateTime.getTime()) / 1000
              };
              await storage.saveSessionRecord(updatedSession);
          }
      } else {
          for (const s of updatedSessions) {
              if (editingSessionIds.includes(s.id)) {
                  let newStart = s.startTime;
                  let newEnd = s.endTime;

                  if (editDate) {
                      const oldStart = new Date(s.startTime);
                      const oldEnd = new Date(s.endTime);
                      const timeStart = oldStart.toTimeString().split(' ')[0];
                      const timeEnd = oldEnd.toTimeString().split(' ')[0];
                      newStart = new Date(`${editDate}T${timeStart}`).toISOString();
                      newEnd = new Date(`${editDate}T${timeEnd}`).toISOString();
                  }

                  const updatedSession = {
                      ...s,
                      projectId: editProject || s.projectId,
                      label: editLabel || s.label,
                      startTime: newStart,
                      endTime: newEnd
                  };
                  await storage.saveSessionRecord(updatedSession);
              }
          }
      }
      
      setSessions(await storage.getSessions());
      setIsEditModalOpen(false);
      setEditingSessionIds([]);
      setSelectedSessionIds(new Set()); 
  };

  // --- History Management ---
  const toggleGroupSelection = (groupSessions: SessionRecord[]) => {
      const ids = groupSessions.map(s => s.id);
      const allSelected = ids.every(id => selectedSessionIds.has(id));
      
      const newSet = new Set(selectedSessionIds);
      if (allSelected) {
          ids.forEach(id => newSet.delete(id));
      } else {
          ids.forEach(id => newSet.add(id));
      }
      setSelectedSessionIds(newSet);
  };

  const handleDeleteSelected = async () => {
      if (selectedSessionIds.size === 0) return;
      if (confirm(`Delete ${selectedSessionIds.size} sessions?`)) {
          const updated = await storage.batchDeleteSessions(Array.from(selectedSessionIds));
          setSessions(updated);
          setSelectedSessionIds(new Set());
          setIsHistoryMenuOpen(false);
      }
  };

  const handleClearHistory = async () => {
      if (confirm("Clear all session history? This cannot be undone.")) {
          const allIds = sessions.map(s => s.id);
          const updated = await storage.batchDeleteSessions(allIds);
          setSessions(updated);
          setSelectedSessionIds(new Set());
          setIsHistoryMenuOpen(false);
      }
  };

  // --- Stats ---
  const stats = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = sessions.filter(s => s.startTime.startsWith(today) && s.type === 'POMO');
      const todayFocusSeconds = sessions.filter(s => s.startTime.startsWith(today)).reduce((acc, curr) => acc + curr.duration, 0);
      return { todayPomos: todaySessions.length, todayFocus: Math.round(todayFocusSeconds / 60) };
  }, [sessions]);

  // Grouped History
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

  // Visuals
  const radius = 42; 
  const circumference = 2 * Math.PI * radius;
  let progress = 0;
  if (mode === 'POMO') {
      progress = initialTime > 0 ? (initialTime - timeLeft) / initialTime : 0;
  } else {
      progress = (timeLeft % 60) / 60;
  }
  const dashOffset = circumference * (1 - progress);
  const themeColor = mode === 'STOPWATCH' ? 'text-orange-500' : phase === 'FOCUS' ? 'text-blue-500' : 'text-green-500';

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
                    {/* ... Settings Content ... */}
                    <div className="space-y-6 overflow-y-auto custom-scrollbar pr-1">
                        {/* Durations */}
                        <div className="space-y-2">
                             <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Durations</h3>
                             <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                 <span className="text-sm font-medium text-gray-300">Focus Duration</span>
                                 <div className="flex items-center bg-[#2c2c2e] rounded-lg px-2 border border-white/10">
                                     <input type="number" value={tempSettings.pomoDuration} onChange={e => handleSettingChange('pomoDuration', parseInt(e.target.value))} className="w-12 bg-transparent text-right font-bold text-white focus:outline-none py-1.5"/>
                                     <span className="text-xs text-gray-500 ml-1">min</span>
                                 </div>
                             </div>
                             <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                 <span className="text-sm font-medium text-gray-300">Short Break</span>
                                 <div className="flex items-center bg-[#2c2c2e] rounded-lg px-2 border border-white/10">
                                     <input type="number" value={tempSettings.shortBreakDuration} onChange={e => handleSettingChange('shortBreakDuration', parseInt(e.target.value))} className="w-12 bg-transparent text-right font-bold text-white focus:outline-none py-1.5"/>
                                     <span className="text-xs text-gray-500 ml-1">min</span>
                                 </div>
                             </div>
                             <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                 <span className="text-sm font-medium text-gray-300">Long Break</span>
                                 <div className="flex items-center bg-[#2c2c2e] rounded-lg px-2 border border-white/10">
                                     <input type="number" value={tempSettings.longBreakDuration} onChange={e => handleSettingChange('longBreakDuration', parseInt(e.target.value))} className="w-12 bg-transparent text-right font-bold text-white focus:outline-none py-1.5"/>
                                     <span className="text-xs text-gray-500 ml-1">min</span>
                                 </div>
                             </div>
                        </div>
                        
                        {/* Quick Focus Presets */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Quick Focus Presets</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {tempSettings.quickDurations.map((val, i) => (
                                    <div key={i} className="flex flex-col bg-white/5 rounded-xl p-2 border border-white/5">
                                        <span className="text-[9px] text-gray-500 mb-1 text-center">Btn {i+1}</span>
                                        <div className="flex items-center justify-center bg-[#2c2c2e] rounded-lg border border-white/10">
                                            <input 
                                                type="number" 
                                                value={val} 
                                                onChange={e => handlePresetUpdate('quickDurations', i, parseInt(e.target.value))}
                                                className="w-10 bg-transparent text-center font-bold text-white focus:outline-none py-1"
                                            />
                                            <span className="text-[9px] text-gray-500 mr-1">m</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Automation */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Automation</h3>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="text-sm font-medium text-gray-300">Auto-start next Pomo</span>
                                <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                                    <input type="checkbox" checked={tempSettings.autoStartNextPomo} onChange={e => handleSettingChange('autoStartNextPomo', e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-5"/>
                                    <div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${tempSettings.autoStartNextPomo ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="text-sm font-medium text-gray-300">Auto-start Break</span>
                                <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                                    <input type="checkbox" checked={tempSettings.autoStartBreak} onChange={e => handleSettingChange('autoStartBreak', e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-5"/>
                                    <div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${tempSettings.autoStartBreak ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ... (ADD SESSION MODAL) ... */}
        {isAddSessionOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
                <div className="bg-[#1c1c1e] w-[450px] rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col text-white animate-scale-in">
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-lg">Add Session</h3>
                        <button onClick={() => setIsAddSessionOpen(false)} className="text-gray-400 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Project</label>
                            <select value={manualProject} onChange={(e) => setManualProject(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Description</label>
                            <input type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Design Review" className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Date</label>
                                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Time</label>
                                <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Duration (Minutes)</label>
                                <input type="number" value={manualDuration} onChange={e => setManualDuration(parseInt(e.target.value))} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Type</label>
                                <div className="flex bg-[#2c2c2e] rounded-lg p-1 border border-white/10">
                                    <button onClick={() => setManualType('POMO')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${manualType === 'POMO' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pomodoro</button>
                                    <button onClick={() => setManualType('STOPWATCH')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${manualType === 'STOPWATCH' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Stopwatch</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 border-t border-white/10">
                        <button onClick={handleSaveManualSession} className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-lg">Save Session</button>
                    </div>
                </div>
            </div>
        )}

        {/* ... (EDIT MODAL) ... */}
        {isEditModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
                <div className="bg-[#1c1c1e] w-[450px] rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col text-white animate-scale-in">
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-lg">{editingSessionIds.length > 1 ? `Edit ${editingSessionIds.length} Sessions` : 'Edit Session'}</h3>
                        <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Project</label>
                            <select value={editProject} onChange={(e) => setEditProject(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                                {editingSessionIds.length > 1 && <option value="">(No Change)</option>}
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Label</label>
                            <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder={editingSessionIds.length > 1 ? "Leave empty to keep existing" : "e.g. Focus Session"} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"/>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Date</label>
                                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]" placeholder={editingSessionIds.length > 1 ? "Leave unchanged" : ""}/>
                            </div>
                        </div>

                        {editingSessionIds.length === 1 && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Start</label>
                                    <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">End</label>
                                    <input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className="w-full bg-[#2c2c2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"/>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-6 border-t border-white/10 flex gap-3">
                        <button onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-transparent border border-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/5 transition-colors">Cancel</button>
                        <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg">Save Changes</button>
                    </div>
                </div>
            </div>
        )}

        {/* LEFT COLUMN: Timer Display */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 pb-20 relative transition-colors duration-300">
             <div className="flex flex-col items-center justify-center w-full max-w-md">
                 {/* Mode Switcher */}
                 <div className={`flex p-1 rounded-xl mb-6 ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                     <button 
                         onClick={() => switchMode('POMO')} 
                         className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'POMO' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200')}`}
                     >
                         Pomodoro
                     </button>
                     <button 
                         onClick={() => switchMode('STOPWATCH')} 
                         className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'STOPWATCH' ? (isCyberpunk ? 'bg-[#f0f]/20 text-[#f0f] shadow-[0_0_10px_rgba(255,0,255,0.3)]' : 'bg-white dark:bg-gray-700 text-orange-500 dark:text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200')}`}
                     >
                         Stopwatch
                     </button>
                 </div>

                 {/* Wager Controls (Only in POMO Focus) */}
                 {mode === 'POMO' && phase === 'FOCUS' && !isActive && (
                     <div className={`mb-6 flex flex-col items-center animate-fade-in ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-600 dark:text-gray-300'}`}>
                         <div className="flex items-center gap-2 mb-2">
                             <span className="text-xs font-bold uppercase tracking-wider">Wager Gems</span>
                             <span className="text-xs opacity-60">(Win 2x)</span>
                         </div>
                         <div className="flex items-center gap-2">
                             {[0, 10, 50, 100].map(amount => (
                                 <button
                                     key={amount}
                                     onClick={() => setWager(amount)}
                                     disabled={currentGems < amount}
                                     className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${wager === amount ? (isCyberpunk ? 'bg-[#00f0ff] text-black border-[#00f0ff]' : 'bg-blue-600 text-white border-blue-600') : (isCyberpunk ? 'bg-black border-[#00f0ff]/30 hover:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400')} ${currentGems < amount ? 'opacity-50 cursor-not-allowed' : ''}`}
                                 >
                                     {amount === 0 ? 'None' : amount} 💎
                                 </button>
                             ))}
                         </div>
                         {wager > 0 && <p className="text-[10px] mt-1 text-orange-500 font-bold">Risk: Lose {wager} if stopped early!</p>}
                     </div>
                 )}

                 {/* Mode/Phase Pill */}
                 <div className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-6 py-2 px-5 rounded-full border ${isCyberpunk ? 'bg-black border-[#00f0ff]/50 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : `bg-white/50 dark:bg-black/20 ${mode === 'POMO' ? (phase === 'FOCUS' ? 'text-blue-500 border-blue-200 dark:border-blue-900/50' : 'text-green-500 border-green-200 dark:border-green-900/50') : 'text-orange-500 border-orange-200 dark:border-orange-900/50'}`}`}>
                     {mode === 'POMO' ? (phase === 'FOCUS' ? 'Focus Time' : 'Break Time') : 'Stopwatch Mode'}
                 </div>

                 {/* Project & Task Input */}
                 <div className="mb-8 w-64 z-20 flex flex-col gap-3">
                     <div className="relative">
                         <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={isActive} className={`w-full appearance-none px-4 py-2.5 pr-8 rounded-xl border text-sm font-bold text-center transition-all ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff] focus:shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'bg-gray-100 dark:bg-[#1c1c1e] text-gray-900 dark:text-white border-transparent focus:border-blue-500'} ${isActive ? 'opacity-50 cursor-not-allowed' : isCyberpunk ? 'hover:border-[#00f0ff]/60' : 'hover:bg-gray-200 dark:hover:bg-[#2c2c2e] cursor-pointer'}`}>
                             {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                         </select>
                     </div>
                     <input 
                        type="text" 
                        value={sessionLabel} 
                        onChange={(e) => setSessionLabel(e.target.value)} 
                        placeholder={isCyberpunk ? "ENTER MISSION OBJECTIVE" : "What are you working on?"} 
                        className={`w-full bg-transparent border-b text-center text-sm focus:outline-none transition-colors py-1.5 ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff] placeholder-[#00f0ff]/30 focus:border-[#00f0ff]' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:border-blue-500'}`}
                        disabled={isActive}
                     />
                 </div>

                 {/* Timer Circle - Responsive */}
                 <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center mb-8 group">
                     <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 100 100">
                         <defs>
                             <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={isCyberpunk ? "#00f0ff" : "#60A5FA"} /><stop offset="100%" stopColor={isCyberpunk ? "#0099ff" : "#3B82F6"} /></linearGradient>
                             <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#34D399" /><stop offset="100%" stopColor="#10B981" /></linearGradient>
                             <linearGradient id="stopwatchGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FBBF24" /><stop offset="100%" stopColor="#F59E0B" /></linearGradient>
                         </defs>
                         <circle cx="50" cy="50" r={radius} className={`${isCyberpunk ? 'stroke-[#00f0ff]/10' : 'stroke-gray-100 dark:stroke-[#252527]'} transition-colors duration-300`} strokeWidth="4" fill="transparent" />
                         <circle cx="50" cy="50" r={radius} stroke={`url(#${mode === 'POMO' ? (phase === 'FOCUS' ? 'focusGradient' : 'breakGradient') : 'stopwatchGradient'})`} strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" className={`transition-all duration-1000 ease-linear ${isActive && (isCyberpunk ? 'drop-shadow-[0_0_20px_rgba(0,240,255,0.6)]' : 'drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]')} ${isWagerActive ? 'stroke-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.6)]' : ''}`}/>
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <div className={`text-7xl md:text-8xl font-bold tracking-tight tabular-nums select-none transition-colors duration-300 ${isCyberpunk ? 'text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]' : themeColor} drop-shadow-md`}>{formatTime(timeLeft)}</div>
                     </div>
                 </div>

                 {/* Presets (Only in POMO mode when not active) */}
                 {mode === 'POMO' && !isActive && (
                     <div className="flex gap-3 mb-8">
                         {(phase === 'FOCUS' ? settings.quickDurations : settings.shortBreakPresets).map((mins) => (
                             <button
                                key={mins}
                                onClick={() => {
                                    setIsActive(false);
                                    endTimeRef.current = null;
                                    setInitialTime(mins * 60);
                                    setTimeLeft(mins * 60);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30 hover:bg-[#00f0ff]/20 hover:shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-blue-500 hover:border-blue-200 dark:hover:border-blue-900'}`}
                             >
                                 {mins}m
                             </button>
                         ))}
                     </div>
                 )}

                 {/* Controls */}
                 <div className="flex items-center space-x-6">
                     <button onClick={resetTimer} className={`p-4 rounded-full transition-all active:scale-95 shadow-sm hover:shadow-md ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'bg-gray-100 dark:bg-[#1c1c1e] hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </button>
                     
                     <button onClick={toggleTimer} className={`h-20 w-20 rounded-full font-bold text-white shadow-xl transition-all hover:shadow-2xl active:scale-95 flex items-center justify-center ${isCyberpunk ? 'bg-black border-2 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:bg-[#00f0ff] hover:text-black' : (mode === 'STOPWATCH' ? 'bg-orange-500 hover:bg-orange-600' : (phase === 'FOCUS' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'))}`}>
                         {isActive ? (
                             <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                         ) : (
                             <span className="text-sm">Start</span>
                         )}
                     </button>
                     
                     {mode === 'STOPWATCH' && (isActive || timeLeft > 0) && (
                         <button onClick={handleStopwatchFinish} className="p-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-all active:scale-95" title="Save & Finish">
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                         </button>
                     )}
                 </div>
             </div>

             {/* Bottom Controls */}
             <div className="absolute bottom-8 right-8 z-10 flex space-x-3">
                 <button onClick={openSettings} className={`p-2.5 rounded-xl transition-all ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>
                 <button onClick={() => setShowSidebar(!showSidebar)} className={`p-2.5 rounded-xl transition-all ${showSidebar ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-500') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-white')}`}>
                     {showSidebar ? (
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                     ) : (
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                     )}
                 </button>
             </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Stats & History - Responsive */}
        <div className={`${isCyberpunk ? 'bg-[#020202] border-[#00f0ff]/20' : 'bg-[#151516] border-gray-800'} border-l flex flex-col overflow-hidden transition-all duration-300 absolute md:relative right-0 h-full z-30 shadow-2xl md:shadow-none ${showSidebar ? 'w-[320px] md:w-[360px] translate-x-0' : 'w-0 translate-x-full md:translate-x-0 md:w-0'}`}>
             <div className="p-6 h-full flex flex-col w-[320px] md:w-[360px]"> 
                <div className="mb-8 shrink-0">
                    <h3 className={`${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-400'} font-bold text-[10px] uppercase tracking-wider mb-4`}>Today's Overview</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-[#1c1c1e] border-gray-800'} p-4 rounded-xl border`}>
                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Sessions</div>
                            <div className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{stats.todayPomos}</div>
                        </div>
                        <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/20' : 'bg-[#1c1c1e] border-gray-800'} p-4 rounded-xl border`}>
                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Focus Time</div>
                            <div className={`text-3xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-white'}`}>{stats.todayFocus} <span className={`text-sm font-medium ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>min</span></div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="flex justify-between items-center mb-4 shrink-0 relative">
                        <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Session History</h3>
                        <div className="flex items-center space-x-3">
                            <button onClick={() => setIsAddSessionOpen(true)} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                            <div className="relative" ref={historyMenuRef}>
                                <button onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)} className="text-gray-400 hover:text-white transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                                </button>
                                {isHistoryMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#2c2c2e] border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">
                                        {selectedSessionIds.size > 0 && (
                                            <>
                                                <button 
                                                    onClick={openEditBatch}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-white hover:bg-white/5 transition-colors border-b border-gray-700"
                                                >
                                                    Edit Selected ({selectedSessionIds.size})
                                                </button>
                                                <button 
                                                    onClick={handleDeleteSelected}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border-b border-gray-700"
                                                >
                                                    Delete Selected ({selectedSessionIds.size})
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            onClick={handleClearHistory}
                                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                        >
                                            Clear All History
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {historyGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-600 text-xs">
                                <span className="mb-2 opacity-50">No sessions recorded</span>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-4">
                                {historyGroups.map(group => {
                                    const allIds = group.sessions.map(s => s.id);
                                    const isAllSelected = allIds.every(id => selectedSessionIds.has(id));
                                    
                                    return (
                                        <div key={group.dateLabel}>
                                            <div className="flex items-center mb-3">
                                                <button 
                                                    onClick={() => toggleGroupSelection(group.sessions)}
                                                    className={`w-3 h-3 rounded-sm mr-2 flex items-center justify-center transition-colors ${isAllSelected ? 'bg-blue-600 border-blue-600' : 'border border-gray-600 hover:border-gray-400'}`}
                                                >
                                                    {isAllSelected && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                                </button>
                                                <span className="text-[10px] font-bold text-gray-500 tracking-wider">{group.dateLabel}</span>
                                            </div>
                                            <div className="space-y-4 border-l border-gray-800 ml-[5.5px] pl-4 relative">
                                                {group.sessions.map(session => {
                                                    const projectName = projects.find(p => p.id === session.projectId)?.name || 'Main Project';
                                                    const isSelected = selectedSessionIds.has(session.id);
                                                    
                                                    return (
                                                        <div key={session.id} className="relative group">
                                                            <div className={`absolute -left-[21px] top-1.5 w-1.5 h-1.5 rounded-full transition-colors ring-4 ring-[#151516] ${isSelected ? 'bg-blue-500' : 'bg-gray-600 group-hover:bg-white'}`}></div>
                                                            <div className="flex justify-between items-start">
                                                                <div className="min-w-0 pr-2">
                                                                    <div className={`text-sm font-bold mb-0.5 truncate transition-colors ${isSelected ? 'text-blue-400' : 'text-white'}`}>{session.label || 'Session'}</div>
                                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1 flex-wrap">
                                                                        <span className={session.type === 'POMO' ? 'text-blue-400' : 'text-orange-400'}>{session.type === 'POMO' ? 'Focus' : 'Timer'}</span>
                                                                        <span>•</span>
                                                                        <span className="truncate max-w-[80px]">{projectName}</span>
                                                                        <span>•</span>
                                                                        <span>{new Date(session.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12: false})} - {new Date(session.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12: false})}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-2 shrink-0">
                                                                    <span className="text-xs font-bold text-white/80">{Math.round(session.duration/60)}m</span>
                                                                    <button 
                                                                        onClick={() => openEditSingle(session)}
                                                                        className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
             </div>
        </div>
    </div>
  );
};
