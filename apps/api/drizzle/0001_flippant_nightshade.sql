CREATE TYPE "public"."feedback_rating" AS ENUM('1', '2', '3', '4', '5');--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('percentage', 'flat');--> statement-breakpoint
CREATE TABLE "feedback_analysis" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_analysis_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"feedback_id" integer NOT NULL,
	"sentiment" text NOT NULL,
	"score" text NOT NULL,
	"themes" text NOT NULL,
	"summary" text,
	"suggested_action" text,
	"analyzed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_analysis_feedback_id_unique" UNIQUE("feedback_id")
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedbacks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"rating" text NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promo_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"type" text DEFAULT 'percentage' NOT NULL,
	"value" double precision NOT NULL,
	"min_order_amount" double precision DEFAULT 0,
	"max_uses" integer DEFAULT 0,
	"current_uses" integer DEFAULT 0,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "automation_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "automation_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "automation_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "automation_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "automation_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "automation_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "customer_addresses" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "customer_addresses" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "customer_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "customers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "delivery_zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "incoming_orders" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "incoming_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "incoming_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "restaurant_config" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "restaurant_config" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "restaurant_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "dish_ingredients" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "dish_ingredients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "dish_ingredients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ingredients" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ingredients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ingredients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "inventory_transactions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "inventory_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "dish_modifiers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "dish_modifiers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "dish_modifiers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "dishes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "dishes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "dishes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "order_status_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "automation_logs" ADD COLUMN "rule_id" integer;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "last_triggered_at" timestamp;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "execution_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "role" text DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE "restaurant_config" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "dish_modifiers" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "order_status_history" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "feedback_analysis" ADD CONSTRAINT "feedback_analysis_feedback_id_feedbacks_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedbacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_orders" ADD CONSTRAINT "incoming_orders_internal_order_id_orders_id_fk" FOREIGN KEY ("internal_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_automation_logs_rule" ON "automation_logs" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_automation_logs_workflow" ON "automation_logs" USING btree ("workflow_name");--> statement-breakpoint
CREATE INDEX "idx_automation_logs_status" ON "automation_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_automation_logs_created_at" ON "automation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_trigger" ON "automation_rules" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_active" ON "automation_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_customer_addresses_customer" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_addresses_city" ON "customer_addresses" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_customers_role" ON "customers" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_customers_last_order" ON "customers" USING btree ("last_order_at");--> statement-breakpoint
CREATE INDEX "idx_customers_created_at" ON "customers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_delivery_zones_active" ON "delivery_zones" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_incoming_orders_external" ON "incoming_orders" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_incoming_orders_source" ON "incoming_orders" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_incoming_orders_status" ON "incoming_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_incoming_orders_internal" ON "incoming_orders" USING btree ("internal_order_id");--> statement-breakpoint
CREATE INDEX "idx_incoming_orders_created_at" ON "incoming_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_dish_ingredients_dish" ON "dish_ingredients" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "idx_dish_ingredients_ingredient" ON "dish_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_ingredients_stock" ON "ingredients" USING btree ("current_stock");--> statement-breakpoint
CREATE INDEX "idx_inventory_tx_ingredient" ON "inventory_transactions" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_tx_created_at" ON "inventory_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_tx_reason" ON "inventory_transactions" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "idx_categories_active" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_dish_modifiers_dish" ON "dish_modifiers" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "idx_dishes_category" ON "dishes" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_dishes_available" ON "dishes" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "idx_dishes_name" ON "dishes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_order_items_order" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_dish" ON "order_items" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "idx_order_history_order" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_history_created_at" ON "order_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_customer" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_created_at" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_order" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_gateway_txn" ON "payments" USING btree ("gateway_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_payments_created_at" ON "payments" USING btree ("created_at");