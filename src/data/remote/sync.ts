/* Synchronisation avec Supabase, « local d’abord » :
   - les écrans lisent et écrivent toujours dans IndexedDB (l’app marche sans
     compte et hors ligne) ;
   - chaque écriture est notée dans un journal ; une fois connecté, le journal
     est envoyé au serveur, puis on récupère ce que les autres appareils ont
     changé depuis la dernière fois ;
   - en cas de conflit, la modification la plus récente gagne ;
   - les fichiers (audio, covers, images) vont dans le stockage « fichiers ». */

import { depots, moteurLocal } from "@/data/depots";
import type { Collection } from "@/data/repositories";
import { useCompte } from "@/stores/compte";
import type { Entite } from "@/types";
import type { Distant, LigneDistante, Session } from "./distant";

declare global {
  interface Window {
    /** Faux serveur, pour les tests en développement uniquement. */
    __ctrlappDistant?: Distant;
  }
}

let distant: Distant | null = null;
async function serveur(): Promise<Distant> {
  if (distant) return distant;
  if (import.meta.env.DEV && window.__ctrlappDistant) distant = window.__ctrlappDistant;
  else distant = (await import("./supabase")).creerDistantSupabase();
  return distant;
}

const CLE_COMPTE = "compte";
const CLE_CURSEUR = "curseur";
const maj = (e: Parameters<ReturnType<typeof useCompte.getState>["maj"]>[0]) => useCompte.getState().maj(e);

/* ---------- Connexion ---------- */

export async function envoyerCode(email: string) {
  await (await serveur()).envoyerCode(email.trim().toLowerCase());
}

/** Vérifie le code, relie cet appareil au compte et lance la synchro.
    Renvoie vrai si le compte avait déjà un parcours (il remplace alors celui
    de cet appareil : « le compte prime »). */
export async function verifierCode(email: string, code: string) {
  const d = await serveur();
  const session = await d.verifierCode(email.trim().toLowerCase(), code.trim());
  const compteExistant = (await d.compter("profils")) > 0;
  if (compteExistant) await moteurLocal.effacerSansJournal(["profils", "parcours", "etapes"]);
  await moteurLocal.changerProprietaire(session.uid, session.email);
  await moteurLocal.toutMarquer();
  await moteurLocal.ecrireMeta(CLE_COMPTE, session);
  await moteurLocal.ecrireMeta(CLE_CURSEUR, null);
  maj({ session, erreur: null });
  ecouter();
  await synchroniser();
  return { compteExistant };
}

export async function deconnecter(effacerAppareil = false) {
  arreter();
  try {
    await (await serveur()).deconnecter();
  } catch {
    /* hors ligne : la session locale est oubliée quand même */
  }
  await moteurLocal.ecrireMeta(CLE_COMPTE, null);
  maj({ session: null, etat: "inactif", erreur: null, derniere: null });
  if (effacerAppareil) await depots.toutEffacer();
}

/** Au lancement : reprend la session si cet appareil est relié à un compte.
    Sans compte, la librairie Supabase n’est même pas chargée. */
export async function demarrer() {
  const enregistre = await moteurLocal.meta<Session | null>(CLE_COMPTE);
  if (!enregistre) return;
  const d = await serveur();
  const session = (await d.session().catch(() => null)) ?? (navigator.onLine ? null : enregistre);
  if (!session) {
    await moteurLocal.ecrireMeta(CLE_COMPTE, null);
    return;
  }
  maj({ session });
  d.surSession((s) => {
    if (!s && useCompte.getState().session) void deconnecter();
  });
  ecouter();
  await synchroniser();
}

/* ---------- Déclencheurs ---------- */

let minuteur: ReturnType<typeof setInterval> | null = null;
let differe: ReturnType<typeof setTimeout> | null = null;
let desabonner: (() => void) | null = null;
const surRetour = () => void synchroniser();

function ecouter() {
  arreter();
  // Après chaque écriture (regroupées), toutes les 30 s, au retour sur l’onglet et du réseau.
  desabonner = depots.abonner(() => {
    if (differe) clearTimeout(differe);
    differe = setTimeout(() => void synchroniser(), 1500);
  });
  minuteur = setInterval(() => void synchroniser(), 30_000);
  window.addEventListener("focus", surRetour);
  window.addEventListener("online", surRetour);
}

function arreter() {
  desabonner?.();
  desabonner = null;
  if (minuteur) clearInterval(minuteur);
  if (differe) clearTimeout(differe);
  window.removeEventListener("focus", surRetour);
  window.removeEventListener("online", surRetour);
}

