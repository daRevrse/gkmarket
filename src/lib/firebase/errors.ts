import { FirebaseError } from "firebase/app";

/** Traduit les codes d'erreur Firebase Auth en messages français. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "Un compte existe déjà avec cet email.";
      case "auth/invalid-email":
        return "Adresse email invalide.";
      case "auth/weak-password":
        return "Le mot de passe doit contenir au moins 6 caractères.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email ou mot de passe incorrect.";
      case "auth/too-many-requests":
        return "Trop de tentatives. Réessayez dans quelques minutes.";
      case "auth/network-request-failed":
        return "Problème de connexion réseau. Vérifiez votre connexion.";
      case "auth/invalid-phone-number":
        return "Numéro de téléphone invalide.";
      case "auth/invalid-verification-code":
        return "Code de vérification incorrect.";
      case "auth/code-expired":
        return "Le code a expiré. Demandez-en un nouveau.";
      case "auth/account-exists-with-different-credential":
      case "auth/credential-already-in-use":
      case "auth/provider-already-linked":
        return "Un compte existe déjà avec ce numéro.";
    }
  }
  return "Une erreur est survenue. Réessayez.";
}
