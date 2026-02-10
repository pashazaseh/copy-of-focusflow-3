import React from 'react';

interface TimerDisplayProps {
  mode: 'POMO' | 'STOPWATCH';
  timeLeft: number;
  initialTime: number;
  phase: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  isActive: boolean;
  isCyberpunk: boolean;
  formatTime: (seconds: number) => string;
  isGhost?: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  mode,
  timeLeft,
  initialTime,
  phase,
  isActive,
  isCyberpunk,
  formatTime,
  isGhost = false,
}) => {
  const progress =
    mode === 'POMO'
      ? initialTime > 0 ? (initialTime - timeLeft) / initialTime : 0
      : (timeLeft % 60) / 60;

  const getPhaseLabel = () => {
      if (mode === 'STOPWATCH') return 'Stopwatch';
      if (phase === 'FOCUS') return 'Focus';
      if (phase === 'SHORT_BREAK') return 'Break';
      if (phase === 'LONG_BREAK') return 'Long Break';
      return '';
  };

  const radius = isGhost ? 85 : 110;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const phaseColorClass = () => {
    if (mode === 'STOPWATCH') return isCyberpunk ? 'text-orange-400' : 'text-orange-500';
    switch (phase) {
        case 'FOCUS': return isCyberpunk ? 'text-cyan-400' : 'text-blue-500';
        case 'SHORT_BREAK': return isCyberpunk ? 'text-purple-400' : 'text-green-500';
        case 'LONG_BREAK': return isCyberpunk ? 'text-indigo-400' : 'text-indigo-500';
        default: return 'text-gray-500';
    }
  };

  const phaseStrokeColor = () => {
      if (isCyberpunk) {
          if (mode === 'STOPWATCH') return 'url(#stopwatch-gradient)';
          return 'url(#progress-gradient)';
      }
      if (mode === 'STOPWATCH') return '#f97316';
      switch (phase) {
          case 'FOCUS': return '#3b82f6';
          case 'SHORT_BREAK': return '#22c55e';
          case 'LONG_BREAK': return '#6366f1';
          default: return '#6b7280';
      }
  }

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = i * 6;
    const isFiveMinMark = i % 5 === 0;
    const center = isGhost ? 100 : 120;
    return (
        <line
            key={i}
            x1={center}
            y1="5"
            x2={center}
            y2={isFiveMinMark ? (isGhost ? 14 : 18) : (isGhost ? 10 : 12)}
            strokeWidth={isFiveMinMark ? (isGhost ? 1.5 : 2) : 1}
            className={isCyberpunk ? "stroke-cyan-400/20" : "stroke-gray-300 dark:stroke-gray-600"}
            style={{ transform: `rotate(${angle}deg)`, transformOrigin: 'center' }}
        />
    )
  });


  return (
    <div className={`flex items-center justify-center ${isGhost ? 'relative w-full h-full' : 'relative w-96 h-96 mb-2'}`}>
        <svg className="absolute inset-0 w-full h-full" viewBox={isGhost ? "0 0 200 200" : "0 0 240 240"}>
            <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isCyberpunk ? "#00f0ff" : "#60a5fa"} />
                    <stop offset="100%" stopColor={isCyberpunk ? "#3b82f6" : "#818cf8"} />
                </linearGradient>
                <linearGradient id="stopwatch-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#facc15" /> 
                    <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <radialGradient id="blue-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(0, 120, 255, 0.7)" />
                    <stop offset="100%" stopColor="rgba(0, 120, 255, 0)" />
                </radialGradient>
                <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="background-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="15" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <circle
                cx={isGhost ? 100 : 120}
                cy={isGhost ? 100 : 120}
                r={radius}
                fill="url(#blue-glow)"
                className={isCyberpunk && isActive ? 'animate-pulse' : 'opacity-0'}
                filter="url(#background-glow-filter)"
            />

            {!isGhost && <g>{ticks}</g>}

            <g style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}>
                <circle
                    cx={isGhost ? 100 : 120}
                    cy={isGhost ? 100 : 120}
                    r={radius}
                    strokeWidth={isGhost ? 8 : 12}
                    fill="transparent"
                    className={isCyberpunk ? "stroke-cyan-400/10" : "stroke-gray-200 dark:stroke-gray-700/50"}
                />
                <circle
                    cx={isGhost ? 100 : 120}
                    cy={isGhost ? 100 : 120}
                    r={radius}
                    strokeWidth={isGhost ? 8 : 12}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                    stroke={phaseStrokeColor()}
                    className={`${isActive ? 'animate-pulse' : ''}`}
                    filter={"url(#glow-filter)"}
                />
            </g>
        </svg>
        <div className="z-10 flex flex-col items-center justify-center text-center">
            <div className={`font-orbitron font-bold tracking-tighter tabular-nums transition-colors ${isGhost ? 'text-5xl' : 'text-6xl'} ${
                isCyberpunk
                    ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                    : 'text-gray-800 dark:text-white'
            }`}>
                {formatTime(timeLeft)}
            </div>
            <div className={`font-space-mono text-center text-xs font-bold uppercase tracking-[0.3em] mt-2 transition-colors ${
                isActive ? phaseColorClass() : 'text-gray-400 dark:text-gray-600'
            }`}>
                {getPhaseLabel()}
            </div>
        </div>
    </div>
  );
};
