import { Job } from 'bullmq';
import { db } from '../../db/connection.js';
import { orders, orderItems } from '../../db/schemas/order.js';
import { ingredients, inventoryTransactions } from '../../db/schemas/inventory.js';
import { dishIngredients } from '../../db/schemas/inventory.js';
import { dishes } from '../../db/schemas/menu.js';
import { eq, inArray } from 'drizzle-orm';
import { publishEvent } from '../../utils/eventBus.js';
import { communicationQueue, dispatchQueue } from '../../utils/queue.js';
import { sendOrderConfirmation } from '../../services/email.service.js';
import { STRIPE_API_VERSION } from '../../lib/constants.js';
import { payments } from '../../db/schemas/payment.js';
import { logger } from '../../utils/logger.js';
import Stripe from 'stripe';

async function generateInvoice(orderId: number): Promise<{ html: string; total: number }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error(`Order ${orderId} not found`);

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const dishIds = items.map(i => i.dishId);
  const menuDishes = dishIds.length > 0
    ? await db.select().from(dishes).where(inArray(dishes.id, dishIds))
    : [];
  const dishMap = new Map(menuDishes.map(d => [d.id, d.name]));
  const total = items.reduce((s, i) => s + parseFloat(i.unitPrice.toString()) * i.quantity, 0);

  const itemRows = items.map(i =>
    `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${dishMap.get(i.dishId) || `Item #${i.dishId}`}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">x${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">₹${parseFloat(i.unitPrice.toString()).toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">₹${(parseFloat(i.unitPrice.toString()) * i.quantity).toFixed(2)}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice #${orderId}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:40px auto;padding:20px;">
  <div style="border:2px solid #e23744;border-radius:12px;padding:32px;">
    <h1 style="color:#e23744;margin:0 0 8px;">The Katanguri's Kitchen</h1>
    <p style="color:#666;margin:0 0 24px;">Invoice #${orderId}</p>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f8f8f8;"><th style="padding:8px;text-align:left;">Item</th><th style="padding:8px;text-align:center;">Qty</th><th style="padding:8px;text-align:right;">Unit Price</th><th style="padding:8px;text-align:right;">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr><td colspan="3" style="padding:12px 8px;text-align:right;font-weight:700;font-size:18px;">Grand Total</td><td style="padding:12px 8px;text-align:right;font-weight:700;font-size:18px;color:#e23744;">₹${total.toFixed(2)}</td></tr></tfoot>
    </table>
    <p style="color:#999;font-size:12px;margin-top:24px;">Thank you for your order!</p>
  </div>
</body></html>`;

  return { html, total };
}

export async function handleOrderPlaced(job: Job) {
  const { orderId } = job.data;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  // Batch-fetch all dish ingredients in one query instead of N+1
  const dishIds = [...new Set(items.map(i => i.dishId))];
  const allDishIngs = dishIds.length > 0
    ? await db.select().from(dishIngredients).where(inArray(dishIngredients.dishId, dishIds))
    : [];
  const allIngIds = [...new Set(allDishIngs.map(di => di.ingredientId))];
  const allIngs = allIngIds.length > 0
    ? await db.select().from(ingredients).where(inArray(ingredients.id, allIngIds))
    : [];
  const ingMap = new Map(allIngs.map(i => [i.id, i]));

  // Wrap entire inventory deduction in a transaction for atomicity
  await db.transaction(async (tx) => {
    for (const item of items) {
      const ings = allDishIngs.filter(di => di.dishId === item.dishId);
      for (const ing of ings) {
        const qtyToDeduct = parseFloat(ing.quantity.toString()) * item.quantity;
        const inv = ingMap.get(ing.ingredientId);
        if (inv) {
          const currentStock = parseFloat(inv.currentStock.toString());
          if (currentStock < qtyToDeduct) {
            throw new Error(`Insufficient stock for ingredient ${ing.ingredientId}: need ${qtyToDeduct}, have ${currentStock}`);
          }
          const newStock = currentStock - qtyToDeduct;
          await tx.update(ingredients).set({ currentStock: newStock.toString() }).where(eq(ingredients.id, ing.ingredientId));
          await tx.insert(inventoryTransactions).values({
            ingredientId: ing.ingredientId,
            changeQty: (-qtyToDeduct).toString(),
            reason: 'order_deduction',
            referenceId: `order_${orderId}`,
          });
        }
      }
    }
  });

  // Publish batch inventory update events with fresh data
  const updatedIngIds = allIngs.map(i => i.id);
  const updatedIngs = updatedIngIds.length > 0
    ? await db.select().from(ingredients).where(inArray(ingredients.id, updatedIngIds))
    : [];
  for (const ing of updatedIngs) {
    await publishEvent('inventory.updated', { ingredientId: ing.id, currentStock: ing.currentStock });
  }

  await communicationQueue.add('order-confirmation', { orderId, type: 'sms' });
  await communicationQueue.add('order-confirmation', { orderId, type: 'email' });
}

export async function handleOrderConfirmed(job: Job) {
  const { orderId, customerEmail } = job.data;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const dishIds = items.map(i => i.dishId);
  const menuDishes = dishIds.length > 0
    ? await db.select().from(dishes).where(inArray(dishes.id, dishIds))
    : [];
  const dishMap = new Map(menuDishes.map(d => [d.id, d.name]));

  try {
    const { total } = await generateInvoice(orderId);
    if (customerEmail) {
      await sendOrderConfirmation(customerEmail, orderId, items.map(i => ({
        name: dishMap.get(i.dishId) || `Item #${i.dishId}`,
        qty: i.quantity,
        price: parseFloat(i.unitPrice.toString()),
      })), total);
    }
  } catch {
    // invoice generation failure should not block order processing
  }
}

