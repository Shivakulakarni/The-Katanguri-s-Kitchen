'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '../../lib/auth-store';
import { supabase } from '../../lib/supabase';

type Step = 'choose' | 'email-otp' | 'otp-verify';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth, user, isLoading } = useAdminAuthStore();
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setOtpSent] = useState(false);
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
      options: { redirectTo: `${window.location.origin}/admin/auth/callback` },
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
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); setLoading(false); return; }
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
      if (!res.ok) { setError(data.error || 'Invalid OTP'); setLoading(false); return; }
      if (data.user?.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }
      setAuth(data.user, data.accessToken || data.token, data.refreshToken);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Left panel — brand */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: 60, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 50%, rgba(255,71,87,0.08) 0%, transparent 60%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 420 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #ff4757, #c62828)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px',
            boxShadow: '0 8px 32px rgba(255,71,87,0.3)',
          }}>
            <span style={{ fontSize: 36 }}>🍳</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.5px' }}>
            The Katanguri&apos;s Kitchen
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1.6 }}>
            Admin dashboard for managing orders, menu,<br />deliveries, and analytics.
          </p>
          <div style={{
            display: 'flex', gap: 32, marginTop: 48, justifyContent: 'center',
          }}>
            {[
              { label: 'Orders', value: 'Live' },
              { label: 'Menu', value: '74+' },
              { label: 'Uptime', value: '99.9%' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ color: '#ff4757', fontSize: 20, fontWeight: 700 }}>{s.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        width: 480, background: '#fff', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 56px', position: 'relative',
        borderRadius: '24px 0 0 24px',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ maxWidth: 340, width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111', marginBottom: 6, letterSpacing: '-0.3px' }}>
              {step === 'choose' ? 'Welcome back' : step === 'email-otp' ? 'Enter your email' : 'Check your inbox'}
            </h2>
            <p style={{ color: '#888', fontSize: 15, lineHeight: 1.5 }}>
              {step === 'choose'
                ? 'Sign in to access the admin dashboard'
                : step === 'email-otp'
                ? 'We\'ll send you a one-time code'
                : <>Enter the 6-digit code sent to <strong style={{ color: '#333' }}>{email}</strong></>
              }
            </p>
          </div>

          {step === 'choose' && (
            <>
              <button onClick={handleGoogleLogin} disabled={loading || !supabase}
                style={{
                  width: '100%', padding: '13px 0', fontSize: 14, fontWeight: 600, color: '#333',
                  background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 12,
                  cursor: supabase ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#bbb'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#eee' }} />
                <span style={{ fontSize: 12, color: '#bbb', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#eee' }} />
              </div>

              <button onClick={() => setStep('email-otp')}
                style={{
                  width: '100%', padding: '13px 0', fontSize: 14, fontWeight: 600, color: '#fff',
                  background: 'linear-gradient(135deg, #ff4757, #c62828)', border: 'none', borderRadius: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 4px 16px rgba(255,71,87,0.25)',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(255,71,87,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,71,87,0.25)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Sign in with Email OTP
              </button>
            </>
          )}

          {step === 'email-otp' && (
            <>
              <button onClick={() => { setStep('choose'); setEmail(''); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 24, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back
              </button>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <input placeholder="you@company.com" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOTP()} autoFocus
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e0e0e0',
                    fontSize: 15, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#ff4757'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              </div>
              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>
                </div>
              )}
              <button onClick={handleSendOTP} disabled={loading || !email}
                style={{
                  width: '100%', padding: '13px 0', fontSize: 14, fontWeight: 700, color: '#fff',
                  background: email ? 'linear-gradient(135deg, #ff4757, #c62828)' : '#ddd',
                  border: 'none', borderRadius: 12,
                  cursor: email ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  boxShadow: email ? '0 4px 16px rgba(255,71,87,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}>
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </>
          )}

          {step === 'otp-verify' && (
            <>
              <button onClick={() => { setStep('email-otp'); setOtp(''); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 24, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back
              </button>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <input placeholder="000000" type="text" inputMode="numeric" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()} autoFocus
                  style={{
                    width: '100%', padding: '16px', borderRadius: 12, border: '1.5px solid #e0e0e0',
                    fontSize: 28, letterSpacing: 10, textAlign: 'center', outline: 'none',
                    fontFamily: '"SF Mono", "Fira Code", monospace', boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#ff4757'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e0e0e0'}
                />
              </div>
              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>
                </div>
              )}
              <button onClick={handleVerifyOTP} disabled={loading || otp.length !== 6}
                style={{
                  width: '100%', padding: '13px 0', fontSize: 14, fontWeight: 700, color: '#fff',
                  background: otp.length === 6 ? 'linear-gradient(135deg, #ff4757, #c62828)' : '#ddd',
                  border: 'none', borderRadius: 12,
                  cursor: otp.length === 6 ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  boxShadow: otp.length === 6 ? '0 4px 16px rgba(255,71,87,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button onClick={handleSendOTP} disabled={countdown > 0 || loading}
                style={{
                  width: '100%', padding: '12px 0', fontSize: 13, fontWeight: 500,
                  color: countdown > 0 ? '#ccc' : '#ff4757', background: 'none', border: 'none',
                  cursor: countdown > 0 ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 12,
                }}>
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
              </button>
            </>
          )}

          <p style={{ fontSize: 12, color: '#ccc', textAlign: 'center', marginTop: 40, lineHeight: 1.5 }}>
            Protected by industry-standard encryption.<br />
            By signing in, you agree to the admin access policy.
          </p>
        </div>
      </div>
    </div>
  );
}
