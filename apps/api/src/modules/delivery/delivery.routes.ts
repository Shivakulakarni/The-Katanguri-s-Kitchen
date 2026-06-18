import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { deliveryZones } from '../../db/schemas/delivery.js';
import { eq } from 'drizzle-orm';
import { authenticate, requireAdmin } from '../../middleware/auth.js';

export async function deliveryZoneRoutes(app: FastifyInstance) {
  // Public: get active delivery zones (for checkout validation)
  app.get('/api/v1/delivery-zones', async () => {
    const zones = await db.select().from(deliveryZones)
      .where(eq(deliveryZones.isActive, true));
    return { zones };
  });

  // Public: validate if an address is within a delivery zone
  app.post('/api/v1/delivery-zones/validate', async (request, reply) => {
    const body = request.body as any;
    const lat = typeof body?.lat === 'number' ? body.lat : parseFloat(body?.lat);
    const lng = typeof body?.lng === 'number' ? body.lng : parseFloat(body?.lng);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return reply.status(400).send({ error: 'lat and lng are required as numbers' });
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return reply.status(400).send({ error: 'Invalid coordinates' });

    const zones = await db.select().from(deliveryZones)
      .where(eq(deliveryZones.isActive, true));

    // Check each zone using Haversine formula
    const match = zones.find(zone => {
      const dLat = (lat - parseFloat(zone.centerLat)) * Math.PI / 180;
      const dLng = (lng - parseFloat(zone.centerLng)) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(parseFloat(zone.centerLat) * Math.PI / 180) *
        Math.cos(lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return distance <= parseFloat(zone.radiusKm);
    });

    if (!match) return { deliverable: false, error: 'Sorry, we don\'t deliver to your area yet' };

    return {
      deliverable: true,
      zone: {
        id: match.id,
        name: match.name,
        deliveryFee: parseFloat(match.deliveryFee),
        minimumOrder: parseFloat(match.minimumOrder),
        estimatedMinutes: match.estimatedMinutes,
      },
    };
  });

  // Admin: manage delivery zones
  app.get('/api/v1/admin/delivery-zones', { preHandler: [authenticate, requireAdmin] }, async () => {
    const zones = await db.select().from(deliveryZones);
    return { zones };
  });

  app.post('/api/v1/admin/delivery-zones', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = request.body as any;
    const { name, centerLat, centerLng, radiusKm } = body;
    if (!name || centerLat === undefined || centerLng === undefined || radiusKm === undefined) {
      return reply.status(400).send({ error: 'Missing required fields: name, centerLat, centerLng, radiusKm' });
    }
    const [zone] = await db.insert(deliveryZones).values({
      name: body.name,
      description: body.description || null,
      centerLat: body.centerLat.toString(),
      centerLng: body.centerLng.toString(),
      radiusKm: body.radiusKm.toString(),
      deliveryFee: (body.deliveryFee || 0).toString(),
      minimumOrder: (body.minimumOrder || 0).toString(),
      estimatedMinutes: body.estimatedMinutes || 30,
      isActive: body.isActive !== false,
    }).returning();
    return { zone };
  });

  app.patch('/api/v1/admin/delivery-zones/:id', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.centerLat !== undefined) updates.centerLat = body.centerLat.toString();
    if (body.centerLng !== undefined) updates.centerLng = body.centerLng.toString();
    if (body.radiusKm !== undefined) updates.radiusKm = body.radiusKm.toString();
    if (body.deliveryFee !== undefined) updates.deliveryFee = body.deliveryFee.toString();
    if (body.minimumOrder !== undefined) updates.minimumOrder = body.minimumOrder.toString();
    if (body.estimatedMinutes !== undefined) updates.estimatedMinutes = body.estimatedMinutes;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const [zone] = await db.update(deliveryZones)
      .set(updates)
      .where(eq(deliveryZones.id, parseInt(id)))
      .returning();
    return { zone };
  });

  app.delete('/api/v1/admin/delivery-zones/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await db.delete(deliveryZones).where(eq(deliveryZones.id, parseInt(id))).returning();
    if (deleted.length === 0) {
      return reply.status(404).send({ error: 'Zone not found' });
    }
    return { success: true };
  });

  // ── Alias routes with /delivery/zones (frontend compat) ──
  app.get('/api/v1/admin/delivery/zones', { preHandler: [authenticate, requireAdmin] }, async () => {
    const zones = await db.select().from(deliveryZones);
    return { zones };
  });

  app.post('/api/v1/admin/delivery/zones', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = request.body as any;
    const { name, centerLat, centerLng, radiusKm } = body;
    if (!name || centerLat === undefined || centerLng === undefined || radiusKm === undefined) {
      return reply.status(400).send({ error: 'Missing required fields: name, centerLat, centerLng, radiusKm' });
    }
    const [zone] = await db.insert(deliveryZones).values({
      name: body.name,
      description: body.description || null,
      centerLat: body.centerLat.toString(),
      centerLng: body.centerLng.toString(),
      radiusKm: body.radiusKm.toString(),
      deliveryFee: (body.deliveryFee || 0).toString(),
      minimumOrder: (body.minimumOrder || 0).toString(),
      estimatedMinutes: body.estimatedMinutes || 30,
      isActive: body.isActive !== false,
    }).returning();
    return { zone };
  });

  app.post('/api/v1/admin/delivery/zones/:id/toggle', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await db.select().from(deliveryZones).where(eq(deliveryZones.id, parseInt(id))).limit(1);
    if (!existing) return reply.status(404).send({ error: 'Zone not found' });
    const [zone] = await db.update(deliveryZones)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(deliveryZones.id, parseInt(id)))
      .returning();
    return { zone };
  });

  app.delete('/api/v1/admin/delivery/zones/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await db.delete(deliveryZones).where(eq(deliveryZones.id, parseInt(id))).returning();
    if (deleted.length === 0) {
      return reply.status(404).send({ error: 'Zone not found' });
    }
    return { success: true };
  });

  // ── Admin validate alias ──
  app.post('/api/v1/admin/delivery/validate', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = request.body as any;
    const lat = typeof body?.lat === 'number' ? body.lat : parseFloat(body?.lat);
    const lng = typeof body?.lng === 'number' ? body.lng : parseFloat(body?.lng);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return reply.status(400).send({ error: 'lat and lng required' });

    const zones = await db.select().from(deliveryZones)
      .where(eq(deliveryZones.isActive, true));

    const match = zones.find(zone => {
      const dLat = (lat - parseFloat(zone.centerLat)) * Math.PI / 180;
      const dLng = (lng - parseFloat(zone.centerLng)) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(parseFloat(zone.centerLat) * Math.PI / 180) *
        Math.cos(lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return distance <= parseFloat(zone.radiusKm);
    });

    if (!match) return { deliverable: false, error: 'Outside delivery area' };
    return {
      deliverable: true,
      zone: {
        id: match.id,
        name: match.name,
        deliveryFee: parseFloat(match.deliveryFee),
        minimumOrder: parseFloat(match.minimumOrder),
        estimatedMinutes: match.estimatedMinutes,
      },
    };
  });
}
