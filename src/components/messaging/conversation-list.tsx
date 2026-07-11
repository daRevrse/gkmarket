import Link from "next/link";
import { Card } from "@/components/ui/card";

export type ConversationRow = {
  id: string;
  /** Nom affiché de l'interlocuteur (boutique ou acheteur). */
  title: string;
  lastBody: string | null;
  lastAt: Date;
  unread: number;
};

/** Liste des conversations, la plus récente en premier. */
export function ConversationList({
  rows,
  basePath,
  emptyHint,
}: {
  rows: ConversationRow[];
  basePath: string;
  emptyHint: string;
}) {
  if (rows.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-ink-muted">{emptyHint}</p>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="flex flex-col divide-y divide-white/[0.04]">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`${basePath}/${row.id}`}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 font-display font-extrabold text-ink-muted">
              {row.title.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className={row.unread > 0 ? "font-bold" : "font-medium"}>
                {row.title}
              </p>
              <p
                className={`mt-0.5 truncate text-sm ${row.unread > 0 ? "text-ink" : "text-ink-muted"}`}
              >
                {row.lastBody ?? "Conversation ouverte"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-label text-xs text-ink-muted">
                {row.lastAt.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
              {row.unread > 0 ? (
                <span className="rounded-full bg-gold px-2 py-0.5 font-label text-[10px] font-bold text-navy-deep">
                  {row.unread}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
