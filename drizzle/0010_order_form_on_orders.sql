ALTER TABLE "order_forms" ALTER COLUMN "enquiry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_forms" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "order_forms" ADD COLUMN "shipping_name" varchar(200);--> statement-breakpoint
ALTER TABLE "order_forms" ADD COLUMN "shipping_line1" varchar(200);--> statement-breakpoint
ALTER TABLE "order_forms" ADD COLUMN "shipping_line2" varchar(200);--> statement-breakpoint
ALTER TABLE "order_forms" ADD COLUMN "shipping_city" varchar(120);--> statement-breakpoint
ALTER TABLE "order_forms" ADD COLUMN "shipping_postcode" varchar(20);--> statement-breakpoint
ALTER TABLE "order_forms" ADD COLUMN "shipping_country" varchar(120);--> statement-breakpoint
ALTER TABLE "order_forms" ADD CONSTRAINT "order_forms_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_forms_order_unique" ON "order_forms" USING btree ("order_id");