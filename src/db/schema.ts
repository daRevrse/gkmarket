import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
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
