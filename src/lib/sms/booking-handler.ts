// Booking handler - manages appointment creation and validation
// Uses Firebase Admin SDK for server-side operations

import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { Booking, Customer, COLLECTIONS } from './types';
import { isValidAppointmentTime } from './date-utils';

/**
 * Available time slots
 */
export const APPOINTMENT_SLOTS = {
    wednesday: ['11:30 AM', '11:45 AM', '12:00 PM', '12:15 PM'],
    motzeiShabbos: ['7:30 PM', '7:45 PM', '8:00 PM', '8:15 PM', '8:30 PM', '8:45 PM', '9:00 PM', '9:15 PM'],
} as const;

/**
 * Create or update a customer record
 */
export async function upsertCustomer(
    db: Firestore,
    phone: string,
    name: string
): Promise<Customer> {
    const customerId = phone.replace(/\D/g, '');
    const customerRef = db.collection(COLLECTIONS.CUSTOMERS).doc(customerId);

    const existing = await customerRef.get();
    const now = Timestamp.now();

    if (existing.exists) {
        const customer = {
            ...existing.data() as Customer,
            name,
            updatedAt: now,
        };
        await customerRef.set(customer);
        return customer;
    }

    const customer: Customer = {
        id: customerId,
        name,
        phone,
        createdAt: now,
        updatedAt: now,
    };

    await customerRef.set(customer);
    return customer;
}

/**
 * Check if a slot is available
 */
export async function isSlotAvailable(
    db: Firestore,
    date: Date,
    slotTime: string
): Promise<boolean> {
    if (!isValidAppointmentTime(date, slotTime)) {
        return false;
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
        .where('appointmentDate', '>=', Timestamp.fromDate(startOfDay))
        .where('appointmentDate', '<=', Timestamp.fromDate(endOfDay))
        .where('slotTime', '==', slotTime)
        .where('status', 'in', ['pending', 'confirmed'])
        .limit(1)
        .get();

    return snapshot.empty;
}

/**
 * Get available slots for a given date
 */
export async function getAvailableSlotsForDate(
    db: Firestore,
    date: Date
): Promise<string[]> {
    const dayOfWeek = date.getDay();

    let possibleSlots: readonly string[];
    if (dayOfWeek === 3) {
        possibleSlots = APPOINTMENT_SLOTS.wednesday;
    } else if (dayOfWeek === 6) {
        possibleSlots = APPOINTMENT_SLOTS.motzeiShabbos;
    } else {
        return [];
    }

    const available: string[] = [];
    for (const slot of possibleSlots) {
        if (await isSlotAvailable(db, date, slot)) {
            available.push(slot);
        }
    }

    return available;
}

/**
 * Create a new booking
 */
export async function createBooking(
    db: Firestore,
    data: {
        customerPhone: string;
        customerName: string;
        appointmentDate: Date;
        slotTime: string;
        groupSize: number;
        weddingDate: Date;
    }
): Promise<Booking> {
    const customer = await upsertCustomer(db, data.customerPhone, data.customerName);

    const isAvailable = await isSlotAvailable(db, data.appointmentDate, data.slotTime);
    if (!isAvailable) {
        throw new Error('Slot is not available');
    }

    if (data.groupSize > 4 && data.groupSize <= 6) {
        const slots = data.appointmentDate.getDay() === 3
            ? APPOINTMENT_SLOTS.wednesday
            : APPOINTMENT_SLOTS.motzeiShabbos;
        const lastSlot = slots[slots.length - 1];

        if (data.slotTime !== lastSlot) {
            throw new Error('Groups of 5-6 need the last slot of the evening');
        }
    } else if (data.groupSize > 6) {
        throw new Error('Maximum group size is 6');
    }

    const now = Timestamp.now();
    const bookingId = `${customer.id}_${data.appointmentDate.getTime()}`;

    const booking: Booking = {
        id: bookingId,
        customerId: customer.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        appointmentDate: Timestamp.fromDate(data.appointmentDate),
        slotTime: data.slotTime,
        slotDuration: data.groupSize > 4 ? 30 : 15,
        groupSize: data.groupSize,
        weddingDate: Timestamp.fromDate(data.weddingDate),
        status: 'confirmed',
        gownPickedUp: false,
        gownReturned: false,
        donationPaid: false,
        confirmationSent: false,
        dayBeforeReminderSent: false,
        returnReminderSent: false,
        createdAt: now,
        updatedAt: now,
    };

    await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).set(booking);
    return booking;
}

/**
 * Get bookings for a date range
 */
export async function getBookingsInRange(
    db: Firestore,
    startDate: Date,
    endDate: Date
): Promise<Booking[]> {
    const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
        .where('appointmentDate', '>=', Timestamp.fromDate(startDate))
        .where('appointmentDate', '<=', Timestamp.fromDate(endDate))
        .where('status', 'in', ['pending', 'confirmed'])
        .orderBy('appointmentDate', 'asc')
        .get();

    return snapshot.docs.map((d) => d.data() as Booking);
}

/**
 * Get bookings needing day-before reminder
 */
export async function getBookingsNeedingReminder(
    db: Firestore,
    reminderDate: Date
): Promise<Booking[]> {
    const startOfDay = new Date(reminderDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reminderDate);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
        .where('appointmentDate', '>=', Timestamp.fromDate(startOfDay))
        .where('appointmentDate', '<=', Timestamp.fromDate(endOfDay))
        .where('status', '==', 'confirmed')
        .where('dayBeforeReminderSent', '==', false)
        .get();

    return snapshot.docs.map((d) => d.data() as Booking);
}

/**
 * Get bookings needing return reminder
 */
