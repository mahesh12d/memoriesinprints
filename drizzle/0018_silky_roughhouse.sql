CREATE TYPE "public"."enquiry_user_type" AS ENUM('funeral_director', 'celebrant', 'client');--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "user_type" "enquiry_user_type";--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "user_type_note" text;