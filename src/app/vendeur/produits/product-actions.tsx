"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct, setProductStatus } from "./actions";
import { Button } from "@/components/ui/button";

export function ProductActions({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: () => Promise<{ error?: string }>) {
    setLoading(true);
    const result = await action();
    setLoading(false);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "published" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => run(() => setProductStatus(productId, "draft"))}
        >
          Dépublier
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={loading}
          onClick={() => run(() => setProductStatus(productId, "published"))}
        >
          Publier
        </Button>
      )}
      {confirmDelete ? (
        <>
          <Button
            size="sm"
            variant="danger"
            disabled={loading}
            onClick={() => run(() => deleteProduct(productId))}
          >
            Confirmer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(false)}
          >
            Annuler
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="danger"
          disabled={loading}
          onClick={() => setConfirmDelete(true)}
        >
          Supprimer
        </Button>
      )}
    </div>
  );
}
