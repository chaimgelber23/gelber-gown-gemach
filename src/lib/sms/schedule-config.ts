// Schedule Configuration - Manage available slots and blocked dates
import { Firestore, Timestamp } from 'firebase-admin/firestore';

export interface ScheduleConfig {
    wednesday: {
        enabled: boolean;
        slots: string[];
    };
    saturday: {
        enabled: boolean;
        slots: string[];
    };
    updatedAt: Timestamp;
}

export interface BlockedDate {
    id: string;
    date: Timestamp;
    dateStr: string; // YYYY-MM-DD format for easy lookup
    reason?: string;
    blockedSlots: string[]; // Empty array = whole day blocked
    createdAt: Timestamp;
}

const COLLECTIONS = {
    SCHEDULE_CONFIG: 'scheduleConfig',
    BLOCKED_DATES: 'blockedDates',
};

// Default configuration
const DEFAULT_CONFIG: Omit<ScheduleConfig, 'updatedAt'> = {
    wednesday: {
        enabled: true,
        slots: ['11:30 AM', '11:45 AM', '12:00 PM', '12:15 PM'],
    },
    saturday: {
        enabled: true,
        slots: ['7:30 PM', '7:45 PM', '8:00 PM', '8:15 PM', '8:30 PM', '8:45 PM', '9:00 PM', '9:15 PM'],
    },
};

/**
 * Get schedule configuration
 */
export async function getScheduleConfig(db: Firestore): Promise<ScheduleConfig> {
    const doc = await db.collection(COLLECTIONS.SCHEDULE_CONFIG).doc('default').get();

    if (!doc.exists) {
        // Return default config
        return {
            ...DEFAULT_CONFIG,
            updatedAt: Timestamp.now(),
        };
    }

    return doc.data() as ScheduleConfig;
}

/**
 * Update schedule configuration
 */
export async function updateScheduleConfig(
    db: Firestore,
    updates: Partial<Omit<ScheduleConfig, 'updatedAt'>>
): Promise<ScheduleConfig> {
    const configRef = db.collection(COLLECTIONS.SCHEDULE_CONFIG).doc('default');
    const existing = await configRef.get();

    const newConfig: ScheduleConfig = {
        ...(existing.exists ? existing.data() as ScheduleConfig : DEFAULT_CONFIG),
        ...updates,
        updatedAt: Timestamp.now(),
    };

    await configRef.set(newConfig);
    return newConfig;
}

/**
 * Get blocked date by date string
 */
export async function getBlockedDate(
    db: Firestore,
    dateStr: string
): Promise<BlockedDate | null> {
    const doc = await db.collection(COLLECTIONS.BLOCKED_DATES).doc(dateStr).get();
    return doc.exists ? (doc.data() as BlockedDate) : null;
}

/**
 * Get all blocked dates (optionally filter future only)
 */
export async function getBlockedDates(
    db: Firestore,
    options?: { futureOnly?: boolean; limit?: number }
): Promise<BlockedDate[]> {
    let query = db.collection(COLLECTIONS.BLOCKED_DATES).orderBy('date', 'asc');

    if (options?.futureOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.where('date', '>=', Timestamp.fromDate(today)) as any;
    }

    if (options?.limit) {
        query = query.limit(options.limit) as any;
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as BlockedDate);
}

/**
 * Block a date or specific slots
 */
export async function blockDate(
    db: Firestore,
    date: Date,
    options?: { reason?: string; blockedSlots?: string[] }
): Promise<BlockedDate> {
    const dateStr = date.toISOString().split('T')[0];
    const blockedDate: BlockedDate = {
        id: dateStr,
        date: Timestamp.fromDate(date),
        dateStr,
        reason: options?.reason,
        blockedSlots: options?.blockedSlots || [], // Empty = whole day
        createdAt: Timestamp.now(),
    };

    await db.collection(COLLECTIONS.BLOCKED_DATES).doc(dateStr).set(blockedDate);
    return blockedDate;
}

/**
 * Unblock a date
 */
export async function unblockDate(db: Firestore, dateStr: string): Promise<void> {
    await db.collection(COLLECTIONS.BLOCKED_DATES).doc(dateStr).delete();
}

/**
 * Check if a date is blocked (whole day or specific slot)
 */
export async function isDateBlocked(
    db: Firestore,
    date: Date,
    slotTime?: string
): Promise<{ blocked: boolean; reason?: string }> {
    const dateStr = date.toISOString().split('T')[0];
    const blocked = await getBlockedDate(db, dateStr);

    if (!blocked) {
        return { blocked: false };
    }

    // If no specific slots blocked, whole day is blocked
    if (blocked.blockedSlots.length === 0) {
        return { blocked: true, reason: blocked.reason };
    }

    // If checking a specific slot
    if (slotTime && blocked.blockedSlots.includes(slotTime)) {
        return { blocked: true, reason: blocked.reason };
    }

    return { blocked: false };
}

/**
 * Get available slots for a date considering config and blocked dates
 */
export async function getConfiguredSlotsForDate(
    db: Firestore,
    date: Date
): Promise<{ slots: string[]; blocked: boolean; reason?: string }> {
    const dayOfWeek = date.getDay();
    const config = await getScheduleConfig(db);

    // Check if it's a valid day
    let dayConfig: { enabled: boolean; slots: string[] } | null = null;
    if (dayOfWeek === 3) {
        dayConfig = config.wednesday;
    } else if (dayOfWeek === 6) {
        dayConfig = config.saturday;
    }

    if (!dayConfig || !dayConfig.enabled) {
        return { slots: [], blocked: false };
    }

    // Check if date is blocked
    const dateStr = date.toISOString().split('T')[0];
    const blockedInfo = await getBlockedDate(db, dateStr);

    if (blockedInfo) {
        // Whole day blocked
        if (blockedInfo.blockedSlots.length === 0) {
            return { slots: [], blocked: true, reason: blockedInfo.reason };
        }

        // Specific slots blocked
        const availableSlots = dayConfig.slots.filter(
            slot => !blockedInfo.blockedSlots.includes(slot)
        );
        return { slots: availableSlots, blocked: false };
    }

    return { slots: [...dayConfig.slots], blocked: false };
}
