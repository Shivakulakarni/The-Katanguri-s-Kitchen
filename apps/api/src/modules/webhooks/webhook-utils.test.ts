import { describe, it, expect } from 'vitest';
import { normalizeOrderPayload, verifyWebhookSignature, getSignatureHeader } from './webhook-utils.js';
import { createHmac } from 'crypto';

// ─── normalizeOrderPayload ──────────────────────────────────────────

describe('normalizeOrderPayload', () => {
  describe('Swiggy format', () => {
    it('normalizes a standard Swiggy payload', () => {
      const payload = {
        order_id: 'SW-123',
        customer: { name: 'Ravi Kumar', phone: '9876543210' },
        delivery_address: { address: '123 MG Road, Warangal' },
        items: [
          { item_id: 1, name: 'Biryani', quantity: 2, price: 280 },
          { item_id: 7, name: 'Chicken 65', quantity: 1, price: 220 },
        ],
      };
      const result = normalizeOrderPayload('swiggy', payload);
      expect(result.externalId).toBe('SW-123');
      expect(result.customerName).toBe('Ravi Kumar');
      expect(result.customerPhone).toBe('9876543210');
      expect(result.customerAddress).toBe('123 MG Road, Warangal');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].dishId).toBe(1);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].unitPrice).toBe(140); // 280 / 2
      expect(result.items[1].dishId).toBe(7);
      expect(result.items[1].unitPrice).toBe(220); // 220 / 1
    });

    it('uses user fallback fields for Swiggy', () => {
      const payload = {
        order_id: 'SW-456',
        user: { name: 'Fallback User', phone: '1111111111' },
        address: { full_address: 'Fallback Address' },
        items: [{ item_id: 1, quantity: 1, price: 100 }],
      };
      const result = normalizeOrderPayload('swiggy', payload);
      expect(result.customerName).toBe('Fallback User');
      expect(result.customerPhone).toBe('1111111111');
      expect(result.customerAddress).toBe('Fallback Address');
    });

    it('handles missing items gracefully', () => {
      const payload = { order_id: 'SW-789' };
      const result = normalizeOrderPayload('swiggy', payload);
      expect(result.items).toEqual([]);
    });

    it('uses total_price fallback when price is missing', () => {
      const payload = {
        order_id: 'SW-100',
        items: [{ item_id: 1, quantity: 3, total_price: 600 }],
      };
      const result = normalizeOrderPayload('swiggy', payload);
      expect(result.items[0].unitPrice).toBe(200); // 600 / 3
    });
  });

  describe('Zomato format', () => {
    it('normalizes a standard Zomato payload', () => {
      const payload = {
        order_id: 'ZM-100',
        customer: { name: 'Priya Sharma', phone_number: '9876543211' },
        delivery_address: { address: '456 Station Road, Warangal' },
        order_items: [
          { item_id: 2, name: 'Mutton Biryani', quantity: 1, price: 350 },
          { item_id: 6, name: 'Paneer Majestic', quantity: 2, price: 220 },
        ],
      };
      const result = normalizeOrderPayload('zomato', payload);
      expect(result.externalId).toBe('ZM-100');
      expect(result.customerName).toBe('Priya Sharma');
      expect(result.customerPhone).toBe('9876543211');
      expect(result.customerAddress).toBe('456 Station Road, Warangal');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].dishId).toBe(2);
      expect(result.items[0].unitPrice).toBe(350);
      expect(result.items[1].quantity).toBe(2);
      expect(result.items[1].unitPrice).toBe(110); // 220 / 2
    });

    it('handles missing customer and address', () => {
      const payload = {
        order_id: 'ZM-200',
        order_items: [{ item_id: 1, quantity: 1, price: 100 }],
      };
      const result = normalizeOrderPayload('zomato', payload);
      expect(result.customerName).toBe('');
      expect(result.customerPhone).toBe('');
      expect(result.customerAddress).toBe('');
    });
  });

  describe('Generic format', () => {
    it('normalizes a standard generic payload', () => {
      const payload = {
        order_id: 'GEN-300',
        customer_name: 'Anil Reddy',
        customer_phone: '9876543212',
        delivery_address: '789 Hanamkonda',
        items: [
          { dish_id: 10, quantity: 1, unit_price: 300 },
        ],
      };
      const result = normalizeOrderPayload('generic', payload);
      expect(result.externalId).toBe('GEN-300');
      expect(result.customerName).toBe('Anil Reddy');
      expect(result.customerPhone).toBe('9876543212');
      expect(result.customerAddress).toBe('789 Hanamkonda');
      expect(result.items[0].dishId).toBe(10);
      expect(result.items[0].unitPrice).toBe(300);
    });

    it('falls back to nested customer fields', () => {
      const payload = {
        id: 'GEN-400',
        customer: { name: 'Nested Name', phone: '2222222222' },
        address: 'Fallback Address',
        items: [{ item_id: 5, quantity: 1, price: 150 }],
      };
      const result = normalizeOrderPayload('urbanpiper', payload);
      expect(result.customerName).toBe('Nested Name');
      expect(result.customerPhone).toBe('2222222222');
      expect(result.customerAddress).toBe('Fallback Address');
      expect(result.items[0].dishId).toBe(5);
      expect(result.items[0].unitPrice).toBe(150);
    });

    it('uses external_id fallback for ID', () => {
      const payload = {
        external_id: 'EXT-500',
        items: [{ id: 1, quantity: 1, price: 100 }],
      };
      const result = normalizeOrderPayload('posist', payload);
      expect(result.externalId).toBe('EXT-500');
    });

    it('uses order_items fallback for items', () => {
      const payload = {
        order_id: 'GEN-600',
        order_items: [{ id: 1, quantity: 1, price: 100 }],
      };
      const result = normalizeOrderPayload('generic', payload);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].dishId).toBe(1);
    });

    it('preserves modifiers if present', () => {
      const payload = {
        order_id: 'GEN-700',
        items: [{ dish_id: 1, quantity: 1, unit_price: 100, modifiers: ['extra spicy'] }],
      };
      const result = normalizeOrderPayload('generic', payload);
      expect(result.items[0].modifiers).toEqual(['extra spicy']);
    });

    it('defaults quantity to 1 when missing', () => {
      const payload = {
        order_id: 'GEN-800',
        items: [{ dish_id: 1, unit_price: 100 }],
      };
      const result = normalizeOrderPayload('generic', payload);
      expect(result.items[0].quantity).toBe(1);
    });

    it('defaults unit_price to 0 when missing', () => {
      const payload = {
        order_id: 'GEN-900',
        items: [{ dish_id: 1, quantity: 1 }],
      };
      const result = normalizeOrderPayload('generic', payload);
      expect(result.items[0].unitPrice).toBe(0);
    });
  });
});

