// Message templates for SMS agent
// These can be customized - the agent will use these exact templates

import { Booking } from './types';
import { formatPhoneDisplay } from './twilio-sender';

export interface TemplateData {
    name: string;
    date: string;
    time: string;
    groupSize?: number;
    weddingDate?: string;
    appointmentList?: string;
    count?: number;
}

/**
 * Booking confirmation - sent immediately after booking
 */
export function getConfirmationTemplate(data: TemplateData): string {
    return `Hi ${data.name}! ✨

Your appointment at Gelber Gown Gemach is confirmed:
📅 ${data.date} at ${data.time}
👥 ${data.groupSize || 1} ${(data.groupSize || 1) === 1 ? 'person' : 'people'}

📍 1327 East 26th Street, Brooklyn
   Enter through the garage at the end of the driveway (left side)

Questions? Reply to this text.
See you soon!`;
}

/**
 * Day-before reminder - sent morning before appointment
 */
export function getDayBeforeReminderTemplate(data: TemplateData): string {
    return `Reminder: Your Gelber Gown Gemach appointment is TOMORROW at ${data.time}! 👗

📍 1327 East 26th Street, Brooklyn (garage entrance, left side)
👥 Max ${data.groupSize || 4} people in your group

See you soon, ${data.name}!`;
}

/**
 * Return reminder - sent day after wedding
 */
export function getReturnReminderTemplate(data: TemplateData): string {
    return `Mazel Tov ${data.name}! 🎉

We hope your simcha was beautiful!

Please return your gown by this Motzaei Shabbos with your donation.
The door to the Gemach is always open—you can return anytime.

Thank you for choosing Gelber Gown Gemach!`;
}

/**
 * Weekly summary for manager - sent Sunday morning
 */
export function getWeeklySummaryTemplate(data: TemplateData): string {
    if (!data.appointmentList || data.count === 0) {
        return `📋 Weekly Summary: No appointments scheduled for this week.`;
    }

    return `📋 This Week's Appointments (${data.count}):

${data.appointmentList}

Have a great week! 🙌`;
}

/**
 * Collect missing info - when booking request is incomplete
 */
export function getMissingInfoTemplate(missingFields: string[]): string {
    const fieldMap: Record<string, string> = {
        name: 'your name',
        appointmentDate: 'the date you\'d like to come',
        groupSize: 'how many people in your group',
        weddingDate: 'your wedding date',
        phone: 'your phone number',
    };

    const missing = missingFields.map(f => fieldMap[f] || f).join(', ');

    return `Thanks for reaching out! To complete your booking, please send:
${missing}

Or text all 5 items:
1. Name
2. Preferred date/time
3. Group size
4. Wedding date
5. Phone number`;
}

/**
 * Slot unavailable - when requested time is taken
 */
export function getSlotUnavailableTemplate(requestedTime: string, alternatives: string[]): string {
    const altList = alternatives.slice(0, 3).join('\n');

    return `Sorry, ${requestedTime} is not available.

Here are some open slots:
${altList}

Reply with your preferred time!`;
}

/**
 * FAQ response - when someone asks a question
 */
export function getFaqResponse(question: string): string | null {
    const faqs: Record<string, string> = {
        hours: `Appointment hours (by appointment only):
• Wednesday: 11:30 AM – 12:30 PM
• Motzaei Shabbos: 7:30 PM – 9:30 PM`,

        location: `📍 1327 East 26th Street, Brooklyn, NY 11210
Enter through the garage at the end of the driveway (left side of house)`,

        sizes: `We carry gowns from little girls up to 1X.`,

        pickup: `You can pick up your gown 2 weeks before your wedding. Text to arrange a pickup time!`,

        return: `Please return gowns by Motzaei Shabbos after your wedding with your donation. The door is always open.`,

        donation: `Standard donation is $100. Chinuch/Kollel families donate at their discretion. Checks payable to "Gelber" or cash.`,

        alterations: `Yes, you can alter the gown, but:
• No cutting allowed
• Use large stitches so work can be removed easily

Recommended seamstresses:
• Judith Baum: 917-620-0573
• Tzivi Fromowitz: 347-743-7335
• Esti Kohnfelder: 718-810-7110`,

        group: `Max 4 people per group. Groups of 6 need a 30-min slot or the last slot of the evening.`,
    };

    // Match keywords to FAQ topics
    const lowerQ = question.toLowerCase();

    if (lowerQ.includes('hour') || lowerQ.includes('when') || lowerQ.includes('time') || lowerQ.includes('open')) {
        return faqs.hours;
    }
    if (lowerQ.includes('where') || lowerQ.includes('address') || lowerQ.includes('location') || lowerQ.includes('entrance')) {
        return faqs.location;
    }
    if (lowerQ.includes('size')) {
        return faqs.sizes;
    }
    if (lowerQ.includes('pick up') || lowerQ.includes('pickup')) {
        return faqs.pickup;
    }
    if (lowerQ.includes('return') || lowerQ.includes('bring back')) {
        return faqs.return;
    }
    if (lowerQ.includes('donat') || lowerQ.includes('cost') || lowerQ.includes('price') || lowerQ.includes('pay') || lowerQ.includes('how much')) {
        return faqs.donation;
    }
    if (lowerQ.includes('alter') || lowerQ.includes('seamstress') || lowerQ.includes('tailor')) {
        return faqs.alterations;
    }
    if (lowerQ.includes('group') || lowerQ.includes('how many') || lowerQ.includes('people')) {
        return faqs.group;
    }

    return null;
}

/**
 * Generic greeting for unknown messages
 */
export function getGreetingTemplate(): string {
    return `Hi! Welcome to Gelber Gown Gemach 👗

To book an appointment, please text:
1. Your name
2. Date and time you'd like to come
3. Number of people in your group
4. Wedding date
5. Phone number

Or ask me any questions about our policies!`;
}

/**
 * Admin cancelled appointment
 */
export function getAdminCancelledTemplate(data: { name: string; date: string }): string {
    return `Hi ${data.name}, your Gelber Gown Gemach appointment on ${data.date} has been cancelled. Please text us to rebook if needed.`;
}

/**
 * Admin rescheduled appointment
 */
export function getAdminRescheduledTemplate(data: { name: string; newDate: string; newTime: string }): string {
    return `Hi ${data.name}, your appointment has been moved to ${data.newDate} at ${data.newTime}. Reply if this doesn't work for you!`;
}

/**
 * Customer cancelled their own booking
 */
export function getCustomerCancelledTemplate(data: { date: string }): string {
    return `Your appointment on ${data.date} has been cancelled. Text anytime to book a new appointment!`;
}

/**
 * Unknown question fallback
 */
export function getUnknownQuestionTemplate(): string {
    return `I'm not sure about that. Please text the manager directly at 718-614-8390 for help, or try rephrasing your question.`;
}

/**
 * Format booking for summary list
 */
export function formatBookingForSummary(booking: Booking): string {
    const date = booking.appointmentDate.toDate().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });

    return `• ${date} ${booking.slotTime} - ${booking.customerName} (${booking.groupSize}p)`;
}
