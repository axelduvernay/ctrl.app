# CLAUDE.md - ctrl.app

À lire en début de chaque session. Ces règles s'appliquent à tout le code.

## Le projet

ctrl.app est un CRM pour musiciens indépendants émergents (artistes chant/rap, beatmakers, ou les deux). L'app accompagne l'artiste selon son niveau, de la maquette au morceau publié.

Contexte : grand projet de fin d'études (Master Motion Design, e-artsup). Jury le 15 janvier 2027, l'app est testée sur ordinateur au stand.

Le détail des fonctionnalités est dans `SPEC.md`. L'ordre de travail est dans `PLAN.md`.

## Objectif technique

- **D’abord :** l’app tourne dans le navigateur avec les données en local (IndexedDB), sans compte.
- **Avant le stand :** comptes par mail et synchronisation entre appareils avec Supabase (projet séparé de celui de ctrl.mind). La connexion reste **facultative** : l’app marche sans compte, et au stand le jury entre directement.
- **Plus tard :** vraies intégrations (Gmail, Instagram, TikTok, Spotify), sans réécrire les écrans.
- **L'app démarre vierge.** Aucune donnée fictive pré-remplie. Au premier lancement, l'utilisateur tombe sur l'onboarding et remplit tout lui-même.
- **Mise en ligne :** GitHub Pages, à l’adresse `axelduvernay.github.io/ctrl.app/`, publiée à chaque push sur `main`.

## Ancienne app à la même adresse

Le premier prototype (whiteboard) s’appelait ctrl.app ; il est devenu **ctrl.mind** (repo `axelduvernay/ctrl.mind`). Les deux apps partagent l’origine `axelduvernay.github.io` :
- base IndexedDB de ctrl.app : `ctrlapp-donnees` (ctrl.mind utilise `ctrl-app`) ;
- clés localStorage de ctrl.app préfixées `ctrlapp.` (ctrl.mind utilise `ctrl-…`) ;
- `public/sw.js` est le service worker de ctrl.app (mode hors ligne) ; il remplace celui de l’ancienne app resté sur `/ctrl.app/` et efface ses caches `ctrl-app-…`. Ne pas le supprimer. La liste des fichiers à mettre en cache est injectée par `scripts/apres-build.mjs`.

## Stack

- React + TypeScript (strict) + Vite
- Tailwind CSS, avec les couleurs et espacements en variables CSS (thème sombre et clair)
- React Router
- Zustand pour l'état
- Stockage local : IndexedDB (via Dexie) pour les données et les fichiers audio. Pas de localStorage pour l'audio.
- Police : Satoshi (Fontshare), auto-hébergée dans `/public/fonts` (fichiers variables, graisses 300 à 900)
- Icônes : Lucide, toujours via `src/components/Icone.tsx` (trait 1,6). Une icône se remplace par un SVG maison dans `src/components/icones/personnalisees.tsx`.

Ne pas ajouter d'autre dépendance lourde sans le proposer d'abord.

## Architecture (obligatoire)

```
src/
  types/          modèle de données (une source de vérité)
  data/
    repositories/ interfaces : MorceauxRepo, ContactsRepo, etc.
    local/        implémentation IndexedDB (utilisée maintenant)
    remote/       synchronisation avec Supabase (comptes par code mail, envoi et réception des changements)
  integrations/
    gmail/        interface + adaptateur simulé
    instagram/    interface + adaptateur simulé
    tiktok/       interface + adaptateur simulé
    spotify/      interface + adaptateur simulé
  features/       un dossier par onglet (accueil, musique, sorties, reseau, boards, reglages, onboarding)
  components/     composants partagés (boutons, cartes, champs, etc.)
  content/        textes éditables (parcours, modèles de mails)
  app/            coquille, barre latérale, routes
  stores/         état d’interface (Zustand), ex. thème
  lib/            utilitaires sans écran (formats de date, durée, taille)
  styles/         tokens et thème
brand/            logo vectorisé (SVG) et icône d’app, hors de l’app
```

Les écrans lisent les données avec `useRequete(() => depots.morceaux.lister())` : la lecture se relance d’elle-même à chaque écriture.

