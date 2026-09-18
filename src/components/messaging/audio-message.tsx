"use client";

import { useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/solid";

function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Lecteur de message vocal. La durée vient du message (les enregistrements
 * WebM des navigateurs n'annoncent pas toujours la leur).
 */
export function AudioMessage({
  src,
  durationSec,
}: {
  src: string;
  durationSec: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  function toggle() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  }

  const progress = durationSec > 0 ? Math.min(1, position / durationSec) : 0;

  return (
    <div className="flex w-56 items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Écouter le message vocal"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald/20 text-emerald transition-colors hover:bg-emerald/30"
      >
        {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="font-label text-[10px] text-ink-muted">
          {playing || position > 0 ? clock(position) : clock(durationSec)}
        </span>
      </div>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      />
    </div>
  );
}