/* ---------- Envoi et réception ---------- */

let enCours: Promise<void> | null = null;
let aRelancer = false;

export function synchroniser(): Promise<void> {
  if (enCours) {
    aRelancer = true;
    return enCours;
  }
  enCours = (async () => {
    try {
      do {
        aRelancer = false;
        await unPassage();
      } while (aRelancer);
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

async function unPassage() {
  const session = useCompte.getState().session;
  if (!session) return;
  if (!navigator.onLine) return maj({ etat: "hors-ligne", attente: (await moteurLocal.attente()).length });
  maj({ etat: "en-cours" });
  try {
    const d = await serveur();
    await envoyer(d, session);
    await recevoir(d);
    maj({ etat: "ok", erreur: null, derniere: new Date().toISOString(), attente: (await moteurLocal.attente()).length });
  } catch (e) {
    maj({ etat: navigator.onLine ? "erreur" : "hors-ligne", erreur: e instanceof Error ? e.message : String(e), attente: (await moteurLocal.attente()).length });
  }
}

async function envoyer(d: Distant, session: Session) {
  const attente = await moteurLocal.attente();
  if (!attente.length) return;
  const lignes: LigneDistante[] = [];
  for (const a of attente) {
    const objet = a.supprime ? undefined : await moteurLocal.lire(a.collection, a.id);
    if (!objet) {
      lignes.push({ owner_id: session.uid, id: a.id, collection: a.collection, donnees: null, supprime: true, modifie_le: a.at });
      continue;
    }
    const { blob, ...donnees } = objet as Entite & { blob?: Blob; chemin?: string };
    if (a.collection === "fichiers" && blob instanceof Blob && !donnees.chemin) {
      // Le fichier part dans le stockage ; la ligne garde seulement son chemin.
      const chemin = `${session.uid}/${a.id}`;
      await d.deposerFichier(chemin, blob);
      donnees.chemin = chemin;
      await moteurLocal.ecrireRecu("fichiers", { ...objet, chemin });
    }
    lignes.push({ owner_id: session.uid, id: a.id, collection: a.collection, donnees, supprime: false, modifie_le: objet.updatedAt });
  }
  await d.envoyer(lignes);
  // On ne retire du journal que ce qui n’a pas rechangé pendant l’envoi.
  const avant = new Map(attente.map((a) => [a.cle, a.at]));
  const apres = await moteurLocal.attente();
  await moteurLocal.retirerAttente(apres.filter((a) => avant.get(a.cle) === a.at).map((a) => a.cle));
}

async function recevoir(d: Distant) {
  const curseur = await moteurLocal.meta<string | null>(CLE_CURSEUR);
  // Petit recouvrement (5 s) pour ne rien manquer ; réappliquer est sans effet.
  const depuis = curseur ? new Date(new Date(curseur).getTime() - 5000).toISOString() : null;
  const lignes = await d.recevoir(depuis);
  if (!lignes.length) return;
  const connues = new Set<string>(moteurLocal.collections());
  const enAttente = new Map((await moteurLocal.attente()).map((a) => [a.cle, a]));
  const touchees = new Set<Collection>();
  let max = curseur ?? "";

  for (const l of lignes) {
    if (l.recu_le && l.recu_le > max) max = l.recu_le;
    if (!connues.has(l.collection)) continue;
    const c = l.collection as Collection;
    const local = await moteurLocal.lire(c, l.id);
    const attente = enAttente.get(`${c}:${l.id}`);
    // Une modification locale plus récente, pas encore envoyée, gagne.
    if (attente && attente.at >= l.modifie_le) continue;
    if (l.supprime) {
      if (local) {
        await moteurLocal.supprimerRecu(c, l.id);
        touchees.add(c);
      }
      continue;
    }
    if (local && local.updatedAt >= l.modifie_le) continue;
    const objet = { ...(l.donnees as Record<string, unknown>) } as Entite & Record<string, unknown>;
    if (c === "fichiers" && typeof objet.chemin === "string") objet.blob = await d.lireFichier(objet.chemin);
    await moteurLocal.ecrireRecu(c, objet);
    if (attente) await moteurLocal.retirerAttente([attente.cle]);
    touchees.add(c);
  }
  if (max) await moteurLocal.ecrireMeta(CLE_CURSEUR, max);
  if (touchees.size) moteurLocal.signaler([...touchees]);
}
