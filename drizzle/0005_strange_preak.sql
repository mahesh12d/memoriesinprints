ALTER TABLE "saved_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "portfolio_item_id" uuid;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_portfolio_item_id_portfolio_items_id_fk" FOREIGN KEY ("portfolio_item_id") REFERENCES "public"."portfolio_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_template_unique" ON "saved_items" USING btree ("user_id","portfolio_item_id");--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_one_target" CHECK (("saved_items"."product_id" is null) <> ("saved_items"."portfolio_item_id" is null));