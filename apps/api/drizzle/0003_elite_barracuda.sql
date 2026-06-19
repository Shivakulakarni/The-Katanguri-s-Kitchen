CREATE TABLE "customer_favorites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_favorites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"dish_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customer_favorites_customer_dish" ON "customer_favorites" USING btree ("customer_id","dish_id");--> statement-breakpoint
CREATE INDEX "idx_customer_favorites_customer" ON "customer_favorites" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_orders_dispatch_id" ON "orders" USING btree ("dispatch_id");