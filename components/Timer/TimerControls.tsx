import React from 'react';

type TimerMode = 'POMO' | 'STOPWATCH';
type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

interface TimerModeTabsProps {
    mode: TimerMode;
    onModeSwitch: (mode: TimerMode) => void;
    isCyberpunk: boolean;
}

export const TimerModeTabs: React.FC<TimerModeTabsProps> = ({ mode, onModeSwitch, isCyberpunk }) => {
    return (
        <div className={`flex p-1.5 rounded-2xl mb-10 ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
            <button onClick={() => onModeSwitch('POMO')} className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'POMO' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.5)]' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200')}`}>Pomodoro</button>
            <button onClick={() => onModeSwitch('STOPWATCH')} className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'STOPWATCH' ? (isCyberpunk ? 'bg-[#f0f]/20 text-[#f0f] shadow-[0_0_15px_rgba(255,0,255,0.5)]' : 'bg-white dark:bg-gray-700 text-orange-500 dark:text-white shadow-sm') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200')}`}>Stopwatch</button>
        </div>
    );
};

interface TimerActionButtonsProps {
    isActive: boolean;
    mode: TimerMode;
    phase: TimerPhase;
    timeLeft: number;
    onToggle: () => void;
    onReset: () => void;
    onStopwatchFinish: () => void;
    isCyberpunk: boolean;
}

export const TimerActionButtons: React.FC<TimerActionButtonsProps> = ({
    isActive,
    mode,
    phase,
    timeLeft,
    onToggle,
    onReset,
    onStopwatchFinish,
    isCyberpunk,
}) => {
    return (
        <div className="flex items-center gap-6">
            <button onClick={onReset} className={`p-4 rounded-full transition-all active:scale-95 shadow-sm hover:shadow-md ${isCyberpunk ? 'bg-black border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10 shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'bg-gray-100 dark:bg-[#1c1c1e] hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
            <button onClick={onToggle} className={`h-24 w-24 rounded-full font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${isCyberpunk ? 'bg-black border-2 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:bg-[#00f0ff] hover:text-black' : (mode === 'STOPWATCH' ? 'bg-orange-500 hover:bg-orange-600' : (phase === 'FOCUS' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'))}`}>{isActive ? 
                (<svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>) : 
                (<svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>)}
            </button>
            {mode === 'STOPWATCH' && (isActive || timeLeft > 0) ? (<button onClick={onStopwatchFinish} className="p-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-all active:scale-95" title="Save & Finish"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></button>) : <div className="w-14 h-14"></div>}
        </div>
    );
};
