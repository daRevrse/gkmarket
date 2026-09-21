import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Modèle multi-rôles (décision itération 1) : tout compte est acheteur par défaut ;
// « vendeur » et « livreur » sont des casquettes supplémentaires activées après
// vérification, matérialisées par l'existence d'un profil dédié.
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "banned",
  "deleted",
]);

export const profileStatusEnum = pgEnum("profile_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Identité gérée par Firebase Authentication
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  fullName: text("full_name"),
  isAdmin: boolean("is_admin").notNull().default(false),
  status: userStatusEnum("status").notNull().default("active"),
  // Placé sous surveillance après une tentative de contournement (partage de
  // coordonnées bloqué, cf. docs/CHANGEMENTS.md §5). Levée par un admin.
  watchedAt: timestamp("watched_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Archive des comptes supprimés : la ligne `users` est anonymisée (l'id reste
// pour l'intégrité des commandes futures), l'identité est conservée ici comme
// trace (litiges, obligations légales, lutte anti-fraude).
export const userArchives = pgTable("user_archives", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  firebaseUid: text("firebase_uid").notNull(),
  email: text("email"),
  phone: text("phone"),
  fullName: text("full_name"),
  hadSellerProfile: boolean("had_seller_profile").notNull().default(false),
  hadCourierProfile: boolean("had_courier_profile").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Casquette vendeur (itération 2). La demande est créée avec status=pending
// puis validée/refusée par un admin. Les documents KYC sont stockés dans
// Firebase Storage (chemins privés, consultation via le serveur uniquement).
export const sellerProfiles = pgTable("seller_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  shopName: text("shop_name").notNull(),
  shopDescription: text("shop_description"),
  // Logo de la boutique (URL publique Firebase Storage), optionnel.
  logoUrl: text("logo_url"),
  city: text("city").notNull().default("Lomé"),
  district: text("district"),
  contactPhone: text("contact_phone"),
  // N° RCCM (registre du commerce) - optionnel, beaucoup de vendeurs informels
  rccm: text("rccm"),
  idDocumentPath: text("id_document_path").notNull(),
  rccmDocumentPath: text("rccm_document_path"),
  // Justificatif de domicile/adresse (facture, attestation), privé comme le KYC.
  addressDocumentPath: text("address_document_path"),
  // Coordonnées de versement des gains (privées, visibles vendeur + admin) :
  // Mobile Money (Flooz/T-Money) ou virement bancaire.
  payoutMethod: text("payout_method"), // "mobile_money" | "bank"
  mobileMoneyOperator: text("mobile_money_operator"), // "flooz" | "tmoney"
  mobileMoneyNumber: text("mobile_money_number"),
  bankName: text("bank_name"),
  bankAccountName: text("bank_account_name"),
  bankIban: text("bank_iban"),
  // Conditions de vente de la boutique (délais, retours, garanties), publiques.
  sellingConditions: text("selling_conditions"),
  // Profil d'entreprise public (lot 5) : interlocuteur, ancienneté, zones
  // desservies et photos des locaux (Storage logos/{uid}/...).
  contactName: text("contact_name"),
  contactRole: text("contact_role"),
  contactPhotoUrl: text("contact_photo_url"),
  foundedYear: integer("founded_year"),
  deliveryZones: text("delivery_zones"),
  photos: text("photos").array(),
  // Acceptation des conditions vendeur (CGV vendeur) à la candidature.
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  status: profileStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "moto",
  "tricycle",
  "voiture",
  "camionnette",
]);

// Casquette livreur (cf. docs/CHANGEMENTS.md §1) : candidature avec KYC
// (pièce d'identité dans Firebase Storage, comme les vendeurs), validée par
// un admin. La zone desservie sert à la proposition intelligente de livreurs.
export const courierProfiles = pgTable("courier_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicleType: vehicleTypeEnum("vehicle_type").notNull().default("moto"),
  city: text("city").notNull().default("Lomé"),
  district: text("district"),
  // Quartiers / zones desservis, en texte libre (« Bè, Tokoin, Agoè… »)
  serviceArea: text("service_area"),
  contactPhone: text("contact_phone"),
  idDocumentPath: text("id_document_path").notNull(),
  status: profileStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Catégories du catalogue : deux niveaux (catégorie -> sous-catégorie via parentId).
// Les produits sont rattachés aux sous-catégories.
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
  position: integer("position").notNull().default(0),
});

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "published",
  "archived",
]);

