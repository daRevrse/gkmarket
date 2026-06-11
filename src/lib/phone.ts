// Domaine interne pour l'identifiant email dérivé du téléphone.
// Permet la « connexion téléphone + mot de passe » (exigence MVP) avec Firebase :
// l'OTP SMS ne sert qu'une fois, à l'inscription, pour vérifier le numéro.
export const PHONE_ALIAS_DOMAIN = "tel.gkmarket.app";

/**
 * Normalise un numéro togolais vers le format E.164 (+228XXXXXXXX).
 * Retourne null si le numéro est invalide.
 */
export function normalizeTogoPhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, "");
  if (/^\+228\d{8}$/.test(digits)) return digits;
  if (/^00228\d{8}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^228\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\d{8}$/.test(digits)) return `+228${digits}`;
  return null;
}

/** Identifiant interne (jamais montré à l'utilisateur) pour le couple téléphone/mot de passe. */
export function phoneAliasEmail(e164Phone: string): string {
  return `${e164Phone.replace("+", "")}@${PHONE_ALIAS_DOMAIN}`;
}

export function isPhoneAliasEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${PHONE_ALIAS_DOMAIN}`);
}
