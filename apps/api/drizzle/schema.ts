import { pgTable, index, foreignKey, integer, numeric, text, timestamp, boolean, jsonb, unique, doublePrecision, check, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const customerRole = pgEnum("customer_role", ['customer', 'admin', 'rider'])
export const feedbackRating = pgEnum("feedback_rating", ['1', '2', '3', '4', '5'])
export const orderStatus = pgEnum("order_status", ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED'])
export const paymentStatus = pgEnum("payment_status", ['pending', 'succeeded', 'failed', 'refunded'])
export const promoType = pgEnum("promo_type", ['percentage', 'flat'])
export const riderStatus = pgEnum("rider_status", ['offline', 'online', 'delivering', 'busy'])


export const riderEarnings = pgTable("rider_earnings", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "rider_earnings_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	riderId: integer("rider_id").notNull(),
	orderId: integer("order_id").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	type: text().default('delivery').notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_rider_earnings_rider").using("btree", table.riderId.asc().nullsLast().op("int4_ops")),
	index("idx_rider_earnings_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.riderId],
			foreignColumns: [riders.id],
			name: "rider_earnings_rider_id_riders_id_fk"
		}),
]);

export const riderLocations = pgTable("rider_locations", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "rider_locations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	riderId: integer("rider_id").notNull(),
	lat: numeric({ precision: 10, scale:  7 }).notNull(),
	lng: numeric({ precision: 10, scale:  7 }).notNull(),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_rider_locations_rider").using("btree", table.riderId.asc().nullsLast().op("int4_ops")),
	index("idx_rider_locations_time").using("btree", table.recordedAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.riderId],
			foreignColumns: [riders.id],
			name: "rider_locations_rider_id_riders_id_fk"
		}),
]);

export const webhookAlerts = pgTable("webhook_alerts", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "webhook_alerts_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	source: text(),
	severity: text().default('info').notNull(),
	title: text().notNull(),
	message: text().notNull(),
	acknowledged: boolean().default(false).notNull(),
	acknowledgedBy: integer("acknowledged_by"),
	acknowledgedAt: timestamp("acknowledged_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_webhook_alerts_ack").using("btree", table.acknowledged.asc().nullsLast().op("bool_ops")),
	index("idx_webhook_alerts_severity").using("btree", table.severity.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.acknowledgedBy],
			foreignColumns: [customers.id],
			name: "webhook_alerts_acknowledged_by_customers_id_fk"
		}),
]);

export const webhookEndpoints = pgTable("webhook_endpoints", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "webhook_endpoints_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	url: text().notNull(),
	events: jsonb().default([]).notNull(),
	secret: text(),
	isActive: boolean("is_active").default(true).notNull(),
	lastTriggeredAt: timestamp("last_triggered_at", { mode: 'string' }),
	successCount: integer("success_count").default(0),
	failureCount: integer("failure_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "webhook_deliveries_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	endpointId: integer("endpoint_id"),
	event: text().notNull(),
	payload: jsonb(),
	status: text().default('pending').notNull(),
	statusCode: integer("status_code"),
	responseBody: text("response_body"),
	attempts: integer().default(0),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	index("idx_webhook_deliveries_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_webhook_deliveries_endpoint").using("btree", table.endpointId.asc().nullsLast().op("int4_ops")),
	index("idx_webhook_deliveries_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.endpointId],
			foreignColumns: [webhookEndpoints.id],
			name: "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk"
		}).onDelete("cascade"),
]);

export const riders = pgTable("riders", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "riders_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	phone: text().notNull(),
	email: text(),
	vehicleType: text("vehicle_type").default('bike').notNull(),
	vehicleNumber: text("vehicle_number"),
	status: riderStatus().default('offline').notNull(),
	isVerified: boolean("is_verified").default(false),
	isActive: boolean("is_active").default(true),
	currentLat: numeric("current_lat", { precision: 10, scale:  7 }),
	currentLng: numeric("current_lng", { precision: 10, scale:  7 }),
	rating: numeric({ precision: 3, scale:  2 }).default('5.00'),
	totalDeliveries: integer("total_deliveries").default(0),
	totalEarnings: numeric("total_earnings", { precision: 12, scale:  2 }).default('0'),
	currentOrderId: integer("current_order_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
}, (table) => [
	index("idx_riders_location").using("btree", table.currentLat.asc().nullsLast().op("numeric_ops"), table.currentLng.asc().nullsLast().op("numeric_ops")),
	index("idx_riders_phone").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("idx_riders_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.currentOrderId],
			foreignColumns: [orders.id],
			name: "riders_current_order_id_orders_id_fk"
		}).onDelete("set null"),
	unique("riders_phone_unique").on(table.phone),
]);

