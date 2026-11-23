/* Écritures de l’onglet Réseau, via les repositories et l’intégration Gmail. */

import { depots } from "@/data";
import { integrations } from "@/integrations";
import { creerTache } from "@/features/taches/actions";
import type { Contact, Envoi, Id, Jour, Modification, RoleContact } from "@/types";

export function creerContact(nom: string, role: RoleContact, email: string) {
  return depots.contacts.creer({ nom: nom.trim(), role, email: email.trim(), liens: [], notes: "", morceauIds: [] });
}

export function modifierContact(id: Id, modifs: Modification<Contact>) {
  return depots.contacts.modifier(id, modifs);
}

export async function basculerMorceauEchange(contactId: Id, morceauId: Id) {
  await depots.contacts.transformer(contactId, (c) => ({
    morceauIds: c.morceauIds.includes(morceauId) ? c.morceauIds.filter((x) => x !== morceauId) : [...c.morceauIds, morceauId],
  }));
}

/** Supprime le contact et son historique d’envois. Ses tâches restent. */
export async function supprimerContact(id: Id) {
  for (const e of await depots.envois.trouver("contactId", id)) await depots.envois.supprimer(e.id);
  for (const t of await depots.taches.trouver("contactId", id)) await depots.taches.modifier(t.id, { contactId: null });
  await depots.contacts.supprimer(id);
}

/** Envoi par Gmail (simulé pour l’instant) puis enregistrement dans l’historique. */
export async function envoyerMail(e: { contact: Contact; objet: string; corps: string; morceauIds: Id[]; modeleId: string | null }) {
  const resultat = await integrations.gmail.envoyer({ a: e.contact.email, objet: e.objet, corps: e.corps });
  const envoi = await depots.envois.creer({
    contactId: e.contact.id,
    modeleId: e.modeleId,
    objet: e.objet.trim(),
    corps: e.corps,
    morceauIds: e.morceauIds,
    statut: "envoye",
    simule: resultat.simule,
    envoyeAt: resultat.envoyeAt,
  });
  // Les morceaux envoyés deviennent des morceaux échangés avec ce contact.
  await depots.contacts.transformer(e.contact.id, (c) => ({ morceauIds: [...new Set([...c.morceauIds, ...e.morceauIds])] }));
  return envoi;
}

export function marquerOuvert(envoi: Envoi) {
  return depots.envois.modifier(envoi.id, { statut: envoi.statut === "ouvert" ? "envoye" : "ouvert" });
}

/** Relance = un rappel en tâche, à la date choisie. */
export async function programmerRelance(envoi: Envoi, contact: Contact, date: Jour) {
  await creerTache(`Relancer ${contact.nom}`, { echeance: date, contactId: contact.id, envoiId: envoi.id });
  await depots.envois.modifier(envoi.id, { statut: "relance" });
}

export const libellesStatut: Record<Envoi["statut"], string> = {
  envoye: "Envoyé",
  ouvert: "Ouvert",
  relance: "Relance prévue",
};