export async function getBookingsNeedingReturnReminder(
    db: Firestore,
    weddingDate: Date
): Promise<Booking[]> {
    const startOfDay = new Date(weddingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(weddingDate);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
        .where('weddingDate', '>=', Timestamp.fromDate(startOfDay))
        .where('weddingDate', '<=', Timestamp.fromDate(endOfDay))
        .where('gownReturned', '==', false)
        .where('returnReminderSent', '==', false)
        .get();

    return snapshot.docs.map((d) => d.data() as Booking);
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(
    db: Firestore,
    bookingId: string,
    reminderType: 'confirmation' | 'dayBefore' | 'return'
): Promise<void> {
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);

    const field = {
        confirmation: 'confirmationSent',
        dayBefore: 'dayBeforeReminderSent',
        return: 'returnReminderSent',
    }[reminderType];

    await bookingRef.update({
        [field]: true,
        updatedAt: Timestamp.now()
    });
}

/**
 * Cancel a booking
 */
export async function cancelBooking(
    db: Firestore,
    bookingId: string
): Promise<Booking | null> {
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const doc = await bookingRef.get();

    if (!doc.exists) {
        return null;
    }

    await bookingRef.update({
        status: 'cancelled',
        updatedAt: Timestamp.now()
    });

    return { ...doc.data(), status: 'cancelled' } as Booking;
}

/**
 * Reschedule a booking to a new date/time
 */
export async function rescheduleBooking(
    db: Firestore,
    bookingId: string,
    newDate: Date,
    newSlotTime: string
): Promise<Booking | null> {
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const doc = await bookingRef.get();

    if (!doc.exists) {
        return null;
    }

    // Check new slot availability
    const available = await isSlotAvailable(db, newDate, newSlotTime);
    if (!available) {
        throw new Error('New slot is not available');
    }

    await bookingRef.update({
        appointmentDate: Timestamp.fromDate(newDate),
        slotTime: newSlotTime,
        dayBeforeReminderSent: false, // Reset reminder
        updatedAt: Timestamp.now()
    });

    const updated = await bookingRef.get();
    return updated.data() as Booking;
}

/**
 * Update booking fields (for admin dashboard)
 */
export async function updateBooking(
    db: Firestore,
    bookingId: string,
    updates: Partial<{
        gownPickedUp: boolean;
        gownReturned: boolean;
        gownDescription: string;
        donationPaid: boolean;
        donationAmount: number;
        notes: string;
        status: Booking['status'];
        customerName: string;
        customerPhone: string;
        groupSize: number;
        weddingDate: Date;
    }>
): Promise<Booking | null> {
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const doc = await bookingRef.get();

    if (!doc.exists) {
        return null;
    }

    // Convert Date objects to Timestamps
    const updateData: any = { ...updates, updatedAt: Timestamp.now() };
    if (updates.weddingDate instanceof Date) {
        updateData.weddingDate = Timestamp.fromDate(updates.weddingDate);
    }

    await bookingRef.update(updateData);

    const updated = await bookingRef.get();
    return updated.data() as Booking;
}

/**
 * Get a booking by ID
 */
export async function getBookingById(
    db: Firestore,
    bookingId: string
): Promise<Booking | null> {
    const doc = await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).get();
    return doc.exists ? (doc.data() as Booking) : null;
}

/**
 * Get active booking for a phone number (for cancellation via SMS)
 */
export async function getActiveBookingByPhone(
    db: Firestore,
    phone: string
): Promise<Booking | null> {
    const normalizedPhone = phone.replace(/\D/g, '');

    // Find the most recent confirmed booking for this phone
    const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
        .where('customerPhone', '==', phone)
        .where('status', '==', 'confirmed')
        .orderBy('appointmentDate', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) {
        // Try with normalized phone
        const snapshot2 = await db.collection(COLLECTIONS.BOOKINGS)
            .where('customerPhone', '==', `+1${normalizedPhone}`)
            .where('status', '==', 'confirmed')
            .orderBy('appointmentDate', 'desc')
            .limit(1)
            .get();

        return snapshot2.empty ? null : (snapshot2.docs[0].data() as Booking);
    }

    return snapshot.docs[0].data() as Booking;
}

/**
 * Get all bookings (for admin dashboard)
 */
export async function getAllBookings(
    db: Firestore,
    options?: {
        status?: Booking['status'] | 'all';
        outstandingGowns?: boolean;
        unpaid?: boolean;
        limit?: number;
    }
): Promise<Booking[]> {
    let query = db.collection(COLLECTIONS.BOOKINGS).orderBy('appointmentDate', 'desc');

    if (options?.status && options.status !== 'all') {
        query = query.where('status', '==', options.status) as any;
    }

    if (options?.outstandingGowns) {
        query = query.where('gownPickedUp', '==', true).where('gownReturned', '==', false) as any;
    }

    if (options?.unpaid) {
        query = query.where('donationPaid', '==', false) as any;
    }

    if (options?.limit) {
        query = query.limit(options.limit) as any;
    }

    const snapshot = await query.get();
    return snapshot.docs.map((d) => d.data() as Booking);
}

/**
 * Get bookings for a specific date
 */
export async function getBookingsForDate(
    db: Firestore,
    date: Date
): Promise<Booking[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
        .where('appointmentDate', '>=', Timestamp.fromDate(startOfDay))
        .where('appointmentDate', '<=', Timestamp.fromDate(endOfDay))
        .where('status', 'in', ['pending', 'confirmed'])
        .orderBy('appointmentDate', 'asc')
        .get();

    return snapshot.docs.map((d) => d.data() as Booking);
}
