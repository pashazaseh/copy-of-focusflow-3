import React, { useRef, useEffect, useState } from 'react';
import { playSpinTick } from '../services/audioService';

interface TimeWheelProps {
    items: number[];
    selectedValue: number;
    onChange: (value: number) => void;
    label?: string;
    icon?: React.ReactNode;
    className?: string;
    activeTextColor?: string;
    labelPosition?: 'left' | 'right' | 'top' | 'bottom' | 'overlay';
    onInteractionStart?: () => void;
    formatItem?: (value: number) => React.ReactNode;
}

export const TimeWheel: React.FC<TimeWheelProps> = ({ items, selectedValue, onChange, label, icon, className = "w-16", activeTextColor = "text-white", labelPosition = 'left', onInteractionStart, formatItem }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef(false);
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastSoundTime = useRef<number>(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartY, setDragStartY] = useState(0);
    const [initialScrollTop, setInitialScrollTop] = useState(0);
    const ITEM_HEIGHT = 40; // h-10 corresponds to 2.5rem (40px)

    // Sync scroll position with value prop (when not scrolling manually)
    useEffect(() => {
        if (containerRef.current && !isScrolling.current && !isDragging && selectedValue !== undefined) {
            const index = items.indexOf(selectedValue);
            if (index !== -1) {
                // Use smooth scroll for updates, but instant for initial mount could be handled if needed
                containerRef.current.scrollTo({
                    top: index * ITEM_HEIGHT,
                    behavior: 'smooth'
                });
            }
        }
    }, [selectedValue, items, isDragging]);

    const playTick = () => {
        const now = Date.now();
        if (now - lastSoundTime.current > 50) { // 50ms debounce
            playSpinTick(0.15); 
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(5);
            }
            lastSoundTime.current = now;
        }
    };

    const handleScroll = () => {
        if (!containerRef.current) return;
        
        // Only set isScrolling if we are NOT dragging.
        // If we are dragging, we want the snap effect (useEffect) to run immediately after we stop dragging.
        if (!isDragging) {
            isScrolling.current = true;
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
            
            // Reset scrolling flag shortly after scroll stops to allow external updates again
            scrollTimeout.current = setTimeout(() => {
                isScrolling.current = false;
            }, 150);
        }

        const scrollTop = containerRef.current.scrollTop;
        const index = Math.round(scrollTop / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        const newValue = items[clampedIndex];

        if (newValue !== selectedValue) {
            onChange(newValue);
            playTick();
        }
    };

    const isRightLabel = labelPosition === 'right';
    const isOverlay = labelPosition === 'overlay';
    const isTopLabel = labelPosition === 'top';

    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            if (isDragging && containerRef.current) {
                e.preventDefault();
                const deltaY = e.clientY - dragStartY;
                containerRef.current.scrollTop = initialScrollTop - deltaY;
            }
        };

        const handleWindowMouseUp = () => {
            if (isDragging) setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [isDragging, dragStartY, initialScrollTop]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (containerRef.current) {
            setIsDragging(true);
            setDragStartY(e.clientY);
            setInitialScrollTop(containerRef.current.scrollTop);
        }
    };

    return (
        <div className={`group ${isOverlay ? 'relative flex justify-center' : (isTopLabel ? 'relative flex flex-col items-center gap-1' : 'flex items-center gap-2')}`} onMouseDown={onInteractionStart} onTouchStart={onInteractionStart}>
            {!isRightLabel && !isOverlay && (icon ? (
                <div className="text-gray-500 dark:text-gray-400 transition-colors group-hover:text-white" title={label}>{icon}</div>
            ) : (
                label && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none transition-colors group-hover:text-white">{label}</span>
            ))}
            
            {isOverlay && icon && (
                <div className="absolute top-0 right-0 z-20 pointer-events-none text-gray-500 dark:text-gray-600 transition-colors group-hover:text-white opacity-60 group-hover:opacity-100 p-1">
                    {icon}
                </div>
            )}
            
            <div className="relative">
            {/* Inline style for scrollbar hiding to ensure it works without external plugins */}
            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            
            <div 
                ref={containerRef}
                className={`relative h-16 overflow-y-scroll scrollbar-hide no-scrollbar py-3 ${className} ${isDragging ? 'cursor-grabbing' : 'cursor-grab snap-y snap-mandatory'}`}
                onScroll={handleScroll}
                onMouseDown={handleMouseDown}
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
                }}
            >
                {items.map((item) => (
                    <div 
                        key={item}
                        data-active={item === selectedValue}
                        className={`h-10 flex items-center justify-center text-lg font-mono snap-center transition-all duration-200 cursor-pointer select-none scale-90 hover:opacity-50 data-[active=true]:opacity-100 data-[active=true]:font-bold data-[active=true]:scale-110 ${item === selectedValue ? activeTextColor : 'text-gray-400 opacity-30'}`}
                        onClick={() => onChange(item)}
                    >
                        {formatItem ? formatItem(item) : item.toString().padStart(2, '0')}
                    </div>
                ))}
            </div>
        </div>
            <div className={`flex flex-col items-center justify-center text-gray-700 dark:text-gray-600 opacity-40 group-hover:opacity-100 transition-all duration-300 pointer-events-none ${isRightLabel ? '-order-1 mr-1' : ''} ${isOverlay ? 'absolute left-0 top-1/2 -translate-y-1/2 z-20' : ''} ${isTopLabel ? 'absolute -right-1 top-1/2 -translate-y-1/2' : ''}`}>
                <svg className="w-2.5 h-2.5 group-hover:-translate-y-0.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                <svg className="w-2.5 h-2.5 -mt-1 group-hover:translate-y-0.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {isRightLabel && !isOverlay && (icon ? (
                <div className="text-gray-500 dark:text-gray-400 transition-colors group-hover:text-white" title={label}>{icon}</div>
            ) : (
                label && <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 select-none writing-vertical-rl rotate-180 transition-colors group-hover:text-white" style={{ writingMode: 'vertical-rl' }}>{label}</span>
            ))}
        </div>
    );
};