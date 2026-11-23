# ctrl.app

De la maquette au morceau publié. Un CRM pour musiciens indépendants qui
accompagne chaque artiste selon son niveau : accompagner, organiser, diffuser.

Grand projet de fin d’études, Master Motion Design, e-artsup Lyon.

- `CLAUDE.md` : règles du projet (stack, architecture, direction artistique)
- `SPEC.md` : ce que fait l’app, écran par écran
- `PLAN.md` : ordre de travail, lot par lot
- `BACKLOG.md` : idées en attente

## Lancer l’app

```bash
npm install
npm run dev
```

Puis ouvrir <http://localhost:5173/ctrl.app/>.

## Mettre en ligne

Chaque push sur `main` publie l’app sur <https://axelduvernay.github.io/ctrl.app/>.
Réglage à faire une seule fois sur GitHub : Settings → Pages → Source :
« Deploy from a branch », Branch : `gh-pages`, dossier `/ (root)`, Save.

## Logo

Les fichiers vectorisés sont dans `brand/` : logo sur fond sombre, sur fond
clair, monochrome, et icône d’app. Le texte est converti en tracés, ils
s’ouvrent sans la police (Illustrator, After Effects, Figma).
