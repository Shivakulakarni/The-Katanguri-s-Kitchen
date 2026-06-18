import { pgTable, integer, text, timestamp, boolean, decimal, index, pgEnum } from 'drizzle-orm/pg-core';

export const customerRoleEnum = pgEnum('customer_role', ['customer', 'admin', 'rider']);

export const customers = pgTable('customers', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  name: text('name'),
  role: customerRoleEnum('role').default('customer'),
  passwordHash: text('password_hash'),
  isGuest: boolean('is_guest').default(false),
  marketingOptOut: boolean('marketing_opt_out').default(false),
  lifetimeValue: decimal('lifetime_value', { precision: 10, scale: 2 }).default('0'),
  lastOrderAt: timestamp('last_order_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  roleIdx: index('idx_customers_role').on(table.role),
  lastOrderIdx: index('idx_customers_last_order').on(table.lastOrderAt),
  createdAtIdx: index('idx_customers_created_at').on(table.createdAt),
}));

export const customerAddresses = pgTable('customer_addresses', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  label: text('label').default('Home'),
  addressLine1: text('address_line_1').notNull(),
  addressLine2: text('address_line_2'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pincode: text('pincode').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  customerIdx: index('idx_customer_addresses_customer').on(table.customerId),
  cityIdx: index('idx_customer_addresses_city').on(table.city),
}));
