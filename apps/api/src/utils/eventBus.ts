import { pubSub } from './redis.js';
import { logger } from './logger.js';

const EVENT_PREFIX = 'kitchen:event:';
const STREAM_KEY = 'kitchen:events:stream';
const DLQ_KEY = 'kitchen:events:dlq';
const STREAM_MAX_LEN = 10000;
const DLQ_MAX_LEN = 500;

export async function publishEvent(event: string, payload: Record<string, unknown>) {
  const eventId = `${event}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  const message = JSON.stringify({ event, payload, timestamp, eventId });

  try {
    await pubSub.publish(`${EVENT_PREFIX}${event}`, message);
  } catch (err: any) {
    logger.warn({ err: err.message, event }, '[EventBus] Failed to publish');
  }

  try {
    await (pubSub as any).xAdd(STREAM_KEY, '*', {
      event,
      payload: JSON.stringify(payload),
      timestamp,
      eventId,
    }, { TRIM: { '~': STREAM_MAX_LEN, strategy: 'MAXLEN' } });
  } catch (err: any) {
    logger.warn({ err: err.message, event }, '[EventBus] Failed to persist to stream');
  }
}

export async function replayEvents(eventType: string, since: string, limit: number = 100): Promise<Array<Record<string, unknown>>> {
  try {
    const entries = await (pubSub as any).xRange(STREAM_KEY, since, '+', { COUNT: limit });
    return entries
      .map((entry: any) => ({
        eventId: entry.eventId,
        event: entry.event,
        payload: JSON.parse(entry.payload),
        timestamp: entry.timestamp,
      }))
      .filter((e: any) => !eventType || e.event === eventType);
  } catch (err: any) {
    logger.warn({ err: err.message, eventType }, '[EventBus] Failed to replay events');
    return [];
  }
}

export async function sendToDLQ(event: string, payload: Record<string, unknown>, error: string) {
  try {
    await (pubSub as any).xAdd(DLQ_KEY, '*', {
      event,
      payload: JSON.stringify(payload),
      error,
      timestamp: new Date().toISOString(),
    }, { TRIM: { '~': DLQ_MAX_LEN, strategy: 'MAXLEN' } });
    logger.warn({ event, error }, '[EventBus] Sent to dead letter queue');
  } catch (err: any) {
    logger.error({ err: err.message, event }, '[EventBus] Failed to send to DLQ');
  }
}

export async function getDLQEvents(limit: number = 50): Promise<Array<Record<string, unknown>>> {
  try {
    const entries = await (pubSub as any).xRange(DLQ_KEY, '-', '+', { COUNT: limit });
    return entries.map((entry: any) => ({
      eventId: entry.eventId,
      event: entry.event,
      payload: JSON.parse(entry.payload),
      error: entry.error,
      timestamp: entry.timestamp,
    }));
  } catch (err: any) {
    logger.warn({ err: err.message }, '[EventBus] Failed to read DLQ');
    return [];
  }
}

export function buildEventChannel(event: string): string {
  return `${EVENT_PREFIX}${event}`;
}
