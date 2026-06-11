# Changements par rapport aux documents initiaux

Ce document consigne les changements décidés par rapport au cahier des charges
(`CAHIER DES CHARGES PLATEFORME.pdf`) et à l'explosion des fonctionnalités
(`Explosion du projet.xlsx`). Il fait foi en cas de divergence avec ces documents.

---

## 1. Le livreur devient un compte à part entière (2026-06-10)

**Avant (documents initiaux) :**
- Le « Livreur » est cité comme type d'utilisateur dans le cahier des charges, mais sans aucun module dédié.
- La livraison MVP repose sur des **agences partenaires** (Excel MVP n°167-169 : liste agences, sélection agence par vendeur, calcul tarifs par agence) ; la Phase 2 ajoute l'API d'intégration agence, la génération de bordereaux et le tracking automatique.
- Le livreur n'apparaît que comme métadonnée des preuves de livraison (nom, photo, signature).

**Après (changement décidé) :**
- Le **livreur est un compte à part entière** dès le MVP : inscription, vérification, profil, dashboard.
- Les **vendeurs font appel aux livreurs** pour effectuer les livraisons (demande / attribution de course par commande).
- Le livreur gère ses courses : acceptation, mise à jour des statuts de livraison, upload des preuves (photo, signature, date/heure).
- La **livraison via agence de livraison est reportée à une phase ultérieure** (les items agences sortent du MVP).

**Impact sur les modules :**
- Module 1 (Utilisateurs) : ajout inscription/connexion/profil livreur.
- Nouveau périmètre : dashboard livreur, gestion des courses, gains/rémunération livreur.
- Module 8 (Livraison) : items « Agences » (MVP n°167-169) et automatisations agence de Phase 2 → reportés.

**Précisions (2026-06-10) :**
- **Attribution des courses :** une **proposition intelligente de livreurs** est faite au vendeur (matching automatique — critères à définir : proximité, disponibilité, note, historique). Le vendeur choisit parmi les livreurs proposés.
- **Paiement du livreur :** le livreur est **payé par le vendeur**, via le **Wallet** et le **système Escrow** (mêmes mécanismes que le reste de la plateforme). Le livreur dispose donc d'un Wallet livreur.
- **Refus de course :** le livreur **peut refuser une course**. Le flux doit prévoir la re-proposition à un autre livreur.
- **Responsabilité en cas d'incident** (colis perdu/endommagé, vendeur vs livreur) : **en cours d'analyse** — à trancher avant l'implémentation du module litiges/livraison.
