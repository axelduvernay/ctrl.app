import { useState } from "react";
import { Link } from "react-router";
import { Bouton } from "@/components/Bouton";
import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";
import { Icone } from "@/components/Icone";
import { depots, useRequete } from "@/data";
import { ajouterJours, jourIso, libelleJour } from "@/lib/format";
import type { Contact, Morceau, Tache } from "@/types";
import { basculerTache, creerTache, modifierTache, supprimerTache } from "./actions";

/** Toutes les tâches, rangées par échéance. « Cette semaine » sur l’Accueil
    n’en montre qu’une partie. */
export function TachesPage() {
  const [titre, setTitre] = useState("");
  const [echeance, setEcheance] = useState("");
  const [voirFaites, setVoirFaites] = useState(false);
  const { donnees } = useRequete(async () => {
    const [taches, morceaux, contacts] = await Promise.all([depots.taches.lister(), depots.morceaux.lister(), depots.contacts.lister()]);
    return { taches, morceaux, contacts };
  });
  if (!donnees) return null;

  const aujourdHui = jourIso();
  const finSemaine = ajouterJours(aujourdHui, 7);
  const aFaire = donnees.taches.filter((t) => !t.faite).sort((a, b) => (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999"));
  const groupes: { titre: string; taches: Tache[] }[] = [
    { titre: "En retard", taches: aFaire.filter((t) => t.echeance && t.echeance < aujourdHui) },
    { titre: "Aujourd’hui", taches: aFaire.filter((t) => t.echeance === aujourdHui) },
    { titre: "Cette semaine", taches: aFaire.filter((t) => t.echeance && t.echeance > aujourdHui && t.echeance <= finSemaine) },
    { titre: "Plus tard", taches: aFaire.filter((t) => t.echeance && t.echeance > finSemaine) },
    { titre: "Sans date", taches: aFaire.filter((t) => !t.echeance) },
  ];
  const faites = donnees.taches.filter((t) => t.faite).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function ajouter() {
    if (!titre.trim()) return;
    await creerTache(titre, { echeance: echeance || null });
    setTitre("");
    setEcheance("");
  }

  return (
    <div className="flex flex-col gap-10">
      <EnTete surtitre="Accueil" titre="Tâches" />

      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ajouter();
        }}
      >
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Nouvelle tâche"
          aria-label="Nouvelle tâche"
          maxLength={140}
          className="h-12 min-w-64 flex-1 rounded-12 border border-filet bg-surface px-4 text-texte placeholder:text-texte-2 focus:border-texte-2 focus:outline-none"
        />
        <input
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.target.value)}
          aria-label="Échéance"
          className="h-12 rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
        />
        <Bouton type="submit" icone="plus" disabled={!titre.trim()}>
          Ajouter
        </Bouton>
      </form>

      {aFaire.length === 0 && faites.length === 0 ? (
        <EtatVide titre="Aucune tâche pour l’instant." texte="Les tâches que tu ajoutes ici, avec « Capturer », sur un board ou en prévoyant une relance arrivent toutes dans cette liste." />
      ) : (
        <>
          {aFaire.length === 0 && <p className="text-texte-2">Tout est fait.</p>}
          {groupes
            .filter((g) => g.taches.length > 0)
            .map((g) => (
              <section key={g.titre} className="flex flex-col gap-2">
                <h2 className="text-libelle text-texte-2">
                  {g.titre} <span className="tabular-nums">· {g.taches.length}</span>
                </h2>
                <ul className="flex flex-col">
                  {g.taches.map((t) => (
                    <LigneTache key={t.id} tache={t} morceaux={donnees.morceaux} contacts={donnees.contacts} />
                  ))}
                </ul>
              </section>
            ))}
          {faites.length > 0 && (
            <section className="flex flex-col gap-2">
              <button type="button" onClick={() => setVoirFaites((v) => !v)} className="flex items-center gap-2 self-start text-libelle text-texte-2 hover:text-texte">
                <Icone nom={voirFaites ? "descendre" : "suivant"} taille={14} />
                Faites · {faites.length}
              </button>
              {voirFaites && (
                <ul className="flex flex-col">
                  {faites.map((t) => (
                    <LigneTache key={t.id} tache={t} morceaux={donnees.morceaux} contacts={donnees.contacts} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function LigneTache({ tache, morceaux, contacts }: { tache: Tache; morceaux: Morceau[]; contacts: Contact[] }) {
  const [titre, setTitre] = useState<string | null>(null);
  const m = morceaux.find((x) => x.id === tache.morceauId);
  const c = contacts.find((x) => x.id === tache.contactId);
  return (
    <li className="group flex items-center gap-4 border-t border-filet py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={tache.faite}
        aria-label={`Terminer : ${tache.titre}`}
        onClick={() => void basculerTache(tache)}
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
          tache.faite ? "border-accent bg-accent text-sur-accent" : "border-texte-2 hover:border-texte"
        }`}
      >
        {tache.faite && <Icone nom="valide" taille={12} />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <input
          aria-label="Titre de la tâche"
          value={titre ?? tache.titre}
          onChange={(e) => setTitre(e.target.value)}
          onBlur={() => {
            if (titre !== null && titre.trim() && titre !== tache.titre) void modifierTache(tache.id, { titre: titre.trim() });
            setTitre(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className={`w-full bg-transparent focus:outline-none ${tache.faite ? "text-texte-2 line-through" : ""}`}
        />
        {(m || c) && (
          <span className="text-libelle text-texte-2">
            {m && (
              <Link to={`/musique/${m.id}`} className="hover:text-texte">
                {m.titre}
              </Link>
            )}
            {m && c && " · "}
            {c && (
              <Link to={`/reseau/${c.id}`} className="hover:text-texte">
                {c.nom}
              </Link>
            )}
          </span>
        )}
      </div>
      <input
        type="date"
        aria-label={`Échéance : ${tache.echeance ? libelleJour(tache.echeance) : "sans date"}`}
        value={tache.echeance ?? ""}
        onChange={(e) => void modifierTache(tache.id, { echeance: e.target.value || null })}
        className="h-9 rounded-12 border border-filet bg-surface px-3 text-libelle text-texte-2 focus:border-texte-2 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => void supprimerTache(tache.id)}
        className="text-libelle text-texte-2 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-texte"
      >
        Supprimer
      </button>
    </li>
  );
}
