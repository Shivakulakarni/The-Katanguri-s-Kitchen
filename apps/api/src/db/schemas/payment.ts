import { pgTable, integer, text, decimal, timestamp, index, pgEnum, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { orders } from './order';

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'failed', 'refunded']);

export const payments = pgTable('payments', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  gateway: text('gateway').notNull().default('stripe'),
  gatewayTransactionId: text('gateway_transaction_id'),
  paymentIntentId: text('payment_intent_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('INR'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  version: integer('version').notNull().default(1),
  createdBy: integer('created_by'),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orderIdx: index('idx_payments_order').on(table.orderId),
  paymentIntentIdx: index('idx_payments_payment_intent').on(table.paymentIntentId),
  statusIdx: index('idx_payments_status').on(table.status),
  gatewayIdx: index('idx_payments_gateway_txn').on(table.gatewayTransactionId),
  createdAtIdx: index('idx_payments_created_at').on(table.createdAt),
  amountCheck: check('payments_amount_check', sql`${table.amount} >= 0`),
}));
