'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

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
    <div style={{ paddingTop: 100, paddingBottom: 40 }}>
      <div className="container" style={{ maxWidth: 700 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 500, marginBottom: 8, color: 'var(--ink-deep)' }}>Contact Us</h1>
          <p style={{ color: 'var(--steel)', marginBottom: 32, fontSize: 16 }}>
            Have a question, feedback, or want to place a bulk order? Reach out to us.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}
        >
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--ink-deep)' }}>📍 Address</h3>
            <p style={{ color: 'var(--steel)', fontSize: 14, lineHeight: 1.5 }}>
              The Katanguri&apos;s Kitchen<br />Hanamkonda, Telangana
            </p>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--ink-deep)' }}>📞 Phone</h3>
            <a href="tel:+919347968582" style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 12 }}>
              +91 93479 68582
            </a>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--ink-deep)' }}>✉️ Email</h3>
            <a href="mailto:hello@thekatanguriskitchen.com" style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600, display: 'block' }}>
              hello@thekatanguriskitchen.com
            </a>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: 'var(--ink-deep)' }}>Send us a message</h2>

          {sent ? (
            <div className="card" style={{ padding: 24, background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>✅ Thank you!</div>
              <div style={{ marginTop: 4, fontSize: 14 }}>We&apos;ll get back to you within 24 hours.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Your name *</label>
                <input
                  aria-label="Your name"
                  placeholder="Enter your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%', borderColor: errors.name ? 'var(--critical)' : undefined }}
                />
                {errors.name && <p style={{ color: 'var(--critical)', margin: '4px 0 0', fontSize: 13 }}>{errors.name}</p>}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Your email *</label>
                <input
                  aria-label="Your email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{ width: '100%', borderColor: errors.email ? 'var(--critical)' : undefined }}
                />
                {errors.email && <p style={{ color: 'var(--critical)', margin: '4px 0 0', fontSize: 13 }}>{errors.email}</p>}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Phone (optional)</label>
                <input
                  aria-label="Your phone (optional)"
                  placeholder="+91 93479 68582"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Your message *</label>
                <textarea
                  aria-label="Your message"
                  placeholder="Tell us how we can help..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                  style={{ width: '100%', resize: 'vertical', borderColor: errors.message ? 'var(--critical)' : undefined, minHeight: 120 }}
                />
                {errors.message && <p style={{ color: 'var(--critical)', margin: '4px 0 0', fontSize: 13 }}>{errors.message}</p>}
              </div>
              {apiError && <p style={{ color: 'var(--critical)', fontSize: 14, textAlign: 'center' }}>{apiError}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px 0', fontSize: 16, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
