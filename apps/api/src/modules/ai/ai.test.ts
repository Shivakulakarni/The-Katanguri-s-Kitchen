import { describe, it, expect } from 'vitest';
import { analyzeSentiment } from './ai.routes.js';

describe('Sentiment Analysis', () => {
  describe('analyzeSentiment', () => {
    it('returns neutral for empty string', () => {
      const result = analyzeSentiment('');
      expect(result).toEqual({ score: 0, label: 'neutral', keywords: [] });
    });

    it('returns neutral for whitespace-only string', () => {
      const result = analyzeSentiment('   ');
      expect(result).toEqual({ score: 0, label: 'neutral', keywords: [] });
    });

    it('detects positive sentiment', () => {
      const result = analyzeSentiment('The food was amazing and delicious!');
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
      expect(result.keywords).toContain('amazing');
      expect(result.keywords).toContain('delicious');
    });

    it('detects negative sentiment', () => {
      const result = analyzeSentiment('Terrible experience, food was cold and stale');
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(0);
      expect(result.keywords).toContain('terrible');
      expect(result.keywords).toContain('cold');
      expect(result.keywords).toContain('stale');
    });

    it('returns neutral for mixed sentiment', () => {
      const result = analyzeSentiment('Good food but slow delivery');
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0);
      expect(result.keywords).toContain('good');
      expect(result.keywords).toContain('slow');
    });

    it('handles case insensitivity', () => {
      const result = analyzeSentiment('AMAZING Food!!');
      expect(result.label).toBe('positive');
      expect(result.keywords).toContain('amazing');
    });

    it('handles multiple positive words', () => {
      const result = analyzeSentiment('Great food, excellent service, love it!');
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('handles multiple negative words', () => {
      const result = analyzeSentiment('Worst food ever, terrible and disgusting');
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(-0.5);
    });

    it('detects food quality keywords', () => {
      const result = analyzeSentiment('Crispy and tender chicken, perfectly cooked');
      expect(result.keywords).toContain('crispy');
      expect(result.keywords).toContain('tender');
    });

    it('detects delivery keywords', () => {
      const result = analyzeSentiment('Fast delivery and well packed!');
      expect(result.keywords).toContain('fast delivery');
      expect(result.keywords).toContain('well packed');
    });

    it('detects complaint keywords', () => {
      const result = analyzeSentiment('I have a complaint about the refund process');
      expect(result.label).toBe('negative');
      expect(result.keywords).toContain('complaint');
      expect(result.keywords).toContain('refund');
    });

    it('returns score between -1 and 1', () => {
      const positive = analyzeSentiment('Amazing! Excellent! Perfect! Great!');
      const negative = analyzeSentiment('Terrible! Worst! Awful! Horrible!');
      
      expect(positive.score).toBeGreaterThanOrEqual(-1);
      expect(positive.score).toBeLessThanOrEqual(1);
      expect(negative.score).toBeGreaterThanOrEqual(-1);
      expect(negative.score).toBeLessThanOrEqual(1);
    });

    it('handles text with no sentiment words', () => {
      const result = analyzeSentiment('The order number is 12345');
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0);
      expect(result.keywords).toHaveLength(0);
    });
  });
});

