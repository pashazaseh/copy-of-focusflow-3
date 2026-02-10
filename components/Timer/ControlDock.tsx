import React, { useState, useRef, useEffect } from 'react';
import { TimeWheel } from '../TimeWheel';
import { TimerSettings } from '../../types';

interface ControlDockProps {
    isActive: boolean;
    isCyberpunk: boolean;
    wager: number;
    isWagerActive: boolean;
    currentGems: number;
    sessionLabel: string;
    setSessionLabel: (val: string) => void;
    onWagerLock: (amount: number) => void;
    onSettingsOpen: () => void;
    onSidebarToggle: () => void;
    onProjectSelectOpen: () => void;
    onTaskSelectOpen: () => void;
    isProjectSelectorOpen: boolean;
    isTaskSelectorOpen: boolean;
    settings: TimerSettings;
    workDuration: number;
    onWorkDurationChange: (val: number) => void;
    restDuration: number;
    onRestDurationChange: (val: number) => void;
    initialTime: number;
    handleToggleGhostMode: () => void;
    enableGhostButton: boolean;
    showSidebar: boolean;
    selectedProjectId: string;
    selectedTaskId: string;
}

export const ControlDock: React.FC<ControlDockProps> = ({
    isActive,
    isCyberpunk,
    wager,
    isWagerActive,
    currentGems,
    sessionLabel,
    setSessionLabel,
    onWagerLock,
    onSettingsOpen,
    onSidebarToggle,
    onProjectSelectOpen,
    onTaskSelectOpen,
    isProjectSelectorOpen,
    isTaskSelectorOpen,
    settings,
    workDuration,
    onWorkDurationChange,
    restDuration,
    onRestDurationChange,
    initialTime,
    handleToggleGhostMode,
    enableGhostButton,
    showSidebar,
    selectedProjectId,
    selectedTaskId
}) => {
    const [isWagerMenuOpen, setIsWagerMenuOpen] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [wagerAmount, setWagerAmount] = useState(50);
    const [isDockVisible, setIsDockVisible] = useState(false);
    const [isInteractingWithWheel, setIsInteractingWithWheel] = useState(false);
    
    const wagerMenuRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const maxWager = Math.min(500, Math.max(1, currentGems));

    useEffect(() => {
      if (wagerAmount > maxWager) {
          setWagerAmount(maxWager);
      }
    }, [maxWager, wagerAmount]);

    useEffect(() => {
        const endInteraction = () => setIsInteractingWithWheel(false);
        window.addEventListener('mouseup', endInteraction);
        window.addEventListener('touchend', endInteraction);
        return () => {
            window.removeEventListener('mouseup', endInteraction);
            window.removeEventListener('touchend', endInteraction);
        };
    }, []);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;

            if (isInteractingWithWheel) {
                setIsDockVisible(true);
                clearTimeout(timeout);
                return;
            }
  
            const mainContent = document.querySelector('.flex-1.flex.flex-col.items-center.justify-center');
            if (!mainContent) return;
            
            const rect = mainContent.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            const threshold = rect.width * 0.25;
  
            if (relativeX >= 0 && relativeX < threshold) {
                setIsDockVisible(true);
                clearTimeout(timeout);
            } else {
                clearTimeout(timeout);
                if (!isWagerMenuOpen && !isProjectSelectorOpen && !isTaskSelectorOpen && !isNoteOpen) {
                    timeout = setTimeout(() => setIsDockVisible(false), 500);
                }
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            clearTimeout(timeout);
        };
    }, [isInteractingWithWheel, isWagerMenuOpen, isProjectSelectorOpen, isTaskSelectorOpen, isNoteOpen]);

    const handleLockInBet = () => {
        onWagerLock(wagerAmount);
        setIsWagerMenuOpen(false);
    };

    return (
        <>
            {/* Dock Hover Indicator */}
            <div 
                className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1.5 h-32 rounded-r-full transition-all duration-300 cursor-pointer z-40 ${
                    (isDockVisible || isWagerMenuOpen || isProjectSelectorOpen || isTaskSelectorOpen || isNoteOpen) ? 'opacity-0 -translate-x-full' : 'opacity-100 translate-x-0'
                } ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]' : 'bg-gray-300 dark:bg-gray-600'}`}
                onMouseEnter={() => setIsDockVisible(true)}
            />

            <div ref={containerRef} className={`absolute left-6 top-1/2 transform -translate-y-1/2 w-16 h-auto min-h-[400px] py-6 bg-[#0a0a0a]/40 backdrop-blur-2xl border border-white/5 rounded-full flex flex-col items-center justify-between gap-6 shadow-2xl z-50 transition-all duration-500 ease-in-out hover:bg-[#0a0a0a]/60 ${(isDockVisible || isWagerMenuOpen || isProjectSelectorOpen || isTaskSelectorOpen || isNoteOpen) ? 'translate-x-0 opacity-100' : '-translate-x-40 opacity-0 pointer-events-none'}`}>
                {/* Top: Wager & Note */}
                <div className={`flex flex-col items-center gap-4 w-full pb-4 border-b ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-white/10'}`}>
                    <div className="relative" ref={wagerMenuRef}>
                        <button
                            onClick={() => setIsWagerMenuOpen(!isWagerMenuOpen)}
                            disabled={isActive}
                            className={`p-2 rounded-lg transition-all ${isActive ? 'opacity-50 cursor-not-allowed' : ''} ${isWagerActive || wager > 0 ? 'text-amber-400 bg-amber-400/10 shadow-[0_0_10px_rgba(251,191,36,0.2)]' : 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10'}`}
                            title="Wager"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        {isWagerMenuOpen && (
                            <div className="fixed left-24 top-0 w-16 h-full bg-[#050505]/95 backdrop-blur-3xl border border-amber-500/30 rounded-full shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)] flex flex-col items-center justify-between py-6 z-50 origin-left animate-in slide-in-from-left-4 fade-in duration-300">
                                
                                <div className="absolute -left-8 top-[60px] w-8 h-[1px] bg-amber-500/50">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,1)]"></div>
                                </div>

                                <div className="flex flex-col items-center justify-center w-full h-24 border-b border-amber-500/20 mb-2 gap-1">
                                    <span className="font-mono text-[9px] text-green-400/60 tracking-[0.2em] uppercase rotate-180" style={{ writingMode: 'vertical-rl' }}>POTENTIAL WIN</span>
                                    <div className="font-mono font-bold text-lg text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] flex flex-col items-center">
                                        <span>{Math.floor(wagerAmount * (1 + (initialTime / 60) / 120))}</span>
                                        <span className="text-xs text-green-500/50">💎</span>
                                    </div>
                                </div>

                                <div className="relative flex-1 w-full flex justify-center my-2 group">
                                    <div className="absolute inset-y-0 w-10 h-full bg-transparent flex justify-center pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                                        <div className="w-full h-full border-r border-amber-500/20"
                                            style={{
                                                backgroundImage: 'repeating-linear-gradient(to bottom, rgba(245,158,11,0.3) 0px, rgba(245,158,11,0.3) 1px, transparent 1px, transparent 10px)'
                                            }}
                                        ></div>
                                    </div>

                                    <input
                                        type="range"
                                        min={1}
                                        max={maxWager}
                                        step={1}
                                        value={wagerAmount}
                                        onChange={(e) => setWagerAmount(parseInt(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                        style={{ WebkitAppearance: 'slider-vertical' }}
                                    />
                                    
                                    <div 
                                        className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-amber-500 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.8)] border-2 border-amber-100 pointer-events-none z-10 transition-transform duration-75 ease-out flex items-center justify-center"
                                        style={{ 
                                            bottom: `calc(${((wagerAmount - 1) / (maxWager - 1 || 1)) * 100}% - 16px)` 
                                        }}
                                    >
                                        <div className="w-2 h-2 bg-white/50 rounded-full blur-[1px]" />
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center w-full h-32 border-t border-amber-500/20 pt-4 gap-4">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="font-mono text-[9px] text-amber-500/60 tracking-[0.2em] uppercase">BET</span>
                                        <span className="font-mono text-lg font-bold text-amber-400 drop-shadow-md">
                                            {wagerAmount}
                                        </span>
                                    </div>

                                    <button 
                                        onClick={handleLockInBet}
                                        className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all group"
                                        title="Lock In Bet"
                                    >
                                        <svg className="w-5 h-5 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setIsNoteOpen(!isNoteOpen)}
                            className={`p-2 rounded-lg transition-colors ${isNoteOpen ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/20' : 'text-white bg-white/20') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10')}`} 
                            title={sessionLabel || "Add Note"}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <div className={`absolute top-0 left-20 w-64 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl transition-all duration-300 origin-left ${isNoteOpen ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-4 scale-95 pointer-events-none'}`}>
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-400'}`}>Session Note</h4>
                            <textarea 
                                value={sessionLabel}
                                onChange={(e) => setSessionLabel(e.target.value)}
                                placeholder="What are you working on?"
                                className={`w-full bg-transparent border-none focus:ring-0 p-0 text-sm resize-none h-20 ${isCyberpunk ? 'text-[#00f0ff] placeholder-[#00f0ff]/30' : 'text-white placeholder-gray-500'}`}
                                autoFocus={isNoteOpen}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-4 flex-1 w-full">
                    <div className="flex flex-col items-center gap-2">
                        <TimeWheel 
                            items={settings.quickDurations || [15, 25, 30, 45, 60, 90]} 
                            selectedValue={workDuration} 
                            onChange={onWorkDurationChange} 
                            label="Focus"
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                            labelPosition="top"
                            className="w-14"
                            onInteractionStart={() => setIsInteractingWithWheel(true)}
                            activeTextColor={isCyberpunk ? "text-[#00f0ff] [filter:drop-shadow(0_0_8px_rgba(0,240,255,0.8))]" : "text-blue-400"}
                        />
                        <TimeWheel 
                            items={settings.shortBreakPresets || [5, 10, 15, 20, 30]} 
                            selectedValue={restDuration} 
                            onChange={onRestDurationChange} 
                            label="Rest"
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" /></svg>}
                            labelPosition="top"
                            onInteractionStart={() => setIsInteractingWithWheel(true)}
                            className="w-14" 
                            activeTextColor={isCyberpunk ? "text-[#00ff00] [filter:drop-shadow(0_0_8px_rgba(74,222,128,0.8))]" : "text-green-400"} 
                        />
                    </div>
                </div>

                <div className={`flex flex-col items-center gap-4 w-full pt-4 border-t ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-white/10'}`}>
                    <div className="relative group">
                        <button 
                            onClick={onProjectSelectOpen}
                            disabled={isActive}
                            className={`p-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${isActive ? 'opacity-50 cursor-not-allowed' : (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-white/80 bg-white/5 hover:bg-white/10 hover:text-white hover:shadow-lg')} ${(!selectedProjectId || selectedProjectId === 'all') && !isActive ? 'animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </button>
                    </div>
                    
                    <div className="relative group">
                        <button 
                            onClick={onTaskSelectOpen}
                            disabled={isActive}
                            className={`p-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${isActive ? 'opacity-50 cursor-not-allowed' : (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-white/80 bg-white/5 hover:bg-white/10 hover:text-white hover:shadow-lg')} ${!selectedTaskId && !isActive ? 'animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>

                    <div className="w-8 h-px bg-white/10 my-1"></div>

                    <button onClick={onSettingsOpen} className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:text-white hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Settings">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    {enableGhostButton && (
                        <button onClick={handleToggleGhostMode} className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:text-white hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Ghost Mode">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </button>
                    )}
                    <button onClick={onSidebarToggle} className={`p-2 rounded-lg transition-colors ${showSidebar ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10' : 'text-blue-400 bg-blue-500/10') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-white hover:bg-[#00f0ff]/10' : 'text-white/60 hover:text-white hover:bg-white/10')}`} title="Toggle Sidebar">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M21 18H3"/></svg>
                    </button>
                </div>
            </div>
        </>
    );
};
