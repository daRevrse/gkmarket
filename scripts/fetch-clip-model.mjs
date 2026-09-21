// Télécharge l'encodeur visuel CLIP dans ./models pour qu'il soit embarqué
// dans l'image Docker : à l'exécution, la production n'appelle jamais
// l'extérieur (voir src/lib/image-embedding.ts).
import { env, AutoProcessor, CLIPVisionModelWithProjection } from "@huggingface/transformers";

const MODEL = "Xenova/clip-vit-base-patch32";
env.cacheDir = process.env.CLIP_MODEL_DIR ?? "./models";
env.allowRemoteModels = true;

console.log(`Téléchargement de ${MODEL} dans ${env.cacheDir}…`);
await AutoProcessor.from_pretrained(MODEL);
await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: "q8" });
console.log("Modèle prêt.");
