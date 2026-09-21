import "server-only";

import sharp from "sharp";

// Filigrane des médias téléchargés (docs/CHANGEMENTS.md §5, lot 6) : le
// téléchargement est réservé aux comptes connectés et l'image repart marquée
// « Deal Lomé ». Les photos affichées sur le site restent, elles, non
// marquées — le filigrane porte sur le fichier téléchargé.

/** Largeur maximale du fichier produit (les photos vendeur font ~1 à 3 Mpx). */
const MAX_WIDTH = 2000;

/** Texte répété en diagonale, discret mais lisible sur photo claire. */
const MARK = "Deal Lomé";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
        ? "&gt;"
        : c === "&"
          ? "&amp;"
          : c === "'"
            ? "&apos;"
            : "&quot;",
  );
}

const DOMAIN = "deallome.com";

/** Largeur moyenne d'un caractère Helvetica, en fraction de la taille. */
const CHAR_RATIO = 0.55;

/**
 * Calque SVG : une trame diagonale répétée plus une signature en bas de
 * l'image. Les tailles sont proportionnelles à l'image pour rester lisibles
 * aussi bien sur une vignette que sur une photo 2000 px.
 */
function overlaySvg(width: number, height: number, footer: string) {
  const tile = Math.max(120, Math.round(Math.min(width, height) / 3));
  const fontSize = Math.round(tile / 7);
  const footerSize = Math.max(12, Math.round(Math.min(width, height) / 28));
  const pad = Math.round(footerSize * 0.8);

  // Le libellé de gauche ne doit jamais chevaucher le domaine à droite.
  const available =
    width - 2 * pad - (DOMAIN.length + 2) * footerSize * CHAR_RATIO;
  const maxChars = Math.max(6, Math.floor(available / (footerSize * CHAR_RATIO)));
  const label =
    footer.length > maxChars ? `${footer.slice(0, maxChars - 1).trimEnd()}…` : footer;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="m" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <text x="0" y="${Math.round(tile / 2)}" font-family="Helvetica, Arial, sans-serif"
            font-size="${fontSize}" font-weight="bold" fill="#ffffff" fill-opacity="0.22">${MARK}</text>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#m)"/>
  <rect x="0" y="${height - footerSize * 2.2}" width="${width}" height="${footerSize * 2.2}" fill="#0b1727" fill-opacity="0.55"/>
  <text x="${pad}" y="${height - footerSize * 0.8}" font-family="Helvetica, Arial, sans-serif"
        font-size="${footerSize}" fill="#ffffff" fill-opacity="0.9">${escapeXml(label)}</text>
  <text x="${width - pad}" y="${height - footerSize * 0.8}" text-anchor="end"
        font-family="Helvetica, Arial, sans-serif" font-size="${footerSize}"
        font-weight="bold" fill="#e0b64a" fill-opacity="0.95">${DOMAIN}</text>
</svg>`,
  );
}

/**
 * Applique le filigrane à une image et renvoie un JPEG prêt au
 * téléchargement. `footer` est la mention portée en bas à gauche (titre du
 * produit, boutique).
 */
export async function watermarkImage(
  input: Buffer,
  footer: string,
): Promise<Buffer> {
  const image = sharp(input, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const resized =
    meta.width && meta.width > MAX_WIDTH ? image.resize({ width: MAX_WIDTH }) : image;

  // Dimensions après rotation EXIF et redimensionnement éventuel.
  const flat = await resized.jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const { width, height } = flat.info;

  return sharp(flat.data)
    .composite([{ input: overlaySvg(width, height, footer), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
