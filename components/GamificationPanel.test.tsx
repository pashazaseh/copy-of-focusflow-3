import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GamificationPanel } from './GamificationPanel';
import { useTheme, useLogs, useProjects } from '../AppContext';
import * as storage from '../services/storageService';
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
    saveCustomShopItem: jest.fn(),
    deleteCustomShopItem: jest.fn(),
    addTransaction: jest.fn(),
    getLogs: jest.fn().mockResolvedValue([]),
    getCustomShopItems: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/audioService', () => ({
    playTone: jest.fn(),
    playWin: jest.fn(),
    playSpinTick: jest.fn(),
}));

jest.mock('../features/gamification/services/achievementService', () => ({
    getUnlockedAchievements: jest.fn().mockReturnValue([]),
    getAchievementReward: jest.fn().mockReturnValue({ gems: 0, rarity: 'common' }),
    RANKS: [],
}));

jest.mock('../features/gamification/services/questService', () => ({
    getDailyQuests: jest.fn().mockReturnValue([]),
}));

jest.mock('../features/gamification/services/projectAchievementsService', () => ({
    PROJECT_TROPHIES: [],
}));

jest.mock('../features/gamification/hooks/useGamificationData', () => ({
    useGamificationData: jest.fn().mockReturnValue({ profile: { level: 10 } }),
}));

// Mock GemCounter to avoid framer-motion issues
jest.mock('./GemCounter', () => ({
    GemCounter: ({ value }: any) => <span>{value}</span>
}));

