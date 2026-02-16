// features/gamification/services/levelingService.ts

/**
 * This service provides pure logic functions for calculating user levels based on XP.
 * The leveling system is based on a geometric progression, making each level
 * progressively harder to achieve.
 */

// --- CONSTANTS ---

/**
 * The amount of experience points (XP) a user gains for one full hour of focus.
 */
export const XP_PER_HOUR: number = 100;

/**
 * The base amount of XP required to advance from Level 1 to Level 2.
 * This is the foundation of the geometric progression for level requirements.
 */
export const BASE_XP: number = 1000; // 10 hours to reach Level 2

/**
 * The multiplier that determines how much more XP is needed for each subsequent level.
 * A value of 1.5 means each level requires 50% more XP than the last.
 */
export const GROWTH_FACTOR: number = 1.5;


// --- CORE LEVELING FUNCTIONS ---

/**
 * Calculates a user's current level based on their total accumulated XP.
 * This is a simple helper function if you only need the level number.
 *
 * @param totalXP The total experience points accumulated by the user.
 * @returns The user's current level.
 */
export const getLevelFromXP = (totalXP: number): number => {
  let level = 1;
  let xpForCurrentLevel = 0;
  let xpToReachNext = BASE_XP;

  // Keep leveling up as long as the user's XP meets the requirement for the next level
  while (totalXP >= xpForCurrentLevel + xpToReachNext) {
    xpForCurrentLevel += xpToReachNext;
    xpToReachNext *= GROWTH_FACTOR;
    level++;
  }
  return level;
};

/**
 * Provides a detailed breakdown of a user's progress towards the next level.
 * It calculates the current level, the XP boundaries for that level, and the user's progress.
 *
 * @param totalXP The total experience points accumulated by the user.
 * @returns An object containing detailed information about the user's level progression.
 */
export const getNextLevelProgress = (totalXP: number): {
  currentLevel: number;
  nextLevel: number;
  xpCurrentLevel: number;
  xpToNextLevel: number;
  progress: number;
  xpRemaining: number;
} => {
  let currentLevel = 1;
  // xpForCurrentLevelStart is the total XP needed to be AT the start of currentLevel
  let xpForCurrentLevelStart = 0;
  // xpToAdvance is the amount of XP needed to go from currentLevel to nextLevel
  let xpToAdvance = BASE_XP;

  // Loop until we find the level where the user's totalXP is less than the
  // amount required to reach the next level.
  while (totalXP >= xpForCurrentLevelStart + xpToAdvance) {
    xpForCurrentLevelStart += xpToAdvance;
    xpToAdvance *= GROWTH_FACTOR;
    currentLevel++;
  }

  // The total XP required to reach the next level from level 1.
  const xpToNextLevel = xpForCurrentLevelStart + xpToAdvance;

  // How much XP the user has earned *within* their current level bracket.
  const xpEarnedInCurrentLevel = totalXP - xpForCurrentLevelStart;
  
  // Progress percentage towards the next level.
  const progress = Math.floor((xpEarnedInCurrentLevel / xpToAdvance) * 100);

  // How much more XP is needed to level up.
  const xpRemaining = xpToNextLevel - totalXP;

  return {
    currentLevel: currentLevel,
    nextLevel: currentLevel + 1,
    xpCurrentLevel: xpForCurrentLevelStart,
    xpToNextLevel: xpToNextLevel,
    progress: progress,
    xpRemaining: xpRemaining,
  };
};
