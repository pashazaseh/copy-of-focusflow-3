import React, { useState, useEffect, useRef } from 'react';

export const QuickTimerOverlay: React.FC = () => {
    const [trayPos, setTrayPos] = useState<{ x: number, y: number } | null>(null);
    const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);
    const [minutes, setMinutes] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Refs to access latest state in event handlers without re-binding listeners
    const stateRef = useRef({
        trayPos: null as { x: number, y: number } | null,
        minutes: 0,
        isDragging: false
    });

    useEffect(() => {
        stateRef.current = { trayPos, minutes, isDragging };
    }, [trayPos, minutes, isDragging]);

    useEffect(() => {
        const handleTrayPos = (e: CustomEvent) => {
            const { x, y } = e.detail;
            setTrayPos({ x, y });
            setCursorPos({ x, y });
            setMinutes(0);
            setIsDragging(true);
            stateRef.current = { trayPos: { x, y }, minutes: 0, isDragging: true };
        };

        window.addEventListener('tray-position', handleTrayPos as any);
        return () => window.removeEventListener('tray-position', handleTrayPos as any);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!stateRef.current.isDragging || !stateRef.current.trayPos) return;
            
            setCursorPos({ x: e.clientX, y: e.clientY });

            const tray = stateRef.current.trayPos;
            const dy = Math.max(0, e.clientY - tray.y);
            
            // Physics: Bezier Resistance
            // We want the timer duration to increase quickly at first, then slow down (resistance).
            // This mimics a rubber band getting tighter.
            
            const MAX_PIXELS = 600; // Distance to reach "max" standard time
            const MAX_MINUTES = 60; 
            
            // Normalized drag distance (0 to 1)
            const t = Math.min(dy / MAX_PIXELS, 1);
            
            // Cubic Ease-Out: 1 - (1-t)^3
            // Slope starts high and decreases to 0.
            const easedT = 1 - Math.pow(1 - t, 3);
            
            let rawMinutes = easedT * MAX_MINUTES;
            
            // Over-drag logic: If dragging beyond MAX_PIXELS, add time linearly but very slowly
            if (dy > MAX_PIXELS) {
                const extraPixels = dy - MAX_PIXELS;
                rawMinutes += extraPixels / 20; // 1 min per 20px
            }

            // Snapping logic
            let snapped = 0;
            if (rawMinutes <= 15) {
                snapped = Math.round(rawMinutes); // 1m increments
            } else if (rawMinutes <= 45) {
                snapped = Math.round(rawMinutes / 5) * 5; // 5m increments
            } else {
                snapped = Math.round(rawMinutes / 10) * 10; // 10m increments
            }
            
            setMinutes(Math.max(0, snapped));
            stateRef.current.minutes = Math.max(0, snapped);
        };

        const handleMouseUp = () => {
            if (!stateRef.current.isDragging) return;

            const mins = stateRef.current.minutes;
            setIsDragging(false);
            setTrayPos(null); // Clear visuals immediately
            setCursorPos(null);
            stateRef.current.isDragging = false;
            setMinutes(0);
            stateRef.current.minutes = 0;
            
            if (mins > 0) {
                (window as any).electronAPI?.send?.('quick-timer-set', mins);
            } else {
                (window as any).electronAPI?.send?.('quick-timer-cancel');
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsDragging(false);
                stateRef.current.isDragging = false;
                setTrayPos(null);
                setCursorPos(null);
                (window as any).electronAPI?.send?.('quick-timer-cancel');
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // Listeners bound once, using refs for state access

    if (!trayPos || !cursorPos) return null;

    const dy = cursorPos.y - trayPos.y;
    const dx = cursorPos.x - trayPos.x;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Dynamic color interpolation
    const getColor = (m: number) => {
        if (m <= 15) return '#34d399'; // Green
        if (m <= 45) return '#fbbf24'; // Yellow
        return '#f87171'; // Red
    };
    
    const color = getColor(minutes);

    return (
        <div className="fixed inset-0 z-50 pointer-events-none font-sans">
            <svg className="w-full h-full overflow-visible">
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                
                {/* Rubber Band Line */}
                <line 
                    x1={trayPos.x} 
                    y1={trayPos.y} 
                    x2={cursorPos.x} 
                    y2={cursorPos.y} 
                    stroke={color} 
                    strokeWidth={Math.max(2, 6 - distance / 200)} 
                    strokeOpacity={0.8}
                    strokeLinecap="round"
                />
                
                {/* Drag Handle / Bubble */}
                <g transform={`translate(${cursorPos.x}, ${cursorPos.y})`}>
                    <circle r="28" fill="rgba(20, 20, 20, 0.9)" stroke={color} strokeWidth="3" filter="url(#glow)" />
                    <text 
                        x="0" 
                        y="6" 
                        textAnchor="middle" 
                        fill="white" 
                        fontSize="16" 
                        fontWeight="bold"
                        style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, sans-serif' }}
                    >
                        {minutes}m
                    </text>
                </g>
            </svg>
            
            {/* Helper Text */}
            {minutes === 0 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white/70 text-lg font-medium animate-pulse drop-shadow-md">
                    Drag down to set timer
                </div>
            )}
        </div>
    );
};