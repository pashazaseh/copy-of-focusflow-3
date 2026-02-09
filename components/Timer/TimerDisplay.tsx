import React from 'react';

type TimerMode = 'POMO' | 'STOPWATCH';
type TimerPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

interface TimerDisplayProps {
  timeLeft: number;
  initialTime: number;
  mode: TimerMode;
  phase: TimerPhase;
  isActive: boolean;
  isCyberpunk: boolean;
  radius?: number;
  formatTime: (seconds: number) => string;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  timeLeft,
  initialTime,
  mode,
  phase,
  isActive,
  isCyberpunk,
  radius = 95,
  formatTime
}) => {
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

  return (
    <div className="relative w-full max-w-[380px] aspect-square flex items-center justify-center mb-4 group">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isCyberpunk ? "#00f0ff" : "#60A5FA"} />
            <stop offset="100%" stopColor={isCyberpunk ? "#0099ff" : "#3B82F6"} />
          </linearGradient>
          <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="stopwatchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="urgentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isCyberpunk ? "#ff0055" : "#F87171"} />
            <stop offset="100%" stopColor={isCyberpunk ? "#ff0000" : "#EF4444"} />
          </linearGradient>
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
  );
};

export default TimerDisplay;