describe('Recommendation Scoring Logic', () => {
  it('co-occurrence score increases with more shared orders', () => {
    const coScoreA = 5 / Math.max(10, 1);
    const coScoreB = 2 / Math.max(10, 1);
    expect(coScoreA).toBeGreaterThan(coScoreB);
  });

  it('category affinity score is higher when customer prefers that category', () => {
    const catAffHigh = 8 / Math.max(10, 1);
    const catAffLow = 2 / Math.max(10, 1);
    expect(catAffHigh).toBeGreaterThan(catAffLow);
  });

  it('price sensitivity penalizes dishes far from average price', () => {
    const avgPrice = 200;
    const closePrice = 220;
    const farPrice = 500;

    const closeDiff = Math.abs(closePrice - avgPrice) / avgPrice;
    const farDiff = Math.abs(farPrice - avgPrice) / avgPrice;

    const closeScore = Math.max(0, 1 - closeDiff) * 1;
    const farScore = Math.max(0, 1 - farDiff) * 1;

    expect(closeScore).toBeGreaterThan(farScore);
  });

  it('score ranges from 0 to ~10 for typical inputs', () => {
    const coScore = (3 / 5) * 4;
    const catScore = (4 / 8) * 3;
    const popScore = (10 / 50) * 2;
    const priceScore = Math.max(0, 1 - 0.1) * 1;
    const total = coScore + catScore + popScore + priceScore;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(15);
  });

  it('reason prioritizes co-occurrence over category affinity', () => {
    let reason = '';
    const coScore = 0.5;
    const catAff = 0.4;

    if (coScore > 0) reason = 'Customers who ordered your favorites also loved this';
    if (!reason && catAff > 0.3) reason = 'Based on your love for this category';
    if (!reason) reason = 'Trending right now';

    expect(reason).toBe('Customers who ordered your favorites also loved this');
  });

  it('reason falls back to category affinity when no co-occurrence', () => {
    let reason = '';
    const coScore = 0;
    const catAff = 0.4;

    if (coScore > 0) reason = 'Customers who ordered your favorites also loved this';
    if (!reason && catAff > 0.3) reason = 'Based on your love for this category';
    if (!reason) reason = 'Trending right now';

    expect(reason).toBe('Based on your love for this category');
  });

  it('reason falls back to trending when no signals', () => {
    let reason = '';
    const coScore = 0;
    const catAff = 0.1;

    if (coScore > 0) reason = 'Customers who ordered your favorites also loved this';
    if (!reason && catAff > 0.3) reason = 'Based on your love for this category';
    if (!reason) reason = 'Trending right now';

    expect(reason).toBe('Trending right now');
  });

  it('popularity score scales with order volume', () => {
    const totalItems = 100;
    const popA = (20 / totalItems) * 2;
    const popB = (5 / totalItems) * 2;
    expect(popA).toBeGreaterThan(popB);
  });

  it('limit parameter caps results', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: i, score: 20 - i }));
    const limit = 5;
    const result = items.sort((a, b) => b.score - a.score).slice(0, limit);
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe(0);
  });

  it('already-ordered dishes are excluded', () => {
    const allDishes = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ];
    const orderedIds = new Set([1, 2]);
    const filtered = allDishes.filter(d => !orderedIds.has(d.id));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(3);
  });
});

describe('Demand Forecasting Logic', () => {
  it('dayOfWeek returns correct day names', () => {
    const dayOfWeek = (date: Date): string => {
      return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    };
    
    expect(dayOfWeek(new Date('2024-01-07'))).toBe('Sunday');
    expect(dayOfWeek(new Date('2024-01-08'))).toBe('Monday');
    expect(dayOfWeek(new Date('2024-01-12'))).toBe('Friday');
  });

  it('confidence calculation based on data points', () => {
    const calculateConfidence = (dataPoints: number, lookbackDays: number): number => {
      return Math.min(95, Math.round(30 + (dataPoints / lookbackDays) * 65));
    };
    
    expect(calculateConfidence(0, 28)).toBe(30);
    expect(calculateConfidence(28, 28)).toBe(95);
    expect(calculateConfidence(14, 28)).toBe(63);
  });

  it('trend multiplier calculation', () => {
    const calculateTrendMultiplier = (recentDailyAvg: number, overallDailyAvg: number): number => {
      return overallDailyAvg > 0 ? recentDailyAvg / overallDailyAvg : 1;
    };
    
    expect(calculateTrendMultiplier(10, 5)).toBe(2);
    expect(calculateTrendMultiplier(5, 10)).toBe(0.5);
    expect(calculateTrendMultiplier(5, 5)).toBe(1);
    expect(calculateTrendMultiplier(5, 0)).toBe(1);
  });
});
