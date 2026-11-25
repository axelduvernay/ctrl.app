import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { Option, Segmente } from "@/components/Champs";
import { LecteurAudio } from "@/components/LecteurAudio";
import { Modale } from "@/components/Modale";
import { PastilleStatut } from "@/components/PastilleStatut";
import { depots, useRequete } from "@/data";
import { typesProjet } from "@/content/statuts";
import type { Morceau, Projet, Version } from "@/types";
import { ajouterAuProjet, deplacerDansProjet, retirerDuProjet, supprimerProjet } from "./actions";
import { ChampEnregistre, Vignette, versionAEcouter } from "./communs";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { FilAriane } from "@/components/FilAriane";
import type { Piste as PisteLecteur } from "@/stores/lecteur";

/** Projet : liste ordonnée de morceaux, à écouter dans l’ordre. */
export function ProjetPage() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const [ajout, setAjout] = useState(false);
  const [confirmer, setConfirmer] = useState(false);

  const { donnees, chargement } = useRequete(async () => {
    const projet = await depots.projets.obtenir(id);
    if (!projet) return null;
    const [morceaux, versions] = await Promise.all([depots.morceaux.lister(), depots.versions.lister()]);
    const dossier = projet.dossierId ? await depots.dossiers.obtenir(projet.dossierId) : undefined;
    return { projet, morceaux, versions, dossier };
  }, [id]);

  if (chargement) return null;
  if (!donnees)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-texte-2">Ce projet n’existe plus.</p>
        <Link to="/musique" className="underline-offset-4 hover:underline">
          Retour à la librairie
        </Link>
      </div>
    );

  const { projet, morceaux, versions, dossier } = donnees;
  const pistes = projet.morceauIds.map((mid) => morceaux.find((m) => m.id === mid)).filter((m): m is Morceau => !!m);
  const file: PisteLecteur[] = pistes.flatMap((m) => {
    const v = versionAEcouter(m, versions);
    return v ? [{ fichierId: v.fichierId, titre: m.titre, sousTitre: projet.titre, morceauId: m.id, coverFichierId: m.coverFichierId }] : [];
  });
  const parents = [{ libelle: "Musique", vers: "/musique" }, ...(dossier ? [{ libelle: dossier.titre, vers: `/musique?dossier=${dossier.id}` }] : [])];

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <FilAriane liens={parents} courant={projet.titre} />
          <ActionsEnTete />
        </div>
        <div className="flex items-start justify-between gap-6">
          <ChampEnregistre
            libelle="Titre du projet"
            valeur={projet.titre}
            onEnregistrer={(t) => t.trim() && void depots.projets.modifier(projet.id, { titre: t.trim() })}
            className="min-w-0 flex-1 [&>span]:sr-only"
            classeChamp="-mx-2 w-full rounded-12 bg-transparent px-2 text-[40px] leading-tight font-medium tracking-[-0.03em] text-texte hover:bg-surface focus:bg-surface focus:outline-none"
          />
          <Bouton icone="plus" onClick={() => setAjout(true)}>
            Ajouter des morceaux
          </Bouton>
        </div>
        <Segmente libelle="Type" options={typesProjet} valeur={projet.type} onChange={(type) => void depots.projets.modifier(projet.id, { type })} />
      </div>

      <section aria-labelledby="titre-tracklist" className="flex flex-col gap-4">
        <h2 id="titre-tracklist" className="text-libelle text-texte-2">
          Tracklist {pistes.length > 0 && <span className="tabular-nums">· {pistes.length}</span>}
        </h2>
        {pistes.length === 0 ? (
          <button
            type="button"
            onClick={() => setAjout(true)}
            className="rounded-18 border border-filet px-6 py-8 text-left transition-colors duration-150 hover:bg-surface"
          >
            <span className="block">Aucun morceau dans ce projet.</span>
            <span className="text-libelle text-texte-2">Ajoute des morceaux de ta librairie, puis range-les dans l’ordre.</span>
          </button>
        ) : (
          <ol className="flex flex-col rounded-18 border border-filet bg-surface p-2">
            {pistes.map((m, i) => (
              <Piste key={m.id} morceau={m} index={i} total={pistes.length} projet={projet} version={versionAEcouter(m, versions)} file={file} />
            ))}
          </ol>
        )}
      </section>

      <button type="button" onClick={() => setConfirmer(true)} className="self-start text-libelle text-texte-2 hover:text-texte">
        Supprimer le projet
      </button>

      <AjoutMorceaux ouverte={ajout} onFermer={() => setAjout(false)} projet={projet} morceaux={morceaux} />

      <Modale
        ouverte={confirmer}
        titre={`Supprimer « ${projet.titre} » ?`}
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton
              onClick={async () => {
                await supprimerProjet(projet.id);
                naviguer(dossier ? `/musique?dossier=${dossier.id}` : "/musique", { replace: true });
              }}
            >
              Supprimer
            </Bouton>
          </>
        }
      >
        <p className="text-texte-2">Ses morceaux restent dans ta librairie.</p>
      </Modale>
    </div>
  );
}

