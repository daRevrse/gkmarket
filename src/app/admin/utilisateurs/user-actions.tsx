"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserStatus } from "./actions";
import { Button } from "@/components/ui/button";

export function UserActions({
  userId,
  status,
  isAdmin,
}: {
  userId: string;
  status: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmBan, setConfirmBan] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAdmin || status === "deleted") return null;

  async function run(next: "active" | "suspended" | "banned") {
    setError(null);
    setLoading(true);
    const result = await setUserStatus(userId, next);
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setConfirmBan(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        {status === "active" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => run("suspended")}
          >
            Suspendre
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => run("active")}
          >
            Réactiver
          </Button>
        )}
        {status !== "banned" ? (
          confirmBan ? (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => run("banned")}
              >
                Confirmer le bannissement
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmBan(false)}
              >
                Annuler
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="danger"
              disabled={loading}
              onClick={() => setConfirmBan(true)}
            >
              Bannir
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}
