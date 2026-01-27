// Admin Calendar View
'use client';

import { useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import EditBookingModal from '@/components/admin/EditBookingModal';
import AddBookingModal from '@/components/admin/AddBookingModal';

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

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [preselectedDate, setPreselectedDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            const res = await fetch('/api/admin/bookings');
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch bookings', error);
        } finally {
            setLoading(false);
        }
    };

    const updateBooking = async (bookingId: string, updates: Partial<Booking>) => {
        try {
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, action: 'update', updates }),
            });
            await fetchBookings();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveEdit = async (updates: Partial<Booking> & { reschedule?: { newDate: string; newSlotTime: string }; weddingDate?: string }) => {
        if (!editingBooking) return;

        // Handle reschedule separately
        if (updates.reschedule) {
            const { newDate, newSlotTime } = updates.reschedule;
            await fetch('/api/admin/bookings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: editingBooking.id,
                    action: 'reschedule',
                    newDate: newDate,
                    newSlotTime: newSlotTime,
                }),
            });
        }

        // Handle regular updates (excluding reschedule data)
        const { reschedule, weddingDate, ...regularUpdates } = updates;

        // If wedding date changed, include it in updates
        if (weddingDate) {
            (regularUpdates as any).weddingDate = new Date(weddingDate + 'T12:00:00');
        }

        if (Object.keys(regularUpdates).length > 0) {
            await updateBooking(editingBooking.id, regularUpdates);
        }

        await fetchBookings();
        setEditingBooking(null);
    };

    // Calendar Grid Logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const getBookingsForDay = (date: Date) => {
        return bookings.filter(b => {
            const bookingDate = new Date(b.appointmentDate._seconds * 1000);
            return isSameDay(date, bookingDate) && b.status !== 'cancelled';
        });
    };

    if (loading) return <div className="text-center py-12 text-gray-400">Loading calendar...</div>;

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <button
                        onClick={() => {
                            setPreselectedDate(undefined);
                            setShowAddModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium"
                    >
                        <span className="text-lg leading-none">+</span> New Appointment
                    </button>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    >
                        ← Prev
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-4 py-2 hover:bg-gray-100 rounded-lg text-gray-900 font-medium"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
                {/* Week Headers */}
                <div className="grid grid-cols-7 border-b border-gray-200">
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-sm font-semibold text-gray-500 bg-gray-50 border-r last:border-r-0 border-gray-100">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {calendarDays.map((day) => {
                        const dayBookings = getBookingsForDay(day);
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const dayOfWeek = day.getDay();
                        const isAppointmentDay = dayOfWeek === 3 || dayOfWeek === 6; // Wed or Sat
                        const isFutureOrToday = day >= new Date(new Date().setHours(0, 0, 0, 0));

                        return (
                            <div
                                key={day.toString()}
                                className={`
                                    min-h-[120px] p-2 border-b border-r last:border-r-0 border-gray-100 relative group
                                    ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-400' : 'bg-white'}
                                    ${isToday(day) ? 'bg-blue-50/30' : ''}
                                    ${isAppointmentDay && isCurrentMonth ? 'bg-green-50/20' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`text-sm font-medium ${isToday(day) ? 'text-blue-600' : 'text-gray-700'}`}>
                                        {format(day, 'd')}
                                    </div>
                                    {isAppointmentDay && isFutureOrToday && isCurrentMonth && (
                                        <button
                                            onClick={() => {
                                                setPreselectedDate(day);
                                                setShowAddModal(true);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 w-6 h-6 bg-blue-600 text-white rounded-full text-sm flex items-center justify-center hover:bg-blue-700 transition-all"
                                            title="Add appointment"
                                        >
                                            +
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    {dayBookings.map(booking => (
                                        <button
                                            key={booking.id}
                                            onClick={() => setEditingBooking(booking)}
                                            className={`
                                                w-full text-left text-xs px-2 py-1 rounded border
                                                truncate transition-all hover:shadow-sm
                                                ${booking.gownPickedUp
                                                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'}
                                            `}
                                        >
                                            <span className="font-semibold">{booking.slotTime}</span> {booking.customerName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
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

            {/* Add Modal */}
            <AddBookingModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={() => {
                    fetchBookings();
                    setShowAddModal(false);
                }}
                preselectedDate={preselectedDate}
            />
        </div>
    );
}
