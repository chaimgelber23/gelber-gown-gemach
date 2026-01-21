// Booking handler - manages appointment creation and validation

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp,
    orderBy,
    limit
} from 'firebase/firestore';
import { Booking, Customer, ConversationState, COLLECTIONS } from './types';
import { ParsedMessage } from './message-parser';
import { parseDate, getNextAvailableDates, isValidAppointmentTime } from './date-utils';

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
    db: ReturnType<typeof getFirestore>,
    phone: string,
    name: string
): Promise<Customer> {
    const customerId = phone.replace(/\D/g, ''); // Use phone digits as ID
    const customerRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);

    const existing = await getDoc(customerRef);
    const now = Timestamp.now();

    if (existing.exists()) {
        // Update existing customer
        const customer = {
            ...existing.data() as Customer,
            name, // Update name in case it changed
            updatedAt: now,
        };
        await setDoc(customerRef, customer);
        return customer;
    }

    // Create new customer
    const customer: Customer = {
        id: customerId,
        name,
        phone,
        createdAt: now,
        updatedAt: now,
    };

    await setDoc(customerRef, customer);
    return customer;
}

/**
 * Check if a slot is available
 */
export async function isSlotAvailable(
    db: ReturnType<typeof getFirestore>,
    date: Date,
    slotTime: string
): Promise<boolean> {
    // Check valid time first
    if (!isValidAppointmentTime(date, slotTime)) {
        return false;
    }

    // Query for existing bookings at this date/time
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsRef = collection(db, COLLECTIONS.BOOKINGS);
    const q = query(
        bookingsRef,
        where('appointmentDate', '>=', Timestamp.fromDate(startOfDay)),
        where('appointmentDate', '<=', Timestamp.fromDate(endOfDay)),
        where('slotTime', '==', slotTime),
        where('status', 'in', ['pending', 'confirmed']),
        limit(1)
    );

    const snapshot = await getDocs(q);
    return snapshot.empty;
}

/**
 * Get available slots for a given date
 */
export async function getAvailableSlotsForDate(
    db: ReturnType<typeof getFirestore>,
    date: Date
): Promise<string[]> {
    const dayOfWeek = date.getDay();

    // Determine which slots are possible for this day
    let possibleSlots: readonly string[];
    if (dayOfWeek === 3) { // Wednesday
        possibleSlots = APPOINTMENT_SLOTS.wednesday;
    } else if (dayOfWeek === 6) { // Saturday (Motzei Shabbos)
        possibleSlots = APPOINTMENT_SLOTS.motzeiShabbos;
    } else {
        return []; // No appointments on other days
    }

    // Check each slot for availability
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
    db: ReturnType<typeof getFirestore>,
    data: {
        customerPhone: string;
        customerName: string;
        appointmentDate: Date;
        slotTime: string;
        groupSize: number;
        weddingDate: Date;
    }
): Promise<Booking> {
    // First, ensure customer exists
    const customer = await upsertCustomer(db, data.customerPhone, data.customerName);

    // Validate slot
    const isAvailable = await isSlotAvailable(db, data.appointmentDate, data.slotTime);
    if (!isAvailable) {
        throw new Error('Slot is not available');
    }

    // Validate group size
    if (data.groupSize > 4 && data.groupSize <= 6) {
        // Need 30-min slot - check if it's the last slot
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

    // Create booking
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

    const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
    await setDoc(bookingRef, booking);

    return booking;
}

/**
 * Get bookings for a date range (for weekly summary)
 */
export async function getBookingsInRange(
    db: ReturnType<typeof getFirestore>,
    startDate: Date,
    endDate: Date
): Promise<Booking[]> {
    const bookingsRef = collection(db, COLLECTIONS.BOOKINGS);
    const q = query(
        bookingsRef,
        where('appointmentDate', '>=', Timestamp.fromDate(startDate)),
        where('appointmentDate', '<=', Timestamp.fromDate(endDate)),
        where('status', 'in', ['pending', 'confirmed']),
        orderBy('appointmentDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Booking);
}

/**
 * Get bookings needing day-before reminder
 */
export async function getBookingsNeedingReminder(
    db: ReturnType<typeof getFirestore>,
    reminderDate: Date
): Promise<Booking[]> {
    const startOfDay = new Date(reminderDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reminderDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsRef = collection(db, COLLECTIONS.BOOKINGS);
    const q = query(
        bookingsRef,
        where('appointmentDate', '>=', Timestamp.fromDate(startOfDay)),
        where('appointmentDate', '<=', Timestamp.fromDate(endOfDay)),
        where('status', '==', 'confirmed'),
        where('dayBeforeReminderSent', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Booking);
}

/**
 * Get bookings needing return reminder (wedding was yesterday)
 */
export async function getBookingsNeedingReturnReminder(
    db: ReturnType<typeof getFirestore>,
    weddingDate: Date
): Promise<Booking[]> {
    const startOfDay = new Date(weddingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(weddingDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsRef = collection(db, COLLECTIONS.BOOKINGS);
    const q = query(
        bookingsRef,
        where('weddingDate', '>=', Timestamp.fromDate(startOfDay)),
        where('weddingDate', '<=', Timestamp.fromDate(endOfDay)),
        where('gownReturned', '==', false),
        where('returnReminderSent', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Booking);
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(
    db: ReturnType<typeof getFirestore>,
    bookingId: string,
    reminderType: 'confirmation' | 'dayBefore' | 'return'
): Promise<void> {
    const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);

    const field = {
        confirmation: 'confirmationSent',
        dayBefore: 'dayBeforeReminderSent',
        return: 'returnReminderSent',
    }[reminderType];

    await setDoc(bookingRef, {
        [field]: true,
        updatedAt: Timestamp.now()
    }, { merge: true });
}
