import React, { useState, useEffect } from 'react';
import { TimerSettings, AppTheme } from '../../types';
import * as storage from '../../services/storageService';
import { playAlarm } from '../../services/audioService';

interface TimerSettingsProps {
    appTheme: AppTheme;
}

export const TimerSettingsPanel: React.FC<TimerSettingsProps> = ({ appTheme }) => {
    const isCyberpunk = appTheme === 'cyberpunk';
    const [timerSettings, setTimerSettings] = useState<TimerSettings>({ pomoDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, pomosPerLongBreak: 4, autoStartNextPomo: false, autoStartBreak: false, quickDurations: [25, 45, 60], shortBreakPresets: [5, 10, 15] });
    const [timerVolume, setTimerVolume] = useState<number>(0.5);
    const [openAtLogin, setOpenAtLogin] = useState(false);

    useEffect(() => {
        storage.getTimerSettings().then(setTimerSettings);
        const v = localStorage.getItem('focusflow_timer_volume');
        if (v) setTimerVolume(parseFloat(v));
        
        if ((window as any).electronAPI?.getOpenAtLogin) {
            (window as any).electronAPI.getOpenAtLogin().then(setOpenAtLogin);
        }
    }, []);

    const toggleOpenAtLogin = () => {
        const newValue = !openAtLogin;
        setOpenAtLogin(newValue);
        (window as any).electronAPI?.setOpenAtLogin(newValue);
    };

    const handleTimerSettingChange = async (key: keyof TimerSettings, value: any) => {
        const newSettings = { ...timerSettings, [key]: value };
        setTimerSettings(newSettings);
        await storage.saveTimerSettings(newSettings);
    };

    const handlePresetChange = async (type: 'quickDurations' | 'shortBreakPresets', index: number, value: number) => {
        const newPresets = [...timerSettings[type]];
        newPresets[index] = value;
        const newSettings = { ...timerSettings, [type]: newPresets };
        setTimerSettings(newSettings);
        await storage.saveTimerSettings(newSettings);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setTimerVolume(val);
        localStorage.setItem('focusflow_timer_volume', val.toString());
    };

    const testSound = () => {
        playAlarm(timerVolume);
    };

    return (
        <div className="space-y-6">
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
                <h3 className={`text-xl font-bold mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>System</h3>
                <div className={`flex justify-between items-center p-3 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50'}`}>
                    <div>
                        <p className={`font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Launch at Startup</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Automatically start FocusFlow when you log in</p>
                    </div>
                    <button 
                        onClick={toggleOpenAtLogin}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${openAtLogin ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${openAtLogin ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
                <h3 className={`text-xl font-bold mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Timer Configuration</h3>
                
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Focus</label>
                            <div className="relative">
                                <input type="number" value={timerSettings.pomoDuration} onChange={(e) => handleTimerSettingChange('pomoDuration', parseInt(e.target.value))} className={`w-full px-3 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`} />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Short Break</label>
                            <div className="relative">
                                <input type="number" value={timerSettings.shortBreakDuration} onChange={(e) => handleTimerSettingChange('shortBreakDuration', parseInt(e.target.value))} className={`w-full px-3 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`} />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Long Break</label>
                            <div className="relative">
                                <input type="number" value={timerSettings.longBreakDuration} onChange={(e) => handleTimerSettingChange('longBreakDuration', parseInt(e.target.value))} className={`w-full px-3 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Volume</label>
                        <div className={`p-4 rounded-xl border flex items-center space-x-3 h-[42px] ${isCyberpunk ? 'bg-black border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'}`}>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.1" 
                                value={timerVolume} 
                                onChange={handleVolumeChange} 
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600" 
                            />
                            <span className="text-xs font-mono text-gray-500 w-8 text-right">{(timerVolume * 100).toFixed(0)}%</span>
                        </div>
                    </div>

                    {/* Audio Check */}
                    <div className={`flex justify-between items-center p-3 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50'}`}>
                        <div>
                            <p className={`font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Audio Playback</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Verify sound is working</p>
                        </div>
                        <button 
                            onClick={testSound}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-colors ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff]/20' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}`}
                        >
                            Test Sound
                        </button>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Access Presets</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Focus Presets */}
                            <div className="space-y-2">
                                <span className="text-xs text-gray-400 font-medium">Focus Timer Shortcuts</span>
                                <div className="flex gap-2">
                                    {timerSettings.quickDurations.map((duration, index) => (
                                        <div key={`focus-${index}`} className="relative flex-1">
                                            <input 
                                                type="number" 
                                                value={duration}
                                                onChange={(e) => handlePresetChange('quickDurations', index, parseInt(e.target.value))}
                                                className={`w-full rounded-lg px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-1 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`}
                                            />
                                            <span className="absolute right-1 top-1.5 text-[10px] text-gray-400 pointer-events-none">m</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Short Break Presets */}
                            <div className="space-y-2">
                                <span className="text-xs text-gray-400 font-medium">Short Break Shortcuts</span>
                                <div className="flex gap-2">
                                    {timerSettings.shortBreakPresets.map((duration, index) => (
                                        <div key={`break-${index}`} className="relative flex-1">
                                            <input 
                                                type="number" 
                                                value={duration}
                                                onChange={(e) => handlePresetChange('shortBreakPresets', index, parseInt(e.target.value))}
                                                className={`w-full rounded-lg px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-1 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-green-500'}`}
                                            />
                                            <span className="absolute right-1 top-1.5 text-[10px] text-gray-400 pointer-events-none">m</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
