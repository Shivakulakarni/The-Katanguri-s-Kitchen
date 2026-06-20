'use client';

import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            About Us
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Authentic South Indian cloud kitchen from the heart of Warangal.
          </p>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
          <div className="card" style={{ padding: 32, marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>Our Story</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--charcoal)', marginBottom: 16 }}>
              The Katanguri&apos;s Kitchen was born from a simple belief: that authentic home-style food, cooked with care and the finest ingredients, deserves to reach every doorstep in Warangal. What started as a family passion for Dum Biryani and traditional South Indian cuisine has grown into a trusted cloud kitchen serving hundreds of happy customers every day.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--charcoal)' }}>
              Every dish we prepare follows time-honored recipes passed down through generations, combined with modern food safety standards. We source locally, cook fresh, and deliver with care — because great food should never be compromised.
            </p>
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { icon: '👨‍🍳', title: 'Fresh Daily', desc: 'Every dish cooked fresh to order — no pre-made, no frozen.' },
            { icon: '🌶️', title: 'Authentic Recipes', desc: 'Traditional recipes passed down through generations.' },
            { icon: '🚚', title: 'Fast Delivery', desc: 'Hot food delivered to your door in 30-45 minutes.' },
            { icon: '⭐', title: 'Quality First', desc: 'Premium ingredients, zero compromise on taste or hygiene.' },
          ].map((item, i) => (
            <motion.div key={item.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}>
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 6 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--steel)', lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.4 }}>
          <div className="card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 12 }}>Visit Us</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', marginBottom: 6 }}>Address</h3>
                <p style={{ fontSize: 14, color: 'var(--charcoal)', lineHeight: 1.6 }}>Hunter Road, Tiger Hills Colony<br />Hanamkonda, Warangal — 506001<br />Telangana, India</p>
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', marginBottom: 6 }}>Hours</h3>
                <p style={{ fontSize: 14, color: 'var(--charcoal)', lineHeight: 1.6 }}>Mon–Sun: 12:00 PM – 10:00 PM<br />Open all days</p>
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', marginBottom: 6 }}>Contact</h3>
                <p style={{ fontSize: 14, color: 'var(--charcoal)', lineHeight: 1.6 }}>
                  <a href="tel:+919876543210" style={{ color: 'var(--primary)', fontWeight: 600 }}>+91 98765 43210</a><br />
                  <a href="mailto:hello@thekatanguriskitchen.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>hello@thekatanguriskitchen.com</a>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
