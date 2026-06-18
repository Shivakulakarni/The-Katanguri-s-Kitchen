'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import ThemeToggle from '../lib/theme-toggle';
import { trackEvent } from '../lib/analytics';

type LoginMethod = 'phone' | 'email';
type OtpStatus = 'idle' | 'sent' | 'expired' | 'verified';

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') ?? null;
  const authError = searchParams?.get('error') ?? null;
  const { user, setAuth } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_ATTEMPTS = 5;

  useEffect(() => {
    if (mode === 'signup') setIsLogin(false);
    else if (mode === 'login') setIsLogin(true);
  }, [mode]);

  useEffect(() => {
    if (authError && authError !== 'undefined') {
      setError(`Authentication error: ${authError}`);
    }
  }, [authError]);

  useEffect(() => {
    if (user) {
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect') || '/';
      router.push(redirectTo);
    }
  }, [user, router]);

  // Cooldown timer after too many attempts
  useEffect(() => {
    if (cooldown > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [cooldown]);

  // OTP expiry timer (5 minutes)
  useEffect(() => {
    if (otpStatus === 'sent') {
      const expiryTimer = setTimeout(() => {
        setOtpStatus('expired');
        setError('OTP has expired. Please request a new one.');
      }, 300000); // 5 minutes
      return () => clearTimeout(expiryTimer);
    }
  }, [otpStatus]);

  const resetForm = useCallback(() => {
    setOtpStatus('idle');
    setOtp('');
    setDevOtp('');
    setError('');
    setSuccess('');
    setAttempts(0);
    setCooldown(0);
  }, []);

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');

    if (cooldown > 0) {
      setError(`Please wait ${cooldown}s before requesting another OTP`);
      return;
    }

    if (method === 'phone') {
      if (phone.length !== 10) return;
      setLoading(true);



      try {
        const data = await api.post('/api/v1/auth/otp', { phone: `+91${phone}` });
        if (data.error && !data.smsFailed) { setError(data.error); setLoading(false); return; }
        if (data.otp) {
          setDevOtp(data.otp);
        }
        if (data.smsFailed) {
          setError(`SMS delivery failed: ${data.error}. Check terminal for OTP.`);
        } else {
          setSuccess('OTP sent to your phone!');
        }
        setOtpStatus('sent');
        setAttempts(0);
      } catch (err: any) {
        // Check for rate limiting
        if (err.status === 429) {
          setError('Too many requests. Please wait a minute before trying again.');
          setCooldown(60);
        } else {
          setError(err.message || 'Failed to send OTP');
        }
      }
      setLoading(false);
    } else {
      if (!email || !email.includes('@')) return;
      setLoading(true);
      try {
        const data = await api.post('/api/v1/auth/email-otp', { email });
        if (data.error) { setError(data.error); setLoading(false); return; }
        if (data.otp) {
          setDevOtp(data.otp);
        }
        setSuccess(`OTP sent to ${email}`);
        setOtpStatus('sent');
        setAttempts(0);
      } catch (err: any) {
        if (err.status === 429) {
          setError('Too many requests. Please wait a minute before trying again.');
          setCooldown(60);
        } else {
          setError(err.message || 'Failed to send OTP');
        }
      }
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;

    if (attempts >= MAX_ATTEMPTS) {
      setError(`Too many failed attempts (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}). Please request a new OTP.`);
      setOtpStatus('expired');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (method === 'phone') {
        if (isLogin) {
          const data = await api.post('/api/v1/auth/login', { phone: `+91${phone}`, otp });
          if (data.error) { setError(data.error); setAttempts(a => a + 1); setLoading(false); return; }
          if (data.token) {
            trackEvent('login', { method: 'phone', isLogin: true });
            setAuth(data.user, data.token);
            setOtpStatus('verified');
            setSuccess('Signed in!');
            setTimeout(() => router.push('/'), 500);
          }
        } else {
          const data = await api.post('/api/v1/auth/register', { phone: `+91${phone}`, otp, name: name || undefined, email: email || undefined });
          if (data.error) { setError(data.error); setAttempts(a => a + 1); setLoading(false); return; }
          if (data.token) {
            trackEvent('login', { method: 'phone', isLogin: false });
            setAuth(data.user, data.token);
            setOtpStatus('verified');
            setSuccess('Account created!');
            setTimeout(() => router.push('/'), 500);
          }
        }
      } else {
        const data = await api.post('/api/v1/auth/email-verify', { email, otp, name: name || undefined });
        if (data.error) { setError(data.error); setAttempts(a => a + 1); setLoading(false); return; }
        if (data.token) {
          trackEvent('login', { method: 'email', isLogin });
          setAuth(data.user, data.token);
          setOtpStatus('verified');
          setSuccess(isLogin ? 'Signed in!' : 'Account created!');
          setTimeout(() => router.push('/'), 500);
        }
      }
    } catch (err: any) {
      setAttempts(a => a + 1);
      if (err.status === 429) {
        setError('Too many attempts. Please wait before trying again.');
      } else {
        setError(err.message || 'Verification failed');
      }
    }
    setLoading(false);
  };

  const handleResend = () => {
    resetForm();
    // Auto-trigger resend after reset
    setTimeout(() => handleSendOtp(), 100);
  };

  const isPhoneMode = method === 'phone';
  const canSend = isPhoneMode ? phone.length === 10 : email.includes('@');
  const otpExpired = otpStatus === 'expired';
  const remainingAttempts = MAX_ATTEMPTS - attempts;

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--canvas)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 40, animation: 'scaleIn 0.2s ease', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <ThemeToggle />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--primary)', boxShadow: '0 4px 20px rgba(255,71,87,0.25)' }}>
              <Image src="/logo.avif" alt="The Katanguri's Kitchen" width={72} height={72} style={{ objectFit: 'cover' }} priority />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-deep)', letterSpacing: '-0.5px', marginBottom: 8 }}>
            The Katanguri's Kitchen
          </div>
          <p style={{ color: 'var(--steel)', fontSize: 14 }}>
            {isLogin ? 'Sign in to continue ordering' : 'Create an account to get started'}
          </p>
        </div>

        {/* Method Toggle: Phone / Email */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', padding: 4 }}>
          <button type="button" onClick={() => { setMethod('phone'); resetForm(); }}
            style={{
              flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 'calc(var(--rounded-lg) - 4px)',
              background: isPhoneMode ? 'var(--surface)' : 'transparent', color: isPhoneMode ? 'var(--ink)' : 'var(--steel)',
              cursor: 'pointer', boxShadow: isPhoneMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}>
            Phone
          </button>
          <button type="button" onClick={() => { setMethod('email'); resetForm(); }}
            style={{
              flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 'calc(var(--rounded-lg) - 4px)',
              background: !isPhoneMode ? 'var(--surface)' : 'transparent', color: !isPhoneMode ? 'var(--ink)' : 'var(--steel)',
              cursor: 'pointer', boxShadow: !isPhoneMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}>
            Email
          </button>
        </div>

        {/* Name (signup only) */}
        {!isLogin && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="name" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, display: 'block' }}>Full Name</label>
            <input id="name" name="name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', height: 44 }} />
          </div>
        )}

        {/* Phone Input */}
        {isPhoneMode && (
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="phone" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, display: 'block' }}>Phone Number</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ padding: '10px 12px', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-lg)', fontWeight: 700, fontSize: 14, background: 'var(--surface-soft)', color: 'var(--steel)', display: 'flex', alignItems: 'center', height: 44 }}>
                +91
              </div>
              <input id="phone" name="phone" type="tel" placeholder="98765 43210" value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={otpStatus === 'sent'}
                style={{ flex: 1, height: 44, opacity: otpStatus === 'sent' ? 0.6 : 1 }} />
            </div>
          </div>
        )}

        {/* Email Input */}
        {!isPhoneMode && (
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="email" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, display: 'block' }}>Email Address</label>
            <input id="email" name="email" placeholder="you@gmail.com" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={otpStatus === 'sent'}
              style={{ width: '100%', height: 44, opacity: otpStatus === 'sent' ? 0.6 : 1 }} />
          </div>
        )}

        {/* OTP Input */}
        {(otpStatus === 'sent' || otpExpired) && (
          <div style={{ marginBottom: 20, animation: 'fadeInUp 0.2s ease' }}>
            <label htmlFor="otp-0" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, display: 'block' }}>
              {otpExpired ? 'OTP Expired' : 'Enter OTP'}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <input key={i} id={`otp-${i}`} name={`otp-${i}`} maxLength={1} value={otp[i] || ''} data-otp={i}
                  disabled={otpExpired}
                  onChange={e => {
                    if (otpExpired) return;
                    const val = e.target.value.replace(/\D/g, '');
                    const newOtp = otp.split(''); newOtp[i] = val; setOtp(newOtp.join(''));
                    if (val && i < 5) {
                      const next = document.querySelector(`input[data-otp="${i + 1}"]`) as HTMLInputElement;
                      next?.focus();
                    }
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && otp.length === 6 && !otpExpired) handleVerifyOtp(); }}
                  style={{
                    flex: 1, width: '100%', minWidth: 0, padding: 0, height: 56, textAlign: 'center', borderRadius: 'var(--rounded-lg)',
                    border: `2px solid ${otpExpired ? 'var(--critical)' : otp[i] ? 'var(--primary)' : 'var(--hairline)'}`,
                    fontSize: 24, fontWeight: 700, letterSpacing: '4px', opacity: otpExpired ? 0.5 : 1,
                  }} />
              ))}
            </div>

            {/* Attempts remaining indicator */}
            {!otpExpired && attempts > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: remainingAttempts <= 2 ? 'var(--critical)' : 'var(--steel)', textAlign: 'center' }}>
                {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
              </div>
            )}

            {devOtp && (
              <div id="dev-otp-indicator" style={{ marginTop: 12, padding: '8px 12px', background: 'var(--surface-soft)', border: '1px dashed var(--primary)', borderRadius: 'var(--rounded-lg)', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                Dev Mode: {devOtp}
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button type="button" onClick={handleResend}
                disabled={cooldown > 0}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14,
                  fontWeight: 700, cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                  opacity: cooldown > 0 ? 0.5 : 1,
                }}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : otpExpired ? 'Request New OTP' : 'Change number / Resend'}
              </button>
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--critical)', fontSize: 13, marginBottom: 12, textAlign: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--rounded-lg)' }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12, textAlign: 'center', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 'var(--rounded-lg)' }}>{success}</div>}

        <button type="button" className="btn btn-buy-cta" style={{ width: '100%', padding: '14px 0', fontSize: 16, marginBottom: 16 }}
          onClick={() => otpStatus === 'idle' ? handleSendOtp() : handleVerifyOtp()}
          disabled={loading || cooldown > 0 || (otpStatus === 'idle' && !canSend) || (otpStatus === 'sent' && otp.length !== 6) || otpExpired}>
          {loading ? 'Sending OTP...' : otpExpired ? 'Request New OTP' : otpStatus === 'idle' ? 'Send OTP' : isLogin ? 'Verify & Sign In' : 'Verify & Sign Up'}
        </button>

        {/* Cooldown indicator */}
        {cooldown > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--steel)', marginBottom: 8 }}>
            Please wait {cooldown}s before requesting a new OTP
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--steel)' }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setIsLogin(!isLogin); resetForm(); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--canvas)' }}>
        <div style={{ color: 'var(--steel)', fontSize: 14 }}>Loading...</div>
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
