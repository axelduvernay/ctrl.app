/* Écritures des Boards, via les repositories. Les nœuds liés pointent vers
   les vrais objets de l’app (tâches, morceaux, contacts). */

import { depots } from "@/data";
import { creerTache } from "@/features/taches/actions";
import { ajouterAuProjet, creerMorceau, estAudio, importerVersion } from "@/features/musique/actions";
import type { Bloc, Categorie, Id, Modification, Projet, TypeBloc, VueBoard } from "@/types";
import { CATEGORIES_PAR_DEFAUT } from "./categories";
import { englobant, ECART, type Rect } from "./geometrie";
import { texteBrut, versHtml } from "./texte";

export function creerBoard(titre: string) {
  return depots.boards.creer({ titre: titre.trim(), vue: { x: 0, y: 0, zoom: 1 }, categories: CATEGORIES_PAR_DEFAUT });
}

export async function supprimerBoard(id: Id) {
  for (const l of await depots.liens.trouver("boardId", id)) await depots.liens.supprimer(l.id);
  for (const b of await depots.blocs.trouver("boardId", id)) await depots.blocs.supprimer(b.id);
  await depots.boards.supprimer(id);
}

const CLE_DERNIER = "ctrlapp.dernierBoard";

export function retenirBoard(id: Id) {
  localStorage.setItem(CLE_DERNIER, id);
}

/** Le board qu’on retrouve en ouvrant l’onglet : le dernier ouvert, sinon le
    plus récent. S’il n’y en a aucun, « Mon board » est créé. */
