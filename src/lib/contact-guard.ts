// Détection des coordonnées partagées pour contourner la plateforme
// (cf. docs/CHANGEMENTS.md §5) : numéros de téléphone, emails, liens externes
// et applications de messagerie. Le texte concerné est bloqué côté serveur.
//
// Module pur (sans dépendance serveur) : testable isolément.

export type ContactReason = "phone" | "email" | "link" | "app";

// Domaine de la plateforme : les liens vers Deal Lomé restent autorisés.
const ALLOWED_HOSTS = ["deallome.com", "localhost"];

const APP_RE =
  /\b(wh?ats?\s?app|what'?s\s?app|wh?ats?ap+|wats?ap+|ouat?sap+|wtsp|whtsp|t[eé]l[eé]gram+e?|viber|wechat|messenger)\b/i;

const EMAIL_RE =
  /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\barobase\b)\s*[a-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\bpoint\b)\s*[a-z0-9-]+)+/i;
const MAIL_PROVIDER_RE =
  /(@\s*|\b)(gmail|yahoo|hotmail|outlook|icloud|live)\s*(\.|\bpoint\b)\s*(com|fr)\b/i;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const DOMAIN_RE =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|tg|fr|me|io|co|app|shop|store|site|online|info|biz|link|ly|gl|gg)\b(?:\/[^\s<>"]*)?/gi;

// Suite de chiffres éventuellement séparés (espaces, points, tirets, /, ()).
const DIGIT_RUN_RE = /\+?\d[\d\s.\-\/()\u00a0]*\d/g;
// Montant ou quantité juste après : « 10 000 000 F », « 1000-2000 pièces ».
const AMOUNT_AFTER_RE =
  /^\s*(f\b|fcfa|cfa|francs?|xof|€|eur|euros?|\$|usd|pi[eè]ces?|pcs|unit[eé]s?|kg|g\b|l\b|ml|cm|m\b|cartons?|sacs?|%)/i;
const DATE_RE = /^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/;
const THOUSANDS_RE = /^\d{1,3}(?:[\s.\u00a0]\d{3})+$/;

const NUMBER_WORDS = new Set([
  "zero", "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept",
  "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze",
  "seize", "vingt", "vingts", "trente", "quarante", "cinquante", "soixante",
  "septante", "octante", "huitante", "nonante", "cent", "cents",
]);

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hostAllowed(match: string): boolean {
  const host = match
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

function hasPhoneNumber(text: string): boolean {
  // Lettres glissées entre les chiffres pour tromper le filtre : 9O -> 90.
  const normalized = text
    .replace(/(?<=\d[\s.\-]?)[oO](?=[\s.\-]?[\doO])/g, "0")
    .replace(/(?<=\d[\s.\-]?)[lI](?=[\s.\-]?\d)/g, "1");

  for (const match of normalized.matchAll(DIGIT_RUN_RE)) {
    const run = match[0].trim();
    const digits = run.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) continue;

    const international = run.startsWith("+") || run.startsWith("00");
    if (!international) {
      if (DATE_RE.test(run) || THOUSANDS_RE.test(run)) continue;
      const after = normalized.slice((match.index ?? 0) + match[0].length);
      if (AMOUNT_AFTER_RE.test(after)) continue;
      // Groupes de chiffres : un numéro s'écrit d'un bloc (90123456) ou en
      // petits groupes (90 12 34 56) ; « 10000-20000 » est une fourchette.
      const groups = run.split(/[^\d]+/).filter(Boolean);
      if (groups.length > 1 && groups.some((g) => g.length > 4)) continue;
    }
    return true;
  }

  // Numéro écrit en lettres : « neuf zéro douze trente-quatre… ».
  const tokens = stripAccents(text.toLowerCase()).split(/[^a-z0-9]+/);
  let streak = 0;
  for (const token of tokens) {
    if (!token || token === "et") continue;
    if (NUMBER_WORDS.has(token) || /^\d{1,2}$/.test(token)) {
      streak += 1;
      if (streak >= 6) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

/** Motifs de coordonnées trouvés dans le texte (vide si rien à bloquer). */
export function detectContactInfo(text: string): ContactReason[] {
  const reasons = new Set<ContactReason>();
  if (!text.trim()) return [];

  if (EMAIL_RE.test(text) || MAIL_PROVIDER_RE.test(text)) reasons.add("email");

  const links = [
    ...(text.match(URL_RE) ?? []),
    ...(text.match(DOMAIN_RE) ?? []),
  ];
  if (links.some((link) => !hostAllowed(link))) reasons.add("link");

  if (APP_RE.test(stripAccents(text))) reasons.add("app");
  if (hasPhoneNumber(text)) reasons.add("phone");

  return [...reasons];
}

export const CONTACT_REASON_LABELS: Record<ContactReason, string> = {
  phone: "numéro de téléphone",
  email: "adresse email",
  link: "lien externe",
  app: "autre messagerie",
};

/** Refus d'une fiche produit ou d'un texte de boutique/profil. */
export const CONTACT_BLOCKED_PUBLIC =
  "Les coordonnées (téléphone, email, liens externes, autres messageries) sont interdites dans les fiches, la boutique et le profil : les acheteurs vous contactent par la messagerie Deal Lomé. Cet incident a été signalé à la modération.";

/** Message affiché à l'auteur d'un texte bloqué. */
export const CONTACT_BLOCKED_MESSAGE =
  "Message bloqué : le partage de numéros, d'emails, de liens externes ou d'autres messageries est interdit sur Deal Lomé. Restez sur la plateforme, c'est votre protection en cas de litige. Cet incident a été signalé à la modération.";
