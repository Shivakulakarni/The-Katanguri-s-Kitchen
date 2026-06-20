import 'dotenv/config';
import http from 'http';

// ── OPEN PORT IMMEDIATELY — before ANY heavy imports ──
// ESM hoists all static imports above code. Only 2 static imports here
// so the bootstrap server opens the port within milliseconds.
const PORT = parseInt(process.env.PORT || '3001');
const serverStartTime = Date.now();
const isProduction = process.env.NODE_ENV === 'production';

const bootServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', bootstrapping: true, port: PORT }));
});
bootServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOT] Port ${PORT} opened for health checks`);
});

let isShuttingDown = false;

async function main() {
  // ── Dynamic imports — loaded AFTER port is open ──
  const [
    { default: Fastify },
    { default: cors },
    { default: helmet },
    { default: rateLimit },
    { default: multipart },
    { default: cookie },
    { default: swagger },
    { default: swaggerUi },
    drizzleOrm,
    metricsMod,
    loggerMod,
    sentryMod,
    authMiddleware,
    csrfMod,
    authRoutesMod,
    menuRoutesMod,
    orderRoutesMod,
    adminOrderRoutesMod,
    inventoryRoutesMod,
    auditRoutesMod,
    featureFlagRoutesMod,
    customerRoutesMod,
    paymentRoutesMod,
    dispatchRoutesMod,
    riderTrackingRoutesMod,
    riderAdminRoutesMod,
    riderRoutesMod,
    dispatchAdapterRoutesMod,
    batchTrackingRoutesMod,
    _adaptersIndex,
    failoverMod,
    automationRuleRoutesMod,
    deliveryZoneRoutesMod,
    webhookRoutesMod,
    schedulerRoutesMod,
    analyticsExportRoutesMod,
    sseRoutesMod,
    configRoutesMod,
    circuitBreakerRoutesMod,
    sentryErrorsRoutesMod,
    uploadRoutesMod,
    feedbackRoutesMod,
    promoRoutesMod,
    aiRoutesMod,
    contactRoutesMod,
    cartRoutesMod,
    workersMod,
    cronJobsMod,
    redisMod,
    eventBusMod,
    ruleEngineMod,
    automationSchemasMod,
    dbMod,
    supabaseBridgeMod,
    validationMod,
  ] = await Promise.all([
    import('fastify'),
    import('@fastify/cors'),
    import('@fastify/helmet'),
    import('@fastify/rate-limit'),
    import('@fastify/multipart'),
    import('@fastify/cookie'),
    import('@fastify/swagger'),
    import('@fastify/swagger-ui'),
    import('drizzle-orm'),
    import('./utils/metrics.js'),
    import('./utils/logger.js'),
    import('./utils/sentry.js'),
    import('./middleware/auth.js'),
    import('./middleware/csrf.js'),
    import('./modules/auth/auth.routes.js'),
    import('./modules/menu/menu.routes.js'),
    import('./modules/order/order.routes.js'),
    import('./modules/order/adminOrder.routes.js'),
    import('./modules/inventory/inventory.routes.js'),
    import('./modules/audit/audit.routes.js'),
    import('./modules/featureFlags/featureFlag.routes.js'),
    import('./modules/customer/customer.routes.js'),
    import('./modules/payment/payment.routes.js'),
    import('./modules/dispatch/dispatch.routes.js'),
    import('./modules/dispatch/riderTracking.routes.js'),
    import('./modules/dispatch/riderAdmin.routes.js'),
    import('./modules/rider/rider.routes.js'),
    import('./modules/dispatch/dispatchAdapter.routes.js'),
    import('./modules/dispatch/batchTracking.routes.js'),
    import('./modules/dispatch/adapters/index.js'),
    import('./modules/dispatch/adapters/failover.js'),
    import('./automation/rules/rules.routes.js'),
    import('./modules/delivery/delivery.routes.js'),
    import('./modules/webhooks/webhook.routes.js'),
    import('./modules/webhooks/scheduler.routes.js'),
    import('./modules/webhooks/analytics-export.js'),
    import('./modules/sse/sse.routes.js'),
    import('./modules/config/config.routes.js'),
    import('./modules/config/circuitBreaker.routes.js'),
    import('./modules/config/sentryErrors.routes.js'),
    import('./modules/upload/upload.routes.js'),
    import('./modules/feedback/feedback.routes.js'),
    import('./modules/promo/promo.routes.js'),
    import('./modules/ai/ai.routes.js'),
    import('./modules/contact/contact.routes.js'),
    import('./modules/cart/cart.routes.js'),
    import('./automation/workers.js'),
    import('./automation/scheduler/cronJobs.js'),
    import('./utils/redis.js'),
    import('./utils/eventBus.js'),
    import('./automation/rules/ruleEngine.js'),
    import('./db/schemas/automation.js'),
    import('./db/connection.js'),
    import('./realtime/supabaseBridge.js'),
    import('./lib/validation.js'),
  ]);

  // Extract named exports
  const { sql } = drizzleOrm;
  const { getMetricsText, getMetricsContentType, requestDuration, requestsTotal, requests5xx, dbPoolTotal, dbPoolIdle, dbPoolWaiting } = metricsMod;
  const { logger } = loggerMod;
  const { initSentry, captureException, flushSentry } = sentryMod;
  const { authenticate, requireAdmin } = authMiddleware;
  const { csrfGenerate, csrfValidate } = csrfMod;
  const { authRoutes } = authRoutesMod;
  const { menuRoutes } = menuRoutesMod;
  const { orderRoutes } = orderRoutesMod;
  const { adminOrderRoutes } = adminOrderRoutesMod;
  const { inventoryRoutes } = inventoryRoutesMod;
  const { auditRoutes } = auditRoutesMod;
  const { featureFlagRoutes } = featureFlagRoutesMod;
  const { customerRoutes } = customerRoutesMod;
  const { paymentRoutes } = paymentRoutesMod;
  const { dispatchRoutes } = dispatchRoutesMod;
  const { riderTrackingRoutes } = riderTrackingRoutesMod;
  const { riderAdminRoutes } = riderAdminRoutesMod;
  const { riderRoutes } = riderRoutesMod;
  const { dispatchAdapterRoutes } = dispatchAdapterRoutesMod;
  const { batchTrackingRoutes } = batchTrackingRoutesMod;
  const { failoverManager } = failoverMod;
  const { automationRuleRoutes } = automationRuleRoutesMod;
  const { deliveryZoneRoutes } = deliveryZoneRoutesMod;
  const { webhookRoutes } = webhookRoutesMod;
  const { schedulerRoutes } = schedulerRoutesMod;
  const { analyticsExportRoutes } = analyticsExportRoutesMod;
  const { sseRoutes } = sseRoutesMod;
  const { configRoutes } = configRoutesMod;
  const { circuitBreakerRoutes } = circuitBreakerRoutesMod;
  const { sentryErrorsRoutes } = sentryErrorsRoutesMod;
  const { uploadRoutes } = uploadRoutesMod;
  const { feedbackRoutes } = feedbackRoutesMod;
  const { promoRoutes } = promoRoutesMod;
  const { aiRoutes } = aiRoutesMod;
  const { contactRoutes } = contactRoutesMod;
  const { cartRoutes } = cartRoutesMod;
  const { setupWorkers, shutdownWorkers } = workersMod;
  const { setupCronJobs } = cronJobsMod;
  const { redis, subscriberRedis } = redisMod;
  const { buildEventChannel } = eventBusMod;
  const { evaluateRules } = ruleEngineMod;
  const { automationLogs } = automationSchemasMod;
  const { db, closeDatabase } = dbMod;
  const { startSupabaseBridge } = supabaseBridgeMod;
  const { MAX_UPLOAD_SIZE } = validationMod;
  const { randomUUID } = await import('crypto');

  // Initialize Sentry
  initSentry();

  process.on('uncaughtException', (err: any) => {
    captureException(err, { source: 'uncaughtException' });
    logger.fatal({ err }, '[FATAL] Uncaught Exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason: any) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureException(error, { source: 'unhandledRejection' });
    logger.fatal({ err: reason }, '[FATAL] Unhandled Rejection');
    process.exit(1);
  });

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      serializers: {
        err: (err: any) => ({ type: err.constructor?.name || 'Error', message: err.message, stack: err.stack }),
      },
    },
    bodyLimit: MAX_UPLOAD_SIZE,
  });

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

  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Cloud Kitchen Automation API',
          description: 'RESTful API for the cloud kitchen automation system.',
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

  app.addHook('onRequest', async (request, _reply) => {
    (request as any).startTime = Date.now();
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    (request as any).requestId = requestId;
    const controller = new AbortController();
    const isPaymentOrDispatch = request.url.includes('/payment') || request.url.includes('/dispatch');
    const timeoutMs = isPaymentOrDispatch ? 60_000 : 30_000;
    (request as any)._abortController = controller;
    (request as any)._timeout = setTimeout(() => controller.abort(), timeoutMs);
  });

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

  app.addHook('preSerialization', async (_request, reply, payload) => {
    if (payload && typeof payload === 'object' && 'error' in (payload as any) && !('statusCode' in (payload as any))) {
      (payload as any).statusCode = reply.statusCode;
    }
    return payload;
  });

  const localhostOrigins: (string | RegExp)[] = isProduction ? [] : [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
  ];
  const productionOrigins: (string | RegExp)[] = isProduction && process.env.APP_URL
    ? [process.env.APP_URL, /\.vercel\.app$/]
    : [];
  const envOrigins: (string | RegExp)[] = (process.env.CORS_ORIGINS || '')
    .split(',').filter(Boolean);
  const allowedOrigins: (string | RegExp)[] = [
    ...envOrigins, ...localhostOrigins, ...productionOrigins,
  ];
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
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

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'http://localhost:3000', 'http://localhost:3002', 'https://*.supabase.co'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    noSniff: true,
    xssFilter: true,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.ip;
    },
    enableDraftSpec: true,
  });

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

  if (!process.env.COOKIE_SECRET) {
    logger.warn('[SECURITY] COOKIE_SECRET is not set — cookie signing is insecure');
  }

  app.addHook('onRequest', csrfValidate);

  app.get('/api/v1/csrf-token', async (_request, reply) => {
    return csrfGenerate(_request, reply);
  });

  app.get('/', async () => ({
    message: 'Welcome to the Cloud Kitchen Automation API Server',
    health: '/api/v1/health',
    version: '1.0.0',
  }));

  app.get('/api/v1/health', async (request, reply) => {
    if (isShuttingDown) {
      reply.status(503);
      return { status: 'shutting_down', message: 'Server is shutting down' };
    }

    const checks: Record<string, any> = {};

    try {
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
      environment: process.env.NODE_ENV || 'development',
      checks,
    });
  });

  app.get('/api/v1/metrics', { preHandler: [authenticate, requireAdmin] }, async (_request, reply) => {
    try {
      const { queryClient } = await import('./db/connection.js');
      const pool = queryClient as any;
      dbPoolTotal.set(pool.totalCount ?? 0);
      dbPoolIdle.set(pool.idleCount ?? 0);
      dbPoolWaiting.set(pool.waitingCount ?? 0);
    } catch {
    }
    reply.header('Content-Type', getMetricsContentType());
    return getMetricsText();
  });

  if (!process.env.COOKIE_SECRET && !process.env.JWT_SECRET) {
    logger.warn('[SECURITY] COOKIE_SECRET and JWT_SECRET are both unset');
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

      if (data.event === 'order.out_for_delivery') {
        const orderId = data.payload?.orderId;
        if (orderId) {
          const { startRiderSimulation } = await import('./modules/dispatch/riderSimulator.js');
          startRiderSimulation(Number(orderId)).catch((err: any) => logger.error({ err }, 'Failed to start rider simulation'));
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

  try {
    const info = await redis.info();
    const versionMatch = info.match(/redis_version:([0-9.]+)/);
    const version = versionMatch ? versionMatch[1] : '0.0.0';
    logger.info({ version }, '[Redis] Detected version');
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

  try {
    const { resumeSimulationsOnStartup } = await import('./modules/dispatch/riderSimulator.js');
    await resumeSimulationsOnStartup();
  } catch (err: any) {
    logger.error({ err: err.message }, '[Sim] Failed to run simulator startup recovery');
  }

  logger.info('[Automation] Event subscriber active');
  startSupabaseBridge();

  app.setErrorHandler((error: any, request, reply) => {
    const requestId = (request as any).requestId || 'unknown';
    const statusCode = error.statusCode || 500;
    const isOperational = error.isOperational !== false;

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
    await new Promise<void>((resolve) => bootServer.close(() => resolve()));
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info({ port: PORT }, '[Server] Kitchen API running');
    failoverManager.initialize();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
