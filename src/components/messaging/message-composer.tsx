"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ref, uploadBytesResumable } from "firebase/storage";
import { PaperClipIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import {
  sendAttachment,
  sendMessage,
  type AttachmentInput,
} from "@/app/compte/messages/actions";
import { VoiceRecorder } from "@/components/messaging/voice-recorder";
import { Button } from "@/components/ui/button";
import { auth, storage } from "@/lib/firebase/client";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPING_PING_MS = 3000;

/** Utilisateur Firebase du navigateur (attend l'initialisation de l'auth). */
function firebaseUser(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

function extensionFor(type: string) {
  if (type.includes("webm")) return "webm";
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "audio";
}

/**
 * Saisie d'un message : texte, pièce jointe (photo, PDF) et message vocal.
 * Les fichiers sont déposés dans le dossier Storage privé de l'utilisateur,
 * puis rattachés au message par le serveur.
 */
export function MessageComposer({
  conversationId,
  initialBody = "",
}: {
  conversationId: string;
  /** Sujet prérempli (ex. depuis une commande). */
  initialBody?: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTypingPing = useRef(0);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  function showError(message: string, isBlock = false) {
    setError(message);
    setBlocked(isBlock);
  }

  function pingTyping() {
    const now = Date.now();
    if (now - lastTypingPing.current < TYPING_PING_MS) return;
    lastTypingPing.current = now;
    fetch("/api/realtime/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {});
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);
    const result = await sendMessage(conversationId, body);
    setLoading(false);
    if (result.error) {
      showError(result.error, result.blocked);
      return;
    }
    setBody("");
    router.refresh();
  }

  async function uploadAndSend(
    blob: Blob,
    fileName: string,
    kind: AttachmentInput["kind"],
    durationSec?: number,
  ) {
    setError(null);
    if (blob.size > MAX_BYTES) {
      showError("Fichier trop volumineux (10 Mo max).");
      return;
    }
    const user = await firebaseUser();
    if (!user) {
      showError("Session expirée : déconnectez-vous puis reconnectez-vous.");
      return;
    }

    setLoading(true);
    setProgress(0);
    try {
      const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
      const path = `chat/${user.uid}/${Date.now()}-${safeName}`;
      const task = uploadBytesResumable(ref(storage, path), blob, {
        contentType: blob.type,
      });
      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) =>
            setProgress(
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            ),
          reject,
          () => resolve(),
        );
      });
      const result = await sendAttachment(conversationId, {
        path,
        kind,
        name: fileName,
        durationSec,
      });
      if (result.error) showError(result.error);
      else router.refresh();
    } catch {
      showError("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type === "application/pdf") {
      void uploadAndSend(file, file.name, "file");
    } else if (/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      void uploadAndSend(file, file.name, "image");
    } else {
      showError("Format non accepté : photos (JPG, PNG, WebP) ou PDF.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {error ? (
        <div
          role="alert"
          className={
            blocked
              ? "flex gap-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              : "text-sm text-danger"
          }
        >
          {blocked ? (
            <ShieldExclamationIcon className="size-5 shrink-0" />
          ) : null}
          <p>{error}</p>
        </div>
      ) : null}
      {progress !== null ? (
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          Envoi {progress} %
        </div>
      ) : null}
      <div className="flex items-end gap-1 sm:gap-2">
        {!recording ? (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={loading}
              aria-label="Joindre une photo ou un PDF"
              title="Photo ou PDF"
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50 sm:size-11"
            >
              <PaperClipIcon className="size-5" />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={onFilePicked}
            />
          </>
        ) : null}
        <VoiceRecorder
          disabled={loading}
          onRecordingChange={setRecording}
          onRecorded={(audio, duration) =>
            void uploadAndSend(
              audio,
              `vocal.${extensionFor(audio.type)}`,
              "audio",
              duration,
            )
          }
          onError={(message) => showError(message)}
        />
        {!recording ? (
          <>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (blocked) setError(null);
                if (e.target.value.trim()) pingTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder="Écrivez votre message… (Entrée pour envoyer)"
              className="min-h-[52px] w-full min-w-0 flex-1 resize-y rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none sm:px-4"
            />
            <Button
              type="submit"
              loading={loading}
              disabled={!body.trim()}
              aria-label="Envoyer"
              className="px-3 sm:px-6"
            >
              {loading ? null : <PaperAirplaneIcon className="size-4 sm:hidden" />}
              <span className="hidden sm:inline">Envoyer</span>
            </Button>
          </>
        ) : null}
      </div>
    </form>
  );
}
