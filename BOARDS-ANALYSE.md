# Boards : analyse du prototype ctrl.mind et reprise

Prototype lu : `axelduvernay/ctrl.mind`, branche `main-486yxj` (JS sans framework,
environ 6 700 lignes). Ce qui a été repris, adapté ou laissé de côté pour le
lot 6 de ctrl.app.

## Repris (logique)
- **Caméra** : un point du monde `p` s’affiche en `p × zoom + décalage`. Tout le
  board bouge avec une seule transformation CSS : fluide même avec beaucoup de blocs.
- **Conversions écran ↔ monde** et **zoom centré sur le curseur** (le point sous
  la souris reste fixe), bornes de zoom 10 % à 400 %.
- **Grille de points dans son propre calque**, qui suit la caméra sans redessiner
  les blocs.
- **Gestes** : deux doigts sur le pavé tactile pour se déplacer, pincement ou
  ⌘/Ctrl + molette pour zoomer, glisser le fond pour se déplacer à la souris.
- **Liens** : courbe de Bézier qui part du bord le plus proche de chaque bloc
  (le trait ne traverse jamais les blocs), aperçu en direct quand on tire un lien.

## Réécrit
- En React + TypeScript, données via les repositories (`Board`, `Bloc`, `Lien`),
  enregistrées dans IndexedDB comme le reste de l’app.
- **DA de ctrl.app** : surfaces pleines, filets de 1 px, rayons 12/18/28, orange
  réservé au bouton + de création. Le « verre dépoli » et les effets du prototype
  ne sont pas repris.
- **Nœuds liés** : un bloc Morceau, Contact ou Tâche affiche l’objet de l’app
  (même fiche, même statut). Cocher une tâche sur le board la coche partout ;
  modifier un morceau dans Musique se voit sur le board.
- **Tracklist** : liste numérotée de morceaux du catalogue, écoutables sur place.

## Laissé de côté pour l’instant (à rediscuter)
- Lasso et sélection multiple, alignement magnétique, outil dessin, annuler /
  rétablir, élan au doigt, sons d’interface, rappels et notifications.
- Partage d’un board ou d’une zone par lien : seul l’emplacement du bouton est
  prévu (« bientôt »), comme le demande SPEC.md.
