import { pgTable, text, integer, decimal, boolean, timestamp, jsonb, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const categories = pgTable('categories', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  displayOrder: integer('display_order').default(0),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeIdx: index('idx_categories_active').on(table.isActive),
}));

export const dishes = pgTable('dishes', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  prepTimeMin: integer('prep_time_min').notNull().default(15),
  dietaryTags: text('dietary_tags').default('{}'),
  imageUrl: text('image_url'),
  isAvailable: boolean('is_available').default(true),
  isVeg: boolean('is_veg').default(true),
  version: integer('version').notNull().default(1),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  categoryIdx: index('idx_dishes_category').on(table.categoryId),
  availableIdx: index('idx_dishes_available').on(table.isAvailable),
  nameIdx: index('idx_dishes_name').on(table.name),
  categoryAvailableIdx: index('idx_dishes_category_available').on(table.categoryId, table.isAvailable),
  priceCheck: check('dishes_price_check', sql`${table.price} >= 0`),
}));

export const dishModifiers = pgTable('dish_modifiers', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  dishId: integer('dish_id').notNull().references(() => dishes.id),
  name: text('name').notNull(),
  type: text('type').notNull().default('single'),
  options: jsonb('options').notNull().default([]),
  isRequired: boolean('is_required').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  dishIdx: index('idx_dish_modifiers_dish').on(table.dishId),
}));