Règles :
- **Les écrans n'accèdent jamais directement au stockage.** Ils passent par les repositories.
- Chaque entité a `id` (uuid), `createdAt`, `updatedAt` et `ownerId`, pour que la synchronisation et les comptes soient faciles à brancher plus tard.
- Les intégrations simulées ne font semblant de rien : elles disent clairement « connexion simulée » dans l'interface. Aucun faux chiffre de stats.
- « Local d’abord » : les écrans lisent et écrivent dans IndexedDB ; chaque écriture est notée dans un journal que `src/data/remote/sync.ts` envoie à Supabase quand un compte est connecté. Seule la synchronisation utilise `moteurLocal`. Schéma serveur : `supabase/schema.sql`.

## Direction artistique

Une seule police : Satoshi. Mode sombre par défaut, bascule vers le clair dans Réglages.

| Rôle | Sombre (défaut) | Clair |
|---|---|---|
| Fond | #141415 | #E9ECEF |
| Surface | #1E1E21 | #FFFFFF |
| Filet | #26262A | #D9DCE0 |
| Texte | #F4F0EA | #1E1E20 |
| Texte secondaire | #8A857E | #5E5A55 |
| Accent | #E06D3B | #E06D3B |

Statuts d'un morceau (couleur dédiée, distincte de l'accent) :
Idée #8A857E · Maquette #D9A441 · Finition #B48EF0 · Prêt #6FA8DC · Sorti #6BBF8A

Échelle typo : Display 140 Light · Titre 64 Medium · Texte 16 Medium · Libellé 14 Regular. Logo : Satoshi Bold.
Rayons : 12, 18, 28, pilule (999). Espacements : 8, 16, 24, 32, 48, 64.

Principes :
- Le rendu premium vient du spacing et de la hiérarchie, pas des effets.
- **Interdit :** dégradés, glassmorphism, halos, ombres décoratives, images ou illustrations dans l'interface. Seules les images importées par l'utilisateur (covers) s'affichent.
- Surfaces pleines, filets de 1 px, grille de points sur le board.
- Bouton principal : une pilule claire par écran (inversée en mode clair : pilule sombre), comme dans le dossier.
- L'orange est rare : progression, chevron du logo et actions de création (le + du board) uniquement.
- Contraste : pas de petit texte orange sur fond clair. Sur un bouton orange, libellé en #1E1E20 ou en gras ≥ 19 px.
- Peu d'animations (éco-conception) : transitions courtes, rien en boucle.
- Logo : chevron du signe control (⌃) à 90°, bouts arrondis, + logotype « ctrl.app ».

## Textes de l'interface

- En français, tutoiement (« Tu fais quoi ? », « Où en es-tu ? »).
- Apostrophes typographiques (’) et guillemets français (« »).
- Pas de tiret long « — » : tiret simple ou reformulation.
- Ton direct, entre pairs, sans culpabiliser. L'app ne juge jamais la qualité artistique : le suivi porte sur les étapes (mix, cover, distribution, date), pas sur le son.
- Statuts écrits exactement : Idée, Maquette, Finition, Prêt, Sorti.

## Prototype existant à réutiliser

Le repo `axelduvernay/ctrl.mind` (branche `main-486yxj`, ancien nom ctrl.app) contient un prototype de whiteboard (board infini, blocs, nœuds, liens). Avant le lot Boards :
1. Lire ce code.
2. Proposer ce qui peut être repris (logique du canvas, nœuds, liens, zoom) et ce qui doit être réécrit pour respecter la stack, l'architecture et la DA ci-dessus.
3. Ne pas copier le style visuel du prototype s'il contredit la DA.

## Méthode de travail

- Le dossier intermédiaire et le mémoire font foi : en cas de doute sur une intention, s’y référer, puis demander.
- Travailler **lot par lot**, dans l'ordre de `PLAN.md`. Axel suit au fur et à mesure : la procédure peut évoluer avec lui.
- Avant chaque lot : annoncer en quelques lignes ce qui va être fait et poser les questions ouvertes, s’il y en a.
- Après chaque lot : vérifier dans le navigateur (sombre et clair, aucune erreur console), montrer des captures, cocher le lot dans `PLAN.md`, résumer en 3 lignes, attendre le retour d’Axel avant le lot suivant.
- Une idée ou un ajout hors du lot en cours : l'ajouter à `BACKLOG.md`, ne pas le coder.
- Ne pas inventer de fonctionnalité absente de `SPEC.md`. En cas de doute, demander.
- Commit Git à la fin de chaque lot, message clair en français.
