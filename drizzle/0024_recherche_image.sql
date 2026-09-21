CREATE TABLE "image_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"embedding" real[] NOT NULL,
	"thumbnail" text NOT NULL,
	"results" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_image_embeddings" (
	"image_id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"embedding" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_searches" ADD CONSTRAINT "image_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image_embeddings" ADD CONSTRAINT "product_image_embeddings_image_id_product_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."product_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image_embeddings" ADD CONSTRAINT "product_image_embeddings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_image_embeddings_product_idx" ON "product_image_embeddings" USING btree ("product_id");--> statement-breakpoint
-- Produit scalaire de deux vecteurs. Les embeddings CLIP étant normalisés,
-- il vaut le cosinus : 1 = identique, 0 = sans rapport. Suffisant pour le
-- volume actuel du catalogue ; passer à pgvector si l'index dépasse
-- quelques dizaines de milliers d'images.
CREATE OR REPLACE FUNCTION public.dot_product(a real[], b real[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(sum(x::double precision * y::double precision), 0)
    FROM unnest(a, b) AS t(x, y);
$$;
