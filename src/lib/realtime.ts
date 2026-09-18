import "server-only";

import { EventEmitter } from "node:events";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { db } from "@/db";

// Temps réel (docs/STACK.md) : les événements passent par Postgres
// LISTEN/NOTIFY - n'importe quel processus peut publier (actions, cron) - et
// chaque processus Next les diffuse à ses onglets connectés en SSE
// (/api/realtime). Les charges utiles restent minimales : le client
// recharge ensuite ses données par les voies habituelles.

const CHANNEL = "deallome_realtime";
const RECONNECT_DELAY_MS = 3000;

export type RealtimeEvent =
  | { type: "message"; conversationId: string }
  | { type: "read"; conversationId: string }
  | { type: "typing"; conversationId: string }
  // Connexion d'écoute rétablie : des événements ont pu être perdus.
  | { type: "resync" };

type Envelope = { to: string[]; event: RealtimeEvent };

type Hub = {
  emitter: EventEmitter;
  client: Client | null;
  connecting: Promise<void> | null;
  everConnected: boolean;
  // Onglets connectés par utilisateur (présence, pour éviter les emails).
  online: Map<string, number>;
};

// Singleton par processus (survit aux rechargements du serveur de dev).
const globalHub = globalThis as typeof globalThis & { __dealLomeRealtime?: Hub };

function hub(): Hub {
  if (!globalHub.__dealLomeRealtime) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalHub.__dealLomeRealtime = {
      emitter,
      client: null,
      connecting: null,
      everConnected: false,
      online: new Map(),
    };
  }
  return globalHub.__dealLomeRealtime;
}

function connectListener(h: Hub): Promise<void> {
  if (h.client) return Promise.resolve();
  if (h.connecting) return h.connecting;

  h.connecting = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const lost = () => {
      if (h.client !== client) return;
      h.client = null;
      client.removeAllListeners();
      client.end().catch(() => {});
      // On ne se reconnecte que si des onglets écoutent encore.
      if (h.online.size > 0) {
        setTimeout(() => void connectListener(h), RECONNECT_DELAY_MS);
      }
    };
    client.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      try {
        const { to, event } = JSON.parse(message.payload) as Envelope;
        for (const userId of to) h.emitter.emit(userId, event);
      } catch {
        // Charge utile invalide : ignorée.
      }
    });
    client.on("error", lost);
    client.on("end", lost);

    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    h.client = client;

    if (h.everConnected) {
      for (const userId of h.online.keys()) {
        h.emitter.emit(userId, { type: "resync" } satisfies RealtimeEvent);
      }
    }
    h.everConnected = true;
  })()
    .catch(() => {
      if (h.online.size > 0) {
        setTimeout(() => void connectListener(h), RECONNECT_DELAY_MS);
      }
    })
    .finally(() => {
      h.connecting = null;
    });
  return h.connecting;
}

/** Publie un événement vers des utilisateurs. Jamais bloquant. */
export async function publish(
  to: string[],
  event: RealtimeEvent,
): Promise<void> {
  if (to.length === 0) return;
  try {
    const payload = JSON.stringify({ to, event } satisfies Envelope);
    await db.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
  } catch {
    // Temps réel indisponible : les données restent à jour au rechargement.
  }
}

/** Abonne un onglet aux événements d'un utilisateur ; renvoie le désabonnement. */
export function subscribe(
  userId: string,
  listener: (event: RealtimeEvent) => void,
): () => void {
  const h = hub();
  h.emitter.on(userId, listener);
  h.online.set(userId, (h.online.get(userId) ?? 0) + 1);
  void connectListener(h);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    h.emitter.off(userId, listener);
    const left = (h.online.get(userId) ?? 1) - 1;
    if (left > 0) h.online.set(userId, left);
    else h.online.delete(userId);
  };
}

/** L'utilisateur a-t-il un onglet ouvert (sur ce processus) ? */
export function isOnline(userId: string): boolean {
  return (hub().online.get(userId) ?? 0) > 0;
}
