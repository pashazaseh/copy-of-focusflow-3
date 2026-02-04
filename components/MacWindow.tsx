
import React, { useState } from 'react';

interface MacWindowProps {
  children: React.ReactNode;
  title?: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const MacWindow: React.FC<MacWindowProps> = ({ children, title, isDarkMode, onToggleTheme }) => {
  const [isElectron] = useState(() => typeof window !== 'undefined' && !!window.electronAPI);

  const handleClose = () => window.electronAPI?.close();
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();

  // Enforce solid backgrounds: bg-white or bg-gray-900 (removed opacity values like /80)
  const containerClass = isElectron
    ? `w-screen h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900`
    : `w-full max-w-6xl h-[85vh] rounded-xl shadow-2xl border flex flex-col overflow-hidden animate-fade-in-up bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 dark:shadow-black/50`;

  return (
    <div className={containerClass}>
      {/* Window Title Bar */}
      <div 
        className="h-10 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 shrink-0 select-none transition-colors duration-300"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div 
            className="flex space-x-2 group"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Use Native Traffic Lights in Electron, Custom in Web */}
          {isElectron ? (
             <div className="w-16 h-4" /> // Spacer for native controls
          ) : (
             <>
              <button onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500 border border-red-600/20 group-hover:bg-red-600 transition-colors shadow-sm cursor-pointer flex items-center justify-center">
                <svg className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <button onClick={handleMinimize} className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-600/20 group-hover:bg-yellow-600 transition-colors shadow-sm cursor-pointer flex items-center justify-center">
                 <svg className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
              </button>
              <button onClick={handleMaximize} className="w-3 h-3 rounded-full bg-green-500 border border-green-600/20 group-hover:bg-green-600 transition-colors shadow-sm cursor-pointer flex items-center justify-center">
                 <svg className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </button>
             </>
          )}
        </div>
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
               <defs>
                   <linearGradient id="iconGrad" x1="0" y1="0" x2="100" y2="100%">
                       <stop offset="0%" stopColor="#3b82f6" />
                       <stop offset="100%" stopColor="#8b5cf6" />
                   </linearGradient>
               </defs>
               <circle cx="50" cy="50" r="45" fill="url(#iconGrad)" />
               <path d="M35 50 L45 60 L65 40" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
           </svg>
          {title || "FocusFlow"}
        </div>
        <div 
            className="flex items-center"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <button 
                onClick={onToggleTheme}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors"
                aria-label="Toggle Dark Mode"
            >
                {isDarkMode ? (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
            </button>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {children}
      </div>
    </div>
  );
};
