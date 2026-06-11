import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { wallets, walletTransactions } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

/** Wallet du compte, créé au premier accès (MVP n°108-109). */
export async function getOrCreateWallet(userId: string, dbx: DbOrTx = db) {
  const [existing] = await dbx
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await dbx
    .insert(wallets)
    .values({ userId })
    .onConflictDoNothing({ target: wallets.userId })
    .returning();
  if (created) return created;

  // Création concurrente : relire.
  const [row] = await dbx
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  return row;
}

/**
 * Mouvement de wallet atomique : met à jour le solde ET trace l'écriture.
 * `amountFcfa` signé (crédit positif, débit négatif). Pour un débit, le
 * WHERE garantit un solde suffisant — retourne false sinon.
 */
export async function applyWalletMovement(
  tx: Tx,
  walletId: string,
  movement: {
    type: (typeof walletTransactions.$inferInsert)["type"];
    amountFcfa: number;
    description: string;
    orderId?: string | null;
  },
): Promise<boolean> {
  const updated = await tx
    .update(wallets)
    .set({
      balanceFcfa: sql`${wallets.balanceFcfa} + ${movement.amountFcfa}`,
      updatedAt: new Date(),
    })
    .where(
      movement.amountFcfa < 0
        ? sql`${wallets.id} = ${walletId} AND ${wallets.balanceFcfa} >= ${-movement.amountFcfa}`
        : eq(wallets.id, walletId),
    )
    .returning({ id: wallets.id });
  if (updated.length === 0) return false;

  await tx.insert(walletTransactions).values({
    walletId,
    type: movement.type,
    amountFcfa: movement.amountFcfa,
    orderId: movement.orderId ?? null,
    description: movement.description,
  });
  return true;
}
