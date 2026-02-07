import { Task } from '../types';

const STORAGE_KEY = 'focusflow_tasks';

export const getTasks = async (): Promise<Task[]> => {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Failed to load tasks", e);
        return [];
    }
};

export const saveTasks = async (tasks: Task[]): Promise<Task[]> => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return tasks;
};

export const addTask = async (task: Task): Promise<Task[]> => {
    const tasks = await getTasks();
    const newTasks = [task, ...tasks];
    return saveTasks(newTasks);
};

export const updateTask = async (updatedTask: Task): Promise<Task[]> => {
    const tasks = await getTasks();
    const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    return saveTasks(newTasks);
};

export const deleteTask = async (taskId: string): Promise<Task[]> => {
    const tasks = await getTasks();
    const newTasks = tasks.filter(t => t.id !== taskId);
    return saveTasks(newTasks);
};