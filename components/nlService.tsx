// --- Natural Language Helper ---
export const parseNaturalLanguage = (input: string) => {
    const now = new Date();
    let date: Date | null = null;
    let time: string | null = null;
    let duration: string | null = null;
    let dateLabel = '';

    const lower = input.toLowerCase();

    // 1. Duration (e.g., "for 30m", "2h", "1.5 hours")
    const durRegex = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|m|min|mins)\b/i;
    const durMatch = input.match(durRegex);
    if (durMatch) {
        duration = `${durMatch[1]}${durMatch[2].startsWith('h') ? 'h' : 'm'}`;
    }

    // 2. Relative Dates
    if (/\btoday\b/i.test(input)) {
        date = now;
        dateLabel = 'Today';
    } else if (/\b(tomorrow|tmrw)\b/i.test(input)) {
        date = new Date(now);
        date.setDate(now.getDate() + 1);
        dateLabel = 'Tomorrow';
    } else {
        // Next [Day]
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayRegex = new RegExp(`\\b(?:next\\s+)?(${days.join('|')})(?:day)?\\b`, 'i');
        const dayMatch = input.match(dayRegex);
        if (dayMatch) {
            const targetDay = days.indexOf(dayMatch[1].toLowerCase().substring(0, 3));
            if (targetDay !== -1) {
                date = new Date(now);
                date.setDate(now.getDate() + ((targetDay + 7 - now.getDay()) % 7 || 7)); // Next occurrence
                dateLabel = dayMatch[0]; // e.g. "next friday"
            }
        }
    }

    // 3. Absolute Time (at 5pm, 14:00)
    const timeRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const timeMatch = input.match(timeRegex);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] || '00';
        const meridian = timeMatch[3]?.toLowerCase();

        if (meridian === 'pm' && hours < 12) hours += 12;
        if (meridian === 'am' && hours === 12) hours = 0;
        
        time = `${String(hours).padStart(2, '0')}:${minutes}`;
        
        // If user typed a time but no date, assume today (or tomorrow if time passed)
        if (!date) {
            date = new Date(now);
            if (date.getHours() > hours || (date.getHours() === hours && date.getMinutes() >= parseInt(minutes))) {
                // If time has passed today, assume tomorrow? Optional logic.
                // date.setDate(date.getDate() + 1); 
            }
            dateLabel = 'Today';
        }
    }

    // 4. Relative Time (in 5 mins)
    const relativeTimeRegex = /\bin\s+(\d+)\s*(m|min|mins|h|hr|hrs)\b/i;
    const relMatch = input.match(relativeTimeRegex);
    if (relMatch) {
        const val = parseInt(relMatch[1]);
        const unit = relMatch[2];
        const target = new Date(now.getTime() + val * (unit.startsWith('h') ? 3600000 : 60000));
        date = target;
        time = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
        dateLabel = `In ${val}${unit.charAt(0)}`;
    }

    return { date, time, duration, dateLabel };
};
