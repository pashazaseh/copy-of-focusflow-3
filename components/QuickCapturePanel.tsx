/// <reference path="../electron.d.ts" />
import React, { useState, useEffect, useRef } from 'react';
import { useTheme, useProjects } from '../AppContext';
import { CustomPrompt, CaptureDestination, Project } from '../types';
import { PromptManager } from './PromptManager';
import * as storage from '../services/storageService';
import { parseNaturalLanguage } from './nlService';

interface CaptureTemplate {
    id: string;
    name: string;
    content: string;
}

export const QuickCapturePanel: React.FC = () => {
    const { appTheme } = useTheme();
    const { projects } = useProjects();
    const isCyberpunk = appTheme === 'cyberpunk';
    const [text, setText] = useState('');
    
    // Destinations State
    const [destinations, setDestinations] = useState<CaptureDestination[]>(() => {
        const saved = localStorage.getItem('focusflow_capture_destinations');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch {}
        }
        const inboxFile = localStorage.getItem('focusflow_obsidian_inbox_filename') || 'Inbox.md';
        return [
            { id: 'inbox', name: 'Inbox', path: inboxFile, type: 'file' },
            { id: 'daily', name: 'Daily Note', path: '', type: 'daily' }
        ];
    });

    const [defaultDestId, setDefaultDestId] = useState<string>(() => {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('focusflow_capture_default_dest_id') || 'inbox';
        }
        return 'inbox';
    });

    const [selectedDestId, setSelectedDestId] = useState<string>(() => {
        if (typeof localStorage !== 'undefined') {
            const savedDefault = localStorage.getItem('focusflow_capture_default_dest_id');
            if (savedDefault) return savedDefault;

            const mode = localStorage.getItem('focusflow_obsidian_mode');
            if (mode === 'daily') return 'daily';
        }
        return 'inbox';
    });

    useEffect(() => {
        if (destinations.length > 0 && !destinations.find(d => d.id === selectedDestId)) {
            setSelectedDestId(destinations[0].id);
        }
    }, [destinations, selectedDestId]);

    // Management State
    const [isManagingDestinations, setIsManagingDestinations] = useState(false);
    const [newDestName, setNewDestName] = useState('');
    const [newDestPath, setNewDestPath] = useState('');
    const [newDestHeader, setNewDestHeader] = useState('');
    const [newDestType, setNewDestType] = useState<'file' | 'daily'>('file');
    const [newDestPosition, setNewDestPosition] = useState<'append' | 'prepend'>('append');
    const [editingDestId, setEditingDestId] = useState<string | null>(null);

    const [status, setStatus] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [captureType, setCaptureType] = useState<'task' | 'bullet' | 'text' | 'header'>('task');
    const [tags, setTags] = useState<string[]>(['quick-capture']);
    const [tagInput, setTagInput] = useState('');
    const [position, setPosition] = useState<'append' | 'prepend'>('append');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [templates, setTemplates] = useState<CaptureTemplate[]>([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);
    const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
    const [isManagingPrompts, setIsManagingPrompts] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [isManagingTemplates, setIsManagingTemplates] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [editTemplateName, setEditTemplateName] = useState('');
    const [editTemplateContent, setEditTemplateContent] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const textRef = useRef(text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const templatesRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
    const [selectedHeader, setSelectedHeader] = useState('');
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [isCreatingHeader, setIsCreatingHeader] = useState(false);
    const [isCreatingDestHeader, setIsCreatingDestHeader] = useState(false);
    const [backupPath, setBackupPath] = useState(() => {
        if (typeof localStorage !== 'undefined') return localStorage.getItem('focusflow_backup_path') || '';
        return '';
    });
    const [parsedDate, setParsedDate] = useState<string | null>(null);
    const [parsedPriority, setParsedPriority] = useState<'high' | 'medium' | 'low' | null>(null);

    // Autocomplete State
    const [allTags, setAllTags] = useState<string[]>([]);
    const [autocomplete, setAutocomplete] = useState<{
        isOpen: boolean;
        type: 'project' | 'tag' | null;
        query: string;
        selectedIndex: number;
        cursorIndex: number;
    }>({ isOpen: false, type: null, query: '', selectedIndex: 0, cursorIndex: -1 });

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        const savedHistory = localStorage.getItem('focusflow_capture_history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch {}
        }
        const savedTemplates = localStorage.getItem('focusflow_capture_templates');
        if (savedTemplates) {
            try {
                setTemplates(JSON.parse(savedTemplates));
            } catch {}
        }
        const savedPrompts = localStorage.getItem('focusflow_custom_prompts');
        if (savedPrompts) {
            try {
                setCustomPrompts(JSON.parse(savedPrompts));
            } catch {}
        }
        textareaRef.current?.focus();

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
        textRef.current = text;
    }, [text]);

    useEffect(() => {
        const parseInput = (inputText: string) => {
            let newProjectId = '';
            let newPriority: 'high' | 'medium' | 'low' | null = null;
            let newDate: string | null = null;
            const extractedTags: string[] = [];

            // Projects (#)
            const projectRegex = /#(\w+)/g;
            let match;
            while ((match = projectRegex.exec(inputText)) !== null) {
                const word = match[1];
                const project = projects.find(p => p.name.toLowerCase() === word.toLowerCase());
                if (project) {
                    newProjectId = project.id;
                } else {
                    extractedTags.push(word);
                }
            }

            // Tags (@)
            const tagRegex = /@(\w+)/g;
            while ((match = tagRegex.exec(inputText)) !== null) {
                extractedTags.push(match[1]);
            }

            // Priority (!)
            const priorityRegex = /!(high|med|low|1|2|3)/i;
            const pMatch = inputText.match(priorityRegex);
            if (pMatch) {
                const p = pMatch[1].toLowerCase();
                if (p === 'high' || p === '1') newPriority = 'high';
                else if (p === 'med' || p === '2') newPriority = 'medium';
                else if (p === 'low' || p === '3') newPriority = 'low';
            }

            // Date
            const { date, dateLabel } = parseNaturalLanguage(inputText);
            if (date) {
                newDate = dateLabel || date.toLocaleDateString();
            }

            if (newProjectId && newProjectId !== selectedProjectId) setSelectedProjectId(newProjectId);
            setParsedPriority(newPriority);
            setParsedDate(newDate);
        };
        parseInput(text);
    }, [text, projects, selectedProjectId]);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (templatesRef.current && !templatesRef.current.contains(event.target as Node)) {
                setShowTemplates(false);
                setIsSavingTemplate(false);
            }
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowPrompts(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const dest = destinations.find(d => d.id === selectedDestId);
        if (dest) {
            setSelectedHeader(dest.header || '');
            
            if (backupPath) {
                let filename = dest.path;
                if (dest.type === 'daily') {
                     const dateFormat = localStorage.getItem('focusflow_obsidian_date_format') || 'YYYY-MM-DD';
                     const dailyFolder = localStorage.getItem('focusflow_obsidian_daily_folder') || '';
                     const now = new Date();
                     const year = now.getFullYear().toString();
                     const month = String(now.getMonth() + 1).padStart(2, '0');
                     const day = String(now.getDate()).padStart(2, '0');
                     const dateStr = dateFormat.replace('YYYY', year).replace('MM', month).replace('DD', day);
                     filename = (dailyFolder ? `${dailyFolder}/${dateStr}` : dateStr) + '.md';
                }
                
                if (filename && window.electronAPI?.getFileHeaders) {
                    window.electronAPI.getFileHeaders(backupPath, filename).then(res => {
                        if (res?.success && res.headers) {
                            setFileHeaders(res.headers);
                        } else {
                            setFileHeaders([]);
                        }
                    });
                }
            }
        }
    }, [selectedDestId, destinations, backupPath]);

    const handleHeaderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__new__') {
            setIsCreatingHeader(true);
            setSelectedHeader('');
        } else {
            setSelectedHeader(val);
        }
    };

    const handleDestHeaderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__new__') {
            setIsCreatingDestHeader(true);
            setNewDestHeader('');
        } else {
            setNewDestHeader(val);
        }
    };

    const fetchHeaders = async (filename: string, type: 'file' | 'daily') => {
        let targetFile = filename;
        if (type === 'daily') {
             const dateFormat = localStorage.getItem('focusflow_obsidian_date_format') || 'YYYY-MM-DD';
             const dailyFolder = localStorage.getItem('focusflow_obsidian_daily_folder') || '';
             const now = new Date();
             const year = now.getFullYear().toString();
             const month = String(now.getMonth() + 1).padStart(2, '0');
             const day = String(now.getDate()).padStart(2, '0');
             const dateStr = dateFormat.replace('YYYY', year).replace('MM', month).replace('DD', day);
             targetFile = (dailyFolder ? `${dailyFolder}/${dateStr}` : dateStr) + '.md';
        }

        if (!targetFile) return;

        const result = await window.electronAPI?.getFileHeaders?.(backupPath || '', targetFile);
        let headers: string[] = [];
        if (result?.success && result.headers) {
            headers = result.headers;
        }
        
        if (newDestHeader && !headers.includes(newDestHeader)) {
            headers = [...headers, newDestHeader];
        }
        setAvailableHeaders(headers);
    };

    const handleSelectDestFile = async () => {
        const api = (window as any).electronAPI;
        if (!api?.selectFile) {
            alert("File selection is only available in the desktop app.");
            return;
        }
        const path = await api.selectFile();
        if (path) {
            let relativePath = path;
            // Try to make path relative if inside backup folder
            if (backupPath && path.startsWith(backupPath)) {
                relativePath = path.substring(backupPath.length);
                if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
                    relativePath = relativePath.substring(1);
                }
            }
            setNewDestPath(relativePath);
            await fetchHeaders(relativePath, 'file');
        }
    };

    const handleCreateDestFile = async () => {
        const api = (window as any).electronAPI;
        if (!api?.createNewFile) return;

        // Use native save dialog to choose folder and filename
        const filePath = await api.createNewFile();
        
        if (filePath) {
            let finalPath = filePath;
            
            // Make relative if possible
            if (backupPath && filePath.startsWith(backupPath)) {
                finalPath = filePath.substring(backupPath.length);
                if (finalPath.startsWith('/') || finalPath.startsWith('\\')) {
                    finalPath = finalPath.substring(1);
                }
            }
            
            setNewDestPath(finalPath);
            await fetchHeaders(finalPath, 'file');
        }
    };

    const saveDestination = () => {
        if (!newDestName.trim()) return;
        if (newDestType === 'file' && !newDestPath.trim()) return;

        const newDest: CaptureDestination = {
            id: editingDestId || Date.now().toString(),
            name: newDestName.trim(),
            path: newDestType === 'file' ? newDestPath.trim() : '',
            type: newDestType,
            header: newDestHeader.replace(/^#+\s*/, '').trim(),
            position: newDestPosition
        };
        
        let updated;
        if (editingDestId) {
            updated = destinations.map(d => d.id === editingDestId ? newDest : d);
        } else {
            updated = [...destinations, newDest];
        }

        setDestinations(updated);
        localStorage.setItem('focusflow_capture_destinations', JSON.stringify(updated));
        
        cancelEditDestination();
    };

    const startEditingDestination = (dest: CaptureDestination) => {
        setEditingDestId(dest.id);
        setNewDestName(dest.name);
        setNewDestPath(dest.path);
        setNewDestHeader(dest.header || '');
        setNewDestType(dest.type);
        setNewDestPosition(dest.position || 'append');
    };

    const cancelEditDestination = () => {
        setEditingDestId(null);
        setNewDestName('');
        setNewDestPath('');
        setNewDestHeader('');
        setNewDestPosition('append');
        setNewDestType('file');
    };

    const handleSetDefault = (id: string) => {
        setDefaultDestId(id);
        localStorage.setItem('focusflow_capture_default_dest_id', id);
    };

    const moveDestination = (index: number, direction: 'up' | 'down') => {
        const newDestinations = [...destinations];
        if (direction === 'up' && index > 0) {
            [newDestinations[index], newDestinations[index - 1]] = [newDestinations[index - 1], newDestinations[index]];
        } else if (direction === 'down' && index < newDestinations.length - 1) {
            [newDestinations[index], newDestinations[index + 1]] = [newDestinations[index + 1], newDestinations[index]];
        } else {
            return;
        }
        setDestinations(newDestinations);
        localStorage.setItem('focusflow_capture_destinations', JSON.stringify(newDestinations));
    };

    const removeDestination = (id: string) => {
        if (destinations.length <= 1) {
            alert("You must have at least one destination.");
            return;
        }
        if (confirm("Remove this destination?")) {
            const updated = destinations.filter(d => d.id !== id);
            setDestinations(updated);
            localStorage.setItem('focusflow_capture_destinations', JSON.stringify(updated));
        }
    };

    const handleCapture = async () => {
        if (!text.trim()) return;
        
        if (isMounted.current) setStatus('Sending...');
        let currentBackupPath = backupPath;
        if (!currentBackupPath) {
            if (window.electronAPI?.selectBackupFolder) {
                const path = await window.electronAPI.selectBackupFolder();
                if (path) {
                    localStorage.setItem('focusflow_backup_path', path);
                    setBackupPath(path);
                    currentBackupPath = path;
                } else {
                    if (isMounted.current) setStatus('Error: No Sync Folder configured.');
                    return;
                }
            } else {
                if (isMounted.current) setStatus('Error: No Sync Folder configured.');
                return;
            }
        }

        const now = new Date();
        const timestamp = now.toLocaleString();
        
        const project = projects.find(p => p.id === selectedProjectId);
        const projectTag = project ? ` [[${project.name}]]` : '';
        
        let prefix = '';
        switch (captureType) {
            case 'task': prefix = '- [ ] '; break;
            case 'bullet': prefix = '- '; break;
            case 'header': prefix = '### '; break;
            case 'text': prefix = ''; break;
        }

        const tagsString = tags.length > 0 ? ' ' + tags.map(t => `#${t}`).join(' ') : '';
        let line = `\n${prefix}${text.trim()}${projectTag}${tagsString}`;
        if (parsedDate) line += ` 📅 ${parsedDate}`;
        if (parsedPriority) line += ` 🔺 ${parsedPriority}`;
        line += ` 📅 ${timestamp}`;
        
        let result;
        const dest = destinations.find(d => d.id === selectedDestId);
        const finalPosition = dest?.position || position;
        
        if (dest && dest.type === 'daily') {
             const dateFormat = localStorage.getItem('focusflow_obsidian_date_format') || 'YYYY-MM-DD';
             const dailyFolder = localStorage.getItem('focusflow_obsidian_daily_folder') || '';
             const year = now.getFullYear().toString();
             const month = String(now.getMonth() + 1).padStart(2, '0');
             const day = String(now.getDate()).padStart(2, '0');
             const dateStr = dateFormat.replace('YYYY', year).replace('MM', month).replace('DD', day);
             const filename = (dailyFolder ? `${dailyFolder}/${dateStr}` : dateStr) + '.md';
             // Use destination header if set, otherwise fallback to global setting
             const header = selectedHeader || dest.header || localStorage.getItem('focusflow_obsidian_header') || '';
             
             if (window.electronAPI?.updateDailyNote) {
                 result = await window.electronAPI.updateDailyNote(currentBackupPath, filename, line, header, finalPosition);
             } else {
                 result = { success: false, error: 'Desktop API missing' };
             }
        } else if (dest) {
             // If header is specified for a file, use updateDailyNote logic which handles headers
             if (window.electronAPI?.updateDailyNote) {
                 result = await window.electronAPI.updateDailyNote(currentBackupPath, dest.path, line, selectedHeader || dest.header || '', finalPosition);
             } else {
                 result = { success: false, error: 'Desktop API missing' };
             }
        }

        if (isMounted.current) {
            if (result?.success) {
                setStatus('Saved!');
                const newHistory = [text.trim(), ...history].slice(0, 20);
                setHistory(newHistory);
                localStorage.setItem('focusflow_capture_history', JSON.stringify(newHistory));
                setText('');
                setTimeout(() => { if (isMounted.current) setStatus(''); }, 2000);
            } else {
                setStatus(`Error: ${result?.error || 'Unknown'}`);
            }
        }
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
                className = "text-purple-400 font-bold";
            } else if (match[3]) { // !Priority
                className = "text-red-400 font-bold";
            } else if (match[4]) { // Date
                className = "text-green-400 font-bold";
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

    const handleSmartEnhance = async (type: string = 'enhance') => {
        if (!text.trim()) return;
        setShowPrompts(false);

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
            }
        } catch (e) {
            console.error(e);
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

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const insertText = (str: string) => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newText = text.substring(0, start) + str + text.substring(end);
        setText(newText);
        setTimeout(() => {
            textareaRef.current!.selectionStart = textareaRef.current!.selectionEnd = start + str.length;
            textareaRef.current!.focus();
        }, 0);
    };

    const formatSelection = (prefix: string, suffix: string = '') => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const selection = text.substring(start, end);
        
        const newText = text.substring(0, start) + prefix + selection + suffix + text.substring(end);
        setText(newText);
        
        setTimeout(() => {
            textareaRef.current!.selectionStart = start + prefix.length;
            textareaRef.current!.selectionEnd = end + prefix.length;
            textareaRef.current!.focus();
        }, 0);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const isImage = file.type.startsWith('image/');
            const path = (file as any).path;
            const link = path ? `file://${path.replace(/ /g, '%20')}` : file.name;
            const markdown = isImage ? `\n![[${file.name}]]` : `\n[[${file.name}]]`;
            insertText(markdown);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
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
            setStatus('');
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
                
                let currentBackupPath = backupPath;
                if (!currentBackupPath) {
                    if (window.electronAPI?.selectBackupFolder) {
                        const path = await window.electronAPI.selectBackupFolder();
                        if (path) {
                            localStorage.setItem('focusflow_backup_path', path);
                            setBackupPath(path);
                            currentBackupPath = path;
                        }
                    }
                }
                
                if (!currentBackupPath) {
                    if (isMounted.current) setStatus('Error: No Sync Folder for audio.');
                    return;
                }

                // Determine subfolder based on selected destination
                const dest = destinations.find(d => d.id === selectedDestId);
                let subfolder = '';
                
                if (dest) {
                    if (dest.type === 'daily') {
                        subfolder = localStorage.getItem('focusflow_obsidian_daily_folder') || '';
                    } else if (dest.type === 'file') {
                        const parts = dest.path.split(/[/\\]/);
                        if (parts.length > 1) {
                            parts.pop(); // remove filename
                            subfolder = parts.join('/');
                        }
                    }
                }
                const filename = `Voice Note ${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                const savePath = subfolder ? `${subfolder}/${filename}` : filename;
                const result = await window.electronAPI?.saveBinaryFile?.(currentBackupPath, savePath, uint8Array);
                
                if (isMounted.current) {
                    if (result?.success) {
                        insertText(`\n![[${filename}]]`);
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

    const moveTemplate = (index: number, direction: 'up' | 'down') => {
        const newTemplates = [...templates];
        if (direction === 'up' && index > 0) {
            [newTemplates[index], newTemplates[index - 1]] = [newTemplates[index - 1], newTemplates[index]];
        } else if (direction === 'down' && index < newTemplates.length - 1) {
            [newTemplates[index], newTemplates[index + 1]] = [newTemplates[index + 1], newTemplates[index]];
        } else {
            return;
        }
        setTemplates(newTemplates);
        localStorage.setItem('focusflow_capture_templates', JSON.stringify(newTemplates));
    };

    const startEditingTemplate = (t: CaptureTemplate) => {
        setEditingTemplateId(t.id);
        setEditTemplateName(t.name);
        setEditTemplateContent(t.content);
    };

    const saveEditedTemplate = () => {
        if (!editingTemplateId || !editTemplateName.trim() || !editTemplateContent.trim()) return;
        const updated = templates.map(t => t.id === editingTemplateId ? { ...t, name: editTemplateName.trim(), content: editTemplateContent } : t);
        setTemplates(updated);
        localStorage.setItem('focusflow_capture_templates', JSON.stringify(updated));
        setEditingTemplateId(null);
    };

    const saveTemplate = () => {
        if (!newTemplateName.trim() || !text.trim()) return;
        const newTemplate: CaptureTemplate = {
            id: Date.now().toString(),
            name: newTemplateName.trim(),
            content: text
        };
        const updated = [...templates, newTemplate];
        setTemplates(updated);
        localStorage.setItem('focusflow_capture_templates', JSON.stringify(updated));
        setNewTemplateName('');
        setIsSavingTemplate(false);
    };

    const deleteTemplate = (id: string) => {
        if (confirm('Delete template?')) {
            const updated = templates.filter(t => t.id !== id);
            setTemplates(updated);
            localStorage.setItem('focusflow_capture_templates', JSON.stringify(updated));
        }
    };

    const applyTemplate = (t: CaptureTemplate) => {
        setText(t.content);
        setShowTemplates(false);
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const clearHistory = () => {
        if (confirm('Clear capture history?')) {
            setHistory([]);
            localStorage.removeItem('focusflow_capture_history');
        }
    };

    const handleSelectVault = async () => {
        const api = (window as any).electronAPI;
        if (!api?.selectBackupFolder) return;
        const path = await api.selectBackupFolder();
        if (path) {
            setBackupPath(path);
            localStorage.setItem('focusflow_backup_path', path);
        }
    };

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300 ${isCyberpunk ? 'bg-[#050505] text-[#00f0ff] font-mono' : 'bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100'}`}>
            {/* Header / Config Area */}
            <div className={`px-6 py-3 border-b flex flex-col gap-3 shrink-0 ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-100 dark:border-gray-800'}`}>
                <div className="flex items-center justify-between">
                    <div className={`flex p-0.5 rounded-lg overflow-x-auto max-w-[240px] no-scrollbar mr-2 ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
                        {destinations.map(dest => (
                            <button 
                                key={dest.id}
                                onClick={() => setSelectedDestId(dest.id)} 
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${selectedDestId === dest.id ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white') : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {dest.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`flex p-0.5 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
                            <button onClick={() => setPosition('append')} className={`px-2 py-1.5 text-[10px] font-bold rounded-md transition-all ${position === 'append' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white') : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>↓ Bot</button>
                            <button onClick={() => setPosition('prepend')} className={`px-2 py-1.5 text-[10px] font-bold rounded-md transition-all ${position === 'prepend' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white') : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>↑ Top</button>
                        </div>
                        <button onClick={() => setIsManagingDestinations(true)} className={`p-1.5 rounded-lg transition-colors ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="Manage Destinations">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        {isCreatingHeader ? (
                            <input
                                type="text"
                                value={selectedHeader}
                                onChange={(e) => setSelectedHeader(e.target.value)}
                                onBlur={() => {
                                    if (selectedHeader && !fileHeaders.includes(selectedHeader)) setFileHeaders(prev => [...prev, selectedHeader]);
                                    setIsCreatingHeader(false);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                placeholder="New Header Name"
                                autoFocus
                                className={`w-full px-2 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`}
                            />
                        ) : (
                            <select 
                                value={selectedHeader}
                                onChange={handleHeaderChange}
                                className={`w-full px-2 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 transition-all cursor-pointer ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500'}`}
                            >
                                <option value="">No Header</option>
                                {fileHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                <option value="__new__">+ New Header</option>
                            </select>
                        )}
                    </div>
                    <select 
                        value={selectedProjectId} 
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className={`text-xs rounded-lg px-2 py-1.5 border-none focus:ring-0 cursor-pointer max-w-[120px] truncate ${isCyberpunk ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300'}`}
                    >
                        <option value="">No Project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Markdown Renderer Helper */}
            {isPreview && (
                <div className="hidden">
                    {/* Hidden logic container if needed, but we use a function */}
                </div>
            )}

            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col relative">
                {isPreview ? (
                    <div 
                        className={`flex-1 w-full p-8 overflow-y-auto text-lg leading-relaxed font-mono ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-800 dark:text-gray-200'}`}
                        dangerouslySetInnerHTML={{ __html: text
                            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                            .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-2 mb-1">$1</h3>')
                            .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-3 mb-2">$1</h2>')
                            .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/~~(.*?)~~/g, '<del>$1</del>')
                            .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded text-sm font-mono">$1</code>')
                            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-500 hover:underline">$1</a>')
                            .replace(/^- \[x\] (.*$)/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" checked disabled class="accent-blue-500" /> <span class="line-through opacity-60">$1</span></div>')
                            .replace(/^- \[ \] (.*$)/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" disabled /> <span>$1</span></div>')
                            .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
                            .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic my-2 opacity-80">$1</blockquote>')
                            .replace(/\n/g, '<br />')
                        }}
                    />
                ) : (
                    <div className="relative flex-1 w-full h-full">
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
                            placeholder={isEnhancing ? "AI is rewriting..." : "Start writing..."}
                            className={`absolute inset-0 w-full h-full p-8 bg-transparent border-none focus:ring-0 resize-none text-lg leading-relaxed font-mono outline-none text-transparent ${isCyberpunk ? 'caret-[#00f0ff] placeholder-[#00f0ff]/30' : 'caret-gray-900 dark:caret-white placeholder-gray-400'} ${isEnhancing ? 'opacity-50 animate-pulse' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        />
                    </div>
                )}
            </div>

            {/* Bottom Toolbar */}
            <div className={`px-6 py-4 border-t space-y-4 ${isCyberpunk ? 'border-[#00f0ff]/20 bg-[#0a0a0a]' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-[#09090b]'}`}>
                
                {/* Tags Input Row */}
                <div className="flex flex-wrap gap-2 items-center">
                     <span className={`text-[10px] font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#00f0ff]/50' : 'text-gray-400'}`}>Tags</span>
                     {tags.map(tag => (
                        <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer hover:opacity-80 ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'}`} onClick={() => removeTag(tag)}>
                            #{tag}
                            <span className="opacity-50">×</span>
                        </span>
                    ))}
                    <input 
                        type="text" 
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="+ tag"
                        className={`text-xs bg-transparent border-none focus:ring-0 p-0 w-24 ${isCyberpunk ? 'text-[#00f0ff] placeholder-[#00f0ff]/30' : 'text-gray-600 dark:text-gray-300 placeholder-gray-400'}`}
                    />
                </div>

                {/* Actions Row */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                        {/* Formatting Tools */}
                        {!isPreview && (
                            <div className={`flex items-center gap-0.5 p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
                                <button onClick={() => formatSelection('**', '**')} className={`p-1.5 rounded-md transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20 text-[#00f0ff]/70 hover:text-[#00f0ff]' : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`} title="Bold">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4zm0 8h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z" /></svg>
                                </button>
                                <button onClick={() => formatSelection('*', '*')} className={`p-1.5 rounded-md transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20 text-[#00f0ff]/70 hover:text-[#00f0ff]' : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`} title="Italic">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                </button>
                                <button onClick={() => formatSelection('~~', '~~')} className={`p-1.5 rounded-md transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20 text-[#00f0ff]/70 hover:text-[#00f0ff]' : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`} title="Strikethrough">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </button>
                                <button onClick={() => formatSelection('`', '`')} className={`p-1.5 rounded-md transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20 text-[#00f0ff]/70 hover:text-[#00f0ff]' : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`} title="Code">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                </button>
                                <button onClick={() => formatSelection('> ')} className={`p-1.5 rounded-md transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20 text-[#00f0ff]/70 hover:text-[#00f0ff]' : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`} title="Quote">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                </button>
                                <button onClick={() => formatSelection('', '')} className={`p-1.5 rounded-md transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/20 text-[#00f0ff]/70 hover:text-[#00f0ff]' : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`} title="Link">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                </button>
                                <div className={`w-px h-4 mx-1 ${isCyberpunk ? 'bg-[#00f0ff]/20' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                            </div>
                        )}
                        
                        <button onClick={() => setIsPreview(!isPreview)} className={`p-2 rounded-lg text-xs transition-colors ${isPreview ? (isCyberpunk ? 'bg-[#00f0ff] text-black' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white') : (isCyberpunk ? 'hover:bg-[#00f0ff]/10 text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400')}`} title={isPreview ? "Edit" : "Preview"}>
                            {isPreview ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                        </button>
                        
                        {!isPreview && (
                            <>
                                <div className="flex items-center gap-1 ml-2">
                                    <button onClick={() => setCaptureType('task')} className={`p-2 rounded-lg transition-colors ${captureType === 'task' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}`} title="Task">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </button>
                                    <button onClick={() => setCaptureType('bullet')} className={`p-2 rounded-lg transition-colors ${captureType === 'bullet' ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400') : (isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}`} title="Bullet">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                    <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/10 text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`} title="Attach File">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                    </button>
                                    <button onClick={toggleRecording} className={`p-2 rounded-lg transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : (isCyberpunk ? 'hover:bg-[#00f0ff]/10 text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400')}`} title="Voice Note">
                                        {isRecording ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
                                    </button>
                                    <div className="relative" ref={menuRef}>
                                        <button 
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => setShowPrompts(!showPrompts)} 
                                            disabled={isEnhancing} 
                                            className={`p-2 rounded-lg transition-all ${isEnhancing ? 'text-purple-500 animate-spin' : (isCyberpunk ? 'hover:bg-[#00f0ff]/10 text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400')}`} 
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
                                    <div className="relative" ref={templatesRef}>
                                        <button 
                                            onClick={() => setShowTemplates(!showTemplates)} 
                                            className={`p-2 rounded-lg transition-colors ${isCyberpunk ? 'hover:bg-[#00f0ff]/10 text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`} 
                                            title="Templates"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                        </button>
                                    {showTemplates && (
                                        <div className={`absolute bottom-full left-0 mb-2 w-64 p-3 rounded-xl shadow-xl border z-50 ${isCyberpunk ? 'bg-black border-[#00f0ff]/50 text-[#00f0ff]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`}>
                                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                                                <h4 className="text-xs font-bold uppercase tracking-wider">Templates</h4>
                                                <button onClick={() => { setIsManagingTemplates(true); setShowTemplates(false); }} className="text-[10px] opacity-60 hover:opacity-100 underline">Manage</button>
                                            </div>
                                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar mb-2">
                                                {templates.length === 0 && <p className="text-[10px] opacity-50 italic">No templates saved.</p>}
                                                {templates.map(t => (
                                                    <div key={t.id} className="flex justify-between items-center group p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer" onClick={() => applyTemplate(t)}>
                                                        <button onClick={() => applyTemplate(t)} className="text-xs font-medium truncate text-left flex-1">{t.name}</button>
                                                        <button onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }} className="text-xs opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 px-1">×</button>
                                                    </div>
                                                ))}
                                            </div>
                                            {isSavingTemplate ? (
                                                <div className="flex gap-1 mt-2">
                                                    <input type="text" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="Name..." className={`flex-1 text-xs px-2 py-1 rounded border focus:outline-none ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600'}`} autoFocus onKeyDown={e => e.key === 'Enter' && saveTemplate()} />
                                                    <button onClick={saveTemplate} className={`text-xs px-2 py-1 rounded font-bold ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-600 text-white'}`}>Save</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setIsSavingTemplate(true)} disabled={!text.trim()} className={`w-full text-xs py-1.5 rounded border border-dashed transition-all ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff]/60 hover:text-[#00f0ff] hover:border-[#00f0ff]' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:text-gray-900 dark:hover:text-white'} ${!text.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>+ Save Current as Template</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                            </>
                        )}
                            </div>

                            <div className="flex items-center gap-3">
                                <span className={`text-xs ${status.startsWith('Error') ? 'text-red-500' : (isCyberpunk ? 'text-[#00f0ff]' : 'text-green-600')}`}>{status}</span>
                                <button 
                                    onClick={handleCapture}
                                    disabled={!text.trim()}
                                    className={`px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 disabled:opacity-50' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}
                                >
                                    <span>Capture</span>
                                    <span className="opacity-60 text-[10px] font-normal">⌘↵</span>
                                </button>
                            </div>
                        </div>
                    </div>

            {/* History Sidebar / Drawer (Optional, maybe collapsible or just at bottom) */}
            {history.length > 0 && (
                <div className={`border-t ${isCyberpunk ? 'border-[#00f0ff]/20 bg-black' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#151516]'}`}>
                    <div className="px-4 py-2 flex justify-between items-center cursor-pointer" onClick={() => {/* toggle history visibility state if implemented */}}>
                        <h3 className={`text-xs font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>Recent Captures</h3>
                        <button onClick={(e) => { e.stopPropagation(); clearHistory(); }} className="text-[10px] text-red-500 hover:text-red-600">Clear</button>
                    </div>
                    <div className="max-h-32 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-1">
                                {history.map((item, i) => (
                            <div key={i} className={`text-xs truncate py-1 ${isCyberpunk ? 'text-[#00f0ff]/70' : 'text-gray-600 dark:text-gray-400'}`}>
                                • {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

            {/* Manage Destinations Modal */}
            {isManagingDestinations && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl ${isCyberpunk ? 'bg-black border-[#00f0ff]' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}>
                        <h3 className={`text-lg font-bold mb-4 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Manage Destinations</h3>
                        
                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                            {Array.isArray(destinations) && destinations.map((dest, index) => (
                                <div key={dest.id} className={`flex justify-between items-center p-2 rounded-lg border ${isCyberpunk ? 'border-[#00f0ff]/20 bg-[#00f0ff]/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'}`}>
                                    <div>
                                        <div className={`text-sm font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>
                                            {dest.name}
                                            {defaultDestId === dest.id && <span className="ml-2 text-[10px] opacity-60">(Default)</span>}
                                        </div>
                                        <div className={`text-xs ${isCyberpunk ? 'text-[#00f0ff]/60' : 'text-gray-500'}`}>
                                            {dest.type === 'daily' ? 'Daily Note' : dest.path}
                                            {dest.header ? ` > ${dest.header}` : ''}
                                            {dest.position ? ` (${dest.position})` : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => moveDestination(index, 'up')} disabled={index === 0} className={`p-1 ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-30`}>↑</button>
                                        <button onClick={() => moveDestination(index, 'down')} disabled={index === destinations.length - 1} className={`p-1 ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-30`}>↓</button>
                                        <button onClick={() => startEditingDestination(dest)} className={`p-1 ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-blue-500'}`} title="Edit">✎</button>
                                        <button onClick={() => handleSetDefault(dest.id)} className={`p-1 ${defaultDestId === dest.id ? 'text-yellow-500' : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-500')}`} title="Set Default">★</button>
                                        <button onClick={() => removeDestination(dest.id)} className="text-red-500 hover:text-red-700 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={`space-y-3 border-t pt-4 ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-200 dark:border-gray-700'}`}>
                            <div className="flex flex-col gap-1 mb-2">
                                <label className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>Obsidian Vault / Sync Folder</label>
                                <div className="flex gap-2">
                                    <input type="text" value={backupPath} readOnly className={`flex-1 px-3 py-2 rounded-lg text-xs border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`} placeholder="Not configured" />
                                    <button onClick={handleSelectVault} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>Change</button>
                                </div>
                            </div>

                            <input 
                                type="text" 
                                placeholder="Name (e.g. Work Log)" 
                                value={newDestName} 
                                onChange={e => setNewDestName(e.target.value)} 
                                className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                            />
                            <div className="flex gap-2">
                                <select 
                                    value={newDestType} 
                                    onChange={e => setNewDestType(e.target.value as any)} 
                                    className={`px-3 py-2 rounded-lg text-sm border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                                >
                                    <option value="file">File</option>
                                    <option value="daily">Daily Note</option>
                                </select>
                                {newDestType === 'file' && (
                                    <div className="flex-1 flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Filename (e.g. Work.md)" 
                                            value={newDestPath} 
                                            onChange={e => setNewDestPath(e.target.value)} 
                                            onBlur={() => fetchHeaders(newDestPath, 'file')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                                        />
                                        <button onClick={handleSelectDestFile} className={`px-3 py-2 rounded-lg border transition-colors ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`} title="Select File">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                                        </button>
                                        <button onClick={handleCreateDestFile} className={`px-3 py-2 rounded-lg border transition-colors ${isCyberpunk ? 'border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`} title={newDestPath ? "Create in Folder" : "Create New File"}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <select value={newDestPosition} onChange={e => setNewDestPosition(e.target.value as any)} className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}>
                                    <option value="append">Append (Bottom)</option>
                                    <option value="prepend">Prepend (Top)</option>
                                </select>
                            </div>
                            <div className="relative">
                                {isCreatingDestHeader ? (
                                    <input
                                        type="text"
                                        value={newDestHeader}
                                        onChange={(e) => setNewDestHeader(e.target.value)}
                                        onBlur={() => {
                                            if (newDestHeader && !availableHeaders.includes(newDestHeader)) setAvailableHeaders(prev => [...prev, newDestHeader]);
                                            setIsCreatingDestHeader(false);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                        placeholder="New Header Name"
                                        autoFocus
                                        className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                                    />
                                ) : (
                                    <select 
                                        value={newDestHeader} 
                                        onChange={handleDestHeaderChange} 
                                        onFocus={() => fetchHeaders(newDestPath, newDestType)}
                                        className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none cursor-pointer ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff] focus:border-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'}`}
                                    >
                                        <option value="">No Header</option>
                                        {availableHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        <option value="__new__">+ New Header</option>
                                    </select>
                                )}
                            </div>
                            <button onClick={saveDestination} className={`w-full py-2 rounded-lg font-bold text-sm ${isCyberpunk ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{editingDestId ? 'Update Destination' : 'Add Destination'}</button>
                            {editingDestId && (
                                <button onClick={cancelEditDestination} className={`w-full py-2 rounded-lg font-bold text-sm ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-500 hover:text-gray-700'}`}>Cancel Edit</button>
                            )}
                        </div>

                        <button onClick={() => setIsManagingDestinations(false)} className={`mt-4 w-full py-2 rounded-lg font-bold text-sm ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Close</button>
                    </div>
                </div>
            )}

            {/* Manage Templates Modal */}
            {isManagingTemplates && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl flex flex-col max-h-[80vh] ${isCyberpunk ? 'bg-black border-[#00f0ff]' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className={`text-lg font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>Manage Templates</h3>
                            <button onClick={() => setIsManagingTemplates(false)} className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/20' : 'text-gray-500'}`}>✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-4">
                            {templates.length === 0 && <p className="text-center text-sm opacity-50 py-4">No templates yet.</p>}
                            {templates.map((t, index) => (
                                <div key={t.id} className={`p-3 rounded-lg border ${isCyberpunk ? 'border-[#00f0ff]/20 bg-[#00f0ff]/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
                                    {editingTemplateId === t.id ? (
                                        <div className="space-y-2">
                                            <input type="text" value={editTemplateName} onChange={e => setEditTemplateName(e.target.value)} className={`w-full px-2 py-1 text-sm rounded border focus:outline-none ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'}`} placeholder="Template Name" />
                                            <textarea value={editTemplateContent} onChange={e => setEditTemplateContent(e.target.value)} className={`w-full px-2 py-1 text-sm rounded border focus:outline-none resize-none h-20 ${isCyberpunk ? 'bg-black border-[#00f0ff]/30 text-[#00f0ff]' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'}`} placeholder="Content..." />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingTemplateId(null)} className="text-xs opacity-60 hover:opacity-100">Cancel</button>
                                                <button onClick={saveEditedTemplate} className={`text-xs font-bold px-3 py-1 rounded ${isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-blue-600 text-white'}`}>Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className={`text-sm font-bold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-900 dark:text-white'}`}>{t.name}</div>
                                                <div className={`text-xs line-clamp-1 opacity-60 ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>{t.content}</div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => moveTemplate(index, 'up')} disabled={index === 0} className={`p-1 ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-30`}>↑</button>
                                                <button onClick={() => moveTemplate(index, 'down')} disabled={index === templates.length - 1} className={`p-1 ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-30`}>↓</button>
                                                <button onClick={() => startEditingTemplate(t)} className={`p-1 ${isCyberpunk ? 'text-[#00f0ff]/60 hover:text-[#00f0ff]' : 'text-gray-400 hover:text-blue-500'}`}>✎</button>
                                                <button onClick={() => deleteTemplate(t.id)} className="p-1 text-red-500 hover:text-red-700">🗑</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {!editingTemplateId && (
                            <div className={`pt-4 border-t ${isCyberpunk ? 'border-[#00f0ff]/20' : 'border-gray-200 dark:border-gray-700'}`}>
                                <button onClick={() => setIsManagingTemplates(false)} className={`w-full py-2 rounded-lg font-bold text-sm ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <PromptManager 
                isOpen={isManagingPrompts} 
                onClose={() => setIsManagingPrompts(false)} 
                isCyberpunk={isCyberpunk} 
                prompts={customPrompts} 
                onUpdatePrompts={updateCustomPrompts} 
            />
        </div>
    );
};
