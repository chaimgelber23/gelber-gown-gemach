// Vapi Webhook - handles tool calls from the AI phone agent
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Timestamp } from 'firebase-admin/firestore';

import {
  createBooking,
  getAvailableSlotsForDate,
  APPOINTMENT_SLOTS
} from '@/lib/sms/booking-handler';
import { parseDate, formatDate, getNextAvailableDates, isValidAppointmentTime } from '@/lib/sms/date-utils';
import { normalizePhone } from '@/lib/sms/twilio-sender';

// Initialize Firebase Admin
function getDb() {
  if (!getApps().length) {
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
        initializeApp({ projectId });
      }
    } else {
      initializeApp({ projectId });
    }
  }

  return getAdminFirestore();
}

// Business info database
const BUSINESS_INFO: Record<string, string> = {
  hours: `We're open by appointment only:
• Wednesday: 11:30 AM to 12:30 PM
• Motzei Shabbos (Saturday night): 7:30 PM to 9:30 PM`,

  location: `1327 East 26th Street, Brooklyn, NY 11210. Enter through the garage at the end of the driveway, on the left side of the house.`,

  sizes: `We carry wedding gowns in sizes from little girls up to 1X.`,

  donation: `The suggested donation is $100. Chinuch and Kollel families donate at their discretion - we're very flexible. We accept cash or checks payable to "Gelber". No one is turned away.`,

  alterations: `Yes, you may alter the gown, but no cutting is allowed. Use large stitches so the alterations can be removed easily. All work must be reversible.`,

  seamstresses: `Recommended seamstresses:
• Judith Baum: 917-620-0573
• Tzivi Fromowitz: 347-743-7335
• Esti Kohnfelder: 718-810-7110`,

  pickup: `You can pick up your gown 2 weeks before your wedding. Just text or call us to arrange a pickup time.`,

  return: `Please return the gown by Motzei Shabbos (Saturday night) after your wedding, along with your donation. The door to the Gemach is always open for returns.`,

  groupSize: `Maximum 4 people per regular appointment. Groups of 5-6 need to book the last slot of the evening (12:15 PM Wednesday or 9:15 PM Motzei Shabbos) which is 30 minutes. We cannot accommodate groups larger than 6.`
};

