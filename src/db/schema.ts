import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Les 4 rôles du système (cf. docs/CHANGEMENTS.md §1 : le livreur est un compte à part entière).
// NOTE itération 1 : trancher si un utilisateur peut cumuler les rôles (acheteur + vendeur) —
// le cas échéant, extraire vers une table de jointure user_roles.
export const userRoleEnum = pgEnum("user_role", [
  "buyer",
  "seller",
  "courier",
  "admin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pending",
  "active",
  "suspended",
  "banned",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Lien vers Firebase Authentication (renseigné à l'itération 1)
  firebaseUid: text("firebase_uid").unique(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  fullName: text("full_name"),
  role: userRoleEnum("role").notNull().default("buyer"),
  status: userStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