function Piste({ morceau, index, total, projet, version, file }: { morceau: Morceau; index: number; total: number; projet: Projet; version?: Version; file: PisteLecteur[] }) {
  return (
    <li className="group flex items-center gap-4 rounded-12 px-3 py-2 transition-colors duration-150 hover:bg-filet/60">
      <span className="w-6 text-right text-libelle text-texte-2 tabular-nums">{index + 1}</span>
      {version ? (
        <LecteurAudio compact fichierId={version.fichierId} libelle={morceau.titre} file={file} />
      ) : (
        <span className="size-9 shrink-0" title="Aucune version à écouter" />
      )}
      <Vignette fichierId={morceau.coverFichierId} taille={36} arrondi="rounded-[8px]" />
      <Link to={`/musique/${morceau.id}`} className="min-w-0 flex-1 truncate hover:underline underline-offset-4">
        {morceau.titre}
      </Link>
      <span className="hidden text-libelle text-texte-2 sm:block">
        <PastilleStatut valeur={morceau.statut} />
      </span>
      <span className="flex items-center opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        <BoutonIcone icone="monter" libelle={`Monter ${morceau.titre}`} disabled={index === 0} onClick={() => void deplacerDansProjet(projet.id, index, -1)} className="size-8 border-transparent disabled:opacity-30" />
        <BoutonIcone icone="descendre" libelle={`Descendre ${morceau.titre}`} disabled={index === total - 1} onClick={() => void deplacerDansProjet(projet.id, index, 1)} className="size-8 border-transparent disabled:opacity-30" />
        <BoutonIcone icone="fermer" libelle={`Retirer ${morceau.titre} du projet`} onClick={() => void retirerDuProjet(projet.id, morceau.id)} className="size-8 border-transparent" />
      </span>
    </li>
  );
}

function AjoutMorceaux({
  ouverte,
  onFermer,
  projet,
  morceaux,
}: {
  ouverte: boolean;
  onFermer(): void;
  projet: Projet;
  morceaux: Morceau[];
}) {
  const [choix, setChoix] = useState<string[]>([]);
  const disponibles = morceaux.filter((m) => !projet.morceauIds.includes(m.id)).sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

  async function ajouter() {
    await ajouterAuProjet(projet.id, choix);
    setChoix([]);
    onFermer();
  }

  return (
    <Modale
      ouverte={ouverte}
      titre="Ajouter des morceaux"
      onFermer={onFermer}
      actions={
        disponibles.length > 0 && (
          <>
            <Bouton variante="lien" onClick={onFermer}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void ajouter()} disabled={choix.length === 0}>
              Ajouter{choix.length > 0 && ` (${choix.length})`}
            </Bouton>
          </>
        )
      }
    >
      {disponibles.length === 0 ? (
        <p className="text-texte-2">Tous tes morceaux sont déjà dans ce projet. Ajoute des sons dans ta librairie.</p>
      ) : (
        <div className="-mx-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-2">
          {disponibles.map((m) => {
            return (
              <Option
                key={m.id}
                forme="case"
                choisi={choix.includes(m.id)}
                onClick={() => setChoix((c) => (c.includes(m.id) ? c.filter((x) => x !== m.id) : [...c, m.id]))}
                titre={m.titre}
              />
            );
          })}
        </div>
      )}
    </Modale>
  );
}
