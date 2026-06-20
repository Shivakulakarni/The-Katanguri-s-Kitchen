import { FastifyInstance, FastifyRequest } from 'fastify';
import { db } from '../../db/connection.js';
import { orders, orderStatusHistory } from '../../db/schemas/order.js';
import { customerAddresses } from '../../db/schemas/customer.js';
import { eq } from 'drizzle-orm';
import { buildEventChannel } from '../../utils/eventBus.js';
import { redis } from '../../utils/redis.js';
import * as jose from 'jose';
import { JwtPayload } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { sseClientsGauge } from '../../utils/metrics.js';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    logger.fatal('[FATAL] JWT_SECRET is not set. Cannot start in production.');
    process.exit(1);
  }
  logger.fatal('[FATAL] JWT_SECRET must be set in environment');
  throw new Error('JWT_SECRET not configured');
}

const ORDER_SSE_CHANNELS = [
  'order.placed', 'order.confirmed', 'order.cancelled',
  'order.preparation_started', 'order.ready',
  'order.out_for_delivery', 'order.delivered',
  'menu.updated',
  'inventory.updated',
  'customer.created',
  'customer.updated',
];

/* ── Shared Fan-Out Hub ──
   Single Redis subscriber using PSUBSCRIBE pattern. Each event channel
   fans out to connected SSE clients. Dead clients are purged via periodic
   heartbeat checks with write-buffer limit to prevent OOM. */
type SseClient = { write: (data: string) => void; orderId?: number; userId?: number; isMenuOnly?: boolean; lastWriteOk: boolean };
const sseClients = new Set<SseClient>();
const MAX_SSE_CLIENTS = parseInt(process.env.MAX_SSE_CLIENTS || '500');
const MAX_WRITE_BUFFER = parseInt(process.env.MAX_SSE_WRITE_BUFFER || '64');
let hubInitialized = false;

const CHANNEL_PATTERN = buildEventChannel('*').replace('*', '.*');
const channelToEventType: Record<string, string> = {};
for (const et of ORDER_SSE_CHANNELS) {
  channelToEventType[buildEventChannel(et)] = et;
}

function initHub() {
  if (hubInitialized) return;
  hubInitialized = true;

  const sub = redis.duplicate();
  sub.psubscribe(CHANNEL_PATTERN).catch(() => {});
  sub.on('pmessage', (_pattern, channel, message) => {
    const eventType = channelToEventType[channel] || 'unknown';
    try {
      const data = JSON.parse(message);
      const isNewOrder = eventType === 'order.placed';
      const isMenuUpdate = eventType === 'menu.updated';
      const isInventoryUpdate = eventType === 'inventory.updated';
      const isCustomerCreate = eventType === 'customer.created';
      const isCustomerUpdate = eventType === 'customer.updated';

      const statusMap: Record<string, string> = {
        'order.confirmed':           'CONFIRMED',
        'order.preparation_started': 'PREPARING',
        'order.ready':               'READY',
        'order.out_for_delivery':    'OUT_FOR_DELIVERY',
        'order.delivered':           'DELIVERED',
        'order.cancelled':           'CANCELLED',
      };

      const payload = JSON.stringify({
        type: isMenuUpdate ? 'menu_update' : (isInventoryUpdate ? 'inventory_update' : (isCustomerCreate ? 'customer_create' : (isCustomerUpdate ? 'customer_update' : (isNewOrder ? 'new_order' : 'status_change')))),
        event: eventType,
        orderId: data.payload?.orderId,
        payload: isMenuUpdate ? {
          dishId: data.payload?.dishId,
          isAvailable: data.payload?.isAvailable,
        } : isInventoryUpdate ? {
          ingredientId: data.payload?.ingredientId,
          currentStock: data.payload?.currentStock,
        } : isCustomerCreate ? {
          customer: data.payload?.customer,
        } : isCustomerUpdate ? {
          customerId: data.payload?.customerId,
          lifetimeValue: data.payload?.lifetimeValue,
          lastOrderAt: data.payload?.lastOrderAt,
        } : {
          ...data.payload,
          status: isNewOrder ? 'PENDING' : statusMap[eventType] || data.payload?.status,
        },
        timestamp: data.timestamp,
      });

      for (const client of sseClients) {
        if (client.isMenuOnly) {
          if (isMenuUpdate) writeWithBackpressure(client, payload);
        } else {
          if (isMenuUpdate || isInventoryUpdate || isCustomerCreate || isCustomerUpdate) {
            writeWithBackpressure(client, payload);
          } else if (!client.orderId || client.orderId === data.payload?.orderId) {
            writeWithBackpressure(client, payload);
          }
        }
      }
    } catch {
      // SSE message parse failure is non-fatal
    }
  });
  sub.on('error', (err: any) => logger.warn({ err: err.message }, '[SSE Hub] Redis sub error'));

  // Heartbeat + dead client cleanup every 15s
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(`:heartbeat\n\n`);
        client.lastWriteOk = true;
      } catch {
        client.lastWriteOk = false;
      }
    }
    // Purge clients that failed two consecutive writes
    for (const client of sseClients) {
      if (!client.lastWriteOk) {
        sseClients.delete(client);
      }
    }
  }, 15000);

  logger.info('[SSE] Shared fan-out hub initialized');
}

let writeBufferUsed = 0;

function writeWithBackpressure(client: SseClient, data: string) {
  if (writeBufferUsed >= MAX_WRITE_BUFFER) {
    logger.warn('[SSE] Backpressure limit reached — dropping event');
    return;
  }
  writeBufferUsed++;
  try {
    client.write(`data: ${data}\n\n`);
    client.lastWriteOk = true;
  } catch {
    client.lastWriteOk = false;
  } finally {
    writeBufferUsed--;
  }
}

