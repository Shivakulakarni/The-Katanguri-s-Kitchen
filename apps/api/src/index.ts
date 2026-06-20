import 'dotenv/config';
import './tracing.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { sql } from 'drizzle-orm';

import { getMetricsText, getMetricsContentType, requestDuration, requestsTotal, requests5xx, dbPoolTotal, dbPoolIdle, dbPoolWaiting } from './utils/metrics.js';
import { logger } from './utils/logger.js';

// Initialize Sentry error monitoring
import { initSentry, captureException, flushSentry } from './utils/sentry.js';
initSentry();

process.on('uncaughtException', (err) => {
  captureException(err, { source: 'uncaughtException' });
  logger.fatal({ err }, '[FATAL] Uncaught Exception');
  process.exit(1); // Node.js contract: must exit after uncaughtException
});
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  captureException(error, { source: 'unhandledRejection' });
  logger.fatal({ err: reason }, '[FATAL] Unhandled Rejection');
  process.exit(1);
});

import { authenticate, requireAdmin } from './middleware/auth.js';
import { csrfGenerate, csrfValidate } from './middleware/csrf.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { menuRoutes } from './modules/menu/menu.routes.js';
import { orderRoutes } from './modules/order/order.routes.js';
import { adminOrderRoutes } from './modules/order/adminOrder.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { featureFlagRoutes } from './modules/featureFlags/featureFlag.routes.js';
import { customerRoutes } from './modules/customer/customer.routes.js';
import { paymentRoutes } from './modules/payment/payment.routes.js';
import { dispatchRoutes } from './modules/dispatch/dispatch.routes.js';
import { riderTrackingRoutes } from './modules/dispatch/riderTracking.routes.js';
import { riderAdminRoutes } from './modules/dispatch/riderAdmin.routes.js';
import { riderRoutes } from './modules/rider/rider.routes.js';
import { dispatchAdapterRoutes } from './modules/dispatch/dispatchAdapter.routes.js';
import { batchTrackingRoutes } from './modules/dispatch/batchTracking.routes.js';
import './modules/dispatch/adapters/index.js';
import { failoverManager } from './modules/dispatch/adapters/failover.js';
import { automationRuleRoutes } from './automation/rules/rules.routes.js';
import { deliveryZoneRoutes } from './modules/delivery/delivery.routes.js';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { schedulerRoutes } from './modules/webhooks/scheduler.routes.js';
import { analyticsExportRoutes } from './modules/webhooks/analytics-export.js';
import { sseRoutes } from './modules/sse/sse.routes.js';
import { configRoutes } from './modules/config/config.routes.js';
import { circuitBreakerRoutes } from './modules/config/circuitBreaker.routes.js';
import { sentryErrorsRoutes } from './modules/config/sentryErrors.routes.js';
import { uploadRoutes } from './modules/upload/upload.routes.js';
import { feedbackRoutes } from './modules/feedback/feedback.routes.js';
import { promoRoutes } from './modules/promo/promo.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { contactRoutes } from './modules/contact/contact.routes.js';
import { cartRoutes } from './modules/cart/cart.routes.js';
import { setupWorkers, shutdownWorkers } from './automation/workers.js';
import { setupCronJobs } from './automation/scheduler/cronJobs.js';

// Event subscriber for automation rules
import { redis, subscriberRedis } from './utils/redis.js';
import { buildEventChannel } from './utils/eventBus.js';
import { evaluateRules } from './automation/rules/ruleEngine.js';
import { automationLogs } from './db/schemas/automation.js';
import { db, closeDatabase } from './db/connection.js';
import { startSupabaseBridge } from './realtime/supabaseBridge.js';
import { MAX_UPLOAD_SIZE } from './lib/validation.js';
import { randomUUID } from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3001');
const serverStartTime = Date.now();
let isShuttingDown = false;

