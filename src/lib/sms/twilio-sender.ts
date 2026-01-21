// Twilio SMS sender utility

import twilio from 'twilio';

// Initialize Twilio client (lazy)
let twilioClient: twilio.Twilio | null = null;

function getClient() {
    if (!twilioClient) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        console.log('[TWILIO] Initializing client:', {
            hasSid: !!accountSid,
            hasToken: !!authToken,
            sidPrefix: accountSid?.substring(0, 6)
        });

        if (!accountSid || !authToken) {
            throw new Error('Twilio credentials not configured');
        }
        twilioClient = twilio(accountSid, authToken);
    }
    return twilioClient;
}

export interface SendSmsResult {
    success: boolean;
    messageSid?: string;
    error?: string;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
    try {
        const client = getClient();
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

        if (!twilioPhone) {
            throw new Error('TWILIO_PHONE_NUMBER not configured');
        }

        // Normalize phone number (ensure it has +1 for US)
        const normalizedTo = normalizePhone(to);

        console.log('[TWILIO] Sending message:', { to: normalizedTo, from: twilioPhone, bodyLength: body.length });

        const message = await client.messages.create({
            body,
            from: twilioPhone,
            to: normalizedTo,
        });

        console.log(`SMS sent to ${normalizedTo}: ${message.sid}`);

        return {
            success: true,
            messageSid: message.sid,
        };
    } catch (error) {
        console.error('Failed to send SMS:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhone(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // If 10 digits, assume US and add +1
    if (digits.length === 10) {
        return `+1${digits}`;
    }

    // If 11 digits starting with 1, add +
    if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
    }

    // Otherwise, add + if not present
    if (!phone.startsWith('+')) {
        return `+${digits}`;
    }

    return phone;
}

/**
 * Format phone for display (xxx-xxx-xxxx)
 */
export function formatPhoneDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const last10 = digits.slice(-10);

    if (last10.length === 10) {
        return `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`;
    }

    return phone;
}
