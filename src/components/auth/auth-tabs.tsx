"use client";

import { cn } from "@/lib/utils";

export type AuthMethod = "email" | "phone";

export function AuthTabs({
  value,
  onChange,
}: {
  value: AuthMethod;
  onChange: (method: AuthMethod) => void;
}) {
  const tabs: { id: AuthMethod; label: string }[] = [
    { id: "email", label: "Email" },
    { id: "phone", label: "Téléphone" },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-white/5 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-sm px-4 py-2 font-label text-sm font-semibold transition-colors",
            value === tab.id
              ? "bg-gold text-navy-deep"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
