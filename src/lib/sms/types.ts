// Firestore schema types for SMS booking agent
// Uses Firebase Admin SDK types for server-side operations

import { Timestamp } from 'firebase-admin/firestore';

// Customer record - stored when someone first texts
export interface Customer {
  id: string;
  name: string;
  phone: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Booking record - each appointment
export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;

  // Appointment details
  appointmentDate: Timestamp;  // The date of the visit
  slotTime: string;            // e.g., "11:30 AM", "7:30 PM"
  slotDuration: number;        // 15 or 30 minutes
  groupSize: number;           // Max 4, or 6 for 30-min slots

  // Wedding details
  weddingDate: Timestamp;

  // Status tracking
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

  // Gown tracking
  gownPickedUp: boolean;
  gownPickupDate?: Timestamp;
  gownReturned: boolean;
  gownReturnDate?: Timestamp;
  donationAmount?: number;
  donationPaid: boolean;

  // Reminder tracking
  confirmationSent: boolean;
  dayBeforeReminderSent: boolean;
  returnReminderSent: boolean;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notes?: string;
}

// Conversation state for multi-turn SMS interactions
export interface ConversationState {
  id: string;           // phone number
  phone: string;
  state: 'idle' | 'collecting_info' | 'confirming' | 'awaiting_response';
  collectedData: Partial<{
    name: string;
    appointmentDate: string;
    slotTime: string;
    groupSize: number;
    weddingDate: string;
    phone: string;
  }>;
  missingFields: string[];
  lastMessageAt: Timestamp;
  expiresAt: Timestamp;  // Clear state after 1 hour of inactivity
}

// SMS message log for debugging
export interface SmsLog {
  id: string;
  direction: 'inbound' | 'outbound';
  phone: string;
  message: string;
  twilioSid?: string;
  parsedIntent?: string;
  createdAt: Timestamp;
}

// Firestore collection names
export const COLLECTIONS = {
  CUSTOMERS: 'customers',
  BOOKINGS: 'bookings',
  CONVERSATIONS: 'conversations',
  SMS_LOGS: 'smsLogs',
} as const;
