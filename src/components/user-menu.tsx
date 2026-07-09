"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  Squares2X2Icon,
  UserCircleIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

const ITEMS = [
  { href: "/compte", label: "Mon espace", Icon: Squares2X2Icon },
  { href: "/compte/commandes", label: "Mes commandes", Icon: ClipboardDocumentListIcon },
  { href: "/compte/wallet", label: "Mon wallet", Icon: WalletIcon },
  { href: "/compte/adresses", label: "Mes adresses", Icon: MapPinIcon },
  { href: "/compte/notifications", label: "Notifications", Icon: BellIcon },
];

/** Bouton compte : ouvre un menu déroulant « Mon espace ». */
export function UserMenu({ name }: { name?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(auth);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Mon compte"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex rounded-md p-2 text-emerald transition-colors hover:bg-emerald/10"
      >
        <UserCircleIcon className="size-6" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-navy-surface shadow-xl"
        >
          {name ? (
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="text-xs text-ink-muted">Connecté en tant que</p>
              <p className="truncate font-display font-bold">{name}</p>
            </div>
          ) : null}
          <nav className="py-1">
            {ITEMS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
              >
                <Icon className="size-5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/[0.06] py-1">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger/90 transition-colors hover:bg-danger/10"
            >
              <ArrowRightStartOnRectangleIcon className="size-5" />
              Se déconnecter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