// Produits (itération 3). Prix en FCFA entiers (pas de centimes en XOF).
// Le prix de gros (optionnel) couvre le B2B : appliqué à partir de
// wholesaleMinQty unités.
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellerProfiles.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  title: text("title").notNull(),
  description: text("description"),
  originCountry: text("origin_country").notNull().default("Togo"),
  priceFcfa: integer("price_fcfa").notNull(),
  wholesalePriceFcfa: integer("wholesale_price_fcfa"),
  wholesaleMinQty: integer("wholesale_min_qty"),
  // Offre promotionnelle temporaire : prix barré jusqu'à l'échéance.
  promoPriceFcfa: integer("promo_price_fcfa"),
  promoEndsAt: timestamp("promo_ends_at", { withTimezone: true }),
  // Vidéo de présentation (lot 6), optionnelle : Storage products/{uid}/…
  videoPath: text("video_path"),
  videoUrl: text("video_url"),
  stock: integer("stock").notNull().default(0),
  minOrderQty: integer("min_order_qty").notNull().default(1),
  weightGrams: integer("weight_grams"),
  prepDelayDays: integer("prep_delay_days").notNull().default(1),
  status: productStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Photos produit (3 à 10) ; position 0 = photo principale.
export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
});

// Recherche par image (docs/CHANGEMENTS.md §5, lot 7) : vecteur CLIP de
// chaque photo produit, calculé sur le VPS (aucun service tiers). Les
// vecteurs sont normalisés, donc le produit scalaire vaut le cosinus.
export const productImageEmbeddings = pgTable(
  "product_image_embeddings",
  {
    imageId: uuid("image_id")
      .primaryKey()
      .references(() => productImages.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    embedding: real("embedding").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("product_image_embeddings_product_idx").on(table.productId)],
);

// Recherches par photo : le vecteur et une vignette servent à réafficher les
// résultats (URL partageable, rechargement) ; purgées après quelques jours.
export const imageSearches = pgTable("image_searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  embedding: real("embedding").array().notNull(),
  /** Vignette JPEG encodée en base64 (sans préfixe data:). */
  thumbnail: text("thumbnail").notNull(),
  results: integer("results").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Panier (itération 4) - lié au compte, un article par produit.
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("cart_user_product_idx").on(table.userId, table.productId)],
);

// « Ma liste » (docs/CHANGEMENTS.md §5) : une seule liste par acheteur
// (favoris / à acheter plus tard). Le prix à l'ajout signale les baisses.
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    priceAtAddFcfa: integer("price_at_add_fcfa").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wishlist_user_product_idx").on(table.userId, table.productId),
  ],
);

// « Vus récemment » : dernière consultation de chaque produit par compte
// (historique borné, cf. src/lib/shopping-list.ts).
export const productViews = pgTable(
  "product_views",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.productId] }),
    index("product_views_user_idx").on(table.userId, table.viewedAt),
  ],
);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment", // créée - le paiement Escrow arrive à l'itération 5
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "disputed", // litige ouvert : fonds Escrow bloqués jusqu'à l'arbitrage
  "refunded", // litige tranché en faveur de l'acheteur (remboursement total)
]);

