// Admin Authentication API
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            console.error('ADMIN_PASSWORD not configured');
            return NextResponse.json({ error: 'Server error' }, { status: 500 });
        }

        if (password === adminPassword) {
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
