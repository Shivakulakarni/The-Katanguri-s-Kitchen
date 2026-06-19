import { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { orders, orderItems } from '../../db/schemas/order.js';
import { feedbacks } from '../../db/schemas/feedback.js';
import { feedbackAnalysis } from '../../db/schemas/ai.js';
import { dishes, categories } from '../../db/schemas/menu.js';
import { ingredients } from '../../db/schemas/inventory.js';
import { customerAddresses, customerFavorites } from '../../db/schemas/customer.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import * as jose from 'jose';
import { eq, desc, sql, count, gte, and, inArray } from 'drizzle-orm';
import { groqPromoSuggestions, hasGroqKey, hasGeminiKey, chatCustomer, chatAdminInsights, enhanceRecommendations, generateMealPlan, generateFoodStory, chatCustomerStream } from './ai.service.js';
import type { AiInsight } from './types.js';
import { redis } from '../../utils/redis.js';
import { logger } from '../../utils/logger.js';

const AI_RATE_WINDOW_SECONDS = 60;

async function checkAiRateLimit(userId: number | string, maxRequests: number): Promise<boolean> {
  const key = `ratelimit:ai:${userId}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, AI_RATE_WINDOW_SECONDS);
    }
    return current <= maxRequests;
  } catch {
    return true;
  }
}

// ──────────────────────────────────────────────────────────
// 1. SENTIMENT ANALYSIS (keyword-based, no external API)
// ──────────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'love', 'best', 'delicious',
  'tasty', 'fantastic', 'awesome', 'perfect', 'wonderful', 'superb',
  'brilliant', 'outstanding', 'nice', 'satisfying', 'fresh', 'hot',
  'recommend', 'happy', 'loved', 'favorite', 'yummy', 'heavenly',
  'flavorful', 'finger-licking', 'top-notch', 'impressive', 'phenomenal',
  'spot on', 'crispy', 'tender', 'authentic', 'generous', 'prompt',
  'quick', 'fast delivery', 'well packed', 'value for money',
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'worst', 'terrible', 'awful', 'hate', 'poor', 'cold',
  'stale', 'tasteless', 'bland', 'overcooked', 'undercooked', 'soggy',
  'oily', 'spicy', 'burnt', 'raw', 'dirty', 'slow', 'late',
  'delayed', 'wrong order', 'missing', 'disappointing', 'waste',
  'money', 'rude', 'rancid', 'smelly', 'expired', 'unhygienic',
  'not fresh', 'less quantity', 'overpriced', 'never again',
  'complaint', 'refund', 'disgusting', 'inedible',
]);

export function analyzeSentiment(comment: string): { score: number; label: string; keywords: string[] } {
  const text = comment.toLowerCase().trim();
  if (!text) return { score: 0, label: 'neutral', keywords: [] };

  let score = 0;
  const keywords: string[] = [];

  for (const word of POSITIVE_WORDS) {
    if (text.includes(word)) {
      score += 1;
      keywords.push(word);
    }
  }
  for (const word of NEGATIVE_WORDS) {
    if (text.includes(word)) {
      score -= 1;
      keywords.push(word);
    }
  }

  const normalized = keywords.length > 0
    ? Math.max(-1, Math.min(1, score / keywords.length))
    : 0;

  const label = normalized > 0.2 ? 'positive' : normalized < -0.2 ? 'negative' : 'neutral';

  return { score: Math.round(normalized * 100) / 100, label, keywords };
}

// ──────────────────────────────────────────────────────────
// 2. SMART RECOMMENDATIONS
// ──────────────────────────────────────────────────────────

interface RecommendationResult {
  dishId: number;
  dishName: string;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  categoryName: string;
  score: number;
  reason: string;
}

/**
 * Collaborative + popularity hybrid recommendation engine.
 * For new users: returns popular dishes.
 * For returning users: uses co-occurrence (what others who ordered X also ordered),
 * category affinity, and price sensitivity.
 */
async function getRecommendations(customerId: number | null, limit: number = 8): Promise<RecommendationResult[]> {
  const cacheKey = customerId ? `recs:${customerId}` : 'recs:guest';
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed: RecommendationResult[] = JSON.parse(cached);
      return parsed.slice(0, limit);
    }
  } catch {
    // Cache miss — compute fresh
  }

  const allDishes = await db.select({
    id: dishes.id,
    name: dishes.name,
    price: dishes.price,
    imageUrl: dishes.imageUrl,
    isVeg: dishes.isVeg,
    categoryId: dishes.categoryId,
    isAvailable: dishes.isAvailable,
  }).from(dishes);

  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map(c => [c.id, c.name]));

  const availableDishes = allDishes.filter(d => d.isAvailable);

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentOrderIds = await db.select({ id: orders.id })
    .from(orders)
    .where(gte(orders.createdAt, ninetyDaysAgo));
  const recentIds = recentOrderIds.map(o => o.id);

  const allOrderItems = recentIds.length === 0 ? [] : await db.select({
    orderId: orderItems.orderId,
    dishId: orderItems.dishId,
    quantity: orderItems.quantity,
  }).from(orderItems)
    .where(inArray(orderItems.orderId, recentIds));

  const dishPopularity: Record<number, number> = {};
  for (const item of allOrderItems) {
    dishPopularity[item.dishId] = (dishPopularity[item.dishId] || 0) + item.quantity;
  }

  if (!customerId) {
    return availableDishes
      .map(d => ({
        dishId: d.id,
        dishName: d.name,
        price: parseFloat(d.price.toString()),
        imageUrl: d.imageUrl,
        isVeg: d.isVeg ?? true,
        categoryName: catMap.get(d.categoryId) || 'Other',
        score: (dishPopularity[d.id] || 0) * 0.5,
        reason: 'Popular choice',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  const customerOrders = await db.select({ id: orders.id })
    .from(orders)
    .where(and(
      eq(orders.customerId, customerId),
      gte(orders.createdAt, ninetyDaysAgo)
    ))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  const customerOrderIds = customerOrders.map(o => o.id);

  if (customerOrderIds.length === 0) {
    return availableDishes
      .map(d => ({
        dishId: d.id,
        dishName: d.name,
        price: parseFloat(d.price.toString()),
        imageUrl: d.imageUrl,
        isVeg: d.isVeg ?? true,
        categoryName: catMap.get(d.categoryId) || 'Other',
        score: (dishPopularity[d.id] || 0) * 0.5,
        reason: 'Popular choice',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  const customerItems = customerOrderIds.length === 0 ? [] : await db.select({
    dishId: orderItems.dishId,
  }).from(orderItems)
    .where(inArray(orderItems.orderId, customerOrderIds));

  const customerDishIds = new Set(customerItems.map(i => i.dishId));

  const categoryAffinity: Record<number, number> = {};
  for (const item of customerItems) {
    const dish = allDishes.find(d => d.id === item.dishId);
    if (dish) {
      categoryAffinity[dish.categoryId] = (categoryAffinity[dish.categoryId] || 0) + 1;
    }
  }

  const dishIdArray = [...customerDishIds];
  const coOccurrenceOrderIds = dishIdArray.length === 0 ? [] : await db.select({ orderId: orderItems.orderId })
    .from(orderItems)
    .where(inArray(orderItems.dishId, dishIdArray));
  const coOccurrenceOrderIdsArray = [...new Set(coOccurrenceOrderIds.map(r => r.orderId))];
  const coOccurrenceOrders = coOccurrenceOrderIdsArray.length === 0 ? [] : await db.select({
    orderId: orderItems.orderId,
    dishId: orderItems.dishId,
  }).from(orderItems)
    .where(inArray(orderItems.orderId, coOccurrenceOrderIdsArray));

  const coOccurrence: Record<number, number> = {};
  for (const item of coOccurrenceOrders) {
    if (!customerDishIds.has(item.dishId)) {
      coOccurrence[item.dishId] = (coOccurrence[item.dishId] || 0) + 1;
    }
  }

  const pastPrices = customerItems.map(i => {
    const dish = allDishes.find(d => d.id === i.dishId);
    return dish ? parseFloat(dish.price.toString()) : 0;
  }).filter(p => p > 0);
  const avgPrice = pastPrices.length > 0
    ? pastPrices.reduce((s, p) => s + p, 0) / pastPrices.length
    : 200;

  const scored = availableDishes
    .filter(d => !customerDishIds.has(d.id))
    .map(d => {
      let score = 0;
      let reason = '';

      const coScore = (coOccurrence[d.id] || 0) / Math.max(customerOrderIds.length, 1);
      score += coScore * 4;
      if (coScore > 0) reason = 'Customers who ordered your favorites also loved this';

      const catAff = (categoryAffinity[d.categoryId] || 0) / Math.max(customerItems.length, 1);
      score += catAff * 3;
      if (!reason && catAff > 0.3) reason = `Based on your love for ${catMap.get(d.categoryId) || 'this category'}`;

      const popScore = (dishPopularity[d.id] || 0) / Math.max(allOrderItems.length, 1);
      score += popScore * 2;
      if (!reason) reason = 'Trending right now';

      const priceDiff = Math.abs(parseFloat(d.price.toString()) - avgPrice) / avgPrice;
      score += Math.max(0, 1 - priceDiff) * 1;

      return {
        dishId: d.id,
        dishName: d.name,
        price: parseFloat(d.price.toString()),
        imageUrl: d.imageUrl,
        isVeg: d.isVeg ?? true,
        categoryName: catMap.get(d.categoryId) || 'Other',
        score: Math.round(score * 100) / 100,
        reason: reason || 'Recommended for you',
      };
    });

  const result = scored.sort((a, b) => b.score - a.score).slice(0, limit);
  try {
    await redis.setex(cacheKey, 900, JSON.stringify(result));
  } catch {
    // Cache write failure is non-fatal
  }
  return result;
}

// ──────────────────────────────────────────────────────────
// 3. DEMAND FORECASTING
// ──────────────────────────────────────────────────────────

interface ForecastResult {
  date: string;
  dayOfWeek: string;
  predictedOrders: number;
  predictedRevenue: number;
  topDishes: { dishId: number; dishName: string; predictedQuantity: number }[];
  confidence: number;
  method: string;
}

function dayOfWeek(date: Date): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

async function getDemandForecast(days: number = 7): Promise<ForecastResult[]> {
  const now = new Date();
  const lookbackDays = 28;

  const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const recentOrders = await db.select({
    id: orders.id,
    totalAmount: orders.totalAmount,
    createdAt: orders.createdAt,
  }).from(orders)
    .where(sql`${orders.createdAt} >= ${sinceIso}::timestamp`)
    .orderBy(orders.createdAt);

  const recentItems = await db.select({
    orderId: orderItems.orderId,
    dishId: orderItems.dishId,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
  }).from(orderItems)
    .where(sql`${orderItems.orderId} IN (SELECT id FROM orders WHERE created_at >= ${sinceIso}::timestamp)`);

  const allDishes = await db.select().from(dishes);
  const dishMap = new Map(allDishes.map(d => [d.id, d.name]));

  const dayOfWeekStats: Record<number, { orders: number; revenue: number; dishQuantities: Record<number, number> }> = {};
  const dateStats: Record<string, { orders: number; revenue: number }> = {};

  for (const o of recentOrders) {
    if (!o.createdAt) continue;
    const d = new Date(o.createdAt);
    const dow = d.getDay();
    const dateStr = d.toISOString().slice(0, 10);

    if (!dayOfWeekStats[dow]) {
      dayOfWeekStats[dow] = { orders: 0, revenue: 0, dishQuantities: {} };
    }
    dayOfWeekStats[dow].orders += 1;
    dayOfWeekStats[dow].revenue += parseFloat(o.totalAmount.toString());

    if (!dateStats[dateStr]) dateStats[dateStr] = { orders: 0, revenue: 0 };
    dateStats[dateStr].orders += 1;
    dateStats[dateStr].revenue += parseFloat(o.totalAmount.toString());

    const orderItemsForOrder = recentItems.filter(i => i.orderId === o.id);
    for (const item of orderItemsForOrder) {
      dayOfWeekStats[dow].dishQuantities[item.dishId] =
        (dayOfWeekStats[dow].dishQuantities[item.dishId] || 0) + item.quantity;
    }
  }

  const weeksInData = Math.max(1, Math.floor(lookbackDays / 7));
  const forecasts: ForecastResult[] = [];

  for (let i = 1; i <= days; i++) {
    const forecastDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = forecastDate.getDay();
    const dateStr = forecastDate.toISOString().slice(0, 10);

    const stats = dayOfWeekStats[dow] || { orders: 0, revenue: 0, dishQuantities: {} };
    const avgOrders = Math.round((stats.orders / weeksInData) * 10) / 10;
    const avgRevenue = Math.round((stats.revenue / weeksInData) * 10) / 10;

    const last7Since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7Orders = recentOrders.filter(o => o.createdAt && new Date(o.createdAt) >= last7Since);
    const recentDailyAvg = last7Orders.length / 7;
    const overallDailyAvg = recentOrders.length / lookbackDays;
    const trendMultiplier = overallDailyAvg > 0 ? recentDailyAvg / overallDailyAvg : 1;

    const adjustedOrders = Math.round(avgOrders * trendMultiplier * 10) / 10;
    const adjustedRevenue = Math.round(avgRevenue * trendMultiplier * 10) / 10;

    const dishQuantities = stats.dishQuantities || {};
    const topDishes = Object.entries(dishQuantities)
      .map(([dishId, qty]) => ({
        dishId: parseInt(dishId),
        dishName: dishMap.get(parseInt(dishId)) || `Dish #${dishId}`,
        predictedQuantity: Math.round((qty as number / weeksInData) * trendMultiplier * 10) / 10,
      }))
      .sort((a, b) => b.predictedQuantity - a.predictedQuantity)
      .slice(0, 5);

    const dataPoints = Object.keys(dateStats).length;
    const confidence = Math.min(95, Math.round(30 + (dataPoints / lookbackDays) * 65));

    forecasts.push({
      date: dateStr,
      dayOfWeek: dayOfWeek(forecastDate),
      predictedOrders: Math.max(0, adjustedOrders),
      predictedRevenue: Math.max(0, adjustedRevenue),
      topDishes,
      confidence,
      method: 'Moving average with trend adjustment',
    });
  }

  return forecasts;
}

