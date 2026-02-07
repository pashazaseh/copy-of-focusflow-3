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

export const fetchTickTickTasks = async (accessToken: string): Promise<Task[]> => {
    // 1. Get all projects (lists) to find the Inbox or specific lists
    // For simplicity, we'll just fetch from the default list or iterate all.
    // TickTick Open API is a bit restrictive. Let's try to get tasks from all projects.
    
    // Actually, the Open API requires getting project list first.
    const projectsRes = await fetch(TICKTICK_API_URL, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!projectsRes.ok) throw new Error('Failed to fetch TickTick projects');
    const projects = await projectsRes.json();
    
    if (!Array.isArray(projects)) return [];

    let allTasks: any[] = [];
    
    // Fetch tasks for all projects in parallel
    const taskPromises = projects.map(proj => 
        fetch(`${TICKTICK_API_URL}/${proj.id}/data`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        .then(res => res.ok ? res.json() : null)
        .catch(err => {
            console.error(`Failed to fetch tasks for project ${proj.id}`, err);
            return null;
        })
    );

    const results = await Promise.all(taskPromises);
    
    results.forEach(data => {
        if (data && Array.isArray(data.tasks)) {
            allTasks = allTasks.concat(data.tasks);
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
        dueDate: t.dueDate ? t.dueDate.split('T')[0] : undefined,
        priority: t.priority === 5 ? 'high' : t.priority === 3 ? 'medium' : 'low',
        createdAt: t.createdTime || new Date().toISOString()
    }));
};