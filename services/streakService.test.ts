import { describe, it, expect } from '@jest/globals';
import { calculateStreaks } from './streakService';

describe('calculateStreaks', () => {
    // Helper to generate date strings relative to today (YYYY-MM-DD)
    const today = new Date();
    const getDateStr = (daysOffset: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + daysOffset);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    it('returns 0 for empty array', () => {
        expect(calculateStreaks([])).toEqual({ current: 0, longest: 0 });
    });

    it('identifies streak of 1 (today)', () => {
        const dates = [getDateStr(0)];
        expect(calculateStreaks(dates)).toEqual({ current: 1, longest: 1 });
    });

    it('identifies streak of 1 (yesterday)', () => {
        const dates = [getDateStr(-1)];
        expect(calculateStreaks(dates)).toEqual({ current: 1, longest: 1 });
    });

    it('breaks current streak if last log was 2 days ago', () => {
        const dates = [getDateStr(-2)];
        expect(calculateStreaks(dates)).toEqual({ current: 0, longest: 1 });
    });

    it('calculates current streak correctly (consecutive days ending today)', () => {
        const dates = [getDateStr(-2), getDateStr(-1), getDateStr(0)];
        expect(calculateStreaks(dates)).toEqual({ current: 3, longest: 3 });
    });

    it('calculates current streak correctly (consecutive days ending yesterday)', () => {
        const dates = [getDateStr(-3), getDateStr(-2), getDateStr(-1)];
        expect(calculateStreaks(dates)).toEqual({ current: 3, longest: 3 });
    });

    it('calculates longest streak correctly when it is in the past', () => {
        // Current streak: 1 (today)
        // Past streak: 4 days
        const dates = [
            getDateStr(-10), getDateStr(-9), getDateStr(-8), getDateStr(-7), // 4 days
            getDateStr(0) // 1 day
        ];
        expect(calculateStreaks(dates)).toEqual({ current: 1, longest: 4 });
    });

    it('handles duplicate dates', () => {
        const dates = [getDateStr(0), getDateStr(0), getDateStr(-1)];
        expect(calculateStreaks(dates)).toEqual({ current: 2, longest: 2 });
    });

    it('handles unsorted dates', () => {
        const dates = [getDateStr(0), getDateStr(-2), getDateStr(-1)];
        expect(calculateStreaks(dates)).toEqual({ current: 3, longest: 3 });
    });
    
    it('handles gaps in dates', () => {
        const dates = [
            getDateStr(-5), 
            getDateStr(-3), 
            getDateStr(-1), 
            getDateStr(0)
        ];
        // -5 (1), -3 (1), -1 & 0 (2)
        expect(calculateStreaks(dates)).toEqual({ current: 2, longest: 2 });
    });
});