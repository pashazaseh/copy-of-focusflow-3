import React, { useState, useRef } from 'react';
import { playPickerTick } from '../../services/audioService';

export const RubberBandTimer: React.FC = () => {
    const [startY, setStartY] = useState<number | null>(null);
    const [currentY, setCurrentY] = useState<number | null>(null);
    const [minutes, setMinutes] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const lastHapticTime = useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartY(e.clientY);
        setCurrentY(e.clientY);
        setMinutes(0);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || startY === null) return;
        
        setCurrentY(e.clientY);
        const dy = Math.max(0, e.clientY - startY);
        
        // Map every 10px to 1 minute
        const rawMinutes = Math.floor(dy / 10);
        const newMinutes = Math.max(0, Math.min(240, rawMinutes)); // Cap at 240m

        if (newMinutes !== minutes) {
            setMinutes(newMinutes);
            
            // Haptic feedback
            const now = Date.now();
            if (now - lastHapticTime.current > 50) {
                playPickerTick(0.3);
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(5);
                }
                lastHapticTime.current = now;
            }
        }
    };

    const handleFinish = () => {
        if (!isDragging) return;
        
        setIsDragging(false);
        setStartY(null);
        setCurrentY(null);
        
        if (minutes > 0) {
            const api = (window as any).electronAPI;
            if (api?.startQuickTimer) api.startQuickTimer(minutes);
            else api?.send?.('quick-timer-set', minutes);
        } else {
            const api = (window as any).electronAPI;
            if (api?.cancelQuickTimer) api.cancelQuickTimer();
            else api?.send?.('quick-timer-cancel');
        }
        setMinutes(0);
    };

    const getColor = (m: number) => {
        if (m < 25) return '#00f0ff'; // Neon Cyan
        if (m < 45) return '#ff00ff'; // Neon Magenta
        return '#ff0055'; // Neon Red
    };
    const color = getColor(minutes);

    const renderTicks = () => {
        if (startY === null || currentY === null) return null;
        const dy = currentY - startY;
        const tickInterval = 50; // 5 minutes * 10px/min
        const numTicks = Math.floor(dy / tickInterval);
        const ticks = [];

        for (let i = 1; i <= numTicks; i++) {
            const y = startY + (i * tickInterval);
            if (y < currentY - 35) {
                ticks.push(
                    <g key={i}>
                        <line 
                            x1="calc(50% - 8px)" y1={y} 
                            x2="calc(50% + 8px)" y2={y} 
                            stroke={color} strokeWidth="2" opacity="0.5"
                        />
                        {(i * 5) % 15 === 0 && (
                            <text
                                x="calc(50% + 15px)" y={y + 4}
                                fill={color} fontSize="12" opacity="0.8"
                                style={{ fontFamily: 'monospace' }}
                            >
                                {i * 5}
                            </text>
                        )}
                    </g>
                );
            }
        }
        return ticks;
    };

    return (
        <div 
            className="fixed inset-0 z-50 font-sans bg-transparent cursor-ns-resize select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleFinish}
            onMouseLeave={handleFinish}
        >
            {isDragging && startY !== null && currentY !== null && (
            <svg className="w-full h-full overflow-visible">
                <defs>
                    <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feGaussianBlur stdDeviation="4" result="coloredBlur2" />
                        <feMerge>
                            <feMergeNode in="coloredBlur2" />
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                
                <line 
                    x1="50%" 
                    y1={startY} 
                    x2="50%" 
                    y2={currentY} 
                    stroke={color} 
                    strokeWidth="3" 
                    strokeLinecap="round"
                    style={{ filter: `url(#neon-glow)` }}
                />
                
                {renderTicks()}
                
                <g>
                    <circle cx="50%" cy={currentY} r="32" fill="rgba(10, 10, 10, 0.9)" stroke={color} strokeWidth="2" filter="url(#neon-glow)" />
                    <text 
                        x="50%" 
                        y={currentY + 8} 
                        textAnchor="middle" 
                        fill={color} 
                        fontSize="20" 
                        fontWeight="bold"
                        style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', textShadow: `0 0 5px ${color}` }}
                    >
                        {minutes}m
                    </text>
                </g>
            </svg>
            )}
            
            {!isDragging && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[#00f0ff] text-lg font-bold font-mono animate-pulse" style={{ textShadow: '0 0 10px #00f0ff' }}>
                    DRAG TO SET TIMER
                </div>
            )}
        </div>
    );
};
