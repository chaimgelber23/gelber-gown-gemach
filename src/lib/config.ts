// Stub config for existing utils.ts references
import type { ScanJobStatus, ItemType } from './types';

export const itemTypeConfig: Record<ItemType, string> = {
    Gown: 'bg-pink-100 text-pink-800',
    Accessory: 'bg-purple-100 text-purple-800',
    Other: 'bg-gray-100 text-gray-800',
};

export const statusConfig: Record<ScanJobStatus, { color: string; textColor: string }> = {
    Pending: { color: 'bg-yellow-100', textColor: 'text-yellow-600' },
    InProgress: { color: 'bg-blue-100', textColor: 'text-blue-600' },
    Complete: { color: 'bg-green-100', textColor: 'text-green-600' },
    Failed: { color: 'bg-red-100', textColor: 'text-red-600' },
};
