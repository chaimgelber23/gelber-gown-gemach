// Admin Bookings API
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
    getAllBookings,
    getBookingsForDate,
    updateBooking,
    cancelBooking,
    rescheduleBooking,
    getBookingById,
    createBooking,
} from '@/lib/sms/booking-handler';
import { sendSms } from '@/lib/sms/twilio-sender';
import { getAdminCancelledTemplate, getAdminRescheduledTemplate } from '@/lib/sms/templates';
import { formatDate } from '@/lib/sms/date-utils';

function getDb() {
    if (!getApps().length) {
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            initializeApp({ credential: cert(serviceAccount), projectId });
        } else {
            initializeApp({ projectId });
        }
    }
    return getFirestore();
}

// GET - Fetch bookings or statistics
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status') as any;
    const outstanding = searchParams.get('outstanding') === 'true';
    const unpaid = searchParams.get('unpaid') === 'true';
    const stats = searchParams.get('stats') === 'true';

    try {
        const db = getDb();

        // Return statistics if requested
        if (stats) {
            const allBookings = await getAllBookings(db, { status: 'all', limit: 1000 });

            const totalGownsTakenOut = allBookings.filter(b => b.gownPickedUp).length;
            const currentlyOut = allBookings.filter(b => b.gownPickedUp && !b.gownReturned).length;

            return NextResponse.json({
                totalGownsTakenOut,
                currentlyOut
            });
        }

        if (date) {
            const bookings = await getBookingsForDate(db, new Date(date));
            return NextResponse.json({ bookings });
        }

        const bookings = await getAllBookings(db, {
            status: status || 'all',
            outstandingGowns: outstanding,
            unpaid: unpaid,
            limit: 100,
        });

        return NextResponse.json({ bookings });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create new booking
export async function POST(request: NextRequest) {
    try {
        const { customerName, customerPhone, appointmentDate, slotTime, groupSize, weddingDate, notes } = await request.json();
        const db = getDb();

        // Normalize phone number
        let normalizedPhone = customerPhone.replace(/\D/g, '');
        if (normalizedPhone.length === 10) {
            normalizedPhone = `+1${normalizedPhone}`;
        } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
            normalizedPhone = `+${normalizedPhone}`;
        }

        const booking = await createBooking(db, {
            customerName,
            customerPhone: normalizedPhone,
            appointmentDate: new Date(appointmentDate + 'T12:00:00'),
            slotTime,
            groupSize: Number(groupSize),
            weddingDate: new Date(weddingDate + 'T12:00:00'),
        });

        // Update with notes if provided
        if (notes) {
            await updateBooking(db, booking.id, { notes });
        }

        return NextResponse.json({ success: true, booking });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

// PATCH - Update booking
export async function PATCH(request: NextRequest) {
    try {
        const { bookingId, action, updates, newDate, newSlotTime } = await request.json();
        const db = getDb();

        if (action === 'cancel') {
            const booking = await cancelBooking(db, bookingId);
            if (booking) {
                // Send SMS notification
                const dateStr = booking.appointmentDate.toDate().toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                });
                await sendSms(
                    booking.customerPhone,
                    getAdminCancelledTemplate({ name: booking.customerName, date: dateStr })
                );
            }
            return NextResponse.json({ success: true, booking });
        }

        if (action === 'reschedule') {
            const booking = await rescheduleBooking(db, bookingId, new Date(newDate), newSlotTime);
            if (booking) {
                const dateStr = booking.appointmentDate.toDate().toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                });
                await sendSms(
                    booking.customerPhone,
                    getAdminRescheduledTemplate({
                        name: booking.customerName,
                        newDate: dateStr,
                        newTime: newSlotTime
                    })
                );
            }
            return NextResponse.json({ success: true, booking });
        }

        if (action === 'update') {
            const booking = await updateBooking(db, bookingId, updates);
            return NextResponse.json({ success: true, booking });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
