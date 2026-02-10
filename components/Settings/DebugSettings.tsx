import React from 'react';
import { SidebarConfig, MenuBarConfig, AppTheme } from '../../types';

interface DebugSettingsProps {
    sidebarConfig: SidebarConfig;
    menuBarConfig: MenuBarConfig;
    appTheme: AppTheme;
}

export const DebugSettings: React.FC<DebugSettingsProps> = ({ sidebarConfig, menuBarConfig, appTheme }) => {
    const isCyberpunk = appTheme === 'cyberpunk';

    return (
        <div className="space-y-6">
            <div className={`rounded-2xl p-6 border shadow-sm ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <h3 className={`text-xl font-bold mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Debug Information</h3>
                
                <div className="space-y-6">
                    {/* System Info */}
                    <div className={`p-4 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400'}`}>System Info</h4>
                        <div className={`text-xs font-mono space-y-1 ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500 dark:text-gray-400'}`}>
                            <p>User Agent: {navigator.userAgent}</p>
                            <p>Platform: {navigator.platform}</p>
                            <p>Screen: {window.screen.width}x{window.screen.height}</p>
                            <p>Theme: {appTheme}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className={`p-4 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400'}`}>Actions</h4>
                        <div className="flex gap-2 flex-wrap">
                            <button 
                                onClick={() => {
                                    if (Notification.permission === 'granted') {
                                        new Notification('Test Notification', { body: 'This is a debug notification.' });
                                    } else {
                                        Notification.requestPermission();
                                    }
                                }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                            >
                                Test Notification
                            </button>
                            <button 
                                onClick={() => console.log({ sidebarConfig, menuBarConfig })}
                                className={`px-4 py-2 rounded-lg text-xs font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                Log Config
                            </button>
                        </div>
                    </div>

                    {/* Config Dumps */}
                    <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400'}`}>Sidebar Configuration</h4>
                        <pre className={`p-4 rounded-xl text-xs font-mono overflow-auto max-h-60 border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 text-[#00f0ff]/80' : 'bg-gray-50 dark:bg-black/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>
                            {JSON.stringify(sidebarConfig, null, 2)}
                        </pre>
                    </div>

                    <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400'}`}>MenuBar Configuration</h4>
                        <pre className={`p-4 rounded-xl text-xs font-mono overflow-auto max-h-60 border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20 text-[#00f0ff]/80' : 'bg-gray-50 dark:bg-black/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>
                            {JSON.stringify(menuBarConfig, null, 2)}
                        </pre>
                    </div>

                    <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400'}`}>Local Storage</h4>
                        <div className={`p-4 rounded-xl text-xs font-mono overflow-auto max-h-60 border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-black/30 border-gray-200 dark:border-gray-700'}`}>
                            {Object.keys(localStorage).map(key => (
                                <div key={key} className="mb-1 break-all">
                                    <span className={`font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-600 dark:text-blue-400'}`}>{key}</span>: <span className={isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-600 dark:text-gray-400'}>{localStorage.getItem(key)?.substring(0, 100)}...</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
