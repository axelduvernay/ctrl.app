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
- [ ] Questionnaire en 4 étapes
- [ ] Règles de génération du niveau et du parcours (cas A / cas B)
- [ ] Fichier de contenu des étapes (`src/content/parcours.ts`)
- [ ] Redirection vers l'onboarding si aucun profil

## Lot 2 - Musique
- [ ] Catalogue + filtres par statut
- [ ] Création et édition d'un morceau
- [ ] Fiche morceau : versions audio (import, lecture, version validée), notes, infos, cover
- [ ] Projets (EP, tracklists)

## Lot 3 - Accueil
- [ ] Bloc parcours (étape en cours, action suivante)
- [ ] Cette semaine (tâches)
- [ ] En cours (morceaux)
- [ ] Stats (états vides et connexion simulée)

## Lot 4 - Sorties
- [ ] Calendrier
- [ ] Checklist de sortie adaptée au niveau
- [ ] Métadonnées
- [ ] Écran Distribution « bientôt »

## Lot 5 - Réseau (CRM)
- [ ] Contacts
- [ ] Modèles de mails selon le profil
- [ ] Envoi simulé + historique
- [ ] Suivi (envoyé, ouvert, relance) + relance en tâche

## Lot 6 - Boards
- [ ] Analyse du prototype `axelduvernay/ctrl.app` et proposition de reprise
- [ ] Canvas infini, grille de points, zoom
- [ ] Blocs : note, tâche, tracklist, zone + liens
- [ ] Nœuds liés aux morceaux, contacts et tâches

## Lot 7 - Transverse
- [ ] Bouton Capturer : mémo vocal, note, tâche
- [ ] Recherche globale ⌘K

## Lot 8 - Réglages
- [ ] Profil et niveau (refaire le questionnaire)
- [ ] Comptes connectés (simulés)
- [ ] Mode d'affichage
- [ ] Export / import des données
- [ ] Réinitialiser l'app

## Lot 9 - Comptes et synchronisation (Supabase)
- [ ] Projet Supabase dédié (séparé de ctrl.mind), schéma et règles d’accès
- [ ] Implémentation `src/data/remote` des repositories
- [ ] Étape « Garde ta progression » à la fin de l’onboarding : mail + code à 6 chiffres, « Continuer sans compte »
- [ ] Compte dans Réglages : se connecter, se déconnecter, état de la synchro
- [ ] Fichiers audio et covers dans le stockage Supabase

## Lot 10 - Prêt pour le stand
- [ ] Parcours complet testé de l'onboarding à une sortie planifiée
- [ ] Vérification DA sur tous les écrans (sombre et clair)
- [ ] États vides partout
- [ ] Mode plein écran, performance, aucune erreur console
- [ ] Build de production qui tourne hors ligne
