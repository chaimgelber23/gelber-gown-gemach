// Admin Dashboard - All Bookings with Search/Filter
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

export default function AllBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Edit Modal State
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

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

    const handleSaveEdit = async (updates: Partial<Booking>) => {
        if (!editingBooking) return;
        await updateBooking(editingBooking.id, updates);
        setEditingBooking(null);
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

    const FilterButton = ({ label, value }: { label: string, value: string }) => (
        <button
            onClick={() => setStatusFilter(value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${statusFilter === value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
        >
            {label}
        </button>
    );

    if (loading) {
        return <div className="text-center py-12 text-gray-400">Loading...</div>;
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h2 className="text-2xl font-bold text-gray-900">All Bookings</h2>

                {/* Control Bar */}
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg min-w-[200px] focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
                <FilterButton label="All" value="all" />
                <FilterButton label="Confirmed" value="confirmed" />
                <FilterButton label="Cancelled" value="cancelled" />
                <FilterButton label="Completed" value="completed" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-900">Date/Time</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Customer</th>
                                <th className="px-6 py-4 font-semibold text-gray-900 text-center">Group</th>
                                <th className="px-6 py-4 font-semibold text-gray-900 text-center">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-900 text-center">Progress</th>
                                <th className="px-6 py-4 font-semibold text-gray-900">Notes</th>
                                <th className="px-6 py-4 font-semibold text-gray-900 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredBookings.map((booking) => (
                                <tr key={booking.id} className={`hover:bg-gray-50/50 transition-colors ${updating === booking.id ? 'opacity-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{formatDate(booking.appointmentDate)}</div>
                                        <div className="text-gray-500">{booking.slotTime}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{booking.customerName}</div>
                                        <a href={`tel:${booking.customerPhone}`} className="text-gray-500 hover:text-blue-600 transition-colors">
                                            {booking.customerPhone}
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-600">
                                        {booking.groupSize}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <label className="flex flex-col items-center gap-1 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={booking.gownPickedUp}
                                                    onChange={(e) => updateBooking(booking.id, { gownPickedUp: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                />
                                                <span className="text-[10px] text-gray-400 group-hover:text-gray-600">Picked</span>
                                            </label>
                                            <div className="w-px h-8 bg-gray-200 mx-1"></div>
                                            <label className="flex flex-col items-center gap-1 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={booking.gownReturned}
                                                    onChange={(e) => updateBooking(booking.id, { gownReturned: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                />
                                                <span className="text-[10px] text-gray-400 group-hover:text-gray-600">Returned</span>
                                            </label>
                                            <div className="w-px h-8 bg-gray-200 mx-1"></div>
                                            <label className="flex flex-col items-center gap-1 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={booking.donationPaid}
                                                    onChange={(e) => updateBooking(booking.id, { donationPaid: e.target.checked })}
                                                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                                                />
                                                <span className="text-[10px] text-gray-400 group-hover:text-gray-600">Paid</span>
                                            </label>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-[200px]">
                                        <div className="text-gray-600 truncate" title={booking.notes}>
                                            {booking.notes || <span className="text-gray-300 italic">No notes</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setEditingBooking(booking)}
                                            className="text-blue-600 hover:text-blue-900 font-medium text-sm transition-colors"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredBookings.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-gray-400 mb-2">No bookings found</div>
                        <p className="text-sm text-gray-500">Try adjusting your filters</p>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
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
