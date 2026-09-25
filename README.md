# ctrl.app

Un whiteboard infini pour ne plus perdre ses idées.

Une seule surface où tout atterrit d'abord, et où le sens se décide après. On
écrit vite sans choisir de dossier ; on range plus tard, ou jamais — la position
dans l'espace suffit souvent à se souvenir.

Le concept complet, les arbitrages et la feuille de route vivent dans le
document produit : **ctrl.app — Concept et vision produit**.

## Lancer l'app

Aucune dépendance, aucune étape de build. Depuis ce dossier :

```bash
python3 serve.py
```

Puis ouvrir <http://localhost:4321>.

`serve.py` est un `http.server` avec les en-têtes qui interdisent la mise en
cache : sans eux, le navigateur garde les anciens modules et une modification
du code peut passer inaperçue au rechargement.

> Les modules ES imposent un vrai serveur : ouvrir `index.html` directement
> depuis le Finder ne fonctionnera pas.

## Gestes et raccourcis

| Geste | Effet |
| --- | --- |
| Double-clic sur le fond | Nouveau bloc, prêt à écrire — dans une zone, le bloc lui appartient |
| Maj en redimensionnant | Garde les proportions (images, dessins) |
| Option en redimensionnant | Grandit ou rétrécit autour du centre (combinable avec Maj) |
| Glisser un bloc dans ou hors d'une zone | L'y range, ou l'en sort |
| Clic sur un bloc sélectionné, ou double-clic | Modifier son texte, curseur au point cliqué |
| Clic sur le nom d'une zone | La renommer (`Entrée` pour valider) |
| Deux doigts | Déplacer la vue |
| Pincement, ou ⌘/Ctrl + molette | Zoomer |
| Espace + glisser | Déplacer la vue à la souris |
| Glisser sur le fond | Sélection au lasso |
| Maj ou ⌘ + clic | Ajouter ou retirer de la sélection |
| Clic droit | Catégorie, échéance et rappel, liens, variante, zone, suppression |
| Tirer le point du bord droit d'un bloc | Le relier à un autre bloc (relâché sur un bloc déjà relié : retire le lien ; dans le vide : crée un bloc relié) |
| Clic sur un trait de liaison | Le sélectionner ; `Suppr` l'efface |
| `/idea` `/task` … | Catégoriser depuis le clavier |
| `/rappel` `/echeance` | Ajouter un rappel ou une échéance à n'importe quel bloc |
| `/tracklist` `/folder` | Transformer le bloc en tracklist ou en dossier |
| `/variant` | Créer une v2 du bloc et de tout ce qui lui est relié |
| Déposer des fichiers audio | Crée une tracklist ; déposés sur une liste, ils s'y ajoutent |

| Raccourci | Effet |
| --- | --- |
| `V` `D` `Z` | Outils sélection, dessin, zone |
| `N` | Nouveau bloc au centre |
| `/` | Nouveau bloc, menu des commandes ouvert |
| `R` | Aligner proprement |
| `⌘F` | Chercher |
| `1` à `4` | Filtrer par catégorie |
| `Échap` | Revenir à la sélection, fermer, retirer les filtres |
| `⌘Z` / `⌘⇧Z` | Annuler / rétablir |
| `⌘A` `⌘D` | Tout sélectionner, dupliquer |
| `Entrée` | Éditer le bloc sélectionné |
| `Maj+1` | Tout voir |

## Structure

```
index.html            Coquille et chrome flottant
manifest.webmanifest  Installation sur l'écran d'accueil
sw.js                 Service worker : démarrage hors-ligne
src/
  main.js       Démarrage, raccourcis clavier, câblage
  store.js      Document, historique, persistance IndexedDB
  viewport.js   Caméra : conversion écran ↔ monde, zoom, cadrage
  render.js     Rendu DOM différentiel des blocs, zones et liens
  interact.js   Gestes au pointeur : glisser, lasso, redimensionner
  editor.js     Édition de texte et slash-commandes
  menus.js      Clic droit et menu du compte
  search.js     Recherche et filtres
  arrange.js    Rangement automatique
  io.js         Dépôt de fichiers, collage, export, import
  draw.js       Lissage et vectorisation du tracé à main levée
  props.js      Panneau échéance et rappel d'un bloc
  reminders.js  Déclenchement des rappels et notifications
  archive.js    Zone « Fait » des tâches terminées
  lists.js      Blocs tracklist et dossier, lecteur audio
  variant.js    Variantes : v2 d'un ensemble de blocs reliés
  welcome.js    Board d'accueil du premier lancement
  util.js       Utilitaires partagés
```

## Choix techniques

**Pas d'étape de build.** Modules ES natifs, servis tels quels. Rien à installer,
rien à compiler, et le code qu'on lit est celui qui s'exécute. Un vrai bundler
n'arrivera que le jour où la synchronisation l'exigera.

