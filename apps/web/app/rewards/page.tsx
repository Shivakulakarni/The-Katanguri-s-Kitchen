'use client';

import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function RewardsPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            Rewards Program
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Earn points with every order. Redeem for discounts on your favorite dishes.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { icon: '🎁', title: 'Earn 1 Point', desc: 'For every ₹10 spent on orders' },
            { icon: '⭐', title: '100 Points = ₹50 Off', desc: 'Redeem anytime, no minimum order' },
            { icon: '🎉', title: 'Birthday Bonus', desc: 'Earn 50 bonus points on your birthday' },
          ].map((item, i) => (
            <motion.div key={item.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}>
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 6 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--steel)', lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>How to Earn</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Sign up and automatically join the rewards program',
                'Place orders through our website or app',
                'Points are credited instantly after order delivery',
                'Check your points balance in your account page',
                'Redeem points at checkout for instant discounts',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14, color: 'var(--charcoal)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 'var(--rounded-circle)', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
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
