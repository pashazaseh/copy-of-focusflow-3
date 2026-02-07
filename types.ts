// types.ts

export interface Project {
  id: string;
  name: string;
  theme: HeatmapTheme;
  createdAt: string;
  isArchived?: boolean;
  sortOrder?: number;
  weeklyGoal?: number; // Overrides global weekly goal if set
  goals?: UserGoals; // Project specific goals
  goalHistory?: { date: string; goals: UserGoals }[]; // Project specific goal history
}

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  title: string;
  projectId?: string; // Links to your existing Projects
  isCompleted: boolean;
  tickTickId?: string; // Optional: For future syncing
  dueDate?: string;
  estimatedPomodoros?: number;
  priority?: 'low' | 'medium' | 'high';
  description?: string;
  createdAt?: string;
  subtasks?: Subtask[];
}

export interface StudyLog {
  date: string; // ISO string YYYY-MM-DD
  hours: number;
  notes?: string;
  projectId: string; // New field to link log to a project
}

export interface DayStats {
  date: Date;
  dateStr: string;
  value: number;
  notes?: string;
}

export interface GeminiAnalysis {
  summary: string;
  strengths: string[];
  improvements: string[];
  tip: string;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  STATISTICS = 'STATISTICS',
  INSIGHTS = 'INSIGHTS',
  GOALS = 'GOALS',
  TIMER = 'TIMER',
  COUNTDOWN = 'COUNTDOWN',
  CALENDAR = 'CALENDAR',
  SETTINGS = 'SETTINGS',
  GAMIFICATION = 'GAMIFICATION',
  TASKS = 'TASKS',
  PROFILE = 'PROFILE' // New View
}

export type AppTheme = 'default' | 'cyberpunk';

export type HeatmapTheme = 'green' | 'blue' | 'orange' | 'purple';

export interface UserGoals {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
}

export type CountdownType = 'countdown' | 'anniversary' | 'birthday' | 'holiday';

export interface CountdownGroup {
    id: string;
    name: string;
    projectId?: string; // Optional link to a project
    color?: string;
}

export interface CountdownItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: CountdownType; // Visual Icon style
  groupId?: string; // Organizational Group
  projectId?: string; // Specific project link
  color: string;
  isArchived?: boolean;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface TimerSettings {
  pomoDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  pomosPerLongBreak: number;
  autoStartNextPomo: boolean;
  autoStartBreak: boolean;
  quickDurations: number[]; // Custom presets for quick start (Focus)
  shortBreakPresets: number[]; // Custom presets for quick start (Short Break)
}

export interface SessionRecord {
  id: string;
  startTime: string; // ISO
  endTime: string; // ISO
  duration: number; // seconds
  type: 'POMO' | 'STOPWATCH';
  label?: string;
  projectId?: string;
  taskId?: string; // <--- Added this to link sessions to tasks
}

// Menu Bar Configuration
export type MenuBarMode = 'none' | 'today' | 'remaining' | 'streak' | 'xp' | 'motivation' | 'timer' | 'countdown_closest' | 'countdown_custom';

export interface MenuBarConfig {
    mode: MenuBarMode;
    customCountdownId?: string;
}

export type WidgetSize = 'compact' | 'standard' | 'spacious';

export interface SidebarConfig {
    showWeeklyGoalWidget: boolean;
    showDailyGoalWidget: boolean;
    showMonthlyGoalWidget: boolean;
    showTimerWidget: boolean;
    showCountdownWidget: boolean;
    showQuestsWidget: boolean;
    questsWidgetSize: WidgetSize;
    widgetOrder: string[];
}

export type SettingsTab = 'general' | 'timer' | 'projects' | 'integrations' | 'data';

// Calendar Types
export interface CustomEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  type: 'meeting' | 'deadline' | 'reminder' | 'personal';
  description?: string;
  location?: string;
  color?: string; // Hex code or tailwind color name
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  calendar?: string; // 'Personal', 'Work', 'Family', etc.
  reminderMinutes?: number; // Minutes before event
}

export interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
  htmlLink: string;
  calendarSummary?: string;
  calendarColor?: string;
  calendarId?: string;
}

// Gamification Types
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (logs: StudyLog[], totalHours: number, streak: number) => boolean;
  isUnlocked?: boolean; // Runtime flag
}

export interface UserRank {
  title: string;
  minHours: number;
  color: string;
}

export interface Transaction {
    id: string;
    date: string;
    type: 'EARN' | 'SPEND' | 'UNLOCK' | 'WIN';
    amount: number;
    description: string;
    relatedId?: string;
}

export interface ShopItem {
    id: string;
    name: string;
    icon: string;
    cost: number;
    desc: string;
    type: string;
    category: string;
    expiryDate?: string;
    isCustom?: boolean;
}

export interface CustomPrompt {
    id: string;
    label: string;
    prompt: string;
}

export interface CaptureDestination {
    id: string;
    name: string;
    path: string;
    header?: string;
    type: 'file' | 'daily';
    position?: 'append' | 'prepend';
}