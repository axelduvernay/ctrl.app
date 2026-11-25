/* Écritures de l’onglet Sorties, via les repositories. */

import { depots } from "@/data";
import { ordreChecklist } from "@/content/checklist";
import type { CleChecklist, Evenement, Id, Jour, Metadonnees, Modification, Morceau, PostReseau, Sortie } from "@/types";

export async function creerSortie(morceau: Morceau, date: Jour | null) {
  const [profil] = await depots.profils.lister();
  return depots.sorties.creer({
    morceauId: morceau.id,
    projetId: null,
    date,
    checklist: ordreChecklist.map((cle) => ({ cle, fait: false })),
    metadonnees: { titre: morceau.titre, artistes: profil ? [profil.nomArtiste] : [], credits: [], isrc: "", genre: "" },
  });
}

export function modifierSortie(id: Id, modifs: { date?: Jour | null; metadonnees?: Metadonnees }) {
  return depots.sorties.modifier(id, modifs);
}

export async function basculerPoint(sortie: Sortie, cle: CleChecklist) {
  await depots.sorties.transformer(sortie.id, (s) => ({
    checklist: ordreChecklist.map((c) => {
      const actuel = s.checklist.find((x) => x.cle === c)?.fait ?? false;
      return { cle: c, fait: c === cle ? !actuel : actuel };
    }),
  }));
}

/** Modifie les métadonnées à partir de leur version la plus récente. */
export function majMetadonnees(sortieId: Id, calcul: (m: Metadonnees) => Partial<Metadonnees>) {
  return depots.sorties.transformer(sortieId, (s) => ({ metadonnees: { ...s.metadonnees, ...calcul(s.metadonnees) } }));
}

/** Points cochés automatiquement d’après les données de l’app. */
export function pointsAutomatiques(sortie: Sortie, morceau: Morceau | undefined, posts: PostReseau[]): Partial<Record<CleChecklist, boolean>> {
  const m = sortie.metadonnees;
  return {
    "mix-master": !!morceau?.versionValideeId,
    cover: !!morceau?.coverFichierId,
    metadonnees: !!(m.titre.trim() && m.artistes.length && m.genre.trim()),
    date: !!sortie.date,
    "contenus-reseaux": posts.some((p) => p.sortieId === sortie.id),
  };
}

export function estFait(sortie: Sortie, cle: CleChecklist, auto: Partial<Record<CleChecklist, boolean>>) {
  return !!auto[cle] || !!sortie.checklist.find((x) => x.cle === cle)?.fait;
}

export async function supprimerSortie(id: Id) {
  for (const p of await depots.postsReseaux.trouver("sortieId", id)) await depots.postsReseaux.modifier(p.id, { sortieId: null });
  await depots.sorties.supprimer(id);
}

export function enregistrerPost(post: { id?: Id; date: Jour; plateforme: string; description: string; sortieId: Id | null }) {
  const { id, ...donnees } = post;
  return id ? depots.postsReseaux.modifier(id, donnees) : depots.postsReseaux.creer(donnees);
}

export function supprimerPost(id: Id) {
  return depots.postsReseaux.supprimer(id);
}

/* ---------- Événements du calendrier ---------- */

export function creerEvenement(e: { titre: string; date: Jour; heure: string | null; notes?: string }) {
  return depots.evenements.creer({ titre: e.titre.trim(), date: e.date, heure: e.heure, notes: e.notes ?? "" });
}

export function modifierEvenement(id: Id, modifs: Modification<Evenement>) {
  return depots.evenements.modifier(id, modifs);
}

export function supprimerEvenement(id: Id) {
  return depots.evenements.supprimer(id);
}
