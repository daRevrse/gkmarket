"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationList({
  items,
  unreadCount,
}: {
  items: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function open(item: NotificationItem) {
    if (!item.read) await markNotificationRead(item.id);
    if (item.link) router.push(item.link);
    else router.refresh();
  }

  async function markAll() {
    setLoading(true);
    await markAllNotificationsRead();
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={markAll}
          className="self-end"
        >
          {loading ? "…" : "Tout marquer comme lu"}
        </Button>
      ) : null}

      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => open(item)}
          className={cn(
            "rounded-lg border px-4 py-3 text-left transition-colors hover:bg-white/[0.06]",
            item.read
              ? "border-white/[0.06] bg-white/[0.02]"
              : "border-emerald/30 bg-emerald/[0.06]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className={cn("text-sm", item.read ? "" : "font-semibold")}>
              {item.title}
            </p>
            {!item.read ? (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald" />
            ) : null}
          </div>
          {item.body ? (
            <p className="mt-1 text-sm text-ink-muted">{item.body}</p>
          ) : null}
          <p className="mt-1 text-xs text-ink-muted">{item.createdAt}</p>
        </button>
      ))}
    </div>
  );
}
