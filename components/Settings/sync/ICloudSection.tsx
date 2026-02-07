import React, { useState, useEffect, useRef } from 'react';
import { AppTheme } from '../../../types';
import * as storage from '../../../services/storageService';

interface ICloudSectionProps {
    appTheme: AppTheme;
    setLastBackup: (date: string) => void;
}

const ICloudSection: React.FC<ICloudSectionProps> = ({ appTheme, setLastBackup }) => {
    const [cloudKitContainerId, setCloudKitContainerId] = useState(() => localStorage.getItem('cloudkit_container_id') || '');
    const [cloudKitApiToken, setCloudKitApiToken] = useState(() => localStorage.getItem('cloudkit_api_token') || '');
    const [isICloudLoggedIn, setIsICloudLoggedIn] = useState(false);
    const [isUploadingICloud, setIsUploadingICloud] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        if (typeof (window as any).CloudKit === 'undefined') {
            if (navigator.onLine) {
                const ckScript = document.createElement('script');
                ckScript.src = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';
                ckScript.async = true;
                ckScript.onload = () => { if (cloudKitContainerId && cloudKitApiToken) initCloudKit(); };
                document.body.appendChild(ckScript);
            }
        } else if (cloudKitContainerId && cloudKitApiToken) {
            initCloudKit();
        }
        return () => { isMounted.current = false; };
    }, [cloudKitContainerId, cloudKitApiToken]);

    const initCloudKit = () => {
        const CK = (window as any).CloudKit;
        if (!CK) return;
        try {
            CK.configure({ containers: [{ containerIdentifier: cloudKitContainerId, apiTokenAuth: { apiToken: cloudKitApiToken, persist: true }, environment: 'development' }] });
            CK.getDefaultContainer().setUpAuth().then((user: any) => setIsICloudLoggedIn(!!user)).catch(() => setIsICloudLoggedIn(false));
        } catch (e) { console.error("CloudKit Init Error", e); }
    };

    const handleSaveCloudKitConfig = () => {
        localStorage.setItem('cloudkit_container_id', cloudKitContainerId);
        localStorage.setItem('cloudkit_api_token', cloudKitApiToken);
        initCloudKit();
        alert("CloudKit Configuration Saved.");
    };

    const handleICloudLogin = async () => {
        const CK = (window as any).CloudKit;
        if (!CK) return;
        try { await CK.getDefaultContainer().getAuth().signIn(); setIsICloudLoggedIn(true); alert("Signed in to iCloud!"); } catch (e) { alert("iCloud Sign-in failed"); }
    };

    const uploadToICloud = async () => {
        setIsUploadingICloud(true);
        try {
            const data = await storage.exportData();
            const CK = (window as any).CloudKit;
            const record = { recordType: 'Backup', fields: { jsonContent: { value: data }, deviceName: { value: 'FocusFlow App' } } };
            await CK.getDefaultContainer().privateCloudDatabase.saveRecords([record]);
            alert("Backup saved to iCloud!");
            const now = Date.now();
            localStorage.setItem('focusflow_last_backup', now.toString());
            setLastBackup(new Date(now).toLocaleString());
        } catch (e: any) { alert(`iCloud Backup Failed: ${e.message}`); } finally { if (isMounted.current) setIsUploadingICloud(false); }
    };

    return <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900 dark:text-white">iCloud (CloudKit)</h3><button onClick={handleICloudLogin} className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"><span>{isICloudLoggedIn ? 'Signed In' : 'Sign In to iCloud'}</span></button></div><div className="space-y-4"><div className="space-y-2"><input type="text" value={cloudKitContainerId} onChange={(e) => setCloudKitContainerId(e.target.value)} placeholder="Container ID (iCloud.com.example.app)" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" /><div className="flex gap-2"><input type="text" value={cloudKitApiToken} onChange={(e) => setCloudKitApiToken(e.target.value)} placeholder="API Token" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all font-mono" /><button onClick={handleSaveCloudKitConfig} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button></div></div><div className="grid grid-cols-2 gap-4"><button onClick={uploadToICloud} disabled={isUploadingICloud || !isICloudLoggedIn} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl group transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"><div className="text-left relative z-10"><span className="block font-bold text-gray-900 dark:text-white">{isUploadingICloud ? 'Uploading...' : 'Backup to iCloud'}</span></div></button></div></div></div>;
};

export default ICloudSection;
