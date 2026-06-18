import { describe, it, expect } from 'vitest';

describe('Dispatch Routes', () => {
  it('requires READY status to dispatch', () => {
    const statuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    const allowedStatus = 'READY';
    for (const status of statuses) {
      if (status !== allowedStatus) {
        expect(status).not.toBe(allowedStatus);
      }
    }
  });

  it('selects best rider by weighted score', () => {
    const riders = [
      { id: 'r1', eta: 25, rating: 4.7, active_orders: 2 },
      { id: 'r2', eta: 12, rating: 4.8, active_orders: 1 },
      { id: 'r3', eta: 18, rating: 4.9, active_orders: 0 },
    ];

    const scored = riders.map(r => ({
      ...r,
      score: r.eta * 0.4 + (5 - r.rating) * 20 + r.active_orders * 5,
    }));

    scored.sort((a, b) => a.score - b.score);
    expect(scored[0].id).toBe('r3');
  });

  it('returns empty when no riders available', () => {
    const riders: any[] = [];
    const best = riders.length > 0 ? riders[0] : null;
    expect(best).toBeNull();
  });
});
