"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export type HeroBanner = {
  href: string;
  image: string;
  kicker: string;
  title: string;
  subtitle: string;
  cta: string;
};

const AUTO_ADVANCE_MS = 5000;

/** Carrousel de bannières produits du héro — image pleine largeur, texte lisible sur voile sombre. */
export function HeroSlider({ banners }: { banners: HeroBanner[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const timer = setInterval(
      () => setCurrent((c) => (c + 1) % banners.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(timer);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  return (
    <section
      className="relative h-[320px] overflow-hidden rounded-xl border border-white/[0.06] md:h-[420px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrousel"
    >
      {banners.map((banner, index) => (
        <Link
          key={banner.href + index}
          href={banner.href}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            index === current
              ? "z-10 opacity-100"
              : "pointer-events-none z-0 opacity-0",
          )}
          aria-hidden={index !== current}
          tabIndex={index === current ? 0 : -1}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.image}
            alt=""
            className="h-full w-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/90 via-navy-deep/55 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center gap-3 p-8 md:p-14">
            <p className="font-label text-xs font-semibold tracking-widest text-emerald uppercase">
              {banner.kicker}
            </p>
            <h2 className="max-w-md font-display text-2xl font-extrabold leading-tight md:text-4xl">
              {banner.title}
            </h2>
            <p className="max-w-sm text-sm text-ink-muted md:text-base">
              {banner.subtitle}
            </p>
            <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-md bg-gold px-6 py-3 font-label text-sm font-bold text-navy-deep">
              {banner.cta}
              <ChevronRightIcon className="size-4" />
            </span>
          </div>
        </Link>
      ))}

      {banners.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Bannière précédente"
            onClick={() =>
              setCurrent((c) => (c - 1 + banners.length) % banners.length)
            }
            className="absolute top-1/2 left-3 z-20 hidden -translate-y-1/2 rounded-full bg-navy-deep/60 p-2 text-ink backdrop-blur transition-colors hover:bg-navy-deep md:block"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Bannière suivante"
            onClick={() => setCurrent((c) => (c + 1) % banners.length)}
            className="absolute top-1/2 right-3 z-20 hidden -translate-y-1/2 rounded-full bg-navy-deep/60 p-2 text-ink backdrop-blur transition-colors hover:bg-navy-deep md:block"
          >
            <ChevronRightIcon className="size-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Bannière ${index + 1}`}
                onClick={() => setCurrent(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === current
                    ? "w-6 bg-gold"
                    : "w-1.5 bg-white/30 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