export const auditLogs = pgTable("audit_logs", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "audit_logs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	entityType: text("entity_type").notNull(),
	entityId: integer("entity_id").notNull(),
	action: text().notNull(),
	userId: integer("user_id"),
	userRole: text("user_role").default('system'),
	changes: jsonb(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_audit_logs_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("idx_audit_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_audit_logs_entity").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("int4_ops")),
	index("idx_audit_logs_user").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
]);

export const customers = pgTable("customers", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "customers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	email: text(),
	phone: text(),
	name: text(),
	role: customerRole().default('customer'),
	passwordHash: text("password_hash"),
	isGuest: boolean("is_guest").default(false),
	marketingOptOut: boolean("marketing_opt_out").default(false),
	lifetimeValue: numeric("lifetime_value", { precision: 10, scale:  2 }).default('0'),
	lastOrderAt: timestamp("last_order_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
}, (table) => [
	index("idx_customers_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_customers_last_order").using("btree", table.lastOrderAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_customers_role").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	unique("customers_email_unique").on(table.email),
	unique("customers_phone_unique").on(table.phone),
]);

export const automationLogs = pgTable("automation_logs", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "automation_logs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	ruleId: integer("rule_id"),
	workflowName: text("workflow_name").notNull(),
	eventId: text("event_id"),
	action: text().notNull(),
	status: text().notNull(),
	durationMs: integer("duration_ms"),
	errorMessage: text("error_message"),
	payload: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_automation_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_automation_logs_rule").using("btree", table.ruleId.asc().nullsLast().op("int4_ops")),
	index("idx_automation_logs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_automation_logs_workflow").using("btree", table.workflowName.asc().nullsLast().op("text_ops")),
]);

export const automationRules = pgTable("automation_rules", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "automation_rules_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	trigger: text().notNull(),
	conditions: jsonb().default([]).notNull(),
	actions: jsonb().default([]).notNull(),
	isActive: boolean("is_active").default(true),
	version: integer().default(1),
	lastTriggeredAt: timestamp("last_triggered_at", { mode: 'string' }),
	executionCount: integer("execution_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_automation_rules_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_automation_rules_trigger").using("btree", table.trigger.asc().nullsLast().op("text_ops")),
]);

export const incomingOrders = pgTable("incoming_orders", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "incoming_orders_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	externalId: text("external_id").notNull(),
	source: text().notNull(),
	customerName: text("customer_name"),
	customerPhone: text("customer_phone"),
	customerAddress: text("customer_address"),
	payload: jsonb().notNull(),
	internalOrderId: integer("internal_order_id"),
	status: text().default('received').notNull(),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
}, (table) => [
	index("idx_incoming_orders_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_incoming_orders_external").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
	index("idx_incoming_orders_internal").using("btree", table.internalOrderId.asc().nullsLast().op("int4_ops")),
	index("idx_incoming_orders_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	index("idx_incoming_orders_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.internalOrderId],
			foreignColumns: [orders.id],
			name: "incoming_orders_internal_order_id_orders_id_fk"
		}),
]);

export const deliveryZones = pgTable("delivery_zones", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "delivery_zones_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	description: text(),
	centerLat: numeric("center_lat", { precision: 10, scale:  7 }).notNull(),
	centerLng: numeric("center_lng", { precision: 11, scale:  7 }).notNull(),
	radiusKm: numeric("radius_km", { precision: 5, scale:  2 }).notNull(),
	deliveryFee: numeric("delivery_fee", { precision: 10, scale:  2 }).default('0').notNull(),
	minimumOrder: numeric("minimum_order", { precision: 10, scale:  2 }).default('0').notNull(),
	estimatedMinutes: integer("estimated_minutes").default(30),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_delivery_zones_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
]);

export const feedbackAnalysis = pgTable("feedback_analysis", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "feedback_analysis_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	feedbackId: integer("feedback_id").notNull(),
	sentiment: text().notNull(),
	score: text().notNull(),
	themes: text().notNull(),
	summary: text(),
	suggestedAction: text("suggested_action"),
	analyzedAt: timestamp("analyzed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.feedbackId],
			foreignColumns: [feedbacks.id],
			name: "feedback_analysis_feedback_id_feedbacks_id_fk"
		}),
	unique("feedback_analysis_feedback_id_unique").on(table.feedbackId),
]);

export const restaurantConfig = pgTable("restaurant_config", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "restaurant_config_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	key: text().notNull(),
	value: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("restaurant_config_key_unique").on(table.key),
]);

export const promoCodes = pgTable("promo_codes", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "promo_codes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	code: text().notNull(),
	type: text().default('percentage').notNull(),
	value: doublePrecision().notNull(),
	minOrderAmount: doublePrecision("min_order_amount").default(0),
	maxUses: integer("max_uses").default(0),
	currentUses: integer("current_uses").default(0),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("promo_codes_code_unique").on(table.code),
]);

