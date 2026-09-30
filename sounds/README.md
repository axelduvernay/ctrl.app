# Sons de ctrl.app

Déposer ici un fichier par moment, nommé exactement comme dans le tableau :
`create.wav` ou `create.mp3`. Un son absent ne joue simplement rien : on
peut les ajouter un par un. Recharger la page (`⌘⇧R`) pour entendre un
nouveau fichier.

Le son se coupe dans le menu ⋮ → « Sons de l'interface ».

## Format

- **WAV** 48 kHz 16 bits, ou **MP3** 192 kbit/s. Mono suffit pour les sons
  d'interface ; stéréo si l'image apporte quelque chose.
- **Court et sans silence au début** : l'attaque doit tomber sur le geste.
  Couper au premier échantillon utile.
- **Niveau** : autour de −18 LUFS, crête sous −3 dBFS. Ils passent souvent,
  souvent coup sur coup : mieux vaut discrets que présents.
- Pas de fondu en sortie abrupt : une queue courte et propre.

## Les moments

| Fichier | Quand | Intention | Durée |
| --- | --- | --- | --- |
| `create` | Un bloc ou une zone naît (double-clic, barre, `T`, `K`) | Léger, positif, « pop » | 60–150 ms |
| `delete` | Suppression (`Suppr`, clic droit) | Doux, descendant, jamais punitif | 80–200 ms |
| `check` | Une tâche est cochée | Le plus gratifiant de l'app : net, satisfaisant | 100–250 ms |
| `uncheck` | Une tâche est décochée | Version neutre, plus courte, de `check` | 60–120 ms |
| `archive` | La tâche cochée glisse dans « Fait » (≈ 0,5 s après `check`) | Un souffle, un glissement | 150–350 ms |
| `link` | Deux blocs sont reliés | Un « clic » d'accroche | 60–150 ms |
| `unlink` | Un lien est retiré | L'inverse de `link` | 60–150 ms |
| `snap` | Un bloc entre dans une zone pendant qu'on le glisse (l'aimant) | Petit, magnétique ; revient souvent | 40–100 ms |
| `drop` | Image, fichier ou morceau déposé | Mat, « posé » | 80–200 ms |
| `align` | « Aligner » range le board | Mouvement d'ensemble, ordonné | 200–500 ms |
| `undo` | `⌘Z` | Bref, en arrière | 40–100 ms |
| `redo` | `⌘⇧Z` | Bref, en avant | 40–100 ms |
| `expand` | La barre du bas se déplie | Ouverture | 100–250 ms |
| `collapse` | La barre du bas se replie | Fermeture | 100–250 ms |
| `detent` | Le zoom s'arrête sur un cran (50, 100, 200 %) | Le « cran » du trackpad, à l'oreille : un tick | 20–50 ms |
| `reminder` | Un rappel sonne | La sonnerie : se remarque sans agresser | 1–4 s |

`snap` et `detent` peuvent revenir plusieurs fois par seconde : ce sont eux
qui fatiguent l'oreille en premier si ils sont trop présents.

## Limites

- Les navigateurs n'autorisent le son qu'après un premier clic ou une
  première touche dans la page.
- Le rappel ne sonne que si ctrl.app est ouvert. Sur iPhone, l'app passée en
  arrière-plan est mise en pause : rien ne sonne.
