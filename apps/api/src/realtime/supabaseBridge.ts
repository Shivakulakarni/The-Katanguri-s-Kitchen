import { subscriberRedis } from '../utils/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { buildEventChannel } from '../utils/eventBus.js';
import { CHANNELS } from '../realtime/channels.js';
import { logger } from '../utils/logger.js';

const bridgeLogger = logger.child({ module: 'supabase-bridge' });

const REALTIME_CHANNEL = 'kitchen-live';

const eventToBroadcast: Record<string, string> = {
  [CHANNELS.ORDER_PLACED]: 'order.placed',
  [CHANNELS.ORDER_CONFIRMED]: 'order.confirmed',
  [CHANNELS.ORDER_PREPARING]: 'order.preparing',
  [CHANNELS.ORDER_READY]: 'order.ready',
  [CHANNELS.ORDER_OUT_FOR_DELIVERY]: 'order.out_for_delivery',
  [CHANNELS.ORDER_DELIVERED]: 'order.delivered',
  [CHANNELS.ORDER_CANCELLED]: 'order.cancelled',
  [CHANNELS.MENU_CREATED]: 'menu.created',
  [CHANNELS.MENU_UPDATED]: 'menu.updated',
  [CHANNELS.MENU_DELETED]: 'menu.deleted',
  [CHANNELS.INVENTORY_UPDATED]: 'inventory.updated',
  [CHANNELS.INVENTORY_LOW_STOCK]: 'inventory.low_stock',
  [CHANNELS.CUSTOMER_CREATED]: 'customer.created',
  [CHANNELS.CUSTOMER_UPDATED]: 'customer.updated',
  [CHANNELS.PAYMENT_SUCCEEDED]: 'payment.succeeded',
  [CHANNELS.PAYMENT_FAILED]: 'payment.failed',
  [CHANNELS.DISPATCH_ASSIGNED]: 'dispatch.assigned',
};

export function startSupabaseBridge() {
  if (!supabaseAdmin) {
    bridgeLogger.warn('[Supabase Bridge] Supabase not configured — bridge disabled');
    return;
  }
  const channel = supabaseAdmin.channel(REALTIME_CHANNEL);

  channel
    .on('broadcast', { event: '*' }, () => {})
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') {
        bridgeLogger.warn({ status }, '[Supabase Bridge] Channel status');
        return;
      }
      bridgeLogger.info('[Supabase Bridge] Connected — broadcasting Redis events → Supabase Realtime');

      // Use a SINGLE Redis subscriber for all kitchen events (avoids N duplicate connections)
      const singleSub = subscriberRedis.duplicate();
      const redisEvents = Object.keys(eventToBroadcast);

      try {
        await singleSub.subscribe(...redisEvents.map(e => buildEventChannel(e)));
      } catch (err: any) {
        bridgeLogger.error({ err: err.message }, '[Supabase Bridge] Failed to subscribe to Redis channels');
        return;
      }

      // Build a reverse map from Redis channel → broadcast event name
      const channelToEvent: Record<string, string> = {};
      for (const event of redisEvents) {
        channelToEvent[buildEventChannel(event)] = eventToBroadcast[event];
      }

      singleSub.on('message', (ch, message) => {
        try {
          const parsed = JSON.parse(message);
          const broadcastEvent = channelToEvent[ch];
          if (broadcastEvent) {
            channel.send({
              type: 'broadcast',
              event: broadcastEvent,
              payload: parsed,
            }).catch(() => {});
          }
        } catch {
          // Message parse failure is non-fatal
        }
      });

      // Heartbeat
      setInterval(() => {
        channel.send({ type: 'broadcast', event: 'heartbeat', payload: { ts: Date.now() } }).catch(() => {});
      }, 30000);
    });

  (channel as any).on('error', (err: any) => bridgeLogger.error({ err: err.message }, '[Supabase Bridge] Error'));
}
