import Link from "next/link";
import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  productImages,
  productReports,
  products,
  sellerProfiles,
  users,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatFcfa } from "@/lib/format";
import { productReportReasonLabels } from "@/lib/product-reports";
import { productPath } from "@/lib/product-url";
import { ProductModeration } from "./product-moderation";
import { ReportActions } from "./report-actions";

const statusLabel: Record<
  string,
  { label: string; variant?: "verified" | "wholesale" | "neutral" }
> = {
  published: { label: "Publié", variant: "verified" },
  draft: { label: "Brouillon", variant: "neutral" },
  archived: { label: "Archivé", variant: "neutral" },
};

export default async function AdminProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;

  const filters: SQL[] = [];
  if (params.q?.trim()) {
    filters.push(ilike(products.title, `%${params.q.trim()}%`));
  }
  if (params.statut && ["published", "draft", "archived"].includes(params.statut)) {
    filters.push(
      eq(products.status, params.statut as "published" | "draft" | "archived"),
    );
  }

  const [rows, reports] = await Promise.all([
    db
      .select({
        product: products,
        shopName: sellerProfiles.shopName,
        sellerStatus: sellerProfiles.status,
        imageUrl: productImages.url,
      })
      .from(products)
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, products.id),
          eq(productImages.position, 0),
        ),
      )
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(products.createdAt))
      .limit(100),
    // Signalements à examiner (MVP n°275)
    db
      .select({
        report: productReports,
        productTitle: products.title,
        productStatus: products.status,
        shopName: sellerProfiles.shopName,
        reporterName: users.fullName,
      })
      .from(productReports)
      .innerJoin(products, eq(products.id, productReports.productId))
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
      .innerJoin(users, eq(users.id, productReports.reporterId))
      .where(eq(productReports.status, "open"))
      .orderBy(desc(productReports.createdAt)),
  ]);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Produits</h1>
        <p className="mt-1 text-ink-muted">
          Modération du catalogue : retirez les produits non conformes
          (le vendeur peut corriger et republier).
        </p>
      </div>

      {reports.length > 0 ? (
        <Card className="mb-6 border-gold/30">
          <h2 className="font-display text-lg font-bold">
            Signalements à examiner ({reports.length})
          </h2>
          <div className="mt-3 flex flex-col divide-y divide-white/[0.04]">
            {reports.map((row) => (
              <div
                key={row.report.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={productPath({
                        id: row.report.productId,
                        title: row.productTitle,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium hover:text-emerald"
                    >
                      {row.productTitle}
                    </Link>
                    <Badge variant="neutral">
                      {productReportReasonLabels[row.report.reason] ??
                        row.report.reason}
                    </Badge>
                    {row.productStatus !== "published" ? (
                      <Badge variant="neutral">Déjà hors ligne</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {row.shopName} · signalé par {row.reporterName ?? "un utilisateur"}{" "}
                    le {row.report.createdAt.toLocaleDateString("fr-FR")}
                    {row.report.details ? ` : « ${row.report.details} »` : ""}
                  </p>
                </div>
                <ReportActions reportId={row.report.id} />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <form action="/admin/produits" className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Titre du produit…"
          className="w-64 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none"
        />
        <select
          name="statut"
          defaultValue={params.statut ?? ""}
          className="rounded-md border border-white/10 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="published">Publiés</option>
          <option value="draft">Brouillons</option>
          <option value="archived">Archivés</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy-deep hover:bg-gold-light"
        >
          Rechercher
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-ink-muted">Aucun produit trouvé.</p>
        ) : (
          rows.map(({ product, shopName, sellerStatus, imageUrl }) => {
            const status = statusLabel[product.status] ?? {
              label: product.status,
            };
            return (
              <Card key={product.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="h-12 w-12 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-md bg-white/5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{product.title}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {sellerStatus === "suspended" ? (
                          <Badge variant="wholesale">Boutique suspendue</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {shopName} · {formatFcfa(product.priceFcfa)} · stock{" "}
                        {product.stock} · ajouté le{" "}
                        {product.createdAt.toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <ProductModeration
                    productId={product.id}
                    status={product.status}
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
