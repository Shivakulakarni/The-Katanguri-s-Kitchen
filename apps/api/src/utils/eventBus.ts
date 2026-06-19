import { pubSub } from './redis.js';
import { logger } from './logger.js';

const EVENT_PREFIX = 'kitchen:event:';
const STREAM_KEY = 'kitchen:events:stream';
const DLQ_KEY = 'kitchen:events:dlq';
const STREAM_MAX_LEN = 10000;
const DLQ_MAX_LEN = 500;

function parseStreamFields(fields: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }
  return obj;
}

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
    await pubSub.xadd(
      STREAM_KEY,
      'MAXLEN',
      '~',
      STREAM_MAX_LEN.toString(),
      '*',
      'event',
      event,
      'payload',
      JSON.stringify(payload),
      'timestamp',
      timestamp,
      'eventId',
      eventId
    );
  } catch (err: any) {
    logger.warn({ err: err.message, event }, '[EventBus] Failed to persist to stream');
  }
}

export async function replayEvents(eventType: string, since: string, limit: number = 100): Promise<Array<Record<string, unknown>>> {
  try {
    const entries = await pubSub.xrange(STREAM_KEY, since, '+', 'COUNT', limit.toString());
    return entries
      .map(([_id, fields]: any) => {
        const parsed = parseStreamFields(fields);
        return {
          eventId: parsed.eventId,
          event: parsed.event,
          payload: parsed.payload ? JSON.parse(parsed.payload) : {},
          timestamp: parsed.timestamp,
        };
      })
      .filter((e: any) => !eventType || e.event === eventType);
  } catch (err: any) {
    logger.warn({ err: err.message, eventType }, '[EventBus] Failed to replay events');
    return [];
  }
}

export async function sendToDLQ(event: string, payload: Record<string, unknown>, error: string) {
  try {
    await pubSub.xadd(
      DLQ_KEY,
      'MAXLEN',
      '~',
      DLQ_MAX_LEN.toString(),
      '*',
      'event',
      event,
      'payload',
      JSON.stringify(payload),
      'error',
      error,
      'timestamp',
      new Date().toISOString()
    );
    logger.warn({ event, error }, '[EventBus] Sent to dead letter queue');
  } catch (err: any) {
    logger.error({ err: err.message, event }, '[EventBus] Failed to send to DLQ');
  }
}

export async function getDLQEvents(limit: number = 50): Promise<Array<Record<string, unknown>>> {
  try {
    const entries = await pubSub.xrange(DLQ_KEY, '-', '+', 'COUNT', limit.toString());
    return entries.map(([_id, fields]: any) => {
      const parsed = parseStreamFields(fields);
      return {
        eventId: parsed.eventId,
        event: parsed.event,
        payload: parsed.payload ? JSON.parse(parsed.payload) : {},
        error: parsed.error,
        timestamp: parsed.timestamp,
      };
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, '[EventBus] Failed to read DLQ');
    return [];
  }
}

export function buildEventChannel(event: string): string {
  return `${EVENT_PREFIX}${event}`;
}
