import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature, getSignatureHeader, normalizeOrderPayload } from './webhook-utils.js';

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret-123';
  const payload = JSON.stringify({ order_id: '123', items: [] });

  it('rejects when secret is empty', () => {
    expect(verifyWebhookSignature('swiggy', payload, 'sig', '')).toBe(false);
  });

  it('rejects when signature is undefined', () => {
    expect(verifyWebhookSignature('swiggy', payload, undefined, secret)).toBe(false);
  });

  it('rejects when signature is empty', () => {
    expect(verifyWebhookSignature('swiggy', payload, '', secret)).toBe(false);
  });

  it('accepts valid HMAC signature', async () => {
    const { createHmac } = await import('crypto');
    const hmac = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyWebhookSignature('swiggy', payload, hmac, secret)).toBe(true);
  });

  it('rejects invalid HMAC signature', () => {
    expect(verifyWebhookSignature('swiggy', payload, 'invalid-signature', secret)).toBe(false);
  });
});

describe('getSignatureHeader', () => {
  it('returns x-swiggy-signature for swiggy', () => {
    expect(getSignatureHeader('swiggy', { 'x-swiggy-signature': 'sig' })).toBe('sig');
  });

  it('falls back to x-swiggy-hmac-sha256 for swiggy', () => {
    expect(getSignatureHeader('swiggy', { 'x-swiggy-hmac-sha256': 'hmac' })).toBe('hmac');
  });

  it('returns x-zomato-signature for zomato', () => {
    expect(getSignatureHeader('zomato', { 'x-zomato-signature': 'sig' })).toBe('sig');
  });

  it('falls back to x-hub-signature-256 for generic', () => {
    expect(getSignatureHeader('generic', { 'x-hub-signature-256': 'hub' })).toBe('hub');
  });

  it('returns undefined when no signature header present', () => {
    expect(getSignatureHeader('swiggy', {})).toBeUndefined();
  });
});

describe('normalizeOrderPayload', () => {
  it('normalizes Swiggy format', () => {
    const result = normalizeOrderPayload('swiggy', {
      order_id: 'swiggy-123',
      customer: { name: 'Test', phone: '9999999999' },
      delivery_address: { address: 'Test Address' },
      items: [{ item_id: 1, quantity: 2, price: 300 }],
    });
    expect(result.externalId).toBe('swiggy-123');
    expect(result.customerName).toBe('Test');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].dishId).toBe(1);
    expect(result.items[0].quantity).toBe(2);
  });

  it('normalizes Zomato format', () => {
    const result = normalizeOrderPayload('zomato', {
      order_id: 'zomato-456',
      customer: { name: 'Zomato User', phone_number: '8888888888' },
      delivery_address: { address: 'Zomato Address' },
      order_items: [{ item_id: 10, quantity: 1, price: 500 }],
    });
    expect(result.externalId).toBe('zomato-456');
    expect(result.customerPhone).toBe('8888888888');
    expect(result.items[0].unitPrice).toBe(500);
  });

  it('handles generic format', () => {
    const result = normalizeOrderPayload('generic', {
      order_id: 'gen-789',
      customer_name: 'Generic User',
      customer_phone: '7777777777',
      delivery_address: 'Generic Address',
      items: [{ dish_id: 100, quantity: 3, unit_price: 150 }],
    });
    expect(result.externalId).toBe('gen-789');
    expect(result.items[0].dishId).toBe(100);
    expect(result.items[0].quantity).toBe(3);
  });

  it('rejects empty items', () => {
    const result = normalizeOrderPayload('generic', { order_id: 'empty', items: [] });
    expect(result.items).toHaveLength(0);
  });
});
