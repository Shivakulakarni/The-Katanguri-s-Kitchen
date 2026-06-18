import { Job } from 'bullmq';
import { db } from '../../db/connection.js';
import { orders } from '../../db/schemas/order.js';
import { orderStatusHistory } from '../../db/schemas/order.js';
import { eq } from 'drizzle-orm';
import { publishEvent } from '../../utils/eventBus.js';
import { KITCHEN_LAT, KITCHEN_LNG } from '../../lib/constants.js';
import { customerAddresses } from '../../db/schemas/customer.js';

const DISPATCH_API_URL = process.env.DISPATCH_API_URL || '';
const DISPATCH_API_KEY = process.env.DISPATCH_API_KEY || '';

async function findRiderViaAggregator(orderId: number, pickup: { lat: number; lng: number }, dropoff: { lat: number; lng: number }) {
  if (!DISPATCH_API_URL || !DISPATCH_API_KEY || DISPATCH_API_KEY === 'CHANGE_ME') {
    return null;
  }

  try {
    const response = await fetch(`${DISPATCH_API_URL}/orders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DISPATCH_API_KEY}`,
      },
      body: JSON.stringify({
        order_id: `kitchen_${orderId}`,
        pickup,
        dropoff,
        item_info: 'Food delivery',
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      return {
        dispatchId: data.dispatch_id || data.order_id,
        riderName: data.rider?.name || data.driver?.name || 'Rider',
        riderPhone: data.rider?.phone || data.driver?.phone || '',
        eta: data.eta_minutes || 20,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function handleAssignRider(job: Job) {
  const { orderId } = job.data;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== 'READY') {
    throw new Error(`Order ${orderId} is not in READY status`);
  }

  // Resolve delivery coordinates from order's address (not hardcoded)
  let dropoffLat = KITCHEN_LAT;
  let dropoffLng = KITCHEN_LNG;
  if (order.deliveryAddressId) {
    const [address] = await db.select({
      latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude,
    }).from(customerAddresses).where(eq(customerAddresses.id, order.deliveryAddressId)).limit(1);
    if (address?.latitude && address?.longitude) {
      dropoffLat = parseFloat(address.latitude.toString());
      dropoffLng = parseFloat(address.longitude.toString());
    }
  }

  const pickup = { lat: KITCHEN_LAT, lng: KITCHEN_LNG };
  const dropoff = { lat: dropoffLat, lng: dropoffLng };
  const aggregatorResult = await findRiderViaAggregator(orderId, pickup, dropoff);

  if (!aggregatorResult) {
    throw new Error(`No dispatch provider available for order ${orderId}`);
  }

  await db.update(orders)
    .set({ status: 'OUT_FOR_DELIVERY', dispatchId: aggregatorResult.dispatchId, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: 'READY',
    toStatus: 'OUT_FOR_DELIVERY',
    changedBy: 'dispatch_aggregator',
  });

  await publishEvent('order.out_for_delivery', {
    orderId,
    dispatchId: aggregatorResult.dispatchId,
    riderName: aggregatorResult.riderName,
    riderPhone: aggregatorResult.riderPhone,
    riderEta: aggregatorResult.eta,
  });
  return aggregatorResult;
}

export async function handleTrackDelivery(job: Job) {
  const { orderId } = job.data;

  if (!DISPATCH_API_URL || !DISPATCH_API_KEY || DISPATCH_API_KEY === 'CHANGE_ME') {
    throw new Error('Dispatch provider not configured');
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.dispatchId) {
    throw new Error(`No dispatch ID found for order ${orderId}`);
  }

  const response = await fetch(`${DISPATCH_API_URL}/orders/${order.dispatchId}/track`, {
    headers: { 'Authorization': `Bearer ${DISPATCH_API_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`Dispatch API returned ${response.status}`);
  }

  return await response.json();
}
