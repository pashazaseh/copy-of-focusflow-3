import { Project } from '../../../types';

// Helper to match App.tsx local date format (YYYY-MM-DD)
const getLocalDate = (date: Date = new Date()) => {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

// Helper
const isYesterday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterdayStr = getLocalDate(d);
    return dateStr === yesterdayStr;
};

// Project Trophies Definition
export const PROJECT_TROPHIES = [
    { id: 'streak_3', icon: '🔥', name: 'Momentum', description: '3 Day Streak', condition: (p: Project) => (p.streak?.current || 0) >= 3 },
    { id: 'streak_7', icon: '🚀', name: 'Dedicated', description: '7 Day Streak', condition: (p: Project) => (p.streak?.current || 0) >= 7 },
    { id: 'hours_10', icon: '⚔️', name: 'Novice', description: '10 Hours', condition: (p: Project) => (p.totalHours || 0) >= 10 },
    { id: 'hours_50', icon: '🛡️', name: 'Expert', description: '50 Hours', condition: (p: Project) => (p.totalHours || 0) >= 50 },
];

export const handleSessionComplete = (
    currentProject: Project, 
    minutes: number
) => {
    const today = getLocalDate();

    // 2. Update Project Specific Streak
    let newStreak = currentProject.streak?.current || 0;
    const lastActive = currentProject.streak?.lastActiveDate || '';

    if (lastActive === today) {
        // Already worked on this today, do nothing
    } else if (isYesterday(lastActive)) {
        // Continued streak
        newStreak += 1;
    } else {
        // Broken streak (for this project only!)
        newStreak = 1;
    }
    
    const newTotalHours = (currentProject.totalHours || 0) + (minutes / 60);

    // 3. Check Project Specific Trophies
    const unlockedTrophies = new Set(currentProject.unlockedTrophies || []);
    // Create a temporary object to test conditions against the *new* stats
    const tempProjectState = { 
        ...currentProject, 
        streak: { current: newStreak, best: 0, lastActiveDate: today },
        totalHours: newTotalHours
    };

    PROJECT_TROPHIES.forEach(trophy => {
        if (!unlockedTrophies.has(trophy.id) && trophy.condition(tempProjectState)) {
            unlockedTrophies.add(trophy.id);
        }
    });

    return {
        updatedProject: {
            ...currentProject,
            streak: { current: newStreak, best: Math.max(newStreak, currentProject.streak?.best || 0), lastActiveDate: today },
            totalHours: newTotalHours,
            unlockedTrophies: Array.from(unlockedTrophies)
        }
    };
};
