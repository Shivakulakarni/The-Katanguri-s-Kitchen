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
          setError(`SMS temporarily unavailable: ${data.error}. Please try email login or come back later.`);
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
          if (data.accessToken) {
            trackEvent('login', { method: 'phone', isLogin: true });
            setAuth(data.user, data.accessToken, data.refreshToken);
            setOtpStatus('verified');
            setSuccess('Signed in!');
            setTimeout(() => router.push('/'), 500);
          }
        } else {
          const data = await api.post('/api/v1/auth/register', { phone: `+91${phone}`, otp, name: name || undefined, email: email || undefined });
          if (data.error) { setError(data.error); setAttempts(a => a + 1); setLoading(false); return; }
          if (data.accessToken) {
            trackEvent('login', { method: 'phone', isLogin: false });
            setAuth(data.user, data.accessToken, data.refreshToken);
            setOtpStatus('verified');
            setSuccess('Account created!');
            setTimeout(() => router.push('/'), 500);
          }
        }
      } else {
        const data = await api.post('/api/v1/auth/email-verify', { email, otp, name: name || undefined });
        if (data.error) { setError(data.error); setAttempts(a => a + 1); setLoading(false); return; }
        if (data.accessToken) {
          trackEvent('login', { method: 'email', isLogin });
          setAuth(data.user, data.accessToken, data.refreshToken);
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
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      background: 'var(--canvas)',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(226, 55, 68, 0.04) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(255, 111, 97, 0.04) 0%, transparent 40%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blurred background elements for ambient culinary glow */}
      <div style={{
        position: 'absolute', top: '15%', left: '10%', width: 250, height: 250,
        borderRadius: '50%', background: 'rgba(226,55,68,0.06)', filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '10%', width: 300, height: 300,
        borderRadius: '50%', background: 'rgba(255,111,97,0.06)', filter: 'blur(70px)', pointerEvents: 'none',
      }} />

      <div className="card" style={{
        width: '100%',
        maxWidth: 440,
        padding: '48px 40px',
        animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        borderRadius: 24,
        background: 'var(--canvas)',
        boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.08), 0 0 1px 1px var(--hairline)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ position: 'absolute', top: 24, right: 24 }}>
          <ThemeToggle />
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              overflow: 'hidden',
              border: '3px solid var(--primary)',
              boxShadow: '0 8px 30px rgba(226,55,68,0.2)',
              transition: 'all 0.3s ease',
              transform: 'rotate(-4deg)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0deg) scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'rotate(-4deg) scale(1)'}>
              <Image src="/logo.avif" alt="The Katanguri's Kitchen" width={80} height={80} style={{ objectFit: 'cover' }} priority />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-deep)', letterSpacing: '-0.75px', marginBottom: 6 }}>
            The Katanguri's Kitchen
          </div>
          <p style={{ color: 'var(--steel)', fontSize: 14, fontWeight: 500 }}>
            {isLogin ? 'Sign in to continue ordering' : 'Create an account to get started'}
          </p>
        </div>

        {/* Method Toggle: Phone / Email */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 28, background: 'var(--surface-soft)', borderRadius: 14, padding: 5,
          border: '1px solid var(--hairline-soft)',
        }}>
          <button type="button" onClick={() => { setMethod('phone'); resetForm(); }}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10,
              background: isPhoneMode ? 'var(--canvas)' : 'transparent',
              color: isPhoneMode ? 'var(--primary)' : 'var(--steel)',
              cursor: 'pointer',
              boxShadow: isPhoneMode ? '0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
            Phone Number
          </button>
          <button type="button" onClick={() => { setMethod('email'); resetForm(); }}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10,
              background: !isPhoneMode ? 'var(--canvas)' : 'transparent',
              color: !isPhoneMode ? 'var(--primary)' : 'var(--steel)',
              cursor: 'pointer',
              boxShadow: !isPhoneMode ? '0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
            Email Address
          </button>
        </div>

        {/* Name (signup only) */}
        {!isLogin && (
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="name" style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Full Name</label>
            <input id="name" name="name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} 
              style={{
                width: '100%', height: 48, borderRadius: 12, border: '1.5px solid var(--hairline)',
                padding: '0 16px', fontSize: 15, fontWeight: 500, transition: 'all 0.2s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(226,55,68,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.boxShadow = 'none'; }} />
          </div>
        )}

        {/* Phone Input */}
        {isPhoneMode && (
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="phone" style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Phone Number</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                padding: '0 16px', border: '1.5px solid var(--hairline)', borderRadius: 12, fontWeight: 700, fontSize: 15,
                background: 'var(--surface-soft)', color: 'var(--ink-deep)', display: 'flex', alignItems: 'center', height: 48,
              }}>
                +91
              </div>
              <input id="phone" name="phone" type="tel" placeholder="98765 43210" value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={otpStatus === 'sent'}
                style={{
                  flex: 1, height: 48, borderRadius: 12, border: '1.5px solid var(--hairline)',
                  padding: '0 16px', fontSize: 15, fontWeight: 600, transition: 'all 0.2s ease',
                  opacity: otpStatus === 'sent' ? 0.6 : 1,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(226,55,68,0.08)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
          </div>
        )}

        {/* Email Input */}
        {!isPhoneMode && (
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="email" style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Email Address</label>
            <input id="email" name="email" placeholder="you@gmail.com" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={otpStatus === 'sent'}
              style={{
                width: '100%', height: 48, borderRadius: 12, border: '1.5px solid var(--hairline)',
                padding: '0 16px', fontSize: 15, fontWeight: 600, transition: 'all 0.2s ease',
                opacity: otpStatus === 'sent' ? 0.6 : 1,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(226,55,68,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.boxShadow = 'none'; }} />
          </div>
        )}

        {/* OTP Input */}
        {(otpStatus === 'sent' || otpExpired) && (
          <div style={{ marginBottom: 24, animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <label htmlFor="otp-0" style={{ fontSize: 12, fontWeight: 700, color: otpExpired ? 'var(--critical)' : 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block' }}>
              {otpExpired ? 'OTP Expired' : 'Enter OTP'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
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
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) {
                      const prev = document.querySelector(`input[data-otp="${i - 1}"]`) as HTMLInputElement;
                      prev?.focus();
                    }
                    if (e.key === 'Enter' && otp.length === 6 && !otpExpired) handleVerifyOtp();
                  }}
                  style={{
                    flex: 1, width: '100%', minWidth: 0, padding: 0, height: 50, textAlign: 'center', borderRadius: 12,
                    border: `2px solid ${otpExpired ? 'var(--critical)' : otp[i] ? 'var(--primary)' : 'var(--hairline)'}`,
                    fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', opacity: otpExpired ? 0.5 : 1,
                    transition: 'all 0.15s ease', background: 'var(--surface-soft)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--canvas)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = otp[i] ? 'var(--primary)' : 'var(--hairline)'; e.currentTarget.style.background = 'var(--surface-soft)'; }} />
              ))}
            </div>

            {/* Attempts remaining indicator */}
            {!otpExpired && attempts > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: remainingAttempts <= 2 ? 'var(--critical)' : 'var(--steel)', fontWeight: 600, textAlign: 'center' }}>
                ⚠️ {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
              </div>
            )}

            {devOtp && (
              <div id="dev-otp-indicator" style={{
                marginTop: 16, padding: '10px 14px', background: 'rgba(226,55,68,0.04)', border: '1.5px dashed rgba(226,55,68,0.2)',
                borderRadius: 12, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)',
                boxShadow: '0 4px 15px rgba(226,55,68,0.05)', animation: 'pulse 2s infinite',
              }}>
                🔑 Presentation Mode: {devOtp}
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <button type="button" onClick={handleResend}
                disabled={cooldown > 0}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13,
                  fontWeight: 700, cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                  opacity: cooldown > 0 ? 0.5 : 1, transition: 'color 0.2s',
                }}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : otpExpired ? 'Request New OTP' : 'Change number / Resend'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            color: 'var(--critical)', fontSize: 13, fontWeight: 500, marginBottom: 16, textAlign: 'left',
            padding: '12px 16px', background: 'rgba(228,30,63,0.06)', borderRadius: 12,
            borderLeft: '4px solid var(--critical)', animation: 'fadeIn 0.2s ease',
          }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{
            color: 'var(--success)', fontSize: 13, fontWeight: 500, marginBottom: 16, textAlign: 'left',
            padding: '12px 16px', background: 'rgba(46,125,50,0.06)', borderRadius: 12,
            borderLeft: '4px solid var(--success)', animation: 'fadeIn 0.2s ease',
          }}>
            {success}
          </div>
        )}

        <button type="button" className="btn" style={{
          width: '100%',
          height: 48,
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 20,
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)',
          color: 'var(--on-primary)',
          boxShadow: '0 6px 20px rgba(226,55,68,0.25)',
          borderRadius: 12,
          transition: 'all 0.2s ease',
          cursor: loading || cooldown > 0 || (otpStatus === 'idle' && !canSend) || (otpStatus === 'sent' && otp.length !== 6) || otpExpired ? 'not-allowed' : 'pointer',
          opacity: loading || cooldown > 0 || (otpStatus === 'idle' && !canSend) || (otpStatus === 'sent' && otp.length !== 6) || otpExpired ? 0.6 : 1,
        }}
        onClick={() => otpStatus === 'idle' ? handleSendOtp() : handleVerifyOtp()}
        disabled={loading || cooldown > 0 || (otpStatus === 'idle' && !canSend) || (otpStatus === 'sent' && otp.length !== 6) || otpExpired}
        onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = '0 8px 25px rgba(226,55,68,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
        onMouseLeave={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = '0 6px 20px rgba(226,55,68,0.25)'; e.currentTarget.style.transform = 'translateY(0)'; } }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="animate-spin" style={{ width: 16, height: 16, border: '2px solid var(--on-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
              {otpStatus === 'idle' ? 'Sending Code...' : 'Verifying Code...'}
            </div>
          ) : otpExpired ? 'Request New OTP' : otpStatus === 'idle' ? 'Send OTP' : isLogin ? 'Verify & Sign In' : 'Verify & Sign Up'}
        </button>

        {/* Cooldown indicator */}
        {cooldown > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--steel)', marginBottom: 12, fontWeight: 500 }}>
            ⏳ Please wait {cooldown}s before requesting a new code
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--steel)', fontWeight: 500 }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setIsLogin(!isLogin); resetForm(); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-deep)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--primary)'}>
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
