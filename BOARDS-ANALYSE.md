# Boards : reprise du prototype ctrl.mind

Prototype : `axelduvernay/ctrl.mind`, branche `main-486yxj`. À la demande
d’Axel, tout ce que proposait son board a été refait dans ctrl.app, en React,
avec les données de l’app et la DA du dossier (pas de verre dépoli).

## Gestes et raccourcis

| Geste | Effet |
| --- | --- |
| Double-clic sur le fond | Nouveau texte, prêt à écrire (dans une zone : il lui appartient) |
| Clic sur un bloc sélectionné, ou double-clic | Modifier son texte, curseur au point cliqué |
| Glisser sur le fond | Sélection au lasso (Maj ou ⌘ : ajouter) |
| Maj ou ⌘ + clic | Ajouter ou retirer de la sélection |
| Espace + glisser, clic du milieu, deux doigts | Déplacer la vue |
| Pincement, ⌘/Ctrl + molette | Zoom doux, crans à 50, 100 et 200 % |
| Glisser un bloc dans ou hors d’une zone | L’y range ou l’en sort ; la zone s’allume et s’étire pour le contenir |
| Glisser près d’un autre bloc | Aimant : bords ou centres alignés, ou côte à côte (Alt : sans aimant) |
| Glisser une zone dans une autre | Sous-zone, qui suit sa parente |
| Réduire une zone | Son contenu se resserre, jusqu’à ce que deux blocs se touchent |
| Poignée carrée (bloc sélectionné) | Redimensionner (Maj : proportions, Option : depuis le centre) |
| Tirer le rond du bord droit | Relier à un autre bloc ; déjà relié : retire le lien ; dans le vide : crée un bloc relié |
| Clic sur un trait | Le sélectionner ; Suppr l’efface |
| Sélectionner du texte en écrivant | Titre, sous-titre, texte, gras, italique, souligné, barré, surligné, liste |
| `#` ou `##` puis espace | Titre ou sous-titre |
| Flèche à gauche d’un titre | Replier ou déplier le texte qui suit |
| Clic droit | Catégorie, échéance et rappel, transformer, variante, dupliquer, zone (couleur, aligner), lignes et colonnes d’un tableau, suppression |
| Clic sur le nom du board | Changer de board ; re-cliquer le board ouvert pour le renommer ; corbeille au survol |
| Barre du bas | Texte, tâche, image, tracklist, zone, tableau, morceau, contact ; crayon ; aligner ; × la replie en + |
| Déposer des fichiers | Images → blocs image ; sons → morceaux du catalogue en tracklist ; autres → dossier (déposés sur une liste : ajoutés) |
| Coller | Une image ou du texte devient un bloc |
| Cocher une tâche | Elle part dans la zone « Fait » |

| Commande `/` | Effet |
| --- | --- |
| `/idee` `/afaire` `/question`… | Catégories du board (renommables, recolorables, cochables) |
| `/tache` | Le bloc devient une tâche de l’app (visible dans Tâches et sur l’Accueil) |
| `/rappel` `/echeance` | Rappel (notification) ou échéance |
| `/tracklist` `/dossier` | Liste de morceaux ou de fichiers, réordonnable à la poignée |
| `/tableau` `/decoupage` | Tableau, ou découpage technique (Séq., Plan, Valeur, Mouvement, Action, Son, Durée) |
| `/variante` | v2 du bloc et de tout ce qui lui est relié, lien pointillé |

| Raccourci | Effet |
| --- | --- |
| `V` `B` (ou `D`) `M` | Sélection, crayon, tracer une zone |
| `T` (ou `N`) `K` `/` | Nouveau texte, nouvelle tâche, nouveau bloc avec les commandes |
| `R` | Aligner : colonnes et rangées nettes |
| `⌘F` | Chercher sur le board (Entrée : résultat suivant) |
| `1` à `9` | Filtrer par catégorie |
| `⌘Z` / `⌘⇧Z` | Annuler / rétablir |
| `⌘A` `⌘D` | Tout sélectionner, dupliquer |
| `⌘+` `⌘−` `⌘0` `Maj+1` | Zoomer, dézoomer, 100 %, tout voir |
| `Entrée` `Suppr` `Échap` | Éditer, supprimer, revenir à la sélection |
| Dans un tableau | Tab / ⇧Tab, Entrée (ligne suivante), ⇧Entrée (retour à la ligne), coller depuis un tableur |

## Différences avec le prototype
- **Nœuds liés** : morceaux, contacts et tâches posés sur un board sont les
  objets de l’app. Une tracklist liste des morceaux du catalogue ; déposer un
  son crée donc un morceau.
- **Rappels** : affichés dans l’app et en notification tant que ctrl.app est
  ouvert (pas de notifications push app fermée, qui demandent un serveur).
- **Pas repris** : synchronisation, partage par lien et invités (lot 9 et
  après), gestes au doigt et élan (la version mobile est hors périmètre), sons
  d’interface.
