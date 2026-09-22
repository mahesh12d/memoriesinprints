ALTER TABLE "portfolio_items" ADD COLUMN "template_number" integer;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_items_template_number_unique" ON "portfolio_items" USING btree ("template_number");