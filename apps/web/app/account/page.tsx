'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { api } from '../lib/api';
import Link from 'next/link';
import { useAuthStore } from '../lib/auth-store';
import { toast } from '../lib/toast-store';
import { getDishImage, FALLBACK_DISH_IMAGE } from '../lib/dish-images';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

interface CustomerProfile { id: number; name: string | null; email: string | null; phone: string | null; role: string; createdAt: string; }
interface Order { id: number; status: string; totalAmount: string; createdAt: string; notes: string | null; }
interface Address { id: number; label: string | null; addressLine1: string; addressLine2: string | null; city: string; state: string; pincode: string; isDefault: boolean | null; }
interface Favorite { id: number; dishId: number; dishName: string; dishPrice: string; dishImageUrl: string | null; dishIsVeg: boolean | null; createdAt: string; }
interface CustomerStats { totalOrders: number; totalSpent: number; avgOrderValue: number; favoriteCount: number; addressCount: number; lastOrder: { date: string; total: string; status: string } | null; recentOrders: { id: number; totalAmount: string; status: string; createdAt: string }[]; }

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Quality Check',
  OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', CONFIRMED: '#3b82f6', PREPARING: '#f97316', READY: '#8b5cf6',
  OUT_FOR_DELIVERY: '#06b6d4', DELIVERED: '#10b981', CANCELLED: '#ef4444',
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'orders', label: 'Orders', icon: '📋' },
  { key: 'favorites', label: 'Favorites', icon: '❤️' },
  { key: 'addresses', label: 'Addresses', icon: '📍' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AccountPage() {
  const { token, user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: 'Home', addressLine1: '', addressLine2: '', city: 'Warangal', state: 'Telangana', pincode: '' });
  const [savingAddress, setSavingAddress] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Record<number, string>>({});
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const sseRefs = useRef<Map<number, EventSource>>(new Map());
  const flashTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!token || !user) { setLoading(false); return; }
    let cancelled = false;
    Promise.all([
      api.get<{ customer: CustomerProfile }>('/api/v1/customer/profile', token),
      api.get<{ orders: Order[] }>('/api/v1/orders', token),
      api.get<{ addresses: Address[] }>('/api/v1/customer/addresses', token),
      api.get<{ favorites: Favorite[] }>('/api/v1/customer/favorites', token),
      api.get<CustomerStats>('/api/v1/customer/stats', token),
    ]).then(([p, o, a, f, s]) => {
      if (cancelled) return;
      setProfile(p.customer);
      setOrders(o.orders || []);
      setAddresses(a.addresses || []);
      setFavorites(f.favorites || []);
      setStats(s);
      setEditName(p.customer?.name || '');
      setEditEmail(p.customer?.email || '');
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError('Failed to load account data');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  // SSE for active orders
  useEffect(() => {
    if (!user) return;
    const activeOrders = orders.filter(o => {
      const status = liveStatuses[o.id] || o.status;
      return ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(status);
    });
    for (const order of activeOrders) {
      if (sseRefs.current.has(order.id)) continue;
      const es = new EventSource(`/api/v1/orders/${order.id}/stream`, { withCredentials: true });
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (evt.type === 'status_change' && evt.payload?.status) {
            const newStatus = evt.payload.status;
            setLiveStatuses(prev => ({ ...prev, [order.id]: newStatus }));
            setFlashIds(prev => { const s = new Set(prev); s.add(order.id); return s; });
            if (flashTimeouts.current.has(order.id)) clearTimeout(flashTimeouts.current.get(order.id)!);
            flashTimeouts.current.set(order.id, setTimeout(() => {
              setFlashIds(prev => { const s = new Set(prev); s.delete(order.id); return s; });
            }, 2000));
            if (!['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(newStatus)) {
              es.close(); sseRefs.current.delete(order.id);
            }
          }
        } catch {}
      };
      sseRefs.current.set(order.id, es);
    }
    return () => {
      for (const es of Array.from(sseRefs.current.values())) es.close();
      sseRefs.current.clear();
      for (const t of flashTimeouts.current.values()) clearTimeout(t);
    };
  }, [orders, user]);

  const handleSaveProfile = async () => {
    if (!token) return;
    try {
      await api.patch('/api/v1/customer/profile', { name: editName, email: editEmail }, token);
      setProfile(prev => prev ? { ...prev, name: editName, email: editEmail } : prev);
      setEditingProfile(false);
      toast.success('Profile updated', 'Your changes have been saved');
    } catch {
      toast.error('Update failed', 'Please try again');
    }
  };

  const handleAddAddress = async () => {
    if (!token) return;
    if (!newAddress.addressLine1 || !newAddress.pincode) {
      toast.error('Missing fields', 'Please fill in address line and pincode');
      return;
    }
    setSavingAddress(true);
    try {
      const res = await api.post<{ address: Address }>('/api/v1/customer/addresses', newAddress, token);
      setAddresses(prev => [...prev, res.address]);
      setShowAddressForm(false);
      setNewAddress({ label: 'Home', addressLine1: '', addressLine2: '', city: 'Warangal', state: 'Telangana', pincode: '' });
      toast.success('Address added', `${res.address.label || 'Address'} has been saved`);
    } catch {
      toast.error('Failed to add address', 'Please try again');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!token) return;
    try {
      await api.delete(`/api/v1/customer/addresses/${id}`, token);
      setAddresses(prev => prev.filter(a => a.id !== id));
      toast.success('Address removed', '');
    } catch {
      toast.error('Failed to remove address', 'Please try again');
    }
  };

  const handleRemoveFavorite = async (dishId: number) => {
    if (!token) return;
    try {
      await api.delete(`/api/v1/customer/favorites/${dishId}`, token);
      setFavorites(prev => prev.filter(f => f.dishId !== dishId));
      toast.success('Removed from favorites', '');
    } catch {
      toast.error('Failed to remove', 'Please try again');
    }
  };

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 48, maxWidth: 780, margin: '0 auto' }}>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 8, color: 'var(--ink-deep)' }}>Sign in to view your account</h2>
          <p style={{ color: 'var(--steel)', marginBottom: 24, fontSize: 16 }}>Track orders, manage addresses, and more</p>
          <Link href="/auth" className="btn btn-buy-cta">Sign In</Link>
        </div>
      </div>
    );
  }

  const initials = profile?.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const displayName = profile?.name || user?.name || 'Guest';

  return (
    <div className="container" style={{ paddingTop: 24, maxWidth: 900, margin: '0 auto' }}>
      <style>{`
        @keyframes accFlash { 0%{background:#fef9c3} 100%{background:transparent} }
        .acc-row-flash { animation: accFlash 2s ease; }
        .profile-tab { padding: 10px 18px; border: none; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--steel); }
        .profile-tab.active { background: #e23744; color: #fff; box-shadow: 0 2px 8px rgba(226,55,68,0.25); }
        .profile-tab:hover:not(.active) { background: rgba(226,55,68,0.08); color: var(--ink-deep); }
        .stat-card { padding: 20px; border-radius: 16px; background: var(--surface); border: 1px solid var(--hairline-soft); text-align: center; }
        .stat-value { font-size: 28px; font-weight: 800; color: var(--ink-deep); }
        .stat-label { font-size: 12px; color: var(--steel); margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      `}</style>

      {/* Profile Header */}
      <div className="card" style={{ padding: 28, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #e23744 0%, #c62828 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 2 }}>{displayName}</h1>
          <p style={{ color: 'var(--steel)', fontSize: 14 }}>{profile?.phone || user?.phone || ''} {profile?.email ? `• ${profile.email}` : ''}</p>
          {profile?.role === 'admin' && (
            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 12, background: 'rgba(226,55,68,0.1)', color: '#e23744', fontSize: 11, fontWeight: 700 }}>Admin</span>
          )}
        </div>
        <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 20px' }} onClick={() => logout()}>Sign Out</button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(tab => (
          <button key={tab.key}
            className={`profile-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            <span style={{ marginRight: 6 }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--steel)' }}>Loading...</div>
      ) : error ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--critical)' }}>{error}</div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div>
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-value">{stats?.totalOrders || 0}</div>
                  <div className="stat-label">Total Orders</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{formatPrice(stats?.totalSpent || 0)}</div>
                  <div className="stat-label">Total Spent</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{formatPrice(stats?.avgOrderValue || 0)}</div>
                  <div className="stat-label">Avg Order</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats?.favoriteCount || 0}</div>
                  <div className="stat-label">Favorites</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats?.addressCount || 0}</div>
                  <div className="stat-label">Addresses</div>
                </div>
              </div>

              {/* Recent Activity */}
              {stats?.recentOrders && stats.recentOrders.length > 0 && (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hairline-soft)', fontWeight: 700, fontSize: 16 }}>Recent Orders</div>
                  {stats.recentOrders.map((order, i) => (
                    <Link key={order.id} href={`/track?id=${order.id}`}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < (stats.recentOrders.length - 1) ? '1px solid var(--hairline-soft)' : 'none', textDecoration: 'none' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-deep)' }}>#{order.id}</span>
                        <span style={{ fontSize: 13, color: 'var(--steel)', marginLeft: 10 }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLORS[order.status] || '#666', padding: '2px 10px', borderRadius: 8, background: `${STATUS_COLORS[order.status] || '#666'}15` }}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-deep)' }}>{formatPrice(parseFloat(order.totalAmount))}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              {orders.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--steel)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                  <p>No orders yet. <Link href="/menu" style={{ color: '#e23744', fontWeight: 700 }}>Browse the menu</Link>!</p>
                </div>
              ) : orders.map((order, i) => {
                const currentStatus = liveStatuses[order.id] || order.status;
                const isCancelled = currentStatus === 'CANCELLED';
                const isDelivered = currentStatus === 'DELIVERED';
                const isFlashing = flashIds.has(order.id);
                return (
                  <Link key={order.id} href={`/track?id=${order.id}`}
                    className={isFlashing ? 'acc-row-flash' : ''}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i < orders.length - 1 ? '1px solid var(--hairline-soft)' : 'none', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: isCancelled ? 'rgba(239,68,68,0.1)' : isDelivered ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {isCancelled ? '❌' : isDelivered ? '✅' : '⏳'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-deep)' }}>#{order.id}</div>
                        <div style={{ fontSize: 13, color: 'var(--steel)' }}>{new Date(order.createdAt).toLocaleDateString()} • {STATUS_LABELS[currentStatus] || currentStatus}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-deep)' }}>{formatPrice(parseFloat(order.totalAmount))}</div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* FAVORITES TAB */}
          {activeTab === 'favorites' && (
            <div>
              {favorites.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--steel)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>❤️</div>
                  <p>No favorites yet. <Link href="/menu" style={{ color: '#e23744', fontWeight: 700 }}>Browse the menu</Link> and tap the heart icon!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                  {favorites.map(fav => (
                    <div key={fav.id} className="card" style={{ display: 'flex', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: 100, height: 100, position: 'relative', flexShrink: 0 }}>
                        <Image src={getDishImage(fav.dishName, fav.dishImageUrl)}
                          alt={fav.dishName} fill sizes="100px"
                          style={{ objectFit: 'cover' }}
                          onError={e => { const img = e.target as HTMLImageElement; if (img.src !== FALLBACK_DISH_IMAGE) img.src = FALLBACK_DISH_IMAGE; }} />
                      </div>
                      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{fav.dishName}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#e23744', marginTop: 4 }}>{formatPrice(parseFloat(fav.dishPrice))}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <Link href="/menu" style={{ fontSize: 12, fontWeight: 700, color: '#e23744', textDecoration: 'none' }}>Order Again</Link>
                          <button onClick={() => handleRemoveFavorite(fav.dishId)}
                            style={{ fontSize: 12, color: 'var(--steel)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveFavorite(fav.dishId)}
                        aria-label={`Remove ${fav.dishName} from favorites`}
                        style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                        ❤️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADDRESSES TAB */}
          {activeTab === 'addresses' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Your Addresses</h3>
                <button onClick={() => setShowAddressForm(!showAddressForm)}
                  style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#e23744', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {showAddressForm ? 'Cancel' : '+ Add Address'}
                </button>
              </div>

              {showAddressForm && (
                <div className="card" style={{ padding: 24, marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--steel)', display: 'block', marginBottom: 4 }}>Label</label>
                      <select value={newAddress.label} onChange={e => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }}>
                        <option>Home</option><option>Work</option><option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--steel)', display: 'block', marginBottom: 4 }}>Pincode</label>
                      <input value={newAddress.pincode} onChange={e => setNewAddress(prev => ({ ...prev, pincode: e.target.value }))}
                        placeholder="500001" maxLength={6}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--steel)', display: 'block', marginBottom: 4 }}>Address Line 1</label>
                      <input value={newAddress.addressLine1} onChange={e => setNewAddress(prev => ({ ...prev, addressLine1: e.target.value }))}
                        placeholder="Street address, apartment, etc."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--steel)', display: 'block', marginBottom: 4 }}>City</label>
                      <input value={newAddress.city} onChange={e => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--steel)', display: 'block', marginBottom: 4 }}>State</label>
                      <input value={newAddress.state} onChange={e => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
                    </div>
                  </div>
                  <button onClick={handleAddAddress} disabled={savingAddress}
                    style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#e23744', color: '#fff', fontSize: 14, fontWeight: 700, cursor: savingAddress ? 'wait' : 'pointer', opacity: savingAddress ? 0.7 : 1 }}>
                    {savingAddress ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              )}

              {addresses.length === 0 && !showAddressForm ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--steel)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
                  <p>No addresses saved yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {addresses.map(addr => (
                    <div key={addr.id} className="card" style={{ padding: 16, position: 'relative' }}>
                      {addr.isDefault && (
                        <span style={{ position: 'absolute', top: 12, right: 12, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 10, fontWeight: 700 }}>DEFAULT</span>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{addr.label || 'Address'}</div>
                      <div style={{ fontSize: 13, color: 'var(--steel)', lineHeight: 1.5 }}>
                        {addr.addressLine1}<br />
                        {addr.addressLine2 && <>{addr.addressLine2}<br /></>}
                        {addr.city}, {addr.state} - {addr.pincode}
                      </div>
                      <button onClick={() => handleDeleteAddress(addr.id)}
                        style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="card" style={{ padding: 28 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Account Settings</h3>

              {editingProfile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--steel)', display: 'block', marginBottom: 4 }}>Name</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--steel)', display: 'block', marginBottom: 4 }}>Email</label>
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleSaveProfile}
                      style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#e23744', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      Save Changes
                    </button>
                    <button onClick={() => { setEditingProfile(false); setEditName(profile?.name || ''); setEditEmail(profile?.email || ''); }}
                      style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'transparent', color: 'var(--steel)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--steel)', fontWeight: 600 }}>Name</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{profile?.name || 'Not set'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--steel)', fontWeight: 600 }}>Email</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{profile?.email || 'Not set'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--steel)', fontWeight: 600 }}>Phone</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{profile?.phone || 'Not set'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--steel)', fontWeight: 600 }}>Member Since</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Unknown'}</div>
                    </div>
                  </div>
                  <button onClick={() => setEditingProfile(true)}
                    style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'transparent', color: 'var(--ink-deep)', fontSize: 14, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
