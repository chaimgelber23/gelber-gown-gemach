// Admin Dashboard - All Bookings with Search/Filter
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

export default function AllBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [editingNotes, setEditingNotes] = useState<string | null>(null);
    const [notesValue, setNotesValue] = useState('');

    const fetchBookings = async () => {
        try {
            let url = '/api/admin/bookings?';
            if (statusFilter !== 'all') url += `status=${statusFilter}&`;

            const res = await fetch(url);
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [statusFilter]);

    const updateBooking = async (bookingId: string, updates: Partial<Booking>) => {
        setUpdating(bookingId);
        try {
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'update', updates }),
            });
            await fetchBookings();
        } finally {
            setUpdating(null);
        }
    };

    const saveNotes = async (bookingId: string) => {
        await updateBooking(bookingId, { notes: notesValue } as any);
        setEditingNotes(null);
    };

    const formatDate = (timestamp: { _seconds: number }) => {
        return new Date(timestamp._seconds * 1000).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const filteredBookings = bookings.filter((b) => {
        if (!search) return true;
        const term = search.toLowerCase();
        return (
            b.customerName.toLowerCase().includes(term) ||
            b.customerPhone.includes(term)
        );
    });

    if (loading) {
        return <div className="text-center py-12 text-gray-500">Loading...</div>;
    }

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 All Bookings</h2>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
                <input
                    type="text"
                    placeholder="Search name or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-4 py-2 border rounded-lg flex-1 min-w-[200px]"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Picked</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Returned</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paid</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredBookings.map((booking) => (
                            <tr key={booking.id} className={updating === booking.id ? 'opacity-50' : ''}>
                                <td className="px-3 py-3">{formatDate(booking.appointmentDate)}</td>
                                <td className="px-3 py-3">{booking.slotTime}</td>
                                <td className="px-3 py-3 font-medium">{booking.customerName}</td>
                                <td className="px-3 py-3 text-gray-500">{booking.customerPhone}</td>
                                <td className="px-3 py-3 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-700'
                                        }`}>
                                        {booking.status}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={booking.gownPickedUp}
                                        onChange={(e) => updateBooking(booking.id, { gownPickedUp: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={booking.gownReturned}
                                        onChange={(e) => updateBooking(booking.id, { gownReturned: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        checked={booking.donationPaid}
                                        onChange={(e) => updateBooking(booking.id, { donationPaid: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </td>
                                <td className="px-3 py-3">
                                    {editingNotes === booking.id ? (
                                        <div className="flex gap-1">
                                            <input
                                                type="text"
                                                value={notesValue}
                                                onChange={(e) => setNotesValue(e.target.value)}
                                                className="px-2 py-1 border rounded text-xs w-32"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => saveNotes(booking.id)}
                                                className="text-blue-600 text-xs"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingNotes(booking.id);
                                                setNotesValue(booking.notes || '');
                                            }}
                                            className="text-gray-400 hover:text-gray-600 text-xs"
                                        >
                                            {booking.notes || '+ Add note'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredBookings.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No bookings found</div>
                )}
            </div>
        </div>
    );
}