// ─── verifyWebhookSignature ──────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  const payload = '{"order_id":"SW-123","items":[]}';

  it('returns true for a valid HMAC-SHA256 signature', () => {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyWebhookSignature('swiggy', payload, expected, secret)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    expect(verifyWebhookSignature('swiggy', payload, 'deadbeef0000', secret)).toBe(false);
  });

  it('returns false for an empty signature when secret is set', () => {
    expect(verifyWebhookSignature('swiggy', payload, undefined, secret)).toBe(false);
  });

  it('rejects when no secret is configured (secure default)', () => {
    expect(verifyWebhookSignature('swiggy', payload, undefined, '')).toBe(false);
    expect(verifyWebhookSignature('swiggy', payload, undefined, '')).toBe(false);
  });

  it('detects tampered payload', () => {
    const tamperedPayload = '{"order_id":"SW-999","items":[]}';
    const originalSig = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyWebhookSignature('swiggy', tamperedPayload, originalSig, secret)).toBe(false);
  });

  it('handles wrong secret', () => {
    const wrongSecret = 'wrong-secret';
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyWebhookSignature('swiggy', payload, sig, wrongSecret)).toBe(false);
  });
});

// ─── getSignatureHeader ──────────────────────────────────────────────

describe('getSignatureHeader', () => {
  it('returns x-swiggy-signature for swiggy source', () => {
    const headers = { 'x-swiggy-signature': 'sig123' };
    expect(getSignatureHeader('swiggy', headers)).toBe('sig123');
  });

  it('falls back to x-swiggy-hmac-sha256 for swiggy', () => {
    const headers = { 'x-swiggy-hmac-sha256': 'hmac456' };
    expect(getSignatureHeader('swiggy', headers)).toBe('hmac456');
  });

  it('returns x-zomato-signature for zomato source', () => {
    const headers = { 'x-zomato-signature': 'sig789' };
    expect(getSignatureHeader('zomato', headers)).toBe('sig789');
  });

  it('falls back to x-zomato-hmac-sha256 for zomato', () => {
    const headers = { 'x-zomato-hmac-sha256': 'hmac012' };
    expect(getSignatureHeader('zomato', headers)).toBe('hmac012');
  });

  it('returns x-webhook-secret for generic source', () => {
    const headers = { 'x-webhook-secret': 'sec345' };
    expect(getSignatureHeader('generic', headers)).toBe('sec345');
  });

  it('falls back to x-signature for generic source', () => {
    const headers = { 'x-signature': 'sig678' };
    expect(getSignatureHeader('generic', headers)).toBe('sig678');
  });

  it('falls back to x-hub-signature-256 for generic source', () => {
    const headers = { 'x-hub-signature-256': 'hub901' };
    expect(getSignatureHeader('generic', headers)).toBe('hub901');
  });

  it('returns undefined when no signature header is present', () => {
    const headers = {};
    expect(getSignatureHeader('swiggy', headers)).toBeUndefined();
    expect(getSignatureHeader('zomato', headers)).toBeUndefined();
    expect(getSignatureHeader('generic', headers)).toBeUndefined();
  });
});
