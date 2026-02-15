import { syncTickTickTasks, completeTickTickTask, createTickTickTask } from './tickTickService';
import * as storage from './storageService';

interface SyncRequest {
    id: string;
    type: 'TICKTICK_SYNC' | 'TICKTICK_COMPLETE' | 'TICKTICK_CREATE';
    timestamp: number;
    payload?: any;
}

const QUEUE_KEY = 'focusflow_sync_queue';

export const getQueue = (): SyncRequest[] => {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch { return []; }
};

export const addToQueue = (type: 'TICKTICK_SYNC' | 'TICKTICK_COMPLETE' | 'TICKTICK_CREATE', payload?: any) => {
    const queue = getQueue();
    // Avoid duplicates for sync requests (debounce)
    if (type === 'TICKTICK_SYNC' && queue.some(r => r.type === type)) return;
    
    if (type === 'TICKTICK_COMPLETE' && payload?.taskId) {
        if (queue.some(r => r.type === type && r.payload?.taskId === payload.taskId)) return;
    }

    if (type === 'TICKTICK_CREATE' && payload?.localTaskId) {
        if (queue.some(r => r.type === type && r.payload?.localTaskId === payload.localTaskId)) return;
    }
    
    queue.push({
        id: Date.now().toString(),
        type,
        timestamp: Date.now(),
        payload
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const performTickTickSync = async () => {
    const clientId = localStorage.getItem('ticktick_client_id');
    const clientSecret = localStorage.getItem('ticktick_client_secret');
    const accessToken = localStorage.getItem('ticktick_access_token');
    const refreshToken = localStorage.getItem('ticktick_refresh_token');

    if (!clientId || !clientSecret || !accessToken) return;

    const { tasks, newAccessToken } = await syncTickTickTasks(clientId, clientSecret, accessToken, refreshToken || '');
    
    if (newAccessToken) {
        localStorage.setItem('ticktick_access_token', newAccessToken);
    }

    const projects = await storage.getProjects();
    const defaultProjectId = projects[0]?.id;
    
    const { count } = await storage.mergeTasks(tasks.map(t => ({
        ...t,
        projectId: defaultProjectId
    })));
    
    if (count > 0) {
        window.dispatchEvent(new Event('focusflow-task-update'));
    }
};

const performTickTickComplete = async (taskId: string, projectId: string) => {
    const accessToken = localStorage.getItem('ticktick_access_token');
    if (!accessToken) return;
    await completeTickTickTask(taskId, projectId, accessToken);
};

const performTickTickCreate = async (localTaskId: string, taskData: any) => {
    const accessToken = localStorage.getItem('ticktick_access_token');
    if (!accessToken) return;
    
    const ttTask = await createTickTickTask(taskData, accessToken);
    
    const tasks = await storage.getTasks();
    const localTask = tasks.find(t => t.id === localTaskId);
    if (localTask) {
        await storage.saveTask({
            ...localTask,
            tickTickId: ttTask.id,
            tickTickProjectId: ttTask.projectId
        });
        window.dispatchEvent(new Event('focusflow-task-update'));
    }
};

export const processQueue = async () => {
    if (!navigator.onLine) return;
    
    const queue = getQueue();
    if (queue.length === 0) return;

    const req = queue[0];
    
    try {
        if (req.type === 'TICKTICK_SYNC') {
            console.log("Processing queued TickTick sync...");
            await performTickTickSync();
        } else if (req.type === 'TICKTICK_COMPLETE' && req.payload) {
            console.log("Processing queued TickTick completion...");
            await performTickTickComplete(req.payload.taskId, req.payload.projectId);
        } else if (req.type === 'TICKTICK_CREATE' && req.payload) {
            console.log("Processing queued TickTick creation...");
            await performTickTickCreate(req.payload.localTaskId, req.payload.task);
        }
        
        // Remove from queue on success
        const newQueue = getQueue().filter(r => r.id !== req.id);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
        
        if (newQueue.length > 0) processQueue();
        
    } catch (e) {
        console.error("Queue processing failed", e);
    }
};