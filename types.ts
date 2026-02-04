
export interface Project {
  id: string;
  name: string;
  theme: HeatmapTheme;
  createdAt: string;
  isArchived?: boolean;
  sortOrder?: number;
  weeklyGoal?: number; // Overrides global weekly goal if set
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
  PROFILE = 'PROFILE' // New View
}

export type HeatmapTheme = 'green' | 'blue' | 'orange' | 'purple';

export interface UserGoals {
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
}

// Menu Bar Configuration
export type MenuBarMode = 'none' | 'today' | 'remaining' | 'streak' | 'xp' | 'motivation' | 'timer' | 'countdown_closest' | 'countdown_custom';

export interface MenuBarConfig {
    mode: MenuBarMode;
    customCountdownId?: string;
}

export interface SidebarConfig {
    showWeeklyGoalWidget: boolean;
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

// Electron Interface
declare global {
  interface Window {
    electronAPI?: {
      close: () => void;
      minimize: () => void;
      maximize: () => void;
      updateTrayTitle: (title: string) => void;
      startQuickTimer: (minutes: number) => void;
      onQuickTimerTriggered: (callback: (minutes: number) => void) => void;
      cancelQuickTimer: () => void;
    };
  }
}