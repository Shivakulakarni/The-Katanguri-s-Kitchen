import { pgTable, integer, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customers } from './customer.js';

export const cartItems = pgTable('cart_items', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  dishId: integer('dish_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  modifiers: text('modifiers'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  customerIdx: index('idx_cart_items_customer').on(table.customerId),
  dishIdx: index('idx_cart_items_dish').on(table.dishId),
  quantityCheck: check('cart_items_quantity_check', sql`${table.quantity} >= 1`),
}));
