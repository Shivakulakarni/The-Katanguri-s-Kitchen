import { pgTable, integer, text, decimal, timestamp, jsonb, index, pgEnum, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customers, customerAddresses } from './customer';

export const orderStatusEnum = pgEnum('order_status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED']);

export const orders = pgTable('orders', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  customerId: integer('customer_id').references(() => customers.id),
  status: orderStatusEnum('status').notNull().default('PENDING'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  deliveryAddressId: integer('delivery_address_id').references(() => customerAddresses.id),
  paymentIntentId: text('payment_intent_id'),
  dispatchId: text('dispatch_id'),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  idempotencyKey: text('idempotency_key'),
  idempotencyKeyCreatedAt: timestamp('idempotency_key_created_at'),
}, (table) => ({
  customerIdx: index('idx_orders_customer').on(table.customerId),
  statusIdx: index('idx_orders_status').on(table.status),
  createdAtIdx: index('idx_orders_created_at').on(table.createdAt),
  customerStatusIdx: index('idx_orders_customer_status').on(table.customerId, table.status),
  statusCreatedIdx: index('idx_orders_status_created').on(table.status, table.createdAt),
  idempotencyKeyIdx: index('idx_orders_idempotency_key').on(table.idempotencyKey),
  dispatchIdIdx: index('idx_orders_dispatch_id').on(table.dispatchId),
  totalAmountCheck: check('orders_total_amount_check', sql`${table.totalAmount} >= 0`),
}));

export const orderItems = pgTable('order_items', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  dishId: integer('dish_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  modifiers: jsonb('modifiers').default([]),
}, (table) => ({
  orderIdx: index('idx_order_items_order').on(table.orderId),
  dishIdx: index('idx_order_items_dish').on(table.dishId),
  quantityCheck: check('order_items_quantity_check', sql`${table.quantity} >= 1`),
  unitPriceCheck: check('order_items_unit_price_check', sql`${table.unitPrice} >= 0`),
}));

export const orderStatusHistory = pgTable('order_status_history', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: text('changed_by').default('system'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orderIdx: index('idx_order_history_order').on(table.orderId),
  createdAtIdx: index('idx_order_history_created_at').on(table.createdAt),
}));
