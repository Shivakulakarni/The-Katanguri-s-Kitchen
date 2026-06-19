'use client';

import { useOrderStream } from '@/lib/useRealtime';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Check } from 'lucide-react';
import { toast } from '../lib/toast-store';
import { useCartStore } from '../lib/cart-store';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

const RiderMap = dynamic(() => import('../components/RiderMap'), { ssr: false });

const statusList = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const statusLabels: Record<string, { label: string; icon: string; desc: string }> = {
  PENDING:          { label: 'Order Placed',     icon: '✅', desc: 'Order received and awaiting confirmation' },
  CONFIRMED:        { label: 'Confirmed',        icon: '📋', desc: 'Restaurant has accepted your order' },
  PREPARING:        { label: 'Preparing',        icon: '👨‍🍳', desc: 'Your food is being cooked fresh' },
  READY:            { label: 'Quality Check',    icon: '✅', desc: 'Chef is checking the quality' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', icon: '🛵', desc: 'Delivery partner is on the way' },
  DELIVERED:        { label: 'Delivered',        icon: '', desc: 'Enjoy your meal!' },
  CANCELLED:        { label: 'Cancelled',        icon: '❌', desc: 'This order was cancelled' },
};

function TrackPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdStr = searchParams?.get('id') ?? null;
  const orderIdRaw = orderIdStr ? parseInt(orderIdStr) : null;
  const orderId = orderIdRaw !== null && !isNaN(orderIdRaw) ? orderIdRaw : null;
  const { orderData, status: connStatus, isLive, fetchError } = useOrderStream(orderId ?? 0);

  // Rider tracking state — hooks must be before any early return
  const [riderPos, setRiderPos] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const { addItem } = useCartStore();
  const currentStatus = orderData?.order?.status || orderData?.status || 'PENDING';
  const showMap = orderId !== null && currentStatus !== 'PENDING' && currentStatus !== 'CANCELLED';
  const canCancel = currentStatus === 'PENDING' || currentStatus === 'CONFIRMED';
  const canRetryPayment = currentStatus === 'PENDING' && orderData?.order?.paymentIntentId == null;

  const handleCancel = useCallback(async () => {
    if (!orderId || !confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success('Order Cancelled', 'Your order has been cancelled successfully');
      } else {
        const data = await res.json();
        toast.error('Cancel failed', data.error || 'Failed to cancel order');
      }
    } catch {
      toast.error('Cancel failed', 'Network error — please try again');
    } finally {
      setCancelling(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId || !showMap) return;

    const es = new EventSource(`/api/v1/rider/stream/${orderId}`, { withCredentials: true });
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'location' && data.payload) {
          setRiderPos(data.payload);
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        es.close();
      }
    };

    return () => es.close();
  }, [orderId, showMap]);

  if (orderId === null) {
    return (
      <div className="container" style={{ paddingTop: 80, maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛵</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Track Your Order</h1>
          <p style={{ color: '#767676', fontSize: 14, marginBottom: 24 }}>
            Enter your order ID to see real-time preparation and delivery updates.
          </p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const val = (e.currentTarget.elements.namedItem('orderId') as HTMLInputElement).value;
            if (val) router.push(`/track?id=${val}`);
          }}>
            <input name="orderId" placeholder="Order ID (e.g. 101)" required type="number" aria-label="Order ID"
              style={{ width: '100%', height: 44, padding: '0 16px', borderRadius: 10, border: '2px solid #e4e7eb', fontSize: 15, marginBottom: 16 }} />
            <button className="btn btn-buy-cta" type="submit" style={{ width: '100%', padding: '12px 0', fontSize: 15 }}>
              Track Status
            </button>
          </form>
        </div>
      </div>
    );
  }

  const items = orderData?.items || [];

  const activeIdx = statusList.indexOf(currentStatus);
  const isCancelled = currentStatus === 'CANCELLED';
  const effectiveIdx = isCancelled ? activeIdx + 1 : activeIdx;

  return (
    <div className="container" style={{ paddingTop: 24, maxWidth: 640, margin: '0 auto' }}>
      {/* Live indicator */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: 12,
        fontSize: 12, fontWeight: 600, color: isLive ? '#2e7d32' : '#767676'
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
            background: isLive ? '#2e7d32' : '#767676',
          animation: isLive ? 'pulse 2s infinite' : 'none'
        }} />
        {isLive ? 'LIVE' : connStatus === 'connecting' ? 'Connecting...' : 'Offline'}
      </div>

      {/* Status Ring */}
      <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', margin: '0 auto 16px',
          background: isCancelled
            ? '#fce4ec'
            : `conic-gradient(#e23744 ${(effectiveIdx / (statusList.length - 1)) * 360}deg, #f0f0f0 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36
          }}>
            {isCancelled ? '❌' : statusLabels[currentStatus]?.icon || '📋'}
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          Order #{orderData?.order?.id || orderId}
        </h1>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 20px', borderRadius: 24,
          background: isCancelled ? '#fce4ec' : '#fff5f5',
          color: isCancelled ? '#c62828' : '#e23744',
          fontSize: 14, fontWeight: 700
        }}>
          {statusLabels[currentStatus]?.label || currentStatus}
        </div>
      </div>

      {/* Progress Timeline — updated in real time */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📍 Live Status</h2>
        <div style={{ position: 'relative', paddingLeft: 36 }}>
          <div style={{
            position: 'absolute', left: 13, top: 12, bottom: 12, width: 2.5,
            background: 'linear-gradient(to bottom, #e23744, #f0f0f0)'
          }} />
          {statusList.map((s, i) => {
            const info = statusLabels[s];
            const completed = i < activeIdx;
            const active = i === activeIdx;
            const progress = statusList.indexOf(currentStatus);
            return (
              <div key={s} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                marginBottom: 24, position: 'relative',
                opacity: isCancelled && i > progress ? 0.3 : (i <= progress || (isCancelled && i === progress) ? 1 : 0.4),
                transition: 'all 0.5s ease'
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: completed ? '#e23744' : active ? '#e23744' : '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff', fontWeight: 700,
                  flexShrink: 0, zIndex: 1,
                  boxShadow: active ? '0 0 0 4px rgba(226,55,68,0.2)' : 'none',
                  transition: 'all 0.3s'
                }}>
                  {completed ? <Check size={14} /> : i + 1}
                </div>
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{info.label}</div>
                  <div style={{ fontSize: 13, color: '#767676' }}>{info.desc}</div>
                </div>
                {active && !isCancelled && (
                  <div style={{
                    padding: '3px 10px', background: '#fff5f5', color: '#e23744',
                    borderRadius: 12, fontSize: 10, fontWeight: 700
                  }}>
                    LIVE
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Rider Map — shows when order is out for delivery or delivered */}
      {showMap && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🛵 Live Tracking</h2>
          <RiderMap
            riderPosition={riderPos}
            deliveryLat={orderData?.order?.deliveryLat}
            deliveryLng={orderData?.order?.deliveryLng}
            height={280}
          />
        </div>
      )}

      {/* Order Items */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🍽️ Order Items</h2>
        {items.length > 0 ? items.map((item: any) => (
          <div key={item.dishId || item.id} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: '1px solid #f5f5f5', fontSize: 14
          }}>
            <span>{item.dishName || item.name || `Dish #${item.dishId}`} <span style={{ color: '#767676' }}>x{item.quantity || item.qty}</span></span>
            <span style={{ fontWeight: 600 }}>{formatPrice((item.unitPrice || item.price || 0) * (item.quantity || item.qty || 1))}</span>
          </div>
        )        ) : fetchError ? (
          <div style={{ color: '#e23744', fontSize: 14, padding: '8px 0', textAlign: 'center' }}>
            {fetchError}
          </div>
        ) : (
          <div style={{ color: '#767676', fontSize: 14, padding: '8px 0' }}>Loading items...</div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 12,
          paddingTop: 12, borderTop: '2px solid #1c1c1c', fontSize: 16, fontWeight: 800
        }}>
          <span>Total</span>
          <span style={{ color: '#e23744' }}>{orderData?.order?.totalAmount != null ? formatPrice(Number(orderData?.order?.totalAmount || orderData?.totalAmount)) : '—'}</span>
        </div>
      </div>

      {/* Action Buttons */}
      {(canCancel || canRetryPayment) && (
        <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', gap: 12 }}>
          {canRetryPayment && (
            <button
              className="btn btn-buy-cta"
              style={{ flex: 1, padding: '12px 0', fontSize: 14 }}
              onClick={() => router.push(`/checkout?retry=${orderId}`)}
            >
              💳 Retry Payment
            </button>
          )}
          {canCancel && (
            <button
              className="btn-secondary"
              style={{ flex: 1, padding: '12px 0', fontSize: 14, color: '#ef4444', borderColor: '#fca5a5' }}
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : '✕ Cancel Order'}
            </button>
          )}
        </div>
      )}

      {/* Reorder Button */}
      {currentStatus === 'DELIVERED' && items.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <button
            className="btn btn-buy-cta"
            style={{ width: '100%', padding: '14px 0', fontSize: 16 }}
            onClick={() => {
              for (const item of items) {
                addItem({
                  id: item.dishId,
                  name: item.dishName || item.name || `Dish #${item.dishId}`,
                  price: Number(item.unitPrice || item.price || 0),
                  veg: item.isVeg ?? true,
                  image: item.imageUrl || '',
                  modifiers: item.modifiers || [],
                });
              }
              toast.success('Added to cart', `${items.length} item(s) added from Order #${orderId}`);
              router.push('/cart');
            }}
          >
            🔄 Reorder — Add All to Cart
          </button>
        </div>
      )}

      {isLive && (
        <div style={{
          textAlign: 'center', padding: '12px', background: '#e8f5e9', color: '#2e7d32',
          borderRadius: 12, fontSize: 13, fontWeight: 600, marginBottom: 48
        }}>
          🔄 Live updates enabled — this page updates automatically
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="container" style={{ paddingTop: 24, textAlign: 'center' }}>Loading...</div>}>
      <TrackPageInner />
    </Suspense>
  );
}
