// Debug endpoint to check environment variables (remove in production)
import { NextResponse } from 'next/server';

export async function GET() {
    const envCheck = {
        hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasServiceAccountKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        serviceAccountKeyLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
        hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
        hasTwilioAuth: !!process.env.TWILIO_AUTH_TOKEN,
        hasTwilioPhone: !!process.env.TWILIO_PHONE_NUMBER,
        hasOpenAiKey: !!process.env.OPENAI_API_KEY,
        hasManagerPhone: !!process.env.MANAGER_PHONE,
        // Test if service account key parses correctly
        serviceAccountParses: false,
        parseError: null as string | null,
    };

    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            envCheck.serviceAccountParses = true;
        }
    } catch (e: any) {
        envCheck.parseError = e.message;
    }

    return NextResponse.json(envCheck);
}
