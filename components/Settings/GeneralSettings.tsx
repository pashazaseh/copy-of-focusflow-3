import React, { useState } from 'react';
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

// A small helper for the section headers
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-gray-500/80 dark:text-gray-400/80 col-span-full">
        {children}
    </h3>
);

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
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [draggingWidgetIndex, setDraggingWidgetIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggingIndex(index);
        e.dataTransfer.effectAllowed = "move";
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

    const handleResetNavConfig = () => {
        const defaultConf = NAV_ITEMS_DEF.map(item => ({ view: item.view, isVisible: true }));
        onUpdateNavConfig(defaultConf);
    };
    
    const isCyberpunk = appTheme === 'cyberpunk';
    const cardBaseClass = isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    const controlBgClass = isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50';

    const widgetLabels: Record<string, string> = {
        showQuestsWidget: 'Daily Quests',
        showTimerWidget: 'Quick Timer',
        showCountdownWidget: 'Closest Countdown',
        showDailyGoalWidget: 'Daily Goal',
        showWeeklyGoalWidget: 'Weekly Goal',
        showMonthlyGoalWidget: 'Monthly Goal'
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* APPERANCE & THEME */}
            <div className={`${cardBaseClass} rounded-2xl p-4 border shadow-sm h-full`}>
                <SectionHeader>Appearance</SectionHeader>
                <div className="flex flex-col gap-4">
                    {/* Dark Mode */}
                    <div className={`flex justify-between items-center p-3 rounded-xl border ${controlBgClass}`}>
                        <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">Dark Mode</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Toggle theme</p>
                        </div>
                        <button 
                            onClick={onToggleTheme}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {/* Visual Theme */}
                    <div className={`p-3 rounded-xl border ${controlBgClass}`}>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Visual Theme</p>
                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={() => setAppTheme('default')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${appTheme === 'default' ? 'bg-white dark:bg-gray-700 border-blue-500 text-blue-600 dark:text-white shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                            >
                                Default
                            </button>
                            <button 
                                onClick={() => setAppTheme('cyberpunk')}
                                disabled={!inventory.theme_cyber}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border flex items-center gap-1.5 ${appTheme === 'cyberpunk' ? 'bg-slate-900 border-purple-500 text-purple-400 shadow-sm' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                            >
                                <span>Cyberpunk</span>
                                {!inventory.theme_cyber && <span className="text-[9px] bg-gray-200 dark:bg-gray-700 px-1 rounded">Locked</span>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MENU BAR DISPLAY */}
            <div className={`${cardBaseClass} rounded-2xl p-4 border shadow-sm h-full`}>
                <SectionHeader>Menu Bar Display</SectionHeader>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Display Mode</label>
                        <select 
                            value={menuBarConfig.mode} 
                            onChange={(e) => onUpdateMenuBarConfig({ ...menuBarConfig, mode: e.target.value as MenuBarMode, customCountdownId: menuBarConfig.mode === 'countdown_custom' ? menuBarConfig.customCountdownId : '' })}
                            className={`w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500'}`}
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
                            <label className="block text-xs font-medium text-gray-500 mb-1">Select Countdown</label>
                            <select 
                                value={menuBarConfig.customCountdownId || ''} 
                                onChange={(e) => onUpdateMenuBarConfig({ ...menuBarConfig, customCountdownId: e.target.value })}
                                className={`w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500'}`}
                            >
                                <option value="">Select an event...</option>
                                {countdowns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* NAVIGATION & WIDGETS */}
            <div className={`${cardBaseClass} rounded-2xl p-4 border shadow-sm col-span-1 lg:col-span-2`}>
                 <div className="flex items-center justify-between col-span-full mb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500/80 dark:text-gray-400/80">
                        Navigation & Sidebar
                    </h3>
                    <button onClick={handleResetNavConfig} className="text-xs text-gray-500 hover:text-blue-500 underline">Reset Default</button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Sidebar Widgets */}
                    <div className="space-y-2">
                         {(sidebarConfig.widgetOrder || Object.keys(widgetLabels)).map((widgetKey, index) => (
                            <div 
                                key={widgetKey} 
                                draggable 
                                onDragStart={(e) => handleWidgetDragStart(e, index)} 
                                onDragOver={(e) => handleWidgetDragOver(e, index)} 
                                onDragEnd={handleWidgetDragEnd} 
                                className={`flex justify-between items-center p-2 rounded-lg border cursor-move transition-all ${controlBgClass} hover:border-blue-400 dark:hover:border-blue-500 ${draggingWidgetIndex === index ? 'opacity-30' : ''}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="text-gray-400 cursor-move"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></div>
                                    <span className="text-xs text-gray-600 dark:text-gray-300">{widgetLabels[widgetKey]}</span>
                                </div>
                                <button 
                                    onClick={() => onUpdateSidebarConfig({ ...sidebarConfig, [widgetKey]: !sidebarConfig[widgetKey as keyof SidebarConfig] })}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${sidebarConfig[widgetKey as keyof SidebarConfig] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${sidebarConfig[widgetKey as keyof SidebarConfig] ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Nav Items */}
                    <div className="space-y-2">
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
                                    className={`flex items-center p-2 rounded-lg cursor-move transition-all border ${controlBgClass} hover:border-blue-400 dark:hover:border-blue-500 ${draggingIndex === index ? 'opacity-30' : ''}`}
                                >
                                    <div className="text-gray-400 cursor-move mr-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></div>
                                    <div className={`p-1 rounded-md mr-2 ${item.isVisible ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-600 dark:text-gray-300') : 'text-gray-400 opacity-50'}`}>
                                        {React.isValidElement(def.icon) ? React.cloneElement(def.icon, { className: 'w-4 h-4' }) : def.icon}
                                    </div>
                                    <span className={`flex-1 font-bold text-xs ${item.isVisible ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white') : 'text-gray-400 line-through'}`}>
                                        {def.label}
                                    </span>
                                    <input 
                                        type="checkbox" 
                                        checked={item.isVisible} 
                                        onChange={() => toggleVisibility(index)}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Widget-specific settings like Quest Widget Size can go here, conditionally */}
                    {sidebarConfig.showQuestsWidget && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 col-span-full mt-2">
                             <SectionHeader>Quest Widget</SectionHeader>
                            <div className="flex items-center gap-4">
                                <label className="block text-xs font-bold text-gray-500">Size</label>
                                <div className="flex gap-2">
                                    {(['compact', 'standard', 'spacious'] as WidgetSize[]).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => onUpdateSidebarConfig({ ...sidebarConfig, questsWidgetSize: size })}
                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all capitalize ${
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};