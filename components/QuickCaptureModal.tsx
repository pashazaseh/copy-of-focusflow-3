/// <reference path="../electron.d.ts" />
import React, { useState, useEffect, useRef } from 'react';
import { CustomPrompt } from '../types';
import { PromptManager } from './PromptManager';

interface QuickCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    isCyberpunk: boolean;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({ isOpen, onClose, isCyberpunk }) => {
    const [text, setText] = useState('');
    const [status, setStatus] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);
    const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
    const [isManagingPrompts, setIsManagingPrompts] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setText('');
            setStatus('');
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    useEffect(() => {
        const savedPrompts = localStorage.getItem('focusflow_custom_prompts');
        if (savedPrompts) {
            try {
                setCustomPrompts(JSON.parse(savedPrompts));
            } catch {}
        }
    }, [isOpen]); // Reload when opened

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowPrompts(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragStart.current.x,
                    y: e.clientY - dragStart.current.y
                });
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleCapture = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!text.trim()) return;

        let backupPath = localStorage.getItem('focusflow_backup_path');
        if (!backupPath) {
            if (window.electronAPI?.selectBackupFolder) {
                const path = await window.electronAPI.selectBackupFolder();
                if (path) {
                    localStorage.setItem('focusflow_backup_path', path);
                    backupPath = path;
                } else {
                    if (isMounted.current) setStatus('Error: No Sync Folder configured.');
                    return;
                }
            } else {
                if (isMounted.current) setStatus('Error: No Sync Folder configured in Settings.');
                return;
            }
        }

        const inboxFile = localStorage.getItem('focusflow_obsidian_inbox_filename') || 'Inbox.md';
        const now = new Date();
        const line = `\n- [ ] ${text.trim()} #quick-capture 📅 ${now.toLocaleString()}`;

        try {
            let result;
            if (window.electronAPI?.appendFileToFolder) {
                result = await window.electronAPI.appendFileToFolder(backupPath, inboxFile, line);
            } else {
                result = { success: false, error: 'Desktop API missing' };
            }

            if (isMounted.current) {
                if (result?.success) {
                    setStatus('Saved to Inbox!');
                    setTimeout(onClose, 800);
                } else {
                    setStatus(`Error: ${result?.error || 'Unknown'}`);
                }
            }
        } catch (err) {
            if (isMounted.current) setStatus('Failed to save.');
        }
    };

    const handleSmartEnhance = async (type: string = 'enhance') => {
        if (!text.trim()) return;
        if (isMounted.current) setShowPrompts(false);

        if (!navigator.onLine) {
            if (isMounted.current) setStatus('Error: Offline');
            return;
        }
        
        let apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            if (isMounted.current) setStatus('Error: Set API Key in Settings');
            return;
        }

        if (isMounted.current) setIsEnhancing(true);
        if (isMounted.current) setStatus('✨ Enhancing...');

        let prompt = "";
        switch (type) {
            case 'fix': prompt = "Fix grammar and spelling. Output only the corrected text."; break;
            case 'task': prompt = "Convert to a clear, actionable task title starting with a verb. Output only the title."; break;
            case 'steps': prompt = "Break down into 3-5 actionable subtasks as a markdown checklist. Output only the checklist."; break;
            case 'enhance': prompt = "Rewrite to be clear, concise, and professional. Keep meaning. Output only the rewritten text."; break;
            default:
                const custom = customPrompts.find(p => p.id === type);
                if (custom) prompt = custom.prompt;
                else prompt = "Rewrite to be clear, concise, and professional. Keep meaning. Output only the rewritten text.";
                break;
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${prompt} Text: \n"${text}"` }] }]
                })
            });
            
            const data = await response.json();
            if (isMounted.current) {
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    setText(data.candidates[0].content.parts[0].text.trim());
                    setStatus('✨ Enhanced!');
                } else {
                    setStatus('Error: AI Failed');
                }
            }
        } catch (e) {
            if (isMounted.current) setStatus('Error: Network');
        } finally {
            if (isMounted.current) {
                setIsEnhancing(false);
                setTimeout(() => { if (isMounted.current) setStatus(''); }, 2000);
            }
        }
    };

    const updateCustomPrompts = (newPrompts: CustomPrompt[]) => {
        setCustomPrompts(newPrompts);
        localStorage.setItem('focusflow_custom_prompts', JSON.stringify(newPrompts));
    };

    const triggerContextMenu = () => {
        if (inputRef.current) {
            inputRef.current.focus();
            const rect = inputRef.current.getBoundingClientRect();
            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            });
            inputRef.current.dispatchEvent(event);
            setShowPrompts(false);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setStatus('Saved Audio');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                let backupPath = localStorage.getItem('focusflow_backup_path');
                if (!backupPath) {
                    if (window.electronAPI?.selectBackupFolder) {
                        const path = await window.electronAPI.selectBackupFolder();
                        if (path) {
                            localStorage.setItem('focusflow_backup_path', path);
                            backupPath = path;
                        }
                    }
                }

                if (!backupPath) {
                    if (isMounted.current) setStatus('Error: No Sync Folder.');
                    return;
                }

                let subfolder = '';
                const inboxFile = localStorage.getItem('focusflow_obsidian_inbox_filename') || 'Inbox.md';
                const parts = inboxFile.split(/[/\\]/);
                if (parts.length > 1) {
                    parts.pop();
                    subfolder = parts.join('/');
                }
                const filename = `Voice Note ${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                const savePath = subfolder ? `${subfolder}/${filename}` : filename;
                const result = await window.electronAPI?.saveBinaryFile(backupPath, savePath, uint8Array);
                
                if (isMounted.current) {
                    if (result?.success) {
                        const link = ` ![[${filename}]]`;
                        if (inputRef.current) {
                            const start = inputRef.current.selectionStart || 0;
                            const end = inputRef.current.selectionEnd || 0;
                            const newText = text.substring(0, start) + link + text.substring(end);
                            setText(newText);
                        } else {
                            setText(prev => prev + link);
                        }
                        setStatus('Audio saved!');
                    } else {
                        setStatus('Error saving audio.');
                    }
                }
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            if (isMounted.current) {
                setIsRecording(true);
                setStatus('Recording...');
            }
        } catch (err) {
            console.error('Error accessing microphone:', err);
            if (isMounted.current) setStatus('Error: Mic access denied.');
            if (isMounted.current) setIsRecording(false);
        }
    };

    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, input, textarea')) return;
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    if (!isOpen) return null;

    const isMiniCapture = typeof window !== 'undefined' && window.location.hash === '#minicapture';

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => {
            if (!isPinned) {
                if (isMiniCapture) window.electronAPI?.closeMiniCapture?.();
                onClose();
            }
        }}>
            <div 
                className={`w-full max-w-xl p-4 rounded-2xl shadow-2xl border transform scale-100 ${isDragging ? '' : 'transition-all'} ${isCyberpunk ? 'bg-black border-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.3)]' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}
                onClick={e => e.stopPropagation()}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            >
                <div 
                    className={`flex items-center justify-between mb-3 ${isMiniCapture ? '' : 'cursor-move'}`} 
                    onMouseDown={isMiniCapture ? undefined : handleDragStart}
                    style={isMiniCapture ? { WebkitAppRegion: 'drag' } as any : {}}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚡</span>
                        <h3 className={`font-bold text-lg ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Quick Capture</h3>
                    </div>
                    <div 
                        className="flex items-center gap-2 relative z-50"
                        style={isMiniCapture ? { WebkitAppRegion: 'no-drag' } as any : {}}
                    >
                        <button 
                            onClick={() => setIsPinned(!isPinned)} 
                            className={`p-1.5 rounded-full transition-colors ${isPinned ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10' : 'text-blue-500 bg-blue-50 dark:bg-blue-900/20') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}`}
                            title={isPinned ? "Unpin (Close on click outside)" : "Pin (Stay open)"}
                            style={isMiniCapture ? { WebkitAppRegion: 'no-drag' } as any : {}}
                        >
                            <svg className="w-4 h-4" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                        </button>
                        <button onClick={() => {
                            if (isMiniCapture) window.electronAPI?.closeMiniCapture?.();
                            onClose();
                        }} className={`p-1.5 rounded-full transition-colors ${isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        style={isMiniCapture ? { WebkitAppRegion: 'no-drag' } as any : {}}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <form onSubmit={handleCapture}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder={isEnhancing ? "AI is rewriting..." : "Capture thought, task, or idea..."}
                        className={`w-full text-lg px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-black/30 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500'} ${isEnhancing ? 'opacity-50 animate-pulse' : ''} ${isRecording ? 'ring-red-500 border-red-500' : ''}`}
                    />
                    <div className="flex justify-between items-center mt-3">
                        <span className={`text-xs font-mono ${status.startsWith('Error') ? 'text-red-500' : (isCyberpunk ? 'text-[#00f0ff]/70' : 'text-green-600')}`}>{status}</span>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={toggleRecording} className={`p-1.5 rounded-md transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : (isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200')}`} title="Voice Note">
                                {isRecording ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                            </button>
                            <div className="relative" ref={menuRef}>
                                <button 
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setShowPrompts(!showPrompts)} 
                                    disabled={isEnhancing} 
                                    className={`p-1.5 rounded-md transition-all ${isEnhancing ? 'text-purple-500 animate-spin' : (isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20')}`} 
                                    title="AI Tools"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </button>
                                {showPrompts && (
                                    <div className={`absolute bottom-full left-0 mb-2 w-40 rounded-xl shadow-xl border z-50 overflow-hidden flex flex-col ${isCyberpunk ? 'bg-black border-[#00f0ff] text-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}>
                                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSmartEnhance('enhance')} className={`text-left px-4 py-2 text-xs font-medium transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>✨ Enhance</button>
                                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSmartEnhance('fix')} className={`text-left px-4 py-2 text-xs font-medium transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>🔧 Fix Grammar</button>
                                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSmartEnhance('task')} className={`text-left px-4 py-2 text-xs font-medium transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>✅ Make Task</button>
                                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleSmartEnhance('steps')} className={`text-left px-4 py-2 text-xs font-medium transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>📋 Breakdown</button>
                                        {customPrompts.map(p => (
                                            <button onMouseDown={(e) => e.preventDefault()} key={p.id} onClick={() => handleSmartEnhance(p.id)} className={`text-left px-4 py-2 text-xs font-medium transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>⚡ {p.label}</button>
                                        ))}
                                        {window.electronAPI?.platform === 'darwin' && (
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={triggerContextMenu} className={`text-left px-4 py-2 text-xs font-medium transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}> Writing Tools</button>
                                        )}
                                        <div className={`h-px my-1 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setIsManagingPrompts(true); setShowPrompts(false); }} className={`text-left px-4 py-2 text-xs font-medium transition-colors opacity-60 hover:opacity-100 ${isCyberpunk ? 'hover:bg-[#00f0ff]/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>⚙️ Manage Prompts</button>
                                    </div>
                                )}
                            </div>
                            <div className={`text-[10px] uppercase tracking-wider font-bold ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400'}`}>Press Enter to Save</div>
                        </div>
                    </div>
                </form>
                <PromptManager 
                    isOpen={isManagingPrompts} 
                    onClose={() => setIsManagingPrompts(false)} 
                    isCyberpunk={isCyberpunk} 
                    prompts={customPrompts} 
                    onUpdatePrompts={updateCustomPrompts} 
                />
            </div>
        </div>
    );
};