import React, { useState, useEffect } from 'react';
import { StoredNavConfig, NAV_ITEMS_DEF } from '../Sidebar';
import { MenuBarConfig, MenuBarMode, SidebarConfig, AppTheme, WidgetSize, CountdownItem } from '../../types';

interface GeneralSettingsProps {
    navConfig: StoredNavConfig[];
    onUpdateNavConfig: (config: StoredNavConfig[]) => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    appTheme: AppTheme;
    setAppTheme: (theme: AppTheme) => void;
    inventory: Record<string, any>;
    sidebarConfig: SidebarConfig;
    onUpdateSidebarConfig: (config: SidebarConfig) => void;
    menuBarConfig: MenuBarConfig;
    onUpdateMenuBarConfig: (config: MenuBarConfig) => void;
    countdowns: CountdownItem[];
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
    navConfig,
    onUpdateNavConfig,
    isDarkMode,
    onToggleTheme,
    appTheme,
    setAppTheme,
    inventory,
    sidebarConfig,
    onUpdateSidebarConfig,
    menuBarConfig,
    onUpdateMenuBarConfig,
    countdowns
}) => {
    const isCyberpunk = appTheme === 'cyberpunk';
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [draggingWidgetIndex, setDraggingWidgetIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggingIndex(index);
        e.dataTransfer.effectAllowed = "move";
        const ghost = document.createElement('div');
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.width = '200px';
        ghost.style.height = '40px';
        ghost.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        ghost.style.border = '2px dashed rgba(59, 130, 246, 0.5)';
        ghost.style.borderRadius = '12px';
        ghost.style.display = 'flex';
        ghost.style.alignItems = 'center';
        ghost.style.justifyContent = 'center';
        ghost.style.fontSize = '14px';
        ghost.style.fontWeight = '600';
        ghost.style.color = '#3b82f6';
        ghost.textContent = '↕️ Moving...';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 100, 20);
        setTimeout(() => {
            if (document.body.contains(ghost)) document.body.removeChild(ghost);
        }, 100);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggingIndex === null || draggingIndex === index) return;
        const newConfig = [...navConfig];
        const draggedItem = newConfig[draggingIndex];
        newConfig.splice(draggingIndex, 1);
        newConfig.splice(index, 0, draggedItem);
        onUpdateNavConfig(newConfig);
        setDraggingIndex(index);
    };

    const handleDragEnd = () => setDraggingIndex(null);

    const handleWidgetDragStart = (e: React.DragEvent, index: number) => {
        setDraggingWidgetIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleWidgetDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggingWidgetIndex === null || draggingWidgetIndex === index) return;
        const currentOrder = sidebarConfig.widgetOrder || [
            'showTimerWidget', 'showQuestsWidget', 'showCountdownWidget', 
            'showDailyGoalWidget', 'showWeeklyGoalWidget', 'showMonthlyGoalWidget'
        ];
        const newOrder = [...currentOrder];
        const draggedItem = newOrder[draggingWidgetIndex];
        newOrder.splice(draggingWidgetIndex, 1);
        newOrder.splice(index, 0, draggedItem);
        onUpdateSidebarConfig({ ...sidebarConfig, widgetOrder: newOrder });
        setDraggingWidgetIndex(index);
    };

    const handleWidgetDragEnd = () => setDraggingWidgetIndex(null);

    const toggleVisibility = (index: number) => {
        const newConfig = [...navConfig];
        newConfig[index].isVisible = !newConfig[index].isVisible;
        onUpdateNavConfig(newConfig);
    };

    const handleResetConfig = () => {
        const defaultConf = NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true }));
        onUpdateNavConfig(defaultConf);
    };

    return (
        <>
            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
                <h3 className={`text-xl font-bold mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Appearance</h3>
                <div className={`flex justify-between items-center p-3 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50'}`}>
                    <div>
                        <p className={`font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Dark Mode</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Toggle application appearance</p>
                    </div>
                    <button 
                        onClick={onToggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <div className={`mt-4 p-3 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50'}`}>
                    <div className="mb-3">
                        <p className={`font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Visual Theme</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Select your preferred interface style</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setAppTheme('default')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${appTheme === 'default' ? 'bg-white dark:bg-gray-700 border-blue-500 text-blue-600 dark:text-white shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        >
                            Default
                        </button>
                        <button 
                            onClick={() => setAppTheme('cyberpunk')}
                            disabled={!inventory.theme_cyber}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 ${appTheme === 'cyberpunk' ? 'bg-slate-900 border-purple-500 text-purple-400 shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                        >
                            <span>Cyberpunk</span>
                            {!inventory.theme_cyber && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 rounded text-gray-500">Locked</span>}
                        </button>
                    </div>
                </div>
            </div>

            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className={`text-xl font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Navigation & Sidebar</h3>
                    <button onClick={handleResetConfig} className="text-xs text-gray-500 hover:text-blue-500 underline">Reset Default</button>
                </div>
                <div className="space-y-4">
                    <div className={`flex justify-between items-center p-3 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50'}`}>
                        <div className="w-full space-y-3">
                            <p className={`font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Sidebar Widgets</p>
                            
                            <div className="space-y-2">
                                {(sidebarConfig.widgetOrder || [
                                    'showTimerWidget', 'showQuestsWidget', 'showCountdownWidget', 
                                    'showDailyGoalWidget', 'showWeeklyGoalWidget', 'showMonthlyGoalWidget'
                                ]).map((widgetKey, index) => {
                                    const labels: Record<string, string> = {
                                        showQuestsWidget: 'Daily Quests',
                                        showTimerWidget: 'Quick Timer',
                                        showCountdownWidget: 'Closest Countdown',
                                        showDailyGoalWidget: 'Daily Goal',
                                        showWeeklyGoalWidget: 'Weekly Goal',
                                        showMonthlyGoalWidget: 'Monthly Goal'
                                    };
                                    return (
                                        <div key={widgetKey} draggable onDragStart={(e) => handleWidgetDragStart(e, index)} onDragOver={(e) => handleWidgetDragOver(e, index)} onDragEnd={handleWidgetDragEnd} className={`flex justify-between items-center p-2 rounded-lg border cursor-move transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 hover:border-[#00f0ff]' : 'bg-white dark:bg-[#252527] border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'} ${draggingWidgetIndex === index ? 'opacity-50' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="text-gray-400 cursor-move"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></div>
                                                <span className="text-sm text-gray-600 dark:text-gray-300">{labels[widgetKey]}</span>
                                            </div>
                                            <button 
                                                onClick={() => onUpdateSidebarConfig({ ...sidebarConfig, [widgetKey]: !sidebarConfig[widgetKey as keyof SidebarConfig] })}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${sidebarConfig[widgetKey as keyof SidebarConfig] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${sidebarConfig[widgetKey as keyof SidebarConfig] ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {sidebarConfig.showQuestsWidget && (
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quest Widget Size</label>
                                    <div className="flex gap-2">
                                        {(['compact', 'standard', 'spacious'] as WidgetSize[]).map(size => (
                                            <button
                                                key={size}
                                                onClick={() => onUpdateSidebarConfig({ ...sidebarConfig, questsWidgetSize: size })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                                                    sidebarConfig.questsWidgetSize === size
                                                    ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')
                                                    : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800')
                                                }`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>

                    <div className={`space-y-2 p-4 rounded-xl border ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50'}`}>
                        {navConfig.map((item, index) => {
                            const def = NAV_ITEMS_DEF.find(d => d.view === item.view);
                            if (!def) return null;
                            
                            return (
                                <div 
                                    key={item.view}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`flex items-center p-3 rounded-xl cursor-move transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 hover:border-[#00f0ff]' : 'bg-white dark:bg-[#252527] border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'} border ${draggingIndex === index ? 'opacity-50' : 'opacity-100 shadow-sm'}`}
                                >
                                    <div className="mr-3 text-gray-400 cursor-move shrink-0">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    </div>
                                    <div className={`p-1.5 rounded-lg mr-3 shrink-0 ${item.isVisible ? (isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300') : 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-50'}`}>
                                        {def.icon}
                                    </div>
                                    <span className={`flex-1 font-bold text-sm ${item.isVisible ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white') : 'text-gray-400 line-through'}`}>
                                        {def.label}
                                    </span>
                                    <div className="relative flex items-center justify-end w-10">
                                        <input 
                                            type="checkbox" 
                                            checked={item.isVisible} 
                                            onChange={() => toggleVisibility(index)}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className={`${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-2xl p-6 border shadow-sm`}>
                <h3 className={`text-xl font-bold mb-6 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Menu Bar Display</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Mode</label>
                        <select 
                            value={menuBarConfig.mode} 
                            onChange={(e) => onUpdateMenuBarConfig({ ...menuBarConfig, mode: e.target.value as MenuBarMode })}
                            className={`w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500'}`}
                        >
                            <option value="none">None (Icon Only)</option>
                            <option value="today">Today's Hours</option>
                            <option value="remaining">Remaining (Daily Goal)</option>
                            <option value="streak">Current Streak</option>
                            <option value="xp">Total XP</option>
                            <option value="motivation">Motivation</option>
                            <option value="timer">Active Timer</option>
                            <option value="countdown_closest">Closest Countdown</option>
                            <option value="countdown_custom">Custom Countdown</option>
                        </select>
                    </div>
                    {menuBarConfig.mode === 'countdown_custom' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Countdown</label>
                            <select 
                                value={menuBarConfig.customCountdownId || ''} 
                                onChange={(e) => onUpdateMenuBarConfig({ ...menuBarConfig, customCountdownId: e.target.value })}
                                className={`w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500'}`}
                            >
                                <option value="">Select an event...</option>
                                {countdowns.map(c => (
                                    <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
