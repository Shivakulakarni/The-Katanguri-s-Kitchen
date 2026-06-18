export const CHANNELS = {
  ORDER_PLACED: 'order.placed',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_PREPARING: 'order.preparation_started',
  ORDER_READY: 'order.ready',
  ORDER_OUT_FOR_DELIVERY: 'order.out_for_delivery',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',

  MENU_CREATED: 'menu.created',
  MENU_UPDATED: 'menu.updated',
  MENU_DELETED: 'menu.deleted',

  INVENTORY_CREATED: 'inventory.created',
  INVENTORY_UPDATED: 'inventory.updated',
  INVENTORY_LOW_STOCK: 'inventory.low_stock',

  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',

  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  DISPATCH_ASSIGNED: 'dispatch.assigned',
  DISPATCH_DELIVERED: 'dispatch.delivered',

  ADMIN_ALERT: 'admin.alert',
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];
