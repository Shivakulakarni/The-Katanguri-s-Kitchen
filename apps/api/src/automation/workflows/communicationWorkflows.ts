import { Job } from 'bullmq';
import { db } from '../../db/connection.js';
import { orders, orderItems } from '../../db/schemas/order.js';
import { customers } from '../../db/schemas/customer.js';
import { dishes } from '../../db/schemas/menu.js';
import { eq, inArray } from 'drizzle-orm';
import { sendSMS } from '../../services/sms.service.js';
import {
  sendOrderConfirmation,
  sendOutForDelivery,
  sendFeedbackRequest,
  sendAbandonedCart,
  sendReEngagement,
} from '../../services/email.service.js';

export async function handleOrderConfirmation(job: Job) {
  const { orderId, type } = job.data;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.customerId) return;

  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
  if (!customer) return;
  if (customer.marketingOptOut) return;

  if (type === 'sms' && customer.phone) {
    await sendSMS(customer.phone, `Order #${orderId} confirmed! Your food is being prepared. ETA: 30 min`);
  }
  if (type === 'email' && customer.email) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const dishIds = [...new Set(items.map(i => i.dishId))];
    const dishMap = new Map<number, { name: string }>();
    if (dishIds.length > 0) {
      const dishRows = await db.select({ id: dishes.id, name: dishes.name }).from(dishes).where(inArray(dishes.id, dishIds));
      for (const d of dishRows) dishMap.set(d.id, d);
    }
    const itemDetails = items.map(item => ({
      name: dishMap.get(item.dishId)?.name || `Dish #${item.dishId}`,
      qty: item.quantity,
      price: parseFloat(item.unitPrice),
    }));
    await sendOrderConfirmation(customer.email, orderId, itemDetails, parseFloat(order.totalAmount));
  }
}

export async function handleOutForDelivery(job: Job) {
  const { orderId } = job.data;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.customerId) return;

  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
  if (!customer || customer.marketingOptOut) return;

  if (customer.phone) {
    await sendSMS(customer.phone, `Your order #${orderId} is out for delivery! Track live: https://kitchen.app/track/${orderId}`);
  }
  if (customer.email) {
    await sendOutForDelivery(customer.email, orderId);
  }
}

export async function handleFeedbackRequest(job: Job) {
  const { orderId } = job.data;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.customerId) return;

  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
  if (!customer || customer.marketingOptOut) return;

  if (customer.phone) {
    await sendSMS(customer.phone, `How was your meal? Rate your experience: https://kitchen.app/feedback/${orderId}`);
  }
  if (customer.email) {
    await sendFeedbackRequest(customer.email, orderId);
  }
}

export async function handleAbandonedCart(job: Job) {
  const { customerId, cartItems } = job.data;
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId as number)).limit(1);
  if (!customer || customer.marketingOptOut) return;

  if (customer.phone) {
    await sendSMS(customer.phone, `You left items in your cart! Complete your order and get 10% off: https://kitchen.app/cart`);
  }
  if (customer.email) {
    const summary = Array.isArray(cartItems) ? cartItems.map((i: any) => i.name || i.dishId).join(', ') : 'Your items';
    await sendAbandonedCart(customer.email, summary);
  }
}

export async function handleReEngagement(job: Job) {
  const { customerId } = job.data;
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId as number)).limit(1);
  if (!customer || customer.marketingOptOut) return;

  if (customer.email) {
    await sendReEngagement(customer.email, customer.name || 'there');
  }
}
