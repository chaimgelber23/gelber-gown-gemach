// Admin Dashboard - Upcoming Appointments
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

interface UpcomingDay {
    date: string;
    dayLabel: string;
    bookings: Booking[];
}

interface GownStats {
    totalGownsTakenOut: number;
    currentlyOut: number;
}

export default function AdminDashboard() {
    const [upcomingDays, setUpcomingDays] = useState<UpcomingDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [stats, setStats] = useState<GownStats>({ totalGownsTakenOut: 0, currentlyOut: 0 });
    const [statsLoading, setStatsLoading] = useState(true);

    const fetchUpcomingBookings = async () => {
        try {
            const res = await fetch('/api/admin/bookings?upcoming=true');
            const data = await res.json();
            setUpcomingDays(data.upcoming || []);
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/bookings?stats=true');
            const data = await res.json();
            setStats({
                totalGownsTakenOut: data.totalGownsTakenOut || 0,
                currentlyOut: data.currentlyOut || 0
            });
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        fetchUpcomingBookings();
        fetchStats();
    }, []);

    const updateBooking = async (bookingId: string, updates: Partial<Booking>) => {
        setUpdating(bookingId);
        try {
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'update', updates }),
            });
            await fetchUpcomingBookings();
            await fetchStats();
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
            await fetchUpcomingBookings();
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

    const formatDayDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const isToday = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-500">Loading...</div>;
    }

    const totalBookings = upcomingDays.reduce((sum, day) => sum + day.bookings.length, 0);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                    Upcoming Appointments
                </h2>
                <span className="text-gray-500">
                    {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}
                </span>
            </div>

            {/* Gown Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase">Total Gowns Taken Out</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                {statsLoading ? '...' : stats.totalGownsTakenOut}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase">Currently Out</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                {statsLoading ? '...' : stats.currentlyOut}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {totalBookings === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No upcoming appointments scheduled.
                </div>
            ) : (
                <div className="space-y-6">
                    {upcomingDays.map((day) => (
                        <div key={day.date} className="bg-white rounded-lg shadow overflow-hidden">
                            <div className={`px-4 py-3 border-b ${isToday(day.date) ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-gray-800">
                                            {day.dayLabel}
                                        </h3>
                                        <span className="text-gray-500">
                                            {formatDayDate(day.date)}
                                        </span>
                                        {isToday(day.date) && (
                                            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                                Today
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm text-gray-500">
                                        {day.bookings.length} appointment{day.bookings.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            {day.bookings.length === 0 ? (
                                <div className="px-4 py-6 text-center text-gray-400">
                                    No appointments scheduled
                                </div>
                            ) : (
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
                                        {day.bookings.map((booking) => (
                                            <tr key={booking.id} className={updating === booking.id ? 'opacity-50' : ''}>
                                                <td className="px-4 py-4 font-medium">{booking.slotTime}</td>
                                                <td className="px-4 py-4">{booking.customerName}</td>
                                                <td className="px-4 py-4 text-sm text-gray-500">
                                                    <a href={`tel:${booking.customerPhone}`} className="hover:text-blue-600">
                                                        {booking.customerPhone}
                                                    </a>
                                                </td>
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
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
