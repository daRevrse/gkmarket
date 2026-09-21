import "server-only";

import path from "node:path";
import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  env,
  RawImage,
  type Processor,
} from "@huggingface/transformers";

// Recherche par image (docs/CHANGEMENTS.md §5, lot 7) : encodeur visuel CLIP
// exécuté sur notre VPS, sans service tiers. Le modèle quantifié (~86 Mo)
// est embarqué dans l'image Docker par scripts/fetch-clip-model.mjs ; en
// développement, il est téléchargé au premier usage dans ./models.

export const CLIP_MODEL = "Xenova/clip-vit-base-patch32";
/** Dimension des vecteurs produits par le modèle. */
export const EMBEDDING_DIM = 512;

env.cacheDir = process.env.CLIP_MODEL_DIR ?? path.join(process.cwd(), "models");
// En production le modèle est déjà là : ne jamais appeler l'extérieur.
env.allowRemoteModels = process.env.NODE_ENV !== "production";

type Engine = {
  processor: Processor;
  vision: CLIPVisionModelWithProjection;
};

// Le modèle pèse quelques centaines de Mo en mémoire : une seule instance
// par processus, partagée entre les requêtes (et conservée à travers les
// rechargements à chaud du serveur de développement).
const globalForClip = globalThis as unknown as { clipEngine?: Promise<Engine> };

function engine(): Promise<Engine> {
  globalForClip.clipEngine ??= (async () => {
    const [processor, vision] = await Promise.all([
      AutoProcessor.from_pretrained(CLIP_MODEL),
      CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "q8" }),
    ]);
    return { processor, vision };
  })().catch((error) => {
    // Un échec ne doit pas figer le moteur : la prochaine tentative réessaie.
    globalForClip.clipEngine = undefined;
    throw error;
  });
  return globalForClip.clipEngine;
}

/** Vrai si le modèle est déjà chargé (évite d'attendre au premier rendu). */
export function isEngineLoaded() {
  return globalForClip.clipEngine !== undefined;
}

/**
 * Vecteur visuel d'une image, normalisé (norme 1) : le produit scalaire de
 * deux vecteurs vaut alors leur cosinus de similarité.
 */
export async function embedImage(input: Buffer): Promise<number[]> {
  const { processor, vision } = await engine();
  // RawImage décode le fichier ; le processor se charge du recadrage et de
  // la normalisation attendus par CLIP.
  const image = await RawImage.fromBlob(new Blob([new Uint8Array(input)]));
  const inputs = await processor(image);
  const { image_embeds } = await vision(inputs);
  const values = Array.from(image_embeds.data as Float32Array, Number);

  let norm = 0;
  for (const value of values) norm += value * value;
  norm = Math.sqrt(norm);
  return norm > 0 ? values.map((value) => value / norm) : values;
}

/** Produit scalaire, côté application (mêmes conventions que `dot_product`). */
export function similarity(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) total += a[i] * b[i];
  return total;
}
