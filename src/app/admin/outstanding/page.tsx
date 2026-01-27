// Admin Dashboard - Outstanding Gowns (not returned)
'use client';

import { useState, useEffect } from 'react';

interface Booking {
    id: string;
    customerName: string;
    customerPhone: string;
    appointmentDate: { _seconds: number };
    weddingDate: { _seconds: number };
    gownPickedUp: boolean;
    gownReturned: boolean;
    donationPaid: boolean;
}

export default function OutstandingPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    const fetchOutstanding = async () => {
        try {
            const res = await fetch('/api/admin/bookings?outstanding=true');
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOutstanding();
    }, []);

    const updateBooking = async (bookingId: string, updates: Partial<Booking>) => {
        setUpdating(bookingId);
        try {
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'update', updates }),
            });
            await fetchOutstanding();
        } finally {
            setUpdating(null);
        }
    };

    const formatDate = (timestamp: { _seconds: number }) => {
        return new Date(timestamp._seconds * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const daysSinceWedding = (timestamp: { _seconds: number }) => {
        const wedding = new Date(timestamp._seconds * 1000);
        const today = new Date();
        const diff = Math.floor((today.getTime() - wedding.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-500">Loading...</div>;
    }

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Outstanding Gowns ({bookings.length})
            </h2>

            {bookings.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    All gowns have been returned!
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wedding</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Out</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Returned</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paid</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {bookings.map((booking) => {
                                const days = daysSinceWedding(booking.weddingDate);
                                return (
                                    <tr key={booking.id} className={updating === booking.id ? 'opacity-50' : ''}>
                                        <td className="px-4 py-4 font-medium">{booking.customerName}</td>
                                        <td className="px-4 py-4 text-gray-500">
                                            <a href={`tel:${booking.customerPhone}`} className="hover:text-blue-600">
                                                {booking.customerPhone}
                                            </a>
                                        </td>
                                        <td className="px-4 py-4">{formatDate(booking.weddingDate)}</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${days > 7 ? 'bg-red-100 text-red-700' :
                                                    days > 3 ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {days} days
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={booking.gownReturned}
                                                onChange={(e) => updateBooking(booking.id, { gownReturned: e.target.checked })}
                                                className="w-5 h-5 text-green-600 rounded"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={booking.donationPaid}
                                                onChange={(e) => updateBooking(booking.id, { donationPaid: e.target.checked })}
                                                className="w-5 h-5 text-green-600 rounded"
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