export async function boardParDefaut() {
  const boards = await depots.boards.lister();
  const dernier = boards.find((b) => b.id === localStorage.getItem(CLE_DERNIER));
  if (dernier) return dernier;
  const recent = [...boards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return recent ?? creerBoard("Mon board");
}

/** Note ajoutée depuis le bouton + : posée au centre de la vue du board
    par défaut, sous les blocs qui y sont déjà. */
export async function ajouterNoteAuBoard(texte: string) {
  const board = await boardParDefaut();
  const { vue } = board;
  const largeur = window.innerWidth - 88;
  const hauteur = window.innerHeight;
  // Vue jamais enregistrée : le board centre l’origine à l’ouverture.
  const centre = vue.x === 0 && vue.y === 0 ? { x: 0, y: 0 } : { x: (largeur / 2 - vue.x) / vue.zoom, y: (hauteur / 2 - vue.y) / vue.zoom };
  const blocs = await depots.blocs.trouver("boardId", board.id);
  const t = tailles.note;
  let y = centre.y;
  const chevauche = () =>
    blocs.some((b) => b.type !== "zone" && Math.abs(b.x + b.largeur / 2 - centre.x) < (b.largeur + t.largeur) / 2 && y + 40 > b.y && y - 40 < b.y + (b.hauteur || 120));
  for (let i = 0; i < 30 && chevauche(); i++) y += 48;
  await creerBloc(board.id, "note", centre.x, y, { contenu: versHtml(texte.trim()) });
  return board;
}

export function enregistrerVue(id: Id, vue: VueBoard) {
  return depots.boards.modifier(id, { vue });
}

export function renommerBoard(id: Id, titre: string) {
  return depots.boards.modifier(id, { titre: titre.trim() });
}

export function majCategories(id: Id, categories: Categorie[]) {
  return depots.boards.modifier(id, { categories });
}

/* ---------- Blocs ---------- */

export const tailles: Record<TypeBloc, { largeur: number; hauteur: number }> = {
  note: { largeur: 240, hauteur: 0 },
  tache: { largeur: 240, hauteur: 0 },
  tracklist: { largeur: 280, hauteur: 0 },
  zone: { largeur: 560, hauteur: 420 },
  morceau: { largeur: 260, hauteur: 0 },
  contact: { largeur: 240, hauteur: 0 },
  image: { largeur: 280, hauteur: 200 },
  dessin: { largeur: 200, hauteur: 120 },
  tableau: { largeur: 420, hauteur: 0 },
  dossier: { largeur: 260, hauteur: 0 },
};

export const DECOUPAGE = ["Séq.", "Plan", "Valeur", "Mouvement", "Action", "Son", "Durée"];

export type ExtraBloc = Partial<Omit<Bloc, "id" | "createdAt" | "updatedAt" | "ownerId" | "boardId" | "type" | "x" | "y">>;

/** Crée un bloc centré sur (x, y). Une tâche crée une vraie tâche de l’app. */
export async function creerBloc(boardId: Id, type: TypeBloc, x: number, y: number, extra: ExtraBloc = {}) {
  let refId = extra.refId ?? null;
  if (type === "tache" && !refId) refId = (await creerTache(extra.titre || "Nouvelle tâche")).id;
  if (type === "tracklist" && !refId) refId = (await nouveauProjetTracklist(extra.titre || "Tracklist", extra.morceauIds ?? [])).id;
  const t = tailles[type];
  const largeur = extra.largeur ?? t.largeur;
  const hauteur = extra.hauteur ?? t.hauteur;
  return depots.blocs.creer({
    zoneId: null,
    titre: type === "zone" ? "Zone" : type === "tracklist" ? "Tracklist" : type === "dossier" ? "Dossier" : "",
    contenu: "",
    morceauIds: [],
    ...(type === "tableau" ? { cellules: [["", "", ""], ["", "", ""], ["", "", ""]] } : {}),
    ...extra,
    boardId,
    type,
    refId,
    largeur,
    hauteur,
    x: Math.round(x - largeur / 2),
    y: Math.round(y - (hauteur || 60) / 2),
  });
}

export function deplacerBlocs(positions: { id: Id; x: number; y: number }[]) {
  return Promise.all(positions.map((p) => depots.blocs.modifier(p.id, { x: Math.round(p.x), y: Math.round(p.y) })));
}

export function modifierBloc(id: Id, modifs: Modification<Bloc>) {
  return depots.blocs.modifier(id, modifs);
}

/* ---------- Tracklists : chacune est un projet de la librairie ---------- */

function nouveauProjetTracklist(titre: string, morceauIds: Id[]) {
  return depots.projets.creer({ titre: titre.trim() || "Tracklist", type: "tracklist", morceauIds, dossierId: null });
}

const enLiaison = new Set<Id>();

/** Tracklist d’avant la librairie (ou dont le projet a été supprimé) :
    son projet est créé avec ses morceaux. */
export async function lierTracklist(bloc: Bloc) {
  if (bloc.type !== "tracklist" || enLiaison.has(bloc.id)) return;
  if (bloc.refId && (await depots.projets.obtenir(bloc.refId))) return;
  enLiaison.add(bloc.id);
  try {
    const p = await nouveauProjetTracklist(bloc.titre, bloc.morceauIds);
    await depots.blocs.modifier(bloc.id, { refId: p.id });
  } finally {
    enLiaison.delete(bloc.id);
  }
}

/** Écrit la liste dans le projet lié (ou dans le bloc s’il n’en a pas). */
async function majPistes(bloc: Bloc, calcul: (ids: Id[]) => Id[]) {
  if (bloc.refId && (await depots.projets.obtenir(bloc.refId))) {
    await depots.projets.transformer(bloc.refId, (p) => ({ morceauIds: calcul(p.morceauIds) }));
  } else await depots.blocs.transformer(bloc.id, (b) => ({ morceauIds: calcul(b.morceauIds) }));
}

export async function basculerMorceauTracklist(id: Id, morceauId: Id) {
  const bloc = await depots.blocs.obtenir(id);
  if (bloc) await majPistes(bloc, (ids) => (ids.includes(morceauId) ? ids.filter((x) => x !== morceauId) : [...ids, morceauId]));
}

export async function ordonnerTracklist(bloc: Bloc, ids: Id[]) {
  await majPistes(bloc, () => ids);
}

export async function renommerTracklist(bloc: Bloc, titre: string) {
  const t = titre.trim() || "Tracklist";
  await depots.blocs.modifier(bloc.id, { titre: t });
  if (bloc.refId && (await depots.projets.obtenir(bloc.refId))) await depots.projets.modifier(bloc.refId, { titre: t });
}

/** Morceaux d’une tracklist : ceux de son projet s’il existe. */
export function pistesDe(bloc: Bloc, projets: Projet[]) {
  return projets.find((p) => p.id === bloc.refId)?.morceauIds ?? bloc.morceauIds;
}

/** Supprime des blocs et leurs liens. Les objets liés (tâche, morceau,
    contact) restent dans l’app ; les blocs d’une zone supprimée en sortent. */
export async function supprimerBlocs(ids: Id[]) {
  const set = new Set(ids);
  for (const l of await depots.liens.lister()) if (set.has(l.deBlocId) || set.has(l.versBlocId)) await depots.liens.supprimer(l.id);
  for (const b of await depots.blocs.lister()) if (b.zoneId && set.has(b.zoneId) && !set.has(b.id)) await depots.blocs.modifier(b.id, { zoneId: null });
  for (const id of ids) {
    const b = await depots.blocs.obtenir(id);
    await depots.blocs.supprimer(id);
    // Une tracklist vide et jamais renommée ne laisse pas de projet vide.
    if (b?.type === "tracklist" && b.refId) {
      const p = await depots.projets.obtenir(b.refId);
      if (p && p.morceauIds.length === 0 && p.titre === "Tracklist") await depots.projets.supprimer(p.id);
    }
  }
}

/* ---------- Liens ---------- */

/** Relie deux blocs ; s’ils l’étaient déjà, le lien est retiré. */
export async function relierOuDelier(boardId: Id, de: Id, vers: Id) {
  if (de === vers) return;
  const existants = await depots.liens.trouver("boardId", boardId);
  const deja = existants.find((l) => (l.deBlocId === de && l.versBlocId === vers) || (l.deBlocId === vers && l.versBlocId === de));
  if (deja) await depots.liens.supprimer(deja.id);
  else await depots.liens.creer({ boardId, deBlocId: de, versBlocId: vers, type: null });
}

export function supprimerLien(id: Id) {
  return depots.liens.supprimer(id);
}

/* ---------- Dupliquer et variantes ---------- */

/** Copie des blocs (et des liens entre eux), décalée de (dx, dy). Une tâche
    copiée devient une nouvelle tâche ; morceaux et contacts restent les mêmes. */
async function copier(boardId: Id, ids: Id[], dx: number, dy: number, variante?: (b: Bloc) => Bloc["variante"]) {
  const blocs = (await depots.blocs.trouver("boardId", boardId)).filter((b) => ids.includes(b.id));
  const correspondance = new Map<Id, Id>();
  for (const b of blocs) {
    const { id: _id, createdAt: _c, updatedAt: _u, ownerId: _o, ...reste } = b;
    let refId = b.refId;
    if (b.type === "tache" && b.refId) {
      const t = await depots.taches.obtenir(b.refId);
      refId = (await creerTache(t?.titre ?? "Tâche", { echeance: t?.echeance ?? null, morceauId: t?.morceauId ?? null })).id;
    }
    if (b.type === "tracklist") {
      const p = b.refId ? await depots.projets.obtenir(b.refId) : undefined;
      refId = (await nouveauProjetTracklist(p?.titre ?? b.titre, p?.morceauIds ?? b.morceauIds)).id;
    }
    const copie = await depots.blocs.creer({
      ...reste,
      refId,
      x: b.x + dx,
      y: b.y + dy,
      zoneId: b.zoneId && ids.includes(b.zoneId) ? b.zoneId : b.zoneId,
      rappel: null,
      rappelVu: false,
      variante: variante ? variante(b) : (b.variante ?? null),
    });
    correspondance.set(b.id, copie.id);
  }
  // Les copies restent dans leurs zones copiées.
  for (const [ancien, nouveau] of correspondance) {
    const b = blocs.find((x) => x.id === ancien)!;
    if (b.zoneId && correspondance.has(b.zoneId)) await depots.blocs.modifier(nouveau, { zoneId: correspondance.get(b.zoneId)! });
  }
  for (const l of await depots.liens.trouver("boardId", boardId)) {
    const a = correspondance.get(l.deBlocId);
    const z = correspondance.get(l.versBlocId);
    if (a && z) await depots.liens.creer({ boardId, deBlocId: a, versBlocId: z, type: l.type ?? null });
  }
  return correspondance;
}

export async function dupliquer(boardId: Id, ids: Id[]) {
  return [...(await copier(boardId, ids, ECART, ECART)).values()];
}

/** /variante : copie le bloc et tout ce qui lui est relié (ou la sélection),
    posée à droite, avec le numéro de version suivant ; un lien pointillé
    rattache les versions. */
export async function creerVariante(boardId: Id, ids: Id[], rects: Map<Id, Rect>) {
  const [blocs, liens] = await Promise.all([depots.blocs.trouver("boardId", boardId), depots.liens.trouver("boardId", boardId)]);
  let ensemble = new Set(ids);
  if (ids.length === 1) {
    // Tout ce qui est relié, de proche en proche (hors liens de variante).
    const file = [...ids];
    while (file.length) {
      const id = file.pop()!;
      for (const l of liens) {
        if (l.type === "variante") continue;
        const autre = l.deBlocId === id ? l.versBlocId : l.versBlocId === id ? l.deBlocId : null;
        if (autre && !ensemble.has(autre)) {
          ensemble.add(autre);
          file.push(autre);
        }
      }
    }
  }
  // Une zone emporte son contenu.
  for (const b of blocs) if (b.zoneId && ensemble.has(b.zoneId)) ensemble.add(b.id);
  ensemble = new Set([...ensemble].filter((id) => blocs.some((b) => b.id === id)));
  const boite = englobant([...ensemble].map((id) => rects.get(id)!).filter(Boolean));
  const principal = ids[0]!;
  const lignee = blocs.find((b) => b.id === principal)?.variante?.lignee ?? principal;
  const numero = Math.max(1, ...blocs.filter((b) => b.variante?.lignee === lignee).map((b) => b.variante!.numero)) + 1;
  const correspondance = await copier(boardId, [...ensemble], boite.w + 80, 0, () => ({ lignee, numero }));
  // L’original devient la v1 s’il n’avait pas de numéro.
  for (const id of ensemble) {
    const b = blocs.find((x) => x.id === id)!;
    if (!b.variante) await depots.blocs.modifier(id, { variante: { lignee, numero: 1 } });
  }
  const copiePrincipale = correspondance.get(principal);
  if (copiePrincipale) await depots.liens.creer({ boardId, deBlocId: principal, versBlocId: copiePrincipale, type: "variante" });
  return [...correspondance.values()];
}

/* ---------- Conversions (commandes « / ») ---------- */

/** Une note devient une vraie tâche de l’app (même objet partout). */
export async function noteEnTache(bloc: Bloc) {
  const titre = texteBrut(bloc.contenu).split("\n")[0] || "Nouvelle tâche";
  const t = await creerTache(titre.slice(0, 140), { echeance: bloc.echeance ?? null });
  await depots.blocs.modifier(bloc.id, { type: "tache", refId: t.id, contenu: "", categorieId: null });
}

export async function convertir(bloc: Bloc, type: "tracklist" | "dossier" | "tableau" | "decoupage") {
  const titre = texteBrut(bloc.contenu).split("\n")[0] || "";
  if (type === "tableau" || type === "decoupage")
    return depots.blocs.modifier(bloc.id, {
      type: "tableau",
      largeur: type === "decoupage" ? 760 : 420,
      cellules: type === "decoupage" ? [DECOUPAGE, DECOUPAGE.map(() => ""), DECOUPAGE.map(() => "")] : [["", "", ""], ["", "", ""], ["", "", ""]],
    });
  const modifie = await depots.blocs.modifier(bloc.id, {
    type,
    titre: titre || (type === "tracklist" ? "Tracklist" : "Dossier"),
    largeur: type === "tracklist" ? 280 : 260,
    contenu: "",
    refId: null,
  });
  if (type === "tracklist") await lierTracklist(modifie);
  return modifie;
}

/* ---------- Fichiers déposés ou collés ---------- */

async function stocker(f: File, duree: number | null = null) {
  return depots.fichiers.creer({ nom: f.name || "Fichier", type: f.type, taille: f.size, blob: f, duree });
}

function tailleImage(f: File): Promise<{ w: number; h: number }> {
  return new Promise((resoudre) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      resoudre({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resoudre({ w: 4, h: 3 });
    img.src = url;
  });
}

/** Images → blocs image ; sons → morceaux de la librairie, rangés dans une
    tracklist ; autres fichiers → dossier. Déposés sur une tracklist ou un
    dossier, ils s’y ajoutent. */
export async function importerFichiers(boardId: Id, fichiers: File[], x: number, y: number, cible?: Bloc) {
  const crees: Id[] = [];
  const images = fichiers.filter((f) => f.type.startsWith("image/"));
  const sons = fichiers.filter((f) => !f.type.startsWith("image/") && estAudio(f));
  const autres = fichiers.filter((f) => !images.includes(f) && !sons.includes(f));

  for (const [i, f] of images.entries()) {
    const { w, h } = await tailleImage(f);
    const largeur = Math.min(360, w);
    const stocke = await stocker(f);
    const b = await creerBloc(boardId, "image", x + i * 32, y + i * 32, { fichierId: stocke.id, largeur, hauteur: Math.round((largeur * h) / w) });
    crees.push(b.id);
  }

  if (sons.length) {
    const ids: Id[] = [];
    for (const f of sons) {
      const m = await creerMorceau(f.name.replace(/\.[^.]+$/, "") || "Sans titre", "maquette");
      await importerVersion(m.id, f);
      ids.push(m.id);
    }
    if (cible?.type === "tracklist") {
      if (cible.refId && (await depots.projets.obtenir(cible.refId))) await ajouterAuProjet(cible.refId, ids);
      else await depots.blocs.transformer(cible.id, (b) => ({ morceauIds: [...b.morceauIds, ...ids] }));
    } else crees.push((await creerBloc(boardId, "tracklist", x, y, { morceauIds: ids })).id);
  }

  if (autres.length) {
    const ids: Id[] = [];
    for (const f of autres) ids.push((await stocker(f)).id);
    if (cible?.type === "dossier") await depots.blocs.transformer(cible.id, (b) => ({ fichierIds: [...(b.fichierIds ?? []), ...ids] }));
    else crees.push((await creerBloc(boardId, "dossier", x, y, { fichierIds: ids })).id);
  }
  return crees;
}

/* ---------- Zone « Fait » ---------- */

/** Une tâche cochée sur le board part dans la zone « Fait », créée à droite
    du board si elle n’existe pas encore. */
export async function rangerDansFait(boardId: Id, blocId: Id, rects: Map<Id, Rect>) {
  const blocs = await depots.blocs.trouver("boardId", boardId);
  let zone = blocs.find((b) => b.type === "zone" && b.titre.trim().toLowerCase() === "fait");
  if (!zone) {
    const tout = englobant([...rects.values()]);
    zone = await depots.blocs.creer({
      boardId,
      type: "zone",
      x: Math.round(tout.x + tout.w + 120),
      y: Math.round(tout.y),
      largeur: 320,
      hauteur: 200,
      zoneId: null,
      titre: "Fait",
      contenu: "",
      refId: null,
      morceauIds: [],
    });
  }
  const dedans = blocs.filter((b) => b.zoneId === zone!.id && b.id !== blocId);
  const r = rects.get(blocId);
  const y = zone.y + 72 + dedans.reduce((s, b) => s + (rects.get(b.id)?.h ?? 60) + 12, 0);
  await depots.blocs.modifier(blocId, { zoneId: zone.id, x: zone.x + 24, y });
  const hauteurUtile = y - zone.y + (r?.h ?? 60) + 24;
  if (hauteurUtile > zone.hauteur) await depots.blocs.modifier(zone.id, { hauteur: Math.round(hauteurUtile) });
  if ((r?.w ?? 0) + 48 > zone.largeur) await depots.blocs.modifier(zone.id, { largeur: Math.round((r?.w ?? 0) + 48) });
}

/* ---------- Anciennes captures ---------- */

let rangement: Promise<void> | null = null;

/** Les notes et mémos capturés sans morceau (ancien « Musique → Captures »)
    trouvent leur place : les notes sur le board, les mémos dans la librairie. */
export function rangerAnciennesCaptures() {
  rangement ??= (async () => {
    const orphelines = (await depots.notes.lister()).filter((n) => !n.morceauId);
    for (const n of orphelines) {
      if (n.fichierId) {
        const jour = new Date(n.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        const m = await creerMorceau(`Mémo vocal du ${jour}`, "idee");
        const f = await depots.fichiers.obtenir(n.fichierId);
        const numero = 1;
        if (f) await depots.versions.creer({ morceauId: m.id, numero, nom: f.nom.replace(/\.[^.]+$/, ""), fichierId: f.id, commentaire: "" });
        if (n.contenu.trim()) await depots.notes.creer({ morceauId: m.id, type: "libre", contenu: n.contenu, fichierId: null });
      } else if (n.contenu.trim()) await ajouterNoteAuBoard(n.contenu);
      await depots.notes.supprimer(n.id);
    }
  })();
  return rangement;
}
