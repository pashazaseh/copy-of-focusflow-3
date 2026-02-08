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
    const [quickCaptureShortcut, setQuickCaptureShortcut] = useState('');
    const [isRecording, setIsRecording] = useState(false);

    // Update State
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle');
    const [latestVersion, setLatestVersion] = useState<string>('');
    const [updateBranch, setUpdateBranch] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('focusflow_update_branch') || 'main';
        return 'main';
    });

    useEffect(() => {
        storage.getTimerSettings().then(setTimerSettings);
        const v = localStorage.getItem('focusflow_timer_volume');
        if (v) setTimerVolume(parseFloat(v));
        
        if ((window as any).electronAPI?.getOpenAtLogin) {
            (window as any).electronAPI.getOpenAtLogin().then(setOpenAtLogin);
        }
        setQuickCaptureShortcut(localStorage.getItem('focusflow_quick_capture_shortcut') || 'CommandOrControl+Shift+C');
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

    useEffect(() => {
        if (!isRecording) return;

        const handleRecordKeyDown = async (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape') {
                setIsRecording(false);
                return;
            }
            
            if (e.key === 'Backspace' || e.key === 'Delete') {
                 setQuickCaptureShortcut('');
                 localStorage.setItem('focusflow_quick_capture_shortcut', '');
                 (window.electronAPI as any)?.updateGlobalShortcut?.('');
                 setIsRecording(false);
                 return;
            }

            // Ignore standalone modifiers
            if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;

            const modifiers = [];
            if (e.metaKey) modifiers.push('CommandOrControl');
            if (e.ctrlKey) modifiers.push('Control');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');

            let key = e.key;
            
            if (key === 'Dead') {
                if (e.code.startsWith('Key')) key = e.code.slice(3);
                else if (e.code.startsWith('Digit')) key = e.code.slice(5);
                else return;
            }

            if (key === ' ') key = 'Space';
            else if (key === '+') key = 'Plus';
            else if (key === 'ArrowUp') key = 'Up';
            else if (key === 'ArrowDown') key = 'Down';
            else if (key === 'ArrowLeft') key = 'Left';
            else if (key === 'ArrowRight') key = 'Right';
            else if (key === 'Escape') key = 'Esc';
            else if (key.length === 1) key = key.toUpperCase();

            const finalShortcut = [...modifiers, key].join('+');
            
            const success = await (window.electronAPI as any)?.updateGlobalShortcut?.(finalShortcut);
            if (success) {
                setQuickCaptureShortcut(finalShortcut);
                localStorage.setItem('focusflow_quick_capture_shortcut', finalShortcut);
                setIsRecording(false);
            } else {
                alert(`Shortcut "${finalShortcut}" could not be registered. It may be in use by another application.`);
            }
        };

        window.addEventListener('keydown', handleRecordKeyDown);
        return () => window.removeEventListener('keydown', handleRecordKeyDown);
    }, [isRecording]);

    const handleTestQuickCapture = () => {
        console.log('Triggering Quick Capture...');
        if (window.electronAPI?.openQuickCapture) {
            window.electronAPI.openQuickCapture();
        }
    };

    const checkForUpdates = async () => {
        setUpdateStatus('checking');
        try {
            let fetchUrl = `https://raw.githubusercontent.com/pashazaseh/copy-of-focusflow-3/${updateBranch}/package.json`;
            
            // Handle full GitHub URLs
            if (updateBranch.startsWith('http')) {
                try {
                    const url = new URL(updateBranch);
                    if (url.hostname === 'github.com') {
                        const parts = url.pathname.split('/').filter(Boolean);
                        // Format: /owner/repo/tree/branch...
                        if (parts.length >= 4 && parts[2] === 'tree') {
                            const owner = parts[0];
                            const repo = parts[1];
                            const branch = decodeURIComponent(parts.slice(3).join('/'));
                            fetchUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`;
                        }
                    }
                } catch (e) {
                    console.warn("Failed to parse update URL", e);
                }
            }

            const branchRes = await fetch(fetchUrl);
            if (branchRes.ok) {
                const data = await branchRes.json();
                setLatestVersion(data.version);
                if (data.version !== '1.0.0') setUpdateStatus('available');
                else setUpdateStatus('latest');
                return;
            }

            throw new Error("Could not fetch package.json");
        } catch (e) {
            setUpdateStatus('error');
        }
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
                <h3 className={`text-xl font-bold mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Quick Capture</h3>
                <div className={`p-4 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <p className={`font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Global Shortcut</p>
                        <button
                            onClick={() => setIsRecording(true)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold w-48 text-center border focus:outline-none focus:ring-2 transition-all ${
                                isRecording 
                                    ? 'bg-red-100 text-red-600 border-red-300 ring-red-200 animate-pulse' 
                                    : (isCyberpunk 
                                        ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 focus:ring-[#00f0ff]' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:ring-blue-500')
                            }`}
                        >
                            {isRecording ? 'Press keys...' : (quickCaptureShortcut || 'Click to Record')}
                        </button>
                        {isRecording && <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsRecording(false)} />}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Instantly capture ideas, tasks, or notes from anywhere on your computer. Use standard Electron Accelerator format (e.g. CommandOrControl+Shift+O).
                    </p>
                    <p className="mt-3 text-right">
                        <button onClick={handleTestQuickCapture} className={`text-xs font-bold hover:underline ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400'}`}>Test Trigger</button>
                    </p>
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

            <div className={`p-6 rounded-2xl border shadow-sm ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <h3 className={`text-xl font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update App</h3>
                <p className={`text-sm mb-6 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>
                    Update FocusFlow to the latest version. Your data will be preserved.
                </p>
                
                <div className="space-y-4">
                    <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex-1 mr-4">
                            <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update Source</div>
                            <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Branch name or full GitHub URL</div>
                        </div>
                        <input 
                            type="text" 
                            value={updateBranch}
                            onChange={(e) => { setUpdateBranch(e.target.value); localStorage.setItem('focusflow_update_branch', e.target.value); }}
                            placeholder="main or https://github.com/..."
                            className={`px-3 py-1.5 rounded-lg text-sm border focus:outline-none w-64 ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                        />
                    </div>

                    <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                        <div>
                            <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Check for Updates</div>
                            <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>
                                {updateStatus === 'idle' && 'Current version: 1.0.0'}
                                {updateStatus === 'checking' && 'Checking...'}
                                {updateStatus === 'latest' && `Up to date (${latestVersion})`}
                                {updateStatus === 'available' && `Update available: ${latestVersion}`}
                                {updateStatus === 'error' && 'Could not fetch info'}
                            </div>
                        </div>
                        <button onClick={checkForUpdates} disabled={updateStatus === 'checking'} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30 disabled:opacity-50' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}>
                            {updateStatus === 'checking' ? 'Checking...' : 'Check Now'}
                        </button>
                    </div>

                    <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                        <div>
                            <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update from Local File</div>
                            <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Select a .dmg, .pkg, or .zip file</div>
                        </div>
                        <button onClick={async () => { const path = await (window.electronAPI as any)?.selectUpdateFile(); if (path) (window.electronAPI as any)?.installUpdate(path); }} className={`px-4 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Select File</button>
                    </div>

                    <div className={`p-4 rounded-xl border flex justify-between items-center ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                        <div>
                            <div className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Update from GitHub</div>
                            <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Download latest release</div>
                        </div>
                        <button onClick={() => (window.electronAPI as any)?.openExternal('https://github.com/pashazaseh/copy-of-focusflow-3/releases')} className={`px-4 py-2 rounded-lg text-sm font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Open GitHub</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
