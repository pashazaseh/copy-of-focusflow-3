import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from './Sidebar';
import { useEconomy } from '../features/gamification/hooks/useEconomy';
import { useGamificationData } from '../features/gamification/hooks/useGamificationData';
import { generateDailyQuests } from '../features/gamification/services/questService';

// Mocks
jest.mock('../AppContext', () => ({
    useTimerContext: () => ({ setPendingQuickTimer: jest.fn() }),
    useCountdowns: () => ({ countdowns: [] }),
    useTheme: () => ({ appTheme: 'default' }),
}));

jest.mock('../features/gamification/hooks/useEconomy', () => ({
    useEconomy: jest.fn(),
}));

jest.mock('../features/gamification/hooks/useGamificationData', () => ({
    useGamificationData: jest.fn(),
}));

jest.mock('../features/gamification/services/questService', () => ({
    generateDailyQuests: jest.fn(),
    calculateQuestProgress: jest.fn((quests) => quests),
}));

jest.mock('../services/audioService', () => ({
    playWin: jest.fn(),
}));

describe('Sidebar Quest Streak', () => {
    const mockAddBonus = jest.fn();
    
    beforeEach(() => {
        jest.clearAllMocks();
        (useEconomy as jest.Mock).mockReturnValue({
            currentGems: 100,
            addBonus: mockAddBonus,
        });
        (useGamificationData as jest.Mock).mockReturnValue({
            profile: { level: 1 }
        });
        
        // Mock localStorage
        const store: Record<string, string> = {};
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => { store[key] = value; },
                removeItem: (key: string) => { delete store[key]; },
            },
            writable: true
        });
    });

    const getLocalDateStr = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    const mockSidebarConfig = {
        showWeeklyGoalWidget: true,
        showDailyGoalWidget: true,
        showMonthlyGoalWidget: true,
        showTimerWidget: true,
        showCountdownWidget: true,
        showQuestsWidget: true,
        questsWidgetSize: 'standard' as const,
        widgetOrder: []
    };

    test('Increments streak when all quests are completed', async () => {
        const today = getLocalDateStr(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateStr(yesterday);

        // Setup: Streak of 1 from yesterday
        localStorage.setItem('focusflow_quest_streak', '1');
        localStorage.setItem('focusflow_last_quest_completion_date', yesterdayStr);

        // Mock Quests: 1 quest, ready to claim
        const mockQuest = {
            id: 'q1',
            title: 'Test Quest',
            target: 1,
            current: 1,
            reward: 50,
            isClaimed: false
        };
        (generateDailyQuests as jest.Mock).mockReturnValue([mockQuest]);

        await act(async () => {
            render(<Sidebar 
                currentView={'dashboard' as any} 
                onChangeView={jest.fn()} 
                weeklyGoal={20} 
                currentWeeklyHours={0} 
                currentDailyHours={0} 
                currentMonthlyHours={0} 
                projects={[]} 
                currentProjectId="" 
                onSelectProject={jest.fn()} 
                onCreateProject={jest.fn()} 
                onDeleteProject={jest.fn()} 
                navConfig={[]} 
                onManageProjects={jest.fn()} 
                sidebarConfig={mockSidebarConfig} 
                appTheme="default" 
                goals={{ daily: 4, weekly: 20, monthly: 80, yearly: 1000 }} 
            />);
        });

        // Click Claim
        const claimBtn = screen.getByText('Claim');
        fireEvent.click(claimBtn);

        // Verify Streak Incremented
        expect(localStorage.getItem('focusflow_quest_streak')).toBe('2');
        expect(localStorage.getItem('focusflow_last_quest_completion_date')).toBe(today);
    });

    test('Resets streak if missed a day', async () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = getLocalDateStr(twoDaysAgo);

        // Setup: Streak from 2 days ago (missed yesterday)
        localStorage.setItem('focusflow_quest_streak', '5');
        localStorage.setItem('focusflow_last_quest_completion_date', twoDaysAgoStr);

        const mockQuest = {
            id: 'q1',
            title: 'Test Quest',
            target: 1,
            current: 1,
            reward: 50,
            isClaimed: false
        };
        (generateDailyQuests as jest.Mock).mockReturnValue([mockQuest]);

        await act(async () => {
            render(<Sidebar 
                currentView={'dashboard' as any} 
                onChangeView={jest.fn()} 
                weeklyGoal={20} 
                currentWeeklyHours={0} 
                currentDailyHours={0} 
                currentMonthlyHours={0} 
                projects={[]} 
                currentProjectId="" 
                onSelectProject={jest.fn()} 
                onCreateProject={jest.fn()} 
                onDeleteProject={jest.fn()} 
                navConfig={[]} 
                onManageProjects={jest.fn()} 
                sidebarConfig={mockSidebarConfig} 
                appTheme="default" 
                goals={{ daily: 4, weekly: 20, monthly: 80, yearly: 1000 }} 
            />);
        });

        // Click Claim
        const claimBtn = screen.getByText('Claim');
        fireEvent.click(claimBtn);

        // Verify Streak Reset to 1
        expect(localStorage.getItem('focusflow_quest_streak')).toBe('1');
    });
});