describe('GamificationPanel Purchase Flow', () => {
    const mockAddTransaction = jest.fn();
    const mockUpdateProjects = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup Hook Returns
        (useTheme as jest.Mock).mockReturnValue({ appTheme: 'default' });
        (useLogs as jest.Mock).mockReturnValue({
            logs: [],
            transactions: [],
            addTransaction: mockAddTransaction,
        });
        (useProjects as jest.Mock).mockReturnValue({
            updateProjects: mockUpdateProjects,
        });

        // Mock Economy with stateful balance for testing
        let testBalance = 500;
        (useEconomy as jest.Mock).mockImplementation(() => ({
            currentGems: testBalance,
            spendGems: jest.fn((amount) => {
                if (testBalance >= amount) {
                    testBalance -= amount;
                    return true;
                }
                return false;
            }),
            addBonus: jest.fn((amount) => { testBalance += amount; }),
        }));

        // Mock getCustomShopItems to return empty array by default
        (storage.getCustomShopItems as jest.Mock).mockResolvedValue([]);

        // Mock storage to return the item we "create"
        (storage.saveCustomShopItem as jest.Mock).mockImplementation(async (item) => {
            return [item];
        });

        // Mock LocalStorage to simulate initial 500 Gems
        const localStorageMock = (function() {
            let store: Record<string, string> = {
                'focusflow_inventory': '{}'
            };
            return {
                getItem: jest.fn((key) => store[key] || null),
                setItem: jest.fn((key, value) => {
                    store[key] = value.toString();
                }),
                clear: jest.fn(() => { store = {}; }),
                removeItem: jest.fn((key) => { delete store[key]; })
            };
        })();
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });
        
        // Mock window.confirm to always say yes
        window.confirm = jest.fn(() => true);
        window.alert = jest.fn();
    });

    test('User with 500 Gems buys a 300 Gem item, balance updates to 200 and item is owned', async () => {
        await act(async () => {
            render(
                <GamificationPanel
                    activeProject={null}
                    userState={{ totalFocusTime: 0 }}
                    isCyberpunk={false}
                    projects={[]}
                    onSelectProject={jest.fn()}
                    freezeDates={[]}
                    onRepairStreak={jest.fn()}
                />
            );
        });

        // 1. Verify Initial Balance (500)
        expect(screen.getByText('500')).toBeInTheDocument();

        // 2. Create a Custom Item for 300 Gems
        const addCustomBtn = screen.getByText('+ Custom Item');
        fireEvent.click(addCustomBtn);

        const nameInput = screen.getByPlaceholderText('e.g. Pizza Night');
        const costInput = screen.getByDisplayValue('100'); // Default cost
        
        fireEvent.change(nameInput, { target: { value: 'Epic Loot' } });
        fireEvent.change(costInput, { target: { value: '300' } });

        const createBtn = screen.getByText('Create');
        await act(async () => {
            fireEvent.click(createBtn);
        });

        // 3. Buy the item
        const itemTitle = screen.getByText('Epic Loot');
        const itemCard = itemTitle.closest('.group');
        const purchaseBtn = within(itemCard as HTMLElement).getByText('Purchase');
        
        await act(async () => {
            fireEvent.click(purchaseBtn);
        });

        // 4. Verify Updates
        await waitFor(() => {
            expect(screen.getByText('200')).toBeInTheDocument();
        });
        expect(screen.getByText('Owned: 1')).toBeInTheDocument();
    });

    test('WeeklyPunchCard renders ice icon for frozen dates', async () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

        const mockProject = {
            id: 'p1',
            name: 'Test Project',
            theme: 'green',
            createdAt: '',
            streak: { current: 5, best: 10, lastActiveDate: '' },
            xp: 100,
            unlockedTrophies: []
        };

        await act(async () => {
            render(
                <GamificationPanel
                    activeProject={mockProject as any}
                    userState={{ totalFocusTime: 10 }}
                    isCyberpunk={false}
                    projects={[mockProject as any]}
                    onSelectProject={jest.fn()}
                    freezeDates={[yesterdayStr]}
                    onRepairStreak={jest.fn()}
                />
            );
        });

        // Switch to 'earn' tab
        const earnTab = screen.getByText('earn');
        fireEvent.click(earnTab);

        // Check for Ice Icon
        expect(screen.getByText('🧊')).toBeInTheDocument();
    });

    test('Buying and using Streak Repair fixes the most recent missed day', async () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

        const mockOnRepairStreak = jest.fn();

        // Mock logs to have no entry for yesterday
        (useLogs as jest.Mock).mockReturnValue({
            logs: [], 
            transactions: [],
            addTransaction: jest.fn(),
        });

        // Mock Economy to allow purchase
        (useEconomy as jest.Mock).mockReturnValue({
            currentGems: 1000,
            spendGems: jest.fn().mockReturnValue(true),
            addBonus: jest.fn(),
        });

        await act(async () => {
            render(
                <GamificationPanel
                    activeProject={null}
                    userState={{ totalFocusTime: 0 }}
                    isCyberpunk={false}
                    projects={[]}
                    onSelectProject={jest.fn()}
                    freezeDates={[]}
                    onRepairStreak={mockOnRepairStreak}
                />
            );
        });

        // 1. Buy Streak Repair
        const shopItems = screen.getAllByText('Streak Repair');
        // The item in the shop grid (likely the last one if inventory is empty initially)
        const shopItemCard = shopItems[shopItems.length - 1].closest('.group');
        const buyBtn = within(shopItemCard as HTMLElement).getByText('Purchase');

        await act(async () => {
            fireEvent.click(buyBtn);
        });

        // 2. Use Streak Repair from Inventory
        const useBtn = screen.getByText('Use');
        await act(async () => {
            fireEvent.click(useBtn);
        });

        // 3. Verify onRepairStreak was called with yesterdayStr
        expect(mockOnRepairStreak).toHaveBeenCalledWith(yesterdayStr);
    });

    test('Displays Level 1 for new user (0 hours)', async () => {
        await act(async () => {
            render(
                <GamificationPanel
                    activeProject={null}
                    userState={{ totalFocusTime: 0 }}
                    isCyberpunk={false}
                    projects={[]}
                    onSelectProject={jest.fn()}
                    freezeDates={[]}
                    onRepairStreak={jest.fn()}
                />
            );
        });

        fireEvent.click(screen.getByText('earn'));
        expect(screen.getByText('Level 1')).toBeInTheDocument();
    });

    test('Displays correct level based on total focus time', async () => {
        // 100 XP per hour.
        // With Base 100, Exp 1.6: Level 10 requires ~3360 XP (33.6 hours).
        // We set hours to 35 (3500 XP) to ensure we are firmly in Level 10.
        
        await act(async () => {
            render(
                <GamificationPanel
                    activeProject={null}
                    userState={{ totalFocusTime: 35 }}
                    isCyberpunk={false}
                    projects={[]}
                    onSelectProject={jest.fn()}
                    freezeDates={[]}
                    onRepairStreak={jest.fn()}
                />
            );
        });

        // Switch to 'earn' tab where Global Vault is shown
        fireEvent.click(screen.getByText('earn'));

        expect(screen.getByText('Level 10')).toBeInTheDocument();
    });

    test('Shows Level Up modal when level increases', async () => {
        // Setup initial state in localStorage to simulate being at Level 1
        localStorage.setItem('focusflow_last_known_level', '1');

        // Render with enough XP for Level 2 (100 XP = 1 hour)
        await act(async () => {
            render(
                <GamificationPanel
                    activeProject={null}
                    userState={{ totalFocusTime: 1 }} // 1 hour = 100 XP = Level 2
                    isCyberpunk={false}
                    projects={[]}
                    onSelectProject={jest.fn()}
                    freezeDates={[]}
                    onRepairStreak={jest.fn()}
                />
            );
        });

        // Verify Modal Appears
        expect(screen.getByText('LEVEL UP!')).toBeInTheDocument();
        expect(screen.getByText('You reached Level 2')).toBeInTheDocument();
        
        // Verify localStorage updated
        expect(localStorage.getItem('focusflow_last_known_level')).toBe('2');
    });
});