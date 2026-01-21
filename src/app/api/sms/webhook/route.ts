// Twilio SMS Webhook - receives incoming messages
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

import { parseMessage, getMissingFields, mergeData } from '@/lib/sms/message-parser';
import {
    getConversationState,
    updateConversationState,
    clearConversationState,
    isBookingComplete
} from '@/lib/sms/conversation-state';
import {
    createBooking,
    isSlotAvailable,
    getAvailableSlotsForDate
} from '@/lib/sms/booking-handler';
import { parseDate, formatDate, getNextAvailableDates, isValidAppointmentTime } from '@/lib/sms/date-utils';
import { sendSms, normalizePhone } from '@/lib/sms/twilio-sender';
import {
    getConfirmationTemplate,
    getMissingInfoTemplate,
    getSlotUnavailableTemplate,
    getGreetingTemplate,
    getFaqResponse,
} from '@/lib/sms/templates';
import { SmsLog, COLLECTIONS } from '@/lib/sms/types';

// Initialize Firebase Admin if not already done
function getDb() {
    if (!getApps().length) {
        // For server-side, we use admin SDK
        // This will be configured via environment variables
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            try {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                initializeApp({
                    credential: cert(serviceAccount),
                    projectId,
                });
            } catch (parseError) {
                console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError);
                // Fallback to default credentials
                initializeApp({ projectId });
            }
        } else {
            console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not found, using default credentials');
            // Fallback for development - use default credentials
            initializeApp({ projectId });
        }
    }

    return getAdminFirestore();
}


// Twilio sends form-urlencoded data
export async function POST(request: NextRequest) {
    console.log('[WEBHOOK] POST request received');
    try {
        const formData = await request.formData();
        const from = formData.get('From') as string;
        const body = formData.get('Body') as string;
        const messageSid = formData.get('MessageSid') as string;

        console.log('[WEBHOOK] Parsed form data:', { from, body: body?.substring(0, 50), messageSid });

        if (!from || !body) {
            console.log('[WEBHOOK] Missing required fields');
            return new NextResponse('Missing required fields', { status: 400 });
        }

        const phone = normalizePhone(from);
        console.log('[WEBHOOK] Normalized phone:', phone);

        console.log('[WEBHOOK] Initializing Firebase...');
        const db = getDb();
        console.log('[WEBHOOK] Firebase initialized');

        // Log incoming message
        console.log('[WEBHOOK] Logging message to Firestore...');
        await logMessage(db, 'inbound', phone, body, messageSid);
        console.log('[WEBHOOK] Message logged');

        // Get existing conversation state
        console.log('[WEBHOOK] Getting conversation state...');
        const existingState = await getConversationState(db as any, phone);
        console.log('[WEBHOOK] Got conversation state:', existingState ? 'exists' : 'new');

        // Parse the incoming message
        console.log('[WEBHOOK] Parsing message with OpenAI...');
        const parsed = await parseMessage(body, existingState);
        console.log('[WEBHOOK] Parsed intent:', parsed.intent);

        let responseMessage: string;


        // Handle different intents
        switch (parsed.intent) {
            case 'greeting':
                responseMessage = getGreetingTemplate();
                break;

            case 'question':
                const faqAnswer = getFaqResponse(body);
                responseMessage = faqAnswer || getGreetingTemplate();
                break;

            case 'cancellation':
                await clearConversationState(db as any, phone);
                responseMessage = 'Your booking request has been cancelled. Text anytime to start a new booking!';
                break;

            case 'confirmation':
                if (existingState && isBookingComplete(existingState)) {
                    // Try to complete the booking
                    responseMessage = await processBooking(db, existingState, phone);
                } else {
                    responseMessage = 'I don\'t have a pending booking to confirm. Would you like to book an appointment?';
                }
                break;

            case 'booking':
            default:
                // Update conversation state with new data
                const newState = await updateConversationState(db as any, phone, parsed, existingState);

                if (isBookingComplete(newState)) {
                    // All info collected - ask for confirmation
                    const data = newState.collectedData;
                    const appointmentDate = parseDate(data.appointmentDate || '');

                    responseMessage = `Great! Here's what I have:
📅 ${data.appointmentDate} at ${data.slotTime || 'TBD'}
👤 ${data.name}
👥 ${data.groupSize} ${data.groupSize === 1 ? 'person' : 'people'}
💒 Wedding: ${data.weddingDate}
📱 ${data.phone}

Reply YES to confirm or CANCEL to start over.`;
                } else {
                    // Still missing info
                    responseMessage = getMissingInfoTemplate(newState.missingFields);
                }
                break;
        }

        // Send response
        await sendSms(phone, responseMessage);
        await logMessage(db, 'outbound', phone, responseMessage);

        // Return TwiML response (empty - we send via API)
        return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            }
        );

    } catch (error: any) {
        console.error('Webhook error:', error);
        // Return detailed error for debugging (remove in production)
        return new NextResponse(
            JSON.stringify({
                error: 'Internal server error',
                message: error?.message || 'Unknown error',
                stack: error?.stack?.split('\n').slice(0, 5) || []
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * Process a complete booking
 */
async function processBooking(db: any, state: any, phone: string): Promise<string> {
    try {
        const data = state.collectedData;

        // Parse dates
        const appointmentDate = parseDate(data.appointmentDate);
        const weddingDate = parseDate(data.weddingDate);

        if (!appointmentDate || !weddingDate) {
            return 'I couldn\'t understand the dates. Please try again with clear dates like "this Wednesday" or "January 25".';
        }

        // Determine slot time
        let slotTime = data.slotTime;
        if (!slotTime) {
            // Default to first available slot
            const availableSlots = await getAvailableSlotsForDate(db, appointmentDate);
            if (availableSlots.length === 0) {
                const nextDates = getNextAvailableDates(new Date(), 3);
                const alternatives = nextDates.map(d => formatDate(d));
                return getSlotUnavailableTemplate(data.appointmentDate, alternatives);
            }
            slotTime = availableSlots[0];
        }

        // Create the booking
        const booking = await createBooking(db, {
            customerPhone: phone,
            customerName: data.name,
            appointmentDate,
            slotTime,
            groupSize: data.groupSize,
            weddingDate,
        });

        // Clear conversation state
        await clearConversationState(db, phone);

        // Return confirmation
        return getConfirmationTemplate({
            name: data.name,
            date: formatDate(appointmentDate),
            time: slotTime,
            groupSize: data.groupSize,
        });

    } catch (error: any) {
        console.error('Booking error:', error);

        if (error.message?.includes('not available')) {
            const nextDates = getNextAvailableDates(new Date(), 3);
            const alternatives = nextDates.map(d => formatDate(d));
            return getSlotUnavailableTemplate('that time', alternatives);
        }

        return 'Sorry, there was an error creating your booking. Please try again or call 718-614-8390.';
    }
}

/**
 * Log SMS for debugging
 */
async function logMessage(
    db: any,
    direction: 'inbound' | 'outbound',
    phone: string,
    message: string,
    twilioSid?: string
): Promise<void> {
    try {
        const logId = `${Date.now()}_${direction}`;
        const log: SmsLog = {
            id: logId,
            direction,
            phone,
            message,
            twilioSid,
            createdAt: Timestamp.now() as any,
        };

        await db.collection(COLLECTIONS.SMS_LOGS).doc(logId).set(log);
    } catch (error) {
        console.error('Failed to log message:', error);
    }
}

// Handle GET for Twilio webhook validation
export async function GET() {
    return new NextResponse('SMS Webhook Active', { status: 200 });
}
