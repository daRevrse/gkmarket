CREATE TYPE "public"."message_kind" AS ENUM('text', 'product', 'image', 'file', 'audio');--> statement-breakpoint
CREATE TABLE "contact_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"context" text NOT NULL,
	"conversation_id" uuid,
	"excerpt" text NOT NULL,
	"reasons" text[] NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD COLUMN "kind" "message_kind" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD COLUMN "attachment_path" text;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "watched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_violations" ADD CONSTRAINT "contact_violations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_violations" ADD CONSTRAINT "contact_violations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_violations_user_idx" ON "contact_violations" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;