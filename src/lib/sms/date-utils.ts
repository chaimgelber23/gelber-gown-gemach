// Date utilities for appointment scheduling

/**
 * Parse natural language date to Date object
 */
export function parseDate(dateStr: string, referenceDate: Date = new Date()): Date | null {
    const lower = dateStr.toLowerCase().trim();
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    // Handle relative dates
    if (lower === 'today') {
        return today;
    }

    if (lower === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }

    // Handle "this wednesday", "next wednesday", etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = lower.match(/(this|next)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|shabbos|motzei shabbos)/i);

    if (dayMatch) {
        let targetDay = dayNames.indexOf(dayMatch[2].toLowerCase());

        // Handle "motzei shabbos" as Saturday
        if (dayMatch[2].toLowerCase().includes('shabbos')) {
            targetDay = 6; // Saturday
        }

        if (targetDay === -1) return null;

        const result = new Date(today);
        const currentDay = result.getDay();
        let daysToAdd = targetDay - currentDay;

        // If "next" or if the day has passed this week, go to next week
        if (dayMatch[1]?.toLowerCase() === 'next' || daysToAdd <= 0) {
            daysToAdd += 7;
        }

        result.setDate(result.getDate() + daysToAdd);
        return result;
    }

    // Try to parse as a standard date (only if it includes a year)
    // This avoids issues with "March 15" being parsed to year 2001 or similar
    if (/\d{4}/.test(dateStr) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(dateStr)) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            // Normalize to midnight local time
            parsed.setHours(12, 0, 0, 0);
            return parsed;
        }
    }

    // Try common formats
    const monthDayMatch = lower.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
    if (monthDayMatch) {
        const months = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = months.findIndex(m => monthDayMatch[1].startsWith(m.slice(0, 3)));
        if (monthIndex !== -1) {
            const day = parseInt(monthDayMatch[2]);
            let result = new Date(today.getFullYear(), monthIndex, day, 12, 0, 0, 0); // Noon to avoid timezone issues

            // If date is in the past, assume next year
            if (result < today) {
                result.setFullYear(result.getFullYear() + 1);
            }

            // If date is more than 8 months in the future, it's probably meant for this year
            // (handles edge case like saying "January" in December)
            const monthsInFuture = (result.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsInFuture > 8) {
                result.setFullYear(result.getFullYear() - 1);
                // But if that puts it in the past, keep the next year
                if (result < today) {
                    result.setFullYear(result.getFullYear() + 1);
                }
            }

            return result;
        }
    }

    return null;
}

/**
 * Parse time string to hours and minutes
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } | null {
    const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (!match) return null;

    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3]?.toLowerCase();

    if (period === 'pm' && hours !== 12) {
        hours += 12;
    } else if (period === 'am' && hours === 12) {
        hours = 0;
    }

    return { hours, minutes };
}

/**
 * Check if a date/time is a valid appointment time
 */
export function isValidAppointmentTime(date: Date, timeStr: string): boolean {
    const dayOfWeek = date.getDay();
    const time = parseTime(timeStr);

    if (!time) return false;

    // Wednesday: 11:30 AM – 12:30 PM
    if (dayOfWeek === 3) {
        const hour = time.hours;
        const minute = time.minutes;

        // Valid times: 11:30, 11:45, 12:00, 12:15
        if (hour === 11 && (minute === 30 || minute === 45)) return true;
        if (hour === 12 && (minute === 0 || minute === 15)) return true;
        return false;
    }

    // Saturday (Motzei Shabbos): 7:30 PM – 9:30 PM
    if (dayOfWeek === 6) {
        const hour = time.hours;
        const minute = time.minutes;

        // Valid times: 7:30, 7:45, 8:00, 8:15, 8:30, 8:45, 9:00, 9:15 (all PM)
        if (hour >= 19 && hour <= 21) {
            if (minute === 0 || minute === 15 || minute === 30 || minute === 45) {
                // 9:30 PM (21:30) is the last slot, so 9:15 (21:15) is the last 15-min slot
                if (hour === 21 && minute > 15) return false;
                return true;
            }
        }
        return false;
    }

    return false; // No appointments on other days
}

/**
 * Get the next available appointment dates
 */
export function getNextAvailableDates(referenceDate: Date = new Date(), count: number = 4): Date[] {
    const dates: Date[] = [];
    const current = new Date(referenceDate);
    current.setHours(0, 0, 0, 0);

    while (dates.length < count) {
        current.setDate(current.getDate() + 1);
        const day = current.getDay();

        // Wednesday (3) or Saturday (6)
        if (day === 3 || day === 6) {
            dates.push(new Date(current));
        }
    }

    return dates;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Format date short for lists
 */
export function formatDateShort(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Get week start (Sunday) and end (Saturday) dates
 */
export function getWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // Go to Sunday

    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Go to Saturday
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

/**
 * Get next week's range
 */
export function getNextWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const thisWeek = getWeekRange(referenceDate);
    const start = new Date(thisWeek.start);
    start.setDate(start.getDate() + 7);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}
