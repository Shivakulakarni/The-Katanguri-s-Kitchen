'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getDishImage, FALLBACK_DISH_IMAGE } from '../lib/dish-images';
import { useAuthStore } from '../lib/auth-store';
import { useCartStore } from '../lib/cart-store';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

type Recommendation = {
  dishId: number;
  dishName: string;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  categoryName: string;
  score: number;
  reason: string;
};

/** Shown when user is not logged in — encourages sign-in for personalized recs */
function SignInPrompt() {
  const router = useRouter();

  return (
    <section className="container" style={{ marginBottom: 64, marginTop: 48 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', borderRadius: 20,
        border: '2px dashed rgba(226, 55, 68, 0.25)',
        background: 'linear-gradient(135deg, rgba(226, 55, 68, 0.04) 0%, rgba(255, 255, 255, 0) 100%)',
        textAlign: 'center', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>✨</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-deep)', margin: 0 }}>
          Get Personalized Recommendations
        </h3>
        <p style={{ fontSize: 14, color: 'var(--steel)', maxWidth: 400, margin: 0 }}>
          Sign in to receive AI-powered dish suggestions based on your taste and order history.
        </p>
        <button
          onClick={() => router.push('/auth')}
          style={{
            padding: '12px 32px', fontSize: 14, fontWeight: 700, color: '#fff',
            background: 'linear-gradient(135deg, #e23744 0%, #c62828 100%)',
            border: 'none', borderRadius: 12, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(226, 55, 68, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(226, 55, 68, 0.4)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(226, 55, 68, 0.3)'; }}
        >
          Sign In for Recommendations
        </button>
      </div>
    </section>
  );
}

export function Recommendations() {
  const { addItem } = useCartStore();
  const token = useAuthStore(s => s.token);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When not authenticated, show the sign-in prompt instead of fetching
    if (!token) { setLoading(false); return; }

    const controller = new AbortController();
    fetch('/api/v1/ai/recommendations?limit=6', { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error('Failed to load recommendations');
        return r.json();
      })
      .then(data => {
        setRecommendations(data?.recommendations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  // Not logged in — show the sign-in CTA
  if (!token && !loading) return <SignInPrompt />;

  // Logged in but no recommendations — hide entirely
  if (loading || recommendations.length === 0) return null;

  return (
    <section className="container" style={{ marginBottom: 64, marginTop: 48 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'inline-block', padding: '4px 12px', background: '#fff0f0', color: '#e23744', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          ✨ AI Recommended
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-deep)' }}>Recommended for You</h2>
        <p style={{ fontSize: 14, color: 'var(--steel)', marginTop: 4 }}>
          Based on your order history and popular trends
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
        {recommendations.map((rec, i) => (
          <div key={rec.dishId} className="card" style={{ animation: `fadeInUp 0.3s ease ${i * 0.08}s forwards`, opacity: 0, border: '1px solid rgba(226, 55, 68, 0.1)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(226, 55, 68, 0.1)', color: '#e23744', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, zIndex: 1 }}>
              {rec.reason}
            </div>
            <div style={{ position: 'relative', height: 180, borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
              <img src={getDishImage(rec.dishName, rec.imageUrl, rec.categoryName)} alt={rec.dishName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { const img = e.target as HTMLImageElement; if (img.src !== FALLBACK_DISH_IMAGE) img.src = FALLBACK_DISH_IMAGE; }} />
              <span className={`tag ${rec.isVeg ? 'tag-veg' : 'tag-nonveg'}`} style={{ position: 'absolute', top: 12, left: 12 }}>
                {rec.isVeg ? 'VEG' : 'NON-VEG'}
              </span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)' }}>{rec.dishName}</h3>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-deep)' }}>{formatPrice(rec.price)}</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--stone)' }}>{rec.categoryName}</span>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12, padding: '10px 0', fontSize: 14 }}
                onClick={() => addItem({
                  id: rec.dishId,
                  name: rec.dishName,
                  price: rec.price,
                  veg: rec.isVeg,
                  image: getDishImage(rec.dishName, rec.imageUrl, rec.categoryName),
                  modifiers: [],
                })}
              >
                + Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
