import { Task } from '../types';

// Note: In a production app, you would proxy these requests through a backend
// to keep your Client Secret secure and handle CORS.
// For this local/electron app, we might need to rely on the user providing a token
// or use a redirect flow that the Electron main process intercepts.

const TICKTICK_AUTH_URL = 'https://ticktick.com/oauth/authorize';
const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token';
const TICKTICK_API_URL = 'https://api.ticktick.com/open/v1/project';

export const getTickTickAuthUrl = (clientId: string, redirectUri: string) => {
    const scope = 'tasks:read tasks:write';
    return `${TICKTICK_AUTH_URL}?client_id=${clientId}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
};

export const exchangeCodeForToken = async (clientId: string, clientSecret: string, code: string, redirectUri: string) => {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    params.append('scope', 'tasks:read tasks:write');

    const response = await fetch(TICKTICK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) {
        throw new Error('Failed to exchange code for token');
    }

    return response.json();
};

const refreshTickTickToken = async (clientId: string, clientSecret: string, refreshToken: string) => {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('scope', 'tasks:read tasks:write');

    const response = await fetch(TICKTICK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) throw new Error('Failed to refresh token');
    return response.json();
};

export const fetchTickTickTasks = async (accessToken: string): Promise<Task[]> => {
    // 1. Get all projects (lists) to find the Inbox or specific lists
    // For simplicity, we'll just fetch from the default list or iterate all.
    // TickTick Open API is a bit restrictive. Let's try to get tasks from all projects.
    
    // Actually, the Open API requires getting project list first.
    const projectsRes = await fetch(TICKTICK_API_URL, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (projectsRes.status === 401) throw new Error('401 Unauthorized');
    if (!projectsRes.ok) throw new Error('Failed to fetch TickTick projects');
    const projects = await projectsRes.json();
    
    if (!Array.isArray(projects)) return [];

    let allTasks: any[] = [];
    
    // Fetch tasks for all projects in parallel
    // We use async/await inside map to ensure we can catch 401 errors and propagate them
    const taskPromises = projects.map(async (proj) => {
        const res = await fetch(`${TICKTICK_API_URL}/${proj.id}/data`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (res.status === 401) throw new Error('401 Unauthorized');
        
        if (!res.ok) {
            console.warn(`Failed to fetch tasks for project ${proj.id}`);
            return null;
        }
        
        const data = await res.json();
        if (data && Array.isArray(data.tasks)) {
            return data.tasks.map((t: any) => ({ ...t, projectId: proj.id }));
        }
        return [];
    });

    const results = await Promise.all(taskPromises);
    
    results.forEach(tasks => {
        if (Array.isArray(tasks)) {
            allTasks = allTasks.concat(tasks);
        }
    });

    // Map to FocusFlow Task
    return allTasks.map((t: any) => ({
        id: `tt-${t.id}`,
        title: t.title,
        description: t.content,
        projectId: '', // User will need to assign or we default
        isCompleted: t.status === 2, // 0: Normal, 2: Completed
        tickTickId: t.id,
        tickTickProjectId: t.projectId,
        dueDate: t.dueDate ? t.dueDate.split('T')[0] : undefined,
        priority: t.priority === 5 ? 'high' : t.priority === 3 ? 'medium' : 'low',
        createdAt: t.createdTime || new Date().toISOString()
    }));
};

export const syncTickTickTasks = async (
    clientId: string,
    clientSecret: string,
    accessToken: string,
    refreshToken: string
): Promise<{ tasks: Task[], newAccessToken?: string }> => {
    let token = accessToken;
    let newAccessToken: string | undefined;

    try {
        const allTasks = await fetchTickTickTasks(token);
        return { tasks: filterTodayTasks(allTasks), newAccessToken };
    } catch (error: any) {
        // Handle Token Refresh
        if ((error.message === '401 Unauthorized' || error.message.includes('401')) && refreshToken) {
            try {
                console.log("TickTick token expired, refreshing...");
                const tokenData = await refreshTickTickToken(clientId, clientSecret, refreshToken);
                if (tokenData.access_token) {
                    token = tokenData.access_token;
                    newAccessToken = tokenData.access_token;
                    // Retry fetch with new token
                    const allTasks = await fetchTickTickTasks(token);
                    return { tasks: filterTodayTasks(allTasks), newAccessToken };
                }
            } catch (refreshErr) {
                console.error("Failed to refresh token", refreshErr);
                throw new Error("Session expired. Please reconnect TickTick.");
            }
        }
        throw error;
    }
};

const filterTodayTasks = (tasks: Task[]): Task[] => {
    // Use local date for "Today" comparison to avoid timezone issues
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Include tasks due today or overdue
    return tasks.filter(t => !t.isCompleted && t.dueDate && t.dueDate <= today);
};

export const completeTickTickTask = async (taskId: string, projectId: string, accessToken: string) => {
    const url = `https://api.ticktick.com/open/v1/project/${projectId}/task/${taskId}/complete`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error('Failed to complete task on TickTick');
    return response.json();
};

export const createTickTickTask = async (task: Task, accessToken: string) => {
    const url = `https://api.ticktick.com/open/v1/task`;
    
    let priority = 0;
    if (task.priority === 'high') priority = 5;
    else if (task.priority === 'medium') priority = 3;
    else if (task.priority === 'low') priority = 1;

    const body: any = {
        title: task.title,
        content: task.description || '',
        priority: priority,
    };
    
    if (task.dueDate) {
        body.dueDate = task.dueDate.includes('T') ? task.dueDate : `${task.dueDate}T00:00:00+0000`;
        if (!task.dueDate.includes('T')) body.isAllDay = true;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
        if (!response.ok) throw new Error('Failed to create task on TickTick');
    
        return response.json();
    
    };
    
    
    
    export const calculateDailyTickTickProgress = (tasks: Task[]): number => {
    
        const tickTickTasks = tasks.filter(t => t.tickTickId);
    
        if (tickTickTasks.length === 0) return 0;
    
        const completed = tickTickTasks.filter(t => t.isCompleted).length;
    
        return Math.round((completed / tickTickTasks.length) * 100);
    
    };
    
    