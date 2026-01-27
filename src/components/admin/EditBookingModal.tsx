// Edit Booking Modal Component
'use client';

import { useState, useEffect } from 'react';

interface Booking {
    id: string;
    customerName: string;
    customerPhone: string;
    slotTime: string;
    groupSize: number;
    notes?: string;
    appointmentDate: { _seconds: number };
    weddingDate: { _seconds: number };
}

interface EditBookingModalProps {
    booking: Booking;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<Booking> & { reschedule?: { newDate: string; newSlotTime: string } }) => Promise<void>;
}

export default function EditBookingModal({ booking, isOpen, onClose, onSave }: EditBookingModalProps) {
    const [name, setName] = useState(booking.customerName);
    const [phone, setPhone] = useState(booking.customerPhone);
    const [groupSize, setGroupSize] = useState(booking.groupSize);
    const [notes, setNotes] = useState(booking.notes || '');
    const [saving, setSaving] = useState(false);

    // Date/time editing
    const originalDate = new Date(booking.appointmentDate._seconds * 1000);
    const originalDateStr = originalDate.toISOString().split('T')[0];
    const originalWeddingDate = new Date(booking.weddingDate._seconds * 1000);
    const originalWeddingDateStr = originalWeddingDate.toISOString().split('T')[0];

    const [appointmentDate, setAppointmentDate] = useState(originalDateStr);
    const [slotTime, setSlotTime] = useState(booking.slotTime);
    const [weddingDate, setWeddingDate] = useState(originalWeddingDateStr);

    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [error, setError] = useState('');

    // Reset when booking changes
    useEffect(() => {
        if (isOpen) {
            setName(booking.customerName);
            setPhone(booking.customerPhone);
            setGroupSize(booking.groupSize);
            setNotes(booking.notes || '');
            const origDate = new Date(booking.appointmentDate._seconds * 1000);
            setAppointmentDate(origDate.toISOString().split('T')[0]);
            setSlotTime(booking.slotTime);
            const origWedding = new Date(booking.weddingDate._seconds * 1000);
            setWeddingDate(origWedding.toISOString().split('T')[0]);
            setError('');
        }
    }, [booking, isOpen]);

    // Fetch available slots when date changes
    useEffect(() => {
        if (!appointmentDate) return;

        const fetchSlots = async () => {
            setLoadingSlots(true);
            try {
                const res = await fetch(`/api/admin/slots?date=${appointmentDate}`);
                const data = await res.json();

                if (data.error) {
                    setAvailableSlots([]);
                } else {
                    // Include current slot if same date, plus available slots
                    let slots = data.slots || [];
                    if (appointmentDate === originalDateStr && !slots.includes(booking.slotTime)) {
                        slots = [booking.slotTime, ...slots];
                    }
                    setAvailableSlots(slots);

                    // Keep current slot if still available or same date
                    if (!slots.includes(slotTime) && slots.length > 0) {
                        setSlotTime(slots[0]);
                    }
                }
            } catch (err) {
                setAvailableSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [appointmentDate, originalDateStr, booking.slotTime]);

    // Get day info for validation
    const getDateInfo = (dateStr: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr + 'T12:00:00');
        const day = date.getDay();
        if (day === 3) return { day: 'Wednesday', isValid: true };
        if (day === 6) return { day: 'Saturday', isValid: true };
        return { day: '', isValid: false };
    };

    const dateInfo = getDateInfo(appointmentDate);
    const isDateChanged = appointmentDate !== originalDateStr;
    const isTimeChanged = slotTime !== booking.slotTime;
    const isRescheduling = isDateChanged || isTimeChanged;

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!dateInfo?.isValid) {
            setError('Please select a Wednesday or Saturday');
            return;
        }

        setSaving(true);
        try {
            const updates: any = {
                customerName: name,
                customerPhone: phone,
                groupSize: Number(groupSize),
                notes: notes,
            };

            // Handle reschedule if date or time changed
            if (isRescheduling) {
                updates.reschedule = {
                    newDate: appointmentDate,
                    newSlotTime: slotTime,
                };
            }

            // Handle wedding date change
            if (weddingDate !== originalWeddingDateStr) {
                updates.weddingDate = weddingDate;
            }

            await onSave(updates);
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save changes');
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
                    <h3 className="font-semibold text-lg text-gray-900">Edit Appointment</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {isRescheduling && (
                        <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-sm">
                            Rescheduling will send an SMS notification to the customer.
                        </div>
                    )}

                    {/* Customer Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            required
                        />
                    </div>

                    {/* Phone & Group Size */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(formatPhone(e.target.value))}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group Size</label>
                            <select
                                value={groupSize}
                                onChange={e => setGroupSize(Number(e.target.value))}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            >
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Appointment Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Appointment Date
                            {isDateChanged && <span className="text-amber-600 ml-2">(changed)</span>}
                        </label>
                        <input
                            type="date"
                            value={appointmentDate}
                            onChange={e => setAppointmentDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                        {appointmentDate && !dateInfo?.isValid && (
                            <p className="text-amber-600 text-sm mt-1">
                                Appointments are only available on Wednesday or Saturday
                            </p>
                        )}
                    </div>

                    {/* Time Slot */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Time
                            {isTimeChanged && <span className="text-amber-600 ml-2">(changed)</span>}
                        </label>
                        {loadingSlots ? (
                            <div className="text-gray-400 py-2">Loading slots...</div>
                        ) : availableSlots.length > 0 ? (
                            <select
                                value={slotTime}
                                onChange={e => setSlotTime(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {availableSlots.map(slot => (
                                    <option key={slot} value={slot}>
                                        {slot}
                                        {slot === booking.slotTime && appointmentDate === originalDateStr ? ' (current)' : ''}
                                    </option>
                                ))}
                            </select>
                        ) : dateInfo?.isValid ? (
                            <div className="text-amber-600 py-2 text-sm">
                                No slots available for this date
                            </div>
                        ) : (
                            <div className="text-gray-400 py-2 text-sm">
                                Select a valid appointment date
                            </div>
                        )}
                    </div>

                    {/* Wedding Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Wedding Date
                            {weddingDate !== originalWeddingDateStr && <span className="text-amber-600 ml-2">(changed)</span>}
                        </label>
                        <input
                            type="date"
                            value={weddingDate}
                            onChange={e => setWeddingDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Internal notes..."
                        />
                    </div>

                    {/* Actions */}
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
                            disabled={saving || (dateInfo?.isValid && availableSlots.length === 0)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : isRescheduling ? 'Save & Reschedule' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
