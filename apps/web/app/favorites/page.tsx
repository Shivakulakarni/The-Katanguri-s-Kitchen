'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/auth-store';

interface Favorite {
  id: number;
  dishId: number;
  dishName: string;
  dishPrice: number;
  dishImage?: string;
  addedAt: string;
}

export default function FavoritesPage() {
  const { token, user } = useAuthStore();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/v1/customer/favorites', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setFavorites(data.favorites || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const removeFavorite = async (dishId: number) => {
    if (!token) return;
    try {
      await fetch(`/api/v1/customer/favorites/${dishId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setFavorites(prev => prev.filter(f => f.dishId !== dishId));
    } catch {}
  };

  if (!user) {
    return (
      <div style={{ paddingTop: 100, paddingBottom: 60, textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 500 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❤️</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>Your Favorites</h1>
          <p style={{ color: 'var(--steel)', marginBottom: 24, fontSize: 15 }}>Sign in to see your favorite dishes.</p>
          <Link href="/auth" style={{ background: 'var(--primary)', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ paddingTop: 100, textAlign: 'center', color: 'var(--steel)' }}>Loading favorites...</div>;

  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>My Favorites</h1>
        <p style={{ color: 'var(--steel)', marginBottom: 32, fontSize: 15 }}>{favorites.length} saved {favorites.length === 1 ? 'dish' : 'dishes'}</p>

        {favorites.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>♡</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>No favorites yet</h2>
            <p style={{ color: 'var(--steel)', fontSize: 14, marginBottom: 20 }}>Browse our menu and tap the heart icon to save your favorites.</p>
            <Link href="/menu" style={{ background: 'var(--primary)', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
              Browse Menu
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {favorites.map((fav, i) => (
              <motion.div key={fav.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-deep)' }}>{fav.dishName}</h3>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>₹{fav.dishPrice}</p>
                    </div>
                    <button onClick={() => removeFavorite(fav.dishId)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--rounded-circle)', width: 32, height: 32, cursor: 'pointer', fontSize: 14, fontWeight: 700, flexShrink: 0 }} aria-label={`Remove ${fav.dishName} from favorites`}>
                      ♥
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--steel)' }}>Added {new Date(fav.addedAt).toLocaleDateString()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
