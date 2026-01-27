// Admin Schedule API - Manage schedule config and blocked dates
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
    getScheduleConfig,
    updateScheduleConfig,
    getBlockedDates,
    blockDate,
    unblockDate,
} from '@/lib/sms/schedule-config';

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

// GET - Get schedule config and blocked dates
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    try {
        const db = getDb();

        if (type === 'blocked') {
            const blockedDates = await getBlockedDates(db, { futureOnly: true });
            return NextResponse.json({ blockedDates });
        }

        // Default: return config and upcoming blocked dates
        const config = await getScheduleConfig(db);
        const blockedDates = await getBlockedDates(db, { futureOnly: true, limit: 50 });

        return NextResponse.json({ config, blockedDates });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Update schedule config or block a date
export async function POST(request: NextRequest) {
    try {
        const { action, ...data } = await request.json();
        const db = getDb();

        if (action === 'updateConfig') {
            const { wednesday, saturday } = data;
            const config = await updateScheduleConfig(db, { wednesday, saturday });
            return NextResponse.json({ success: true, config });
        }

        if (action === 'blockDate') {
            const { date, reason, blockedSlots } = data;
            const blocked = await blockDate(db, new Date(date + 'T12:00:00'), {
                reason,
                blockedSlots,
            });
            return NextResponse.json({ success: true, blocked });
        }

        if (action === 'unblockDate') {
            const { dateStr } = data;
            await unblockDate(db, dateStr);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
