'use client';

import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function BlogPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            Blog
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Stories, tips, and insights from our kitchen to yours.
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { title: 'The Art of Dum Biryani', date: 'June 2026', excerpt: 'What makes Hyderabadi Dum Biryani truly special is the technique — layering, sealing, and slow-cooking to lock in every bit of flavor.' },
            { title: 'Why We Source Locally', date: 'May 2026', excerpt: 'Fresh ingredients from local farms in Warangal make all the difference. Here&apos;s how we pick the best produce every day.' },
            { title: 'Spice Guide: South Indian Essentials', date: 'April 2026', excerpt: 'From garam masala to curry leaves — a quick guide to the spices that define our cuisine.' },
          ].map((post, i) => (
            <motion.div key={post.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}>
              <div className="card" style={{ padding: 24 }}>
                <span style={{ fontSize: 12, color: 'var(--steel)' }}>{post.date}</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', margin: '8px 0' }}>{post.title}</h2>
                <p style={{ fontSize: 14, color: 'var(--charcoal)', lineHeight: 1.6 }}>{post.excerpt}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
