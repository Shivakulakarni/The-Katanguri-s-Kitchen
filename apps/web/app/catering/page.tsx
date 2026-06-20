'use client';

import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function CateringPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            Catering Services
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Let The Katanguri&apos;s Kitchen bring authentic South Indian flavors to your next event.
          </p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="card" style={{ padding: 32, marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>Events We Cater</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 16 }}>
              {['Weddings', 'Corporate Events', 'Birthday Parties', 'Festivals', 'House Warming', 'Community Gatherings'].map(event => (
                <div key={event} style={{ padding: '12px 16px', background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {event}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="card" style={{ padding: 32, marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>How It Works</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { step: '1', title: 'Tell Us Your Needs', desc: 'Share your event date, guest count, and cuisine preferences.' },
                { step: '2', title: 'Custom Menu', desc: 'We&apos;ll create a personalized menu based on your preferences and budget.' },
                { step: '3', title: 'Fresh Preparation', desc: 'Our chefs prepare everything fresh on the day of your event.' },
                { step: '4', title: 'Hassle-Free Delivery', desc: 'We handle setup, serving, and cleanup so you can enjoy your event.' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--rounded-circle)', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {item.step}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 4 }}>{item.title}</h3>
                    <p style={{ fontSize: 13, color: 'var(--steel)', lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>Ready to Book?</h2>
            <p style={{ color: 'var(--steel)', fontSize: 14, marginBottom: 20 }}>Minimum order: 20 guests. Book at least 48 hours in advance.</p>
            <a href="tel:+919876543210" style={{ background: 'var(--primary)', color: '#fff', padding: '14px 32px', borderRadius: 'var(--rounded-lg)', fontWeight: 700, fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
              Call Us: +91 98765 43210
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
