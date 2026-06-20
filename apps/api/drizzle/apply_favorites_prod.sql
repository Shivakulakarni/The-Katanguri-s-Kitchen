-- Run this on your Supabase production database
-- via Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS "customer_favorites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"customer_id" integer NOT NULL,
	"dish_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);

ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_dish_id_dishes_id_fk"
  FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_customer_favorites_customer_dish"
  ON "customer_favorites" USING btree ("customer_id","dish_id");

CREATE INDEX IF NOT EXISTS "idx_customer_favorites_customer"
  ON "customer_favorites" USING btree ("customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_favorites_unique"
  ON "customer_favorites" USING btree ("customer_id","dish_id");
