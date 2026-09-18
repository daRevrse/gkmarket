"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { addSynonymGroup, deleteSynonymGroup } from "./actions";
import { Button } from "@/components/ui/button";

/** Liste et édition des groupes de synonymes de recherche. */
export function SynonymManager({
  groups,
}: {
  groups: { id: string; terms: string[] }[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<{ error?: string }>) {
    setBusy(key);
    setError(null);
    const result = await action();
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await run("add", () => addSynonymGroup(input))) setInput("");
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex. : pagne, wax, tissu"
          aria-label="Termes équivalents, séparés par des virgules"
          className="min-w-64 flex-1 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
        />
        <Button type="submit" size="sm" loading={busy === "add"} disabled={!input.trim()}>
          Ajouter le groupe
        </Button>
      </form>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {groups.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun synonyme défini.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/[0.06] px-4 py-2"
            >
              <span className="flex flex-wrap gap-1.5">
                {group.terms.map((term) => (
                  <span
                    key={term}
                    className="rounded-full bg-white/5 px-2.5 py-0.5 font-label text-xs"
                  >
                    {term}
                  </span>
                ))}
              </span>
              <button
                type="button"
                onClick={() => run(group.id, () => deleteSynonymGroup(group.id))}
                disabled={busy === group.id}
                aria-label={`Supprimer le groupe ${group.terms.join(", ")}`}
                className="text-ink-muted hover:text-danger disabled:opacity-50"
              >
                <XMarkIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
