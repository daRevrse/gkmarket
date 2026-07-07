import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { NotificationList, type NotificationItem } from "./notification-list";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const items: NotificationItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    link: row.link,
    read: row.readAt !== null,
    createdAt: row.createdAt.toLocaleString("fr-FR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Mon compte
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Notifications
        </h1>
        <p className="mt-1 text-ink-muted">
          {unreadCount > 0
            ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}.`
            : "Vous êtes à jour."}
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Aucune notification pour le moment — elles arriveront avec vos
            commandes, courses et litiges.
          </p>
        </Card>
      ) : (
        <NotificationList items={items} unreadCount={unreadCount} />
      )}
    </main>
  );
}
