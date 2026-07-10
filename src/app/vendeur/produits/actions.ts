"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products } from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { adminStorage } from "@/lib/firebase/admin";

export type ProductInput = {
  title: string;
  description?: string;
  categoryId: string;
  originCountry?: string;
  priceFcfa: number;
  wholesalePriceFcfa?: number | null;
  wholesaleMinQty?: number | null;
  /** Prix promotionnel (barre le prix de base jusqu'à l'échéance). */
  promoPriceFcfa?: number | null;
  /** Échéance de la promo, chaîne « AAAA-MM-JJ » du champ date. */
  promoEndsAt?: string | null;
  stock: number;
  minOrderQty?: number;
  weightGrams?: number | null;
  prepDelayDays?: number;
};

/** Parse la date « AAAA-MM-JJ » du champ promo en fin de journée. */
function parsePromoEnd(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ImageInput = { path: string; url: string };

const MIN_IMAGES = 3;
const MAX_IMAGES = 10;

async function requireApprovedSeller(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user?.sellerProfile?.status === "approved" ? user : null;
}

async function validate(
  user: CurrentUser,
  input: ProductInput,
  images: ImageInput[],
): Promise<string | null> {
  if (!input.title?.trim()) return "Le titre est requis.";
  if (!Number.isInteger(input.priceFcfa) || input.priceFcfa <= 0) {
    return "Le prix unitaire doit être un montant en FCFA supérieur à 0.";
  }
  if (!Number.isInteger(input.stock) || input.stock < 0) {
    return "Le stock doit être un entier positif ou nul.";
  }
  if (images.length < MIN_IMAGES) {
    return `Ajoutez au moins ${MIN_IMAGES} photos.`;
  }
  if (images.length > MAX_IMAGES) {
    return `Maximum ${MAX_IMAGES} photos.`;
  }
  const prefix = `products/${user.firebaseUid}/`;
  if (images.some((image) => !image.path.startsWith(prefix))) {
    return "Photos invalides.";
  }

  const hasWholesalePrice = input.wholesalePriceFcfa != null;
  const hasWholesaleQty = input.wholesaleMinQty != null;
  if (hasWholesalePrice !== hasWholesaleQty) {
    return "Prix de gros : indiquez à la fois le prix et la quantité minimum.";
  }
  if (hasWholesalePrice) {
    if (input.wholesalePriceFcfa! <= 0 || input.wholesalePriceFcfa! >= input.priceFcfa) {
      return "Le prix de gros doit être inférieur au prix unitaire.";
    }
    if (input.wholesaleMinQty! < 2) {
      return "La quantité minimum pour le prix de gros doit être d'au moins 2.";
    }
  }

  // Promo : prix et échéance vont de pair ; le prix doit être inférieur et
  // l'échéance dans le futur.
  const hasPromoPrice = input.promoPriceFcfa != null;
  const promoEnd = parsePromoEnd(input.promoEndsAt);
  if (hasPromoPrice !== (promoEnd !== null)) {
    return "Promo : indiquez à la fois le prix promo et la date de fin.";
  }
  if (hasPromoPrice) {
    if (input.promoPriceFcfa! <= 0 || input.promoPriceFcfa! >= input.priceFcfa) {
      return "Le prix promo doit être inférieur au prix unitaire.";
    }
    if (promoEnd! <= new Date()) {
      return "La date de fin de la promo doit être dans le futur.";
    }
  }

  // La catégorie doit être une sous-catégorie existante.
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.id, input.categoryId), isNotNull(categories.parentId)),
    )
    .limit(1);
  if (!category) return "Choisissez une sous-catégorie.";

  return null;
}

