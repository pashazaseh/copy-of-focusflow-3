import React, { useState, useEffect } from 'react';
import { TimerSettings, AppTheme } from '../../types';
import * as storage from '../../services/storageService';
import { playAlarm } from '../../services/audioService';

interface TimerSettingsProps {
    appTheme: AppTheme;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-gray-500/80 dark:text-gray-400/80">
        {title}
    </h3>
);

const SettingRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
     <div className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20">
        <div>
            <p className="font-semibold text-sm text-gray-200">{label}</p>
            {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
        {children}
    </div>
);

export const TimerSettingsPanel: React.FC<TimerSettingsProps> = ({ appTheme }) => {
    const isCyberpunk = appTheme === 'cyberpunk';
    const [timerSettings, setTimerSettings] = useState<TimerSettings>({ pomoDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, pomosPerLongBreak: 4, autoStartNextPomo: false, autoStartBreak: false, quickDurations: [25, 45, 60], shortBreakPresets: [5, 10, 15], autoMinimize: false } as any);
    const [timerVolume, setTimerVolume] = useState<number>(0.5);
    
    // For inline preset adding
    const [newWorkPreset, setNewWorkPreset] = useState('');
    const [newRestPreset, setNewRestPreset] = useState('');

    const [minimizeToTray, setMinimizeToTray] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('focusflow_minimize_to_tray') === 'true';
        return false;
    });

    const [showInDock, setShowInDock] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('focusflow_show_in_dock') !== 'false';
        return true;
    });

    const [alwaysOnTopActive, setAlwaysOnTopActive] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('focusflow_always_on_top_active') === 'true';
        return false;
    });

    const [ghostSnapCorner, setGhostSnapCorner] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('focusflow_ghost_snap_corner') || 'top-right';
        return 'top-right';
    });

    useEffect(() => {
        localStorage.setItem('focusflow_always_on_top_active', String(alwaysOnTopActive));
        window.dispatchEvent(new Event('focusflow-aot-setting-update'));
    }, [alwaysOnTopActive]);

    useEffect(() => {
        localStorage.setItem('focusflow_ghost_snap_corner', ghostSnapCorner);
        (window.electronAPI as any)?.send?.('set-ghost-snap-corner', ghostSnapCorner);
    }, [ghostSnapCorner]);

    useEffect(() => {
        localStorage.setItem('focusflow_minimize_to_tray', String(minimizeToTray));
        (window.electronAPI as any)?.setMinimizeToTray?.(minimizeToTray);
    }, [minimizeToTray]);

    useEffect(() => {
        localStorage.setItem('focusflow_show_in_dock', String(showInDock));
        (window.electronAPI as any)?.setShowInDock?.(showInDock);
    }, [showInDock]);

    useEffect(() => {
        storage.getTimerSettings().then(setTimerSettings);
        const v = localStorage.getItem('focusflow_timer_volume');
        if (v) setTimerVolume(parseFloat(v));
    }, []);
    
    const handleTimerSettingChange = async (key: keyof TimerSettings, value: any) => {
        const newSettings = { ...timerSettings, [key]: value };
        setTimerSettings(newSettings);
        await storage.saveTimerSettings(newSettings);
        window.dispatchEvent(new Event('focusflow-timer-settings-update'));
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setTimerVolume(val);
        localStorage.setItem('focusflow_timer_volume', val.toString());
    };

    const testSound = () => {
        playAlarm(timerVolume);
    };

    const handleAddPreset = async (type: 'quickDurations' | 'shortBreakPresets') => {
        const value = parseInt(type === 'quickDurations' ? newWorkPreset : newRestPreset, 10);
        if (isNaN(value) || value <= 0) return;

        const currentPresets = timerSettings[type] || [];
        if (currentPresets.includes(value)) return;

        const newPresets = [...currentPresets, value].sort((a, b) => a - b);
        await handleTimerSettingChange(type, newPresets);

        if (type === 'quickDurations') setNewWorkPreset('');
        else setNewRestPreset('');
    };

    const handleRemovePreset = async (type: 'quickDurations' | 'shortBreakPresets', value: number) => {
        const currentPresets = timerSettings[type] || [];
        const newPresets = currentPresets.filter(p => p !== value);
        await handleTimerSettingChange(type, newPresets);
    };

    const cardClass = `p-4 rounded-xl border h-full ${isCyberpunk ? 'border-[#00f0ff]/20 bg-[#0a0a0a]' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`;
    const inputClass = `w-16 text-center bg-transparent focus:outline-none ${isCyberpunk ? 'text-white' : 'text-gray-900 dark:text-white'}`;
    const inputContainerClass = `flex items-center rounded-lg px-2 border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 focus-within:border-[#00f0ff]/50' : 'bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus-within:border-blue-500'}`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Time Logic */}
            <div className={cardClass}>
                <SectionHeader title="Time Logic" />
                <div className="space-y-4">
                    {/* Durations */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center gap-1">
                            <label className="text-xs font-bold text-gray-500">Focus</label>
                            <div className={inputContainerClass}>
                                <input type="number" value={timerSettings.pomoDuration} onChange={(e) => handleTimerSettingChange('pomoDuration', parseInt(e.target.value))} className={inputClass} />
                                <span className="text-xs text-gray-500">min</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <label className="text-xs font-bold text-gray-500">Short Break</label>
                            <div className={inputContainerClass}>
                                <input type="number" value={timerSettings.shortBreakDuration} onChange={(e) => handleTimerSettingChange('shortBreakDuration', parseInt(e.target.value))} className={inputClass} />
                                <span className="text-xs text-gray-500">min</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <label className="text-xs font-bold text-gray-500">Long Break</label>
                            <div className={inputContainerClass}>
                                <input type="number" value={timerSettings.longBreakDuration} onChange={(e) => handleTimerSettingChange('longBreakDuration', parseInt(e.target.value))} className={inputClass} />
                                <span className="text-xs text-gray-500">min</span>
                            </div>
                        </div>
                    </div>
                     <SettingRow label="Long breaks after">
                        <div className={inputContainerClass}>
                            <input type="number" value={timerSettings.pomosPerLongBreak} onChange={(e) => handleTimerSettingChange('pomosPerLongBreak', parseInt(e.target.value))} className="w-12 text-center bg-transparent focus:outline-none" />
                            <span className="text-xs text-gray-500 mr-2">pomos</span>
                        </div>
                    </SettingRow>

                    {/* Automation */}
                    <SettingRow label="Auto-start next session">
                         <button 
                            onClick={() => handleTimerSettingChange('autoStartNextPomo', !timerSettings.autoStartNextPomo)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isCyberpunk ? 'focus:ring-offset-black focus:ring-[#00f0ff]' : 'focus:ring-blue-500'} ${timerSettings.autoStartNextPomo ? (isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-600') : 'bg-gray-200 dark:bg-gray-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${timerSettings.autoStartNextPomo ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </SettingRow>
                     <SettingRow label="Auto-start breaks">
                        <button 
                            onClick={() => handleTimerSettingChange('autoStartBreak', !timerSettings.autoStartBreak)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isCyberpunk ? 'focus:ring-offset-black focus:ring-[#00f0ff]' : 'focus:ring-blue-500'} ${timerSettings.autoStartBreak ? (isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-600') : 'bg-gray-200 dark:bg-gray-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${timerSettings.autoStartBreak ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </SettingRow>
                    <SettingRow label="Auto-minimize on Start">
                         <button 
                            onClick={() => handleTimerSettingChange('autoMinimize' as any, !(timerSettings as any).autoMinimize)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isCyberpunk ? 'focus:ring-offset-black focus:ring-[#00f0ff]' : 'focus:ring-blue-500'} ${(timerSettings as any).autoMinimize ? (isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-600') : 'bg-gray-200 dark:bg-gray-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(timerSettings as any).autoMinimize ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </SettingRow>
                </div>
            </div>

            {/* Right Column: Sensory & Presets */}
            <div className={cardClass}>
                <SectionHeader title="Audio & Presets" />
                <div className="space-y-4">
                    {/* Audio */}
                    <SettingRow label="Alarm Volume">
                        <div className="flex items-center space-x-2 w-40">
                            <input type="range" min="0" max="1" step="0.1" value={timerVolume} onChange={handleVolumeChange} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600" />
                            <span className="text-xs font-mono text-gray-500 w-8 text-right">{(timerVolume * 100).toFixed(0)}%</span>
                        </div>
                    </SettingRow>
                    <SettingRow label="Test Alarm Sound">
                        <button onClick={testSound} className={`px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff]/20' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}`}>
                            Play
                        </button>
                    </SettingRow>

                    {/* Presets */}
                    <div className="pt-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Focus Presets (min)</h4>
                        <div className="flex flex-wrap gap-2 items-center">
                            {(timerSettings.quickDurations || []).map(d => (
                                <span key={d} className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-blue-100 text-blue-700'}`}>
                                    {d}
                                    <button onClick={() => handleRemovePreset('quickDurations', d)} className="opacity-50 hover:opacity-100">×</button>
                                </span>
                            ))}
                             <div className="flex items-center">
                                <input type="number" value={newWorkPreset} onChange={e => setNewWorkPreset(e.target.value)} placeholder="Add" className="w-14 bg-transparent border-b border-dashed border-gray-500 text-center text-xs focus:outline-none focus:border-solid focus:border-blue-500" onKeyDown={e => e.key === 'Enter' && handleAddPreset('quickDurations')} />
                            </div>
                        </div>
                    </div>
                     <div className="pt-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rest Presets (min)</h4>
                        <div className="flex flex-wrap gap-2 items-center">
                            {(timerSettings.shortBreakPresets || []).map(d => (
                                <span key={d} className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${isCyberpunk ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700'}`}>
                                    {d}
                                    <button onClick={() => handleRemovePreset('shortBreakPresets', d)} className="opacity-50 hover:opacity-100">×</button>
                                </span>
                            ))}
                            <div className="flex items-center">
                                <input type="number" value={newRestPreset} onChange={e => setNewRestPreset(e.target.value)} placeholder="Add" className="w-14 bg-transparent border-b border-dashed border-gray-500 text-center text-xs focus:outline-none focus:border-solid focus:border-green-500" onKeyDown={e => e.key === 'Enter' && handleAddPreset('shortBreakPresets')} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Window Behavior */}
            <div className={`${cardClass} md:col-span-2`}>
                <SectionHeader title="Window Behavior" />
                <div className="space-y-4">
                    <SettingRow label="Minimize to Menu Bar (Tray)">
                        <button onClick={() => setMinimizeToTray(!minimizeToTray)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isCyberpunk ? 'focus:ring-offset-black focus:ring-[#00f0ff]' : 'focus:ring-blue-500'} ${minimizeToTray ? (isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-600') : 'bg-gray-200 dark:bg-gray-600'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${minimizeToTray ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </SettingRow>
                    <SettingRow label="Show in Dock">
                        <button onClick={() => setShowInDock(!showInDock)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isCyberpunk ? 'focus:ring-offset-black focus:ring-[#00f0ff]' : 'focus:ring-blue-500'} ${showInDock ? (isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-600') : 'bg-gray-200 dark:bg-gray-600'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showInDock ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </SettingRow>
                    <SettingRow label="Always on Top when Active">
                        <button onClick={() => setAlwaysOnTopActive(!alwaysOnTopActive)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isCyberpunk ? 'focus:ring-offset-black focus:ring-[#00f0ff]' : 'focus:ring-blue-500'} ${alwaysOnTopActive ? (isCyberpunk ? 'bg-[#00f0ff]' : 'bg-blue-600') : 'bg-gray-200 dark:bg-gray-600'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${alwaysOnTopActive ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </SettingRow>
                    <SettingRow label="Ghost Window Corner">
                        <select 
                            value={ghostSnapCorner} 
                            onChange={(e) => setGhostSnapCorner(e.target.value)}
                            className={`bg-transparent border rounded px-2 py-1 text-xs focus:outline-none ${isCyberpunk ? 'border-[#00f0ff]/50 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                        >
                            <option value="top-right">Top Right</option>
                            <option value="bottom-right">Bottom Right</option>
                            <option value="top-left">Top Left</option>
                            <option value="bottom-left">Bottom Left</option>
                        </select>
                    </SettingRow>
                </div>
            </div>
        </div>
    );
};