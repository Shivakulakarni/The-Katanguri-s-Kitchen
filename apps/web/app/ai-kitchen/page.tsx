'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function AiKitchenPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch('/api/v1/ai/chat/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setResponse(data.reply || data.response || 'Sorry, I could not process that.');
    } catch {
      setResponse('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 700 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            AI Kitchen Assistant
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Ask me anything about our menu, dishes, dietary needs, or meal planning.
          </p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askAI()}
                placeholder="Ask about our dishes, ingredients, recommendations..."
                style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--hairline)', fontSize: 14 }}
              />
              <button onClick={askAI} disabled={loading || !message.trim()} style={{ background: 'var(--primary)', color: '#fff', padding: '12px 24px', borderRadius: 'var(--rounded-lg)', fontWeight: 700, fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !message.trim() ? 0.7 : 1 }}>
                {loading ? '...' : 'Ask'}
              </button>
            </div>

            {response && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
                {response}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.2 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 8 }}>Try asking:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['What do you recommend?', 'Which dishes are vegetarian?', 'Tell me about your biryani', 'Plan a dinner for 4'].map(q => (
                <button key={q} onClick={() => { setMessage(q); }} style={{ padding: '6px 14px', borderRadius: 'var(--rounded-full)', border: '1px solid var(--hairline)', background: '#fff', fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="card" style={{ padding: 24, marginTop: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>What I Can Help With</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {['Menu Recommendations', 'Dietary Filters', 'Meal Planning', 'Food Stories', 'Order Tracking'].map(item => (
                <div key={item} style={{ padding: '10px 14px', background: 'var(--surface-soft)', borderRadius: 'var(--rounded-md)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
