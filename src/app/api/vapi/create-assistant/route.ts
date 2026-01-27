// One-time setup endpoint to create the Vapi assistant
// Run this once after deploying, then save the assistant ID

import { NextRequest, NextResponse } from 'next/server';
import { getAssistantConfig } from '@/lib/vapi/assistant-config';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.VAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // Get the server URL from the request or environment
    const serverUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    // Get assistant configuration with the server URL
    const assistantConfig = getAssistantConfig(serverUrl);

    console.log('[VAPI] Creating assistant with config:', JSON.stringify(assistantConfig, null, 2));

    // Create assistant via Vapi API
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assistantConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VAPI] Failed to create assistant:', errorText);
      return NextResponse.json(
        { error: 'Failed to create Vapi assistant', details: errorText },
        { status: response.status }
      );
    }

    const assistant = await response.json();

    console.log('[VAPI] Assistant created successfully:', assistant.id);

    return NextResponse.json({
      success: true,
      assistantId: assistant.id,
      message: 'Assistant created successfully! Save this assistant ID in your environment variables as VAPI_ASSISTANT_ID',
      nextSteps: [
        `1. Add to your .env.local: VAPI_ASSISTANT_ID=${assistant.id}`,
        '2. Go to dashboard.vapi.ai and import your Twilio phone number',
        '3. Connect the phone number to this assistant',
        '4. Test by calling your number!'
      ]
    });

  } catch (error: any) {
    console.error('[VAPI] Error creating assistant:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}

// Get existing assistant info
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.VAPI_API_KEY;
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured' },
        { status: 500 }
      );
    }

    if (!assistantId) {
      return NextResponse.json({
        configured: false,
        message: 'No assistant configured yet. POST to this endpoint to create one.'
      });
    }

    // Get assistant details from Vapi
    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        configured: true,
        assistantId,
        error: 'Could not fetch assistant details from Vapi'
      });
    }

    const assistant = await response.json();

    return NextResponse.json({
      configured: true,
      assistantId,
      name: assistant.name,
      model: assistant.model?.model,
      voice: assistant.voice?.voiceId
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}