export const ingredients = pgTable("ingredients", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "ingredients_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	unit: text().notNull(),
	currentStock: numeric("current_stock", { precision: 10, scale:  2 }).default('0').notNull(),
	parLevel: numeric("par_level", { precision: 10, scale:  2 }).default('10').notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	version: integer().default(1).notNull(),
	createdBy: integer("created_by"),
	updatedBy: integer("updated_by"),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
}, (table) => [
	index("idx_ingredients_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_ingredients_stock").using("btree", table.currentStock.asc().nullsLast().op("numeric_ops")),
	unique("ingredients_name_unique").on(table.name),
	check("ingredients_current_stock_check", sql`current_stock >= (0)::numeric`),
	check("ingredients_par_level_check", sql`par_level >= (0)::numeric`),
	check("ingredients_unit_cost_check", sql`unit_cost >= (0)::numeric`),
]);

export const dishModifiers = pgTable("dish_modifiers", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "dish_modifiers_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	dishId: integer("dish_id").notNull(),
	name: text().notNull(),
	type: text().default('single').notNull(),
	options: jsonb().default([]).notNull(),
	isRequired: boolean("is_required").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_dish_modifiers_dish").using("btree", table.dishId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.dishId],
			foreignColumns: [dishes.id],
			name: "dish_modifiers_dish_id_dishes_id_fk"
		}),
]);

export const inventoryTransactions = pgTable("inventory_transactions", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "inventory_transactions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	ingredientId: integer("ingredient_id").notNull(),
	changeQty: numeric("change_qty", { precision: 10, scale:  2 }).notNull(),
	reason: text().notNull(),
	referenceId: text("reference_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	createdBy: integer("created_by"),
}, (table) => [
	index("idx_inventory_tx_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_inventory_tx_ingredient").using("btree", table.ingredientId.asc().nullsLast().op("int4_ops")),
	index("idx_inventory_tx_reason").using("btree", table.reason.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ingredientId],
			foreignColumns: [ingredients.id],
			name: "inventory_transactions_ingredient_id_ingredients_id_fk"
		}),
]);

export const categories = pgTable("categories", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "categories_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	description: text(),
	displayOrder: integer("display_order").default(0),
	imageUrl: text("image_url"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_categories_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	unique("categories_name_unique").on(table.name),
]);

export const feedbacks = pgTable("feedbacks", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "feedbacks_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	orderId: integer("order_id").notNull(),
	customerId: integer("customer_id").notNull(),
	rating: text().notNull(),
	comment: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "feedbacks_order_id_orders_id_fk"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "feedbacks_customer_id_customers_id_fk"
		}),
]);

export const customerAddresses = pgTable("customer_addresses", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "customer_addresses_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	customerId: integer("customer_id").notNull(),
	label: text().default('Home'),
	addressLine1: text("address_line_1").notNull(),
	addressLine2: text("address_line_2"),
	city: text().notNull(),
	state: text().notNull(),
	pincode: text().notNull(),
	latitude: numeric({ precision: 10, scale:  7 }),
	longitude: numeric({ precision: 10, scale:  7 }),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_customer_addresses_city").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("idx_customer_addresses_customer").using("btree", table.customerId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "customer_addresses_customer_id_customers_id_fk"
		}),
]);

export const orderItems = pgTable("order_items", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "order_items_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	orderId: integer("order_id").notNull(),
	dishId: integer("dish_id").notNull(),
	quantity: integer().default(1).notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	modifiers: jsonb().default([]),
}, (table) => [
	index("idx_order_items_dish").using("btree", table.dishId.asc().nullsLast().op("int4_ops")),
	index("idx_order_items_order").using("btree", table.orderId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}),
	check("order_items_quantity_check", sql`quantity >= 1`),
	check("order_items_unit_price_check", sql`unit_price >= (0)::numeric`),
]);

export const payments = pgTable("payments", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "payments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	orderId: integer("order_id").notNull(),
	gateway: text().default('stripe').notNull(),
	gatewayTransactionId: text("gateway_transaction_id"),
	paymentIntentId: text("payment_intent_id"),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	currency: text().default('INR'),
	status: paymentStatus().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	version: integer().default(1).notNull(),
	createdBy: integer("created_by"),
}, (table) => [
	index("idx_payments_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_payments_gateway_txn").using("btree", table.gatewayTransactionId.asc().nullsLast().op("text_ops")),
	index("idx_payments_order").using("btree", table.orderId.asc().nullsLast().op("int4_ops")),
	index("idx_payments_payment_intent").using("btree", table.paymentIntentId.asc().nullsLast().op("text_ops")),
	index("idx_payments_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "payments_order_id_orders_id_fk"
		}),
	check("payments_amount_check", sql`amount >= (0)::numeric`),
]);

