// Simple test page - no client-side JS
export default function AdminTestPage() {
    return (
        <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
            <h1>✅ Admin Route Works!</h1>
            <p>If you see this, the /admin route is working correctly.</p>
            <p>Time: {new Date().toISOString()}</p>
            <a href="/admin" style={{ color: 'blue' }}>Go to Admin Dashboard →</a>
        </div>
    );
}
