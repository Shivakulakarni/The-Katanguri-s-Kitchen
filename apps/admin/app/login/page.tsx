'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '../../lib/auth-store';

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAdminAuthStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1f2f6', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{String.fromCodePoint(0x1F373)}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Admin Dashboard</h1>
          <p style={{ color: '#999', fontSize: 14 }}>Sign in to manage your kitchen</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#57606f', marginBottom: 6, display: 'block' }}>Email</label>
          <input placeholder="admin@kitchen.app" type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '2px solid #e4e7eb', fontSize: 15 }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#57606f', marginBottom: 6, display: 'block' }}>Password</label>
          <input placeholder="********" type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '2px solid #e4e7eb', fontSize: 15 }} />
        </div>

        {error && <p style={{ color: '#ff4757', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

        <button onClick={handleLogin} disabled={loading || !email || !password}
          style={{
            width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 700, color: '#fff',
            background: email && password ? '#ff4757' : '#ccc', border: 'none', borderRadius: 10,
            cursor: email && password ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>
          {loading ? '...' : 'Sign In'}
        </button>


      </div>
    </div>
  );
}
