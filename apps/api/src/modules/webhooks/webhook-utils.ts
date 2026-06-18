import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify HMAC-SHA256 webhook signature.
 * Swiggy uses X-Swiggy-Signature header, Zomato uses X-Zomato-Signature.
 * Falls back to custom X-Webhook-Secret header for generic integrations.
 */
export function verifyWebhookSignature(_source: string, payload: string, signature: string | undefined, secret: string): boolean {
  if (!secret) return false; // No secret configured — reject
  if (!signature) return false; // No signature provided — reject

  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function getSignatureHeader(source: string, headers: Record<string, string | string[] | undefined>): string | undefined {
  switch (source) {
    case 'swiggy':
      return (headers['x-swiggy-signature'] || headers['x-swiggy-hmac-sha256']) as string | undefined;
    case 'zomato':
      return (headers['x-zomato-signature'] || headers['x-zomato-hmac-sha256']) as string | undefined;
    default:
      return (headers['x-webhook-secret'] || headers['x-signature'] || headers['x-hub-signature-256']) as string | undefined;
  }
}

/**
 * Normalize order payloads from different aggregator formats into a standard shape.
 */
export function normalizeOrderPayload(source: string, payload: any) {
  // Swiggy format
  if (source === 'swiggy' && payload.order_id) {
    return {
      externalId: String(payload.order_id),
      customerName: payload.customer?.name || payload.user?.name || '',
      customerPhone: payload.customer?.phone || payload.user?.phone || '',
      customerAddress: payload.delivery_address?.address || payload.address?.full_address || '',
      items: (payload.items || []).map((item: any) => ({
        dishId: item.item_id || item.id,
        quantity: item.quantity || 1,
        unitPrice: (item.price || item.total_price || 0) / (item.quantity || 1),
        modifiers: [] as any[],
      })),
    };
  }

  // Zomato format
  if (source === 'zomato' && payload.order_id) {
    return {
      externalId: String(payload.order_id),
      customerName: payload.customer?.name || '',
      customerPhone: payload.customer?.phone_number || '',
      customerAddress: payload.delivery_address?.address || '',
      items: (payload.order_items || []).map((item: any) => ({
        dishId: item.item_id || item.id,
        quantity: item.quantity || 1,
        unitPrice: (item.price || 0) / (item.quantity || 1),
        modifiers: [] as any[],
      })),
    };
  }

  // Generic / UrbanPiper / Posist format (standardized)
  return {
    externalId: String(payload.order_id || payload.id || payload.external_id || Date.now()),
    customerName: payload.customer_name || payload.customer?.name || payload.name || '',
    customerPhone: payload.customer_phone || payload.customer?.phone || payload.phone || '',
    customerAddress: payload.delivery_address || payload.address || '',
    items: (payload.items || payload.order_items || []).map((item: any) => ({
      dishId: item.dish_id || item.item_id || item.id,
      quantity: item.quantity || 1,
      unitPrice: item.unit_price || item.price || 0,
      modifiers: item.modifiers || [],
    })),
  };
}