export async function handleOrderReady(job: Job) {
  const { orderId } = job.data;
  await dispatchQueue.add('assign-rider', { orderId });
}

export async function handleOrderDelivered(job: Job) {
  const { orderId } = job.data;
  await communicationQueue.add('feedback-request', { orderId }, { delay: 30 * 60 * 1000 });

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order?.customerId) {
    const { customers } = await import('../../db/schemas/customer.js');
    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
    if (customer) {
      const newLtv = parseFloat(customer.lifetimeValue?.toString() || '0') + parseFloat(order.totalAmount.toString());
      const [updatedCustomer] = await db.update(customers)
        .set({ lifetimeValue: newLtv.toString(), lastOrderAt: new Date() })
        .where(eq(customers.id, order.customerId))
        .returning();
      await publishEvent('customer.updated', { customerId: customer.id, lifetimeValue: updatedCustomer.lifetimeValue, lastOrderAt: updatedCustomer.lastOrderAt });
    }
  }
}

export async function handleOrderCancelled(job: Job) {
  const { orderId } = job.data;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  
  // Batch-fetch all dish ingredients in one query instead of N+1
  const dishIds = [...new Set(items.map(i => i.dishId))];
  const allDishIngs = dishIds.length > 0
    ? await db.select().from(dishIngredients).where(inArray(dishIngredients.dishId, dishIds))
    : [];
  const allIngIds = [...new Set(allDishIngs.map(di => di.ingredientId))];
  const allIngs = allIngIds.length > 0
    ? await db.select().from(ingredients).where(inArray(ingredients.id, allIngIds))
    : [];

  // Restore inventory in a transaction
  await db.transaction(async (tx) => {
    for (const item of items) {
      const ings = allDishIngs.filter(di => di.dishId === item.dishId);
      for (const ing of ings) {
        const qtyToAdd = parseFloat(ing.quantity.toString()) * item.quantity;
        // Read current stock inside transaction to avoid lost updates
        const [currentInv] = await tx.select().from(ingredients).where(eq(ingredients.id, ing.ingredientId)).limit(1);
        if (currentInv) {
          const newStock = parseFloat(currentInv.currentStock.toString()) + qtyToAdd;
          await tx.update(ingredients).set({ currentStock: newStock.toString() }).where(eq(ingredients.id, ing.ingredientId));
        }
      }
    }
  });

  // Initiate payment refund if payment was made
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order?.paymentIntentId) {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (stripeKey && stripeKey !== 'sk_test_CHANGE_ME') {
        const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION as any });
        await stripe.refunds.create({
          payment_intent: order.paymentIntentId,
          reason: 'requested_by_customer',
        });
        await db.update(payments).set({ status: 'refunded' }).where(eq(payments.paymentIntentId, order.paymentIntentId));
        await publishEvent('payment.refunded', { orderId, paymentIntentId: order.paymentIntentId });
      }
    } catch (err: any) {
      logger.error({ orderId, err: err.message }, '[ORDER] Refund failed after cancellation');
    }
  }

  // Publish batch inventory update events with fresh data
  const updatedIngIds = allIngs.map(i => i.id);
  const updatedIngs = updatedIngIds.length > 0
    ? await db.select().from(ingredients).where(inArray(ingredients.id, updatedIngIds))
    : [];
  for (const ing of updatedIngs) {
    await publishEvent('inventory.updated', { ingredientId: ing.id, currentStock: ing.currentStock });
  }
}
