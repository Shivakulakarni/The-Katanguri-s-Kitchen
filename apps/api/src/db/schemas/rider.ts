import { pgTable, integer, text, decimal, timestamp, boolean, index, pgEnum } from 'drizzle-orm/pg-core';
import { orders } from './order';

export const riderStatusEnum = pgEnum('rider_status', ['offline', 'online', 'delivering', 'busy']);

export const riders = pgTable('riders', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  vehicleType: text('vehicle_type').notNull().default('bike'),
  vehicleNumber: text('vehicle_number'),
  status: riderStatusEnum('status').notNull().default('offline'),
  isVerified: boolean('is_verified').default(false),
  isActive: boolean('is_active').default(true),
  currentLat: decimal('current_lat', { precision: 10, scale: 7 }),
  currentLng: decimal('current_lng', { precision: 10, scale: 7 }),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('5.00'),
  totalDeliveries: integer('total_deliveries').default(0),
  totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }).default('0'),
  currentOrderId: integer('current_order_id').references(() => orders.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  phoneIdx: index('idx_riders_phone').on(table.phone),
  statusIdx: index('idx_riders_status').on(table.status),
  locationIdx: index('idx_riders_location').on(table.currentLat, table.currentLng),
}));

export const riderEarnings = pgTable('rider_earnings', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  riderId: integer('rider_id').notNull().references(() => riders.id),
  orderId: integer('order_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  type: text('type').notNull().default('delivery'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  riderIdx: index('idx_rider_earnings_rider').on(table.riderId),
  statusIdx: index('idx_rider_earnings_status').on(table.status),
}));

export const riderLocations = pgTable('rider_locations', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  riderId: integer('rider_id').notNull().references(() => riders.id),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow(),
}, (table) => ({
  riderIdx: index('idx_rider_locations_rider').on(table.riderId),
  recordedAtIdx: index('idx_rider_locations_time').on(table.recordedAt),
}));
