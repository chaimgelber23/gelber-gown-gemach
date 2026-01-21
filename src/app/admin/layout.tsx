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
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
                    <h1 className="text-2xl font-bold text-center mb-6">
                        👗 Gelber Gown Gemach
                    </h1>
                    <h2 className="text-lg text-gray-600 text-center mb-6">Admin Dashboard</h2>

                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter admin password"
                            className="w-full px-4 py-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        {error && (
                            <p className="text-red-500 text-sm mb-4">{error}</p>
                        )}
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const navItems = [
        { href: '/admin', label: 'Today', icon: '📅' },
        { href: '/admin/bookings', label: 'All Bookings', icon: '📋' },
        { href: '/admin/outstanding', label: 'Outstanding', icon: '👗' },
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-800">
                        👗 Gelber Gown Gemach Admin
                    </h1>
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('admin_auth');
                            setIsAuthenticated(false);
                        }}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Navigation */}
            <nav className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex space-x-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition ${pathname === item.href
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {item.icon} {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}
