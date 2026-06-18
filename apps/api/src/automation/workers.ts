import { Worker } from 'bullmq';
import { redis } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
import { handleOrderPlaced, handleOrderConfirmed, handleOrderReady, handleOrderDelivered, handleOrderCancelled } from './workflows/orderWorkflows.js';
import { handleOrderConfirmation, handleOutForDelivery, handleFeedbackRequest, handleAbandonedCart, handleReEngagement } from './workflows/communicationWorkflows.js';
import { handleAssignRider } from './workflows/dispatchWorkflows.js';

const connection = redis as any;
const workerLogger = logger.child({ module: 'workers' });

let workersSupported: boolean | null = null;
const activeWorkers: Worker[] = [];

function createWorker(queueName: string, processor: (job: any) => Promise<any>): Worker | null {
  if (workersSupported === false) return null;
  try {
    const worker = new Worker(queueName, processor, { connection });
    worker.on('error', (err: any) => {
      if (String(err.message).includes('Redis version')) {
        workersSupported = false;
      }
      workerLogger.error({ queue: queueName, err: err.message }, '[BullMQ] Worker error');
    });
    activeWorkers.push(worker);
    return worker;
  } catch {
    workersSupported = false;
    return null;
  }
}

export async function shutdownWorkers() {
  for (const worker of activeWorkers) {
    try {
      await worker.close();
    } catch (err: any) {
      workerLogger.error({ err: err.message }, '[BullMQ] Worker close error');
    }
  }
  activeWorkers.length = 0;
  workerLogger.info('[Automation] BullMQ workers shut down');
}

export function setupWorkers() {
  createWorker('orders', async (job: any) => {
    switch (job.name) {
      case 'place-order': return handleOrderPlaced(job);
      case 'confirm-order': return handleOrderConfirmed(job);
      case 'order-ready': return handleOrderReady(job);
      case 'order-delivered': return handleOrderDelivered(job);
      case 'order-cancelled': return handleOrderCancelled(job);
      default:
        workerLogger.warn({ jobName: job.name }, '[BullMQ] Unknown job type in orders queue');
        return { skipped: true, reason: 'unknown_job_type' };
    }
  });

  createWorker('communication', async (job: any) => {
    switch (job.name) {
      case 'order-confirmation': return handleOrderConfirmation(job);
      case 'out-for-delivery': return handleOutForDelivery(job);
      case 'feedback-request': return handleFeedbackRequest(job);
      case 'abandoned-cart': return handleAbandonedCart(job);
      case 're-engagement': return handleReEngagement(job);
      default:
        workerLogger.warn({ jobName: job.name }, '[BullMQ] Unknown job type in communication queue');
        return { skipped: true, reason: 'unknown_job_type' };
    }
  });

  createWorker('dispatch', async (job: any) => {
    switch (job.name) {
      case 'assign-rider': return handleAssignRider(job);
      default:
        workerLogger.warn({ jobName: job.name }, '[BullMQ] Unknown job type in dispatch queue');
        return { skipped: true, reason: 'unknown_job_type' };
    }
  });

  if (workersSupported === false) {
    workerLogger.warn('[Automation] BullMQ workers inactive — Redis >= 6.2 required. Run: docker compose up -d redis');
  } else {
    workerLogger.info('[Automation] BullMQ workers initialized');
  }
}