// Commandes (itération 4) : un checkout multi-vendeurs crée une commande par
// vendeur, reliées par groupId. L'adresse est figée en snapshot.
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  groupId: uuid("group_id").notNull(),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellerProfiles.id),
  status: orderStatusEnum("status").notNull().default("pending_payment"),
  shippingName: text("shipping_name").notNull(),
  shippingPhone: text("shipping_phone").notNull(),
  shippingCity: text("shipping_city").notNull(),
  shippingDistrict: text("shipping_district"),
  shippingDetails: text("shipping_details"),
  subtotalFcfa: integer("subtotal_fcfa").notNull(),
  deliveryFeeFcfa: integer("delivery_fee_fcfa").notNull(),
  // Frais de service acheteur (docs/CHANGEMENTS.md §5) : % du sous-total,
  // revenu plateforme non remboursable. Inclus dans totalFcfa.
  serviceFeeFcfa: integer("service_fee_fcfa").notNull().default(0),
  totalFcfa: integer("total_fcfa").notNull(),
  // Escrow : commission plateforme prélevée au versement vendeur
  commissionFcfa: integer("commission_fcfa"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  // Point de départ du délai de déblocage automatique (MVP n°119)
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  // Suivi d'expédition (MVP n°148, 161, 162) — saisi par le vendeur.
  trackingNumber: text("tracking_number"),
  estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Lignes de commande : snapshot du produit au moment de l'achat
// (titre, prix appliqué - gros ou détail - et photo).
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  unitPriceFcfa: integer("unit_price_fcfa").notNull(),
  quantity: integer("quantity").notNull(),
  totalFcfa: integer("total_fcfa").notNull(),
});

// Wallet plateforme (itération 5) : un wallet par compte (multi-casquettes),
// créé automatiquement au premier accès. Le solde est maintenu sur le wallet,
// chaque mouvement est tracé dans wallet_transactions (grand livre).
export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  balanceFcfa: integer("balance_fcfa").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "recharge",        // dépôt Mobile Money / carte (simulé en local)
  "withdrawal",      // retrait vers Mobile Money (simulé en local)
  "order_payment",   // paiement d'une commande (fonds bloqués en Escrow)
  "order_refund",    // remboursement après annulation
  "sale_income",     // versement vendeur après livraison (net de commission)
  "delivery_income", // versement livreur après livraison (frais de livraison)
]);

// Montants signés : crédit positif, débit négatif.
export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id, { onDelete: "cascade" }),
  type: walletTransactionTypeEnum("type").notNull(),
  amountFcfa: integer("amount_fcfa").notNull(),
  orderId: uuid("order_id").references(() => orders.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "proposed",  // proposée par le vendeur à un livreur précis
  "accepted",  // acceptée par le livreur
  "refused",   // refusée - le vendeur peut proposer à un autre livreur
  "picked_up", // colis récupéré chez le vendeur (commande › expédiée)
  "delivered", // colis remis au destinataire (preuve enregistrée)
  "cancelled", // course annulée (commande annulée…)
]);

// Courses de livraison (itération 6, cf. docs/CHANGEMENTS.md §1) : le vendeur
// propose la course à un livreur choisi parmi une liste classée ; le livreur
// accepte ou refuse. Une commande ne peut avoir qu'une course active à la
// fois (index unique partiel), mais garde l'historique des refus.
export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellerProfiles.id),
    courierId: uuid("courier_id")
      .notNull()
      .references(() => courierProfiles.id),
    status: deliveryStatusEnum("status").notNull().default("proposed"),
    // Gain du livreur : les frais de livraison payés par l'acheteur,
    // versés au wallet du livreur au déblocage de l'Escrow.
    feeFcfa: integer("fee_fcfa").notNull(),
    refusalReason: text("refusal_reason"),
    // Preuve de remise (MVP n°175, 177-178)
    recipientName: text("recipient_name"),
    proofPhotoPath: text("proof_photo_path"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("deliveries_active_order_idx")
      .on(table.orderId)
      .where(sql`${table.status} NOT IN ('refused', 'cancelled')`),
  ],
);

// Motifs prédéfinis d'ouverture de litige (MVP n°187 - les incidents
// n°180-184 du cahier des charges deviennent des motifs).
export const disputeReasonEnum = pgEnum("dispute_reason", [
  "damaged",          // colis endommagé
  "lost",             // colis perdu
  "not_received",     // jamais reçu / jamais expédié
  "not_as_described", // produit non conforme
  "late",             // retard de livraison
  "other",
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "resolved",
]);

export const disputeResolutionEnum = pgEnum("dispute_resolution", [
  "refund_total",   // remboursement intégral de l'acheteur
  "refund_partial", // dédommagement partiel, solde versé au vendeur
  "release_seller", // litige rejeté : versement normal vendeur (+ livreur)
]);

