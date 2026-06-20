'use client';

import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function GiftCardsPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 600, textAlign: 'center' }}>
        <motion.div {...fadeUp}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎁</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            Gift Cards
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 40, lineHeight: 1.7 }}>
            Share the joy of great food. Gift cards are coming soon — give your loved ones the freedom to choose from our menu.
          </p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>How It Will Work</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
              {[
                'Choose a gift card amount (₹200, ₹500, ₹1000)',
                'Send it via email or WhatsApp to your loved one',
                'They redeem it at checkout on our website',
                'No expiry date — use anytime',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14, color: 'var(--charcoal)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{i + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
