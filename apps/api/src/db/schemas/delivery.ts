import { pgTable, text, decimal, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { orders } from './order.js';
import { customers } from './customer.js';

export const deliveryZones = pgTable('delivery_zones', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  centerLat: decimal('center_lat', { precision: 10, scale: 7 }).notNull(),
  centerLng: decimal('center_lng', { precision: 11, scale: 7 }).notNull(),
  radiusKm: decimal('radius_km', { precision: 5, scale: 2 }).notNull(),
  deliveryFee: decimal('delivery_fee', { precision: 10, scale: 2 }).notNull().default('0'),
  minimumOrder: decimal('minimum_order', { precision: 10, scale: 2 }).notNull().default('0'),
  estimatedMinutes: integer('estimated_minutes').default(30),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeIdx: index('idx_delivery_zones_active').on(table.isActive),
}));

export const restaurantConfig = pgTable('restaurant_config', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const incomingOrders = pgTable('incoming_orders', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  externalId: text('external_id').notNull(),
  source: text('source').notNull(),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  customerAddress: text('customer_address'),
  payload: jsonb('payload').notNull(),
  internalOrderId: integer('internal_order_id').references(() => orders.id),
  status: text('status').notNull().default('received'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at'),
}, (table) => ({
  externalIdIdx: index('idx_incoming_orders_external').on(table.externalId),
  sourceIdx: index('idx_incoming_orders_source').on(table.source),
  statusIdx: index('idx_incoming_orders_status').on(table.status),
  internalOrderIdx: index('idx_incoming_orders_internal').on(table.internalOrderId),
  createdAtIdx: index('idx_incoming_orders_created_at').on(table.createdAt),
}));

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: jsonb('events').notNull().default([]),
  secret: text('secret'),
  isActive: boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  endpointId: integer('endpoint_id').references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: jsonb('payload'),
  status: text('status').notNull().default('pending'),
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attempts: integer('attempts').default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  endpointIdx: index('idx_webhook_deliveries_endpoint').on(table.endpointId),
  statusIdx: index('idx_webhook_deliveries_status').on(table.status),
  createdAtIdx: index('idx_webhook_deliveries_created_at').on(table.createdAt),
}));

export const webhookAlerts = pgTable('webhook_alerts', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  source: text('source'),
  severity: text('severity').notNull().default('info'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  acknowledged: boolean('acknowledged').notNull().default(false),
  acknowledgedBy: integer('acknowledged_by').references(() => customers.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  severityIdx: index('idx_webhook_alerts_severity').on(table.severity),
  ackIdx: index('idx_webhook_alerts_ack').on(table.acknowledged),
}));
