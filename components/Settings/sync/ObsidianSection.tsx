/// <reference path="../../../electron.d.ts" />
import React, { useState, useEffect, useRef } from 'react';
import { AppTheme } from '../../../types';
import * as storage from '../../../services/storageService';

interface ObsidianSectionProps {
    appTheme: AppTheme;
    setLastBackup: (date: string) => void;
}

const ObsidianSection: React.FC<ObsidianSectionProps> = ({ appTheme, setLastBackup }) => {
    const [backupPath, setBackupPath] = useState(() => localStorage.getItem('focusflow_backup_path') || '');
    const [autoObsidianSync, setAutoObsidianSync] = useState(() => localStorage.getItem('focusflow_auto_obsidian_sync') === 'true');
    const [obsidianMode, setObsidianMode] = useState(() => localStorage.getItem('focusflow_obsidian_mode') || 'dashboard');
    const [dashboardFilename, setDashboardFilename] = useState(() => localStorage.getItem('focusflow_obsidian_dashboard_filename') || 'FocusFlow_Stats.md');
    const [inboxFilename, setInboxFilename] = useState(() => localStorage.getItem('focusflow_obsidian_inbox_filename') || 'Inbox.md');
    const [obsidianTemplate, setObsidianTemplate] = useState(() => localStorage.getItem('focusflow_obsidian_template') || '- [x] {time} - **{label}** ({duration}m) [{project}] #focusflow');
    const [obsidianHeader, setObsidianHeader] = useState(() => localStorage.getItem('focusflow_obsidian_header') || '');
    const [obsidianPosition, setObsidianPosition] = useState<'append' | 'prepend'>(() => (localStorage.getItem('focusflow_obsidian_position') as 'append' | 'prepend') || 'append');
    const [obsidianDateFormat, setObsidianDateFormat] = useState(() => localStorage.getItem('focusflow_obsidian_date_format') || 'YYYY-MM-DD');
    const [obsidianDailyFolder, setObsidianDailyFolder] = useState(() => localStorage.getItem('focusflow_obsidian_daily_folder') || '');
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // File Watcher Effect
    useEffect(() => {
        if (backupPath && window.electronAPI?.watchPath) {
            window.electronAPI.watchPath(backupPath);
            
            const cleanup = window.electronAPI.onFileChange((data) => {
                if (data.filename && (data.filename === dashboardFilename || data.filename === inboxFilename)) {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    
                    debounceRef.current = setTimeout(() => {
                        setStatusMsg({ text: `External change detected: ${data.filename}`, type: 'info' });
                    }, 1000);
                }
            });
            
            return () => {
                window.electronAPI?.unwatchPath();
                if (cleanup) cleanup();
                if (debounceRef.current) clearTimeout(debounceRef.current);
            };
        }
    }, [backupPath, dashboardFilename, inboxFilename]);

    const handleSelectBackupFolder = async () => {
        const api = (window as any).electronAPI;
        if (!api) {
            folderInputRef.current?.click();
            return;
        }
        try {
            const path = await api.selectBackupFolder();
            if (path) {
                setBackupPath(path);
                localStorage.setItem('focusflow_backup_path', path);
            }
        } catch (error) {
            console.error("Failed to select folder:", error);
            folderInputRef.current?.click();
        }
    };

    const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0] as any;
            // In Electron, file.path is the absolute path.
            // We try to extract the directory path from the first file in the selected directory.
            if (file.path) {
                // Heuristic: If we selected a folder, webkitRelativePath is like "Folder/File.txt"
                // and path is "/User/Docs/Folder/File.txt".
                // We want "/User/Docs/Folder".
                const path = file.path.slice(0, -file.name.length - 1); // Simple strip of filename
                setBackupPath(path);
                localStorage.setItem('focusflow_backup_path', path);
            }
        }
    };

    const handleBackupToFolder = async () => {
        if (!backupPath) return setStatusMsg({ text: "Please select a folder first.", type: 'error' });
        setIsSyncing(true);
        setStatusMsg({ text: "Backing up...", type: 'info' });
        const data = await storage.exportData();
        const result = await window.electronAPI?.saveBackupFile(backupPath, data);
        if (result?.success) {
            setStatusMsg({ text: `Backup saved to: ${result.path?.split(/[/\\]/).pop()}`, type: 'success' });
            setLastBackup(new Date().toLocaleString());
        } else {
            setStatusMsg({ text: `Backup failed: ${result?.error}`, type: 'error' });
        }
        setIsSyncing(false);
    };

    const handleObsidianSync = async () => {
        if (!backupPath) return setStatusMsg({ text: "Please select a folder first.", type: 'error' });
        setIsSyncing(true);
        setStatusMsg({ text: "Syncing dashboard...", type: 'info' });
        
        const sessions = await storage.getSessions();
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = sessions.filter(s => s.startTime.startsWith(today));
        const totalHours = sessions.reduce((acc, s) => acc + s.duration, 0) / 3600;
        const todayHours = todaySessions.reduce((acc, s) => acc + s.duration, 0) / 3600;
        
        const mdContent = `# 🍅 FocusFlow Dashboard\n**Last Updated:** ${new Date().toLocaleString()}\n\n## 📊 Stats\n- **Total Focus:** ${totalHours.toFixed(1)} hours\n- **Today:** ${todayHours.toFixed(1)} hours\n- **Sessions:** ${sessions.length}\n\n## 📅 Today's Sessions\n${todaySessions.length === 0 ? '_No sessions yet today._' : todaySessions.map(s => `- **${new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}** - ${s.label || 'Focus'} (${Math.round(s.duration/60)}m)`).join('\n')}\n`;
        const result = await window.electronAPI?.saveFileToFolder(backupPath, dashboardFilename, mdContent);
        
        if (result?.success) setStatusMsg({ text: `Synced '${dashboardFilename}' successfully!`, type: 'success' });
        else setStatusMsg({ text: `Sync failed: ${result?.error}`, type: 'error' });
        setIsSyncing(false);
    };

    const handleTestDailyNote = async () => {
        if (!backupPath) return setStatusMsg({ text: "Please select a folder first.", type: 'error' });
        setIsSyncing(true);
        setStatusMsg({ text: "Appending test note...", type: 'info' });

        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = obsidianDateFormat.replace('YYYY', year).replace('MM', month).replace('DD', day);
        const filename = (obsidianDailyFolder ? `${obsidianDailyFolder}/${dateStr}` : dateStr) + '.md';
        const line = `\n- [ ] 🧪 FocusFlow Test Sync at ${now.toLocaleTimeString()}`;
        
        const result = await window.electronAPI?.updateDailyNote(backupPath, filename, line, obsidianHeader, obsidianPosition);
        
        if (result?.success) {
            setStatusMsg({ text: `✅ Appended test line to ${filename}`, type: 'success' });
        } else {
            setStatusMsg({ text: `❌ Failed: ${result?.error}`, type: 'error' });
        }
        setIsSyncing(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Obsidian & Local Sync</h3>
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10 mb-6">
                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Sync Folder</h4>
                <div className="flex gap-2 mb-2">
                    <input type="text" value={backupPath} readOnly placeholder="No folder selected" className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300" />
                    <button onClick={handleSelectBackupFolder} className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-600">Select</button>
                    <input 
                        type="file" 
                        ref={folderInputRef} 
                        onChange={handleFolderInput} 
                        className="hidden" 
                        {...({ webkitdirectory: "", directory: "" } as any)} 
                    />
                </div>
                <div className="flex gap-2">
                    <button onClick={handleBackupToFolder} disabled={!backupPath || isSyncing} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Save JSON Backup</button>
                    <button onClick={handleObsidianSync} disabled={!backupPath || isSyncing} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Sync Dashboard</button>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800/30 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={autoObsidianSync} onChange={(e) => { setAutoObsidianSync(e.target.checked); localStorage.setItem('focusflow_auto_obsidian_sync', String(e.target.checked)); }} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-black/20 border-gray-300 dark:border-gray-600" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auto-sync on Timer Finish</span>
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Mode:</span>
                        <select value={obsidianMode} onChange={(e) => { setObsidianMode(e.target.value); localStorage.setItem('focusflow_obsidian_mode', e.target.value); }} className="flex-1 text-xs px-2 py-1 rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="dashboard">Dashboard (Overwrite FocusFlow_Stats.md)</option>
                            <option value="daily">Daily Note (Append to Daily Note)</option>
                            <option value="inbox">Inbox (Append to Inbox.md)</option>
                        </select>
                    </div>

                    {obsidianMode === 'dashboard' && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Dashboard Filename</label>
                            <input 
                                type="text" 
                                value={dashboardFilename} 
                                onChange={(e) => { setDashboardFilename(e.target.value); localStorage.setItem('focusflow_obsidian_dashboard_filename', e.target.value); }} 
                                className="w-full px-2 py-1.5 text-xs rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" 
                                placeholder="FocusFlow_Stats.md" 
                            />
                        </div>
                    )}

                    {obsidianMode === 'inbox' && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Inbox Filename</label>
                            <input 
                                type="text" 
                                value={inboxFilename} 
                                onChange={(e) => { setInboxFilename(e.target.value); localStorage.setItem('focusflow_obsidian_inbox_filename', e.target.value); }} 
                                className="w-full px-2 py-1.5 text-xs rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" 
                                placeholder="Inbox.md" 
                            />
                        </div>
                    )}

                    {obsidianMode === 'daily' && (
                        <div className="space-y-2 pl-2 border-l-2 border-blue-200 dark:border-blue-800/30">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Daily Note Folder (Optional)</label>
                                <input type="text" value={obsidianDailyFolder} onChange={(e) => { setObsidianDailyFolder(e.target.value); localStorage.setItem('focusflow_obsidian_daily_folder', e.target.value); }} className="w-full px-2 py-1.5 text-xs rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" placeholder="e.g. Daily Notes" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Daily Note Date Format</label>
                                <input type="text" value={obsidianDateFormat} onChange={(e) => { setObsidianDateFormat(e.target.value); localStorage.setItem('focusflow_obsidian_date_format', e.target.value); }} className="w-full px-2 py-1.5 text-xs rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" placeholder="YYYY-MM-DD" />
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[9px] text-gray-400">Use YYYY, MM, DD</p>
                                    <p className="text-[9px] font-mono text-blue-500">Preview: {obsidianDateFormat.replace('YYYY', new Date().getFullYear().toString()).replace('MM', String(new Date().getMonth() + 1).padStart(2, '0')).replace('DD', String(new Date().getDate()).padStart(2, '0'))}.md</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Entry Template</label>
                                <input type="text" value={obsidianTemplate} onChange={(e) => { setObsidianTemplate(e.target.value); localStorage.setItem('focusflow_obsidian_template', e.target.value); }} className="w-full px-2 py-1.5 text-xs rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" placeholder="- [x] {time} - {label} ({duration}m)" />
                                <p className="text-[9px] text-gray-400 mt-1">Vars: {'{time}, {duration}, {label}, {project}'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Header (Optional)</label>
                                    <input type="text" value={obsidianHeader} onChange={(e) => { setObsidianHeader(e.target.value); localStorage.setItem('focusflow_obsidian_header', e.target.value); }} className="w-full px-2 py-1.5 text-xs rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Log" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Position</label>
                                    <select value={obsidianPosition} onChange={(e) => { setObsidianPosition(e.target.value as any); localStorage.setItem('focusflow_obsidian_position', e.target.value); }} className="w-full px-2 py-1.5 text-xs rounded bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
                                        <option value="append">Append (Bottom)</option>
                                        <option value="prepend">Prepend (Top)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button onClick={handleTestDailyNote} disabled={isSyncing} className="w-full py-1.5 text-xs font-bold rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50">Test Daily Note Append</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {statusMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold border ${statusMsg.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : statusMsg.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'}`}>
                    {statusMsg.text}
                </div>
            )}
        </div>
    );
};

export default ObsidianSection;
