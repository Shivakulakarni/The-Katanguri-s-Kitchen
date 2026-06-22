'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getDishImage } from '../lib/dish-images';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

type Dish = {
  id: number; name: string; price: number; isVeg: boolean; prepTimeMinutes?: number;
  imageUrl?: string; category?: { name: string };
};

type Category = { id: number; name: string; description?: string; displayOrder: number; dishes: Dish[] };

const CATEGORY_IMAGES: Record<string, string> = {
  'NON-VEG STARTERS': 'https://images.unsplash.com/photo-1603122876935-13e7f40c3984?w=200&h=200&fit=crop',
  'VEG STARTERS': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=200&h=200&fit=crop',
  'NON-VEG CURRIES': 'https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=200&h=200&fit=crop',
  'VEG CURRIES': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=200&fit=crop',
  'CHINESE': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=200&h=200&fit=crop',
  'RICE BOWL COMBO': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=200&h=200&fit=crop',
  'BIRYANIS': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=200&h=200&fit=crop',
  'BREADS': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop',
  'DESSERTS': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=200&h=200&fit=crop',
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function HomePageContent() {
  const router = useRouter();
  const [popularDishes, setPopularDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalDishes, setTotalDishes] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/v1/menu', { signal: ac.signal })
      .then(r => {
        if (!r.ok) throw new Error('Menu unavailable');
        return r.json();
      })
      .then((cats: Category[]) => {
        if (ac.signal.aborted) return;
        setCategories(cats);
        const allDishes = cats.flatMap((c) => c.dishes.map((d) => ({ ...d, category: c })));
        setTotalDishes(allDishes.length);
        setPopularDishes(allDishes.slice(0, 4));
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('Failed to fetch menu:', err) });
    return () => ac.abort();
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        background: 'var(--canvas)', position: 'relative', overflow: 'hidden',
        padding: 'var(--space-hero) 32px var(--space-section-lg)',
      }}>
        <div className="container" style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 48,
          flexWrap: 'wrap',
        }}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ flex: '1 1 400px', minWidth: 280 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                border: '2px solid var(--primary)', boxShadow: '0 4px 16px rgba(255,71,87,0.3)', flexShrink: 0,
              }}>
                <Image src="/logo.avif" alt="The Katanguri's Kitchen" width={48} height={48} style={{ objectFit: 'cover' }} priority />
              </div>
              <div style={{
                display: 'inline-block', padding: '4px 12px',
                background: 'var(--warning-bg)', color: 'var(--ink-deep)',
                borderRadius: 'var(--rounded-full)', fontSize: 12, fontWeight: 700,
              }}>
                🔥 Warangal&apos;s Favorite Kitchen
              </div>
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 500, color: 'var(--ink-deep)',
              lineHeight: 1.16, marginBottom: 16, letterSpacing: '-0.5px',
            }}>
              The Katanguri&apos;s<br />
              <span style={{ color: 'var(--primary)' }}>Kitchen</span>
            </h1>
            <p style={{ fontSize: 18, color: 'var(--steel)', maxWidth: 460, marginBottom: 8, lineHeight: 1.44, fontStyle: 'italic' }}>
              &ldquo;Cooked with love, packed with care, and delivered fresh.&rdquo;
            </p>
            <p style={{ fontSize: 16, color: 'var(--charcoal)', maxWidth: 460, marginBottom: 32, lineHeight: 1.5 }}>
              Authentic South Indian flavors, Dum Biryani, and mouth-watering starters &mdash; delivered hot from Hanamkonda to your doorstep.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/menu" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 30px' }}>
                🍛 Order Now
              </Link>
              <Link href="/menu" className="btn btn-secondary" style={{ fontSize: 16, padding: '12px 28px' }}>
                View Menu →
              </Link>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}
          >
            <div style={{
              width: '100%', maxWidth: 400, aspectRatio: '1',
              borderRadius: 'var(--rounded-xxxl)', overflow: 'hidden',
              border: '1px solid var(--hairline-soft)', position: 'relative',
            }}>
              <img
                src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=400&fit=crop"
                alt="Delicious Biryani from The Katanguri's Kitchen"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="eager"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="container" style={{ marginTop: -40, marginBottom: 64, position: 'relative', zIndex: 2 }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 0,
          }}
        >
          {[
            { value: totalDishes > 0 ? `${totalDishes}+` : '50+', label: 'Dishes', icon: '🍛' },
            { value: '30 min', label: 'Avg. Delivery', icon: '⏱️' },
            { value: '4.8★', label: 'Rating on Swiggy', icon: '⭐' },
          ].map((stat, i) => (
            <motion.div key={stat.label} custom={i} variants={fadeUp} className="card-icon-feature" style={{
              textAlign: 'center',
              borderRadius: i === 0 ? 'var(--rounded-xxxl) 0 0 var(--rounded-xxxl)' : i === 2 ? '0 var(--rounded-xxxl) var(--rounded-xxxl) 0' : '0',
              borderRight: i < 2 ? '1px solid var(--hairline-soft)' : 'none',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--primary)', marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 14, color: 'var(--steel)', fontWeight: 700 }}>{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Categories */}
      <section className="container" style={{ marginBottom: 64 }}>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 500, marginBottom: 24, color: 'var(--ink-deep)', letterSpacing: '-0.5px' }}
        >
          What&apos;s on your mind?
        </motion.h2>
        <div className="scroll-x">
          {categories.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/menu?category=${encodeURIComponent(c.name)}`} className="card" style={{
                minWidth: 140, padding: 0, overflow: 'hidden', position: 'relative',
              }}>
                <img
                  src={CATEGORY_IMAGES[c.name] || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop'}
                  alt={c.name}
                  style={{ objectFit: 'cover', width: '100%', height: 140 }}
                  loading="eager"
                />
                <div style={{ padding: '12px 16px', textAlign: 'center', background: 'var(--canvas)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-deep)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--stone)' }}>{c.dishes.length} items</div>
                </div>
              </Link>
            </motion.div>
          ))}
          {categories.length === 0 && Array(6).fill(null).map((_, i) => (
            <div key={i} className="card skeleton" style={{ minWidth: 140, height: 180 }} />
          ))}
        </div>
      </section>

      {/* Popular Dishes */}
      <section className="container" style={{ marginBottom: 64 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 500, color: 'var(--ink-deep)', letterSpacing: '-0.5px' }}
          >
            Popular Dishes
          </motion.h2>
          <Link href="/menu" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>View All →</Link>
        </div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}
        >
          {popularDishes.map((dish, i) => (
            <motion.div key={dish.id} custom={i} variants={fadeUp} className="card">
              <div style={{ position: 'relative', height: 180, borderRadius: 'var(--rounded-xxxl) var(--rounded-xxxl) 0 0', overflow: 'hidden' }}>
                <img
                  src={getDishImage(dish.name, dish.imageUrl, dish.category?.name)}
                  alt={dish.name}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
                <span className={`tag ${dish.isVeg ? 'tag-veg' : 'tag-nonveg'}`}
                  style={{ position: 'absolute', top: 12, left: 12 }}>
                  {dish.isVeg ? 'VEG' : 'NON-VEG'}
                </span>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)' }}>{dish.name}</h3>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)' }}>{formatPrice(dish.price)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {dish.prepTimeMinutes && <span className="badge badge-time">⏱️ {dish.prepTimeMinutes} min</span>}
                </div>
                <button className="btn btn-buy-cta" style={{ width: '100%', marginTop: 16, padding: '12px 0' }} onClick={() => router.push('/menu')}>
                  View Menu
                </button>
              </div>
            </motion.div>
          ))}
          {popularDishes.length === 0 && Array(4).fill(null).map((_, i) => (
            <div key={i} className="card skeleton" style={{ height: 320 }} />
          ))}
        </motion.div>
      </section>

      {/* How It Works */}
      <section style={{ background: 'var(--surface-soft)', padding: 'var(--space-section-lg) 20px', marginBottom: 64 }}>
        <div className="container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 500, textAlign: 'center', marginBottom: 48, color: 'var(--ink-deep)', letterSpacing: '-0.5px' }}
          >
            How it <span style={{ color: 'var(--primary)' }}>works</span>
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}
          >
            {[
              { step: '01', title: 'Choose', desc: 'Browse our menu of authentic South Indian dishes', icon: '📱' },
              { step: '02', title: 'Order', desc: 'Customize, pay securely, and we start cooking', icon: '✅' },
              { step: '03', title: 'Enjoy', desc: 'Track in real-time as it gets delivered hot to you', icon: '🚀' },
            ].map((item, i) => (
              <motion.div key={item.step} custom={i} variants={fadeUp} className="card-icon-feature" style={{ textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 'var(--rounded-circle)',
                  background: 'var(--surface-soft)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, margin: '0 auto 16px',
                }}>{item.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 4, letterSpacing: '2px' }}>{item.step}</div>
                <h3 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, color: 'var(--ink-deep)' }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--steel)', lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}>{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container" style={{ marginBottom: 64 }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}
        >
          {[
            { icon: '🛵', title: 'Free Delivery', desc: 'On orders above ₹500' },
            { icon: '👨‍🍳', title: 'Fresh & Hot', desc: 'Cooked after you order' },
            { icon: '🛡️', title: 'Quality Assured', desc: 'Hygienic kitchen, fresh ingredients' },
            { icon: '📍', title: 'Real-time Tracking', desc: 'Live order status updates' },
          ].map((f, i) => (
            <motion.div key={f.title} custom={i} variants={fadeUp} className="card-icon-feature" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: 'var(--steel)' }}>{f.desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="container" style={{ marginBottom: 64 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card-promo-strip" style={{ textAlign: 'center' }}
        >
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 500, marginBottom: 8, color: 'var(--canvas)' }}>Ready to eat?</h2>
          <p style={{ fontSize: 16, opacity: 0.9, maxWidth: 400, margin: '0 auto 32px', color: 'var(--canvas)' }}>
            Freshly cooked Biryani, Starters, and more &mdash; delivered in 30 minutes or less.
          </p>
          <Link href="/menu" className="btn btn-buy-cta" style={{ fontSize: 16, padding: '14px 40px' }}>
            🛵 Order Now
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
