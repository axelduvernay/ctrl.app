import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BoutonIcone } from "@/components/Bouton";
import { Icone, type NomIcone } from "@/components/Icone";
import { depots, useRequete } from "@/data";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { fr } from "@/content/typo";
import { basculerTache, modifierTache } from "@/features/taches/actions";
import type { Bloc, Board, Contact, Fichier, Id, Lien, Morceau, Tache, TypeBloc, Version, VueBoard } from "@/types";
import {
  convertir,
  creerBloc,
  creerVariante,
  deplacerBlocs,
  dupliquer,
  enregistrerVue,
  importerFichiers,
  modifierBloc,
  noteEnTache,
  rangerDansFait,
  relierOuDelier,
  supprimerBlocs,
  supprimerLien,
} from "./actions";
import { BlocVue } from "./BlocVue";
import { categoriesDe } from "./categories";
import { BoardCtx, type ContexteBoard, type Edition } from "./contexte";
import { vectoriser, type Point } from "./dessin";
import type { Commande } from "./EditeurTexte";
import {
  aimanter,
  aligner,
  borner,
  contient,
  courbe,
  courbeVersPoint,
  englobant,
  PAS_GRILLE,
  seCroisent,
  toutVoir,
  versMonde,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomerAutour,
  type Rect,
} from "./geometrie";
import * as historique from "./historique";
import { BarreBas, ChoixObjet, GestionCategories, MenuContextuel, PanneauProprietes, SelecteurBoards, type Menu } from "./Menus";
import { texteBrut } from "./texte";

type Outil = "selection" | "crayon" | "zone";

type Geste =
  | { type: "vue"; ex: number; ey: number; vue: VueBoard }
  | {
      type: "blocs";
      ex: number;
      ey: number;
      origines: Map<Id, { x: number; y: number }>;
      hauts: Id[];
      bouge: boolean;
      principal: Id;
      dejaChoisi: boolean;
    }
  | { type: "lien"; de: Id }
  | { type: "taille"; id: Id; ex: number; ey: number; depart: Rect; enfants: Map<Id, Rect> }
  | { type: "lasso"; depart: Point; base: Set<Id> }
  | { type: "trace"; points: Point[] }
  | { type: "tracezone"; depart: Point };

const CRANS = [0.5, 1, 2];

export function BoardPage() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const { donnees, chargement } = useRequete(async () => {
    const board = await depots.boards.obtenir(id);
    if (!board) return null;
    const [blocs, liens, morceaux, contacts, taches, versions, fichiers, boards] = await Promise.all([
      depots.blocs.trouver("boardId", id),
      depots.liens.trouver("boardId", id),
      depots.morceaux.lister(),
      depots.contacts.lister(),
      depots.taches.lister(),
      depots.versions.lister(),
      depots.fichiers.lister(),
      depots.boards.lister(),
    ]);
    return { board, blocs, liens, morceaux, contacts, taches, versions, fichiers, boards };
  }, [id]);

  if (chargement) return null;
  if (!donnees)
    return (
      <p className="text-texte-2">
        Ce board n’existe plus.{" "}
        <Link to="/boards" className="text-texte underline-offset-4 hover:underline">
          Retour aux boards
        </Link>
      </p>
    );
  return <Canvas key={id} {...donnees} onQuitter={() => naviguer("/boards", { replace: true })} />;
}

interface PropsCanvas {
  board: Board;
  blocs: Bloc[];
  liens: Lien[];
  morceaux: Morceau[];
  contacts: Contact[];
  taches: Tache[];
  versions: Version[];
  fichiers: Fichier[];
  boards: Board[];
  onQuitter(): void;
}

