import { relations } from "drizzle-orm/relations";
import { riders, riderEarnings, riderLocations, customers, webhookAlerts, webhookEndpoints, webhookDeliveries, orders, incomingOrders, feedbacks, feedbackAnalysis, dishes, dishModifiers, ingredients, inventoryTransactions, customerAddresses, orderItems, payments, orderStatusHistory, dishIngredients, categories, cartItems, customerFavorites } from "./schema";

export const riderEarningsRelations = relations(riderEarnings, ({one}) => ({
	rider: one(riders, {
		fields: [riderEarnings.riderId],
		references: [riders.id]
	}),
}));

export const ridersRelations = relations(riders, ({one, many}) => ({
	riderEarnings: many(riderEarnings),
	riderLocations: many(riderLocations),
	order: one(orders, {
		fields: [riders.currentOrderId],
		references: [orders.id]
	}),
}));

export const riderLocationsRelations = relations(riderLocations, ({one}) => ({
	rider: one(riders, {
		fields: [riderLocations.riderId],
		references: [riders.id]
	}),
}));

export const webhookAlertsRelations = relations(webhookAlerts, ({one}) => ({
	customer: one(customers, {
		fields: [webhookAlerts.acknowledgedBy],
		references: [customers.id]
	}),
}));

export const customersRelations = relations(customers, ({many}) => ({
	webhookAlerts: many(webhookAlerts),
	feedbacks: many(feedbacks),
	customerAddresses: many(customerAddresses),
	orders: many(orders),
	cartItems: many(cartItems),
	customerFavorites: many(customerFavorites),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({one}) => ({
	webhookEndpoint: one(webhookEndpoints, {
		fields: [webhookDeliveries.endpointId],
		references: [webhookEndpoints.id]
	}),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({many}) => ({
	webhookDeliveries: many(webhookDeliveries),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	riders: many(riders),
	incomingOrders: many(incomingOrders),
	feedbacks: many(feedbacks),
	orderItems: many(orderItems),
	payments: many(payments),
	orderStatusHistories: many(orderStatusHistory),
	customer: one(customers, {
		fields: [orders.customerId],
		references: [customers.id]
	}),
	customerAddress: one(customerAddresses, {
		fields: [orders.deliveryAddressId],
		references: [customerAddresses.id]
	}),
}));

export const incomingOrdersRelations = relations(incomingOrders, ({one}) => ({
	order: one(orders, {
		fields: [incomingOrders.internalOrderId],
		references: [orders.id]
	}),
}));

export const feedbackAnalysisRelations = relations(feedbackAnalysis, ({one}) => ({
	feedback: one(feedbacks, {
		fields: [feedbackAnalysis.feedbackId],
		references: [feedbacks.id]
	}),
}));

export const feedbacksRelations = relations(feedbacks, ({one, many}) => ({
	feedbackAnalyses: many(feedbackAnalysis),
	order: one(orders, {
		fields: [feedbacks.orderId],
		references: [orders.id]
	}),
	customer: one(customers, {
		fields: [feedbacks.customerId],
		references: [customers.id]
	}),
}));

export const dishModifiersRelations = relations(dishModifiers, ({one}) => ({
	dish: one(dishes, {
		fields: [dishModifiers.dishId],
		references: [dishes.id]
	}),
}));

export const dishesRelations = relations(dishes, ({one, many}) => ({
	dishModifiers: many(dishModifiers),
	dishIngredients: many(dishIngredients),
	category: one(categories, {
		fields: [dishes.categoryId],
		references: [categories.id]
	}),
	customerFavorites: many(customerFavorites),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({one}) => ({
	ingredient: one(ingredients, {
		fields: [inventoryTransactions.ingredientId],
		references: [ingredients.id]
	}),
}));

export const ingredientsRelations = relations(ingredients, ({many}) => ({
	inventoryTransactions: many(inventoryTransactions),
	dishIngredients: many(dishIngredients),
}));

export const customerAddressesRelations = relations(customerAddresses, ({one, many}) => ({
	customer: one(customers, {
		fields: [customerAddresses.customerId],
		references: [customers.id]
	}),
	orders: many(orders),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	order: one(orders, {
		fields: [payments.orderId],
		references: [orders.id]
	}),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({one}) => ({
	order: one(orders, {
		fields: [orderStatusHistory.orderId],
		references: [orders.id]
	}),
}));

export const dishIngredientsRelations = relations(dishIngredients, ({one}) => ({
	ingredient: one(ingredients, {
		fields: [dishIngredients.ingredientId],
		references: [ingredients.id]
	}),
	dish: one(dishes, {
		fields: [dishIngredients.dishId],
		references: [dishes.id]
	}),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	dishes: many(dishes),
}));

export const cartItemsRelations = relations(cartItems, ({one}) => ({
	customer: one(customers, {
		fields: [cartItems.customerId],
		references: [customers.id]
	}),
}));

export const customerFavoritesRelations = relations(customerFavorites, ({one}) => ({
	customer: one(customers, {
		fields: [customerFavorites.customerId],
		references: [customers.id]
	}),
	dish: one(dishes, {
		fields: [customerFavorites.dishId],
		references: [dishes.id]
	}),
}));