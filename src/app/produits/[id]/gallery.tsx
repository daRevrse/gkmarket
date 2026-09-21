"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownTrayIcon, PlayIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

export function Gallery({
  images,
  video,
  title,
  productId,
  productPath,
  isLoggedIn,
}: {
  images: { url: string }[];
  /** Vidéo de présentation du produit (lot 6), toujours en tête. */
  video: string | null;
  title: string;
  productId: string;
  /** Chemin de la fiche, pour revenir après connexion. */
  productPath: string;
  isLoggedIn: boolean;
}) {
  const slides = [
    ...(video ? [{ kind: "video" as const, url: video }] : []),
    ...images.map((image) => ({ kind: "image" as const, url: image.url })),
  ];
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const poster = images[0]?.url;

  // Le rang de la photo côté serveur ignore la vidéo.
  const download =
    slide?.kind === "video"
      ? `/api/medias/${productId}?video=1`
      : `/api/medias/${productId}?i=${video ? current - 1 : current}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-lg border border-white/[0.06] bg-white/5">
        {slide?.kind === "video" ? (
          <video
            key={slide.url}
            src={slide.url}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black object-contain"
          />
        ) : slide ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.url}
            alt={`${title} - photo ${video ? current : current + 1}`}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {slides.map((item, index) => (
            <button
              key={`${item.kind}-${item.url}`}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={
                item.kind === "video"
                  ? "Vidéo du produit"
                  : `Photo ${video ? index : index + 1}`
              }
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-md border transition-colors",
                index === current
                  ? "border-gold"
                  : "border-white/10 hover:border-white/30",
              )}
            >
              {item.kind === "video" ? (
                <>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt=""
                      className="h-full w-full object-cover opacity-60"
                    />
                  ) : (
                    <span className="block h-full w-full bg-black" />
                  )}
                  <PlayIcon className="absolute inset-0 m-auto size-6 text-white drop-shadow" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : null}

      {slide ? (
        isLoggedIn ? (
          <a
            href={download}
            className="inline-flex items-center gap-2 self-start font-label text-sm text-emerald hover:underline"
          >
            <ArrowDownTrayIcon className="size-4" />
            {slide.kind === "video" ? "Télécharger la vidéo" : "Télécharger la photo"}
          </a>
        ) : (
          <Link
            href={`/connexion?next=${encodeURIComponent(productPath)}`}
            className="inline-flex items-center gap-2 self-start font-label text-sm text-ink-muted hover:text-emerald"
          >
            <ArrowDownTrayIcon className="size-4" />
            Connectez-vous pour télécharger les médias
          </Link>
        )
      ) : null}
      {isLoggedIn && slide?.kind === "image" ? (
        <p className="text-xs text-ink-muted">
          Les photos téléchargées portent le filigrane Deal Lomé.
        </p>
      ) : null}
    </div>
  );
}