// Litiges (itération 7, MVP n°186-208) : un litige par commande, ouvert par
// l'acheteur tant que les fonds sont en Escrow. L'ouverture bascule la
// commande en `disputed`, ce qui bloque la confirmation de réception,
// l'annulation et tout versement jusqu'à la décision d'un admin.
export const disputes = pgTable("disputes", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellerProfiles.id),
  reason: disputeReasonEnum("reason").notNull(),
  description: text("description").notNull(),
  status: disputeStatusEnum("status").notNull().default("open"),
  resolution: disputeResolutionEnum("resolution"),
  // Montant remboursé à l'acheteur (total ou partiel selon la résolution)
  refundFcfa: integer("refund_fcfa"),
  // Note de décision de l'admin, visible par les deux parties (MVP n°200, 207)
  decisionNote: text("decision_note"),
  resolvedById: uuid("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Fil d'échanges du litige : acheteur, vendeur et admins (MVP n°196, 204).
export const disputeMessages = pgTable("dispute_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  disputeId: uuid("dispute_id")
    .notNull()
    .references(() => disputes.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Preuves photo du litige (MVP n°189) - Storage privé `disputes/{uid}/`,
// consultation via /api/disputes/evidence (parties prenantes uniquement).
export const disputeEvidence = pgTable("dispute_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  disputeId: uuid("dispute_id")
    .notNull()
    .references(() => disputes.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  position: integer("position").notNull().default(0),
});

// Notifications in-app (itération 9, MVP n°302-310) : une ligne par
// destinataire et par événement. `link` pointe vers la ressource concernée.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId, table.createdAt),
  ],
);

// Emails transactionnels (MVP n°221) : journal d'envoi. En local, les emails
// sont « simulés » (status = simulated) - en production, Brevo les envoie
// réellement (sent/failed). Sert d'audit et de visualisation de test.
export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  status: text("status").notNull().default("simulated"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Adresses de livraison (MVP n°12 - ajout/modification/suppression)
export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label"),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  city: text("city").notNull().default("Lomé"),
  district: text("district"),
  details: text("details"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Paramètres de plateforme éditables par l'admin (MVP n°267, 270, 271) :
// clé/valeur texte, lus côté serveur avec repli sur les constantes de
// src/lib/pricing.ts. Clés : commission_rate_pct, delivery_fee_fcfa.
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Journal d'activité admin (MVP n°296) : trace des actions sensibles
// (validations, suspensions, arbitrages, paramètres, catégories).
export const adminLogs = pgTable("admin_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Signalements de produits par les utilisateurs (MVP n°275) : examinés par
// l'admin qui retire le produit (modération) ou classe le signalement.
export const productReports = pgTable("product_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(), // counterfeit | forbidden | misleading | other
  details: text("details"),
  status: text("status").notNull().default("open"), // open | resolved | dismissed
  resolvedById: uuid("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Messagerie acheteur <-> boutique (MVP n°150, 155) : une conversation unique
// par paire, ouverte depuis une fiche produit ou une commande. Les litiges
// gardent leur fil dédié (dispute_messages).
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("conversations_buyer_seller_idx").on(
      table.buyerId,
      table.sellerId,
    ),
  ],
);

export const messageKindEnum = pgEnum("message_kind", [
  "text",
  "product", // fiche produit envoyée depuis un article
  "image",
  "file", // document PDF
  "audio", // message vocal
  "quote_request", // demande de devis (acheteur)
  "purchase_order", // bon de commande (vendeur), cf. purchaseOrders
]);

export type MessageMeta = {
  product?: {
    title: string;
    imageUrl: string | null;
    priceFcfa: number;
    minOrderQty: number;
  };
  file?: { name: string; size: number; contentType: string };
  audio?: { durationSec: number };
  quote?: { quantity: number; note: string | null };
  purchaseOrder?: { number: string };
};

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: messageKindEnum("kind").notNull().default("text"),
    // Texte du message ; vide pour une pièce jointe ou une fiche produit seule.
    body: text("body").notNull(),
    // Fiche produit partagée (kind = product) - la copie dans `meta` garde
    // titre/photo/prix du moment même si le produit change ou disparaît.
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    // Pièce jointe privée dans Storage (chat/{firebaseUid}/...), lue via
    // /api/messages/[id]/attachment (parties de la conversation + admins).
    attachmentPath: text("attachment_path"),
    // Bon de commande présenté par le message (kind = purchase_order) : la
    // carte affiche son état courant (envoyé, accepté, refusé…).
    purchaseOrderId: uuid("purchase_order_id").references(
      (): AnyPgColumn => purchaseOrders.id,
      { onDelete: "cascade" },
    ),
    meta: jsonb("meta").$type<MessageMeta>(),
    // Lu par le destinataire (l'autre partie de la conversation).
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversation_messages_conv_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

// Tentatives de contournement bloquées (coordonnées dans un message, une
// fiche produit ou la boutique). Alimentent la surveillance côté admin.
export const contactViolations = pgTable(
  "contact_violations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    context: text("context").notNull(), // "message" | "product" | "shop"
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    // Texte bloqué, conservé pour l'examen par la modération.
    excerpt: text("excerpt").notNull(),
    reasons: text("reasons").array().notNull(), // phone, email, link, app
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("contact_violations_user_idx").on(table.userId)],
);

// Bons de commande émis dans le chat (docs/CHANGEMENTS.md §5, lot 3) : le
// vendeur fixe librement prix, livraison et durée de validité ; accepté par
// l'acheteur, le bon devient une commande normale (orderId). « Expiré » se
// déduit de expiresAt (pas de statut stocké).
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "sent",
  "accepted",
  "declined",
  "cancelled",
]);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: text("number").notNull().unique(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: purchaseOrderStatusEnum("status").notNull().default("sent"),
    subtotalFcfa: integer("subtotal_fcfa").notNull(),
    deliveryFeeFcfa: integer("delivery_fee_fcfa").notNull(),
    note: text("note"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    declineReason: text("decline_reason"),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("purchase_orders_conv_idx").on(table.conversationId)],
);

// Lignes d'un bon : produit du catalogue du vendeur ou ligne libre
// (productId null). Titre et photo figés à l'émission.
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  unitPriceFcfa: integer("unit_price_fcfa").notNull(),
  quantity: integer("quantity").notNull(),
  totalFcfa: integer("total_fcfa").notNull(),
  position: integer("position").notNull().default(0),
});

