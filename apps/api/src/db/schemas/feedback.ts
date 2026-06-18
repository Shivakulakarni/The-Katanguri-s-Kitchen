import { pgTable, integer, text, timestamp, boolean, pgEnum, doublePrecision } from 'drizzle-orm/pg-core';
import { orders } from './order';
import { customers } from './customer';

export const feedbackRatingEnum = pgEnum('feedback_rating', ['1', '2', '3', '4', '5']);

export const feedbacks = pgTable('feedbacks', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  rating: text('rating', { enum: ['1', '2', '3', '4', '5'] }).notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  { name: 'idx_feedbacks_order_id', columns: [table.orderId] },
  { name: 'idx_feedbacks_customer_id', columns: [table.customerId] },
]);

export const promoCodeTypes = pgEnum('promo_type', ['percentage', 'flat']);

export const promoCodes = pgTable('promo_codes', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  code: text('code').notNull().unique(),
  type: text('type', { enum: ['percentage', 'flat'] }).notNull().default('percentage'),
  value: doublePrecision('value').notNull(),
  minOrderAmount: doublePrecision('min_order_amount').default(0),
  maxUses: integer('max_uses').default(0),
  currentUses: integer('current_uses').default(0),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  { name: 'idx_promo_codes_is_active', columns: [table.isActive] },
]);
