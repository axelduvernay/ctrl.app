# SPEC.md - ctrl.app

Ce que l'app fait, écran par écran. Source : dossier intermédiaire du grand projet.

## Concept

Un CRM pour musiciens qui accompagne chaque artiste selon son niveau, de la maquette au morceau publié.

Trois piliers :
- **Accompagner** : un parcours adapté au niveau et aux objectifs, généré à l'inscription.
- **Organiser** : maquettes, versions, notes et tâches au même endroit, avec un whiteboard pour réfléchir.
- **Diffuser** : calendrier de sortie, réseau, envoi par mail, stats des comptes connectés.

Cible : artistes (chant, rap), beatmakers, ou les deux, indépendants et émergents.

## Navigation

Barre latérale : Accueil, Musique, Sorties, Réseau, Boards, + Réglages en bas.

Partout dans l'app :
- Un bouton **Capturer** pour noter une idée sans chercher où la ranger : mémo vocal (enregistré dans le navigateur), note ou tâche.
- Une **recherche globale** (raccourci ⌘K) sur morceaux, contacts, tâches et boards.

## 0. Onboarding (premier lancement)

Questionnaire en 4 étapes, puis génération du parcours.

1. **Profil** - Tu fais quoi ? Artiste (je chante, je rappe) · Beatmaker (je produis) · Les deux (je fais tout). + nom d'artiste.
2. **État des lieux** - Où en es-tu ?
   - Sons en stock : combien de morceaux ou de prods
   - Déjà publié : nulle part · SoundCloud, YouTube · streaming
   - Distributeur : oui · non · je ne sais pas
   - Réseaux sociaux : plateformes et abonnés (saisie manuelle)
3. **Objectifs** (plusieurs choix) - Sortir mes sons sur les plateformes · Faire grandir mes réseaux · Sortir plus régulièrement · Développer mon réseau
4. **Connexions** (facultatif, modifiable plus tard) - Gmail, Instagram, TikTok, Spotify for Artists (disponible après une première sortie). Simulées pour l'instant.
5. **Garde ta progression** (facultatif) - l’artiste entre son mail, reçoit un code à 6 chiffres et le tape : son parcours est sauvegardé et synchronisé entre ses appareils. Lien « Continuer sans compte » bien visible (au stand, le jury passe directement). Arrive avec les comptes (Supabase) ; d’ici là, l’étape n’est pas affichée.

Résultat : un niveau et un parcours personnalisé, qui évoluent avec l'artiste.

## Parcours

Même structure pour tous (étapes numérotées /08), contenu différent selon le point de départ. Généré par des règles simples à partir des réponses, pas par une IA.

**Cas A - débutant** (jamais publié en streaming) :
1. Choisir le son à sortir
2. Finaliser le mix et le master
3. Créer la cover
4. Choisir un distributeur
5. Renseigner les métadonnées
6. Fixer la date de sortie
7. Planifier le contenu réseaux
8. Publier et suivre les stats

**Cas B - publie déjà** : on saute « Choisir un distributeur » et « Renseigner les métadonnées » comme étapes d'apprentissage. Le parcours se concentre sur :
1. Sortir à un rythme régulier
2. Proposer ses morceaux aux playlists
3. Suivre les stats après chaque sortie
4. Développer son réseau : collabs, envois

Chaque étape = une explication courte + un bouton vers l'action concernée dans l'app. Exemple étape « Choisir un distributeur » : « C'est quoi un distributeur ? » en 2-3 phrases, puis lien vers la checklist de sortie du morceau.
Le niveau évolue quand une étape est validée. Progression visible, jamais de note sur la créativité.

Le contenu exact des explications reste à rédiger : prévoir les textes dans un fichier séparé (`src/content/parcours.ts`) pour qu'ils soient faciles à modifier.

## 1. Accueil

- Date du jour + « Bonjour <nom> »
- **Ton parcours** : étape en cours (ex. « 02 /08 Finaliser le mix »), morceau concerné, action suivante, bouton « Voir le parcours »
- **Cette semaine** : tâches à venir, triées par date
- **En cours** : morceaux en cours avec statut et dernière modification, « Tout voir »
- **Stats** : comptes connectés (Instagram, TikTok, Spotify). Sans connexion : état vide qui invite à connecter. Spotify for Artists : « disponible après ta première sortie »

Tous les blocs ont un état vide propre (app vierge au départ).

## 2. Musique

- **Catalogue** : toutes les prods et morceaux, filtrables par statut
- **Statuts** : Idée, Maquette, Finition, Prêt, Sorti
- **Fiche morceau** :
  - Versions : import de fichiers audio, lecture, historique, version validée en tête
  - Notes : paroles, idées, retours reçus, notes de mix
  - Infos : BPM, tonalité, projet, cover (image importée)
- **Projets** : EP et tracklists (liste ordonnée de morceaux)

## 3. Sorties

- **Calendrier** : sorties et posts réseaux planifiés
- **Checklist de sortie** par morceau, adaptée au niveau (cover, mix/master, distributeur, métadonnées, date, contenus réseaux)
- **Métadonnées** : titre, artistes, crédits, cover, ISRC, genre
- **Distribution** : à terme depuis l'app. Pour l'instant : écran « bientôt », pas de fausse fonctionnalité

Règle : le suivi porte sur les étapes de publication, jamais sur la qualité artistique.

## 4. Réseau (CRM)

- **Contacts** : artistes, beatmakers, ingé son, graphistes, pros. Rôle, liens, notes, morceaux échangés
- **Envoi** : composer un mail (prods, maquettes, liens) depuis l'app. Gmail simulé pour l'instant : l'envoi est enregistré dans l'historique avec la mention « simulé »
- **Suivi des envois** : envoyé, ouvert, relance (relance = rappel en tâche)
- **Modèles de mails** selon le profil (beatmaker qui envoie un pack, artiste qui cherche des prods ou une collab)

## 5. Boards

- **Whiteboard** infini avec grille de points : zones, blocs, liens entre blocs, zoom (−, %, +)
- Types de blocs : note, tâche, tracklist (liste de morceaux à écouter, numérotée), zone
- **Nœuds liés** : un morceau, un contact ou une tâche posé sur un board est le même objet que dans les autres onglets. Modifié à un endroit, il l'est partout
- **Partage** d'un board ou d'une zone par lien : plus tard (nécessite le backend), prévoir l'emplacement du bouton seulement
- Reprendre ce qui est utile du prototype `axelduvernay/ctrl.app`

## 6. Réglages

- Profil et niveau : refaire le questionnaire
- Comptes connectés : Gmail, Instagram, TikTok, Spotify (simulés)
- Mode d'affichage : sombre ou clair
- Compte et synchronisation : connexion par mail (code à 6 chiffres) et synchro entre appareils via Supabase. Sans compte, export et import des données en fichier
- **Réinitialiser l'app** (efface tout, retour à l'onboarding). Utile au stand entre deux visiteurs

## Hors périmètre pour l'instant

- Vraies API Gmail, Instagram, TikTok, Spotify
- Distribution réelle
- Version mobile (desktop d'abord, mais garder une mise en page qui ne casse pas)
- Offre premium (collaboration, accompagnement personnalisé)