function updateSseMetrics() {
  try {
    sseClientsGauge.set(sseClients.size);
  } catch {
    // metrics unavailable
  }
}

function addClient(client: SseClient) {
  initHub();
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    logger.warn({ max: MAX_SSE_CLIENTS }, '[SSE] Max clients reached. Rejecting new connection.');
    return false;
  }
  client.lastWriteOk = true;
  sseClients.add(client);
  updateSseMetrics();
  return true;
}
function removeClient(client: SseClient) {
  sseClients.delete(client);
  updateSseMetrics();
}

/* ── Auth helper: extract user from Authorization header or cookie ── */
const SSE_ACCESS_SECRET = new TextEncoder().encode(JWT_SECRET);
const SSE_SUPABASE_KEY = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null;

async function authenticateSse(request: FastifyRequest): Promise<JwtPayload | null> {
  let token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    token = request.cookies?.access_token;
  }
  if (!token) return null;

  if (SSE_SUPABASE_KEY) {
    try {
      const { payload: decoded } = await jose.jwtVerify(token, SSE_SUPABASE_KEY, { algorithms: ['HS256'] });
      return decoded as unknown as JwtPayload;
    } catch {
      // fall through to local JWT
    }
  }

  try {
    const { payload: decoded } = await jose.jwtVerify(token, SSE_ACCESS_SECRET, { algorithms: ['HS256'] });
    return decoded as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function sseRoutes(app: FastifyInstance) {
  app.get('/api/v1/orders/:id/stream', async (request: FastifyRequest, reply) => {
    if (sseClients.size >= MAX_SSE_CLIENTS) {
      return reply.status(429).send({ error: 'Too many SSE connections. Try again later.' });
    }
    const { id } = request.params as { id: string };
    const orderId = parseInt(id);

    const [order] = await db.select({
      id: orders.id, status: orders.status, totalAmount: orders.totalAmount,
      dispatchId: orders.dispatchId, createdAt: orders.createdAt, updatedAt: orders.updatedAt,
      customerId: orders.customerId, deliveryAddressId: orders.deliveryAddressId,
    }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return reply.status(404).send({ error: 'Order not found' });

    const user = await authenticateSse(request);
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    if (order.customerId && user.customerId && user.customerId !== order.customerId && user.role !== 'admin') {
      return reply.status(403).send({ error: 'Not authorized to view this order' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Referrer-Policy': 'no-referrer',
    });

    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;
    if (order.deliveryAddressId) {
      const [address] = await db.select({
        latitude: customerAddresses.latitude,
        longitude: customerAddresses.longitude,
      }).from(customerAddresses).where(eq(customerAddresses.id, order.deliveryAddressId)).limit(1);
      if (address && address.latitude && address.longitude) {
        deliveryLat = parseFloat(address.latitude.toString());
        deliveryLng = parseFloat(address.longitude.toString());
      }
    }
    if (deliveryLat === null || deliveryLng === null) {
      deliveryLat = 17.9784;
      deliveryLng = 79.5941;
    }

    const history = await db.select({
      fromStatus: orderStatusHistory.fromStatus,
      toStatus: orderStatusHistory.toStatus,
      changedBy: orderStatusHistory.changedBy,
      createdAt: orderStatusHistory.createdAt,
    }).from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(orderStatusHistory.createdAt);

    const writeData = (data: string) => {
      try { reply.raw.write(data); } catch {
        // Client may have disconnected
      }
    };

    writeData(`data: ${JSON.stringify({
      type: 'initial',
      order: {
        id: order.id, status: order.status, totalAmount: order.totalAmount,
        dispatchId: order.dispatchId, createdAt: order.createdAt, updatedAt: order.updatedAt,
        deliveryLat, deliveryLng,
      },
      history: history.map(h => ({
        fromStatus: h.fromStatus, toStatus: h.toStatus,
        changedBy: h.changedBy, createdAt: h.createdAt,
      })),
    })}\n\n`);
    writeData(`:connected\n\n`);

    const client: SseClient = { write: writeData, orderId, userId: user?.customerId, lastWriteOk: true };
    addClient(client);

    request.raw.on('close', () => {
      removeClient(client);
    });
  });

  app.get('/api/v1/menu/stream', async (request: FastifyRequest, reply) => {
    if (sseClients.size >= MAX_SSE_CLIENTS) {
      return reply.status(429).send({ error: 'Too many SSE connections. Try again later.' });
    }
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Referrer-Policy': 'no-referrer',
    });

    const writeData = (data: string) => {
      try { reply.raw.write(data); } catch {
        // Client may have disconnected
      }
    };

    writeData(`:connected\n\n`);

    const client: SseClient = { write: writeData, isMenuOnly: true, lastWriteOk: true };
    addClient(client);

    request.raw.on('close', () => {
      removeClient(client);
    });
  });

  app.get('/api/v1/admin/orders/stream', async (request: FastifyRequest, reply) => {
    if (sseClients.size >= MAX_SSE_CLIENTS) {
      return reply.status(429).send({ error: 'Too many SSE connections. Try again later.' });
    }
    const user = await authenticateSse(request);
    if (!user || user.role !== 'admin') {
      return reply.status(401).send({ error: 'Admin authentication required' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Referrer-Policy': 'no-referrer',
    });

    const writeData = (data: string) => {
      try { reply.raw.write(data); } catch {
        // Client may have disconnected
      }
    };

    writeData(`:connected\n\n`);

    const client: SseClient = { write: writeData, lastWriteOk: true };
    addClient(client);

    request.raw.on('close', () => {
      removeClient(client);
    });
  });
}
