import React, { useState, useRef } from 'react';
import { AppTheme } from '../../types';
import * as storage from '../../services/storageService';
import { useLogs, useProjects } from '../../AppContext';

interface DataSettingsProps {
    appTheme: AppTheme;
    lastBackup: string | null;
    setLastBackup: (date: string) => void;
}

export const DataSettings: React.FC<DataSettingsProps> = ({ appTheme, lastBackup, setLastBackup }) => {
    const isCyberpunk = appTheme === 'cyberpunk';
    const { clearTransactions, logs } = useLogs();
    const { projects } = useProjects();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [copyStatus, setCopyStatus] = useState<string>('');
    const [isSafetyLocked, setIsSafetyLocked] = useState(true);

    const handleExportJSON = async () => {
        const data = await storage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const now = Date.now();
        localStorage.setItem('focusflow_last_backup', now.toString());
        setLastBackup(new Date(now).toLocaleString());
    };

    const handleExportCSV = async () => {
        const csv = await storage.exportLogsToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportBirthdaysCSV = async () => {
        const csv = await storage.exportBirthdaysToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_birthdays_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopyToClipboard = async () => {
        const data = await storage.exportData();
        navigator.clipboard.writeText(data).then(() => {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            setCopyStatus('Failed');
        });
    };

    const handleImportClick = () => {
        if (confirm("WARNING: Importing data will completely OVERWRITE your current logs, settings, and projects.\n\nAre you sure you want to proceed?")) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                const result = await storage.importData(content);
                if (result.success) {
                    alert('Data imported successfully. The application will now reload.');
                    window.location.reload();
                } else {
                    alert(`Import Failed: ${result.message}`);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleClearLogs = async () => {
        if(confirm("Are you sure you want to delete ALL study logs? This cannot be undone.")) {
            await storage.clearLogs();
            if (!await storage.isInitialized()) await storage.setInitialized();
            window.location.reload();
        }
    };

    const handleClearSettings = async () => {
        if(confirm("Are you sure you want to reset timer settings and goals?")) {
            await storage.clearSettings();
            window.location.reload();
        }
    };

    const handleClearCountdowns = async () => {
        if(confirm("Are you sure you want to delete all countdowns and calendar events?")) {
            await storage.clearCountdowns();
            window.location.reload();
        }
    };

    const handleClearTransactions = () => {
        if (confirm("Are you sure you want to clear your transaction history? Your current gem balance will remain, but the log of earnings and spending will be wiped.")) {
            clearTransactions();
            alert("Transaction history cleared.");
        }
    };

    const handleFactoryReset = async () => {
        if (confirm("DANGER: This will delete ALL your data, logs, projects, and settings. This action cannot be undone.")) {
            if (confirm("Are you absolutely sure? This cannot be reversed.")) {
                await storage.clearAllData();
                await storage.setInitialized(); 
                window.location.reload();
            }
        }
    };

    const handleGenerateReport = async () => {
        const sessions = await storage.getSessions();
        const totalHours = logs.reduce((acc, curr) => acc + curr.hours, 0);
        const uniqueDates = new Set(logs.map(l => l.date)).size;
        const avgHours = uniqueDates > 0 ? totalHours / uniqueDates : 0;
        
        const projectDistData = projects.map(p => {
            const hours = logs.filter(l => l.projectId === p.id).reduce((acc, curr) => acc + curr.hours, 0);
            return { name: p.name, value: hours };
        }).sort((a, b) => b.value - a.value);

        const now = new Date();
        const reportWindow = window.open('', '_blank');
        if (!reportWindow) return;

        const html = `
          <html>
            <head>
              <title>FocusFlow Report</title>
              <style>
                body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1f2937; }
                h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
                .meta { color: #6b7280; margin-bottom: 30px; }
                .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
                .card { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
                .val { font-size: 24px; font-weight: bold; color: #111827; }
                .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { text-align: left; padding: 12px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb; font-size: 14px; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
                @media print { body { padding: 0; } .no-print { display: none; } }
              </style>
            </head>
            <body>
              <h1>Activity Report</h1>
              <div class="meta">Generated on ${now.toLocaleDateString()} • Scope: GLOBAL (All Time)</div>
              
              <div class="grid">
                <div class="card"><div class="label">Total Hours</div><div class="val">${totalHours.toFixed(1)}h</div></div>
                <div class="card"><div class="label">Daily Average</div><div class="val">${avgHours.toFixed(1)}h</div></div>
                <div class="card"><div class="label">Sessions</div><div class="val">${sessions.length}</div></div>
              </div>

              <h2>Project Breakdown</h2>
              <table>
                <thead><tr><th>Project</th><th>Hours</th><th>%</th></tr></thead>
                <tbody>
                  ${projectDistData.map(p => `
                    <tr>
                      <td>${p.name}</td>
                      <td>${p.value.toFixed(1)}</td>
                      <td>${totalHours > 0 ? ((p.value / totalHours) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <script>window.print();</script>
            </body>
          </html>
        `;
        reportWindow.document.write(html);
        reportWindow.document.close();
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Backup & Export</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* JSON Column */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Full Backup (JSON)</h4>
                            {lastBackup && <span className="text-[10px] text-gray-400 font-mono">Last: {lastBackup}</span>}
                        </div>
                        
                        <button onClick={handleExportJSON} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                            <div className="text-left">
                                <span className="block font-bold text-gray-900 dark:text-white">Download Backup</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Save full state to file</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>

                        <button onClick={handleCopyToClipboard} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                            <div className="text-left">
                                <span className="block font-bold text-gray-900 dark:text-white">{copyStatus || 'Copy to Clipboard'}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Copy JSON for quick transfer</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        </button>

                        <button onClick={handleImportClick} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                            <div className="text-left">
                                <span className="block font-bold text-gray-900 dark:text-white">Restore Backup</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Overwrite current data</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                    </div>

                    {/* CSV Column */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Reports & Exports</h4>
                        <button onClick={handleGenerateReport} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                            <div className="text-left">
                                <span className="block font-bold text-gray-900 dark:text-white">Activity Report</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Printable HTML summary</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </button>
                        <button onClick={handleExportCSV} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                            <div className="text-left">
                                <span className="block font-bold text-gray-900 dark:text-white">Export Logs</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Study sessions data</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-[10px] font-bold text-gray-600 dark:text-gray-300">.CSV</span>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                        </button>
                        <button onClick={handleExportBirthdaysCSV} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all">
                            <div className="text-left">
                                <span className="block font-bold text-gray-900 dark:text-white">Export Birthdays</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Calendar events data</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                        <p className="text-sm text-red-600/70 dark:text-red-400/70">Irreversible actions regarding your data.</p>
                    </div>
                    
                    {/* Safety Lock */}
                    <div className="flex items-center bg-white dark:bg-red-900/20 px-3 py-1.5 rounded-full border border-red-100 dark:border-red-800/30">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 mr-2 uppercase tracking-wide">Safety Lock</span>
                        <button 
                            onClick={() => setIsSafetyLocked(!isSafetyLocked)}
                            className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${isSafetyLocked ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isSafetyLocked ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <button 
                        onClick={handleClearLogs}
                        disabled={isSafetyLocked}
                        className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                            isSafetyLocked 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                            : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800'
                        }`}
                    >
                        Clear Logs
                    </button>
                    <button 
                        onClick={handleClearSettings}
                        disabled={isSafetyLocked}
                        className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                            isSafetyLocked 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                            : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800'
                        }`}
                    >
                        Clear Settings
                    </button>
                    <button 
                        onClick={handleClearCountdowns}
                        disabled={isSafetyLocked}
                        className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                            isSafetyLocked 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                            : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800'
                        }`}
                    >
                        Clear Countdown
                    </button>
                    <button 
                        onClick={handleClearTransactions}
                        disabled={isSafetyLocked}
                        className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                            isSafetyLocked 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                            : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800'
                        }`}
                    >
                        Reset History
                    </button>
                    <button 
                        onClick={handleFactoryReset}
                        disabled={isSafetyLocked}
                        className={`px-4 py-3 rounded-lg text-xs font-bold shadow-sm transition-all text-center ${
                            isSafetyLocked 
                            ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-70' 
                            : 'bg-red-600 hover:bg-red-700 text-white border border-red-600'
                        }`}
                    >
                        Factory Reset
                    </button>
                </div>
            </div>
        </div>
    );
};
