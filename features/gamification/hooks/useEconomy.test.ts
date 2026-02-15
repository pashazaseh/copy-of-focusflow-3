import { renderHook, act } from '@testing-library/react';
import { useEconomy, validateEconomy } from './useEconomy';
import { useLogs } from '../../../AppContext';

// Mock AppContext
jest.mock('../../../AppContext', () => ({
    useLogs: jest.fn(),
}));

describe('Economy System', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        // Default mock for useLogs
        (useLogs as jest.Mock).mockReturnValue({
            logs: [],
            addTransaction: jest.fn(),
        });
    });

    test('validateEconomy resets NaN values in localStorage', () => {
        localStorage.setItem('focusflow_bonus_gems', 'NaN');
        localStorage.setItem('focusflow_spent_gems', 'NaN');
        
        validateEconomy();

        expect(localStorage.getItem('focusflow_bonus_gems')).toBe('0');
        expect(localStorage.getItem('focusflow_spent_gems')).toBe('0');
    });

    test('validateEconomy prevents negative balance by adjusting spentGems', () => {
        // 1 hour = 10 gems. Bonus = 0. Spent = 50.
        // Available = 10. Spent > Available. Should reset spent to 10.
        const logs = [{ date: '2023-01-01', hours: 1, projectId: 'p1' }];
        localStorage.setItem('focusflow_logs', JSON.stringify(logs));
        localStorage.setItem('focusflow_bonus_gems', '0');
        localStorage.setItem('focusflow_spent_gems', '50');

        validateEconomy();

        expect(localStorage.getItem('focusflow_spent_gems')).toBe('10');
    });

    test('useEconomy calculates currentGems correctly', () => {
        // 2.5 hours = 25 gems
        (useLogs as jest.Mock).mockReturnValue({
            logs: [{ date: '2023-01-01', hours: 2.5, projectId: 'p1' }],
            addTransaction: jest.fn(),
        });

        const { result } = renderHook(() => useEconomy());

        expect(result.current.earnedGems).toBe(25);
        expect(result.current.currentGems).toBe(25);
    });

    test('useEconomy handles bonus and spent gems', () => {
        (useLogs as jest.Mock).mockReturnValue({
            logs: [{ date: '2023-01-01', hours: 1, projectId: 'p1' }], // 10 gems
            addTransaction: jest.fn(),
        });

        localStorage.setItem('focusflow_bonus_gems', '5');
        localStorage.setItem('focusflow_spent_gems', '3');

        const { result } = renderHook(() => useEconomy());

        // 10 + 5 - 3 = 12
        expect(result.current.currentGems).toBe(12);
    });
});