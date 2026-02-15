export const XP_PER_HOUR = 100;
const BASE_XP = 100;
const EXPONENT = 1.6;

// Formula: Cumulative XP for Level L = Base * (L-1)^Exponent
// Inverse: Level = floor((XP / Base)^(1/Exponent)) + 1

export const getLevelFromXP = (totalXP: number): number => {
    if (totalXP < 0) return 1;
    return Math.floor(Math.pow(totalXP / BASE_XP, 1 / EXPONENT)) + 1;
};

export const getXPForLevel = (level: number): number => {
    if (level <= 1) return 0;
    return Math.floor(BASE_XP * Math.pow(level - 1, EXPONENT));
};

export const getNextLevelProgress = (totalXP: number) => {
    const currentLevel = getLevelFromXP(totalXP);
    const nextLevel = currentLevel + 1;
    
    const xpStartOfLevel = getXPForLevel(currentLevel);
    const xpForNextLevel = getXPForLevel(nextLevel);
    
    const progress = Math.min(100, Math.max(0, ((totalXP - xpStartOfLevel) / (xpForNextLevel - xpStartOfLevel)) * 100));
    
    return {
        currentLevel,
        nextLevel,
        progress,
        xpForNextLevel,
        xpRemaining: xpForNextLevel - totalXP
    };
};