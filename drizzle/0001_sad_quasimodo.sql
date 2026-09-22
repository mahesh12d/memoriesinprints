ALTER TABLE "proof_versions" ADD COLUMN "archived_storage_key" text;--> statement-breakpoint
ALTER TABLE "proof_versions" ADD COLUMN "archived_at" timestamp with time zone;