CREATE TYPE "public"."customer_role" AS ENUM('customer', 'admin', 'rider');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."rider_status" AS ENUM('offline', 'online', 'delivering', 'busy');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"user_id" integer,
	"user_role" text DEFAULT 'system',
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cart_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"dish_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"modifiers" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cart_items_quantity_check" CHECK ("cart_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "webhook_alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" text,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" integer,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"endpoint_id" integer,
	"event" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_endpoints_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rider_earnings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rider_earnings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rider_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" text DEFAULT 'delivery' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rider_locations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rider_locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rider_id" integer NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "riders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"vehicle_type" text DEFAULT 'bike' NOT NULL,
	"vehicle_number" text,
	"status" "rider_status" DEFAULT 'offline' NOT NULL,
	"is_verified" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"current_lat" numeric(10, 7),
	"current_lng" numeric(10, 7),
	"rating" numeric(3, 2) DEFAULT '5.00',
	"total_deliveries" integer DEFAULT 0,
	"total_earnings" numeric(12, 2) DEFAULT '0',
	"current_order_id" integer,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "riders_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "role" SET DEFAULT 'customer'::"public"."customer_role";--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "role" SET DATA TYPE "public"."customer_role" USING "role"::"public"."customer_role";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DATA TYPE "public"."payment_status" USING "status"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_alerts" ADD CONSTRAINT "webhook_alerts_acknowledged_by_customers_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_earnings" ADD CONSTRAINT "rider_earnings_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_locations" ADD CONSTRAINT "rider_locations_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_current_order_id_orders_id_fk" FOREIGN KEY ("current_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cart_items_customer" ON "cart_items" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_cart_items_dish" ON "cart_items" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_alerts_severity" ON "webhook_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_webhook_alerts_ack" ON "webhook_alerts" USING btree ("acknowledged");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_endpoint" ON "webhook_deliveries" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_created_at" ON "webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_rider_earnings_rider" ON "rider_earnings" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX "idx_rider_earnings_status" ON "rider_earnings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rider_locations_rider" ON "rider_locations" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX "idx_rider_locations_time" ON "rider_locations" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_riders_phone" ON "riders" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_riders_status" ON "riders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_riders_location" ON "riders" USING btree ("current_lat","current_lng");--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_customer_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."customer_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ingredients_name" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_dishes_category_available" ON "dishes" USING btree ("category_id","is_available");--> statement-breakpoint
CREATE INDEX "idx_orders_customer_status" ON "orders" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "idx_orders_status_created" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_idempotency_key" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_intent" ON "payments" USING btree ("payment_intent_id");--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_quantity_check" CHECK ("dish_ingredients"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_current_stock_check" CHECK ("ingredients"."current_stock" >= 0);--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_par_level_check" CHECK ("ingredients"."par_level" >= 0);--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_unit_cost_check" CHECK ("ingredients"."unit_cost" >= 0);--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_price_check" CHECK ("dishes"."price" >= 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" >= 1);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_check" CHECK ("order_items"."unit_price" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_amount_check" CHECK ("orders"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" >= 0);