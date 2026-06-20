'use client';

export default function AiKitchenPage() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1c1c1c', marginBottom: 8 }}>
        Ai-kitchen — Coming Soon
      </h1>
      <p style={{ fontSize: 15, color: '#888', maxWidth: 400, marginBottom: 24 }}>
        We&apos;re working on something exciting. Check back soon!
      </p>
      <a href="/menu" style={{ background: '#e23744', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
        Browse Menu
      </a>
    </div>
  );
}

