import { pgTable, text, decimal, integer, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { dishes } from './menu.js';

export const ingredients = pgTable('ingredients', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull().unique(),
  unit: text('unit').notNull(),
  currentStock: decimal('current_stock', { precision: 10, scale: 2 }).notNull().default('0'),
  parLevel: decimal('par_level', { precision: 10, scale: 2 }).notNull().default('10'),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).default('0'),
  version: integer('version').notNull().default(1),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  stockIdx: index('idx_ingredients_stock').on(table.currentStock),
  nameIdx: index('idx_ingredients_name').on(table.name),
  currentStockCheck: check('ingredients_current_stock_check', sql`${table.currentStock} >= 0`),
  parLevelCheck: check('ingredients_par_level_check', sql`${table.parLevel} >= 0`),
  unitCostCheck: check('ingredients_unit_cost_check', sql`${table.unitCost} >= 0`),
}));

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id),
  changeQty: decimal('change_qty', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  referenceId: text('reference_id'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  ingredientIdx: index('idx_inventory_tx_ingredient').on(table.ingredientId),
  createdAtIdx: index('idx_inventory_tx_created_at').on(table.createdAt),
  reasonIdx: index('idx_inventory_tx_reason').on(table.reason),
}));

export const dishIngredients = pgTable('dish_ingredients', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  dishId: integer('dish_id').notNull().references(() => dishes.id, { onDelete: 'cascade' }),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
}, (table) => ({
  dishIdx: index('idx_dish_ingredients_dish').on(table.dishId),
  ingredientIdx: index('idx_dish_ingredients_ingredient').on(table.ingredientId),
  quantityCheck: check('dish_ingredients_quantity_check', sql`${table.quantity} > 0`),
}));
