ALTER TABLE "seller_profiles" ADD COLUMN "address_document_path" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "payout_method" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "mobile_money_operator" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "mobile_money_number" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "bank_iban" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "selling_conditions" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "terms_accepted_at" timestamp with time zone;