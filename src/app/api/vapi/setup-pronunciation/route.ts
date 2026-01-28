// Setup Hebrew pronunciation dictionary for Vapi assistant
// This creates a pronunciation dictionary and updates the assistant to use it

import { NextRequest, NextResponse } from 'next/server';

// Hebrew words with IPA phonemes for proper "ch" (guttural) pronunciation
const HEBREW_PRONUNCIATIONS = [
  {
    stringToReplace: "Gemach",
    type: "phoneme",
    phoneme: "ɡɛmax",
    alphabet: "ipa"
  },
  {
    stringToReplace: "gemach",
    type: "phoneme",
    phoneme: "ɡɛmax",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Chana",
    type: "phoneme",
    phoneme: "xanə",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Chani",
    type: "phoneme",
    phoneme: "xani",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Chaim",
    type: "phoneme",
    phoneme: "xaɪm",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Bracha",
    type: "phoneme",
    phoneme: "braxə",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Lechaim",
    type: "phoneme",
    phoneme: "ləxaɪm",
    alphabet: "ipa"
  },
  {
    stringToReplace: "L'chaim",
    type: "phoneme",
    phoneme: "ləxaɪm",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Mazel tov",
    type: "phoneme",
    phoneme: "mazəl tɔv",
    alphabet: "ipa"
  },
  {
    stringToReplace: "mazel tov",
    type: "phoneme",
    phoneme: "mazəl tɔv",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Motzei Shabbos",
    type: "phoneme",
    phoneme: "moʊtseɪ ʃabəs",
    alphabet: "ipa"
  },
  {
    stringToReplace: "motzei shabbos",
    type: "phoneme",
    phoneme: "moʊtseɪ ʃabəs",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Shabbos",
    type: "phoneme",
    phoneme: "ʃabəs",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Kallah",
    type: "phoneme",
    phoneme: "kalə",
    alphabet: "ipa"
  },
  {
    stringToReplace: "kallah",
    type: "phoneme",
    phoneme: "kalə",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Chinuch",
    type: "phoneme",
    phoneme: "xinux",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Kollel",
    type: "phoneme",
    phoneme: "kɔleɪl",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Chasunah",
    type: "phoneme",
    phoneme: "xasunə",
    alphabet: "ipa"
  },
  {
    stringToReplace: "chasunah",
    type: "phoneme",
    phoneme: "xasunə",
    alphabet: "ipa"
  },
  {
    stringToReplace: "Gelber",
    type: "phoneme",
    phoneme: "ɡɛlbər",
    alphabet: "ipa"
  }
];

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.VAPI_API_KEY;
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // Step 1: Create the pronunciation dictionary
    console.log('[VAPI] Creating pronunciation dictionary...');

    const dictResponse = await fetch('https://api.vapi.ai/pronunciation-dictionary', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: "Hebrew Pronunciation Dictionary",
        rules: HEBREW_PRONUNCIATIONS
      }),
    });

    if (!dictResponse.ok) {
      const errorText = await dictResponse.text();
      console.error('[VAPI] Failed to create pronunciation dictionary:', errorText);
      return NextResponse.json(
        { error: 'Failed to create pronunciation dictionary', details: errorText },
        { status: dictResponse.status }
      );
    }

    const dictionary = await dictResponse.json();
    const dictionaryId = dictionary.id;

    console.log('[VAPI] Pronunciation dictionary created:', dictionaryId);

    // Step 2: Update the assistant to use this dictionary (if assistant ID is set)
    if (assistantId) {
      console.log('[VAPI] Updating assistant with pronunciation dictionary...');

      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel voice
            model: "eleven_turbo_v2_5", // Required for pronunciation dictionary
            pronunciationDictionaryLocators: [
              {
                pronunciationDictionaryId: dictionaryId
              }
            ]
          }
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[VAPI] Failed to update assistant:', errorText);
        return NextResponse.json({
          success: true,
          dictionaryId,
          warning: 'Dictionary created but failed to update assistant',
          details: errorText,
          manualStep: `Update your assistant manually with this dictionary ID: ${dictionaryId}`
        });
      }

      console.log('[VAPI] Assistant updated successfully');

      return NextResponse.json({
        success: true,
        dictionaryId,
        assistantUpdated: true,
        message: 'Pronunciation dictionary created and assistant updated!',
        wordsAdded: HEBREW_PRONUNCIATIONS.map(r => r.stringToReplace)
      });
    }

    // No assistant ID set - return dictionary ID for manual setup
    return NextResponse.json({
      success: true,
      dictionaryId,
      assistantUpdated: false,
      message: 'Pronunciation dictionary created! Update your assistant manually.',
      manualStep: `Add VAPI_ASSISTANT_ID to your environment, then run this again, or manually add this dictionary ID to your assistant: ${dictionaryId}`,
      wordsAdded: HEBREW_PRONUNCIATIONS.map(r => r.stringToReplace)
    });

  } catch (error: any) {
    console.error('[VAPI] Error setting up pronunciation:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}

// GET: List existing pronunciation dictionaries
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.VAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // Get list of pronunciation dictionaries
    const response = await fetch('https://api.vapi.ai/pronunciation-dictionary', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch pronunciation dictionaries', details: errorText },
        { status: response.status }
      );
    }

    const dictionaries = await response.json();

    return NextResponse.json({
      dictionaries,
      hebrewWords: HEBREW_PRONUNCIATIONS.map(r => r.stringToReplace)
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}
