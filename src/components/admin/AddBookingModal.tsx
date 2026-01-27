// Add Booking Modal Component
'use client';

import { useState, useEffect } from 'react';

interface AddBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    preselectedDate?: Date;
}

const WEDNESDAY_SLOTS = ['11:30 AM', '11:45 AM', '12:00 PM', '12:15 PM'];
const SATURDAY_SLOTS = ['7:30 PM', '7:45 PM', '8:00 PM', '8:15 PM', '8:30 PM', '8:45 PM', '9:00 PM', '9:15 PM'];

export default function AddBookingModal({ isOpen, onClose, onSuccess, preselectedDate }: AddBookingModalProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [slotTime, setSlotTime] = useState('');
    const [groupSize, setGroupSize] = useState(1);
    const [weddingDate, setWeddingDate] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setName('');
            setPhone('');
            setSlotTime('');
            setGroupSize(1);
            setWeddingDate('');
            setNotes('');
            setError('');
            setAvailableSlots([]);

            if (preselectedDate) {
                const dateStr = preselectedDate.toISOString().split('T')[0];
                setAppointmentDate(dateStr);
            } else {
                setAppointmentDate('');
            }
        }
    }, [isOpen, preselectedDate]);

    // Fetch available slots when date changes
    useEffect(() => {
        if (!appointmentDate) {
            setAvailableSlots([]);
            setSlotTime('');
            return;
        }

        const fetchSlots = async () => {
            setLoadingSlots(true);
            setError('');
            try {
                const res = await fetch(`/api/admin/slots?date=${appointmentDate}`);
                const data = await res.json();

                if (data.error) {
                    setError(data.error);
                    setAvailableSlots([]);
                } else {
                    setAvailableSlots(data.slots || []);
                    if (data.slots?.length > 0) {
                        setSlotTime(data.slots[0]);
                    } else {
                        setSlotTime('');
                    }
                }
            } catch (err) {
                setError('Failed to fetch available slots');
                setAvailableSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [appointmentDate]);

    // Get day type for selected date
    const getDateInfo = (dateStr: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr + 'T12:00:00');
        const day = date.getDay();
        if (day === 3) return { day: 'Wednesday', slots: WEDNESDAY_SLOTS };
        if (day === 6) return { day: 'Saturday', slots: SATURDAY_SLOTS };
        return null;
    };

    const dateInfo = getDateInfo(appointmentDate);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!dateInfo) {
            setError('Please select a Wednesday or Saturday');
            return;
        }

        if (!slotTime) {
            setError('Please select a time slot');
            return;
        }

        if (groupSize > 4 && groupSize <= 6) {
            const lastSlot = dateInfo.slots[dateInfo.slots.length - 1];
            if (slotTime !== lastSlot) {
                setError(`Groups of 5-6 must book the last slot (${lastSlot})`);
                return;
            }
        }

        if (groupSize > 6) {
            setError('Maximum group size is 6');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: name,
                    customerPhone: phone,
                    appointmentDate,
                    slotTime,
                    groupSize,
                    weddingDate,
                    notes,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create booking');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create booking');
        } finally {
            setSaving(false);
        }
    };

    // Format phone number as user types
    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
        return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                    <h3 className="font-semibold text-lg text-gray-900">New Appointment</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Customer Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Customer Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Full name"
                            required
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number *
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(formatPhone(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="(555) 555-5555"
                            required
                        />
                    </div>

                    {/* Appointment Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Appointment Date *
                        </label>
                        <input
                            type="date"
                            value={appointmentDate}
                            onChange={e => setAppointmentDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                        {appointmentDate && !dateInfo && (
                            <p className="text-amber-600 text-sm mt-1">
                                Appointments are only available on Wednesday or Saturday (Motzei Shabbos)
                            </p>
                        )}
                        {dateInfo && (
                            <p className="text-green-600 text-sm mt-1">
                                {dateInfo.day} - Valid appointment day
                            </p>
                        )}
                    </div>

                    {/* Time Slot */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Time Slot *
                        </label>
                        {loadingSlots ? (
                            <div className="text-gray-400 py-2">Loading available slots...</div>
                        ) : availableSlots.length > 0 ? (
                            <select
                                value={slotTime}
                                onChange={e => setSlotTime(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            >
                                {availableSlots.map(slot => (
                                    <option key={slot} value={slot}>{slot}</option>
                                ))}
                            </select>
                        ) : dateInfo ? (
                            <div className="text-amber-600 py-2 text-sm">
                                No slots available for this date
                            </div>
                        ) : (
                            <div className="text-gray-400 py-2 text-sm">
                                Select an appointment date first
                            </div>
                        )}
                    </div>

                    {/* Group Size */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Group Size *
                        </label>
                        <select
                            value={groupSize}
                            onChange={e => setGroupSize(Number(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        >
                            {[1, 2, 3, 4, 5, 6].map(n => (
                                <option key={n} value={n}>
                                    {n} {n === 1 ? 'person' : 'people'}
                                    {n > 4 && ' (requires last slot)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Wedding Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Wedding Date *
                        </label>
                        <input
                            type="date"
                            value={weddingDate}
                            onChange={e => setWeddingDate(e.target.value)}
                            min={appointmentDate || new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes (optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Internal notes..."
                        />
                    </div>

                    {/* Submit */}
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !dateInfo || availableSlots.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Creating...' : 'Create Appointment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
