CREATE TYPE "public"."inside_pages_style" AS ENUM('bw', 'match_cover');--> statement-breakpoint
CREATE TYPE "public"."order_form_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."photo_option" AS ENUM('none', 'colour', 'bw');--> statement-breakpoint
CREATE TYPE "public"."photo_supplied_via" AS ENUM('email', 'post');--> statement-breakpoint
CREATE TABLE "order_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"status" "order_form_status" DEFAULT 'draft' NOT NULL,
	"deceased_name" varchar(200),
	"date_of_birth" date,
	"date_of_death" date,
	"age_of_deceased" varchar(60),
	"funeral_date" date,
	"funeral_time" varchar(60),
	"venue_name" varchar(300),
	"photo_option" "photo_option",
	"number_of_pages" integer,
	"inside_pages_style" "inside_pages_style",
	"quantity" integer,
	"bespoke_design" boolean DEFAULT false NOT NULL,
	"bespoke_details" text,
	"photo_qty" integer,
	"photo_supplied_via" "photo_supplied_via",
	"photo_instructions" text,
	"attachment_key" text,
	"attachment_name" text,
	"additional_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"backpage_information" text,
	"additional_notes" text,
	"callback_requested" boolean DEFAULT false NOT NULL,
	"callback_phone" varchar(60),
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_forms" ADD CONSTRAINT "order_forms_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_forms_enquiry_unique" ON "order_forms" USING btree ("enquiry_id");