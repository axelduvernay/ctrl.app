import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Bouton } from "@/components/Bouton";
import { ChampSelect, Option, ZoneTexte } from "@/components/Champs";
import { Icone } from "@/components/Icone";
import { Modale } from "@/components/Modale";
import { PastilleStatut } from "@/components/PastilleStatut";
import { depots, useRequete } from "@/data";
import { rolesContact } from "@/content/modelesMail";
import { fr } from "@/content/typo";
import { ajouterJours, dateRelative, jourIso, libelleJour } from "@/lib/format";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { ChampEnregistre } from "@/features/musique/communs";
import { basculerTache } from "@/features/taches/actions";
import type { Contact, Envoi, Morceau, RoleContact } from "@/types";
import { basculerMorceauEchange, libellesStatut, marquerOuvert, modifierContact, programmerRelance, supprimerContact } from "./actions";

export function ContactPage() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const [morceauxOuvert, setMorceauxOuvert] = useState(false);
  const [relance, setRelance] = useState<Envoi | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  const { donnees, chargement } = useRequete(async () => {
    const contact = await depots.contacts.obtenir(id);
    if (!contact) return null;
    const [envois, taches, morceaux] = await Promise.all([
      depots.envois.trouver("contactId", id),
      depots.taches.trouver("contactId", id),
      depots.morceaux.lister(),
    ]);
    return { contact, envois, taches, morceaux };
  }, [id]);

  if (chargement) return null;
  if (!donnees)
    return (
      <p className="text-texte-2">
        Ce contact n’existe plus.{" "}
        <Link to="/reseau" className="text-texte underline-offset-4 hover:underline">
          Retour au réseau
        </Link>
      </p>
    );

  const { contact, envois, taches, morceaux } = donnees;
  const echanges = contact.morceauIds.map((mid) => morceaux.find((m) => m.id === mid)).filter((m): m is Morceau => !!m);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-libelle text-texte-2">
            <Link to="/reseau" className="hover:text-texte">
              Réseau
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate text-texte">{contact.nom}</span>
          </nav>
          <ActionsEnTete />
        </div>
        <div className="flex items-start justify-between gap-6">
          <ChampEnregistre
            libelle="Nom"
            valeur={contact.nom}
            onEnregistrer={(nom) => nom.trim() && void modifierContact(contact.id, { nom: nom.trim() })}
            className="min-w-0 flex-1 [&>span]:sr-only"
            classeChamp="-mx-2 w-full rounded-12 bg-transparent px-2 text-[40px] leading-tight font-medium tracking-[-0.03em] text-texte hover:bg-surface focus:bg-surface focus:outline-none"
          />
          <Bouton icone="envoyer" onClick={() => naviguer(`/reseau/envoi?contact=${contact.id}`)}>
            Écrire un mail
          </Bouton>
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="titre-envois" className="flex flex-col gap-4">
            <h2 id="titre-envois" className="text-libelle text-texte-2">
              Suivi des envois
            </h2>
            {envois.length === 0 ? (
              <p className="text-texte-2">{fr("Aucun envoi à ce contact pour l’instant.")}</p>
            ) : (
              <ul className="flex flex-col">
                {envois
                  .sort((a, b) => b.envoyeAt.localeCompare(a.envoyeAt))
                  .map((e) => (
                    <li key={e.id} className="flex flex-col gap-3 border-t border-filet py-4 last:border-b">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="truncate">{e.objet}</span>
                        <span className="shrink-0 rounded-full border border-filet px-3 py-1 text-libelle">{libellesStatut[e.statut]}</span>
                      </div>
                      <p className="text-libelle text-texte-2">
                        Envoyé {dateRelative(e.envoyeAt)}
                        {e.simule && " · simulé (Gmail n’est pas encore branché)"}
                        {e.morceauIds.length > 0 && ` · ${e.morceauIds.length} morceau${e.morceauIds.length > 1 ? "x" : ""}`}
                      </p>
                      <div className="flex gap-5 text-libelle">
                        <button type="button" onClick={() => void marquerOuvert(e)} className="text-texte hover:underline underline-offset-4">
                          {e.statut === "ouvert" ? "Marquer non ouvert" : "Marquer comme ouvert"}
                        </button>
                        {e.statut !== "relance" && (
                          <button type="button" onClick={() => setRelance(e)} className="text-texte hover:underline underline-offset-4">
                            Prévoir une relance
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
            {envois.some((e) => e.simule) && (
              <p className="text-libelle text-texte-2">{fr("Tant que Gmail est simulé, « ouvert » se marque à la main.")}</p>
            )}
          </section>

          <section aria-labelledby="titre-taches" className="flex flex-col gap-4">
            <h2 id="titre-taches" className="text-libelle text-texte-2">
              Relances et tâches
            </h2>
            {taches.length === 0 ? (
              <p className="text-texte-2">{fr("Aucune tâche liée à ce contact.")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {taches
                  .sort((a, b) => (a.echeance ?? "9").localeCompare(b.echeance ?? "9"))
                  .map((t) => (
                    <li key={t.id} className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={t.faite}
                        aria-label={t.titre}
                        onClick={() => void basculerTache(t)}
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                          t.faite ? "border-accent bg-accent text-sur-accent" : "border-texte-2 hover:border-texte"
                        }`}
                      >
                        {t.faite && <Icone nom="valide" taille={12} />}
                      </button>
                      <span className="flex flex-col">
                        <span className={t.faite ? "text-texte-2 line-through" : ""}>{t.titre}</span>
                        {t.echeance && <span className="text-libelle text-texte-2">{libelleJour(t.echeance)}</span>}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <ChampSelect
            libelle="Rôle"
            valeur={contact.role}
            options={[...rolesContact]}
            onChange={(role) => void modifierContact(contact.id, { role: role as RoleContact })}
          />
          <ChampEnregistre libelle="Mail" valeur={contact.email} placeholder="nom@exemple.fr" onEnregistrer={(email) => void modifierContact(contact.id, { email: email.trim() })} />
          <ChampsLibres contact={contact} />

          <section aria-labelledby="titre-echanges" className="flex flex-col gap-3">
            <h2 id="titre-echanges" className="text-libelle text-texte-2">
              Morceaux échangés
            </h2>
            {echanges.length === 0 && <p className="text-texte-2">Aucun pour l’instant.</p>}
            <ul className="flex flex-col gap-2">
              {echanges.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3">
                  <Link to={`/musique/${m.id}`} className="truncate hover:underline underline-offset-4">
                    {m.titre}
                  </Link>
                  <span className="text-libelle text-texte-2">
                    <PastilleStatut valeur={m.statut} />
                  </span>
                </li>
              ))}
            </ul>
            <Bouton variante="lien" icone="plus" className="self-start" onClick={() => setMorceauxOuvert(true)}>
              Modifier la liste
            </Bouton>
          </section>

          <button type="button" onClick={() => setConfirmer(true)} className="self-start text-libelle text-texte-2 hover:text-texte">
            Supprimer le contact
          </button>
        </aside>
      </div>

      <Modale ouverte={morceauxOuvert} titre="Morceaux échangés" onFermer={() => setMorceauxOuvert(false)} actions={<Bouton onClick={() => setMorceauxOuvert(false)}>Terminé</Bouton>}>
        {morceaux.length === 0 ? (
          <p className="text-texte-2">Ajoute d’abord des morceaux dans Musique.</p>
        ) : (
          <div className="-mx-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-2">
            {morceaux
              .sort((a, b) => a.titre.localeCompare(b.titre, "fr"))
              .map((m) => (
                <Option key={m.id} forme="case" choisi={contact.morceauIds.includes(m.id)} onClick={() => void basculerMorceauEchange(contact.id, m.id)} titre={m.titre} />
              ))}
          </div>
        )}
      </Modale>

      <Relance envoi={relance} contact={contact} onFermer={() => setRelance(null)} />

      <Modale
        ouverte={confirmer}
        titre={`Supprimer ${contact.nom} ?`}
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton
              onClick={async () => {
                await supprimerContact(contact.id);
                naviguer("/reseau", { replace: true });
              }}
            >
              Supprimer
            </Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr("Son historique d’envois sera effacé. Ses tâches restent dans l’app.")}</p>
      </Modale>
    </div>
  );
}

/** Liens (un par ligne) et notes libres, enregistrés en quittant le champ. */
function ChampsLibres({ contact }: { contact: Contact }) {
  const [liens, setLiens] = useState(contact.liens.join("\n"));
  const [notes, setNotes] = useState(contact.notes);
  useEffect(() => setLiens(contact.liens.join("\n")), [contact.liens]);
  useEffect(() => setNotes(contact.notes), [contact.notes]);
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-libelle text-texte-2">Liens (un par ligne)</span>
        <ZoneTexte
          libelle="Liens"
          valeur={liens}
          onChange={setLiens}
          placeholder="instagram.com/…"
          onBlur={() => void modifierContact(contact.id, { liens: liens.split("\n").map((l) => l.trim()).filter(Boolean) })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-libelle text-texte-2">Notes</span>
        <ZoneTexte libelle="Notes" valeur={notes} onChange={setNotes} placeholder="Comment vous vous êtes connus, ce qu’il ou elle cherche…" onBlur={() => void modifierContact(contact.id, { notes })} />
      </div>
    </>
  );
}

function Relance({ envoi, contact, onFermer }: { envoi: Envoi | null; contact: Contact; onFermer(): void }) {
  const [date, setDate] = useState(ajouterJours(jourIso(), 7));
  useEffect(() => {
    if (envoi) setDate(ajouterJours(jourIso(), 7));
  }, [envoi]);
  return (
    <Modale
      ouverte={envoi !== null}
      titre="Prévoir une relance"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="lien" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={() => envoi && void programmerRelance(envoi, contact, date).then(onFermer)} disabled={!date}>
            Ajouter la tâche
          </Bouton>
        </>
      }
    >
      <p className="text-texte-2">{fr(`Une tâche « Relancer ${contact.nom} » apparaîtra dans ta semaine à cette date.`)}</p>
      <label className="flex flex-col gap-2">
        <span className="text-libelle text-texte-2">Date de la relance</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
        />
      </label>
    </Modale>
  );
}