// Handle tool calls from Vapi
async function handleToolCall(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  const db = getDb();

  switch (toolName) {
    case 'checkAvailability': {
      const dateStr = args.date;
      const parsedDate = parseDate(dateStr);

      if (!parsedDate) {
        return {
          success: false,
          message: "I couldn't understand that date. Could you say it differently? For example, 'this Wednesday' or 'next Motzei Shabbos'."
        };
      }

      const dayOfWeek = parsedDate.getDay();

      // Check if it's a valid appointment day
      if (dayOfWeek !== 3 && dayOfWeek !== 6) {
        const nextDates = getNextAvailableDates(new Date(), 4);
        const alternatives = nextDates.map(d => formatDate(d)).join(', ');

        return {
          success: false,
          available: false,
          message: `We only have appointments on Wednesdays and Motzei Shabbos. The next available dates are: ${alternatives}.`
        };
      }

      // Get available slots
      const availableSlots = await getAvailableSlotsForDate(db, parsedDate);
      const dateFormatted = formatDate(parsedDate);

      if (availableSlots.length === 0) {
        const nextDates = getNextAvailableDates(parsedDate, 3);
        const alternatives = nextDates.map(d => formatDate(d)).join(', ');

        return {
          success: true,
          available: false,
          date: dateFormatted,
          slots: [],
          message: `Sorry, ${dateFormatted} is fully booked. Would you like to try: ${alternatives}?`
        };
      }

      return {
        success: true,
        available: true,
        date: dateFormatted,
        slots: availableSlots,
        message: `For ${dateFormatted}, I have the following slots available: ${availableSlots.join(', ')}.`
      };
    }

    case 'createBooking': {
      const { name, appointmentDate, slotTime, groupSize, weddingDate, phone } = args;

      // Parse dates
      const parsedAppointmentDate = parseDate(appointmentDate);
      const parsedWeddingDate = parseDate(weddingDate);

      if (!parsedAppointmentDate) {
        return {
          success: false,
          message: "I couldn't understand the appointment date. Could you tell me the date again?"
        };
      }

      if (!parsedWeddingDate) {
        return {
          success: false,
          message: "I couldn't understand the wedding date. Could you tell me when your wedding is?"
        };
      }

      // Validate group size
      const groupSizeNum = typeof groupSize === 'string' ? parseInt(groupSize) : groupSize;
      if (groupSizeNum > 6) {
        return {
          success: false,
          message: "I'm sorry, we can only accommodate groups of up to 6 people. Would you like to book with a smaller group?"
        };
      }

      // Check if large group needs last slot
      const dayOfWeek = parsedAppointmentDate.getDay();
      const slots = dayOfWeek === 3 ? APPOINTMENT_SLOTS.wednesday : APPOINTMENT_SLOTS.motzeiShabbos;
      const lastSlot = slots[slots.length - 1];

      if (groupSizeNum > 4 && slotTime !== lastSlot) {
        return {
          success: false,
          message: `For groups of ${groupSizeNum}, you'll need our 30-minute slot which is the last slot of the evening at ${lastSlot}. Would that work for you?`
        };
      }

      // Normalize phone
      const normalizedPhone = normalizePhone(phone);

      try {
        const booking = await createBooking(db, {
          customerPhone: normalizedPhone,
          customerName: name,
          appointmentDate: parsedAppointmentDate,
          slotTime,
          groupSize: groupSizeNum,
          weddingDate: parsedWeddingDate,
        });

        const formattedDate = formatDate(parsedAppointmentDate);

        return {
          success: true,
          bookingId: booking.id,
          message: `Wonderful! Your appointment is confirmed for ${formattedDate} at ${slotTime}. You'll receive a text confirmation at ${phone}. We're located at 1327 East 26th Street in Brooklyn - enter through the garage on the left side of the driveway. Mazel tov on your upcoming wedding!`
        };

      } catch (error: any) {
        console.error('Booking error:', error);
        console.error('Booking error stack:', error.stack);
        console.error('Booking error details:', JSON.stringify({
          message: error.message,
          code: error.code,
          name: error.name
        }));

        if (error.message?.includes('not available')) {
          const availableSlots = await getAvailableSlotsForDate(db, parsedAppointmentDate);
          if (availableSlots.length > 0) {
            return {
              success: false,
              message: `Sorry, ${slotTime} is no longer available. I do have these slots open: ${availableSlots.join(', ')}. Would one of those work?`
            };
          } else {
            const nextDates = getNextAvailableDates(parsedAppointmentDate, 3);
            const alternatives = nextDates.map(d => formatDate(d)).join(', ');
            return {
              success: false,
              message: `Sorry, that date is now fully booked. Would you like to try: ${alternatives}?`
            };
          }
        }

        return {
          success: false,
          message: "I'm having trouble completing the booking. Could you please text us at 347-507-5981 to complete your reservation?"
        };
      }
    }

    case 'getBusinessInfo': {
      const topic = args.topic?.toLowerCase();
      const info = BUSINESS_INFO[topic];

      if (info) {
        return {
          success: true,
          topic,
          info
        };
      }

      return {
        success: false,
        message: "I don't have specific information about that topic."
      };
    }

    default:
      return {
        success: false,
        message: `Unknown tool: ${toolName}`
      };
  }
}

// Main webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[VAPI] Received webhook:', JSON.stringify(body, null, 2));

    const message = body.message;

    // Handle different message types from Vapi
    if (message?.type === 'tool-calls') {
      const toolCalls = message.toolCalls || [];
      const results = [];

      for (const toolCall of toolCalls) {
        const { id, function: func } = toolCall;
        const toolName = func.name;
        const args = typeof func.arguments === 'string'
          ? JSON.parse(func.arguments)
          : func.arguments;

        console.log(`[VAPI] Tool call: ${toolName}`, args);

        const result = await handleToolCall(toolName, args);

        console.log(`[VAPI] Tool result:`, result);

        results.push({
          toolCallId: id,
          result
        });
      }

      return NextResponse.json({ results });
    }

    // Handle status updates (optional logging)
    if (message?.type === 'status-update') {
      console.log('[VAPI] Status update:', message.status);
      return NextResponse.json({ success: true });
    }

    // Handle end-of-call report
    if (message?.type === 'end-of-call-report') {
      console.log('[VAPI] Call ended:', {
        duration: message.durationSeconds,
        cost: message.cost,
        summary: message.summary
      });
      return NextResponse.json({ success: true });
    }

    // Handle transcript updates
    if (message?.type === 'transcript') {
      // Could log transcripts here if needed
      return NextResponse.json({ success: true });
    }

    // Default response for unhandled message types
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[VAPI] Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Gelber Gown Gemach - Vapi Voice Agent',
    timestamp: new Date().toISOString()
  });
}
