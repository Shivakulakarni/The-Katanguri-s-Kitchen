import { z } from 'zod';
import { isIP } from 'net';

// ── SSRF Protection ──
const BLOCKED_RANGES = [
  '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
  '169.254.0.0/16', '::1/128', 'fc00::/7', 'fe80::/10',
];

function ipToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return parts.reduce((acc, p) => (acc << 8) + parseInt(p, 10), 0) >>> 0;
}

function cidrToRange(cidr: string): [number, number] {
  const [ip, bits] = cidr.split('/');
  const numBits = parseInt(bits, 10);
  const ipNum = ipToLong(ip)!;
  const mask = (-1 << (32 - numBits)) >>> 0;
  const network = (ipNum & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return [network, broadcast];
}

const BLOCKED_RANGES_PARSED = BLOCKED_RANGES.filter(r => r.includes('.')).map(cidrToRange);

function isPrivateOrReserved(host: string): boolean {
  // Strip IPv6 brackets
  const cleanHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  const ip = isIP(cleanHost);
  if (ip === 0) {
    // Not an IP — check for private hostnames
    const lower = host.toLowerCase();
    if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localhost')) {
      return true;
    }
    return false;
  }
  if (ip === 6) {
    // IPv6 — block loopback and link-local
    const h = cleanHost.toLowerCase();
    if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
    return false;
  }
  const ipLong = ipToLong(cleanHost);
  if (ipLong === null) return true;
  for (const [start, end] of BLOCKED_RANGES_PARSED) {
    if (ipLong >= start && ipLong <= end) return true;
  }
  return false;
}

export function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    return !isPrivateOrReserved(url.hostname);
  } catch {
    return false;
  }
}

// ── Auth ──
export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  password: z.string().min(6).max(128).optional(),
  otp: z.string().length(6).optional(),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
});

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(6).max(128).optional(),
  otp: z.string().length(6),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
});

export const otpRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  email: z.string().email().optional(),
}).refine(data => data.phone || data.email, { message: 'Phone or email required' });

// ── Menu ──
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createDishSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive().max(99999),
  prepTimeMin: z.number().int().min(1).max(480).optional(),
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().optional(),
  dietaryTags: z.array(z.string()).optional(),
});

export const updateDishSchema = createDishSchema.partial();

export const createModifierSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['single', 'multiple']),
  options: z.array(z.object({
    label: z.string().min(1).max(100),
    price: z.number().min(0).max(99999),
  })).min(1).max(50),
  isRequired: z.boolean().optional(),
});

export const updateModifierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['single', 'multiple']).optional(),
  options: z.array(z.object({
    label: z.string().min(1).max(100),
    price: z.number().min(0).max(99999),
  })).min(1).max(50).optional(),
  isRequired: z.boolean().optional(),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  otp: z.string().length(6),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

export const emailOtpSchema = z.object({
  email: z.string().email(),
});

export const emailVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  name: z.string().max(100).optional(),
});

export const socialAuthSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  accessToken: z.string().min(1),
});

export const riderSendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
});

// ── Orders ──
export const createOrderSchema = z.object({
  items: z.array(z.object({
    dishId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(100),
    unitPrice: z.number().positive().optional(),
    modifiers: z.array(z.record(z.any())).optional(),
  })).min(1).max(50),
  deliveryAddressId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  reason: z.string().max(500).optional(),
});

// ── Customer ──
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
});

export const createAddressSchema = z.object({
  label: z.string().max(50).optional(),
  addressLine1: z.string().min(1).max(500),
  addressLine2: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().regex(/^\d{6}$/),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

export const createFavoriteSchema = z.object({
  dishId: z.number().int().positive(),
});

// ── Inventory ──
export const createIngredientSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(20),
  currentStock: z.number().min(0).optional(),
  parLevel: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
});

export const updateStockSchema = z.object({
  delta: z.number().int(),
  reason: z.string().max(500).optional(),
});

// ── Delivery ──
export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusKm: z.number().positive().max(100),
  deliveryFee: z.number().min(0).optional(),
  minimumOrder: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().min(1).max(480).optional(),
});

export const validateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ── Payment ──
export const createPaymentIntentSchema = z.object({
  orderId: z.number().int().positive(),
  amount: z.number().positive().max(999999),
  currency: z.string().length(3).optional(),
  idempotencyKey: z.string().optional(),
}).passthrough();

export const adminRefundSchema = z.object({
  paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

// ── Config ──
export const updateConfigSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.any(),
});

// ── Webhook ──
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1).max(20),
});

// ── Automation ──
export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  trigger: z.string().min(1).max(100),
  conditions: z.array(z.any()).optional(),
  actions: z.array(z.any()).optional(),
});

// ── Upload ──
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// ── Rider ──
export const riderRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  vehicleType: z.enum(['bike', 'scooter', 'cycle']).optional(),
  vehicleNumber: z.string().max(20).optional(),
});

export const riderLoginSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  otp: z.string().length(6),
});

export const riderLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const riderStatusSchema = z.object({
  status: z.enum(['online', 'offline', 'delivering', 'busy']),
});

// ── Dispatch ──
export const assignDispatchSchema = z.object({
  orderId: z.number().int().positive(),
});

export const confirmDeliverySchema = z.object({
  orderId: z.number().int().positive(),
});

// ── Admin Promo ──
export const createPromoSchema = z.object({
  code: z.string().min(1).max(50),
  type: z.enum(['percentage', 'flat']),
  value: z.number().positive(),
  minOrderAmount: z.number().min(0).optional(),
  maxUses: z.number().int().min(0).optional(),
  expiresAt: z.string().datetime().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateDishInput = z.infer<typeof createDishSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
