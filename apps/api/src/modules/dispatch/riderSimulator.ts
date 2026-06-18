import { db } from '../../db/connection.js';
import { orders, orderStatusHistory } from '../../db/schemas/order.js';
import { customerAddresses } from '../../db/schemas/customer.js';
import { eq } from 'drizzle-orm';
import { updateRiderLocation, RiderLocation } from './riderTracking.routes.js';
import { logger } from '../../utils/logger.js';
import { publishEvent } from '../../utils/eventBus.js';

const log = logger.child({ module: 'rider-simulator' });

// Kitchen coordinates (The Katanguri's Kitchen, Hanamkonda)
const KITCHEN = { lat: 17.9784, lng: 79.5941 };

interface SimState {
  timer: ReturnType<typeof setInterval>;
  safetyTimeout: ReturnType<typeof setTimeout>;
}

// Active simulation timers keyed by orderId
const activeSimulations = new Map<number, SimState>();

// Mock rider pool
const RIDER_NAMES = [
  { name: 'Raj Kumar', phone: '+91-9876543210' },
  { name: 'Priya Reddy', phone: '+91-9876543211' },
  { name: 'Amit Singh', phone: '+91-9876543212' },
  { name: 'Vikram Patel', phone: '+91-9876543213' },
  { name: 'Suresh Babu', phone: '+91-9876543214' },
  { name: 'Kiran Rao', phone: '+91-9876543215' },
];

function getRiderForOrder(orderId: number) {
  return RIDER_NAMES[orderId % RIDER_NAMES.length];
}

/**
 * Generate a realistic route between two points with intermediate waypoints.
 * Adds slight randomness to simulate real road paths.
 */
function generateRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  numPoints: number = 20,
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  const latStep = (to.lat - from.lat) / (numPoints - 1);
  const lngStep = (to.lng - from.lng) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    // Add small random offset to simulate road deviation
    const jitter = i === 0 || i === numPoints - 1 ? 0 : 0.0002;
    points.push({
      lat: from.lat + latStep * i + (Math.random() - 0.5) * jitter,
      lng: from.lng + lngStep * i + (Math.random() - 0.5) * jitter,
    });
  }
  return points;
}

/**
 * Calculate distance between two points in km (Haversine formula).
 */
function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Calculate heading between two points (0-360 degrees).
 */
function calculateHeading(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let heading = (Math.atan2(y, x) * 180) / Math.PI;
  if (heading < 0) heading += 360;
  return Math.round(heading);
}

/**
 * Start a rider simulation for an order.
 * Simulates a rider picking up from the kitchen and moving to the delivery destination.
 */
