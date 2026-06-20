import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID, timingSafeEqual } from 'crypto';

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    const padded = Buffer.alloc(bufA.length);
    bufB.copy(padded);
    return timingSafeEqual(bufA, padded);
  }
  return timingSafeEqual(bufA, bufB);
}

const CSRF_SKIP_PREFIXES = [
  '/api/v1/menu/stream',
  '/api/v1/rider/stream',
  '/api/v1/delivery/stream',
  '/api/v1/inventory/stream',
  '/api/v1/dispatch/stream',
  '/api/v1/automation/stream',
  '/api/v1/health',
  '/api/v1/webhooks/',
  '/api/v1/auth/',
  '/api/v1/admin/orders/stream',
  '/api/v1/admin/orders/live-status',
  '/api/v1/admin/',
  '/api/v1/contact',
  '/api/v1/ai/chat/customer',
  '/api/v1/ai/chat/customer/stream',
  '/api/v1/ai/recommendations',
  '/api/v1/ai/meal-plan',
  '/api/v1/ai/food-story',
  '/api/v1/ai/cross-sell',
  '/api/v1/ai/status',
  '/api/v1/promo/validate',
  '/api/v1/feedback',
  '/api/v1/config/',
];

export async function csrfGenerate(_request: FastifyRequest, reply: FastifyReply) {
  const token = randomUUID();
  reply.setCookie(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return { token };
}

export async function csrfValidate(request: FastifyRequest, reply: FastifyReply) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return;
  }
  const url = request.url.split('?')[0];
  if (CSRF_SKIP_PREFIXES.some(p => url.startsWith(p))) {
    return;
  }
  // Skip CSRF for Bearer token auth — CSRF only protects cookie-based sessions.
  // Bearer tokens are not automatically sent by browsers, so CSRF doesn't apply.
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return;
  }
  const cookieToken = request.cookies?.[CSRF_COOKIE];
  const headerToken = request.headers[CSRF_HEADER] as string;
  if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken)) {
    return reply.status(403).send({ error: 'Invalid CSRF token' });
  }
  // Rotate token after successful validation
  csrfGenerate(request, reply).catch(() => {});
}
