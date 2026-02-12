import React from 'react';

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-gray-500/80 dark:text-gray-400/80 col-span-full">
        {children}
    </h3>
);

export const ConfigurationSettings: React.FC = () => {
    const [openAtLogin, setOpenAtLogin] = React.useState(false);
    const [showInDock, setShowInDock] = React.useState(true);
    const [minimizeToTray, setMinimizeToTray] = React.useState(true);

    React.useEffect(() => {
        if (window.electronAPI?.getOpenAtLogin) {
            window.electronAPI.getOpenAtLogin().then(setOpenAtLogin);
        }
    }, []);

    const handleSetOpenAtLogin = (enabled: boolean) => {
        setOpenAtLogin(enabled);
        window.electronAPI?.setOpenAtLogin?.(enabled);
    };

    const handleShowInDock = (enabled: boolean) => {
        setShowInDock(enabled);
        window.electronAPI?.setShowInDock?.(enabled);
    };

    const handleMinimizeToTray = (enabled: boolean) => {
        setMinimizeToTray(enabled);
        window.electronAPI?.setMinimizeToTray?.(enabled);
    };

    const isCyberpunk = false; // Replace with your theme logic
    const cardBaseClass = isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    const controlBgClass = isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* SYSTEM INTEGRATION */}
            <div className={`${cardBaseClass} rounded-2xl p-4 border shadow-sm h-full`}>
                <SectionHeader>System Integration</SectionHeader>
                <div className="flex flex-col gap-4">
                    {/* Open at Login */}
                    <div className={`flex justify-between items-center p-3 rounded-xl border ${controlBgClass}`}>
                        <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">Open at Login</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Start FocusFlow automatically</p>
                        </div>
                        <button
                            onClick={() => handleSetOpenAtLogin(!openAtLogin)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${openAtLogin ? (isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.6)] focus:ring-[#00f0ff] focus:ring-offset-black' : 'bg-blue-600 focus:ring-blue-500') : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${openAtLogin ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {/* Show in Dock (macOS only) */}
                    {window.electronAPI?.platform === 'darwin' && (
                        <div className={`flex justify-between items-center p-3 rounded-xl border ${controlBgClass}`}>
                            <div>
                                <p className="font-semibold text-sm text-gray-900 dark:text-white">Show in Dock</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Toggle app visibility in Dock</p>
                            </div>
                            <button
                                onClick={() => handleShowInDock(!showInDock)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${showInDock ? (isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.6)] focus:ring-[#00f0ff] focus:ring-offset-black' : 'bg-blue-600 focus:ring-blue-500') : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showInDock ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    )}
                    {/* Minimize to Tray */}
                    <div className={`flex justify-between items-center p-3 rounded-xl border ${controlBgClass}`}>
                        <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">Minimize to Menu Bar</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Close button hides window</p>
                        </div>
                        <button
                            onClick={() => handleMinimizeToTray(!minimizeToTray)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${minimizeToTray ? (isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.6)] focus:ring-[#00f0ff] focus:ring-offset-black' : 'bg-blue-600 focus:ring-blue-500') : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${minimizeToTray ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};