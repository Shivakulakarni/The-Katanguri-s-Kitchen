'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '../../lib/auth-store';
import { supabase } from '../../lib/supabase';

type Step = 'choose' | 'email-otp' | 'otp-verify';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, setAuth, user, isLoading } = useAdminAuthStore();
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!isLoading && user) router.push('/');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError('Google Sign-In not configured');
      return;
    }
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        setLoading(false);
        return;
      }
      setOtpSent(true);
      setStep('otp-verify');
      setCountdown(60);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!email || !otp) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/email-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid OTP');
        setLoading(false);
        return;
      }
      if (data.user?.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }
      setAuth(data.user, data.accessToken || data.token);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo-kitchen.png" alt="Logo" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e4e7eb', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1c1c1c', marginBottom: 4 }}>Welcome back</h1>
          <p style={{ color: '#888', fontSize: 14 }}>Sign in to the admin dashboard</p>
        </div>

        {step === 'choose' && (
          <>
            <button onClick={handleGoogleLogin} disabled={loading || !supabase}
              style={{
                width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 600, color: '#1c1c1c',
                background: '#fff', border: '2px solid #e4e7eb', borderRadius: 12,
                cursor: supabase ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                transition: 'all 0.2s ease', marginBottom: 16,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#d0d7de'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e4e7eb' }} />
              <span style={{ fontSize: 13, color: '#aaa', fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#e4e7eb' }} />
            </div>

            <button onClick={() => setStep('email-otp')}
              style={{
                width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 600, color: '#fff',
                background: '#ff4757', border: 'none', borderRadius: 12,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e8384f'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,71,87,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ff4757'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              Sign in with Email OTP
            </button>
          </>
        )}

        {step === 'email-otp' && (
          <>
            <button onClick={() => { setStep('choose'); setEmail(''); setError(''); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 20, fontFamily: 'inherit' }}>
              ← Back
            </button>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#57606f', marginBottom: 6, display: 'block' }}>Email address</label>
            <input placeholder="you@company.com" type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
              autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #e4e7eb', fontSize: 15, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            {error && <p style={{ color: '#ff4757', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>}
            <button onClick={handleSendOTP} disabled={loading || !email}
              style={{
                width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, color: '#fff',
                background: email ? '#ff4757' : '#ccc', border: 'none', borderRadius: 12,
                cursor: email ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginTop: 20,
                transition: 'all 0.2s ease',
              }}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        )}

        {step === 'otp-verify' && (
          <>
            <button onClick={() => { setStep('email-otp'); setOtp(''); setError(''); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 20, fontFamily: 'inherit' }}>
              ← Back
            </button>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 16 }}>Enter the 6-digit code sent to <strong>{email}</strong></p>
            <input placeholder="000000" type="text" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #e4e7eb', fontSize: 24, letterSpacing: 8, textAlign: 'center', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
            {error && <p style={{ color: '#ff4757', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>}
            <button onClick={handleVerifyOTP} disabled={loading || otp.length !== 6}
              style={{
                width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, color: '#fff',
                background: otp.length === 6 ? '#ff4757' : '#ccc', border: 'none', borderRadius: 12,
                cursor: otp.length === 6 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginTop: 20,
                transition: 'all 0.2s ease',
              }}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button onClick={handleSendOTP} disabled={countdown > 0 || loading}
              style={{
                width: '100%', padding: '12px 0', fontSize: 13, fontWeight: 600,
                color: countdown > 0 ? '#aaa' : '#ff4757', background: 'none', border: 'none',
                cursor: countdown > 0 ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 12,
              }}>
              {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
