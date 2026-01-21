// Admin Kanban Board
'use client';

import { useState, useEffect } from 'react';
import EditBookingModal from '@/components/admin/EditBookingModal';

interface Booking {
    id: string;
    customerName: string;
    customerPhone: string;
    appointmentDate: { _seconds: number };
    slotTime: string;
    groupSize: number;
    weddingDate: { _seconds: number };
    status: string;
    gownPickedUp: boolean;
    gownReturned: boolean;
    donationPaid: boolean;
    notes?: string;
}

export default function KanbanBoardPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            const res = await fetch('/api/admin/bookings');
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const updateBooking = async (bookingId: string, updates: Partial<Booking>) => {
        // Optimistic update
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b));

        try {
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'update', updates }),
            });
            // Re-fetch to ensure consistency or rely on optimistic
            fetchBookings();
        } catch (err) {
            console.error(err);
            // Revert on error would be ideal here
        }
    };

    const handleSaveEdit = async (updates: Partial<Booking>) => {
        if (!editingBooking) return;
        await updateBooking(editingBooking.id, updates);
        setEditingBooking(null);
    };

    const formatDate = (seconds: number) => {
        return new Date(seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Columns Logic
    const columns = [
        {
            id: 'upcoming',
            title: 'Upcoming',
            color: 'bg-blue-50 border-blue-100',
            textColor: 'text-blue-800',
            filter: (b: Booking) => b.status === 'confirmed' && !b.gownPickedUp && !b.gownReturned,
        },
        {
            id: 'out',
            title: 'Gowns Out',
            color: 'bg-purple-50 border-purple-100',
            textColor: 'text-purple-800',
            filter: (b: Booking) => b.status === 'confirmed' && b.gownPickedUp && !b.gownReturned,
        },
        {
            id: 'returned',
            title: 'Returned (Unpaid)',
            color: 'bg-amber-50 border-amber-100',
            textColor: 'text-amber-800',
            filter: (b: Booking) => (b.status === 'confirmed' || b.status === 'completed') && b.gownReturned && !b.donationPaid,
        },
        {
            id: 'done',
            title: 'Completed',
            color: 'bg-green-50 border-green-100',
            textColor: 'text-green-800',
            filter: (b: Booking) => b.donationPaid,
        }
    ];

    if (loading) return <div className="text-center py-12 text-gray-400">Loading board...</div>;

    return (
        <div className="h-full overflow-x-auto pb-4">
            <div className="flex gap-6 min-w-[1000px] h-[calc(100vh-140px)]">
                {columns.map(col => {
                    const colBookings = bookings.filter(col.filter).sort((a, b) => a.appointmentDate._seconds - b.appointmentDate._seconds);

                    return (
                        <div key={col.id} className="flex-1 flex flex-col bg-gray-50 rounded-xl border border-gray-200">
                            <div className={`p-4 border-b ${col.color.replace('bg-', 'border-')} flex justify-between items-center rounded-t-xl`}>
                                <h3 className={`font-bold ${col.textColor}`}>{col.title}</h3>
                                <span className={`px-2 py-0.5 bg-white rounded-full text-xs font-bold border shadow-sm ${col.textColor}`}>
                                    {colBookings.length}
                                </span>
                            </div>

                            <div className="p-3 space-y-3 overflow-y-auto flex-1">
                                {colBookings.map(booking => (
                                    <div key={booking.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-semibold text-gray-900">{booking.customerName}</div>
                                                <div className="text-xs text-gray-500">{formatDate(booking.appointmentDate._seconds)} • {booking.slotTime}</div>
                                            </div>
                                            <button
                                                onClick={() => setEditingBooking(booking)}
                                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                                            >
                                                ✏️
                                            </button>
                                        </div>

                                        <div className="space-y-2 mt-3 pt-3 border-t border-gray-50">
                                            {/* Action Buttons based on state */}
                                            {col.id === 'upcoming' && (
                                                <button
                                                    onClick={() => updateBooking(booking.id, { gownPickedUp: true })}
                                                    className="w-full py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
                                                >
                                                    Mark Picked Up →
                                                </button>
                                            )}
                                            {col.id === 'out' && (
                                                <button
                                                    onClick={() => updateBooking(booking.id, { gownReturned: true })}
                                                    className="w-full py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition"
                                                >
                                                    Mark Returned →
                                                </button>
                                            )}
                                            {col.id === 'returned' && (
                                                <button
                                                    onClick={() => updateBooking(booking.id, { donationPaid: true })}
                                                    className="w-full py-1.5 bg-amber-500 text-white text-xs font-medium rounded hover:bg-amber-600 transition"
                                                >
                                                    Mark Paid →
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {colBookings.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm italic">
                                        No items
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingBooking && (
                <EditBookingModal
                    booking={editingBooking}
                    isOpen={!!editingBooking}
                    onClose={() => setEditingBooking(null)}
                    onSave={handleSaveEdit}
                />
            )}
        </div>
    );
}