// Recherche (docs/CHANGEMENTS.md §5, lot 4). La recherche plein texte
// s'appuie sur products.search_vector (tsvector généré, hors Drizzle :
// migration 0021) et sur les extensions unaccent + pg_trgm.

// Synonymes locaux, éditables par l'admin : une recherche sur l'un des
// termes d'un groupe trouve aussi les autres (pagne / wax / tissu).
// Termes stockés en minuscules, sans accents.
export const searchSynonyms = pgTable("search_synonyms", {
  id: uuid("id").defaultRandom().primaryKey(),
  terms: text("terms").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Journal anonyme des recherches (tendances, recherches sans résultat
// montrées à l'admin et aux vendeurs). Requête normalisée, sans compte.
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    query: text("query").notNull(),
    results: integer("results").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("search_queries_created_idx").on(table.createdAt)],
);

// Avis (docs/CHANGEMENTS.md §5, lot 5). Uniquement après une commande
// livrée : tout avis est donc un « achat vérifié ». Un avis produit par
// article commandé, un avis vendeur par commande.

export const productReviews = pgTable(
  "product_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1 à 5
    comment: text("comment"),
    sellerReply: text("seller_reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    // Masqué par la modération : exclu de l'affichage et des moyennes.
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_reviews_order_product_idx").on(
      table.orderId,
      table.productId,
    ),
    index("product_reviews_product_idx").on(table.productId),
    index("product_reviews_seller_idx").on(table.sellerId),
  ],
);

// Avis vendeur : trois critères (MVP/Phase 2 n°122-125) notés 1 à 5.
export const sellerReviews = pgTable(
  "seller_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    communication: integer("communication").notNull(),
    shipping: integer("shipping").notNull(),
    packaging: integer("packaging").notNull(),
    comment: text("comment"),
    sellerReply: text("seller_reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("seller_reviews_seller_idx").on(table.sellerId)],
);
