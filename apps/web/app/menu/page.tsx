'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRealtimeEvent } from '@/lib/useRealtime';
import { useCartStore } from '../lib/cart-store';
import { useAuthStore } from '../lib/auth-store';
import { getDishImage, FALLBACK_DISH_IMAGE } from '../lib/dish-images';
import { Recommendations } from '../components/Recommendations';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { toast } from '../lib/toast-store';
import { trackEvent } from '../lib/analytics';
import { api } from '../lib/api';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

type Dish = {
  id: number; name: string; price: number; categoryId: number; isVeg: boolean;
  isAvailable: boolean; imageUrl?: string; prepTimeMinutes?: number;
  category?: { id: number; name: string };
};
type Category = { id: number; name: string; displayOrder: number; dishes: Dish[] };

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function MenuPage() {
  const { addItem } = useCartStore();
  const { token } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popularity');
  const [recs, setRecs] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const favToggleLock = useRef<Set<number>>(new Set());

  const debouncedSearch = useDebouncedValue(search, 200);

  useEffect(() => {
    const ac = new AbortController();

    fetch('/api/v1/ai/recommendations?limit=20', { signal: ac.signal })
      .then(async r => {
        if (r.status === 401) return undefined;
        if (!r.ok) throw new Error('Failed to fetch recommendations');
        return r.json();
      })
      .then(data => { if (data && !ac.signal.aborted) setRecs((data?.recommendations || []).map((r: any) => r.dishId)) })
      .catch(err => { if (err.name !== 'AbortError') console.warn('Recommendations unavailable:', err.message) });

    setLoading(true);
    fetch('/api/v1/menu', { signal: ac.signal })
      .then(async r => {
        if (!r.ok) throw new Error('Failed to fetch menu');
        return r.json();
      })
      .then((data: Category[]) => {
        if (ac.signal.aborted) return;
        setCategories(data);
        const allDishes = data.flatMap(cat =>
          cat.dishes.map(dish => ({
            ...dish,
            category: { id: cat.id, name: cat.name }
          }))
        );
        setDishes(allDishes);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load menu');
        setLoading(false);
      });

    return () => ac.abort();
  }, []);

  // Load favorites when logged in
  useEffect(() => {
    if (!token) return;
    api.get<{ favorites: { dishId: number }[] }>('/api/v1/customer/favorites', token)
      .then(data => {
        setFavorites(new Set((data.favorites || []).map(f => f.dishId)));
      })
      .catch(() => {});
  }, [token]);

  const toggleFavorite = useCallback(async (dishId: number) => {
    if (!token) {
      toast.info('Sign in to save favorites', 'Log in to keep track of your favorite dishes');
      return;
    }
    if (favToggleLock.current.has(dishId)) return;
    favToggleLock.current.add(dishId);

    const isFav = favorites.has(dishId);
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(dishId);
      else next.add(dishId);
      return next;
    });

    try {
      if (isFav) {
        await api.delete(`/api/v1/customer/favorites/${dishId}`, token);
      } else {
        await api.post('/api/v1/customer/favorites', { dishId }, token);
      }
    } catch {
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(dishId);
        else next.delete(dishId);
        return next;
      });
    } finally {
      favToggleLock.current.delete(dishId);
    }
  }, [token, favorites]);

  useRealtimeEvent<any>('menu.updated', (payload) => {
    if (payload?.dishId) {
      setDishes(prev => prev.map(d =>
        d.id === payload.dishId ? { ...d, ...payload } : d
      ));
    }
  });

  const categoryNames = ['All', ...categories.map(c => c.name)];

  const filtered = useMemo(() => dishes
    .filter(d => d.isAvailable !== false)
    .filter(d => activeCat === 'All' || d.category?.name === activeCat)
    .filter(d => d.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'price-low') return a.price - b.price;
      if (sort === 'price-high') return b.price - a.price;
      if (sort === 'for-you') {
        const ai = recs.indexOf(a.id);
        const bi = recs.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return 0;
    }), [dishes, activeCat, debouncedSearch, sort, recs]);

  const handleAddToCart = useCallback((dish: Dish) => {
    addItem({
      id: dish.id,
      name: dish.name,
      price: Number(dish.price),
      veg: dish.isVeg,
      image: getDishImage(dish.name, dish.imageUrl, dish.category?.name),
      modifiers: []
    });
    trackEvent('add_to_cart', {
      id: dish.id,
      name: dish.name,
      price: Number(dish.price),
      category: dish.category?.name
    });
    toast.success(`${dish.name} added to cart`, formatPrice(dish.price));
  }, [addItem]);

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😞</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>Unable to load menu</h2>
          <p style={{ color: 'var(--steel)', fontSize: 14, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>{error}</p>
          <button onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px', fontSize: 14, fontWeight: 700, color: '#fff',
              background: '#e23744', border: 'none', borderRadius: 12, cursor: 'pointer',
            }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Our Menu</h1>
        <p style={{ color: '#767676', fontSize: 14 }}>
          {loading ? 'Loading dishes...' : `${filtered.length} dishes available`}
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>🔍</span>
          <input placeholder="Search dishes..." value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search dishes"
            style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '2px solid #e0e0e0', fontSize: 15, background: '#fff', color: '#1c1c1c' }} />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          aria-label="Sort dishes"
          style={{ padding: '12px 16px', borderRadius: 12, border: '2px solid #e0e0e0', fontSize: 14, fontWeight: 600, background: '#fff', color: '#1c1c1c', cursor: 'pointer' }}>
          <option value="popularity">Sort: Popularity</option>
          <option value="for-you">✨ Sort: For You</option>
          <option value="price-low">Sort: Price ↑</option>
          <option value="price-high">Sort: Price ↓</option>
        </select>
      </div>

      <div className="scroll-x" role="tablist" aria-label="Menu categories" style={{ marginBottom: 28, gap: 10, paddingBottom: 4 }}>
        {categoryNames.map(cat => (
          <button key={cat} role="tab" onClick={() => setActiveCat(cat)}
            aria-pressed={activeCat === cat}
            tabIndex={activeCat === cat ? 0 : -1}
            onKeyDown={(e) => {
              const idx = categoryNames.indexOf(activeCat);
              let nextCat: string | null = null;
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextCat = categoryNames[(idx + 1) % categoryNames.length];
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                nextCat = categoryNames[(idx - 1 + categoryNames.length) % categoryNames.length];
              } else if (e.key === 'Home') {
                e.preventDefault(); nextCat = categoryNames[0];
              } else if (e.key === 'End') {
                e.preventDefault(); nextCat = categoryNames[categoryNames.length - 1];
              }
              if (nextCat) {
                setActiveCat(nextCat);
                requestAnimationFrame(() => {
                  const container = (e.target as HTMLElement).parentElement;
                  const nextBtn = container?.querySelector(`button[aria-pressed="true"]`) as HTMLElement;
                  nextBtn?.focus();
                  nextBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                });
              }
            }}
            style={{
              padding: '8px 20px', borderRadius: 24, border: 'none', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              background: activeCat === cat ? '#e23744' : '#f5f5f5',
              color: activeCat === cat ? '#fff' : '#666',
              boxShadow: activeCat === cat ? '0 2px 8px rgba(226,55,68,0.25)' : 'none',
              transition: 'all 0.2s'
            }}>{cat}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {loading ? (
          <div role="status" aria-label="Loading menu" style={{ gridColumn: '1 / -1' }}>
            <span className="sr-only">Loading dishes...</span>
            {Array(6).fill(null).map((_, i) => (
              <div key={i} className="card" style={{
                height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 20,
              }}>
                  <div style={{ color: '#767676', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #eee', borderTopColor: '#e23744', animation: 'spin 0.8s linear infinite' }} />
                  <span>Loading...</span>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#767676', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#666', marginBottom: 4 }}>No dishes found</div>
            <p style={{ fontSize: 14 }}>
              {debouncedSearch
                ? `No results for "${debouncedSearch}". Try a different search term.`
                : 'Try adjusting your category filter.'}
            </p>
          </div>
        ) : (
          filtered.map((dish, i) => (
            <motion.div
              key={dish.id}
              className="card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.5), duration: 0.3 }}
              style={{ display: 'flex', position: 'relative' }}
            >
              {/* Favorite Heart Button */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(dish.id); }}
                aria-label={favorites.has(dish.id) ? `Remove ${dish.name} from favorites` : `Add ${dish.name} to favorites`}
                style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 10,
                  width: 36, height: 36, borderRadius: '50%',
                  border: 'none', cursor: 'pointer',
                  background: favorites.has(dish.id) ? '#e23744' : '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                <span style={{ color: favorites.has(dish.id) ? '#fff' : '#e23744', lineHeight: 1 }}>
                  {favorites.has(dish.id) ? '♥' : '♡'}
                </span>
              </button>

              <div style={{
                width: 120, height: 140, minWidth: 120,
                position: 'relative', overflow: 'hidden'
              }}>
                <img src={getDishImage(dish.name, dish.imageUrl, dish.category?.name)}
                  alt={dish.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { const img = e.target as HTMLImageElement; if (img.src !== FALLBACK_DISH_IMAGE) img.src = FALLBACK_DISH_IMAGE; }} />
                <span className={`tag ${dish.isVeg ? 'tag-veg' : 'tag-nonveg'}`}
                  style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, padding: '2px 7px', zIndex: 1 }}>
                  {dish.isVeg ? 'VEG' : 'NON-VEG'}
                </span>
              </div>
              <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{dish.name}</h3>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#767676' }}>{dish.category?.name || ''}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1c1c1c' }}>{formatPrice(dish.price)}</div>
                  </div>
                  {dish.prepTimeMinutes && (
                    <span className="badge badge-time" style={{ fontSize: 11, padding: '2px 8px' }}>
                      ⏱️ {dish.prepTimeMinutes} min
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleAddToCart(dish)}
                  aria-label={`Add ${dish.name} to cart for ${formatPrice(dish.price)}`}
                  style={{ width: '100%', padding: '8px 0', fontSize: 13, marginTop: 10, borderRadius: 8 }}
                >
                  + Add
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
      <ErrorBoundary fallback={null}><Recommendations /></ErrorBoundary>
    </div>
  );
}
