import React, { useState } from 'react';
import { AppTheme } from '../../../types';
import { exchangeCodeForToken } from '../../../services/tickTickService';

interface TickTickSectionProps {
    appTheme: AppTheme;
}

const TickTickSection: React.FC<TickTickSectionProps> = ({ appTheme }) => {
    const [tickTickClientId, setTickTickClientId] = useState(() => localStorage.getItem('ticktick_client_id') || '');
    const [tickTickClientSecret, setTickTickClientSecret] = useState(() => localStorage.getItem('ticktick_client_secret') || '');
    const [tickTickRedirectUri, setTickTickRedirectUri] = useState(() => {
        const stored = localStorage.getItem('ticktick_redirect_uri');
        if (stored) return stored;
        return (typeof window !== 'undefined' && window.electronAPI) ? 'http://localhost:54321/callback' : (typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost');
    });
    const [manualAuthCode, setManualAuthCode] = useState('');
    const [tickTickAutoSync, setTickTickAutoSync] = useState(() => localStorage.getItem('focusflow_ticktick_auto_sync') === 'true');

    const handleSaveTickTickConfig = () => {
        localStorage.setItem('ticktick_client_id', tickTickClientId);
        localStorage.setItem('ticktick_client_secret', tickTickClientSecret);
        localStorage.setItem('ticktick_redirect_uri', tickTickRedirectUri);
        alert("TickTick Configuration Saved.");
    };

    const handleManualTickTickCode = async () => {
        if (!manualAuthCode.trim()) return;
        try {
            const tokenData = await exchangeCodeForToken(tickTickClientId, tickTickClientSecret, manualAuthCode.trim(), tickTickRedirectUri);
            if (tokenData.access_token) {
                localStorage.setItem('ticktick_access_token', tokenData.access_token);
                alert("TickTick Linked Successfully!");
                setManualAuthCode('');
                window.dispatchEvent(new Event('focusflow-task-update'));
            }
        } catch (e: any) {
            console.error(e);
            alert(`Link failed: ${e.message}`);
        }
    };

    const handleTickTickAutoSyncChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTickTickAutoSync(e.target.checked);
        localStorage.setItem('focusflow_ticktick_auto_sync', String(e.target.checked));
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">TickTick Integration</h3>
            <div className="space-y-6">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Sync your tasks from TickTick. You need to register an app at <a href="https://developer.ticktick.com/manage" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">developer.ticktick.com</a> to get these credentials.
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Client ID</label>
                            <input type="text" value={tickTickClientId} onChange={(e) => setTickTickClientId(e.target.value)} placeholder="TickTick Client ID" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Client Secret</label>
                            <div className="flex gap-2">
                                <input type="password" value={tickTickClientSecret} onChange={(e) => setTickTickClientSecret(e.target.value)} placeholder="TickTick Client Secret" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Redirect URI</label>
                            <div className="flex gap-2">
                                <input type="text" value={tickTickRedirectUri} onChange={(e) => setTickTickRedirectUri(e.target.value)} placeholder={typeof window !== 'undefined' && window.electronAPI ? "http://localhost:54321/callback" : "http://localhost"} className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                                <button onClick={handleSaveTickTickConfig} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Manual Auth Code</label>
                            <div className="flex gap-2">
                                <input type="text" value={manualAuthCode} onChange={(e) => setManualAuthCode(e.target.value)} placeholder="Paste code if auto-sync fails" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" />
                                <button onClick={handleManualTickTickCode} disabled={!manualAuthCode} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors disabled:opacity-50">Link</button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2"><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={tickTickAutoSync} onChange={handleTickTickAutoSyncChange} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-black/20 border-gray-300 dark:border-gray-600" /><span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auto-sync in background (Every 5m)</span></label></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TickTickSection;

