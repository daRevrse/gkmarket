"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Gallery({
  images,
  title,
}: {
  images: { url: string }[];
  title: string;
}) {
  const [current, setCurrent] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-lg border border-white/[0.06] bg-white/5">
        {images[current] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[current].url}
            alt={`${title} - photo ${current + 1}`}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setCurrent(index)}
              className={cn(
                "h-16 w-16 overflow-hidden rounded-md border transition-colors",
                index === current
                  ? "border-gold"
                  : "border-white/10 hover:border-white/30",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
