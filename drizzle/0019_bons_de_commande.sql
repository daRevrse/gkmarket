CREATE TYPE "public"."purchase_order_status" AS ENUM('sent', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."message_kind" ADD VALUE 'quote_request';--> statement-breakpoint
ALTER TYPE "public"."message_kind" ADD VALUE 'purchase_order';--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid,
	"title" text NOT NULL,
	"image_url" text,
	"unit_price_fcfa" integer NOT NULL,
	"quantity" integer NOT NULL,
	"total_fcfa" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"status" "purchase_order_status" DEFAULT 'sent' NOT NULL,
	"subtotal_fcfa" integer NOT NULL,
	"delivery_fee_fcfa" integer NOT NULL,
	"note" text,
	"expires_at" timestamp with time zone NOT NULL,
	"decline_reason" text,
	"order_id" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD COLUMN "purchase_order_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_fee_fcfa" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_orders_conv_idx" ON "purchase_orders" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;