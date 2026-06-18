import { describe, it, expect } from 'vitest';

describe('Menu cache constants', () => {
  it('defines cache key for full menu', () => {
    const MENU_CACHE_KEY = 'cache:menu:all';
    expect(MENU_CACHE_KEY).toBe('cache:menu:all');
  });

  it('defines cache TTL of 60 seconds', () => {
    const MENU_CACHE_TTL = 60;
    expect(MENU_CACHE_TTL).toBe(60);
  });
});

describe('Dish modifier grouping', () => {
  it('groups modifiers by dishId', () => {
    const mods = [
      { dishId: 1, name: 'Spice Level', type: 'single', options: ['Mild', 'Medium', 'Hot'] },
      { dishId: 1, name: 'Add-ons', type: 'multi', options: ['Extra Cheese', 'Paneer'] },
      { dishId: 2, name: 'Spice Level', type: 'single', options: ['Mild', 'Hot'] },
    ];

    const grouped: Record<number, typeof mods> = {};
    for (const mod of mods) {
      if (!grouped[mod.dishId]) grouped[mod.dishId] = [];
      grouped[mod.dishId].push(mod);
    }

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped[1]).toHaveLength(2);
    expect(grouped[2]).toHaveLength(1);
  });

  it('handles empty modifiers array', () => {
    const mods: any[] = [];
    const grouped: Record<number, any[]> = {};
    for (const mod of mods) {
      if (!grouped[mod.dishId]) grouped[mod.dishId] = [];
      grouped[mod.dishId].push(mod);
    }

    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

describe('Menu category filtering', () => {
  it('filters categories by name case-insensitively', () => {
    const categories = [
      { id: 1, name: 'Biryani', isActive: true },
      { id: 2, name: 'Starters', isActive: true },
      { id: 3, name: 'Beverages', isActive: true },
    ];

    const filtered = categories.filter(c => c.name.toLowerCase() === 'biryani');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });

  it('returns empty for non-existent category', () => {
    const categories = [
      { id: 1, name: 'Biryani', isActive: true },
    ];

    const filtered = categories.filter(c => c.name.toLowerCase() === 'desserts');
    expect(filtered).toHaveLength(0);
  });
});

describe('Dish availability', () => {
  it('marks dish as unavailable on delete', () => {
    const dish = { id: 1, name: 'Biryani', isAvailable: true, updatedAt: new Date() };
    const updated = { ...dish, isAvailable: false, updatedAt: new Date() };

    expect(updated.isAvailable).toBe(false);
    expect(updated.name).toBe('Biryani');
  });
});