export const orderStatusHistory = pgTable("order_status_history", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "order_status_history_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	orderId: integer("order_id").notNull(),
	fromStatus: text("from_status"),
	toStatus: text("to_status").notNull(),
	changedBy: text("changed_by").default('system'),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_order_history_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_order_history_order").using("btree", table.orderId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_status_history_order_id_orders_id_fk"
		}),
]);

export const orders = pgTable("orders", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "orders_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	customerId: integer("customer_id"),
	status: orderStatus().default('PENDING').notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	deliveryAddressId: integer("delivery_address_id"),
	paymentIntentId: text("payment_intent_id"),
	dispatchId: text("dispatch_id"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	version: integer().default(1).notNull(),
	createdBy: integer("created_by"),
	updatedBy: integer("updated_by"),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	idempotencyKey: text("idempotency_key"),
	idempotencyKeyCreatedAt: timestamp("idempotency_key_created_at", { mode: 'string' }),
}, (table) => [
	index("idx_orders_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_orders_customer").using("btree", table.customerId.asc().nullsLast().op("int4_ops")),
	index("idx_orders_customer_status").using("btree", table.customerId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops")),
	index("idx_orders_dispatch_id").using("btree", table.dispatchId.asc().nullsLast().op("text_ops")),
	index("idx_orders_idempotency_key").using("btree", table.idempotencyKey.asc().nullsLast().op("text_ops")),
	index("idx_orders_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("idx_orders_status_created").using("btree", table.status.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "orders_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.deliveryAddressId],
			foreignColumns: [customerAddresses.id],
			name: "orders_delivery_address_id_customer_addresses_id_fk"
		}),
	check("orders_total_amount_check", sql`total_amount >= (0)::numeric`),
]);

export const dishIngredients = pgTable("dish_ingredients", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "dish_ingredients_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	dishId: integer("dish_id").notNull(),
	ingredientId: integer("ingredient_id").notNull(),
	quantity: numeric({ precision: 10, scale:  3 }).notNull(),
}, (table) => [
	index("idx_dish_ingredients_dish").using("btree", table.dishId.asc().nullsLast().op("int4_ops")),
	index("idx_dish_ingredients_ingredient").using("btree", table.ingredientId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.ingredientId],
			foreignColumns: [ingredients.id],
			name: "dish_ingredients_ingredient_id_ingredients_id_fk"
		}),
	foreignKey({
			columns: [table.dishId],
			foreignColumns: [dishes.id],
			name: "dish_ingredients_dish_id_dishes_id_fk"
		}).onDelete("cascade"),
	check("dish_ingredients_quantity_check", sql`quantity > (0)::numeric`),
]);

export const dishes = pgTable("dishes", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "dishes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	categoryId: integer("category_id").notNull(),
	name: text().notNull(),
	description: text(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	prepTimeMin: integer("prep_time_min").default(15).notNull(),
	dietaryTags: text("dietary_tags").default('{}'),
	imageUrl: text("image_url"),
	isAvailable: boolean("is_available").default(true),
	isVeg: boolean("is_veg").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	version: integer().default(1).notNull(),
	createdBy: integer("created_by"),
	updatedBy: integer("updated_by"),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
}, (table) => [
	index("idx_dishes_available").using("btree", table.isAvailable.asc().nullsLast().op("bool_ops")),
	index("idx_dishes_category").using("btree", table.categoryId.asc().nullsLast().op("int4_ops")),
	index("idx_dishes_category_available").using("btree", table.categoryId.asc().nullsLast().op("int4_ops"), table.isAvailable.asc().nullsLast().op("bool_ops")),
	index("idx_dishes_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "dishes_category_id_categories_id_fk"
		}),
	check("dishes_price_check", sql`price >= (0)::numeric`),
]);

export const cartItems = pgTable("cart_items", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "cart_items_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	customerId: integer("customer_id").notNull(),
	dishId: integer("dish_id").notNull(),
	quantity: integer().default(1).notNull(),
	modifiers: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_cart_items_customer").using("btree", table.customerId.asc().nullsLast().op("int4_ops")),
	index("idx_cart_items_dish").using("btree", table.dishId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "cart_items_customer_id_customers_id_fk"
		}),
	check("cart_items_quantity_check", sql`quantity >= 1`),
]);

export const customerFavorites = pgTable("customer_favorites", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "customer_favorites_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	customerId: integer("customer_id").notNull(),
	dishId: integer("dish_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_customer_favorites_customer").using("btree", table.customerId.asc().nullsLast().op("int4_ops")),
	index("idx_customer_favorites_customer_dish").using("btree", table.customerId.asc().nullsLast().op("int4_ops"), table.dishId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("idx_customer_favorites_unique").using("btree", table.customerId.asc().nullsLast().op("int4_ops"), table.dishId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "customer_favorites_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.dishId],
			foreignColumns: [dishes.id],
			name: "customer_favorites_dish_id_dishes_id_fk"
		}),
]);
