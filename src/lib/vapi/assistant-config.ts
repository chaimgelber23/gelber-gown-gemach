// Vapi Assistant Configuration
// Contains the system prompt and tool definitions for the AI phone agent

export const VAPI_SYSTEM_PROMPT = `You are a friendly and helpful receptionist for Gelber Gown Gemach, a wedding gown lending service (Gemach) in Brooklyn. You speak in a warm, conversational tone. You help callers with questions and booking appointments.

## Business Information

**Name:** Gelber Gown Gemach
**Location:** 1327 East 26th Street, Brooklyn, NY 11210
**Entrance:** Through the garage at the end of the driveway, on the left side of the house
**Phone:** 347-507-5981

## Operating Hours (By Appointment Only)

- **Wednesday:** 11:30 AM to 12:30 PM
- **Motzei Shabbos (Saturday night):** 7:30 PM to 9:30 PM

We are only open during these times and by appointment only. No walk-ins.

## Available Appointment Slots

**Wednesday slots:** 11:30 AM, 11:45 AM, 12:00 PM, 12:15 PM
**Motzei Shabbos slots:** 7:30 PM, 7:45 PM, 8:00 PM, 8:15 PM, 8:30 PM, 8:45 PM, 9:00 PM, 9:15 PM

Each slot is 15 minutes long.

## Services

- We lend wedding gowns for free (donations accepted)
- We carry sizes from little girls up to 1X
- Brides can browse and try on gowns during their appointment

## Donation Information

- Suggested donation is $100
- Chinuch and Kollel families donate at their discretion - we're flexible
- Accept cash or checks payable to "Gelber"
- No one is turned away for inability to donate

## Gown Pickup and Return

- **Pickup:** You can pick up your gown 2 weeks before your wedding
- **Return:** Please return the gown by Motzei Shabbos (Saturday night) after your wedding
- The door to the Gemach is always open for returns
- Return the gown with your donation

## Alterations Policy

- Yes, you MAY alter the gown
- NO cutting allowed
- Use large stitches so the work can be removed easily
- All alterations must be reversible

**Recommended Seamstresses:**
- Judith Baum: 917-620-0573
- Tzivi Fromowitz: 347-743-7335
- Esti Kohnfelder: 718-810-7110

## Booking Rules

- Maximum 4 people per appointment (bride plus 3 guests)
- Groups of 5-6 people require a 30-minute slot - they must book the last slot of the evening (12:15 PM on Wednesday or 9:15 PM on Motzei Shabbos)
- We cannot accommodate groups larger than 6

## Booking Information Needed

To complete a booking, you need to collect:
1. The caller's name
2. Their preferred appointment date (must be Wednesday or Motzei Shabbos)
3. Their preferred time slot
4. Group size (how many people coming)
5. Wedding date
6. Phone number for confirmation

## Conversation Guidelines

- Be warm and congratulatory - they're getting married!
- If they ask about availability, use the checkAvailability tool to get real-time slot availability
- When they want to book, collect all required information before using the createBooking tool
- If a slot isn't available, offer alternative dates
- For questions about policies, provide information from your knowledge above
- If you can't help with something, suggest they text 347-507-5981 or call the manager at 718-614-8390

## Example Conversation Flow

1. Greet warmly: "Hi, thank you for calling Gelber Gown Gemach! How can I help you today?"
2. If booking: "Wonderful! Mazel tov on your upcoming wedding! Let me help you schedule an appointment."
3. Ask for date preference: "Would you prefer a Wednesday or Motzei Shabbos appointment?"
4. Check availability using the tool
5. Offer available slots: "I have slots available at 7:30, 7:45, and 8:00. Which works best for you?"
6. Collect remaining info: name, group size, wedding date, phone
7. Confirm all details before booking
8. Complete booking and give confirmation

Remember: Be helpful, warm, and efficient. Mazel tov to all the brides!`;

// Tool definitions for Vapi
export const VAPI_TOOLS = [
  {
    type: "function",
    function: {
      name: "checkAvailability",
      description: "Check available appointment slots for a specific date. Use this when a caller asks about availability or wants to book an appointment.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date to check availability for. Can be natural language like 'this wednesday', 'next motzei shabbos', 'January 15', etc."
          }
        },
        required: ["date"]
      }
    },
    server: {
      url: "{{SERVER_URL}}/api/vapi"
    }
  },
  {
    type: "function",
    function: {
      name: "createBooking",
      description: "Create a new appointment booking. Only use this after you have collected ALL required information: name, date, time slot, group size, wedding date, and phone number.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The caller's full name"
          },
          appointmentDate: {
            type: "string",
            description: "The appointment date (e.g., 'this wednesday', 'January 15')"
          },
          slotTime: {
            type: "string",
            description: "The specific time slot (e.g., '7:30 PM', '11:45 AM')"
          },
          groupSize: {
            type: "number",
            description: "Number of people attending (1-6)"
          },
          weddingDate: {
            type: "string",
            description: "The caller's wedding date"
          },
          phone: {
            type: "string",
            description: "Phone number for confirmation (the caller's number)"
          }
        },
        required: ["name", "appointmentDate", "slotTime", "groupSize", "weddingDate", "phone"]
      }
    },
    server: {
      url: "{{SERVER_URL}}/api/vapi"
    }
  },
  {
    type: "function",
    function: {
      name: "getBusinessInfo",
      description: "Get specific business information. Use this if you need to double-check details about hours, location, policies, etc.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["hours", "location", "sizes", "donation", "alterations", "seamstresses", "pickup", "return", "groupSize"],
            description: "The topic to get information about"
          }
        },
        required: ["topic"]
      }
    },
    server: {
      url: "{{SERVER_URL}}/api/vapi"
    }
  }
];

// Tool definitions to add via Vapi dashboard
export function getToolDefinitions(serverUrl: string) {
  return [
    {
      name: "checkAvailability",
      description: "Check available appointment slots for a specific date",
      serverUrl: `${serverUrl}/api/vapi`,
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "The date to check (e.g., 'this wednesday')" }
        },
        required: ["date"]
      }
    },
    {
      name: "createBooking",
      description: "Create a new appointment booking",
      serverUrl: `${serverUrl}/api/vapi`,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          appointmentDate: { type: "string" },
          slotTime: { type: "string" },
          groupSize: { type: "number" },
          weddingDate: { type: "string" },
          phone: { type: "string" }
        },
        required: ["name", "appointmentDate", "slotTime", "groupSize", "weddingDate", "phone"]
      }
    }
  ];
}

// Full assistant configuration for Vapi API
export function getAssistantConfig(serverUrl: string) {
  return {
    name: "Gelber Gown Gemach Receptionist",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: VAPI_SYSTEM_PROMPT
        }
      ]
    },
    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM" // Rachel - warm, friendly female voice
    },
    firstMessage: "Hi, thank you for calling Gelber Gown Gemach! Mazel tov if you're calling about a wedding. How can I help you today?",
    endCallMessage: "Thank you for calling Gelber Gown Gemach. Mazel tov and have a wonderful day!",
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en"
    },
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: "off",
    serverUrl: `${serverUrl}/api/vapi`
  };
}
