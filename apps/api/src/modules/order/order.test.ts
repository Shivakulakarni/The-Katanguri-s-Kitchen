import { describe, it, expect } from 'vitest';
import { ORDER_STATUS_FLOW, type OrderStatus } from '../../types/index.js';

describe('ORDER_STATUS_FLOW', () => {
  it('is typed as Record<OrderStatus, OrderStatus[]>', () => {
    // Type-level check: all OrderStatus values have entries
    const allStatuses: OrderStatus[] = [
      'PENDING', 'CONFIRMED', 'PREPARING', 'READY',
      'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED',
    ];

    for (const status of allStatuses) {
      expect(ORDER_STATUS_FLOW[status]).toBeDefined();
      expect(Array.isArray(ORDER_STATUS_FLOW[status])).toBe(true);
    }
  });

  it('PENDING can transition to CONFIRMED, CANCELLED, REJECTED', () => {
    expect(ORDER_STATUS_FLOW.PENDING).toContain('CONFIRMED');
    expect(ORDER_STATUS_FLOW.PENDING).toContain('CANCELLED');
    expect(ORDER_STATUS_FLOW.PENDING).toContain('REJECTED');
    expect(ORDER_STATUS_FLOW.PENDING).not.toContain('DELIVERED');
  });

  it('CONFIRMED can transition to PREPARING or CANCELLED', () => {
    expect(ORDER_STATUS_FLOW.CONFIRMED).toContain('PREPARING');
    expect(ORDER_STATUS_FLOW.CONFIRMED).toContain('CANCELLED');
    expect(ORDER_STATUS_FLOW.CONFIRMED).not.toContain('DELIVERED');
  });

  it('PREPARING can only transition to READY', () => {
    expect(ORDER_STATUS_FLOW.PREPARING).toEqual(['READY']);
  });

  it('READY can only transition to OUT_FOR_DELIVERY', () => {
    expect(ORDER_STATUS_FLOW.READY).toEqual(['OUT_FOR_DELIVERY']);
  });

  it('OUT_FOR_DELIVERY can only transition to DELIVERED', () => {
    expect(ORDER_STATUS_FLOW.OUT_FOR_DELIVERY).toEqual(['DELIVERED']);
  });

  it('DELIVERED is a terminal state (no transitions)', () => {
    expect(ORDER_STATUS_FLOW.DELIVERED).toEqual([]);
  });

  it('CANCELLED is a terminal state (no transitions)', () => {
    expect(ORDER_STATUS_FLOW.CANCELLED).toEqual([]);
  });

  it('REJECTED is a terminal state (no transitions)', () => {
    expect(ORDER_STATUS_FLOW.REJECTED).toEqual([]);
  });

  it('validates a full order lifecycle: PENDING → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED', () => {
    const lifecycle: OrderStatus[] = [
      'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED',
    ];

    for (let i = 0; i < lifecycle.length - 1; i++) {
      const current = lifecycle[i];
      const next = lifecycle[i + 1];
      expect(ORDER_STATUS_FLOW[current]).toContain(next);
    }
  });

  it('rejects invalid transitions (e.g., PENDING → DELIVERED)', () => {
    expect(ORDER_STATUS_FLOW.PENDING).not.toContain('DELIVERED');
    expect(ORDER_STATUS_FLOW.PENDING).not.toContain('PREPARING');
    expect(ORDER_STATUS_FLOW.PENDING).not.toContain('READY');
    expect(ORDER_STATUS_FLOW.PENDING).not.toContain('OUT_FOR_DELIVERY');
  });
});
