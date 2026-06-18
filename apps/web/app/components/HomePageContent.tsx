'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDishImage, FALLBACK_DISH_IMAGE } from '../lib/dish-images';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

type Dish = {
  id: number; name: string; price: number; isVeg: boolean; prepTimeMinutes?: number;
  imageUrl?: string; category?: { name: string };
};

type Category = { id: number; name: string; description?: string; displayOrder: number; dishes: Dish[] };

const CATEGORY_IMAGES: Record<string, string> = {
  'NON-VEG STARTERS': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200&h=200&fit=crop',
  'VEG STARTERS': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=200&h=200&fit=crop',
  'NON-VEG CURRIES': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200&h=200&fit=crop',
  'VEG CURRIES': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=200&h=200&fit=crop',
  'CHINESE': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=200&fit=crop',
  'RICE BOWL COMBO': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=200&fit=crop',
  'BIRYANIS': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200&h=200&fit=crop',
  'BREADS': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop',
  'DESSERTS': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=200&h=200&fit=crop',
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
      <section style={{
        background: 'var(--canvas)', position: 'relative', overflow: 'hidden',
        padding: 'var(--space-hero) 32px var(--space-section-lg)',
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 48 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)', boxShadow: '0 4px 16px rgba(255,71,87,0.3)', flexShrink: 0 }}>
                <Image src="/logo.avif" alt="The Katanguri's Kitchen" width={48} height={48} style={{ objectFit: 'cover' }} priority />
              </div>
              <div style={{ display: 'inline-block', padding: '4px 12px', background: 'var(--warning-bg)', color: 'var(--ink-deep)', borderRadius: 'var(--rounded-full)', fontSize: 12, fontWeight: 700, letterSpacing: '-0.14px' }}>
                🔥 Warangal's Favorite Kitchen
              </div>
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 500, color: 'var(--ink-deep)',
              lineHeight: 1.16, marginBottom: 16, letterSpacing: '-0.5px',
            }}>
              The Katanguri's<br />
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
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 400, height: 400, borderRadius: 'var(--rounded-xxxl)',
              overflow: 'hidden', border: '1px solid var(--hairline-soft)', position: 'relative',
            }}>
              <Image src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&h=800&fit=crop" alt="Delicious Biryani from The Katanguri's Kitchen" fill sizes="400px" style={{ objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=800&fit=crop'; }} />
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ marginTop: -40, marginBottom: 64, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            { value: totalDishes > 0 ? `${totalDishes}+` : '50+', label: 'Dishes', icon: '🍛' },
            { value: '30 min', label: 'Avg. Delivery', icon: '⏱️' },
            { value: '4.8★', label: 'Rating on Swiggy', icon: '⭐' },
          ].map((stat, i) => (
            <div key={stat.label} className="card-icon-feature" style={{
              textAlign: 'center', borderRadius: i === 0 ? 'var(--rounded-xxxl) 0 0 var(--rounded-xxxl)' : i === 2 ? '0 var(--rounded-xxxl) var(--rounded-xxxl) 0' : '0',
              borderRight: i < 2 ? '1px solid var(--hairline-soft)' : 'none',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--primary)', marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 14, color: 'var(--steel)', fontWeight: 700 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ marginBottom: 64 }}>
        <h2 style={{ fontSize: 36, fontWeight: 500, marginBottom: 24, color: 'var(--ink-deep)', letterSpacing: '-0.5px' }}>What's on your mind?</h2>
        <div className="scroll-x">
          {categories.map(c => (
            <Link key={c.id} href={`/menu?category=${encodeURIComponent(c.name)}`} className="card" style={{
              minWidth: 140, padding: 0, overflow: 'hidden', position: 'relative',
            }}>
              <Image src={CATEGORY_IMAGES[c.name] || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop'} alt={c.name} width={140} height={140} style={{ objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div style={{ padding: '12px 16px', textAlign: 'center', background: 'var(--canvas)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-deep)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--stone)' }}>{c.dishes.length} items</div>
              </div>
            </Link>
          ))}
          {categories.length === 0 && Array(6).fill(null).map((_, i) => (
            <div key={i} className="card" style={{ minWidth: 140, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: '#767676', fontSize: 12 }}>Loading...</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ marginBottom: 64 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 36, fontWeight: 500, color: 'var(--ink-deep)', letterSpacing: '-0.5px' }}>Popular Dishes</h2>
          <Link href="/menu" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>View All →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {popularDishes.map((dish, i) => (
            <div key={dish.id} className="card" style={{ animation: `fadeInUp 0.3s ease ${i * 0.08}s forwards`, opacity: 0 }}>
              <div style={{ position: 'relative', height: 180, borderRadius: 'var(--rounded-xxxl) var(--rounded-xxxl) 0 0', overflow: 'hidden' }}>
                <Image src={getDishImage(dish.name, dish.imageUrl, dish.category?.name)} alt={dish.name} fill sizes="260px" style={{ objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).src = FALLBACK_DISH_IMAGE; }} />
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
                  <span style={{ fontSize: 13, color: 'var(--stone)' }}>Free delivery</span>
                </div>
                <button className="btn btn-buy-cta" style={{ width: '100%', marginTop: 16, padding: '12px 0' }} onClick={() => router.push('/menu')}>
                  View Menu
                </button>
              </div>
            </div>
          ))}
          {popularDishes.length === 0 && Array(4).fill(null).map((_, i) => (
            <div key={i} className="card" style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: '#767676' }}>Loading...</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--surface-soft)', padding: 'var(--space-section-lg) 20px', marginBottom: 64 }}>
        <div className="container">
          <h2 style={{ fontSize: 36, fontWeight: 500, textAlign: 'center', marginBottom: 48, color: 'var(--ink-deep)', letterSpacing: '-0.5px' }}>
            How it <span style={{ color: 'var(--primary)' }}>works</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { step: '01', title: 'Choose', desc: 'Browse our menu of authentic South Indian dishes', icon: '📱' },
              { step: '02', title: 'Order', desc: 'Customize, pay securely, and we start cooking', icon: '✅' },
              { step: '03', title: 'Enjoy', desc: 'Track in real-time as it gets delivered hot to you', icon: '🚀' },
            ].map(item => (
              <div key={item.step} className="card-icon-feature" style={{ textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 'var(--rounded-circle)',
                  background: 'var(--surface-soft)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, margin: '0 auto 16px',
                }}>{item.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 4, letterSpacing: '2px' }}>{item.step}</div>
                <h3 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, color: 'var(--ink-deep)' }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--steel)', lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container" style={{ marginBottom: 64 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {[
            { icon: '🛵', title: 'Free Delivery', desc: 'On orders above ₹500' },
            { icon: '👨‍🍳', title: 'Fresh & Hot', desc: 'Cooked after you order' },
            { icon: '🛡️', title: 'Quality Assured', desc: 'Hygienic kitchen, fresh ingredients' },
            { icon: '📍', title: 'Real-time Tracking', desc: 'Live order status updates' },
          ].map(f => (
            <div key={f.title} className="card-icon-feature" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: 'var(--steel)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ marginBottom: 64 }}>
        <div className="card-promo-strip" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 500, marginBottom: 8, color: 'var(--canvas)' }}>Ready to eat?</h2>
          <p style={{ fontSize: 16, opacity: 0.9, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px', color: 'var(--canvas)' }}>
            Freshly cooked Biryani, Starters, and more &mdash; delivered in 30 minutes or less.
          </p>
          <Link href="/menu" className="btn btn-buy-cta" style={{ fontSize: 16, padding: '14px 40px' }}>
            🛵 Order Now
          </Link>
        </div>
      </section>
    </div>
  );
}
