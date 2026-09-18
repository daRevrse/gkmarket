"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MicrophoneIcon } from "@heroicons/react/24/outline";
import { PaperAirplaneIcon, TrashIcon } from "@heroicons/react/24/solid";

const MAX_SECONDS = 180;
const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const noSubscription = () => () => {};
const recordingSupported = () =>
  typeof MediaRecorder !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Recording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  startedAt: number;
  send: boolean;
};

/**
 * Message vocal façon messagerie mobile : un appui démarre l'enregistrement,
 * « envoyer » l'arrête et l'envoie, la corbeille l'annule. 3 minutes max.
 */
export function VoiceRecorder({
  disabled,
  onRecordingChange,
  onRecorded,
  onError,
}: {
  disabled?: boolean;
  onRecordingChange: (recording: boolean) => void;
  onRecorded: (audio: Blob, durationSec: number) => void;
  onError: (message: string) => void;
}) {
  // Rendu serveur : pas de micro ; le navigateur révèle le bouton s'il sait enregistrer.
  const supported = useSyncExternalStore(
    noSubscription,
    recordingSupported,
    () => false,
  );
  const [elapsed, setElapsed] = useState<number | null>(null);
  const current = useRef<Recording | null>(null);

  useEffect(() => {
    return () => {
      current.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (elapsed === null) return;
    if (elapsed >= MAX_SECONDS) {
      stop(true);
      return;
    }
    const timer = setTimeout(() => setElapsed((s) => (s ?? 0) + 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MIME_TYPES.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      const recording: Recording = {
        recorder,
        stream,
        chunks: [],
        startedAt: Date.now(),
        send: false,
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recording.chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const duration = Math.round((Date.now() - recording.startedAt) / 1000);
        if (recording.send && duration >= 1) {
          const type = recorder.mimeType || mimeType || "audio/webm";
          onRecorded(new Blob(recording.chunks, { type }), duration);
        }
      };
      recorder.start(250);
      current.current = recording;
      setElapsed(0);
      onRecordingChange(true);
    } catch {
      onError(
        "Micro inaccessible : autorisez l'accès au micro dans votre navigateur.",
      );
    }
  }

  function stop(send: boolean) {
    const recording = current.current;
    current.current = null;
    setElapsed(null);
    onRecordingChange(false);
    if (!recording) return;
    recording.send = send;
    if (recording.recorder.state !== "inactive") recording.recorder.stop();
  }

  if (!supported) return null;

  if (elapsed === null) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label="Enregistrer un message vocal"
        title="Message vocal"
        className="flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50 sm:size-11"
      >
        <MicrophoneIcon className="size-5" />
      </button>
    );
  }

  return (
    <div className="flex min-h-[52px] flex-1 items-center gap-3 rounded-md border border-danger/40 bg-danger/5 px-3">
      <button
        type="button"
        onClick={() => stop(false)}
        aria-label="Annuler l'enregistrement"
        className="text-ink-muted hover:text-danger"
      >
        <TrashIcon className="size-5" />
      </button>
      <span className="size-2.5 animate-pulse rounded-full bg-danger" />
      <span className="flex-1 font-label text-sm">
        {clock(elapsed)}{" "}
        <span className="text-ink-muted">/ {clock(MAX_SECONDS)}</span>
      </span>
      <button
        type="button"
        onClick={() => stop(true)}
        aria-label="Envoyer le message vocal"
        className="flex size-9 items-center justify-center rounded-full bg-gold text-navy-deep hover:bg-gold-light"
      >
        <PaperAirplaneIcon className="size-4" />
      </button>
    </div>
  );
}
