// Unified Daily Cron Job
// Runs every day at 9 AM ET
// Handles: Manager notifications, Day-before reminders, Return reminders

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
    getBookingsForDate,
    getBookingsNeedingReminder,
    getBookingsNeedingReturnReminder,
    markReminderSent,
} from '@/lib/sms/booking-handler';
import { sendSms } from '@/lib/sms/twilio-sender';
import {
    getDayBeforeReminderTemplate,
    getReturnReminderTemplate,
    formatBookingForSummary,
} from '@/lib/sms/templates';

const CRON_SECRET = process.env.CRON_SECRET;
const MANAGER_PHONE = process.env.MANAGER_PHONE;

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

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const results: any = {
        timestamp: new Date().toISOString(),
        dayOfWeek: new Date().getDay(),
        managerNotification: null,
        customerReminders: 0,
        returnReminders: 0,
    };

    try {
        const db = getDb();
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

        // === MANAGER NOTIFICATIONS ===
        // Tuesday & Wednesday: Send Wednesday appointments
        // Friday: Send Motzei Shabbos (Saturday night) appointments

        if (MANAGER_PHONE) {
            let targetDate: Date | null = null;
            let label = '';

            if (dayOfWeek === 2) { // Tuesday
                // Get Wednesday appointments (tomorrow)
                targetDate = new Date(today);
                targetDate.setDate(today.getDate() + 1);
                label = 'Tomorrow (Wednesday)';
            } else if (dayOfWeek === 3) { // Wednesday
                // Reminder for today
                targetDate = today;
                label = 'Today (Wednesday)';
            } else if (dayOfWeek === 5) { // Friday
                // Get Saturday (Motzei Shabbos) appointments
                targetDate = new Date(today);
                targetDate.setDate(today.getDate() + 1);
                label = 'Tomorrow (Motzei Shabbos)';
            }

            if (targetDate) {
                const bookings = await getBookingsForDate(db, targetDate);

                if (bookings.length > 0) {
                    const list = bookings.map(b => formatBookingForSummary(b)).join('\n');
                    const message = `📋 ${label} Appointments (${bookings.length}):\n\n${list}\n\n👉 Admin: ${process.env.VERCEL_URL || 'your-site.vercel.app'}/admin`;

                    await sendSms(MANAGER_PHONE, message);
                    results.managerNotification = { label, count: bookings.length };
                } else {
                    results.managerNotification = { label, count: 0, message: 'No appointments' };
                }
            }
        }

        // === DAY-BEFORE CUSTOMER REMINDERS ===
        // Send reminders to customers whose appointment is tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const needReminder = await getBookingsNeedingReminder(db, tomorrow);

        for (const booking of needReminder) {
            const dateStr = booking.appointmentDate.toDate().toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
            });

            const message = getDayBeforeReminderTemplate({
                name: booking.customerName,
                date: dateStr,
                time: booking.slotTime,
                groupSize: booking.groupSize,
            });

            await sendSms(booking.customerPhone, message);
            await markReminderSent(db, booking.id, 'dayBefore');
            results.customerReminders++;
        }

        // === RETURN REMINDERS (Sunday only) ===
        // Send reminders to people whose wedding was yesterday and picked up a gown
        if (dayOfWeek === 0) { // Sunday
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const needReturn = await getBookingsNeedingReturnReminder(db, yesterday);

            for (const booking of needReturn) {
                // Only send if they actually picked up the gown
                if (booking.gownPickedUp && !booking.gownReturned) {
                    const message = getReturnReminderTemplate({
                        name: booking.customerName,
                        date: '',
                        time: '',
                    });

                    await sendSms(booking.customerPhone, message);
                    await markReminderSent(db, booking.id, 'return');
                    results.returnReminders++;
                }
            }
        }

        return NextResponse.json({ success: true, ...results });
    } catch (error: any) {
        console.error('Daily check error:', error);
        return NextResponse.json({ success: false, error: error.message, ...results }, { status: 500 });
    }
}
