// Admin Schedule Settings Page
'use client';

import { useState, useEffect } from 'react';

interface ScheduleConfig {
    wednesday: {
        enabled: boolean;
        slots: string[];
    };
    saturday: {
        enabled: boolean;
        slots: string[];
    };
}

interface BlockedDate {
    id: string;
    dateStr: string;
    date: { _seconds: number };
    reason?: string;
    blockedSlots: string[];
}

export default function SchedulePage() {
    const [config, setConfig] = useState<ScheduleConfig | null>(null);
    const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Block date form
    const [blockDateStr, setBlockDateStr] = useState('');
    const [blockReason, setBlockReason] = useState('');
    const [blockingDate, setBlockingDate] = useState(false);

    useEffect(() => {
        fetchSchedule();
    }, []);

    const fetchSchedule = async () => {
        try {
            const res = await fetch('/api/admin/schedule');
            const data = await res.json();
            setConfig(data.config);
            setBlockedDates(data.blockedDates || []);
        } catch (err) {
            setError('Failed to load schedule');
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        if (!config) return;
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/admin/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateConfig',
                    wednesday: config.wednesday,
                    saturday: config.saturday,
                }),
            });

            if (!res.ok) throw new Error('Failed to save');
            setSuccess('Schedule saved successfully');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to save schedule');
        } finally {
            setSaving(false);
        }
    };

    const handleBlockDate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!blockDateStr) return;

        setBlockingDate(true);
        setError('');

        try {
            const res = await fetch('/api/admin/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'blockDate',
                    date: blockDateStr,
                    reason: blockReason || undefined,
                }),
            });

            if (!res.ok) throw new Error('Failed to block date');

            setBlockDateStr('');
            setBlockReason('');
            await fetchSchedule();
        } catch (err) {
            setError('Failed to block date');
        } finally {
            setBlockingDate(false);
        }
    };

    const handleUnblockDate = async (dateStr: string) => {
        try {
            await fetch('/api/admin/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unblockDate',
                    dateStr,
                }),
            });
            await fetchSchedule();
        } catch (err) {
            setError('Failed to unblock date');
        }
    };

    const updateSlots = (day: 'wednesday' | 'saturday', slots: string[]) => {
        if (!config) return;
        setConfig({
            ...config,
            [day]: { ...config[day], slots },
        });
    };

    const toggleDay = (day: 'wednesday' | 'saturday') => {
        if (!config) return;
        setConfig({
            ...config,
            [day]: { ...config[day], enabled: !config[day].enabled },
        });
    };

    const formatBlockedDate = (date: { _seconds: number }) => {
        return new Date(date._seconds * 1000).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-400">Loading schedule...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Schedule Settings</h2>
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">{error}</div>
            )}

            {success && (
                <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg">{success}</div>
            )}

            {/* Default Slots Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Time Slots</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Configure the available appointment slots for each day. The Vapi phone agent will use these slots when checking availability.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Wednesday */}
                    <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium text-gray-900">Wednesday</h4>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config?.wednesday.enabled}
                                    onChange={() => toggleDay('wednesday')}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-600">Enabled</span>
                            </label>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-600">Slots (one per line)</label>
                            <textarea
                                value={config?.wednesday.slots.join('\n') || ''}
                                onChange={(e) => updateSlots('wednesday', e.target.value.split('\n').filter(s => s.trim()))}
                                disabled={!config?.wednesday.enabled}
                                rows={5}
                                className="w-full px-3 py-2 border rounded-lg text-sm font-mono disabled:bg-gray-50 disabled:text-gray-400"
                                placeholder="11:30 AM&#10;11:45 AM&#10;12:00 PM"
                            />
                        </div>
                    </div>

                    {/* Saturday */}
                    <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium text-gray-900">Saturday (Motzei Shabbos)</h4>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config?.saturday.enabled}
                                    onChange={() => toggleDay('saturday')}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-600">Enabled</span>
                            </label>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-600">Slots (one per line)</label>
                            <textarea
                                value={config?.saturday.slots.join('\n') || ''}
                                onChange={(e) => updateSlots('saturday', e.target.value.split('\n').filter(s => s.trim()))}
                                disabled={!config?.saturday.enabled}
                                rows={5}
                                className="w-full px-3 py-2 border rounded-lg text-sm font-mono disabled:bg-gray-50 disabled:text-gray-400"
                                placeholder="7:30 PM&#10;7:45 PM&#10;8:00 PM"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Block Dates */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Blocked Dates</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Block specific dates when you're unavailable. Blocked dates will show as unavailable to the phone agent and won't allow new bookings.
                </p>

                {/* Add Block Date Form */}
                <form onSubmit={handleBlockDate} className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Date to Block</label>
                        <input
                            type="date"
                            value={blockDateStr}
                            onChange={(e) => setBlockDateStr(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="px-3 py-2 border rounded-lg"
                            required
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
                        <input
                            type="text"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="e.g., Holiday, Vacation"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="submit"
                            disabled={blockingDate || !blockDateStr}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        >
                            {blockingDate ? 'Blocking...' : 'Block Date'}
                        </button>
                    </div>
                </form>

                {/* List of Blocked Dates */}
                {blockedDates.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No blocked dates</p>
                ) : (
                    <div className="space-y-2">
                        {blockedDates.map((blocked) => (
                            <div
                                key={blocked.id}
                                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                            >
                                <div>
                                    <span className="font-medium text-red-800">
                                        {formatBlockedDate(blocked.date)}
                                    </span>
                                    {blocked.reason && (
                                        <span className="text-red-600 ml-2">— {blocked.reason}</span>
                                    )}
                                    {blocked.blockedSlots.length > 0 && (
                                        <span className="text-red-500 text-sm ml-2">
                                            (Slots: {blocked.blockedSlots.join(', ')})
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleUnblockDate(blocked.dateStr)}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                    Unblock
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
