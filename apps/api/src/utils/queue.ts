import { Queue, QueueEvents } from 'bullmq';
import { redis } from './redis.js';
import { logger } from './logger.js';

// BullMQ requires maxRetriesPerRequest to be null — use a dedicated connection
const connection = (redis as any).duplicate({ maxRetriesPerRequest: null });

const queueLogger = logger.child({ module: 'queue' });

class LazyQueue {
  private instance: any = null;
  constructor(private name: string, private opts: any) {}

  private getInstance() {
    if (!this.instance) {
      try {
        const q = new Queue(this.name, this.opts);
        q.on('error', (err) => queueLogger.error({ err: err.message, queue: this.name }, '[BullMQ] Queue error'));
        this.instance = q;
      } catch (err: any) {
        queueLogger.warn({ queue: this.name, err: err.message }, '[BullMQ] Failed to initialize queue — using mock');
        this.instance = {
          add: async (name: string, data: any) => {
            queueLogger.debug({ queue: this.name, job: name, data }, '[Mock Queue] Job added');
            return { id: 'mock-id' };
          },
          on: () => {},
        };
      }
    }
    return this.instance;
  }

  async add(name: string, data: any, opts?: any) {
    try {
      return await this.getInstance().add(name, data, opts);
    } catch (err: any) {
      queueLogger.error({ queue: this.name, job: name, err: err.message }, '[BullMQ] Add failed — falling back to mock');
      return { id: 'mock-id' };
    }
  }

  on(event: string, handler: any) {
    try {
      this.getInstance().on(event, handler);
    } catch {
      // Event listener failure is non-fatal
    }
    return this;
  }
}

class LazyQueueEvents {
  private instance: any = null;
  constructor(private name: string, private opts: any) {}

  private getInstance() {
    if (!this.instance) {
      try {
        const qe = new QueueEvents(this.name, this.opts);
        qe.on('error', (err) => queueLogger.error({ err: err.message, queue: this.name }, '[BullMQ] QueueEvents error'));
        this.instance = qe;
      } catch (err: any) {
        queueLogger.warn({ queue: this.name, err: err.message }, '[BullMQ] Failed to initialize QueueEvents — using mock');
        this.instance = { on: () => {} };
      }
    }
    return this.instance;
  }

  on(event: string, handler: any) {
    try {
      this.getInstance().on(event, handler);
    } catch {
      // Event listener failure is non-fatal
    }
    return this;
  }
}

export const orderQueue: any = new LazyQueue('orders', { connection });
export const inventoryQueue: any = new LazyQueue('inventory', { connection });
export const paymentQueue: any = new LazyQueue('payments', { connection });
export const communicationQueue: any = new LazyQueue('communication', { connection });
export const dispatchQueue: any = new LazyQueue('dispatch', { connection });
export const schedulerQueue: any = new LazyQueue('scheduler', { connection });
export const aiQueue: any = new LazyQueue('ai', { connection });

export const orderQueueEvents: any = new LazyQueueEvents('orders', { connection });
export const inventoryQueueEvents: any = new LazyQueueEvents('inventory', { connection });
