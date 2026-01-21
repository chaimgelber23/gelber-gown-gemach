// Conversation state manager - handles multi-turn SMS conversations

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import { ConversationState, COLLECTIONS } from './types';
import { ParsedMessage, mergeData, getMissingFields } from './message-parser';

const CONVERSATION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get or create conversation state for a phone number
 */
export async function getConversationState(
    db: ReturnType<typeof getFirestore>,
    phone: string
): Promise<ConversationState | null> {
    const stateId = phone.replace(/\D/g, '');
    const stateRef = doc(db, COLLECTIONS.CONVERSATIONS, stateId);

    const snapshot = await getDoc(stateRef);

    if (!snapshot.exists()) {
        return null;
    }

    const state = snapshot.data() as ConversationState;

    // Check if expired
    if (state.expiresAt.toMillis() < Date.now()) {
        await deleteDoc(stateRef);
        return null;
    }

    return state;
}

/**
 * Update conversation state with new data
 */
export async function updateConversationState(
    db: ReturnType<typeof getFirestore>,
    phone: string,
    parsed: ParsedMessage,
    existingState: ConversationState | null
): Promise<ConversationState> {
    const stateId = phone.replace(/\D/g, '');
    const stateRef = doc(db, COLLECTIONS.CONVERSATIONS, stateId);
    const now = Timestamp.now();

    // Merge new data with existing
    const collectedData = mergeData(
        existingState?.collectedData || {},
        parsed.extractedData
    );

    // Add phone if not already there
    if (!collectedData.phone) {
        collectedData.phone = phone;
    }

    // Check what's still missing
    const missingFields = getMissingFields(collectedData);

    const newState: ConversationState = {
        id: stateId,
        phone,
        state: missingFields.length === 0 ? 'confirming' : 'collecting_info',
        collectedData,
        missingFields,
        lastMessageAt: now,
        expiresAt: Timestamp.fromMillis(Date.now() + CONVERSATION_TIMEOUT_MS),
    };

    await setDoc(stateRef, newState);
    return newState;
}

/**
 * Clear conversation state (after booking complete or cancelled)
 */
export async function clearConversationState(
    db: ReturnType<typeof getFirestore>,
    phone: string
): Promise<void> {
    const stateId = phone.replace(/\D/g, '');
    const stateRef = doc(db, COLLECTIONS.CONVERSATIONS, stateId);
    await deleteDoc(stateRef);
}

/**
 * Check if all required fields are collected
 */
export function isBookingComplete(state: ConversationState): boolean {
    return state.missingFields.length === 0;
}
