import React, { useState, useEffect } from 'react';

export const QuickTimerOverlay: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [duration, setDuration] = useState(0);
    const [cursor, setCursor] = useState({ x: 0, y: 0 });
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [trayPos, setTrayPos] = useState<{x: number, y: number} | null>(null);
    
    // Config
    const PIXELS_PER_MINUTE = 5; // Sensitivity for the pull
    
    // Handle Esc to cancel
    useEffect(() => {
        // Ensure transparent background
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';

        const handleTrayPos = (e: Event) => {
            const customEvent = e as CustomEvent;
            const pos = customEvent.detail;
            setTrayPos(pos);
            setStartPoint(pos);
            setCursor(pos);
            setIsDragging(true); // Auto-start dragging when triggered from tray
        };
        window.addEventListener('tray-position', handleTrayPos);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                window.electronAPI?.cancelQuickTimer();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('tray-position', handleTrayPos);
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.backgroundColor = '';
            document.documentElement.style.backgroundColor = '';
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only start if clicked near top
        if (e.clientY > 200) {
            window.electronAPI?.cancelQuickTimer();
            return;
        }
        
        setIsDragging(true);
        // Anchor to tray position if available, otherwise cursor X at top
        setStartPoint({ 
            x: trayPos ? trayPos.x : e.clientX, 
            y: trayPos ? trayPos.y : 0 
        });
        setCursor({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        
        // Calculate distance based on pull vector
        const dy = e.clientY - startPoint.y;
        const dx = e.clientX - startPoint.x;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const mins = Math.max(1, Math.round(distance / PIXELS_PER_MINUTE));
        
        setDuration(mins);
        setCursor({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        if (isDragging && duration > 0) {
            window.electronAPI?.startQuickTimer(duration);
        } else {
            window.electronAPI?.cancelQuickTimer();
        }
        setIsDragging(false);
        setDuration(0);
    };

    const getEndTime = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + duration);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div 
            className="w-screen h-screen bg-transparent select-none cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Visuals */}
            {isDragging && (
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none drop-shadow-xl">
                    <defs>
                        <linearGradient id="cordGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#60A5FA" />
                            <stop offset="100%" stopColor="#2563EB" />
                        </linearGradient>
                    </defs>

                    {/* Anchor Point */}
                    <circle cx={startPoint.x} cy={startPoint.y} r="4" fill="#2563EB" />

                    {/* The Cord (Straight Line for tension) */}
                    <line 
                        x1={startPoint.x} y1={startPoint.y} 
                        x2={cursor.x} y2={cursor.y}
                        stroke="url(#cordGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    
                    {/* The Handle / Bubble */}
                    <g transform={`translate(${cursor.x}, ${cursor.y})`}>
                        <circle r="40" fill="#3B82F6" fillOpacity="0.2" className="animate-pulse" />
                        <circle r="32" fill="#2563EB" className="drop-shadow-lg" />
                        <text 
                            y="-5" 
                            textAnchor="middle" 
                            fill="white" 
                            fontSize="20" 
                            fontWeight="bold"
                            className="font-mono tracking-tighter"
                        >
                            {duration}m
                        </text>
                        <text 
                            y="14" 
                            textAnchor="middle" 
                            fill="white" 
                            fillOpacity="0.9"
                            fontSize="10" 
                            fontWeight="medium"
                        >
                            Ends {getEndTime()}
                        </text>
                    </g>
                </svg>
            )}

            {/* Ripple Effect around Tray Icon */}
            {!isDragging && trayPos && (
                <div 
                    className="absolute pointer-events-none"
                    style={{
                        top: trayPos.y,
                        left: trayPos.x,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 40
                    }}
                >
                    <div className="absolute inset-0 w-8 h-8 -ml-4 -mt-4 bg-blue-500/40 rounded-full animate-ping"></div>
                    <div className="absolute inset-0 w-24 h-24 -ml-12 -mt-12 border-2 border-blue-400/30 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                </div>
            )}

            {!isDragging && (
                <div 
                    className="absolute pointer-events-none flex justify-center"
                    style={{
                        top: trayPos ? (trayPos.y + 25) : 10,
                        left: trayPos ? trayPos.x : '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 50
                    }}
                >
                    <div className="bg-black/40 backdrop-blur-md text-white p-2 rounded-full shadow-lg border border-white/10 animate-bounce text-xl">
                        👇
                    </div>
                </div>
            )}
        </div>
    );
};
