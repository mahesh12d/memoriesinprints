ALTER TABLE "proof_comments" ADD COLUMN "sheet_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "proof_versions" ADD COLUMN "sheets" jsonb DEFAULT '[]'::jsonb NOT NULL;