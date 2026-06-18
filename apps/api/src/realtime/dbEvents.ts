import { publishEvent } from '../utils/eventBus.js';
import { CHANNELS } from './channels.js';

type EventPayload = Record<string, unknown>;

/**
 * Real-time database wrapper.
 * Call these after every DB mutation so connected clients see changes instantly.
 */
export const live = {
  order: {
    placed(orderId: number, payload: EventPayload) {
      return publishEvent(CHANNELS.ORDER_PLACED, { orderId, ...payload });
    },
    confirmed(orderId: number, payload: EventPayload) {
      return publishEvent(CHANNELS.ORDER_CONFIRMED, { orderId, ...payload });
    },
    preparing(orderId: number, payload: EventPayload) {
      return publishEvent(CHANNELS.ORDER_PREPARING, { orderId, ...payload });
    },
    ready(orderId: number, payload: EventPayload) {
      return publishEvent(CHANNELS.ORDER_READY, { orderId, ...payload });
    },
    outForDelivery(orderId: number, payload: EventPayload) {
      return publishEvent(CHANNELS.ORDER_OUT_FOR_DELIVERY, { orderId, ...payload });
    },
    delivered(orderId: number, payload: EventPayload) {
      return publishEvent(CHANNELS.ORDER_DELIVERED, { orderId, ...payload });
    },
    cancelled(orderId: number, payload: EventPayload) {
      return publishEvent(CHANNELS.ORDER_CANCELLED, { orderId, ...payload });
    },
  },

  menu: {
    created(payload: EventPayload) {
      return publishEvent(CHANNELS.MENU_CREATED, payload);
    },
    updated(payload: EventPayload) {
      return publishEvent(CHANNELS.MENU_UPDATED, payload);
    },
    deleted(payload: EventPayload) {
      return publishEvent(CHANNELS.MENU_DELETED, payload);
    },
  },

  inventory: {
    created(payload: EventPayload) {
      return publishEvent(CHANNELS.INVENTORY_CREATED, payload);
    },
    updated(payload: EventPayload) {
      return publishEvent(CHANNELS.INVENTORY_UPDATED, payload);
    },
    lowStock(payload: EventPayload) {
      return publishEvent(CHANNELS.INVENTORY_LOW_STOCK, payload);
    },
  },

  customer: {
    created(payload: EventPayload) {
      return publishEvent(CHANNELS.CUSTOMER_CREATED, payload);
    },
    updated(payload: EventPayload) {
      return publishEvent(CHANNELS.CUSTOMER_UPDATED, payload);
    },
  },

  payment: {
    succeeded(payload: EventPayload) {
      return publishEvent(CHANNELS.PAYMENT_SUCCEEDED, payload);
    },
    failed(payload: EventPayload) {
      return publishEvent(CHANNELS.PAYMENT_FAILED, payload);
    },
    refunded(payload: EventPayload) {
      return publishEvent(CHANNELS.PAYMENT_REFUNDED, payload);
    },
  },

  dispatch: {
    assigned(payload: EventPayload) {
      return publishEvent(CHANNELS.DISPATCH_ASSIGNED, payload);
    },
    delivered(payload: EventPayload) {
      return publishEvent(CHANNELS.DISPATCH_DELIVERED, payload);
    },
  },

  admin: {
    alert(payload: EventPayload) {
      return publishEvent(CHANNELS.ADMIN_ALERT, payload);
    },
  },
};
