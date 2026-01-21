// Weekly summary cron job - sends appointment list to manager
// Should run Sunday morning

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { getBookingsInRange } from '@/lib/sms/booking-handler';
import { getWeekRange, formatDate } from '@/lib/sms/date-utils';
import { sendSms } from '@/lib/sms/twilio-sender';
import { getWeeklySummaryTemplate, formatBookingForSummary } from '@/lib/sms/templates';

const CRON_SECRET = process.env.CRON_SECRET;
const MANAGER_PHONE = process.env.MANAGER_PHONE;

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
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!MANAGER_PHONE) {
        return NextResponse.json(
            { success: false, error: 'MANAGER_PHONE not configured' },
            { status: 500 }
        );
    }

    try {
        const db = getDb();

        // Get this week's date range (Sunday to Saturday)
        const { start, end } = getWeekRange(new Date());

        // Get all bookings for this week
        const bookings = await getBookingsInRange(db as any, start, end);

        // Format the summary
        const appointmentList = bookings.map(b => formatBookingForSummary(b)).join('\n');

        const message = getWeeklySummaryTemplate({
            name: 'Manager',
            date: '',
            time: '',
            appointmentList,
            count: bookings.length,
        });

        // Send to manager
        await sendSms(MANAGER_PHONE, message);

        return NextResponse.json({
            success: true,
            bookingsCount: bookings.length,
            weekStart: start.toISOString(),
            weekEnd: end.toISOString(),
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('Weekly summary error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
