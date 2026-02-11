import React, { useState, useEffect, useRef } from 'react';

const easeOutElastic = (x: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return x === 0
      ? 0
      : x === 1
      ? 1
      : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
};

export const QuickTimerOverlay: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [isSnapping, setIsSnapping] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [cursor, setCursor] = useState({ x: 0, y: 0 });

    // Refs to access latest state in event handlers without re-binding
    const startPointRef = useRef({ x: 0, y: 0 });
    const cursorRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleTrayPosition = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { x, y } = customEvent.detail;
            
            console.log("Tray Position Received:", { x, y });

            const point = { x, y };
            setStartPoint(point);
            setCursor(point);
            startPointRef.current = point;
            cursorRef.current = point;

            setIsDragging(true);
        };

        window.addEventListener('tray-position', handleTrayPosition);
        return () => window.removeEventListener('tray-position', handleTrayPosition);
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newCursor = { x: e.clientX, y: e.clientY };
            setCursor(newCursor);
            cursorRef.current = newCursor;
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            const start = startPointRef.current;
            const cur = cursorRef.current;
            const distance = Math.sqrt(Math.pow(cur.x - start.x, 2) + Math.pow(cur.y - start.y, 2));
            // Map distance to time: 10px = 1 minute, min 5 minutes
            const minutes = Math.max(5, Math.round(distance / 10));
            
            if (distance > 50) { // Threshold to commit
                setIsDragging(false);
                setIsSnapping(true);
                
                setTimeout(() => {
                    window.electronAPI?.startQuickTimer(minutes);
                    setIsSnapping(false);
                }, 400);
            } else {
                window.electronAPI?.cancelQuickTimer();
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    useEffect(() => {
        if (isSnapping) {
            const start = startPointRef.current;
            const initial = cursor;
            const startTime = performance.now();
            const duration = 400;

            const animate = (time: number) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = easeOutElastic(progress);
                
                setCursor({
                    x: initial.x + (start.x - initial.x) * ease,
                    y: initial.y + (start.y - initial.y) * ease
                });

                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        }
    }, [isSnapping]);

    if (!isDragging && !isSnapping) return null;

    const distance = Math.sqrt(Math.pow(cursor.x - startPoint.x, 2) + Math.pow(cursor.y - startPoint.y, 2));
    const minutes = Math.max(5, Math.round(distance / 10));
    const tension = Math.min(distance / 800, 1); // 0 to 1 based on stretch distance
    const strokeWidth = Math.max(1, 3 * (1 - tension * 0.5)); // Thins as it stretches

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
            <svg className="w-full h-full overflow-visible">
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <linearGradient id="elasticGradient" x1={startPoint.x} y1={startPoint.y} x2={cursor.x} y2={cursor.y} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.4" />
                    </linearGradient>
                </defs>
                <line 
                    x1={startPoint.x} 
                    y1={startPoint.y} 
                    x2={cursor.x} 
                    y2={cursor.y} 
                    stroke="url(#elasticGradient)" 
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    filter="url(#glow)"
                />
                <circle cx={startPoint.x} cy={startPoint.y} r="3" fill="#00f0ff" filter="url(#glow)" />
                <circle cx={cursor.x} cy={cursor.y} r="5" fill="#00f0ff" fillOpacity="0.2" stroke="#00f0ff" strokeWidth="1.5" filter="url(#glow)" />
                <circle cx={cursor.x} cy={cursor.y} r="2" fill="#fff" />
            </svg>
            {!isSnapping && (
            <div 
                className="absolute text-[#00f0ff] font-mono font-bold text-xl bg-black/90 px-4 py-2 rounded-xl backdrop-blur-md border border-[#00f0ff]/30 shadow-[0_0_20px_rgba(0,240,255,0.4)] flex flex-col items-center"
                style={{ 
                    left: cursor.x, 
                    top: cursor.y + 30, 
                    transform: 'translateX(-50%)' 
                }}
            >
                <span>{minutes}m</span>
                <div className="text-[10px] text-[#00f0ff]/60 uppercase tracking-widest mt-0.5">Release to Start</div>
            </div>
            )}
        </div>
    );
};