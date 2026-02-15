export const calculateStreaks = (dates: string[]) => {
    const uniqueDates = Array.from(new Set(dates)).sort();
    
    if (uniqueDates.length === 0) return { current: 0, longest: 0 };
    
    const timestamps = uniqueDates.map(d => {
        const [y, m, day] = d.split('-').map(Number);
        return Date.UTC(y, m - 1, day);
    });

    let longest = 1;
    let currentRun = 1;
    for (let i = 1; i < timestamps.length; i++) {
        const diffDays = (timestamps[i] - timestamps[i-1]) / (1000 * 60 * 60 * 24);
        if (Math.round(diffDays) === 1) currentRun++;
        else currentRun = 1;
        if (currentRun > longest) longest = currentRun;
    }
    
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = today - 86400000;
    const lastLogDate = timestamps[timestamps.length - 1];
    
    let current = 0;
    if (lastLogDate === today || lastLogDate === yesterday) {
        current = 1;
        for (let i = timestamps.length - 2; i >= 0; i--) {
            const diffDays = (timestamps[i+1] - timestamps[i]) / (1000 * 60 * 60 * 24);
            if (Math.round(diffDays) === 1) current++;
            else break;
        }
    }
    return { current, longest };
};