async function main() {
  // Polyfill WebSocket for Node.js 20 (required by @supabase/realtime-js)
  try {
    const { WebSocket } = await import('ws');
    if (typeof globalThis.WebSocket === 'undefined') {
      (globalThis as any).WebSocket = WebSocket;
    }
  } catch (err: any) {
    console.error('[WS] WebSocket polyfill failed:', err.message);
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      serializers: {
        err: (err: any) => ({ type: err.constructor?.name || 'Error', message: err.message, stack: err.stack }),
      },
    },
    bodyLimit: MAX_UPLOAD_SIZE,
  });

  // Allow empty JSON body (for POST endpoints that don't need a body)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, function (_req, body, done) {
    const str = typeof body === 'string' ? body : body.toString();
    if (!str || str.length === 0) {
      done(null, {});
    } else {
      try {
        done(null, JSON.parse(str));
      } catch (err: any) {
        done(err, undefined);
      }
    }
  });

  // ── Swagger Docs (disabled in production) ──
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Cloud Kitchen Automation API',
          description: 'RESTful API for the cloud kitchen automation system. Supports order management, menu, payments, inventory, dispatch, and automation workflows.',
          version: '1.0.0',
        },
        servers: [{ url: `http://localhost:${PORT}`, description: 'Development' }],
        tags: [
          { name: 'Auth', description: 'Authentication & OTP' },
          { name: 'Menu', description: 'Menu categories & dishes' },
          { name: 'Orders', description: 'Order lifecycle management' },
          { name: 'Payments', description: 'Stripe payment processing' },
          { name: 'Inventory', description: 'Ingredient stock management' },
          { name: 'Dispatch', description: 'Rider assignment & delivery' },
          { name: 'Webhooks', description: 'Swiggy/Zomato integration' },
          { name: 'Admin', description: 'Admin dashboard operations' },
          { name: 'Automation', description: 'Rule engine & workflows' },
        ],
      },
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  // ── Request ID + Timing + Metrics hook ──
  app.addHook('onRequest', async (request, _reply) => {
    (request as any).startTime = Date.now();
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    (request as any).requestId = requestId;

    // Request timeout — abort controller
    const controller = new AbortController();
    const isPaymentOrDispatch = request.url.includes('/payment') || request.url.includes('/dispatch');
    const timeoutMs = isPaymentOrDispatch ? 60_000 : 30_000;
    (request as any)._abortController = controller;
    (request as any)._timeout = setTimeout(() => controller.abort(), timeoutMs);
  });

  // ── Content-Type enforcement for mutation methods ──
  app.addHook('onRequest', async (request, reply) => {
    const method = request.method;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const contentType = request.headers['content-type'] || '';
      if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
        reply.header('Accept', 'application/json');
        return reply.status(415).send({ error: 'Unsupported Media Type. Use application/json or multipart/form-data.' });
      }
    }
  });
  const API_VERSION = '1.0.0';

  app.addHook('onResponse', async (request, reply) => {
    // Clear request timeout
    const timeout = (request as any)._timeout;
    if (timeout) clearTimeout(timeout);

    reply.header('X-Request-Id', (request as any).requestId || '');
    reply.header('X-API-Version', API_VERSION);
    const reqStartTime = (request as any).startTime;
    if (reqStartTime) {
      const duration = Date.now() - reqStartTime;
      const route = request.routeOptions?.url || request.url;
      const method = request.method;
      const statusCode = String(reply.statusCode);

      requestDuration.observe({ method, route, status_code: statusCode }, duration);
      requestsTotal.inc({ method, route, status_code: statusCode });
      if (reply.statusCode >= 500) requests5xx.inc({ method, route });
    }
  });

  // ── Standardise error response shape ──
  app.addHook('preSerialization', async (_request, reply, payload) => {
    if (payload && typeof payload === 'object' && 'error' in (payload as any) && !('statusCode' in (payload as any))) {
      (payload as any).statusCode = reply.statusCode;
    }
    return payload;
  });

  // ── CORS ──
  const localhostOrigins: (string | RegExp)[] = isProduction ? [] : [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
  ];
  // Production: auto-allow APP_URL and any vercel.app subdomains
  const productionOrigins: (string | RegExp)[] = isProduction && process.env.APP_URL
    ? [process.env.APP_URL, /\.vercel\.app$/]
    : [];
  const envOrigins: (string | RegExp)[] = (process.env.CORS_ORIGINS || '')
    .split(',').filter(Boolean);
  const allowedOrigins: (string | RegExp)[] = [
    ...envOrigins, ...localhostOrigins, ...productionOrigins,
  ];

  if (isProduction && allowedOrigins.length === 0) {
    app.log.warn('[CORS] No allowed origins configured! Set CORS_ORIGINS or APP_URL.');
  }

  await app.register(cors, {
    origin: (origin, cb) => {
      // Always enforce CORS — no environment bypass
      if (!origin) return cb(null, true); // mobile apps / server-to-server
      const allowed = allowedOrigins.some((o) =>
        o instanceof RegExp ? o.test(origin) : o === origin
      );
      if (allowed) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    maxAge: 86400,
  });

  // ── Helmet (Security headers) ──
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co', process.env.APP_URL || ''],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Prevent MIME type sniffing
    noSniff: true,
    // Enable XSS filter (legacy browsers)
    xssFilter: true,
    // Disable DNS prefetching (privacy)
    dnsPrefetchControl: { allow: false },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Hide powered-by header
    hidePoweredBy: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // HTTP Strict Transport Security (1 year, include subdomains, preload)
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },

  });

  // ── Rate Limiting ──
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    // Stricter limits for auth endpoints (configured in auth routes)
    keyGenerator: (request) => {
      // Use X-Forwarded-For if behind proxy
      return request.ip;
    },
    // Enable draft spec for rate limit headers
    enableDraftSpec: true,
  });

  // Permissions-Policy header (restrict browser features)
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    return payload;
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_SIZE,
      files: 5,
    },
  });

  if (isProduction && !process.env.COOKIE_SECRET) {
    throw new Error('COOKIE_SECRET must be set in production');
  }

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET,
    parseOptions: {},
  });

  // Warn if COOKIE_SECRET is missing (cookie signing requires its own secret)
  if (!process.env.COOKIE_SECRET) {
    logger.warn('[SECURITY] COOKIE_SECRET is not set — cookie signing is insecure. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
  }

  // ── CSRF Protection for mutation methods ──
  app.addHook('onRequest', csrfValidate);

  // ── CSRF Token Endpoint ──
  app.get('/api/v1/csrf-token', async (_request, reply) => {
    return csrfGenerate(_request, reply);
  });

  app.get('/', async () => ({
    message: 'Welcome to the Cloud Kitchen Automation API Server',
    health: '/api/v1/health',
    version: '1.0.0',
  }));

  // ── Enhanced Health Check ──
  app.get('/api/v1/health', async (request, reply) => {
    if (isShuttingDown) {
      reply.status(503);
      return { status: 'shutting_down', message: 'Server is shutting down' };
    }

    const checks: Record<string, any> = {};

    try {
      // Safe: sql.raw with a hard-coded literal — no user input involved
      await db.execute(sql.raw('SELECT 1'));
      checks.database = { status: 'ok' };
    } catch (err: any) {
      request.log.error({ err: err.message }, 'Health check: database connection failed');
      checks.database = { status: 'error', message: isProduction ? 'Connection failed' : err.message };
    }

    try {
      await redis.ping();
      checks.redis = { status: 'ok' };
    } catch (err: any) {
      request.log.error({ err: err.message }, 'Health check: redis connection failed');
      checks.redis = { status: 'error', message: isProduction ? 'Connection failed' : err.message };
    }

    // Circuit breaker health (with retry + backoff for transient failures)
    try {
      const { getCircuitBreakerHealth } = await import('./lib/circuitBreakerMetrics.js');
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          checks.circuitBreakers = getCircuitBreakerHealth();
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
          }
        }
      }
      if (lastError) throw lastError;
    } catch {
      checks.circuitBreakers = { status: 'unknown', breakers: [] };
    }

    const allOk = Object.values(checks).every((c: any) => c.status === 'ok');
    const statusCode = allOk ? 200 : 503;

    return reply.status(statusCode).send({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
      version: '1.0.0',
      commit: 'd70ad2c',
      environment: process.env.NODE_ENV || 'development',
      checks,
    });
  });

  // ── Env Var Diagnostics (admin only — helps debug Render deployment) ──
  app.get('/api/v1/admin/env-status', { preHandler: [authenticate, requireAdmin] }, async () => {
    const check = (key: string) => {
      const v = process.env[key] || '';
      if (!v) return 'MISSING';
      if (v.includes('CHANGE_ME') || v.includes('YOUR_')) return 'PLACEHOLDER';
      return 'SET';
    };
    return {
      database: { DATABASE_URL: check('DATABASE_URL') },
      redis: { REDIS_URL: check('REDIS_URL') },
      auth: { JWT_SECRET: check('JWT_SECRET'), JWT_REFRESH_SECRET: check('JWT_REFRESH_SECRET'), COOKIE_SECRET: check('COOKIE_SECRET') },
      supabase: { SUPABASE_URL: check('SUPABASE_URL'), SUPABASE_ANON_KEY: check('SUPABASE_ANON_KEY'), SUPABASE_SERVICE_ROLE_KEY: check('SUPABASE_SERVICE_ROLE_KEY'), SUPABASE_JWT_SECRET: check('SUPABASE_JWT_SECRET') },
      email: { RESEND_API_KEY: check('RESEND_API_KEY'), RESEND_FROM_EMAIL: check('RESEND_FROM_EMAIL') },
      sms: { TWILIO_ACCOUNT_SID: check('TWILIO_ACCOUNT_SID'), TWILIO_AUTH_TOKEN: check('TWILIO_AUTH_TOKEN'), TWILIO_PHONE_NUMBER: check('TWILIO_PHONE_NUMBER') },
      payments: { STRIPE_SECRET_KEY: check('STRIPE_SECRET_KEY'), STRIPE_WEBHOOK_SECRET: check('STRIPE_WEBHOOK_SECRET') },
      ai: { GROQ_API_KEY: check('GROQ_API_KEY'), GEMINI_API_KEY: check('GEMINI_API_KEY') },
      misc: { APP_URL: check('APP_URL'), CORS_ORIGINS: check('CORS_ORIGINS'), ADMIN_EMAILS: check('ADMIN_EMAILS'), ENABLE_DEV_BYPASS: check('ENABLE_DEV_BYPASS') },
    };
  });

  // ── Prometheus Metrics ──
  app.get('/api/v1/metrics', { preHandler: [authenticate, requireAdmin] }, async (_request, reply) => {
    try {
      const { queryClient } = await import('./db/connection.js');
      const pool = queryClient as any;
      dbPoolTotal.set(pool.totalCount ?? 0);
      dbPoolIdle.set(pool.idleCount ?? 0);
      dbPoolWaiting.set(pool.waitingCount ?? 0);
    } catch {
      // pool metrics unavailable
    }
    reply.header('Content-Type', getMetricsContentType());
    return getMetricsText();
  });

  // Warn if COOKIE_SECRET and JWT_SECRET are both missing
  if (!process.env.COOKIE_SECRET && !process.env.JWT_SECRET) {
    logger.warn('[SECURITY] COOKIE_SECRET and JWT_SECRET are both unset — cookie signing is insecure');
  }

  await app.register(authRoutes);
  await app.register(menuRoutes);
  await app.register(orderRoutes);
  await app.register(adminOrderRoutes);
  await app.register(inventoryRoutes);
  await app.register(customerRoutes);
  await app.register(paymentRoutes);
  await app.register(dispatchRoutes);
  await app.register(riderTrackingRoutes);
  await app.register(riderAdminRoutes);
  await app.register(dispatchAdapterRoutes);
  await app.register(batchTrackingRoutes);
  await app.register(automationRuleRoutes);
  await app.register(deliveryZoneRoutes);
  await app.register(webhookRoutes);
  await app.register(schedulerRoutes);
  await app.register(analyticsExportRoutes);
  await app.register(sseRoutes);
  await app.register(configRoutes);
  await app.register(auditRoutes);
  await app.register(featureFlagRoutes);
  await app.register(circuitBreakerRoutes);
  await app.register(sentryErrorsRoutes);
  await app.register(uploadRoutes);
  await app.register(feedbackRoutes);
  await app.register(promoRoutes);
  await app.register(aiRoutes);
  await app.register(contactRoutes);
  await app.register(cartRoutes);
  await app.register(riderRoutes);

  // Initialize automation event subscriber
  const eventChannels = [
    'order.placed', 'order.confirmed', 'order.cancelled',
    'order.preparation_started', 'order.ready',
    'order.out_for_delivery', 'order.delivered',
  ];

  for (const event of eventChannels) {
    const channel = buildEventChannel(event);
    try { 
      await subscriberRedis.subscribe(channel); 
    } catch (err) { 
      logger.error({ err, channel }, 'Subscribe error'); 
    }
  }

  subscriberRedis.on('message', async (_channel, message) => {
    try {
      const data = JSON.parse(message);
      await db.insert(automationLogs).values({
        workflowName: `event_${data.event}`,
        eventId: data.eventId, action: 'received', status: 'success', payload: data.payload,
      }).catch(() => {});
      await evaluateRules(data.event, { ...data.payload, eventId: data.eventId });

      // Bridge events to BullMQ workers for automated workflows
      const { orderQueue } = await import('./utils/queue.js');
      const orderId = data.payload?.orderId;
      switch (data.event) {
        case 'order.placed':
          if (orderId) await orderQueue.add('place-order', { orderId });
          break;
        case 'order.confirmed':
          if (orderId) await orderQueue.add('confirm-order', { orderId, customerEmail: data.payload?.customerEmail });
          break;
        case 'order.ready':
          if (orderId) await orderQueue.add('order-ready', { orderId });
          break;
        case 'order.delivered':
          if (orderId) await orderQueue.add('order-delivered', { orderId });
          break;
        case 'order.cancelled':
          if (orderId) await orderQueue.add('order-cancelled', { orderId, customerId: data.payload?.customerId, previousStatus: data.payload?.status });
          break;
      }

      // Trigger rider tracking simulation
      if (data.event === 'order.out_for_delivery') {
        const orderId = data.payload?.orderId;
        if (orderId) {
          const { startRiderSimulation } = await import('./modules/dispatch/riderSimulator.js');
          startRiderSimulation(Number(orderId)).catch((err) => logger.error({ err }, 'Failed to start rider simulation'));
        }
      } else if (data.event === 'order.delivered' || data.event === 'order.cancelled') {
        const orderId = data.payload?.orderId;
        if (orderId) {
          const { stopRiderSimulation } = await import('./modules/dispatch/riderSimulator.js');
          stopRiderSimulation(Number(orderId));
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Event processing error');
    }
  });

  // Initialize automation workers and cron jobs
  try {
    const info = await redis.info();
    const versionMatch = info.match(/redis_version:([0-9.]+)/);
    const version = versionMatch ? versionMatch[1] : '0.0.0';      logger.info({ version }, '[Redis] Detected version');
    const majorVersion = parseInt(version.split('.')[0]);
    if (majorVersion >= 5) {
      setupWorkers();
      await setupCronJobs();
    } else {
      logger.warn({ version }, '[Automation] Skipped BullMQ — Redis version < 5.0.0');
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[Automation] Skipped BullMQ — Redis connection failed');
  }

  // Resume active rider delivery simulations on boot
  try {
    const { resumeSimulationsOnStartup } = await import('./modules/dispatch/riderSimulator.js');
    await resumeSimulationsOnStartup();
  } catch (err: any) {
    logger.error({ err: err.message }, '[Sim] Failed to run simulator startup recovery');
  }

  logger.info('[Automation] Event subscriber active');

  // Start Supabase Realtime bridge
  startSupabaseBridge();

  // ── Structured Error Handler ──
  app.setErrorHandler((error: any, request, reply) => {
    const requestId = (request as any).requestId || 'unknown';
    const statusCode = error.statusCode || 500;
    const isOperational = error.isOperational !== false;

    // Structured error log with request context
    logger.error({
      err: {
        name: error.name,
        message: error.message,
        statusCode,
        isOperational,
        stack: error.stack,
      },
      requestId,
      method: request.method,
      url: request.url,
    }, `Request error: ${error.message}`);

    const safeMessage = statusCode >= 500 && isProduction ? 'Internal server error' : (isOperational ? error.message : 'Internal server error');
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : (error.name || 'Error'),
      message: safeMessage,
      statusCode,
      requestId,
    });
  });

  // ── Graceful Shutdown ──
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, '[Server] Starting graceful shutdown');

    const forceExit = setTimeout(() => {
      logger.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 30000);

    try {
      await app.close();
      logger.info('[Server] HTTP server closed');

      try {
        await shutdownWorkers();
      } catch (err: any) {
        logger.error({ err: err.message }, '[Server] Workers shutdown error');
      }

      try {
        await closeDatabase();
      } catch (err: any) {
        logger.error({ err: err.message }, '[Server] DB close error');
      }

      try {
        redis.disconnect();
        subscriberRedis.disconnect();
        logger.info('[Server] Redis connections closed');
      } catch (err: any) {
        logger.error({ err: err.message }, '[Server] Redis close error');
      }

      await flushSentry();
      clearTimeout(forceExit);
      logger.info('[Server] Graceful shutdown complete');
      process.exit(0);
    } catch (err: any) {
      logger.error({ err: err.message }, '[Server] Shutdown error');
      await flushSentry();
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info({ port: PORT }, '[Server] Kitchen API running');

    // Initialize dispatch failover manager after server is ready
    failoverManager.initialize();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL] Server startup failed:', err?.message || err);
  console.error(err?.stack);
  process.exit(1);
});
