'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useCartStore } from '../lib/cart-store';
import { useAuthStore } from '../lib/auth-store';
import { toast } from '../lib/toast-store';
import { ensureAppError } from '../lib/errors';
import StripePayment from '../components/StripePayment';
import { CreditCard, Smartphone, DollarSign, Check } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

/** Indian pincode validation — 6 digits */
function isValidPincode(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/** Validate delivery address form fields */
function validateAddress(addr: { line: string; city: string; pincode: string }): string | null {
  if (!addr.line.trim()) return 'Please enter your delivery address';
  if (addr.line.trim().length < 5) return 'Please enter a complete address';
  if (!addr.city.trim()) return 'Please enter your city';
  if (addr.city.trim().length < 2) return 'Please enter a valid city name';
  if (!addr.pincode.trim()) return 'Please enter your pincode';
  if (!isValidPincode(addr.pincode.trim())) return 'Pincode must be exactly 6 digits';
  return null;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal, clearCart, getItemTotal } = useCartStore();
  const { token, user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState({ line: '', city: '', pincode: '' });
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [payment, setPayment] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [isPaymentStep, setIsPaymentStep] = useState(false);
  const [tip, setTip] = useState(0);
  const submittingRef = useRef(false);

  const subtotal = getTotal();
  const deliveryFee = subtotal >= 500 ? 0 : 40;
  const total = subtotal + deliveryFee + tip;

  const steps = ['Delivery Details', 'Payment', 'Confirm'];

  // Fetch saved customer addresses
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get('/api/v1/customer/addresses', token || undefined)
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.addresses || []);
        if (list.length > 0) {
          setSavedAddresses(list);
          const def = list.find((a: any) => a.isDefault);
          if (def) {
            setSelectedAddressId(def.id);
            setAddress({ line: def.addressLine1, city: def.city, pincode: def.pincode });
          }
        }
      })
      .catch(err => { if (cancelled) return; console.error('Failed to load addresses:', err); setError('Could not load saved addresses'); });
    return () => { cancelled = true; };
  }, [token]);

  /** Validate step 1 fields and show inline errors */
  const validateStep1 = useCallback((): boolean => {
    const err = validateAddress(address);
    if (err) {
      setFieldErrors({ address: err });
      toast.warning('Please fix the address', err);
      return false;
    }
    setFieldErrors({});
    return true;
  }, [address]);

  const handlePlaceOrder = async () => {
    if (submittingRef.current) return;
    if (!items.length) { setError('Cart is empty'); toast.error('Cart is empty', 'Add items before checking out'); return; }
    if (!user) { setError('Please sign in to place an order'); toast.error('Sign in required', 'Please sign in to place an order'); router.push('/auth?redirect=/checkout'); return; }
    if (total <= 0) { setError('Order total must be greater than 0'); toast.error('Invalid order', 'Order total must be greater than 0'); return; }
    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      let addressId = selectedAddressId;

      // If no address selected but user has typed one in, save it dynamically
      if (!addressId && address.line) {
        try {
          const res = await api.post('/api/v1/customer/addresses', {
            addressLine1: address.line,
            city: address.city,
            state: 'Telangana',
            pincode: address.pincode,
            label: 'Home',
          }, token ?? undefined);
          if (res) {
            const newAddr = res.address || res;
            addressId = newAddr.id;
          }
        } catch {
          toast.warning('Address save failed', 'Your address was not saved but the order will continue');
        }
      }

      // For card/UPI payments, attempt payment first before creating order
      if (payment === 'card' || payment === 'upi') {
        try {
          // Reuse existing order if retrying after payment failure
          let orderId = createdOrderId;
          if (!orderId) {
            const orderItems = items.map(item => ({
              dishId: item.id,
              quantity: item.quantity,
              unitPrice: item.price,
              modifiers: (item.modifiers || []).map(m => ({ name: m.name, label: m.label, price: m.price })),
            }));

            const orderNotes = [`${address.line}, ${address.city} - ${address.pincode}`, tip > 0 ? `Rider tip: ₹${tip}` : ''].filter(Boolean).join(' | ');
            const data = await api.post('/api/v1/orders', {
              items: orderItems,
              deliveryAddressId: addressId || null,
              notes: orderNotes,
            }, token || undefined);

            if (data.error) { setError(data.error); toast.error('Order failed', data.error); return; }

            orderId = data.order?.id;
            if (!orderId) { setError('Failed to create order'); toast.error('Order failed', 'Server returned an invalid response'); return; }
          }

          const paymentData = await api.post('/api/v1/payments/create-intent', {
            orderId, amount: total, currency: 'INR',
          }, token ?? undefined);

          if (paymentData.clientSecret) {
            setClientSecret(paymentData.clientSecret);
            setCreatedOrderId(orderId);
            setIsPaymentStep(true);
            return; // Stay on page — show Stripe form
          }

          // If no clientSecret returned, fall through to COD
          toast.warning('Card payment unavailable', 'Continuing with Cash on Delivery');
          trackEvent('purchase', { orderId, amount: total, paymentType: 'cod' });
          clearCart();
          toast.success('Order placed!', `Order #${orderId} is being prepared`);
          router.push(`/track?id=${orderId}`);
          return;
        } catch (payErr: unknown) {
          const payAppError = ensureAppError(payErr);
          if (payAppError.statusCode === 401) {
            toast.error('Session expired', 'Please sign in again to complete your payment');
            router.push('/auth?redirect=/checkout');
            return;
          }
          // Payment setup failed — let user choose COD or retry
          toast.warning('Card payment unavailable', 'Please choose Cash on Delivery or try again');
          return;
        }
      }

      // COD flow: create order directly
      const orderItems = items.map(item => ({
        dishId: item.id,
        quantity: item.quantity,
        unitPrice: item.price,
        modifiers: (item.modifiers || []).map(m => ({ name: m.name, label: m.label, price: m.price })),
      }));

      const codNotes = [`${address.line}, ${address.city} - ${address.pincode}`, tip > 0 ? `Rider tip: ₹${tip}` : ''].filter(Boolean).join(' | ');
      const data = await api.post('/api/v1/orders', {
        items: orderItems,
        deliveryAddressId: addressId || null,
        notes: codNotes,
      }, token || undefined);

      if (data.error) { setError(data.error); toast.error('Order failed', data.error); return; }

      const orderId = data.order?.id;
      if (!orderId) { setError('Failed to create order'); toast.error('Order failed', 'Server returned an invalid response'); return; }

      trackEvent('purchase', { orderId, amount: total, paymentType: 'cod' });
      clearCart();
      toast.success('Order placed!', `Order #${orderId} is being prepared`);
      router.push(`/track?id=${orderId}`);
    } catch (err: unknown) {
      const appError = ensureAppError(err);
      const msg = appError.message || 'Failed to place order';
      setError(msg);
      toast.error('Order failed', appError.category === 'network' ? 'Check your connection and try again' : msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handlePaymentSuccess = () => {
    trackEvent('purchase', { orderId: createdOrderId, amount: total, paymentType: 'card' });
    clearCart();
    toast.success('Payment successful!', `Order #${createdOrderId} confirmed`);
    router.push(`/track?id=${createdOrderId}`);
  };

  const handlePaymentError = (msg: string) => {
    toast.error('Payment failed', msg);
    setIsPaymentStep(false);
    setClientSecret(null);
    // Don't clear createdOrderId — retry should reuse existing order
  };

  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 36, fontWeight: 500, marginBottom: 32, letterSpacing: '-0.5px' }}>Checkout</h1>

      {/* Progress Steps */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 40, position: 'relative' }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--rounded-circle)',
              background: i <= step ? 'var(--ink-deep)' : 'var(--surface-soft)',
              color: i <= step ? 'var(--canvas)' : 'var(--stone)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, margin: '0 auto 8px',
              transition: 'all 0.2s',
            }}>
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: i <= step ? 'var(--ink-deep)' : 'var(--stone)', letterSpacing: '-0.14px' }}>{s}</div>
            {i < steps.length - 1 && (
              <div style={{ position: 'absolute', top: 20, left: 'calc(50% + 20px)', width: 'calc(100% - 40px)', height: 2, background: i < step ? 'var(--ink-deep)' : 'var(--hairline)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Address */}
      {step === 1 && (
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: 'var(--ink-deep)' }}>Delivery Address</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <input placeholder="Address line" value={address.line}
                onChange={e => { setSelectedAddressId(null); setAddress(p => ({ ...p, line: e.target.value })); setFieldErrors({}); }}
                aria-label="Delivery address"
                aria-invalid={!!fieldErrors.address}
                style={{ height: 44, borderColor: fieldErrors.address ? '#e23744' : undefined }} />
              {fieldErrors.address && (
                <p style={{ fontSize: 12, color: '#e23744', marginTop: 4 }}>{fieldErrors.address}</p>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <input placeholder="City" value={address.city}
                onChange={e => { setSelectedAddressId(null); setAddress(p => ({ ...p, city: e.target.value })); setFieldErrors({}); }}
                aria-label="City"
                style={{ height: 44 }} />
              <div>
                <input placeholder="Pincode" value={address.pincode}
                  onChange={e => { setSelectedAddressId(null); setAddress(p => ({ ...p, pincode: e.target.value })); setFieldErrors({}); }}
                  aria-label="Pincode (6 digits)"
                  maxLength={6}
                  style={{ height: 44, borderColor: address.pincode && !isValidPincode(address.pincode) ? '#e23744' : undefined }} />
                {address.pincode && !isValidPincode(address.pincode) && (
                  <p style={{ fontSize: 11, color: '#e23744', marginTop: 2 }}>Must be 6 digits</p>
                )}
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--steel)', marginBottom: 8, letterSpacing: '-0.14px' }}>SAVED ADDRESSES</div>
              {savedAddresses.map((addr: any) => (
                <div key={addr.id} onClick={() => {
                  setSelectedAddressId(addr.id);
                  setAddress({ line: addr.addressLine1, city: addr.city, pincode: addr.pincode });
                  setFieldErrors({});
                }} className={`radio-option ${selectedAddressId === addr.id ? 'radio-option-selected' : ''}`} style={{ cursor: 'pointer', marginBottom: 8 }}>
                  <strong>[{addr.label}]</strong> {addr.addressLine1}, {addr.city} - {addr.pincode}
                </div>
              ))}
              {savedAddresses.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--stone)', fontStyle: 'italic', padding: 8 }}>
                  No saved addresses found. Fill out the fields to create a new one.
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 24, padding: '14px 0' }}
            onClick={() => { if (validateStep1()) setStep(2); }}>
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Payment */}
      {step === 2 && (
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: 'var(--ink-deep)' }}>Payment Method</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'card', label: 'Credit / Debit Card', icon: <CreditCard size={24} />, desc: 'Visa, Mastercard, Rupay — powered by Stripe' },
              { id: 'upi', label: 'UPI', icon: <Smartphone size={24} />, desc: 'Google Pay, PhonePe, Paytm' },
              { id: 'cod', label: 'Cash on Delivery', icon: <DollarSign size={24} />, desc: 'Pay when you receive' },
            ].map(p => (
              <label key={p.id} htmlFor={`pay-${p.id}`} className={`radio-option ${payment === p.id ? 'radio-option-selected' : ''}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}>
                <input type="radio" id={`pay-${p.id}`} name="payment" value={p.id} checked={payment === p.id} onChange={() => setPayment(p.id)} style={{ accentColor: 'var(--primary)' }} />
                {p.icon}
                <div><div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-deep)' }}>{p.label}</div><div style={{ fontSize: 13, color: 'var(--steel)' }}>{p.desc}</div></div>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-buy-cta" style={{ flex: 2 }} onClick={() => setStep(3)}>Review Order →</button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="card" style={{ padding: 32 }}>
          {isPaymentStep && clientSecret && createdOrderId ? (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: 'var(--ink-deep)' }}>Complete Payment</h2>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--steel)', marginBottom: 6, letterSpacing: '-0.14px' }}>📍 DELIVERY TO</div>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>{address.line}, {address.city} — {address.pincode}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: 16, marginBottom: 20 }}>
                {items.map((item, i) => (
                  <div key={item.id || i} style={{ padding: '6px 0', fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ink)' }}>{item.name} <span style={{ color: 'var(--steel)' }}>x{item.quantity}</span></span>
                      <span style={{ fontWeight: 700, color: 'var(--ink-deep)' }}>{formatPrice(getItemTotal(item))}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '2px solid var(--ink-deep)', paddingTop: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                  <span style={{ color: 'var(--ink-deep)' }}>Total</span><span style={{ color: 'var(--primary)' }}>{formatPrice(total)}</span>
                </div>
              </div>
              <StripePayment
                orderId={createdOrderId}
                amount={total}
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
              <button className="btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => { setIsPaymentStep(false); setClientSecret(null); router.push(`/track?id=${createdOrderId}`); }}>← Cancel Payment</button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: 'var(--ink-deep)' }}>Order Summary</h2>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--steel)', marginBottom: 6, letterSpacing: '-0.14px' }}>📍 DELIVERY TO</div>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
                  {address.line || 'No address provided'}<br />
                  {address.city ? `${address.city} — ` : ''}{address.pincode || ''}
                </p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--steel)', marginBottom: 6, letterSpacing: '-0.14px' }}>PAYMENT METHOD</div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{payment === 'card' ? 'Credit Card' : payment === 'upi' ? 'UPI' : 'Cash on Delivery'}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: 16, marginBottom: 20 }}>
                {items.map((item, i) => (
                  <div key={item.id || i} style={{ padding: '6px 0', fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ink)' }}>{item.name} <span style={{ color: 'var(--steel)' }}>x{item.quantity}</span></span>
                      <span style={{ fontWeight: 700, color: 'var(--ink-deep)' }}>{formatPrice(getItemTotal(item))}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '2px solid var(--ink-deep)', paddingTop: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span style={{ color: 'var(--steel)' }}>Subtotal</span><span style={{ fontWeight: 700, color: 'var(--ink-deep)' }}>{formatPrice(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span style={{ color: 'var(--steel)' }}>Delivery Fee</span>
                  <span style={{ fontWeight: 700, color: deliveryFee === 0 ? 'var(--success)' : 'var(--ink-deep)' }}>{deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span style={{ color: 'var(--steel)' }}>Tip for Rider</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 20, 50, 100].map(t => (
                      <button key={t} onClick={() => setTip(t)}
                        style={{ padding: '4px 12px', borderRadius: 20, border: tip === t ? '2px solid var(--primary)' : '1px solid var(--hairline)', background: tip === t ? 'var(--surface-warm)' : 'transparent', fontSize: 13, fontWeight: 700, color: tip === t ? 'var(--primary)' : 'var(--steel)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {t === 0 ? 'No Tip' : `₹${t}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, marginTop: 12 }}>
                  <span style={{ color: 'var(--ink-deep)' }}>Total</span><span style={{ color: 'var(--primary)' }}>{formatPrice(total)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--stone)', marginTop: 6, fontStyle: 'italic' }}>Final amount calculated from current menu prices</div>
              </div>
              {!user && (
                <div style={{ padding: '12px 16px', background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', marginBottom: 16, fontSize: 13, color: 'var(--ink)' }}>
                  Please <Link href="/auth" style={{ fontWeight: 700, color: 'var(--primary)' }}>sign in</Link> to place an order.
                </div>
              )}
              {error && <p style={{ color: 'var(--critical)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-buy-cta" style={{ flex: 2, padding: '14px 0', fontSize: 16 }} onClick={handlePlaceOrder} disabled={loading || !user}>
                  {loading ? 'Placing...' : 'Place Order'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
