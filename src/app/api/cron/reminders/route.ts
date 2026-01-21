// Cron job for sending reminders
// This should be triggered daily via Vercel Cron or similar

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
    getBookingsNeedingReminder,
    getBookingsNeedingReturnReminder,
    getBookingsInRange,
    markReminderSent
} from '@/lib/sms/booking-handler';
import { getWeekRange, getNextWeekRange, formatDate } from '@/lib/sms/date-utils';
import { sendSms } from '@/lib/sms/twilio-sender';
import {
    getDayBeforeReminderTemplate,
    getReturnReminderTemplate,
    getWeeklySummaryTemplate,
    formatBookingForSummary,
} from '@/lib/sms/templates';

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET;

function getDb() {
    if (!getApps().length) {
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            initializeApp({
                credential: cert(serviceAccount),
                projectId,
            });
        } else {
            initializeApp({ projectId });
        }
    }

    return getFirestore();
}

export async function GET(request: NextRequest) {
    // Verify cron secret (for Vercel Cron)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const db = getDb();
        const today = new Date();
        const results = {
            dayBeforeReminders: 0,
            returnReminders: 0,
            errors: [] as string[],
        };

        // 1. Send day-before appointment reminders
        // Get appointments for tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const appointmentsNeedingReminder = await getBookingsNeedingReminder(db as any, tomorrow);

        for (const booking of appointmentsNeedingReminder) {
            try {
                const message = getDayBeforeReminderTemplate({
                    name: booking.customerName,
                    date: formatDate(booking.appointmentDate.toDate()),
                    time: booking.slotTime,
                    groupSize: booking.groupSize,
                });

                await sendSms(booking.customerPhone, message);
                await markReminderSent(db as any, booking.id, 'dayBefore');
                results.dayBeforeReminders++;
            } catch (error: any) {
                results.errors.push(`Day-before reminder failed for ${booking.customerPhone}: ${error.message}`);
            }
        }

        // 2. Send return reminders (wedding was yesterday)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const bookingsNeedingReturn = await getBookingsNeedingReturnReminder(db as any, yesterday);

        for (const booking of bookingsNeedingReturn) {
            try {
                const message = getReturnReminderTemplate({
                    name: booking.customerName,
                    date: '',
                    time: '',
                });

                await sendSms(booking.customerPhone, message);
                await markReminderSent(db as any, booking.id, 'return');
                results.returnReminders++;
            } catch (error: any) {
                results.errors.push(`Return reminder failed for ${booking.customerPhone}: ${error.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            ...results,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('Cron job error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