// ──────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────

export async function aiRoutes(app: FastifyInstance) {

  // ── GET /api/v1/ai/recommendations ──
  app.get('/api/v1/ai/recommendations', async (request, reply) => {
    try {
      const { limit: limitStr } = request.query as { limit?: string };
      const limit = Math.min(parseInt(limitStr || '8'), 20);

      let customerId: number | null = null;
      try {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const { payload: decoded } = await jose.jwtVerify(
            authHeader.slice(7),
            new TextEncoder().encode(process.env.JWT_SECRET!),
            { algorithms: ['HS256'] }
          );
          customerId = (decoded?.customerId as number) || null;
        }
      } catch {
        // Not authenticated — return popular dishes
      }

      const recommendations = await getRecommendations(customerId, limit);

      // Optional LLM enhancement for authenticated users with order history
      if (customerId && hasGroqKey() && recommendations.length > 0) {
        try {
          const cacheKeyLlm = `recs:llm:${customerId}`;
          const cachedLlm = await redis.get(cacheKeyLlm);
          if (cachedLlm) {
            return { recommendations: JSON.parse(cachedLlm) };
          }

          const customerOrderDesc = recommendations.slice(0, 5).map(r => `${r.dishName}`).join(', ');
          const llmResult = await enhanceRecommendations(
            recommendations.slice(0, 10).map(r => ({
              dishId: r.dishId,
              dishName: r.dishName,
              reason: r.reason,
              score: r.score,
            })),
            customerOrderDesc,
          );

          if (llmResult && llmResult.length > 0) {
            const llmRecs = llmResult.map(lr => {
              const local = recommendations.find(r => r.dishId === lr.dishId);
              return {
                ...(local || { dishId: lr.dishId, dishName: '', price: 0, imageUrl: null, isVeg: true, categoryName: '', score: 0 }),
                reason: lr.reason,
                score: (local?.score || 0) + 0.5,
              };
            });
            await redis.setex(cacheKeyLlm, 1800, JSON.stringify(llmRecs));
            return { recommendations: llmRecs };
          }
        } catch {
          // LLM enhancement failed — fall back to local results
        }
      }

      return { recommendations };
    } catch (err) {
      logger.error({ err }, '[AI] Recommendations failed');
      return reply.status(500).send({ error: 'Failed to generate recommendations' });
    }
  });

  // ── GET /api/v1/ai/sentiment/feedbacks ──
  app.get('/api/v1/ai/sentiment/feedbacks', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    try {
      const { limit: limitStr, offset: offsetStr } = request.query as { limit?: string; offset?: string };
      const queryLimit = Math.min(parseInt(limitStr || '100'), 500);
      const queryOffset = Math.max(parseInt(offsetStr || '0'), 0);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const allFeedback = await db.select().from(feedbacks)
        .where(gte(feedbacks.createdAt, ninetyDaysAgo))
        .orderBy(desc(feedbacks.createdAt))
        .limit(queryLimit)
        .offset(queryOffset);

      const analyzed = allFeedback.map(f => {
        const sentiment = analyzeSentiment(f.comment || '');
        return {
          id: f.id,
          orderId: f.orderId,
          customerId: f.customerId,
          rating: parseInt(f.rating),
          comment: f.comment,
          createdAt: f.createdAt,
          sentiment: sentiment.label,
          sentimentScore: sentiment.score,
          sentimentKeywords: sentiment.keywords,
          suggestedAction: null as string | null,
          themes: [] as string[],
        };
      });

      // Enrich with LLM analysis from feedback_analysis table
      const feedbackIds = analyzed.map(a => a.id);
      if (feedbackIds.length > 0) {
        const llmAnalyses = await db.select().from(feedbackAnalysis)
          .where(inArray(feedbackAnalysis.feedbackId, feedbackIds));
        const llmMap = new Map(llmAnalyses.map(la => [la.feedbackId, la]));
        for (const a of analyzed) {
          const llm = llmMap.get(a.id);
          if (llm) {
            a.sentiment = llm.sentiment;
            a.sentimentScore = parseFloat(llm.score);
            a.themes = (() => { try { return JSON.parse(llm.themes); } catch { return []; } })();
            a.suggestedAction = llm.suggestedAction;
          }
        }
      }

      const total = analyzed.length;
      const positive = analyzed.filter(a => a.sentiment === 'positive').length;
      const negative = analyzed.filter(a => a.sentiment === 'negative').length;
      const neutral = analyzed.filter(a => a.sentiment === 'neutral').length;

      const avgRating = total > 0
        ? Math.round(analyzed.reduce((s, a) => s + a.rating, 0) / total * 10) / 10
        : 0;

      const negativeComments = analyzed.filter(a => a.sentiment === 'negative');
      const themeCounts: Record<string, number> = {};
      for (const n of negativeComments) {
        // Use LLM themes if available, fall back to keywords
        const themes = n.themes.length > 0 ? n.themes : n.sentimentKeywords;
        for (const kw of themes) {
          themeCounts[kw] = (themeCounts[kw] || 0) + 1;
        }
      }
      const topComplaints = Object.entries(themeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count }));

      return {
        feedbacks: analyzed,
        summary: {
          total,
          positive,
          negative,
          neutral,
          avgRating,
          sentimentDistribution: {
            positive: total > 0 ? Math.round(positive / total * 100) : 0,
            negative: total > 0 ? Math.round(negative / total * 100) : 0,
            neutral: total > 0 ? Math.round(neutral / total * 100) : 0,
          },
          topComplaints,
        },
      };
    } catch {
      return reply.status(500).send({ error: 'Failed to analyze feedback' });
    }
  });

  // ── GET /api/v1/ai/sentiment/analyze ──
  app.get('/api/v1/ai/sentiment/analyze', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { text } = request.query as { text?: string };
    if (!text) return reply.status(400).send({ error: 'No text provided' });
    return { sentiment: analyzeSentiment(text) };
  });

  // ── GET /api/v1/ai/forecast ──
  app.get('/api/v1/ai/forecast', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    try {
      const { days: daysStr } = request.query as { days?: string };
      const days = Math.min(Math.max(parseInt(daysStr || '7'), 1), 30);

      const forecast = await getDemandForecast(days);

      const totalPredictedOrders = forecast.reduce((s, f) => s + f.predictedOrders, 0);
      const totalPredictedRevenue = forecast.reduce((s, f) => s + f.predictedRevenue, 0);
      const avgConfidence = Math.round(forecast.reduce((s, f) => s + f.confidence, 0) / forecast.length);

      return {
        forecast,
        summary: {
          totalPredictedOrders: Math.round(totalPredictedOrders),
          totalPredictedRevenue: Math.round(totalPredictedRevenue),
          averageConfidence: avgConfidence,
          method: 'Moving average with trend adjustment (28-day lookback)',
        },
      };
    } catch {
      return reply.status(500).send({ error: 'Failed to generate forecast' });
    }
  });

  // ── GET /api/v1/ai/forecast/prep ──
  app.get('/api/v1/ai/forecast/prep', { preHandler: [authenticate, requireAdmin] }, async (_request, reply) => {
    try {
      const forecast = await getDemandForecast(1);
      if (forecast.length === 0) {
        return { prepList: [], message: 'Insufficient data for prediction' };
      }

      const tomorrow = forecast[0];

      return {
        date: tomorrow.date,
        dayOfWeek: tomorrow.dayOfWeek,
        predictedOrders: tomorrow.predictedOrders,
        predictedRevenue: tomorrow.predictedRevenue,
        confidence: tomorrow.confidence,
        prepList: tomorrow.topDishes.map(d => ({
          dishId: d.dishId,
          dishName: d.dishName,
          predictedQuantity: Math.ceil(d.predictedQuantity),
          reason: `Based on historical ${tomorrow.dayOfWeek} patterns`,
        })),
      };
    } catch {
      return reply.status(500).send({ error: 'Failed to generate prep list' });
    }
  });

  // ── GET /api/v1/ai/status ──
  app.get('/api/v1/ai/status', async () => ({
    groq: hasGroqKey() ? 'configured' : 'not configured',
    gemini: hasGeminiKey() ? 'configured' : 'not configured',
    features: {
      sentiment: 'local + gemini enhancement',
      recommendations: 'collaborative filtering + groq enhancement',
      forecast: 'moving average with trend adjustment',
      promo_suggestions: hasGroqKey() ? 'groq-powered' : 'not available (set GROQ_API_KEY)',
    },
  }));

  // ── POST /api/v1/admin/ai/promo-suggest ──
  app.post('/api/v1/admin/ai/promo-suggest', { preHandler: [authenticate, requireAdmin] }, async (_request, reply) => {
    try {
      if (!hasGroqKey()) {
        return reply.status(400).send({ error: 'GROQ_API_KEY not configured' });
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentOrders = await db.select({
        id: orders.id,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
      }).from(orders)
        .where(gte(orders.createdAt, sevenDaysAgo))
        .orderBy(desc(orders.createdAt));

      const revenue = recentOrders.reduce((s, o) => s + parseFloat(o.totalAmount.toString()), 0);
      const avgOrderValue = recentOrders.length > 0 ? Math.round(revenue / recentOrders.length) : 0;

      const allDishes = await db.select().from(dishes);
      const dishOrderCounts = await db.select({
        dishId: orderItems.dishId,
        totalQty: sql<number>`SUM(${orderItems.quantity})`.as('total_qty'),
      }).from(orderItems)
        .groupBy(orderItems.dishId)
        .orderBy(sql`total_qty ASC`)
        .limit(5);

      const lowPerformers = dishOrderCounts
        .map(dc => {
          const dish = allDishes.find(d => d.id === dc.dishId);
          return dish ? `- ${dish.name} (ordered ${dc.totalQty || 0} times)` : '';
        })
        .filter(Boolean)
        .join('\n');

      const orderData = `Total orders: ${recentOrders.length}, Revenue: ₹${revenue}, Orders by day: ${recentOrders.length > 0 ? 'available' : 'insufficient data'}`;

      const suggestions = await groqPromoSuggestions(orderData, lowPerformers || 'all dishes performing well', avgOrderValue);

      return { suggestions: suggestions || [], source: suggestions ? 'groq' : 'none' };
    } catch {
      return reply.status(500).send({ error: 'Failed to generate promo suggestions' });
    }
  });

  // ── GET /api/v1/admin/ai/insights ──
  app.get('/api/v1/admin/ai/insights', { preHandler: [authenticate, requireAdmin] }, async () => {
    const insights: AiInsight[] = [];

    const allDishes = await db.select().from(dishes);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const dishOrderCounts = await db.select({
      dishId: orderItems.dishId,
      totalQty: sql<number>`SUM(${orderItems.quantity})`.as('total_qty'),
    }).from(orderItems)
      .groupBy(orderItems.dishId);

    const totalOrders = dishOrderCounts.reduce((s, d) => s + (d.totalQty || 0), 0);
    const avgPerDish = totalOrders / Math.max(allDishes.length, 1);

    for (const dish of allDishes) {
      const dc = dishOrderCounts.find(d => d.dishId === dish.id);
      const count = dc?.totalQty || 0;
      if (count > 0 && count < avgPerDish * 0.3 && dish.isAvailable) {
        insights.push({
          type: 'underperforming_dish',
          title: `${dish.name} is underperforming`,
          description: `Only ${count} orders in the last 7 days (avg: ${Math.round(avgPerDish)})`,
          severity: 'medium',
          actionable: true,
          suggestion: `Consider a bundle deal or small discount to boost ${dish.name} orders`,
        });
      }
    }

    const lowStock = await db.select().from(ingredients)
      .where(sql`${ingredients.currentStock}::numeric < ${ingredients.parLevel}::numeric`);

    if (lowStock.length > 3) {
      insights.push({
        type: 'inventory_risk',
        title: `${lowStock.length} ingredients below par level`,
        description: `Restock soon to avoid disruptions`,
        severity: 'high',
        actionable: true,
        suggestion: 'Review low stock items and place supplier orders',
      });
    }

    const peakOrders = await db.select({
      hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})`.as('hour'),
      count: count(),
    }).from(orders)
      .where(gte(orders.createdAt, sevenDaysAgo))
      .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
      .orderBy(desc(sql`count`))
      .limit(1);

    if (peakOrders.length > 0) {
      const hour = peakOrders[0].hour;
      insights.push({
        type: 'peak_hour',
        title: `Peak hour detected: ${hour}:00`,
        description: `${peakOrders[0].count} orders placed during this hour in the last week`,
        severity: 'low',
        actionable: false,
      });
    }

    return { insights };
  });

  // Also accept POST for admin insights (frontend compatibility)
  app.post('/api/v1/admin/ai/insights', { preHandler: [authenticate, requireAdmin] }, async () => {
    const insights: AiInsight[] = [];

    const allDishes = await db.select().from(dishes);
    const dishOrderCounts = await db.select({
      dishId: orderItems.dishId,
      totalQty: sql<number>`SUM(${orderItems.quantity})`.as('total_qty'),
    }).from(orderItems)
      .groupBy(orderItems.dishId);

    const totalOrders = dishOrderCounts.reduce((s, d) => s + (d.totalQty || 0), 0);
    const avgPerDish = totalOrders / Math.max(allDishes.length, 1);

    for (const dish of allDishes) {
      const dc = dishOrderCounts.find(d => d.dishId === dish.id);
      const count = dc?.totalQty || 0;
      if (count > 0 && count < avgPerDish * 0.3 && dish.isAvailable) {
        insights.push({
          type: 'underperforming_dish',
          title: `${dish.name} is underperforming`,
          description: `Only ${count} orders (avg: ${Math.round(avgPerDish)})`,
          severity: 'medium',
          actionable: true,
          suggestion: `Consider a bundle deal for ${dish.name}`,
        });
      }
    }

    const lowStock = await db.select().from(ingredients)
      .where(sql`${ingredients.currentStock}::numeric < ${ingredients.parLevel}::numeric`);
    if (lowStock.length > 3) {
      insights.push({
        type: 'inventory_risk',
        title: `${lowStock.length} ingredients below par level`,
        description: `Restock soon`,
        severity: 'high',
        actionable: true,
        suggestion: 'Review low stock items',
      });
    }

    return { insights };
  });

  // ── POST /api/v1/ai/chat/customer ──
  app.post('/api/v1/ai/chat/customer', async (request, reply) => {
    try {
      const user = request.user;
      const customerId = user?.customerId || null;
      if (customerId && !(await checkAiRateLimit(customerId, 10))) {
        return reply.status(429).send({ error: 'Too many requests. Limit: 10 per minute.' });
      }

      const { message, history = [] } = request.body as { message: string; history?: { role: 'user' | 'assistant'; content: string }[] };
      if (!message) return reply.status(400).send({ error: 'Message is required' });
      if (message.length > 2000) return reply.status(400).send({ error: 'Message too long (max 2000 characters)' });

      const allDishes = await db.select({
        id: dishes.id,
        name: dishes.name,
        price: dishes.price,
        isVeg: dishes.isVeg,
        isAvailable: dishes.isAvailable,
      }).from(dishes).where(eq(dishes.isAvailable, true));

      const menuDescription = allDishes
        .map(d => `- ${d.name} (${d.isVeg ? 'Veg' : 'Non-Veg'}): ₹${d.price}`)
        .join('\n');

      let orderHistoryDescription = 'No past or active orders found for this session.';
      let dietaryProfile = 'No dietary data available';
      if (customerId) {
        const customerOrders = await db.select({
          id: orders.id,
          status: orders.status,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt,
        }).from(orders)
          .where(eq(orders.customerId, customerId))
          .orderBy(desc(orders.createdAt))
          .limit(5);

        if (customerOrders.length > 0) {
          orderHistoryDescription = customerOrders
            .map(o => `Order #${o.id} | Status: ${o.status} | Total: ₹${o.totalAmount} | Created: ${o.createdAt}`)
            .join('\n');
        }

        // Build dietary profile from order history
        const customerOrderItems = await db.select({
          dishName: dishes.name,
          isVeg: dishes.isVeg,
        }).from(orderItems)
          .innerJoin(dishes, eq(orderItems.dishId, dishes.id))
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(eq(orders.customerId, customerId))
          .limit(20);

        const vegCount = customerOrderItems.filter(i => i.isVeg).length;
        const nonVegCount = customerOrderItems.filter(i => !i.isVeg).length;
        const totalItems = customerOrderItems.length;
        dietaryProfile = 'No dietary data available';
        if (totalItems > 0) {
          if (nonVegCount === 0) dietaryProfile = 'Strictly vegetarian';
          else if (vegCount === 0) dietaryProfile = 'Strictly non-vegetarian';
          else dietaryProfile = `Mixed diet (${vegCount} veg, ${nonVegCount} non-veg orders)`;
        }

        // Fetch customer favorites for context
        const customerFavs = await db.select({ dishName: dishes.name })
          .from(customerFavorites)
          .innerJoin(dishes, eq(customerFavorites.dishId, dishes.id))
          .where(eq(customerFavorites.customerId, customerId))
          .limit(10);

        if (customerFavs.length > 0) {
          dietaryProfile += `. Favorite dishes: ${customerFavs.map(f => f.dishName).join(', ')}`;
        }

        // Fetch customer addresses for delivery context
        const customerAddrs = await db.select({ city: customerAddresses.city, label: customerAddresses.label })
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, customerId))
          .limit(3);

        if (customerAddrs.length > 0) {
          const cities = [...new Set(customerAddrs.map(a => a.city))];
          orderHistoryDescription += `\nDelivery areas: ${cities.join(', ')}`;
        }
      }

      const responseMessage = await chatCustomer(message, history, menuDescription, orderHistoryDescription, dietaryProfile);
      return { response: responseMessage };
    } catch {
      return reply.status(500).send({ error: 'Customer chat request failed' });
    }
  });

  // ── POST /api/v1/ai/chat/customer/stream (SSE) ──
  app.post('/api/v1/ai/chat/customer/stream', async (request, reply) => {
    try {
      const user = request.user;
      const customerId = user?.customerId || null;
      if (customerId && !(await checkAiRateLimit(customerId, 10))) {
        return reply.status(429).send({ error: 'Too many requests. Limit: 10 per minute.' });
      }

      const { message, history = [] } = request.body as { message: string; history?: { role: 'user' | 'assistant'; content: string }[] };
      if (!message) return reply.status(400).send({ error: 'Message is required' });
      if (message.length > 2000) return reply.status(400).send({ error: 'Message too long (max 2000 characters)' });

      const allDishes = await db.select({
        id: dishes.id, name: dishes.name, price: dishes.price,
        isVeg: dishes.isVeg, isAvailable: dishes.isAvailable,
      }).from(dishes).where(eq(dishes.isAvailable, true));

      const menuDescription = allDishes
        .map(d => `- ${d.name} (${d.isVeg ? 'Veg' : 'Non-Veg'}): ₹${d.price}`)
        .join('\n');

      let orderHistoryDescription = 'No past or active orders found.';
      let dietaryProfile = 'No dietary data available';
      if (customerId) {
        const customerOrders = await db.select({
          id: orders.id, status: orders.status, totalAmount: orders.totalAmount, createdAt: orders.createdAt,
        }).from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt)).limit(5);

        if (customerOrders.length > 0) {
          orderHistoryDescription = customerOrders
            .map(o => `Order #${o.id} | Status: ${o.status} | Total: ₹${o.totalAmount}`)
            .join('\n');
        }

        const customerOrderItems = await db.select({ dishName: dishes.name, isVeg: dishes.isVeg })
          .from(orderItems).innerJoin(dishes, eq(orderItems.dishId, dishes.id))
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(eq(orders.customerId, customerId)).limit(20);

        const vegCount = customerOrderItems.filter(i => i.isVeg).length;
        const nonVegCount = customerOrderItems.filter(i => !i.isVeg).length;
        if (customerOrderItems.length > 0) {
          if (nonVegCount === 0) dietaryProfile = 'Strictly vegetarian';
          else if (vegCount === 0) dietaryProfile = 'Strictly non-vegetarian';
          else dietaryProfile = `Mixed diet (${vegCount} veg, ${nonVegCount} non-veg)`;
        }
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      let fullResponse = '';

      const result = await chatCustomerStream(
        message, history, menuDescription, orderHistoryDescription, dietaryProfile,
        (chunk) => {
          fullResponse += chunk;
          reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },
      );

      if (result === null && !fullResponse) {
        // Streaming failed — send fallback
        const fallback = await chatCustomer(message, history, menuDescription, orderHistoryDescription, dietaryProfile);
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: fallback })}\n\n`);
        fullResponse = fallback || '';
      }

      reply.raw.write(`data: ${JSON.stringify({ type: 'done', fullResponse })}\n\n`);
      reply.raw.end();
    } catch (err: any) {
      logger.error({ err: err?.message }, '[AI] Customer chat stream failed');
      try {
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Chat streaming failed' })}\n\n`);
        reply.raw.end();
      } catch { /* connection may already be closed */ }
    }
  });

  // ── POST /api/v1/admin/ai/chat/insights ──
  app.post('/api/v1/admin/ai/chat/insights', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    try {
      const user = request.user;
      if (user?.customerId && !(await checkAiRateLimit(`admin:${user.customerId}`, 20))) {
        return reply.status(429).send({ error: 'Too many requests. Limit: 20 per minute.' });
      }

      const { message, history = [] } = request.body as { message: string; history?: { role: 'user' | 'assistant'; content: string }[] };
      if (!message) return reply.status(400).send({ error: 'Message is required' });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = await db.select({
        id: orders.id,
        totalAmount: orders.totalAmount,
      }).from(orders).where(gte(orders.createdAt, today));

      const totalRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount.toString()), 0);
      const salesStatsDescription = `Today's Date: ${today.toDateString()}\nTotal Orders Today: ${todayOrders.length}\nTotal Revenue Today: ₹${totalRevenue}`;

      const lowStockList = await db.select({
        name: ingredients.name,
        currentStock: ingredients.currentStock,
        parLevel: ingredients.parLevel,
        unit: ingredients.unit,
      }).from(ingredients)
        .where(sql`${ingredients.currentStock}::numeric < ${ingredients.parLevel}::numeric`);

      const lowStockDescription = lowStockList.length > 0
        ? lowStockList.map(i => `- ${i.name}: Current Stock ${i.currentStock} ${i.unit} (Par Level: ${i.parLevel} ${i.unit})`).join('\n')
        : 'All ingredients are well-stocked above par levels.';

      const responseMessage = await chatAdminInsights(message, history, lowStockDescription, salesStatsDescription);
      return { response: responseMessage };
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, '[AI] Admin chat insights failed');
      return reply.status(500).send({ error: 'Admin insights chat request failed' });
    }
  });

  // ── POST /api/v1/ai/meal-plan ──
  app.post('/api/v1/ai/meal-plan', async (request, reply) => {
    try {
      const user = request.user;
      const customerId = user?.customerId || null;
      if (customerId && !(await checkAiRateLimit(customerId, 5))) {
        return reply.status(429).send({ error: 'Too many requests. Limit: 5 per minute.' });
      }

      const { mealType = 'lunch', budget = 300, dietary = 'No restrictions' } = request.body as {
        mealType?: string; budget?: number; dietary?: string;
      };

      if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
        return reply.status(400).send({ error: 'mealType must be breakfast, lunch, dinner, or snack' });
      }

      const allDishes = await db.select({
        id: dishes.id, name: dishes.name, price: dishes.price,
        isVeg: dishes.isVeg, category: categories.name,
      }).from(dishes)
        .innerJoin(categories, eq(dishes.categoryId, categories.id))
        .where(eq(dishes.isAvailable, true));

      const menuDescription = allDishes
        .map(d => `- ${d.name} (₹${d.price}, ${d.isVeg ? 'Veg' : 'Non-Veg'}, ${d.category})`)
        .join('\n');

      let favorites = '';
      if (customerId) {
        const customerFavs = await db.select({ dishName: dishes.name })
          .from(customerFavorites)
          .innerJoin(dishes, eq(customerFavorites.dishId, dishes.id))
          .where(eq(customerFavorites.customerId, customerId))
          .limit(5);
        if (customerFavs.length > 0) {
          favorites = `Previously enjoyed: ${customerFavs.map(f => f.dishName).join(', ')}`;
        }
      }

      const mealPlan = await generateMealPlan(mealType, menuDescription, budget, dietary, favorites);
      if (!mealPlan) {
        return reply.status(500).send({ error: 'Failed to generate meal plan' });
      }

      // Enrich dishes with real database IDs and isVeg flag
      const dishMap = new Map(allDishes.map(d => [d.name.toLowerCase().trim(), d]));
      mealPlan.dishes = mealPlan.dishes.map(d => {
        const realDish = dishMap.get(d.name.toLowerCase().trim());
        return {
          ...d,
          id: realDish?.id || d.id,
          isVeg: realDish?.isVeg ?? d.isVeg ?? true,
        };
      });

      return { mealPlan };
    } catch (err: any) {
      logger.error({ err: err?.message }, '[AI] Meal plan failed');
      return reply.status(500).send({ error: 'Meal plan generation failed' });
    }
  });

  // ── GET /api/v1/ai/food-story/:dishId ──
  app.get('/api/v1/ai/food-story/:dishId', async (request, reply) => {
    try {
      const { dishId: dishIdStr } = request.params as { dishId: string };
      const dishId = parseInt(dishIdStr);
      if (isNaN(dishId)) return reply.status(400).send({ error: 'Invalid dish ID' });

      // Check cache
      const cacheKey = `foodstory:${dishId}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const [dish] = await db.select({
        id: dishes.id, name: dishes.name, price: dishes.price,
        description: dishes.description, isVeg: dishes.isVeg,
        category: categories.name,
      }).from(dishes)
        .innerJoin(categories, eq(dishes.categoryId, categories.id))
        .where(eq(dishes.id, dishId));

      if (!dish) return reply.status(404).send({ error: 'Dish not found' });

      const story = await generateFoodStory(
        dish.name, dish.category, parseFloat(dish.price.toString()),
        dish.description || '', dish.isVeg ?? true,
      );

      if (!story) return reply.status(500).send({ error: 'Failed to generate food story' });

      const result = { dishId: dish.id, dishName: dish.name, story };
      await redis.setex(cacheKey, 86400, JSON.stringify(result)); // Cache 24 hours
      return result;
    } catch (err: any) {
      logger.error({ err: err?.message }, '[AI] Food story failed');
      return reply.status(500).send({ error: 'Food story generation failed' });
    }
  });

  // ── GET /api/v1/ai/cross-sell/:dishId ──
  app.get('/api/v1/ai/cross-sell/:dishId', async (request, reply) => {
    try {
      const { dishId: dishIdStr } = request.params as { dishId: string };
      const dishId = parseInt(dishIdStr);
      if (isNaN(dishId)) return reply.status(400).send({ error: 'Invalid dish ID' });

      const cacheKey = `crosssell:${dishId}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // Find dishes that are frequently ordered together
      const coOrders = await db.select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(eq(orderItems.dishId, dishId))
        .limit(100);

      const coOrderIds = coOrders.map(o => o.orderId);
      if (coOrderIds.length === 0) return { suggestions: [] };

      const pairedItems = await db.select({
        dishId: orderItems.dishId,
        dishName: dishes.name,
        price: dishes.price,
        orderCount: sql<number>`count(*)::int`,
      }).from(orderItems)
        .innerJoin(dishes, eq(orderItems.dishId, dishes.id))
        .where(and(
          inArray(orderItems.orderId, coOrderIds),
          sql`${orderItems.dishId} != ${dishId}`,
        ))
        .groupBy(orderItems.dishId, dishes.name, dishes.price)
        .orderBy(sql`count(*)::int DESC`)
        .limit(3);

      const suggestions = pairedItems.map(item => ({
        dishId: item.dishId,
        dishName: item.dishName,
        price: parseFloat(item.price.toString()),
        overlapScore: Math.round((item.orderCount / coOrderIds.length) * 100),
        reason: `Ordered together in ${item.orderCount} orders`,
      }));

      const result = { dishId, suggestions };
      await redis.setex(cacheKey, 3600, JSON.stringify(result));
      return result;
    } catch (err: any) {
      logger.error({ err: err?.message }, '[AI] Cross-sell failed');
      return reply.status(500).send({ error: 'Cross-sell analysis failed' });
    }
  });

  // ── GET /api/v1/admin/ai/proactive-alerts ──
  app.get('/api/v1/admin/ai/proactive-alerts', { preHandler: [authenticate, requireAdmin] }, async () => {
    try {
      const alerts: { type: string; title: string; message: string; severity: string; suggestedAction: string }[] = [];

      // Check inventory depletion
      const lowStock = await db.select({
        name: ingredients.name,
        currentStock: ingredients.currentStock,
        parLevel: ingredients.parLevel,
        unit: ingredients.unit,
      }).from(ingredients)
        .where(sql`${ingredients.currentStock}::numeric < ${ingredients.parLevel}::numeric`);

      for (const item of lowStock) {
        const current = parseFloat(item.currentStock?.toString() || '0');
        const par = parseFloat(item.parLevel?.toString() || '1');
        const ratio = current / Math.max(par, 1);
        if (ratio < 0.3) {
          alerts.push({
            type: 'inventory_depletion',
            title: `Critical: ${item.name} critically low`,
            message: `Only ${current} ${item.unit} left (par level: ${par} ${item.unit}). Estimated to run out within 2 hours at current order rate.`,
            severity: 'critical',
            suggestedAction: `Urgently restock ${item.name}. Contact supplier immediately.`,
          });
        } else if (ratio < 0.6) {
          alerts.push({
            type: 'inventory_depletion',
            title: `Warning: ${item.name} running low`,
            message: `Current stock: ${current} ${item.unit} (par level: ${par} ${item.unit}). May need restocking before evening rush.`,
            severity: 'warning',
            suggestedAction: `Plan to restock ${item.name} before the lunch/dinner rush.`,
          });
        }
      }

      // Check peak hours (predict lunch rush)
      const hour = new Date().getHours();
      if (hour >= 10 && hour < 12) {
        alerts.push({
          type: 'rush_prediction',
          title: 'Lunch rush starting soon',
          message: 'Historical data shows order volume typically peaks between 12-2 PM. Consider pre-prepping popular items.',
          severity: 'info',
          suggestedAction: 'Pre-prep 5-10 portions of top 3 dishes to reduce wait times during rush.',
        });
      }
      if (hour >= 17 && hour < 19) {
        alerts.push({
          type: 'rush_prediction',
          title: 'Dinner rush starting soon',
          message: 'Historical data shows dinner orders peak between 7-9 PM. Ensure adequate stock of popular items.',
          severity: 'info',
          suggestedAction: 'Verify stock levels for top 5 dinner dishes and prep ingredients.',
        });
      }

      // Check for slow-moving dishes
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const dishOrderCounts = await db.select({
        dishId: orderItems.dishId,
        totalQty: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(gte(orders.createdAt, sevenDaysAgo))
        .groupBy(orderItems.dishId);

      const avgPerDish = dishOrderCounts.length > 0
        ? dishOrderCounts.reduce((s, d) => s + d.totalQty, 0) / dishOrderCounts.length
        : 0;

      if (avgPerDish > 0) {
        const slowDishes = await db.select({ id: dishes.id, name: dishes.name })
          .from(dishes).where(eq(dishes.isAvailable, true));
        for (const dish of slowDishes) {
          const count = dishOrderCounts.find(d => d.dishId === dish.id)?.totalQty || 0;
          if (count === 0 && avgPerDish > 2) {
            alerts.push({
              type: 'slow_day',
              title: `${dish.name} hasn't sold this week`,
              message: `This dish usually averages ${Math.round(avgPerDish)} orders per week. Zero orders this week may indicate a problem.`,
              severity: 'info',
              suggestedAction: `Consider a promotional discount or bundling ${dish.name} with popular items.`,
            });
          }
        }
      }

      return { alerts };
    } catch (err: any) {
      logger.error({ err: err?.message }, '[AI] Proactive alerts failed');
      return { alerts: [] };
    }
  });
}
