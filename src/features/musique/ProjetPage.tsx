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
import { ajouterAuProjet, deplacerDansProjet, estAudio, importerDansProjet, retirerDuProjet, supprimerProjet } from "./actions";
import { ChampEnregistre, DepotFichiers, Vignette, versionAEcouter } from "./communs";
import { ACCEPTE_AUDIO, choisirFichiers } from "@/lib/choisirFichiers";
import { fr } from "@/content/typo";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { FilAriane } from "@/components/FilAriane";
import type { Piste as PisteLecteur } from "@/stores/lecteur";

/** Projet : liste ordonnée de morceaux, à écouter dans l’ordre. */
export function ProjetPage() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const [ajout, setAjout] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [imports, setImports] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

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
  const autres = morceaux.filter((m) => !projet.morceauIds.includes(m.id));

  async function importer(fichiers: File[]) {
    const audios = fichiers.filter(estAudio);
    setErreur(audios.length < fichiers.length ? "Seuls les fichiers audio sont acceptés (wav, mp3, m4a, aiff, flac)." : null);
    if (!audios.length) return;
    setImports(audios.length);
    try {
      await importerDansProjet(projet.id, audios);
    } finally {
      setImports(0);
    }
  }
  const choisir = () => void choisirFichiers(ACCEPTE_AUDIO).then(importer);

  // Bouton principal, centré sous la tracklist : importer depuis l’ordinateur.
  const boutons = (
    <div className="flex flex-col items-center gap-3">
      <Bouton icone="importer" onClick={choisir} disabled={imports > 0}>
        {imports > 0 ? fr(`Import et analyse de ${imports} son${imports > 1 ? "s" : ""}…`) : "Importer des morceaux"}
      </Bouton>
      {autres.length > 0 && (
        <button type="button" onClick={() => setAjout(true)} className="text-libelle text-texte-2 hover:text-texte">
          ou ajouter un morceau déjà dans ta librairie
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <FilAriane liens={parents} courant={projet.titre} />
          <ActionsEnTete />
        </div>
        <ChampEnregistre
          libelle="Titre du projet"
          valeur={projet.titre}
          onEnregistrer={(t) => t.trim() && void depots.projets.modifier(projet.id, { titre: t.trim() })}
          className="[&>span]:sr-only"
          classeChamp="-mx-2 w-full rounded-12 bg-transparent px-2 text-page text-texte hover:bg-surface focus:bg-surface focus:outline-none"
        />
        <Segmente libelle="Type" options={typesProjet} valeur={projet.type} onChange={(type) => void depots.projets.modifier(projet.id, { type })} />
      </div>

      <DepotFichiers accept={ACCEPTE_AUDIO} multiple onFichiers={(l) => void importer(l)}>
        {(_ouvrir, survol) => (
          <section aria-labelledby="titre-tracklist" className="flex flex-col gap-4">
            <h2 id="titre-tracklist" className="text-libelle text-texte-2">
              Tracklist {pistes.length > 0 && <span className="tabular-nums">· {pistes.length}</span>}
            </h2>
            {pistes.length === 0 ? (
              <div
                className={`flex min-h-[320px] flex-col items-center justify-end gap-8 rounded-18 border border-dashed px-6 py-12 text-center transition-colors duration-150 ${
                  survol ? "border-texte-2 bg-surface" : "border-filet"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span>Aucun morceau dans ce projet.</span>
                  <span className="text-libelle text-texte-2">{fr("Importe tes sons depuis ton ordinateur, ou glisse-les ici. Ils s’ajoutent dans l’ordre des noms de fichiers.")}</span>
                </div>
                {boutons}
              </div>
            ) : (
              <>
                <ol className={`flex flex-col rounded-18 border bg-surface p-2 transition-colors duration-150 ${survol ? "border-texte-2" : "border-filet"}`}>
                  {pistes.map((m, i) => (
                    <Piste key={m.id} morceau={m} index={i} total={pistes.length} projet={projet} version={versionAEcouter(m, versions)} file={file} />
                  ))}
                </ol>
                <div className="pt-4">{boutons}</div>
              </>
            )}
            {erreur && <p className="text-center text-libelle text-texte-2">{fr(erreur)}</p>}
          </section>
        )}
      </DepotFichiers>

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
        <p className="text-texte-2">Ses morceaux restent dans ta librairie, comme singles.</p>
      </Modale>
    </div>
  );
}

function Piste({ morceau, index, total, projet, version, file }: { morceau: Morceau; index: number; total: number; projet: Projet; version?: Version; file: PisteLecteur[] }) {
  return (
    <li className="group flex items-center gap-2 rounded-12 px-2 py-2 transition-colors duration-150 hover:bg-filet/60 md:gap-4 md:px-3">
      <span className="w-6 text-right text-libelle text-texte-2 tabular-nums">{index + 1}</span>
      {version ? (
        <LecteurAudio compact fichierId={version.fichierId} libelle={morceau.titre} file={file} />
      ) : (
        <span className="size-9 shrink-0" title="Aucune version à écouter" />
      )}
      <span className="max-md:hidden">
        <Vignette fichierId={morceau.coverFichierId} taille={36} arrondi="rounded-[8px]" />
      </span>
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
      titre="Depuis ta librairie"
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
