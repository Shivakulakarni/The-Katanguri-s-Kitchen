'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.name || form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters.';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Please enter a valid email address.';
    if (!form.message || form.message.trim().length < 10) errs.message = 'Message must be at least 10 characters.';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: form.phone ? `Contact from ${form.name} - ${form.phone}` : `Contact from ${form.name}`,
          message: form.message,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to send message. Please try again.');
      }
      setSent(true);
    } catch (err: any) {
      setApiError(err.message || 'Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '100px 20px 40px' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Contact Us</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Have a question, feedback, or want to place a bulk order? Reach out to us.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
        <div style={{ padding: 20, background: '#f9f9f9', borderRadius: 8 }}>
          <h3>📍 Address</h3>
          <p style={{ color: '#555' }}>The Katanguri&apos;s Kitchen<br />Hanamkonda, Telangana</p>
        </div>
        <div style={{ padding: 20, background: '#f9f9f9', borderRadius: 8 }}>
          <h3>📞 Phone</h3>
          <p style={{ color: '#555' }}>+91 98765 43210</p>
          <h3>✉️ Email</h3>
          <p style={{ color: '#555' }}>hello@thekatanguriskitchen.com</p>
        </div>
      </div>

      <h2 style={{ fontSize: '1.3rem', marginBottom: 16 }}>Send us a message</h2>

      {sent ? (
        <div style={{ padding: 20, background: '#e8f5e9', borderRadius: 8, color: '#2e7d32' }}>
          ✅ Thank you! We&apos;ll get back to you within 24 hours.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <input
              aria-label="Your name"
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ padding: 12, border: `1px solid ${errors.name ? '#d32f2f' : '#ddd'}`, borderRadius: 6, fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
            />
            {errors.name && <p style={{ color: '#d32f2f', margin: '4px 0 0', fontSize: 14 }}>{errors.name}</p>}
          </div>
          <div>
            <input
              aria-label="Your email"
              type="email"
              placeholder="Your email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ padding: 12, border: `1px solid ${errors.email ? '#d32f2f' : '#ddd'}`, borderRadius: 6, fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
            />
            {errors.email && <p style={{ color: '#d32f2f', margin: '4px 0 0', fontSize: 14 }}>{errors.email}</p>}
          </div>
          <input
            aria-label="Your phone (optional)"
            placeholder="Your phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, fontSize: '1rem' }}
          />
          <div>
            <textarea
              aria-label="Your message"
              placeholder="Your message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={5}
              style={{ padding: 12, border: `1px solid ${errors.message ? '#d32f2f' : '#ddd'}`, borderRadius: 6, fontSize: '1rem', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            />
            {errors.message && <p style={{ color: '#d32f2f', margin: '4px 0 0', fontSize: 14 }}>{errors.message}</p>}
          </div>
          {apiError && <p style={{ color: '#d32f2f', fontSize: 14, textAlign: 'center' }}>{apiError}</p>}
          <button
            type="submit"
            style={{
              padding: '14px 24px',
              background: loading ? '#767676' : '#d32f2f',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
}
