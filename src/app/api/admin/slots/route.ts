// Admin Slots API - Get available slots for a date
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAvailableSlotsForDate } from '@/lib/sms/booking-handler';
import { getConfiguredSlotsForDate, getScheduleConfig } from '@/lib/sms/schedule-config';

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

// GET - Get available slots for a date
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
        return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });
    }

    try {
        const date = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = date.getDay();
        const db = getDb();

        // Get schedule config
        const config = await getScheduleConfig(db);

        // Check if it's a valid appointment day based on config
        const dayConfig = dayOfWeek === 3 ? config.wednesday : dayOfWeek === 6 ? config.saturday : null;

        if (!dayConfig || !dayConfig.enabled) {
            return NextResponse.json({
                error: 'Appointments are only available on Wednesday or Saturday',
                dayOfWeek,
                slots: [],
                allSlots: [],
                blocked: false,
            });
        }

        // Get configured slots (respecting blocked dates)
        const configuredSlots = await getConfiguredSlotsForDate(db, date);

        if (configuredSlots.blocked) {
            return NextResponse.json({
                date: dateStr,
                dayOfWeek,
                dayName: dayOfWeek === 3 ? 'Wednesday' : 'Saturday',
                slots: [],
                allSlots: [...dayConfig.slots],
                blocked: true,
                blockReason: configuredSlots.reason,
            });
        }

        // Filter out already booked slots
        const availableSlots = await getAvailableSlotsForDate(db, date);

        // Intersection of configured slots and not-yet-booked slots
        const finalSlots = configuredSlots.slots.filter(slot => availableSlots.includes(slot));

        return NextResponse.json({
            date: dateStr,
            dayOfWeek,
            dayName: dayOfWeek === 3 ? 'Wednesday' : 'Saturday',
            slots: finalSlots,
            allSlots: [...dayConfig.slots],
            blocked: false,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
