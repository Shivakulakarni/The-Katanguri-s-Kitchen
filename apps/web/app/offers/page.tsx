'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function OffersPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            Offers & Deals
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Great food at even better prices. Check out our current offers!
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { title: 'First Order Discount', desc: 'Get 15% off on your first order. Use code WELCOME15 at checkout.', valid: 'Ongoing', color: '#dcfce7', border: '#22c55e' },
            { title: 'Free Delivery', desc: 'Free delivery on orders above ₹500. No code needed.', valid: 'Ongoing', color: '#dbeafe', border: '#3b82f6' },
            { title: 'Combo Meals', desc: 'Save up to ₹100 on our curated combo meals — Biryani + Raita + Drink.', valid: 'Ongoing', color: '#fef3c7', border: '#f59e0b' },
          ].map((offer, i) => (
            <motion.div key={offer.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}>
              <div className="card" style={{ padding: 24, borderLeft: `4px solid ${offer.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)' }}>{offer.title}</h2>
                  <span style={{ fontSize: 12, color: 'var(--steel)', background: offer.color, padding: '4px 10px', borderRadius: 'var(--rounded-full)' }}>{offer.valid}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--charcoal)', lineHeight: 1.6, marginBottom: 12 }}>{offer.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.4 }}>
          <div className="card" style={{ padding: 32, textAlign: 'center', marginTop: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>Ready to order?</h2>
            <p style={{ color: 'var(--steel)', fontSize: 14, marginBottom: 20 }}>Browse our menu and apply your code at checkout.</p>
            <Link href="/menu" style={{ background: 'var(--primary)', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
              Order Now
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
