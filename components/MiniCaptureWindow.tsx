/// <reference path="../electron.d.ts" />
import React, { useState, useEffect, useRef } from 'react';
import { useTheme, useProjects } from '../AppContext';
import { CustomPrompt, CaptureDestination, Project } from '../types';
import { PromptManager } from './PromptManager';
import * as storage from '../services/storageService';
import { parseNaturalLanguage } from './nlService';

export const MiniCaptureWindow: React.FC = () => {
    const { appTheme } = useTheme();
    const isCyberpunk = appTheme === 'cyberpunk';
    const [text, setText] = useState('');
    const { projects } = useProjects();
    const [status, setStatus] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);
    const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
    const [isManagingPrompts, setIsManagingPrompts] = useState(false);
    const [autoClose, setAutoClose] = useState(() => {
        const saved = localStorage.getItem('focusflow_quick_capture_autoclose');
        return saved !== null ? saved === 'true' : true;
    });
    
    const [destinations, setDestinations] = useState<CaptureDestination[]>(() => {
        const saved = localStorage.getItem('focusflow_capture_destinations');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch {}
        }
        const inboxFile = localStorage.getItem('focusflow_obsidian_inbox_filename') || 'Inbox.md';
        return [{ id: 'inbox', name: 'Inbox', path: inboxFile, type: 'file' }, { id: 'daily', name: 'Daily Note', path: '', type: 'daily' }];
    });
    const [selectedDestId, setSelectedDestId] = useState<string>(() => localStorage.getItem('focusflow_capture_default_dest_id') || 'inbox');

    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isPinned, setIsPinned] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const isAutocompleteOpenRef = useRef(false);
    const [parsedProject, setParsedProject] = useState('');
    const [parsedDate, setParsedDate] = useState('');
    const [parsedDuration, setParsedDuration] = useState('');
    const [parsedPriority, setParsedPriority] = useState('');

    // Autocomplete State
    const [allTags, setAllTags] = useState<string[]>([]);
    const [autocomplete, setAutocomplete] = useState<{
        isOpen: boolean;
        type: 'project' | 'tag' | null;
        query: string;
        selectedIndex: number;
        cursorIndex: number;
    }>({ isOpen: false, type: null, query: '', selectedIndex: 0, cursorIndex: -1 });

    useEffect(() => {
        const parseInput = (inputText: string) => {
            let pProject = '';
            let pPriority = '';
            let pDate = '';

            // Projects (#)
            const projectRegex = /#(\w+)/g;
            let match;
            while ((match = projectRegex.exec(inputText)) !== null) {
                const word = match[1];
                const project = projects.find(p => p.name.toLowerCase() === word.toLowerCase());
                if (project) {
                    pProject = project.name;
                }
            }

            // Priority (!)
            const priorityRegex = /!(high|med|low|1|2|3)/i;
            const pMatch = inputText.match(priorityRegex);
            if (pMatch) {
                const p = pMatch[1].toLowerCase();
                if (p === 'high' || p === '1') pPriority = 'High';
                else if (p === 'med' || p === '2') pPriority = 'Medium';
                else if (p === 'low' || p === '3') pPriority = 'Low';
            }

            // Date
            const dateRegex = /\b(today|tomorrow|next week|mon|tue|wed|thu|fri|sat|sun)\b/gi;
            const dMatch = inputText.match(dateRegex);
            if (dMatch) {
                pDate = dMatch[0];
            }

            // Natural Language Date/Time
            const { date, time, duration } = parseNaturalLanguage(inputText);
            if (date) {
                pDate = date.toISOString();
            }

            setParsedProject(pProject);
            setParsedPriority(pPriority);
            setParsedDate(pDate);
            setParsedDuration(duration || '');
        };
        parseInput(text);
    }, [text, projects]);

    // Sync autocomplete state to ref for global event handler
    useEffect(() => { isAutocompleteOpenRef.current = autocomplete.isOpen; }, [autocomplete.isOpen]);

    useEffect(() => {
        // Focus immediately
        textareaRef.current?.focus();
        
        // Handle ESC to close
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isAutocompleteOpenRef.current) return; // Let component handle it
                window.electronAPI?.close();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        // Load tags for autocomplete
        const loadTags = async () => {
            try {
                const tasks = await storage.getTasks();
                const tagSet = new Set<string>(['urgent', 'later', 'waiting', 'idea']);
                tasks.forEach(t => t.tags?.forEach(tag => tagSet.add(tag)));
                setAllTags(Array.from(tagSet));
            } catch (e) {
                console.error("Failed to load tags", e);
            }
        };
        loadTags();
    }, []);
    
    useEffect(() => {
        const savedPrompts = localStorage.getItem('focusflow_custom_prompts');
        if (savedPrompts) {
            try {
                setCustomPrompts(JSON.parse(savedPrompts));
            } catch {}
        }

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

    const handleSmartEnhance = async (type: string = 'enhance') => {
        if (!text.trim()) return;
        setShowPrompts(false);
        
        let apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            setStatus('Error: Set API Key in Settings');
            return;
        }

        setIsEnhancing(true);
        setStatus('✨ Enhancing...');

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

            if (!response.ok) {
                console.error("Gemini API Error:", data);
                setStatus(`Error: ${data.error?.message || response.statusText}`);
                return;
            }

            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                setText(data.candidates[0].content.parts[0].text.trim());
                setStatus('✨ Enhanced!');
            } else {
                setStatus('Error: No response');
            }
        } catch (e) {
            console.error(e);
            setStatus('Error: Network');
        } finally {
            setIsEnhancing(false);
            setTimeout(() => setStatus(''), 2000);
        }
    };

    const updateCustomPrompts = (newPrompts: CustomPrompt[]) => {
        setCustomPrompts(newPrompts);
        localStorage.setItem('focusflow_custom_prompts', JSON.stringify(newPrompts));
    };

    const triggerContextMenu = () => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            const rect = textareaRef.current.getBoundingClientRect();
            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            });
            textareaRef.current.dispatchEvent(event);
            setShowPrompts(false);
        }
    };

    const getFilteredItems = () => {
        if (autocomplete.type === 'project') {
            return projects.filter(p => p.name.toLowerCase().includes(autocomplete.query.toLowerCase()));
        }
        if (autocomplete.type === 'tag') {
            return allTags.filter(t => t.toLowerCase().includes(autocomplete.query.toLowerCase()));
        }
        return [];
    };

    const applyAutocomplete = (item?: any) => {
        const items = getFilteredItems();
        const selected = item || items[autocomplete.selectedIndex];
        if (!selected) return;
        
        const name = autocomplete.type === 'project' ? (selected as Project).name : (selected as string);
        const prefix = autocomplete.type === 'project' ? '#' : '@';
        
        const before = text.substring(0, autocomplete.cursorIndex);
        // Remove the query part after the trigger
        const after = text.substring(textareaRef.current?.selectionEnd || 0);
        
        const newText = `${before}${prefix}${name} ${after}`;
        setText(newText);
        setAutocomplete(prev => ({ ...prev, isOpen: false }));
        
        // Restore focus and cursor
        setTimeout(() => {
            if (textareaRef.current) {
                const newCursorPos = before.length + prefix.length + name.length + 1;
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const renderOverlay = () => {
        if (!text) return null;
        const regex = /(#\w+)|(@\w+)|(!(?:high|med|low|1|2|3))|(\b(?:today|tomorrow|next week|mon|tue|wed|thu|fri|sat|sun)\b)/gi;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
            }
            const fullMatch = match[0];
            let className = "";
            if (match[1]) { // #Project
                const word = match[1].substring(1);
                const isProject = projects.some(p => p.name.toLowerCase() === word.toLowerCase());
                className = isProject ? "text-blue-400 font-bold" : "text-blue-300";
            } else if (match[2]) { // @Tag
                className = "text-purple-400";
            } else if (match[3]) { // !Priority
                className = "text-red-400 font-bold";
            } else if (match[4]) { // Date
                className = "text-green-400 italic";
            }
            parts.push(<span key={`match-${match.index}`} className={className}>{fullMatch}</span>);
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
        }
        if (text.endsWith('\n')) parts.push(<span key="newline">{'\n'}</span>);

        return (
            <div className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words p-8 text-lg leading-relaxed font-mono ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-800 dark:text-gray-200'}`}>
                {parts}
            </div>
        );
    };

    const insertText = (str: string) => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newText = text.substring(0, start) + str + text.substring(end);
        setText(newText);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + str.length;
                textareaRef.current.focus();
            }
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const isImage = file.type.startsWith('image/');
            const markdown = isImage ? `\n![[${file.name}]]` : `\n[[${file.name}]]`;
            insertText(markdown);
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
                    setStatus('Error: No Sync Folder.');
                    return;
                }

                let subfolder = '';
                const dest = destinations.find(d => d.id === selectedDestId);
                if (dest && dest.type === 'daily') {
                    subfolder = localStorage.getItem('focusflow_obsidian_daily_folder') || '';
                } else if (dest && dest.type === 'file') {
                    const parts = dest.path.split(/[/\\]/);
                    if (parts.length > 1) {
                        parts.pop();
                        subfolder = parts.join('/');
                    }
                }
                const filename = `Voice Note ${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                const savePath = subfolder ? `${subfolder}/${filename}` : filename;
                const result = await window.electronAPI?.saveBinaryFile(backupPath, savePath, uint8Array);
                
                if (result?.success) {
                    insertText(`\n![[${filename}]]`);
                    setStatus('Audio saved!');
                } else {
                    setStatus('Error saving audio.');
                }
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setStatus('Recording...');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setStatus('Error: Mic access denied.');
            setIsRecording(false);
        }
    };

    const handleCapture = async () => {
        if (!text.trim()) return;
        
        setStatus('Saving...');
        let backupPath = localStorage.getItem('focusflow_backup_path');
        
        if (!backupPath) {
            if (window.electronAPI?.selectBackupFolder) {
                const path = await window.electronAPI.selectBackupFolder();
                if (path) {
                    localStorage.setItem('focusflow_backup_path', path);
                    backupPath = path;
                } else {
                    setStatus('Error: No Sync Folder.');
                    return;
                }
            } else {
                setStatus('Error: No Sync Folder.');
                return;
            }
        }

        const now = new Date();
        let line = `\n- [ ] ${text.trim()}`;
        if (parsedProject) line += ` #project:${parsedProject}`;
        if (parsedDate) line += ` 📅 ${parsedDate}`;
        if (parsedPriority) line += ` 🔺 ${parsedPriority}`;
        line += ` #quick-capture 📅 ${now.toLocaleString()}`;

        try {
            let result;
            const dest = destinations.find(d => d.id === selectedDestId);
            const position = dest?.position || localStorage.getItem('focusflow_obsidian_position') || 'append';

            if (dest && dest.type === 'daily') {
                 const dateFormat = localStorage.getItem('focusflow_obsidian_date_format') || 'YYYY-MM-DD';
                 const dailyFolder = localStorage.getItem('focusflow_obsidian_daily_folder') || '';
                 const year = now.getFullYear().toString();
                 const month = String(now.getMonth() + 1).padStart(2, '0');
                 const day = String(now.getDate()).padStart(2, '0');
                 const dateStr = dateFormat.replace('YYYY', year).replace('MM', month).replace('DD', day);
                 const filename = (dailyFolder ? `${dailyFolder}/${dateStr}` : dateStr) + '.md';
                 const header = dest.header || localStorage.getItem('focusflow_obsidian_header') || '';
                 result = await window.electronAPI?.updateDailyNote(backupPath, filename, line, header, position);
            } else if (dest) {
                 result = await window.electronAPI?.updateDailyNote(backupPath, dest.path, line, dest.header || '', position);
            }

            if (result?.success) {
                setStatus('Saved!');
                setText('');
                if (autoClose) {
                    setTimeout(() => {
                        window.electronAPI?.close();
                    }, 500);
                }
            } else {
                setStatus(`Error: ${result?.error}`);
            }
        } catch (err) {
            setStatus('Failed.');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (autocomplete.isOpen) {
            const items = getFilteredItems();
            if (items.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAutocomplete(prev => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % items.length }));
                    return;
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAutocomplete(prev => ({ ...prev, selectedIndex: (prev.selectedIndex - 1 + items.length) % items.length }));
                    return;
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    applyAutocomplete();
                    return;
                }
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setAutocomplete(prev => ({ ...prev, isOpen: false }));
                return;
            }
        }

        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleCapture();
        }
    };

    const togglePin = () => {
        const newState = !isPinned;
        setIsPinned(newState);
        (window.electronAPI as any)?.setAlwaysOnTop(newState);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.screenX;
        const startY = e.screenY;
        const startWidth = window.outerWidth;
        const startHeight = window.outerHeight;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(300, startWidth + (e.screenX - startX));
            const newHeight = Math.max(200, startHeight + (e.screenY - startY));
            (window.electronAPI as any)?.resizeWindow(Math.round(newWidth), Math.round(newHeight));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className={`h-screen w-screen flex flex-col overflow-hidden transition-all duration-300 ${isCyberpunk ? 'bg-black/40 text-[#00f0ff] font-mono border border-[#00f0ff]/30' : 'bg-white/60 dark:bg-[#121212]/60 text-gray-900 dark:text-white border border-gray-200/20 dark:border-white/10'} backdrop-blur-2xl rounded-2xl`}>
            {/* Drag Handle & Header */}
            <div className="h-12 w-full flex items-center justify-between px-5 bg-transparent shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
                <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${isCyberpunk ? 'bg-[#00f0ff]/10' : 'bg-gray-100/50 dark:bg-white/5'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isCyberpunk ? 'bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]' : 'bg-blue-500'}`}></div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]/70' : 'text-gray-500 dark:text-gray-400'}`}>Quick Capture</span>
                    </div>
                    
                    {/* Destination Switcher (Robust Dropdown) */}
                    <div className={`relative flex items-center ${isCyberpunk ? 'bg-[#00f0ff]/5 border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-white/5 border border-transparent'} rounded-lg`}>
                        <select
                            value={selectedDestId}
                            onChange={(e) => setSelectedDestId(e.target.value)}
                            className={`appearance-none bg-transparent border-none py-1 pl-3 pr-8 text-[10px] font-bold rounded-lg focus:ring-0 cursor-pointer outline-none ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-200'}`}
                        >
                            {destinations.map(d => (
                                <option key={d.id} value={d.id} className={isCyberpunk ? 'bg-black text-[#00f0ff]' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}>{d.name}</option>
                            ))}
                        </select>
                        <div className={`absolute right-2 pointer-events-none ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button 
                        onClick={togglePin} 
                        className={`w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors ${isPinned ? (isCyberpunk ? 'text-[#00f0ff]' : 'text-blue-500') : (isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-400 dark:text-gray-500')}`}
                        title={isPinned ? "Unpin" : "Pin on Top"}
                    >
                        <svg className="w-3.5 h-3.5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    </button>
                    <button 
                        onClick={() => window.electronAPI?.close()} 
                        className={`w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 px-5 pb-5 flex flex-col relative">
                <div className="relative flex-1 w-full h-full rounded-xl overflow-hidden">
                    {renderOverlay()}
                    
                    {/* Autocomplete Dropdown */}
                    {autocomplete.isOpen && getFilteredItems().length > 0 && (
                        <div className={`absolute z-50 left-8 top-16 w-64 max-h-48 overflow-y-auto rounded-xl shadow-2xl border animate-fade-in ${isCyberpunk ? 'bg-black border-[#00f0ff] text-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                            <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-50 border-b ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-100 dark:border-gray-700'}`}>
                                {autocomplete.type === 'project' ? 'Projects' : 'Tags'}
                            </div>
                            {getFilteredItems().map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => applyAutocomplete(item)}
                                    className={`w-full text-left px-4 py-2 text-sm truncate transition-colors ${i === autocomplete.selectedIndex ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300') : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                    {autocomplete.type === 'project' ? (item as Project).name : item}
                                </button>
                            ))}
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => {
                            const val = e.target.value;
                            setText(val);
                            
                            const cursor = e.target.selectionEnd;
                            const textBefore = val.substring(0, cursor);
                            
                            // Match #word or @word at the end of the string (or preceded by space)
                            const projectMatch = textBefore.match(/(?:^|\s)#([\w-]*)$/);
                            const tagMatch = textBefore.match(/(?:^|\s)@([\w-]*)$/);

                            if (projectMatch) {
                                setAutocomplete({
                                    isOpen: true,
                                    type: 'project',
                                    query: projectMatch[1],
                                    selectedIndex: 0,
                                    cursorIndex: projectMatch.index! + (projectMatch[0].startsWith(' ') ? 1 : 0)
                                });
                            } else if (tagMatch) {
                                setAutocomplete({
                                    isOpen: true,
                                    type: 'tag',
                                    query: tagMatch[1],
                                    selectedIndex: 0,
                                    cursorIndex: tagMatch.index! + (tagMatch[0].startsWith(' ') ? 1 : 0)
                                });
                            } else {
                                setAutocomplete(prev => ({ ...prev, isOpen: false }));
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        placeholder={isEnhancing ? "AI is rewriting..." : "Capture your thought..."}
                        className={`absolute inset-0 w-full h-full bg-transparent border-none focus:ring-0 resize-none text-lg leading-relaxed p-8 font-mono transition-all outline-none text-transparent ${isCyberpunk ? 'caret-[#00f0ff] placeholder-[#00f0ff]/30' : 'caret-gray-900 dark:caret-white placeholder-gray-400'} ${isEnhancing ? 'opacity-50 animate-pulse' : ''} ${isDragging ? (isCyberpunk ? 'bg-[#00f0ff]/5' : 'bg-blue-50/50 dark:bg-blue-900/10') : ''}`}
                        spellCheck={false}
                    />
                </div>
                
                {/* Toolbar */}
                <div className={`flex justify-between items-center mt-2 pt-3 border-t transition-colors ${isCyberpunk ? 'border-[#00f0ff]/10' : 'border-gray-200/50 dark:border-white/5'}`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono truncate max-w-[150px] transition-colors ${status.startsWith('Error') ? 'text-red-500' : (isCyberpunk ? 'text-[#00f0ff]/70' : 'text-gray-400 dark:text-gray-500')}`}>
                            {status || (text.length > 0 ? `${text.length} chars` : 'Ready')}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => {
                                const newVal = !autoClose;
                                setAutoClose(newVal);
                                localStorage.setItem('focusflow_quick_capture_autoclose', String(newVal));
                            }}
                            className={`p-2 rounded-xl transition-all duration-200 ${autoClose ? (isCyberpunk ? 'text-[#00f0ff] bg-[#00f0ff]/10' : 'text-green-600 bg-green-50 dark:bg-green-900/20') : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}`}
                            title={autoClose ? "Auto-close after save: ON" : "Auto-close after save: OFF"}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                        <button 
                            onClick={toggleRecording} 
                            className={`p-2 rounded-xl transition-all duration-200 group ${isRecording ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/50' : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5')}`} 
                            title="Voice Note"
                        >
                            {isRecording ? (
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold">REC</span>
                                </div>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            )}
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setShowPrompts(!showPrompts)} 
                                disabled={isEnhancing} 
                                className={`p-2 rounded-xl transition-all duration-200 ${isEnhancing ? 'text-purple-500 animate-spin' : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20')}`} 
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

                        <div className={`w-px h-4 mx-1 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gray-200 dark:bg-gray-700'}`}></div>

                        <button 
                            onClick={handleCapture}
                            disabled={!text.trim()}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-sm ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/90 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] disabled:opacity-50 disabled:shadow-none' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                        >
                            <span>Save</span>
                            <span className={`text-[9px] font-normal ${isCyberpunk ? 'opacity-60' : 'opacity-50'}`}>⌘↵</span>
                        </button>
                    </div>
                </div>
            </div>
            <PromptManager 
                isOpen={isManagingPrompts} 
                onClose={() => setIsManagingPrompts(false)} 
                isCyberpunk={isCyberpunk} 
                prompts={customPrompts} 
                onUpdatePrompts={updateCustomPrompts} 
            />
            {/* Resize Handle */}
            <div onMouseDown={handleResizeStart} className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 opacity-0 hover:opacity-100 transition-opacity">
                <svg className={`w-3 h-3 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-400 dark:text-gray-500'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM14 22H12V20H14V22ZM18 18H16V16H18V18Z" />
                </svg>
            </div>
        </div>
    );
};
