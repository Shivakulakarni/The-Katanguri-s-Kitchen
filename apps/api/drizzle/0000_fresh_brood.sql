CREATE TABLE IF NOT EXISTS "automation_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"workflow_name" text NOT NULL,
	"event_id" text,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" text NOT NULL,
	"trigger" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_addresses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"customer_id" integer NOT NULL,
	"label" text DEFAULT 'Home',
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"is_default" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"email" text,
	"phone" text,
	"name" text,
	"password_hash" text,
	"is_guest" boolean DEFAULT false,
	"marketing_opt_out" boolean DEFAULT false,
	"lifetime_value" numeric(10, 2) DEFAULT '0',
	"last_order_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_zones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" text NOT NULL,
	"description" text,
	"center_lat" numeric(10, 7) NOT NULL,
	"center_lng" numeric(11, 7) NOT NULL,
	"radius_km" numeric(5, 2) NOT NULL,
	"delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"minimum_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_minutes" integer DEFAULT 30,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incoming_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_address" text,
	"payload" jsonb NOT NULL,
	"internal_order_id" integer,
	"status" text DEFAULT 'received' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurant_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "restaurant_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dish_ingredients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"dish_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"quantity" numeric(10, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingredients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"current_stock" numeric(10, 2) DEFAULT '0' NOT NULL,
	"par_level" numeric(10, 2) DEFAULT '10' NOT NULL,
	"unit_cost" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ingredients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"ingredient_id" integer NOT NULL,
	"change_qty" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"reference_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0,
	"image_url" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dish_modifiers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"dish_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'single' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_required" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dishes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"prep_time_min" integer DEFAULT 15 NOT NULL,
	"dietary_tags" text DEFAULT '{}',
	"image_url" text,
	"is_available" boolean DEFAULT true,
	"is_veg" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"order_id" integer NOT NULL,
	"dish_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_status_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"order_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text DEFAULT 'system',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"customer_id" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"delivery_address_id" integer,
	"payment_intent_id" text,
	"dispatch_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"order_id" integer NOT NULL,
	"gateway" text DEFAULT 'stripe' NOT NULL,
	"gateway_transaction_id" text,
	"payment_intent_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'INR',
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dish_modifiers" ADD CONSTRAINT "dish_modifiers_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dishes" ADD CONSTRAINT "dishes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