function toValues(input: ProductInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    categoryId: input.categoryId,
    originCountry: input.originCountry?.trim() || "Togo",
    priceFcfa: input.priceFcfa,
    wholesalePriceFcfa: input.wholesalePriceFcfa ?? null,
    wholesaleMinQty: input.wholesaleMinQty ?? null,
    promoPriceFcfa: input.promoPriceFcfa ?? null,
    promoEndsAt: parsePromoEnd(input.promoEndsAt),
    stock: input.stock,
    minOrderQty: input.minOrderQty && input.minOrderQty > 0 ? input.minOrderQty : 1,
    weightGrams: input.weightGrams ?? null,
    prepDelayDays:
      input.prepDelayDays && input.prepDelayDays > 0 ? input.prepDelayDays : 1,
    updatedAt: new Date(),
  };
}

async function deleteStorageFiles(paths: string[]) {
  // Nettoyage best-effort : un fichier orphelin n'est pas bloquant.
  await Promise.allSettled(
    paths.map((path) => adminStorage.bucket().file(path).delete()),
  );
}

export async function createProduct(
  input: ProductInput,
  images: ImageInput[],
): Promise<{ error?: string }> {
  const user = await requireApprovedSeller();
  if (!user) return { error: "Réservé aux vendeurs approuvés." };

  const error = await validate(user, input, images);
  if (error) return { error };

  await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({ sellerId: user.sellerProfile!.id, ...toValues(input) })
      .returning({ id: products.id });
    await tx.insert(productImages).values(
      images.map((image, index) => ({
        productId: product.id,
        path: image.path,
        url: image.url,
        position: index,
      })),
    );
  });

  revalidatePath("/vendeur/produits");
  return {};
}

async function getOwnedProduct(user: CurrentUser, productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.sellerId, user.sellerProfile!.id),
      ),
    )
    .limit(1);
  return product ?? null;
}

export async function updateProduct(
  productId: string,
  input: ProductInput,
  images: ImageInput[],
): Promise<{ error?: string }> {
  const user = await requireApprovedSeller();
  if (!user) return { error: "Réservé aux vendeurs approuvés." };
  if (!(await getOwnedProduct(user, productId))) {
    return { error: "Produit introuvable." };
  }

  const error = await validate(user, input, images);
  if (error) return { error };

  const oldImages = await db
    .select({ path: productImages.path })
    .from(productImages)
    .where(eq(productImages.productId, productId));

  await db.transaction(async (tx) => {
    await tx.update(products).set(toValues(input)).where(eq(products.id, productId));
    await tx.delete(productImages).where(eq(productImages.productId, productId));
    await tx.insert(productImages).values(
      images.map((image, index) => ({
        productId,
        path: image.path,
        url: image.url,
        position: index,
      })),
    );
  });

  const kept = new Set(images.map((image) => image.path));
  await deleteStorageFiles(
    oldImages.map((image) => image.path).filter((path) => !kept.has(path)),
  );

  revalidatePath("/vendeur/produits");
  revalidatePath(`/produits/${productId}`);
  return {};
}

export async function setProductStatus(
  productId: string,
  status: "draft" | "published",
): Promise<{ error?: string }> {
  const user = await requireApprovedSeller();
  if (!user) return { error: "Réservé aux vendeurs approuvés." };
  if (!(await getOwnedProduct(user, productId))) {
    return { error: "Produit introuvable." };
  }

  await db
    .update(products)
    .set({ status, updatedAt: new Date() })
    .where(eq(products.id, productId));

  revalidatePath("/vendeur/produits");
  revalidatePath("/produits");
  return {};
}

export async function deleteProduct(
  productId: string,
): Promise<{ error?: string }> {
  const user = await requireApprovedSeller();
  if (!user) return { error: "Réservé aux vendeurs approuvés." };
  if (!(await getOwnedProduct(user, productId))) {
    return { error: "Produit introuvable." };
  }

  const images = await db
    .select({ path: productImages.path })
    .from(productImages)
    .where(eq(productImages.productId, productId));

  await db.delete(products).where(eq(products.id, productId));
  await deleteStorageFiles(images.map((image) => image.path));

  revalidatePath("/vendeur/produits");
  revalidatePath("/produits");
  return {};
}
