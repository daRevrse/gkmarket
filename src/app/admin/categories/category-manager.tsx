"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCategory, deleteCategory, renameCategory } from "./actions";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  children: { id: string; name: string; slug: string; productCount: number }[];
};

function CategoryRow({
  id,
  name,
  slug,
  productCount,
  isChild,
  onDone,
  onError,
}: {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  isChild?: boolean;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<{ error?: string }>) {
    onError("");
    setLoading(true);
    const result = await action();
    setLoading(false);
    if (result.error) onError(result.error);
    else {
      setEditing(false);
      onDone();
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 py-2 ${isChild ? "pl-6" : ""}`}
    >
      {editing ? (
        <>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="max-w-60"
          />
          <Button
            size="sm"
            loading={loading}
            onClick={() => run(() => renameCategory(id, value))}
          >
            Enregistrer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setValue(name);
              setEditing(false);
            }}
          >
            Annuler
          </Button>
        </>
      ) : (
        <>
          <span className={isChild ? "text-sm" : "font-display font-bold"}>
            {name}
          </span>
          <span className="font-label text-xs text-ink-muted">
            /{slug} · {productCount} produit{productCount > 1 ? "s" : ""}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="font-label text-xs text-emerald hover:underline"
              onClick={() => setEditing(true)}
            >
              Renommer
            </button>
            <button
              type="button"
              disabled={loading}
              className="font-label text-xs text-danger/80 hover:text-danger disabled:opacity-50"
              onClick={() => run(() => deleteCategory(id))}
            >
              Supprimer
            </button>
          </span>
        </>
      )}
    </div>
  );
}

function AddCategoryForm({
  parentId,
  placeholder,
  onDone,
  onError,
}: {
  parentId: string | null;
  placeholder: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    onError("");
    setLoading(true);
    const result = await createCategory(name, parentId);
    setLoading(false);
    if (result.error) onError(result.error);
    else {
      setName("");
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        required
        className="max-w-60"
      />
      <Button size="sm" variant="secondary" loading={loading} type="submit">
        Ajouter
      </Button>
    </form>
  );
}

export function CategoryManager({ tree }: { tree: CategoryNode[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error || null} />

      {tree.map((root) => (
        <Card key={root.id} className="p-4">
          <CategoryRow
            {...root}
            onDone={refresh}
            onError={setError}
          />
          <div className="mt-1 flex flex-col divide-y divide-white/[0.04] border-t border-white/[0.06]">
            {root.children.map((child) => (
              <CategoryRow
                key={child.id}
                {...child}
                isChild
                onDone={refresh}
                onError={setError}
              />
            ))}
            <div className="pt-3 pl-6">
              <AddCategoryForm
                parentId={root.id}
                placeholder="Nouvelle sous-catégorie…"
                onDone={refresh}
                onError={setError}
              />
            </div>
          </div>
        </Card>
      ))}

      <Card className="p-4">
        <p className="mb-3 font-display font-bold">Nouvelle catégorie racine</p>
        <AddCategoryForm
          parentId={null}
          placeholder="Ex. Électroménager"
          onDone={refresh}
          onError={setError}
        />
      </Card>
    </div>
  );
}
