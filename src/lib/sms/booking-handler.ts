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
