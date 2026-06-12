CREATE TYPE "public"."delivery_status" AS ENUM('proposed', 'accepted', 'refused', 'picked_up', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('moto', 'tricycle', 'voiture', 'camionnette');--> statement-breakpoint
ALTER TYPE "public"."wallet_transaction_type" ADD VALUE 'delivery_income';--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"status" "delivery_status" DEFAULT 'proposed' NOT NULL,
	"fee_fcfa" integer NOT NULL,
	"refusal_reason" text,
	"recipient_name" text,
	"proof_photo_path" text,
	"accepted_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "vehicle_type" "vehicle_type" DEFAULT 'moto' NOT NULL;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "city" text DEFAULT 'Lomé' NOT NULL;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "service_area" text;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "id_document_path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "courier_profiles" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_courier_id_courier_profiles_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."courier_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_active_order_idx" ON "deliveries" USING btree ("order_id") WHERE "deliveries"."status" NOT IN ('refused', 'cancelled');