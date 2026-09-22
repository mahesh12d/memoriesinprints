ALTER TABLE "portfolio_items" ADD COLUMN "style" varchar(60);--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "is_popular" boolean DEFAULT false NOT NULL;