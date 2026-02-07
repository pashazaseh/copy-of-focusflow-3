import React, { useState } from 'react';
import { AppTheme } from '../../../types';

interface GeminiSectionProps {
    appTheme: AppTheme;
}

const GeminiSection: React.FC<GeminiSectionProps> = ({ appTheme }) => {
    const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');

    const handleSaveGeminiKey = () => {
        localStorage.setItem('gemini_api_key', geminiApiKey);
        alert("Gemini API Key Saved.");
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">AI Integration</h3>
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gemini API Key</label>
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">AI Coach</span>
                    </div>
                    <div className="flex gap-2">
                        <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="Enter Gemini API Key" className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white transition-all font-mono" />
                        <button onClick={handleSaveGeminiKey} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:border-transparent dark:hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-xl transition-colors">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeminiSection;
