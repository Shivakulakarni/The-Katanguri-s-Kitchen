'use client';

import { useState, useEffect, useCallback } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, Stripe, StripeElementsOptions } from '@stripe/stripe-js';
import { toast } from '../lib/toast-store';

interface StripePaymentFormProps {
  orderId: number;
  amount: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function InnerPaymentForm({ orderId, amount, onSuccess, onError }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/track?id=${orderId}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed');
      } else {
        toast.success('Payment successful', `Order #${orderId} confirmed`);
        onSuccess();
      }
    } catch (err: any) {
      onError(err.message || 'Payment processing failed');
    }
    setProcessing(false);
  }, [stripe, elements, orderId, onSuccess, onError]);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        className="btn btn-buy-cta"
        type="submit"
        disabled={!stripe || processing}
        style={{ width: '100%', padding: '14px 0', fontSize: 16, marginTop: 8 }}
      >
        {processing ? 'Processing Payment...' : `Pay ₹${amount}`}
      </button>
    </form>
  );
}

interface StripePaymentProps {
  orderId: number;
  amount: number;
  clientSecret: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export default function StripePayment({ orderId, amount, clientSecret, onSuccess, onError }: StripePaymentProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (key && !key.includes('CHANGE_ME') && !key.includes('your-')) {
      setStripePromise(loadStripe(key));
    }
  }, []);

  if (!stripePromise || !clientSecret) {
    return (
      <div style={{ padding: 16, background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', textAlign: 'center' }}>
        <p style={{ color: 'var(--steel)', fontSize: 13 }}>
          Stripe is not configured. Please use Cash on Delivery, or set up STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
        </p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#1a1a2e',
        borderRadius: '8px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <InnerPaymentForm orderId={orderId} amount={amount} onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}
