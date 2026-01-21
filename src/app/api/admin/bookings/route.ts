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

// GET - Fetch bookings
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status') as any;
    const outstanding = searchParams.get('outstanding') === 'true';
    const unpaid = searchParams.get('unpaid') === 'true';

    try {
        const db = getDb();

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
