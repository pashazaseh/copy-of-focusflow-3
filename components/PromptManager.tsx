import React, { useState } from 'react';
import { CustomPrompt } from '../types';

interface PromptManagerProps {
    isOpen: boolean;
    onClose: () => void;
    isCyberpunk: boolean;
    prompts: CustomPrompt[];
    onUpdatePrompts: (prompts: CustomPrompt[]) => void;
}

export const PromptManager: React.FC<PromptManagerProps> = ({ isOpen, onClose, isCyberpunk, prompts, onUpdatePrompts }) => {
    const [newLabel, setNewLabel] = useState('');
    const [newPrompt, setNewPrompt] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!newLabel.trim() || !newPrompt.trim()) return;
        
        if (editingId) {
            onUpdatePrompts(prompts.map(p => p.id === editingId ? { ...p, label: newLabel, prompt: newPrompt } : p));
            setEditingId(null);
        } else {
            onUpdatePrompts([...prompts, { id: Date.now().toString(), label: newLabel, prompt: newPrompt }]);
        }
        setNewLabel('');
        setNewPrompt('');
    };

    const handleEdit = (p: CustomPrompt) => {
        setEditingId(p.id);
        setNewLabel(p.label);
        setNewPrompt(p.prompt);
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete prompt?')) {
            onUpdatePrompts(prompts.filter(p => p.id !== id));
            if (editingId === id) {
                setEditingId(null);
                setNewLabel('');
                setNewPrompt('');
            }
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setNewLabel('');
        setNewPrompt('');
    };

    const movePrompt = (index: number, direction: 'up' | 'down') => {
        const newPrompts = [...prompts];
        if (direction === 'up' && index > 0) {
            [newPrompts[index], newPrompts[index - 1]] = [newPrompts[index - 1], newPrompts[index]];
        } else if (direction === 'down' && index < newPrompts.length - 1) {
            [newPrompts[index], newPrompts[index + 1]] = [newPrompts[index + 1], newPrompts[index]];
        } else {
            return;
        }
        onUpdatePrompts(newPrompts);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl flex flex-col max-h-[80vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}>
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className={`text-lg font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Manage AI Prompts</h3>
                    <button onClick={onClose} className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-500'}`}>✕</button>
                </div>

                <div className="space-y-3 mb-4">
                    <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (e.g. Summarize)" className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`} />
                    <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} placeholder="Prompt (e.g. Summarize this text...)" className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none resize-none h-20 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`} />
                    <div className="flex gap-2">
                        {editingId && <button onClick={handleCancel} className={`flex-1 py-2 rounded-lg text-xs font-bold ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-700'}`}>Cancel</button>}
                        <button onClick={handleSave} disabled={!newLabel.trim() || !newPrompt.trim()} className={`flex-1 py-2 rounded-lg text-xs font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}>{editingId ? 'Update' : 'Add'}</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {prompts.length === 0 && <p className="text-center text-sm opacity-50 py-4">No custom prompts.</p>}
                    {prompts.map((p, index) => (
                        <div key={p.id} className={`p-3 rounded-lg border flex justify-between items-center ${isCyberpunk ? 'border-[#00f0ff]/20 bg-[#00f0ff]/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
                            <div className="overflow-hidden mr-2 flex-1">
                                <div className={`text-sm font-bold truncate ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{p.label}</div>
                                <div className={`text-xs truncate opacity-60 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400'}`}>{p.prompt}</div>
                            </div>
                            <div className="flex gap-1 shrink-0 items-center">
                                <div className="flex flex-col mr-1">
                                    <button onClick={() => movePrompt(index, 'up')} disabled={index === 0} className={`text-[8px] leading-none px-1 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-500'} disabled:opacity-30`}>▲</button>
                                    <button onClick={() => movePrompt(index, 'down')} disabled={index === prompts.length - 1} className={`text-[8px] leading-none px-1 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-500'} disabled:opacity-30`}>▼</button>
                                </div>
                                <button onClick={() => handleEdit(p)} className={`p-1.5 rounded ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>✎</button>
                                <button onClick={() => handleDelete(p.id)} className={`p-1.5 rounded ${isCyberpunk ? 'text-red-500 hover:bg-red-500/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};