export async function startRiderSimulation(orderId: number): Promise<void> {
  // Stop any existing simulation for this order
  stopRiderSimulation(orderId);

  // Check order exists and is OUT_FOR_DELIVERY
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== 'OUT_FOR_DELIVERY') {
    log.debug({ orderId, status: order?.status }, '[Sim] Skipping — not OUT_FOR_DELIVERY');
    return;
  }

  // Determine delivery destination
  let deliveryLat = KITCHEN.lat;
  let deliveryLng = KITCHEN.lng;

  if (order.deliveryAddressId) {
    try {
      const [address] = await db.select({
        latitude: customerAddresses.latitude,
        longitude: customerAddresses.longitude,
      }).from(customerAddresses).where(eq(customerAddresses.id, order.deliveryAddressId)).limit(1);
      if (address && address.latitude && address.longitude) {
        deliveryLat = parseFloat(address.latitude.toString());
        deliveryLng = parseFloat(address.longitude.toString());
      }
    } catch {
      // Fall through to default
    }
  }

  // If no address, generate a realistic destination nearby
  if (deliveryLat === KITCHEN.lat && deliveryLng === KITCHEN.lng) {
    const angle = ((orderId * 137.5) * Math.PI) / 180;
    const radius = 0.008 + (orderId % 5) * 0.002;
    deliveryLat = KITCHEN.lat + Math.sin(angle) * radius;
    deliveryLng = KITCHEN.lng + Math.cos(angle) * radius;
  }

  const destination = { lat: deliveryLat, lng: deliveryLng };
  const rider = getRiderForOrder(orderId);

  // Generate route points
  const route = generateRoute(KITCHEN, destination, 40);
  const totalDistance = haversineDistance(KITCHEN, destination);

  // Simulate at ~25 km/h average speed with some variation
  const avgSpeedKmh = 20 + Math.random() * 15;
  const totalDistanceMeters = totalDistance * 1000;
  const totalDurationMs = (totalDistanceMeters / (avgSpeedKmh * 1000 / 3600)) * 1000;

  // Update frequency: 1 update per 2 seconds
  const updateIntervalMs = 2000;
  const stepsPerUpdate = Math.max(1, Math.ceil(route.length / (totalDurationMs / updateIntervalMs)));

  let currentStep = 0;

  log.info({ orderId, rider: rider.name, route: route.length, distance: `${totalDistance.toFixed(2)}km`, eta: `${Math.round(totalDistanceMeters / (avgSpeedKmh * 1000 / 60))}min` }, '[Sim] Starting rider simulation');

  const timer = setInterval(async () => {
    if (currentStep >= route.length - 1) {
      // Simulation complete — rider has arrived
      log.info({ orderId, rider: rider.name }, '[Sim] Rider arrived at destination');
      stopRiderSimulation(orderId);

      // Auto-transition to DELIVERED status in DB
      try {
        await db.update(orders)
          .set({ status: 'DELIVERED', updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        await db.insert(orderStatusHistory).values({
          orderId,
          fromStatus: 'OUT_FOR_DELIVERY',
          toStatus: 'DELIVERED',
          changedBy: 'rider_simulator',
        });
        await publishEvent('order.delivered', { orderId, customerId: order.customerId });
        log.info({ orderId }, '[Sim] Auto-delivered order successfully');
      } catch (err: any) {
        log.error({ err: err.message, orderId }, '[Sim] Failed to auto-deliver order');
      }
      return;
    }

    currentStep = Math.min(currentStep + stepsPerUpdate, route.length - 1);

    const pos = route[currentStep];
    const prevPos = currentStep > 0 ? route[currentStep - 1] : route[0];
    const heading = calculateHeading(prevPos, pos);

    // Calculate speed (vary slightly each update)
    const currentSpeed = avgSpeedKmh + (Math.random() - 0.5) * 8;

    // Calculate ETA
    const remainingDistance = haversineDistance(pos, destination);
    const etaMinutes = Math.max(1, Math.round((remainingDistance / avgSpeedKmh) * 60));

    const location: RiderLocation = {
      orderId,
      riderId: `sim-${orderId}-${rider.name.split(' ')[0].toLowerCase()}`,
      riderName: rider.name,
      riderPhone: rider.phone,
      lat: pos.lat,
      lng: pos.lng,
      heading,
      speed: Math.round(currentSpeed * 10) / 10,
      eta: etaMinutes,
      updatedAt: new Date().toISOString(),
    };

    await updateRiderLocation(location);
  }, updateIntervalMs);

  // Auto-stop after 30 minutes as safety net
  const safetyTimeout = setTimeout(() => {
    if (activeSimulations.has(orderId)) {
      log.warn({ orderId }, '[Sim] Auto-stopped after 30min timeout');
      stopRiderSimulation(orderId);
    }
  }, 30 * 60 * 1000);

  activeSimulations.set(orderId, { timer, safetyTimeout });
}

/**
 * Stop an active rider simulation.
 */
export function stopRiderSimulation(orderId: number): void {
  const state = activeSimulations.get(orderId);
  if (state) {
    clearInterval(state.timer);
    clearTimeout(state.safetyTimeout);
    activeSimulations.delete(orderId);
    log.debug({ orderId }, '[Sim] Stopped rider simulation');
  }
}

/**
 * Get info about all active simulations (for admin dashboard).
 */
export function getActiveSimulations(): Array<{ orderId: number; startedAt: string }> {
  return Array.from(activeSimulations.keys()).map(orderId => ({
    orderId,
    startedAt: new Date().toISOString(),
  }));
}

/**
 * Scan the database and resume any active deliveries simulation on startup.
 */
export async function resumeSimulationsOnStartup(): Promise<void> {
  log.info('[Sim] Checking for active deliveries to resume...');
  try {
    const activeOrders = await db.select().from(orders).where(eq(orders.status, 'OUT_FOR_DELIVERY'));
    if (activeOrders.length > 0) {
      log.info({ count: activeOrders.length }, `[Sim] Resuming ${activeOrders.length} active deliveries`);
      for (const order of activeOrders) {
        startRiderSimulation(order.id).catch(err => {
          log.error({ orderId: order.id, err: err.message }, '[Sim] Failed to resume simulation');
        });
      }
    } else {
      log.debug('[Sim] No active deliveries found to resume');
    }
  } catch (err: any) {
    log.error({ err: err.message }, '[Sim] Failed to query active deliveries on startup');
  }
}
