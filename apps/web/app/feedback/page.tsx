'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function FeedbackPage() {
  const [form, setForm] = useState({ name: '', email: '', rating: 5, message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, subject: `Feedback (${form.rating}/5 stars)`, message: form.message }),
      });
      if (res.ok) setSent(true);
    } catch {} finally { setLoading(false); }
  };

  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 600 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            Share Your Feedback
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Your feedback helps us serve you better. We read every single message.
          </p>
        </motion.div>

        {sent ? (
          <motion.div {...fadeUp}>
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>Thank you!</h2>
              <p style={{ color: 'var(--steel)', fontSize: 14 }}>Your feedback has been received. We truly appreciate it.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
            <form onSubmit={handleSubmit} className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Name</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Rating</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} type="button" onClick={() => setForm({ ...form, rating: star })} style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', color: star <= form.rating ? '#f59e0b' : '#ddd' }}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6, display: 'block' }}>Your Feedback</label>
                  <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={4} required style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)', fontSize: 14, resize: 'vertical' }} placeholder="Tell us about your experience..." />
                </div>
                <button type="submit" disabled={loading} style={{ background: 'var(--primary)', color: '#fff', padding: '12px 0', borderRadius: 'var(--rounded-lg)', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Sending...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
