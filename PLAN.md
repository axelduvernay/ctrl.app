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
- [x] Bouton Capturer : mémo vocal, note, tâche (devenu le bouton + au lot 11)
- [x] Recherche globale ⌘K

## Lot 8 - Réglages
- [x] Profil et niveau (refaire le questionnaire)
- [x] Comptes connectés (simulés)
- [x] Mode d'affichage
- [x] Export / import des données
- [x] Réinitialiser l'app

## Lot 9 - Comptes et synchronisation (Supabase)
- [x] Projet Supabase dédié (séparé de ctrl.mind), schéma et règles d’accès (`supabase/schema.sql`, à lancer par Axel)
- [x] Synchronisation « local d’abord » dans `src/data/remote` (journal des changements, envoi, réception, la modification la plus récente gagne)
- [x] Étape « Garde ta progression » à la fin de l’onboarding : mail + code à 6 chiffres, « Continuer sans compte »
- [x] Compte dans Réglages : se connecter, se déconnecter, état de la synchro
- [x] Fichiers audio et covers dans le stockage Supabase

## Lot 10 - Prêt pour le stand
- [x] Parcours complet testé de l'onboarding à une sortie planifiée
- [ ] Vérification DA sur tous les écrans (sombre et clair) : contrôlée par Claude, à valider par Axel
- [x] États vides partout
- [x] Mode plein écran, performance, aucune erreur console
- [ ] Build de production qui tourne hors ligne

## Lot 11 - Simplifier (retours d’Axel du 25 novembre)
- [x] Musique = une librairie : dossiers, projets, singles ; un seul « + Ajouter » (single, projet, dossier) ; fin de Catalogue / Projets / Captures
- [x] Analyse à l’import : forme d’onde, BPM, tonalité (sans dépendance, dans un worker)
- [x] Formes d’onde et barre de lecture en bas de l’écran
- [x] Fiche morceau épurée : son + versions, notes à droite, « Détails » (cover, paroles, BPM, tonalité), statut en menu discret ; « C’est le son que je sors » retiré (choix du son déplacé sur l’Accueil)
- [x] Bouton + partout : tâche, événement, contact, note, morceau, mémo vocal ; événements dans le calendrier
- [x] Boards : un board ouvert d’office ; une tracklist du board = un projet de la librairie
- [x] Bouton retour à côté du fil d’Ariane
- [x] Numéro de version dans Réglages

## Lot 12 - Dates objectifs du parcours
- [x] Date objectif par étape (fixer, changer, retirer)
- [x] « Planifier mes étapes » au rythme choisi
- [x] Compte à rebours sur l’Accueil, objectif dans « Cette semaine » et dans le calendrier