function Canvas({ board, blocs, liens, morceaux, contacts, taches, versions, fichiers, boards, onQuitter }: PropsCanvas) {
  const naviguer = useNavigate();
  const cadre = useRef<HTMLDivElement>(null);
  const [vue, setVue] = useState<VueBoard>(board.vue);
  const zoomBrut = useRef(board.vue.zoom);
  const [positions, setPositions] = useState<Map<Id, { x: number; y: number }>>(new Map());
  const [taillesTemp, setTaillesTemp] = useState<Map<Id, { w: number; h: number }>>(new Map());
  const [mesures, setMesures] = useState<Map<Id, { w: number; h: number }>>(new Map());
  const [selection, setSelection] = useState<Set<Id>>(new Set());
  const [lienChoisi, setLienChoisi] = useState<Id | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [outil, setOutil] = useState<Outil>("selection");
  const [geste, setGeste] = useState<Geste | null>(null);
  const [pointeur, setPointeur] = useState<Point | null>(null);
  const [lasso, setLasso] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [zoneCible, setZoneCible] = useState<Id | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [proprietes, setProprietes] = useState<Id | null>(null);
  const [categoriesOuvert, setCategoriesOuvert] = useState(false);
  const [choix, setChoix] = useState<{ type: "morceau" | "contact" | "tracklist"; cible?: Id; point?: Point } | null>(null);
  const [recherche, setRecherche] = useState<{ texte: string; index: number } | null>(null);
  const [filtre, setFiltre] = useState<Id | null>(null);
  const [espace, setEspace] = useState(false);
  const dernierClic = useRef<{ id: Id | "fond"; t: number; x: number; y: number } | null>(null);
  const tracer = useRef<Point[]>([]);
  const [trace, setTrace] = useState<Point[]>([]);

  const categories = categoriesDe(board);
  const parId = useMemo(() => new Map(blocs.map((b) => [b.id, b])), [blocs]);
  const fichiersParId = useMemo(() => new Map(fichiers.map((f) => [f.id, f])), [fichiers]);

  /* ---------- Vue : centrage initial, enregistrement au repos ---------- */

  useEffect(() => {
    if (board.vue.x === 0 && board.vue.y === 0 && cadre.current) {
      const r = cadre.current.getBoundingClientRect();
      setVue((v) => ({ ...v, x: r.width / 2, y: r.height / 2 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void enregistrerVue(board.id, vue), 400);
    return () => clearTimeout(t);
  }, [vue, board.id]);

  /* ---------- Mesure réelle des blocs (hauteur selon le contenu) ---------- */

  const observateur = useMemo(
    () =>
      new ResizeObserver((entrees) =>
        setMesures((m) => {
          const suivant = new Map(m);
          for (const e of entrees) {
            const el = e.target as HTMLElement;
            suivant.set(el.dataset.bloc!, { w: el.offsetWidth, h: el.offsetHeight });
          }
          return suivant;
        }),
      ),
    [],
  );
  useEffect(() => () => observateur.disconnect(), [observateur]);
  const mesurer = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) observateur.observe(el);
    },
    [observateur],
  );

  const rect = useCallback(
    (b: Bloc): Rect => {
      const p = positions.get(b.id) ?? b;
      const t = taillesTemp.get(b.id);
      const m = mesures.get(b.id);
      const fixe = b.type === "zone" || b.type === "image" || b.type === "dessin";
      return {
        x: p.x,
        y: p.y,
        w: t?.w ?? (fixe ? b.largeur : (m?.w ?? b.largeur)),
        h: t?.h ?? (fixe ? b.hauteur : (m?.h ?? (b.hauteur || 60))),
      };
    },
    [positions, taillesTemp, mesures],
  );
  const rects = useMemo(() => new Map(blocs.map((b) => [b.id, rect(b)])), [blocs, rect]);

  /** Tous les blocs rangés dans une zone, de proche en proche (sous-zones comprises). */
  const descendants = useCallback(
    (zoneId: Id): Id[] => {
      const r: Id[] = [];
      for (const b of blocs)
        if (b.zoneId === zoneId) {
          r.push(b.id);
          if (b.type === "zone") r.push(...descendants(b.id));
        }
      return r;
    },
    [blocs],
  );
  const profondeur = useCallback(
    (b: Bloc): number => {
      let n = 0;
      let z = b.zoneId ? parId.get(b.zoneId) : undefined;
      while (z && n < 20) {
        n++;
        z = z.zoneId ? parId.get(z.zoneId) : undefined;
      }
      return n;
    },
    [parId],
  );

  /* ---------- Historique ---------- */

  const memoriser = useCallback(() => historique.memoriser(board.id, { blocs, liens }), [board.id, blocs, liens]);
  const annuler = () => void historique.annuler(board.id, { blocs, liens }).then(() => setSelection(new Set()));
  const retablir = () => void historique.retablir(board.id, { blocs, liens }).then(() => setSelection(new Set()));

  /* ---------- Outils de coordonnées ---------- */

  const centreEcran = () => {
    const r = cadre.current!.getBoundingClientRect();
    return versMonde(vue, r.width / 2, r.height / 2);
  };
  const pointMonde = (e: { clientX: number; clientY: number }) => {
    const r = cadre.current!.getBoundingClientRect();
    return versMonde(vue, e.clientX - r.left, e.clientY - r.top);
  };
  /** Zone la plus profonde qui contient le point, hors exclusions. */
  const zoneSous = (p: Point, exclus: Set<Id>) => {
    let meilleure: Bloc | null = null;
    for (const b of blocs) {
      if (b.type !== "zone" || exclus.has(b.id)) continue;
      const r = rects.get(b.id)!;
      if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h && (!meilleure || profondeur(b) > profondeur(meilleure))) meilleure = b;
    }
    return meilleure;
  };

  /** Une zone s’étire pour contenir ses blocs (et ses parentes aussi). */
  async function etirerZone(zoneId: Id, ajout?: Rect) {
    let z = parId.get(zoneId);
    let inclus = ajout;
    while (z) {
      const r = rects.get(z.id)!;
      const enfants = blocs.filter((b) => b.zoneId === z!.id).map((b) => rects.get(b.id)!);
      if (inclus) enfants.push(inclus);
      if (enfants.length) {
        const e = englobant(enfants);
        const x2 = Math.max(r.x + r.w, e.x + e.w + 24);
        const y2 = Math.max(r.y + r.h, e.y + e.h + 24);
        if (x2 > r.x + r.w || y2 > r.y + r.h) await modifierBloc(z.id, { largeur: Math.round(x2 - r.x), hauteur: Math.round(y2 - r.y) });
        inclus = { x: r.x, y: r.y, w: x2 - r.x, h: y2 - r.y };
      }
      z = z.zoneId ? parId.get(z.zoneId) : undefined;
    }
  }

  /* ---------- Création ---------- */

  async function creer(type: TypeBloc, point?: Point, extra: Parameters<typeof creerBloc>[4] = {}) {
    memoriser();
    const p = point ?? centreEcran();
    const decale = point ? 0 : (blocs.length % 5) * 24;
    const zone = zoneSous(p, new Set());
    const b = await creerBloc(board.id, type, p.x + decale, p.y + decale, { zoneId: type === "zone" ? (zone?.id ?? null) : (zone?.id ?? null), ...extra });
    setSelection(new Set([b.id]));
    if (type === "note") setEdition({ id: b.id });
    if (zone) await etirerZone(zone.id, { x: b.x, y: b.y, w: b.largeur, h: b.hauteur || 80 });
    return b;
  }

  /* ---------- Zoom doux avec crans à 50, 100, 200 % ---------- */

  function zoomerDoux(facteur: number, ex: number, ey: number) {
    zoomBrut.current = borner(zoomBrut.current * facteur, ZOOM_MIN, ZOOM_MAX);
    const cran = CRANS.find((c) => Math.abs(Math.log(zoomBrut.current / c)) < 0.05);
    const cible = cran ?? zoomBrut.current;
    setVue((v) => zoomerAutour(v, cible / v.zoom, ex, ey));
  }
  function zoomerCentre(facteur: number) {
    const r = cadre.current!.getBoundingClientRect();
    zoomBrut.current = borner(vue.zoom * facteur, ZOOM_MIN, ZOOM_MAX);
    setVue((v) => zoomerAutour(v, facteur, r.width / 2, r.height / 2));
  }
  function zoomExact(z: number) {
    const r = cadre.current!.getBoundingClientRect();
    zoomBrut.current = z;
    setVue((v) => zoomerAutour(v, z / v.zoom, r.width / 2, r.height / 2));
  }
  function cadrer(ids?: Id[]) {
    const r = cadre.current!.getBoundingClientRect();
    const liste = ids ? ids.map((id) => rects.get(id)!).filter(Boolean) : [...rects.values()];
    const v = toutVoir(liste, r.width, r.height);
    zoomBrut.current = v.zoom;
    setVue(v);
  }

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const surMolette = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-defile]")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const pas = Math.max(-20, Math.min(20, e.deltaY));
        zoomerDoux(Math.exp(-pas * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else setVue((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", surMolette, { passive: false });
    return () => el.removeEventListener("wheel", surMolette);
  });

  /* ---------- Gestes au pointeur ---------- */

  function capturer(e: React.PointerEvent) {
    cadre.current!.setPointerCapture(e.pointerId);
  }

  function debutFond(e: React.PointerEvent) {
    if (e.button === 2) return;
    setMenu(null);
    setLienChoisi(null);
    capturer(e);
    if (e.button === 1 || espace) return setGeste({ type: "vue", ex: e.clientX, ey: e.clientY, vue });
    const p = pointMonde(e);
    if (outil === "crayon") {
      tracer.current = [p];
      setTrace([p]);
      return setGeste({ type: "trace", points: [] });
    }
    if (outil === "zone") return setGeste({ type: "tracezone", depart: p });
    const ajout = e.shiftKey || e.metaKey || e.ctrlKey;
    if (!ajout) setSelection(new Set());
    setGeste({ type: "lasso", depart: p, base: ajout ? new Set(selection) : new Set() });
  }

  function debutBloc(e: React.PointerEvent, b: Bloc) {
    if (e.button === 2 || edition?.id === b.id) return;
    if (outil !== "selection" || espace || e.button === 1) return debutFond(e);
    e.stopPropagation();
    setMenu(null);
    setLienChoisi(null);
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const s = new Set(selection);
      if (s.has(b.id)) s.delete(b.id);
      else s.add(b.id);
      return setSelection(s);
    }
    const dejaChoisi = selection.has(b.id) && selection.size === 1;
    const groupe = selection.has(b.id) ? [...selection] : [b.id];
    if (!selection.has(b.id)) setSelection(new Set([b.id]));
    // Les zones déplacées emportent leur contenu.
    const tous = new Set(groupe);
    for (const id of groupe) if (parId.get(id)?.type === "zone") descendants(id).forEach((d) => tous.add(d));
    // Hauts : les blocs déplacés qui ne sont pas dans une zone elle-même déplacée.
    const hauts = [...tous].filter((id) => !parId.get(id)?.zoneId || !tous.has(parId.get(id)!.zoneId!));
    const origines = new Map<Id, { x: number; y: number }>();
    for (const id of tous) {
      const r = rects.get(id);
      if (r) origines.set(id, { x: r.x, y: r.y });
    }
    capturer(e);
    setGeste({ type: "blocs", ex: e.clientX, ey: e.clientY, origines, hauts, bouge: false, principal: b.id, dejaChoisi });
  }

  function debutLien(e: React.PointerEvent, b: Bloc) {
    e.stopPropagation();
    capturer(e);
    setGeste({ type: "lien", de: b.id });
    setPointeur(pointMonde(e));
  }

  function debutTaille(e: React.PointerEvent, b: Bloc) {
    e.stopPropagation();
    capturer(e);
    const enfants = new Map<Id, Rect>();
    if (b.type === "zone") for (const c of blocs) if (c.zoneId === b.id) enfants.set(c.id, rects.get(c.id)!);
    setGeste({ type: "taille", id: b.id, ex: e.clientX, ey: e.clientY, depart: rects.get(b.id)!, enfants });
  }

  function mouvement(e: React.PointerEvent) {
    if (!geste) return;
    if (geste.type === "vue") return setVue({ ...geste.vue, x: geste.vue.x + e.clientX - geste.ex, y: geste.vue.y + e.clientY - geste.ey });
    const p = pointMonde(e);
    if (geste.type === "blocs") {
      if (!geste.bouge && Math.hypot(e.clientX - geste.ex, e.clientY - geste.ey) < 3) return;
      if (!geste.bouge) setGeste({ ...geste, bouge: true });
      let dx = (e.clientX - geste.ex) / vue.zoom;
      let dy = (e.clientY - geste.ey) / vue.zoom;
      // Aimant : sur les voisins, sauf avec Alt.
      const hautsRects = geste.hauts.map((id) => {
        const o = geste.origines.get(id)!;
        const r = rects.get(id)!;
        return { x: o.x + dx, y: o.y + dy, w: r.w, h: r.h };
      });
      const boite = englobant(hautsRects);
      let g = { x: null as number | null, y: null as number | null };
      if (!e.altKey) {
        const voisins = blocs.filter((b) => !geste.origines.has(b.id)).map((b) => rects.get(b.id)!);
        const a = aimanter(boite, voisins, 6 / vue.zoom);
        dx += a.dx;
        dy += a.dy;
        g = { x: a.guideX, y: a.guideY };
      }
      setGuides(g);
      const suivant = new Map<Id, { x: number; y: number }>();
      geste.origines.forEach((o, id) => suivant.set(id, { x: o.x + dx, y: o.y + dy }));
      setPositions(suivant);
      const principal = rects.get(geste.principal)!;
      const centre = { x: geste.origines.get(geste.principal)!.x + dx + principal.w / 2, y: geste.origines.get(geste.principal)!.y + dy + principal.h / 2 };
      setZoneCible(zoneSous(centre, new Set(geste.origines.keys()))?.id ?? null);
    } else if (geste.type === "lien") setPointeur(p);
    else if (geste.type === "lasso") {
      const r = { x: Math.min(p.x, geste.depart.x), y: Math.min(p.y, geste.depart.y), w: Math.abs(p.x - geste.depart.x), h: Math.abs(p.y - geste.depart.y) };
      setLasso(r);
      const s = new Set(geste.base);
      for (const b of blocs) {
        const rb = rects.get(b.id)!;
        // Une zone se sélectionne entière dans le lasso ; un bloc, dès qu’il est touché.
        if (b.type === "zone" ? englobe(r, rb) : seCroisent(r, rb)) s.add(b.id);
      }
      setSelection(s);
    } else if (geste.type === "trace") {
      tracer.current.push(p);
      setTrace([...tracer.current]);
    } else if (geste.type === "tracezone") {
      setLasso({ x: Math.min(p.x, geste.depart.x), y: Math.min(p.y, geste.depart.y), w: Math.abs(p.x - geste.depart.x), h: Math.abs(p.y - geste.depart.y) });
    } else if (geste.type === "taille") {
      const b = parId.get(geste.id)!;
      const d = geste.depart;
      let w = Math.max(b.type === "zone" ? 200 : 60, d.w + (e.clientX - geste.ex) / vue.zoom);
      let h = Math.max(b.type === "zone" ? 140 : 30, d.h + (e.clientY - geste.ey) / vue.zoom);
      if (e.shiftKey || b.type === "image") h = (w * d.h) / d.w; // garde les proportions
      if (e.altKey) {
        // Autour du centre.
        w = d.w + 2 * (w - d.w);
        h = d.h + 2 * (h - d.h);
        setPositions(new Map([[b.id, { x: d.x - (w - d.w) / 2, y: d.y - (h - d.h) / 2 }]]));
      }
      if (b.type === "zone" && geste.enfants.size && (w < d.w || h < d.h)) {
        // Réduire une zone resserre son contenu, jusqu’à ce que deux blocs se touchent.
        const sx = Math.min(1, w / d.w);
        const sy = Math.min(1, h / d.h);
        const serres = new Map<Id, Rect>();
        geste.enfants.forEach((r, id) => serres.set(id, { ...r, x: d.x + (r.x - d.x) * sx, y: d.y + (r.y - d.y) * sy }));
        const liste = [...serres.values()];
        const chevauche = liste.some((a, i) => liste.some((c, j) => j > i && seCroisent(a, c)));
        const deborde = liste.some((r) => r.x + r.w > d.x + w - 12 || r.y + r.h > d.y + h - 12);
        if (chevauche || deborde) return;
        setPositions(new Map([...serres].map(([id, r]) => [id, { x: r.x, y: r.y }])));
      }
      setTaillesTemp(new Map([[b.id, { w, h: b.type === "zone" || b.type === "image" || b.type === "dessin" ? h : (rects.get(b.id)?.h ?? h) }]]));
    }
  }

  async function fin(e: React.PointerEvent) {
    const g = geste;
    setGeste(null);
    setGuides({ x: null, y: null });
    setZoneCible(null);
    if (!g) return;
    const p = pointMonde(e);
    if (g.type === "blocs") {
      if (g.bouge) {
        memoriser();
        await deplacerBlocs([...positions].map(([id, pos]) => ({ id, ...pos })));
        // Rangement dans une zone (ou sortie) selon le point de dépôt.
        const exclus = new Set(g.origines.keys());
        for (const id of g.hauts) {
          const b = parId.get(id)!;
          const r = { ...rects.get(id)!, ...positions.get(id) };
          const z = zoneSous({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, exclus);
          const zoneId = z?.id ?? null;
          if (zoneId !== b.zoneId) await modifierBloc(id, { zoneId });
          if (z) await etirerZone(z.id, r);
        }
        setPositions(new Map());
      } else {
        const b = parId.get(g.principal)!;
        const maintenant = performance.now();
        const double = dernierClic.current?.id === b.id && maintenant - dernierClic.current.t < 400;
        dernierClic.current = { id: b.id, t: maintenant, x: e.clientX, y: e.clientY };
        // Clic sur un bloc déjà sélectionné, ou double-clic : éditer.
        if (g.dejaChoisi || double) editer(b, { x: e.clientX, y: e.clientY }, e.target as HTMLElement);
      }
    } else if (g.type === "lien") {
      setPointeur(null);
      const cible = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-bloc]");
      memoriser();
      if (cible?.dataset.bloc) await relierOuDelier(board.id, g.de, cible.dataset.bloc);
      else {
        // Relâché dans le vide : un bloc relié apparaît là.
        const b = await creerBloc(board.id, "note", p.x + 120, p.y, { zoneId: zoneSous(p, new Set())?.id ?? null });
        await relierOuDelier(board.id, g.de, b.id);
        setSelection(new Set([b.id]));
        setEdition({ id: b.id });
      }
    } else if (g.type === "lasso") {
      setLasso(null);
      const r = lasso;
      if (!r || (r.w < 3 && r.h < 3)) {
        // Simple clic sur le fond : double-clic = nouveau bloc.
        const maintenant = performance.now();
        const d = dernierClic.current;
        if (d?.id === "fond" && maintenant - d.t < 400 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
          dernierClic.current = null;
          await creer("note", p);
        } else dernierClic.current = { id: "fond", t: maintenant, x: e.clientX, y: e.clientY };
      }
    } else if (g.type === "trace") {
      const points = tracer.current;
      tracer.current = [];
      setTrace([]);
      if (points.length < 2) return;
      const v = vectoriser(points, vue.zoom);
      memoriser();
      await creerBloc(board.id, "dessin", v.x + v.w / 2, v.y + v.h / 2, { largeur: Math.round(v.w), hauteur: Math.round(v.h), trace: { d: v.d, w: v.w, h: v.h }, zoneId: zoneSous({ x: v.x + v.w / 2, y: v.y + v.h / 2 }, new Set())?.id ?? null });
    } else if (g.type === "tracezone") {
      const r = lasso;
      setLasso(null);
      setOutil("selection");
      if (!r || r.w < 60 || r.h < 40) return;
      memoriser();
      const parente = zoneSous({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, new Set());
      const z = await creerBloc(board.id, "zone", r.x + r.w / 2, r.y + r.h / 2, { largeur: Math.round(r.w), hauteur: Math.round(r.h), zoneId: parente?.id ?? null });
      for (const b of blocs) if (b.zoneId === (parente?.id ?? null) && b.id !== z.id && contient(r, rects.get(b.id)!)) await modifierBloc(b.id, { zoneId: z.id });
      setSelection(new Set([z.id]));
      setEdition({ id: z.id });
    } else if (g.type === "taille") {
      memoriser();
      const t = taillesTemp.get(g.id);
      const b = parId.get(g.id)!;
      if (t) await modifierBloc(g.id, { largeur: Math.round(t.w), ...(b.type === "zone" || b.type === "image" || b.type === "dessin" ? { hauteur: Math.round(t.h) } : {}) });
      if (positions.size) await deplacerBlocs([...positions].map(([id, pos]) => ({ id, ...pos })));
      setTaillesTemp(new Map());
      setPositions(new Map());
    }
  }

  function editer(b: Bloc, point?: Point, cible?: HTMLElement) {
    if (b.type === "morceau" || b.type === "contact" || b.type === "image" || b.type === "dessin") return;
    if (b.type === "zone" && cible && !cible.closest("[data-titre-zone]")) return;
    const cellule = cible?.closest<HTMLElement>("[data-cellule]")?.dataset.cellule?.split("-").map(Number);
    setEdition({ id: b.id, point, cellule: cellule ? { l: cellule[0]!, c: cellule[1]! } : null });
  }

  /* ---------- Actions sur la sélection ---------- */

  const choisis = () => [...selection].filter((id) => parId.has(id));

  async function supprimerSelection() {
    if (lienChoisi) {
      memoriser();
      await supprimerLien(lienChoisi);
      return setLienChoisi(null);
    }
    const ids = choisis();
    if (!ids.length) return;
    memoriser();
    await supprimerBlocs(ids);
    setSelection(new Set());
  }

  async function dupliquerSelection() {
    const ids = choisis();
    if (!ids.length) return;
    memoriser();
    setSelection(new Set(await dupliquer(board.id, ids)));
  }

  async function varianteSelection(ids = choisis()) {
    if (!ids.length) return;
    memoriser();
    setSelection(new Set(await creerVariante(board.id, ids, rects)));
  }

  /** R : colonnes et rangées nettes (la sélection, sinon le niveau principal). */
  async function alignerBlocs(ids?: Id[]) {
    const cibles = (ids ?? (selection.size > 1 ? choisis() : blocs.filter((b) => !b.zoneId).map((b) => b.id))).map((id) => ({ id, ...rects.get(id)! }));
    if (cibles.length < 2) return;
    memoriser();
    const positionsNouvelles = aligner(cibles);
    // Les zones emportent leur contenu.
    const deplacements: { id: Id; x: number; y: number }[] = [];
    for (const p of positionsNouvelles) {
      const r = rects.get(p.id)!;
      deplacements.push(p);
      if (parId.get(p.id)?.type === "zone")
        for (const d of descendants(p.id)) {
          const rd = rects.get(d)!;
          deplacements.push({ id: d, x: rd.x + p.x - r.x, y: rd.y + p.y - r.y });
        }
    }
    await deplacerBlocs(deplacements);
  }

  async function alignerZone(zoneId: Id) {
    const z = rects.get(zoneId)!;
    const enfants = blocs.filter((b) => b.zoneId === zoneId).map((b) => ({ id: b.id, ...rects.get(b.id)! }));
    if (!enfants.length) return;
    memoriser();
    const pos = aligner(enfants, { x: z.x + 24, y: z.y + 72 });
    await deplacerBlocs(pos);
    const boite = englobant(pos.map((p) => ({ ...p, w: rects.get(p.id)!.w, h: rects.get(p.id)!.h })));
    await modifierBloc(zoneId, { largeur: Math.round(Math.max(240, boite.x + boite.w + 24 - z.x)), hauteur: Math.round(Math.max(160, boite.y + boite.h + 24 - z.y)) });
  }

  async function basculerFait(b: Bloc) {
    memoriser();
    let fait: boolean;
    if (b.type === "tache") {
      const t = taches.find((x) => x.id === b.refId);
      if (!t) return;
      fait = !t.faite;
      await basculerTache(t);
    } else {
      fait = !b.fait;
      await modifierBloc(b.id, { fait });
    }
    // Une tâche faite part dans la zone « Fait ».
    if (fait) await rangerDansFait(board.id, b.id, rects);
  }

  /* ---------- Commandes « / » ---------- */

  const commandes: Commande[] = useMemo(
    () => [
      ...categories.map((c) => ({ cle: c.commande, libelle: c.nom, section: "Catégorie", couleur: c.couleur })),
      { cle: "tache", libelle: "Tâche de l’app", section: "Catégorie", alias: ["todo", "task"] },
      { cle: "rappel", libelle: "Rappel", section: "Ajouter", alias: ["alarme", "notif"] },
      { cle: "echeance", libelle: "Échéance", section: "Ajouter", alias: ["date", "deadline"] },
      { cle: "tracklist", libelle: "Tracklist", section: "Bloc", alias: ["musique", "playlist", "son"] },
      { cle: "dossier", libelle: "Dossier", section: "Bloc", alias: ["fichiers", "folder"] },
      { cle: "tableau", libelle: "Tableau", section: "Bloc", alias: ["table", "grille"] },
      { cle: "decoupage", libelle: "Découpage technique", section: "Bloc", alias: ["script", "storyboard", "plans"] },
      { cle: "variante", libelle: "Variante", section: "Bloc", alias: ["version", "v2", "branche"] },
    ],
    [categories],
  );

  async function appliquerCommande(bloc: Bloc, cle: string, html?: string) {
    setEdition(null);
    const b = html === undefined ? bloc : { ...bloc, contenu: html };
    const cat = categories.find((c) => c.commande === cle);
    if (cat) {
      memoriser();
      return void modifierBloc(b.id, { categorieId: b.categorieId === cat.id ? null : cat.id });
    }
    if (cle === "tache") {
      memoriser();
      return void noteEnTache(b);
    }
    if (cle === "rappel" || cle === "echeance") return setProprietes(b.id);
    if (cle === "tracklist" || cle === "dossier" || cle === "tableau" || cle === "decoupage") {
      memoriser();
      await convertir(b, cle);
      if (cle === "tableau" || cle === "decoupage") setEdition({ id: b.id, cellule: { l: 0, c: 0 } });
      return;
    }
    if (cle === "variante") return void varianteSelection([b.id]);
  }

  /* ---------- Clavier ---------- */

  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, select, dialog, [contenteditable=true]")) return;
      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (e.code === "Space" && !espace) {
        e.preventDefault();
        return setEspace(true);
      }
      if (cmd && k === "z") {
        e.preventDefault();
        return e.shiftKey ? retablir() : annuler();
      }
      if (cmd && k === "y") {
        e.preventDefault();
        return retablir();
      }
      if (cmd && k === "a") {
        e.preventDefault();
        return setSelection(new Set(blocs.map((b) => b.id)));
      }
      if (cmd && k === "d") {
        e.preventDefault();
        return void dupliquerSelection();
      }
      if (cmd && k === "f") {
        e.preventDefault();
        return setRecherche({ texte: "", index: 0 });
      }
      if (cmd && (k === "+" || k === "=")) {
        e.preventDefault();
        return zoomerCentre(1.2);
      }
      if (cmd && (k === "-" || k === "_")) {
        e.preventDefault();
        return zoomerCentre(1 / 1.2);
      }
      if (cmd && k === "0") {
        e.preventDefault();
        return zoomExact(1);
      }
      if (cmd) return;
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        return cadrer();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return void supprimerSelection();
      }
      if (e.key === "Escape") {
        setOutil("selection");
        setMenu(null);
        setFiltre(null);
        setRecherche(null);
        return setSelection(new Set());
      }
      if (e.key === "Enter" && selection.size === 1) {
        e.preventDefault();
        const b = parId.get([...selection][0]!);
        if (b) editer(b, undefined, undefined);
        return;
      }
      if (k === "v") return setOutil("selection");
      if (k === "b" || k === "d") return setOutil("crayon");
      if (k === "m") return setOutil("zone");
      if (k === "t" || k === "n") {
        e.preventDefault();
        return void creer("note");
      }
      if (k === "k") return void creer("tache");
      if (k === "r") return void alignerBlocs();
      if (e.key === "/") {
        e.preventDefault();
        return void creer("note", undefined, { contenu: "/" });
      }
      if (/^[1-9]$/.test(e.key)) {
        const c = categories[Number(e.key) - 1];
        if (c) setFiltre((f) => (f === c.id ? null : c.id));
      }
    };
    const haut = (e: KeyboardEvent) => e.code === "Space" && setEspace(false);
    window.addEventListener("keydown", bas);
    window.addEventListener("keyup", haut);
    return () => {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", haut);
    };
  });

  /* ---------- Coller et déposer ---------- */

  useEffect(() => {
    const coller = (e: ClipboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, [contenteditable=true]")) return;
      const fichiersColles = [...(e.clipboardData?.files ?? [])];
      const p = centreEcran();
      if (fichiersColles.length) {
        e.preventDefault();
        memoriser();
        return void importerFichiers(board.id, fichiersColles, p.x, p.y).then((ids) => setSelection(new Set(ids)));
      }
      const texte = e.clipboardData?.getData("text/plain")?.trim();
      if (texte) {
        e.preventDefault();
        memoriser();
        void creerBloc(board.id, "note", p.x, p.y, {
          contenu: texte
            .split("\n")
            .map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;") || "<br>"}</p>`)
            .join(""),
        }).then((b) => setSelection(new Set([b.id])));
      }
    };
    window.addEventListener("paste", coller);
    return () => window.removeEventListener("paste", coller);
  });

  function deposer(e: React.DragEvent) {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const p = pointMonde(e);
    const surBloc = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-bloc]")?.dataset.bloc;
    const cible = surBloc ? parId.get(surBloc) : undefined;
    memoriser();
    void importerFichiers(board.id, [...e.dataTransfer.files], p.x, p.y, cible?.type === "tracklist" || cible?.type === "dossier" ? cible : undefined).then(
      (ids) => ids.length && setSelection(new Set(ids)),
    );
  }

  /* ---------- Recherche et filtres ---------- */

  const texteDe = useCallback(
    (b: Bloc) => {
      const morceau = morceaux.find((m) => m.id === b.refId);
      const contact = contacts.find((c) => c.id === b.refId);
      const tache = taches.find((t) => t.id === b.refId);
      return [
        b.titre,
        texteBrut(b.contenu),
        morceau?.titre,
        contact?.nom,
        tache?.titre,
        ...(b.cellules ?? []).flat(),
        ...(b.morceauIds.map((id) => morceaux.find((m) => m.id === id)?.titre) ?? []),
        ...((b.fichierIds ?? []).map((id) => fichiersParId.get(id)?.nom) ?? []),
      ]
        .filter(Boolean)
        .join(" ");
    },
    [morceaux, contacts, taches, fichiersParId],
  );
  const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const resultats = useMemo(() => {
    if (!recherche?.texte.trim()) return null;
    const q = normaliser(recherche.texte.trim());
    return blocs.filter((b) => normaliser(texteDe(b)).includes(q)).map((b) => b.id);
  }, [recherche?.texte, blocs, texteDe]);

  function allerAuResultat(index: number) {
    if (!resultats?.length) return;
    const id = resultats[((index % resultats.length) + resultats.length) % resultats.length]!;
    const r = rects.get(id)!;
    const c = cadre.current!.getBoundingClientRect();
    setVue((v) => ({ ...v, x: c.width / 2 - (r.x + r.w / 2) * v.zoom, y: c.height / 2 - (r.y + r.h / 2) * v.zoom }));
    setSelection(new Set([id]));
  }

  const estAttenue = (b: Bloc) => {
    if (resultats) return !resultats.includes(b.id) && b.type !== "zone";
    if (filtre) return b.categorieId !== filtre && b.type !== "zone";
    return false;
  };

  /* ---------- Rendu ---------- */

  const zones = blocs.filter((b) => b.type === "zone").sort((a, b) => profondeur(a) - profondeur(b));
  const autres = blocs.filter((b) => b.type !== "zone");
  const pas = PAS_GRILLE * vue.zoom;
  const curseur = espace || geste?.type === "vue" ? (geste?.type === "vue" ? "cursor-grabbing" : "cursor-grab") : outil === "crayon" || outil === "zone" ? "cursor-crosshair" : "";

  const ctx: ContexteBoard = {
    boardId: board.id,
    categories,
    morceaux,
    contacts,
    taches,
    versions,
    fichiers: fichiersParId,
    edition,
    setEdition,
    commandes,
    onCommande: (b, cle, html) => void appliquerCommande(b, cle, html),
    memoriser,
    basculerFait: (b) => void basculerFait(b),
    ajouterMorceaux: (b) => setChoix({ type: "tracklist", cible: b.id }),
  };

  const rendreBloc = (b: Bloc) => {
    const r = rects.get(b.id)!;
    const choisi = selection.has(b.id);
    const redimensionnable = b.type !== "morceau" && b.type !== "contact";
    return (
      <div
        key={b.id}
        ref={mesurer}
        data-bloc={b.id}
        onPointerDown={(e) => debutBloc(e, b)}
        className={`group absolute transition-opacity duration-150 ${outil === "selection" && !espace ? "cursor-grab" : ""} ${estAttenue(b) ? "opacity-25" : ""} ${
          choisi ? "rounded-[20px] outline outline-1 outline-offset-2 outline-texte-2" : ""
        } ${zoneCible === b.id ? "rounded-[30px] outline outline-2 outline-offset-2 outline-texte" : ""} ${resultats?.includes(b.id) ? "rounded-[20px] outline outline-1 outline-offset-4 outline-texte" : ""}`}
        style={{
          left: r.x,
          top: r.y,
          ...(b.type === "zone" || b.type === "image" || b.type === "dessin" ? { width: r.w, height: r.h } : {}),
        }}
      >
        <BlocVue bloc={taillesTemp.has(b.id) ? { ...b, largeur: r.w, hauteur: r.h } : b} />
        {/* Poignée de lien : tirer vers un autre bloc (déjà relié : retire le lien ; dans le vide : crée un bloc relié). */}
        <span
          role="presentation"
          title="Tirer pour relier"
          onPointerDown={(e) => debutLien(e, b)}
          className={`absolute top-1/2 -right-2 z-10 size-4 -translate-y-1/2 cursor-crosshair rounded-full border border-texte-2 bg-fond transition-opacity duration-150 ${
            choisi && selection.size === 1 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
        {redimensionnable && choisi && selection.size === 1 && (
          <span
            role="presentation"
            title="Redimensionner (Maj : proportions, Option : depuis le centre)"
            onPointerDown={(e) => debutTaille(e, b)}
            className="absolute -right-1.5 -bottom-1.5 z-10 size-3 cursor-nwse-resize rounded-[3px] border border-texte-2 bg-fond"
          />
        )}
      </div>
    );
  };

  return (
    <BoardCtx.Provider value={ctx}>
      <div
        className="fixed inset-y-0 right-0 left-[88px] overflow-hidden bg-fond"
        // Un champ qui prend le focus près du bord ferait défiler le board : on l’empêche.
        onScroll={(e) => {
          e.currentTarget.scrollLeft = 0;
          e.currentTarget.scrollTop = 0;
        }}
      >
        <div
          ref={cadre}
          className={`absolute inset-0 touch-none select-none ${curseur}`}
          onScroll={(e) => {
            e.currentTarget.scrollLeft = 0;
            e.currentTarget.scrollTop = 0;
          }}
          onPointerDown={debutFond}
          onPointerMove={mouvement}
          onPointerUp={(e) => void fin(e)}
          onPointerCancel={() => setGeste(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            const el = e.target as HTMLElement;
            const blocId = el.closest<HTMLElement>("[data-bloc]")?.dataset.bloc;
            const lienId = el.closest<SVGElement>("[data-lien]")?.dataset.lien;
            const cellule = el.closest<HTMLElement>("[data-cellule]")?.dataset.cellule?.split("-").map(Number);
            if (blocId && !selection.has(blocId)) setSelection(new Set([blocId]));
            if (lienId) setLienChoisi(lienId);
            setMenu({
              x: e.clientX,
              y: e.clientY,
              monde: pointMonde(e),
              blocId: blocId ?? null,
              lienId: !blocId ? (lienId ?? null) : null,
              cellule: cellule ? { l: cellule[0]!, c: cellule[1]! } : null,
            });
          }}
          onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
          onDrop={deposer}
        >
          <div aria-hidden className="grille-board absolute inset-0" style={{ backgroundSize: `${pas}px ${pas}px`, backgroundPosition: `${vue.x}px ${vue.y}px` }} />
          <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate3d(${vue.x}px, ${vue.y}px, 0) scale(${vue.zoom})` }}>
            {zones.map(rendreBloc)}
            <svg className="absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
              {liens.map((l) => {
                const a = parId.get(l.deBlocId);
                const z = parId.get(l.versBlocId);
                if (!a || !z) return null;
                const d = courbe(rects.get(a.id)!, rects.get(z.id)!);
                const choisi = lienChoisi === l.id;
                const actif = choisi || selection.has(a.id) || selection.has(z.id);
                return (
                  <g key={l.id} data-lien={l.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={actif ? "var(--texte)" : "var(--texte-2)"}
                      strokeWidth={choisi ? 2.5 : 1.5}
                      strokeDasharray={l.type === "variante" ? "5 5" : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                      style={{ pointerEvents: "stroke" }}
                      onPointerDown={(e) => {
                        if (e.button === 2) return;
                        e.stopPropagation();
                        setSelection(new Set());
                        setLienChoisi(l.id);
                      }}
                    />
                  </g>
                );
              })}
              {geste?.type === "lien" && pointeur && parId.get(geste.de) && (
                <path d={courbeVersPoint(rects.get(geste.de)!, pointeur)} fill="none" stroke="var(--texte)" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              )}
              {guides.x !== null && <line x1={guides.x} x2={guides.x} y1={-1e5} y2={1e5} stroke="var(--texte-2)" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
              {guides.y !== null && <line y1={guides.y} y2={guides.y} x1={-1e5} x2={1e5} stroke="var(--texte-2)" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
              {trace.length > 1 && (
                <polyline points={trace.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--texte)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {autres.map(rendreBloc)}
            {lasso && (
              <div
                className={`pointer-events-none absolute border border-texte-2 ${geste?.type === "tracezone" ? "rounded-28 bg-surface/50" : "bg-texte/5"}`}
                style={{ left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h }}
              />
            )}
          </div>

          {blocs.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-[22px]">Ton board est vide.</p>
              <p className="max-w-sm text-texte-2">
                {fr("Double-clic sur le fond pour écrire, ou crée un bloc avec la barre du bas. « / » ouvre les commandes, clic droit pour les options.")}
              </p>
            </div>
          )}
        </div>

        {/* Barre du haut */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-6 px-8 pt-8 lg:px-[72px]">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-fond/90 py-1 pr-2 text-libelle text-texte-2">
            <Link to="/boards" className="hover:text-texte">
              Boards
            </Link>
            <span aria-hidden>/</span>
            <SelecteurBoards board={board} boards={boards} onSupprime={onQuitter} onOuvrir={(id) => naviguer(`/boards/${id}`)} />
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <ActionsEnTete />
              <BoutonIcone icone="annuler" libelle="Annuler (⌘Z)" onClick={annuler} className="bg-fond" />
              <BoutonIcone icone="retablir" libelle="Rétablir (⌘⇧Z)" onClick={retablir} className="bg-fond" />
            </div>
            {(filtre || recherche) && (
              <div className="flex items-center gap-2 rounded-full border border-filet bg-surface py-1 pr-1 pl-4">
                {recherche ? (
                  <>
                    <Icone nom="recherche" taille={14} className="text-texte-2" />
                    <input
                      autoFocus
                      value={recherche.texte}
                      onChange={(e) => setRecherche({ texte: e.target.value, index: 0 })}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          allerAuResultat(recherche.index + (e.shiftKey ? -1 : 0));
                          setRecherche({ ...recherche, index: recherche.index + (e.shiftKey ? -1 : 1) });
                        }
                        if (e.key === "Escape") setRecherche(null);
                      }}
                      placeholder="Chercher sur ce board"
                      aria-label="Chercher sur ce board"
                      className="w-52 bg-transparent text-[15px] focus:outline-none"
                    />
                    <span className="text-libelle text-texte-2 tabular-nums">{resultats ? `${resultats.length}` : ""}</span>
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-[15px]">
                    <span className="size-2 rounded-full" style={{ background: categories.find((c) => c.id === filtre)?.couleur }} />
                    {categories.find((c) => c.id === filtre)?.nom}
                  </span>
                )}
                <BoutonIcone
                  icone="fermer"
                  libelle="Fermer"
                  onClick={() => {
                    setRecherche(null);
                    setFiltre(null);
                  }}
                  className="size-8 border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Outils à gauche */}
        <div className="absolute top-1/2 left-6 flex -translate-y-1/2 flex-col gap-1 rounded-full border border-filet bg-fond p-1">
          {(
            [
              ["selection", "selection", "Sélection (V)"],
              ["crayon", "crayon", "Crayon (B)"],
              ["zone", "zone", "Tracer une zone (M)"],
            ] as [Outil, NomIcone, string][]
          ).map(([o, icone, libelle]) => (
            <button
              key={o}
              type="button"
              aria-label={libelle}
              title={libelle}
              aria-pressed={outil === o}
              onClick={() => setOutil(o)}
              className={`flex size-10 items-center justify-center rounded-full transition-colors duration-150 ${outil === o ? "bg-surface text-texte" : "text-texte-2 hover:text-texte"}`}
            >
              <Icone nom={icone} taille={18} />
            </button>
          ))}
        </div>

        <BarreBas
          onCreer={(type) => void creer(type)}
          onChoisir={(type) => setChoix({ type })}
          onImage={(f) => {
            const p = centreEcran();
            memoriser();
            void importerFichiers(board.id, f, p.x, p.y).then((ids) => setSelection(new Set(ids)));
          }}
          crayon={outil === "crayon"}
          onCrayon={() => setOutil((o) => (o === "crayon" ? "selection" : "crayon"))}
          onAligner={() => void alignerBlocs()}
        />

        {/* Zoom */}
        <div className="absolute right-8 bottom-8 flex items-center gap-1 rounded-full border border-filet bg-fond px-2 py-1 lg:right-[72px]">
          <BoutonIcone icone="moins" libelle="Dézoomer (⌘−)" onClick={() => zoomerCentre(1 / 1.2)} className="size-9 border-transparent" />
          <button type="button" onClick={() => zoomExact(1)} className="w-14 text-center text-[15px] tabular-nums" title="Revenir à 100 % (⌘0)">
            {Math.round(vue.zoom * 100)} %
          </button>
          <BoutonIcone icone="plus" libelle="Zoomer (⌘+)" onClick={() => zoomerCentre(1.2)} className="size-9 border-transparent" />
          <BoutonIcone icone="toutVoir" libelle="Tout voir (Maj+1)" onClick={() => cadrer()} className="size-9 border-transparent" />
        </div>

        {menu && (
          <MenuContextuel
            menu={menu}
            bloc={menu.blocId ? parId.get(menu.blocId) : undefined}
            nbChoisis={selection.size}
            categories={categories}
            aDesLiens={!!menu.blocId && liens.some((l) => l.deBlocId === menu.blocId || l.versBlocId === menu.blocId)}
            onFermer={() => setMenu(null)}
            actions={{
              memoriser,
              creerIci: (type) => void creer(type, menu.monde),
              categorie: (id) => {
                memoriser();
                for (const b of choisis()) void modifierBloc(b, { categorieId: id });
              },
              gererCategories: () => setCategoriesOuvert(true),
              proprietes: () => {
                if (menu.blocId) setProprietes(menu.blocId);
              },
              variante: () => void varianteSelection(),
              dupliquer: () => void dupliquerSelection(),
              supprimer: () => void supprimerSelection(),
              convertir: (cle) => menu.blocId && void appliquerCommande(parId.get(menu.blocId)!, cle),
              sortirDeZone: () => {
                memoriser();
                for (const id of choisis()) void modifierBloc(id, { zoneId: null });
              },
              retirerLiens: () => {
                memoriser();
                for (const l of liens) if (l.deBlocId === menu.blocId || l.versBlocId === menu.blocId) void supprimerLien(l.id);
              },
              couleurZone: (c) => {
                memoriser();
                if (menu.blocId) void modifierBloc(menu.blocId, { couleur: c });
              },
              alignerZone: () => menu.blocId && void alignerZone(menu.blocId),
              renommer: () => menu.blocId && setEdition({ id: menu.blocId }),
              alignerTout: () => void alignerBlocs(),
              toutVoir: () => cadrer(),
              supprimerLien: () => void supprimerSelection(),
              tableau: (cellules) => {
                memoriser();
                if (menu.blocId) void modifierBloc(menu.blocId, { cellules });
              },
            }}
          />
        )}

        {proprietes && parId.get(proprietes) && (
          <PanneauProprietes
            bloc={parId.get(proprietes)!}
            tache={taches.find((t) => t.id === parId.get(proprietes)!.refId)}
            ecran={(() => {
              const r = rects.get(proprietes)!;
              return { x: r.x * vue.zoom + vue.x, y: (r.y + r.h) * vue.zoom + vue.y };
            })()}
            onFermer={() => setProprietes(null)}
            onEnregistrer={(echeance, rappel) => {
              memoriser();
              const b = parId.get(proprietes)!;
              if (b.type === "tache" && b.refId) void modifierTache(b.refId, { echeance });
              else void modifierBloc(b.id, { echeance });
              void modifierBloc(b.id, { rappel, rappelVu: false });
              setProprietes(null);
            }}
          />
        )}

        <GestionCategories ouverte={categoriesOuvert} board={board} onFermer={() => setCategoriesOuvert(false)} />

        <ChoixObjet
          choix={choix?.type ?? null}
          morceaux={morceaux}
          contacts={contacts}
          tracklist={choix?.cible ? parId.get(choix.cible) : undefined}
          onFermer={() => setChoix(null)}
          onChoisir={(type, refId) => {
            setChoix(null);
            void creer(type, undefined, { refId });
          }}
          memoriser={memoriser}
        />
      </div>
    </BoardCtx.Provider>
  );
}

function englobe(a: Rect, b: Rect) {
  return a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
}

