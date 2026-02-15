import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimerPanel } from './TimerPanel';
import * as storage from '../services/storageService';
import { useProjects, useTheme, useLogs } from '../AppContext';
import { useEconomy } from '../features/gamification/hooks/useEconomy';

// Mock Context Hooks
jest.mock('../AppContext', () => ({
    useTheme: jest.fn(),
    useLogs: jest.fn(),
    useProjects: jest.fn(),
}));

// Mock Economy Hook
jest.mock('../features/gamification/hooks/useEconomy', () => ({
    useEconomy: jest.fn(),
}));

// Mock Services
jest.mock('../services/storageService', () => ({
    getTasks: jest.fn(),
    saveSession: jest.fn(),
    getTimerSettings: jest.fn(),
    getSessions: jest.fn(),
    saveTimerSettings: jest.fn(),
}));

// Mock Audio (often used in TimerPanel)
jest.mock('../services/audioService', () => ({
    playTone: jest.fn(),
    playAlarm: jest.fn(),
}));

// Mock ControlDock to allow opening the task selector and checking sessionLabel
jest.mock('./Timer/ControlDock', () => ({
    ControlDock: ({ onTaskSelectOpen, sessionLabel, onWagerLock }: any) => (
        <div>
            <button onClick={onTaskSelectOpen}>Open Tasks</button>
            <input readOnly value={sessionLabel} placeholder="Session Label" />
            <button onClick={() => onWagerLock(50)}>Set Wager 50</button>
        </div>
    ),
}));

// Mock other sub-components to avoid rendering issues
jest.mock('./Timer/TimerDisplay', () => ({
    TimerDisplay: () => <div>00:00</div>
}));
jest.mock('./Timer/TimerControls', () => ({
    TimerActionButtons: ({ onToggle }: any) => (
        <div>
            <button onClick={onToggle}>Start Timer</button>
        </div>
    )
}));

describe('TimerPanel Task Selection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.alert = jest.fn();

        // Mock scrollTo for JSDOM
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
            writable: true,
            value: jest.fn(),
        });

        // Setup Default Hook Returns
        (useTheme as jest.Mock).mockReturnValue({ appTheme: 'default' });
        (useLogs as jest.Mock).mockReturnValue({ addLog: jest.fn() });
        (useProjects as jest.Mock).mockReturnValue({
            projects: [
                { id: 'p1', name: 'Backend Work', color: '#333' },
                { id: 'p2', name: 'Frontend', color: '#fff' }
            ],
            activeProject: null,
            updateProjects: jest.fn(),
        });

        // Setup Economy Mock
        (useEconomy as jest.Mock).mockReturnValue({
            currentGems: 100,
            spendGems: jest.fn(),
            addBonus: jest.fn(),
            canAfford: jest.fn().mockReturnValue(true),
        });

        // Setup Storage Mocks
        (storage.getTimerSettings as jest.Mock).mockResolvedValue({
            pomoDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            pomosPerLongBreak: 4,
            autoStartNextPomo: false,
            autoStartBreak: false,
            quickDurations: [],
            shortBreakPresets: []
        });
        (storage.getSessions as jest.Mock).mockResolvedValue([]);
    });

    test('Selecting a task populates session label and updates project ID', async () => {
        // 1. Mock storageService.getTasks to return a dummy list
        const mockTasks = [
            { id: 't1', title: 'Refactor API', projectId: 'p1' },
            { id: 't2', title: 'Write Documentation', projectId: 'p2' }
        ];
        (storage.getTasks as jest.Mock).mockResolvedValue(mockTasks);

        const mockProjects = [
            { id: 'p1', name: 'Backend Work', color: '#333' },
            { id: 'p2', name: 'Frontend', color: '#fff' }
        ];

        // 2. Render TimerPanel
        await act(async () => {
            render(<TimerPanel 
                onSaveSession={jest.fn()}
                projectId="all" // Start with all projects to ensure the task is visible
                projects={mockProjects as any}
                menuBarConfig={{ mode: 'none' }}
                currentStreak={0}
            />);
        });

        // Verify initial project is not set (or is 'All Projects')
        expect(screen.getByText('All Projects')).toBeInTheDocument();

        // Open Task Selector (via mocked ControlDock)
        fireEvent.click(screen.getByText('Open Tasks'));

        // Wait for tasks to load and appear
        await waitFor(() => {
            expect(screen.getByText('Refactor API')).toBeInTheDocument();
        });

        // 3. Simulate selecting 'Refactor API'
        const taskOption = screen.getByText('Refactor API');
        fireEvent.click(taskOption);

        // 4. Verify sessionLabel input populates with 'Refactor API'
        const sessionInput = screen.getByPlaceholderText('Session Label') as HTMLInputElement;
        expect(sessionInput.value).toBe('Refactor API');

        // 5. Verify projectId state updates to match the task's project ID ('p1')
        expect(screen.getByText('Backend Work')).toBeInTheDocument();
        expect(screen.queryByText('Frontend')).not.toBeInTheDocument();
    });

    test('Placing a wager spends gems when timer starts', async () => {
        const { spendGems } = useEconomy();
        
        await act(async () => {
            render(<TimerPanel 
                onSaveSession={jest.fn()}
                projectId="p1"
                projects={[]}
                menuBarConfig={{ mode: 'none' }}
                currentStreak={0}
            />);
        });

        fireEvent.click(screen.getByText('Set Wager 50'));
        fireEvent.click(screen.getByText('Start Timer'));

        expect(spendGems).toHaveBeenCalledWith(50, expect.stringContaining('Wager'));
    });
});