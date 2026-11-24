# PLAN.md - ctrl.app

Un lot à la fois. Cocher quand le lot est fait et commité ; Axel valide au fil de l’eau, le plan peut évoluer avec lui.

## Lot 0 - Socle
- [x] Projet Vite + React + TypeScript + Tailwind + React Router + Zustand + Dexie
- [x] Police Satoshi auto-hébergée
- [x] Tokens de couleurs, typo, rayons, espacements (sombre + clair)
- [x] Types du modèle de données (`src/types`) : Utilisateur, Profil, Parcours, Étape, Morceau, Version, Note, Projet, Tâche, Sortie, Contact, Envoi, Modèle de mail, Board, Bloc, Lien (+ Fichier, Post réseau, Connexion)
- [x] Interfaces des repositories + implémentation IndexedDB
- [x] Interfaces des intégrations + adaptateurs simulés
- [x] Coquille de l'app : barre latérale, routes vides, bascule de thème
- [x] Logo (chevron ⌃ + « ctrl.app ») en SVG
- [x] Icônes Lucide personnalisables, mise en ligne GitHub Pages, nettoyage de l’ancien service worker

## Lot 1 - Onboarding et parcours
- [x] Questionnaire en 4 étapes
- [x] Règles de génération du niveau et du parcours (cas A / cas B)
- [x] Fichier de contenu des étapes (`src/content/parcours.ts`)
- [x] Redirection vers l'onboarding si aucun profil
- [x] Écran de résultat et écran Parcours (explication, action, valider l’étape, niveau)

## Lot 2 - Musique
- [x] Catalogue + filtres par statut
- [x] Création et édition d'un morceau
- [x] Fiche morceau : versions audio (import, lecture, version validée), notes, infos, cover
- [x] Projets (EP, tracklists)

## Lot 3 - Accueil
- [x] Bloc parcours (étape en cours, action suivante)
- [x] Cette semaine (tâches)
- [x] En cours (morceaux)
- [x] Stats (états vides et connexion simulée)

## Lot 4 - Sorties
- [x] Calendrier
- [x] Checklist de sortie adaptée au niveau
- [x] Métadonnées
- [x] Écran Distribution « bientôt »

## Lot 5 - Réseau (CRM)
- [x] Contacts
- [x] Modèles de mails selon le profil
- [x] Envoi simulé + historique
- [x] Suivi (envoyé, ouvert, relance) + relance en tâche

## Lot 6 - Boards
- [x] Analyse du prototype `axelduvernay/ctrl.mind` et proposition de reprise (voir `BOARDS-ANALYSE.md`)
- [x] Canvas infini, grille de points, zoom
- [x] Blocs : note, tâche, tracklist, zone + liens
- [x] Nœuds liés aux morceaux, contacts et tâches

- [x] Tout le board du prototype ctrl.mind (texte riche, commandes /, catégories, échéance et rappel, images, dessin, tableaux, dossiers, variantes, zone « Fait », lasso, aimant, sous-zones, annuler / rétablir, recherche, filtres, raccourcis) : voir `BOARDS-ANALYSE.md`

## Lot 7 - Transverse
- [x] Bouton Capturer : mémo vocal, note, tâche
- [x] Recherche globale ⌘K

## Lot 8 - Réglages
- [x] Profil et niveau (refaire le questionnaire)
- [x] Comptes connectés (simulés)
- [x] Mode d'affichage
- [x] Export / import des données
- [x] Réinitialiser l'app

## Lot 9 - Comptes et synchronisation (Supabase)
- [ ] Projet Supabase dédié (séparé de ctrl.mind), schéma et règles d’accès
- [ ] Implémentation `src/data/remote` des repositories
- [ ] Étape « Garde ta progression » à la fin de l’onboarding : mail + code à 6 chiffres, « Continuer sans compte »
- [ ] Compte dans Réglages : se connecter, se déconnecter, état de la synchro
- [ ] Fichiers audio et covers dans le stockage Supabase

## Lot 10 - Prêt pour le stand
- [x] Parcours complet testé de l'onboarding à une sortie planifiée
- [ ] Vérification DA sur tous les écrans (sombre et clair) : contrôlée par Claude, à valider par Axel
- [x] États vides partout
- [x] Mode plein écran, performance, aucune erreur console
- [ ] Build de production qui tourne hors ligne
