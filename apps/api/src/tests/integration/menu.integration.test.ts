import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, setupDatabase, teardown, cleanupDatabase } from './setup.js';
import { categories, dishes } from '../../db/schemas/menu.js';
import { eq } from 'drizzle-orm';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('Menu Integration Tests', () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('can insert and query a category', async () => {
    const [cat] = await db.insert(categories).values({
      name: 'TEST:Integration Test Category',
      description: 'Test category for integration tests',
      displayOrder: 1,
      isActive: true,
    }).returning();

    expect(cat).toBeDefined();
    expect(cat.id).toBeGreaterThan(0);
    expect(cat.name).toBe('TEST:Integration Test Category');

    const found = await db.select().from(categories).where(eq(categories.id, cat.id));
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('TEST:Integration Test Category');
  });

  it('can insert a dish linked to a category', async () => {
    const [cat] = await db.insert(categories).values({
      name: 'TEST:Biryani Category',
      description: 'Biryanis',
      displayOrder: 1,
      isActive: true,
    }).returning();

    const [dish] = await db.insert(dishes).values({
      name: 'TEST:Chicken Biryani',
      price: '250',
      categoryId: cat.id,
      isVeg: false,
      isAvailable: true,
      prepTimeMin: 30,
      description: 'Test biryani',
    }).returning();

    expect(dish).toBeDefined();
    expect(dish.id).toBeGreaterThan(0);
    expect(dish.name).toBe('TEST:Chicken Biryani');
    expect(parseFloat(dish.price)).toBe(250);
    expect(dish.categoryId).toBe(cat.id);
  });

  it('can update a dish price', async () => {
    const [cat] = await db.insert(categories).values({
      name: 'TEST:Update Test',
      description: 'Update test',
      displayOrder: 1,
      isActive: true,
    }).returning();

    const [dish] = await db.insert(dishes).values({
      name: 'TEST:Price Update Dish',
      price: '200',
      categoryId: cat.id,
      isVeg: true,
      isAvailable: true,
      prepTimeMin: 15,
    }).returning();

    const [updated] = await db.update(dishes)
      .set({ price: '300' })
      .where(eq(dishes.id, dish.id))
      .returning();

    expect(parseFloat(updated.price)).toBe(300);
  });

  it('can soft-delete a dish', async () => {
    const [cat] = await db.insert(categories).values({
      name: 'TEST:Delete Test',
      description: 'Delete test',
      displayOrder: 1,
      isActive: true,
    }).returning();

    const [dish] = await db.insert(dishes).values({
      name: 'TEST:Dish to Delete',
      price: '150',
      categoryId: cat.id,
      isVeg: false,
      isAvailable: true,
      prepTimeMin: 10,
    }).returning();

    const [deleted] = await db.update(dishes)
      .set({ isAvailable: false })
      .where(eq(dishes.id, dish.id))
      .returning();

    expect(deleted.isAvailable).toBe(false);

    const found = await db.select().from(dishes).where(eq(dishes.id, dish.id));
    expect(found).toHaveLength(1);
  });

  it('enforces price check constraint (non-negative)', async () => {
    const [cat] = await db.insert(categories).values({
      name: 'TEST:Constraint Test',
      description: 'Constraint test',
      displayOrder: 1,
      isActive: true,
    }).returning();

    await expect(
      db.insert(dishes).values({
        name: 'TEST:Negative Price Dish',
        price: '-100',
        categoryId: cat.id,
        isVeg: false,
        isAvailable: true,
        prepTimeMin: 10,
      })
    ).rejects.toThrow();
  });
});
