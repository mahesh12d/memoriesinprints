CREATE TYPE "public"."event_audience" AS ENUM('designer', 'proofreader', 'customer', 'admin');--> statement-breakpoint
CREATE TABLE "order_watchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "audience" "event_audience";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_watchers" ADD CONSTRAINT "order_watchers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_watchers" ADD CONSTRAINT "order_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_watchers_order_user_unique" ON "order_watchers" USING btree ("order_id","user_id");--> statement-breakpoint
CREATE INDEX "order_watchers_user_idx" ON "order_watchers" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_activity_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."activity_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_order_idx" ON "activity_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_activity_idx" ON "orders" USING btree ("last_activity_at");--> statement-breakpoint
-- Backfill: the column defaults to now(), which would make every order in the
-- studio read as "just updated" the moment this lands — the one thing the
-- unseen markers exist to tell apart. Real last activity is the newest event
-- recorded against the order, falling back to the order's own timestamps for
-- one that never had any.
UPDATE "orders" SET "last_activity_at" = COALESCE(
	(
		SELECT MAX("activity_events"."created_at")
		FROM "activity_events"
		WHERE "activity_events"."order_id" = "orders"."id"
	),
	"orders"."updated_at",
	"orders"."created_at"
);
