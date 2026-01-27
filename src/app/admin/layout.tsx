// Admin Dashboard Layout
'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        // Check if already authenticated
        const auth = sessionStorage.getItem('admin_auth');
        if (auth === 'true') {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                sessionStorage.setItem('admin_auth', 'true');
                setIsAuthenticated(true);
            } else {
                setError('Invalid password');
            }
        } catch {
            setError('Login failed');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                            Gelber Gown Gemach
                        </h1>
                        <p className="text-gray-500">Admin Dashboard</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="space-y-4">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400 transition-all"
                                autoFocus
                            />
                            {error && (
                                <p className="text-red-500 text-sm text-center">{error}</p>
                            )}
                            <button
                                type="submit"
                                className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                            >
                                Enter Dashboard
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    const navItems = [
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/calendar', label: 'Calendar' },
        { href: '/admin/board', label: 'Board' },
        { href: '/admin/bookings', label: 'All Bookings' },
        { href: '/admin/outstanding', label: 'Outstanding' },
        { href: '/admin/schedule', label: 'Schedule' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo & Brand */}
                        <div className="flex items-center gap-8">
                            <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                                Gelber Gown Gemach
                            </h1>

                            {/* Desktop Nav */}
                            <nav className="hidden md:flex space-x-1">
                                {navItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                                                    ? 'bg-gray-100 text-gray-900'
                                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                                }`}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-4">
                            {/* Search Placeholder - wired up later */}
                            <div className="relative hidden sm:block">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="block w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-300 sm:text-sm transition-all"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    sessionStorage.removeItem('admin_auth');
                                    setIsAuthenticated(false);
                                }}
                                className="text-sm text-gray-500 hover:text-gray-900 font-medium"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
