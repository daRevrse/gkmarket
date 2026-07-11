import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

/** Fil de messages en bulles : les miens à droite (or), l'autre à gauche. */
export function MessageThread({
  messages,
  meId,
}: {
  messages: ThreadMessage[];
  meId: string;
}) {
  if (messages.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">
        Démarrez la conversation : présentez-vous et posez votre question.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      {messages.map((message) => {
        const mine = message.senderId === meId;
        return (
          <div
            key={message.id}
            className={cn("flex", mine ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5",
                mine
                  ? "rounded-br-sm bg-gold/15 text-ink"
                  : "rounded-bl-sm border border-white/[0.08] bg-white/[0.04]",
              )}
            >
              <p className="text-sm break-words whitespace-pre-line">
                {message.body}
              </p>
              <p
                className={cn(
                  "mt-1 font-label text-[10px] text-ink-muted",
                  mine ? "text-right" : "",
                )}
              >
                {message.createdAt.toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
