// Admin Dashboard - Today's Appointments
'use client';

import { useState, useEffect } from 'react';

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

export default function AdminDashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    const fetchTodayBookings = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/admin/bookings?date=${today}`);
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodayBookings();
    }, []);

    const updateBooking = async (bookingId: string, updates: Partial<Booking>) => {
        setUpdating(bookingId);
        try {
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'update', updates }),
            });
            await fetchTodayBookings();
        } catch (error) {
            console.error('Update failed:', error);
        } finally {
            setUpdating(null);
        }
    };

    const cancelBooking = async (bookingId: string) => {
        if (!confirm('Cancel this appointment? The customer will be notified by SMS.')) return;

        setUpdating(bookingId);
        try {
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'cancel' }),
            });
            await fetchTodayBookings();
        } catch (error) {
            console.error('Cancel failed:', error);
        } finally {
            setUpdating(null);
        }
    };

    const formatDate = (timestamp: { _seconds: number }) => {
        return new Date(timestamp._seconds * 1000).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-500">Loading...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                    Today's Appointments
                </h2>
                <span className="text-gray-500">
                    {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}
                </span>
            </div>

            {bookings.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No appointments scheduled for today.
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wedding</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Picked Up</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {bookings.map((booking) => (
                                <tr key={booking.id} className={updating === booking.id ? 'opacity-50' : ''}>
                                    <td className="px-4 py-4 font-medium">{booking.slotTime}</td>
                                    <td className="px-4 py-4">{booking.customerName}</td>
                                    <td className="px-4 py-4 text-sm text-gray-500">{booking.customerPhone}</td>
                                    <td className="px-4 py-4">{booking.groupSize} people</td>
                                    <td className="px-4 py-4 text-sm">{formatDate(booking.weddingDate)}</td>
                                    <td className="px-4 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={booking.gownPickedUp}
                                            onChange={(e) => updateBooking(booking.id, { gownPickedUp: e.target.checked })}
                                            className="w-5 h-5 text-blue-600 rounded"
                                            disabled={updating === booking.id}
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <button
                                            onClick={() => cancelBooking(booking.id)}
                                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            disabled={updating === booking.id}
                                        >
                                            Cancel
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