**Une seule transformation CSS.** La caméra n'agit que sur `#world` ; le
navigateur compose le reste. C'est ce qui garde le déplacement fluide.

**Document et assets séparés.** Le document (blocs, zones, liens) est léger et
alimente l'historique d'annulation. Les images et fichiers partent dans un
magasin à part, et le bloc n'en garde que la clé. L'annulation reste donc
instantanée sur un board rempli d'images — et le jour de la synchronisation,
seul le document aura besoin d'être fusionné.

**Net à tous les zooms.** `will-change: transform` n'est posé sur `#world`
que pendant un déplacement ou un zoom. Permanent, il ferait garder au
navigateur une image du canvas rendue à l'échelle de départ, et le texte
deviendrait flou en zoomant. Au repos, le navigateur redessine le texte à la
bonne taille.

**Rendu différentiel.** On réutilise les éléments DOM existants plutôt que de
reconstruire, pour ne jamais casser une édition ou une sélection en cours.

## Trois mécaniques qui méritent un mot

**Le tracé est vectoriel, pas un enregistrement du geste.** Un trait capturé
brut tremble. Avant d'être gardé il passe par quatre étapes — filtrage des
points trop proches, moyenne glissante pondérée, simplification de
Ramer-Douglas-Peucker, puis ajustement Catmull-Rom converti en Béziers. On ne
stocke donc pas une suite de points mais une courbe : nette à tous les zooms,
redimensionnable sans perte, et environ dix fois plus légère. Voir `draw.js`.

**Les catégories appartiennent au board.** Elles ne sont pas codées en dur :
on les renomme, on les recolore, on en ajoute depuis le menu. `checkable`
marque celles qui portent une case à cocher — c'est ce qui fait d'une catégorie
une « tâche », sans que le code n'ait à connaître ce mot.

**Les champs d'un bloc viennent de sa catégorie.** Une catégorie déclare ce
que ses blocs peuvent porter : une case à cocher, une échéance, un rappel. La
Tâche a les trois d'office ; les autres se règlent depuis le gestionnaire de
catégories. Un bloc sélectionné propose ses champs encore vides en pointillés.
Désactiver un champ le masque sans effacer ce qui a été saisi.

**Les listes rangent des fichiers dans un ordre.** Une tracklist et un dossier
sont un même bloc, `kind: "list"`. Une tracklist lit ses morceaux à la suite,
un dossier ouvre ou télécharge ses fichiers. On y renomme au double-clic et on
réordonne à la poignée. Les fichiers vont dans le magasin d'assets, comme les
images.

**Une variante est une branche.** `/variant` copie le bloc et tout ce qui lui
est relié, ou la sélection si plusieurs blocs sont choisis. La copie est posée
à droite de l'original, avec le numéro de version suivant. Toutes les versions
partagent une lignée, et un lien pointillé les rattache. Les rappels ne sont pas
copiés, pour qu'une même alarme ne sonne pas deux fois.

**Les rappels sonnent tant que l'app est ouverte**, même en arrière-plan :
notification du système si elle est autorisée, message dans l'app sinon.
Application fermée, rien ne sonne — il faudra pour ça un serveur qui envoie les
notifications, prévu avec la synchronisation.

**Les zones sont des conteneurs.** Chaque bloc porte l'identifiant de sa
zone (`block.zone`) : c'est l'appartenance qui compte, pas la position. Un bloc
créé ou lâché dans une zone en devient l'enfant ; il n'en sort que si on l'en
fait glisser. Le rangement automatique range chaque zone de l'intérieur, puis
déplace les zones d'un seul tenant : les notes, tâches et rappels d'un projet
restent ensemble. Les zones posées par le rangement par catégorie, elles, ne
sont que des étiquettes recalculées à chaque fois.

**Les tâches cochées rejoignent la zone « Fait ».** Elles ne disparaissent pas
et n'encombrent plus. L'appartenance à l'archive est portée par le bloc, pas
déduite de sa position : déplacer la zone à la main ne désarchive rien.

## État

Construit : canvas infini, zones nommées, blocs texte, images, fichiers et
liens, dessin vectoriel lissé, catégories modifiables avec leurs champs, échéances et
rappels, catégorisation par
slash-commande et clic droit, échéances, tâches cochables avec archivage
automatique, sélection multiple, liens entre blocs, recherche, filtres par
surlignage, rangement automatique, thèmes clair et sombre, annulation,
sauvegarde locale, export et import, board d'accueil, pincement tactile,
connexion de blocs par glisser, tracklists, dossiers, variantes, rappel sur
n'importe quel bloc.

Pas encore : connexion, synchronisation multi-appareils, blocs journée et
bilan, rappels et routines, bloc emails, bloc projet audio, assistant IA,
dictée vocale.

Les données vivent dans IndexedDB, donc dans ce navigateur uniquement. Avant la
synchronisation, le menu en haut à droite permet d'exporter un board en JSON —
c'est la façon de le transporter d'une machine à l'autre.
