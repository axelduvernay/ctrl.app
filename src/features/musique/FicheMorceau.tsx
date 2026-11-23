import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { ChampSelect, ZoneTexte } from "@/components/Champs";
import { Icone } from "@/components/Icone";
import { LecteurAudio } from "@/components/LecteurAudio";
import { Modale } from "@/components/Modale";
import { depots, useRequete } from "@/data";
import { typesNote } from "@/content/statuts";
import { fr } from "@/content/typo";
import { dateRelative, taille } from "@/lib/format";
import type { Fichier, Morceau, Note, TypeNote, Version } from "@/types";
import {
  ajouterNote,
  basculerVersionValidee,
  definirCover,
  definirProjet,
  estAudio,
  importerVersion,
  modifierMorceau,
  modifierNote,
  retirerCover,
  supprimerMorceau,
  supprimerNote,
  supprimerVersion,
} from "./actions";
import { ChampEnregistre, ChoixStatut, DepotFichiers, Vignette } from "./communs";

export function FicheMorceau() {
  const { id = "" } = useParams();
  const { donnees, chargement } = useRequete(async () => {
    const morceau = await depots.morceaux.obtenir(id);
    if (!morceau) return null;
    const versions = (await depots.versions.trouver("morceauId", id)).sort((a, b) => b.numero - a.numero);
    const fichiers = await Promise.all(versions.map((v) => depots.fichiers.obtenir(v.fichierId)));
    return {
      morceau,
      versions,
      fichiers: Object.fromEntries(fichiers.filter((f): f is Fichier => !!f).map((f) => [f.id, f])),
      notes: await depots.notes.trouver("morceauId", id),
      projets: await depots.projets.lister(),
    };
  }, [id]);

  if (chargement) return null;
  if (!donnees)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-texte-2">Ce morceau n’existe plus.</p>
        <Link to="/musique" className="text-texte underline-offset-4 hover:underline">
          Retour au catalogue
        </Link>
      </div>
    );

  const { morceau, versions, fichiers, notes, projets } = donnees;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-libelle text-texte-2">
          <Link to="/musique" className="hover:text-texte">
            Musique
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate text-texte">{morceau.titre}</span>
        </nav>
        <ChampEnregistre
          libelle="Titre"
          valeur={morceau.titre}
          onEnregistrer={(t) => t.trim() && void modifierMorceau(morceau.id, { titre: t.trim() })}
          className="[&>span]:sr-only"
          classeChamp="-mx-2 w-full rounded-12 bg-transparent px-2 text-[40px] leading-tight font-medium tracking-[-0.03em] text-texte hover:bg-surface focus:bg-surface focus:outline-none"
        />
        <ChoixStatut valeur={morceau.statut} onChange={(statut) => void modifierMorceau(morceau.id, { statut })} />
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-12">
          <Versions morceau={morceau} versions={versions} fichiers={fichiers} />
          <Notes morceauId={morceau.id} notes={notes} />
        </div>
        <Infos morceau={morceau} projets={projets} />
      </div>
    </div>
  );
}

/* ---------- Versions ---------- */

function Versions({ morceau, versions, fichiers }: { morceau: Morceau; versions: Version[]; fichiers: Record<string, Fichier> }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const validee = versions.find((v) => v.id === morceau.versionValideeId);
  const historique = versions.filter((v) => v.id !== validee?.id);

  async function importer(liste: File[]) {
    const audios = liste.filter(estAudio);
    setErreur(audios.length < liste.length ? "Seuls les fichiers audio sont acceptés (wav, mp3, m4a, aiff, flac)." : null);
    for (const f of audios) await importerVersion(morceau.id, f);
  }

  return (
    <DepotFichiers accept="audio/*,.wav,.mp3,.m4a,.aif,.aiff,.flac" multiple onFichiers={(l) => void importer(l)}>
      {(ouvrir, survol) => (
        <section
          aria-labelledby="titre-versions"
          className={`flex flex-col gap-4 rounded-18 transition-colors duration-150 ${survol ? "bg-surface outline outline-1 outline-texte-2" : ""}`}
        >
          <div className="flex items-center justify-between">
            <h2 id="titre-versions" className="text-libelle text-texte-2">
              Versions {versions.length > 0 && <span className="tabular-nums">· {versions.length}</span>}
            </h2>
            <Bouton variante="contour" icone="importer" onClick={ouvrir}>
              Importer
            </Bouton>
          </div>

          {erreur && <p className="text-libelle text-texte-2">{fr(erreur)}</p>}

          {versions.length === 0 ? (
            <button
              type="button"
              onClick={ouvrir}
              className="flex flex-col items-start gap-1 rounded-18 border border-filet px-6 py-8 text-left transition-colors duration-150 hover:bg-surface"
            >
              <span>Aucune version pour l’instant.</span>
              <span className="text-libelle text-texte-2">Glisse un fichier audio ici, ou clique pour en choisir un.</span>
            </button>
          ) : (
            <>
              {validee && (
                <div className="flex flex-col gap-3 rounded-18 border border-filet bg-surface px-5 py-4">
                  <p className="flex items-center gap-2 text-libelle text-texte">
                    <Icone nom="valide" taille={16} className="text-accent" />
                    Version validée
                  </p>
                  <LigneVersion version={validee} fichier={fichiers[validee.fichierId]} morceau={morceau} validee />
                </div>
              )}
              {historique.length > 0 && (
                <ul className="flex flex-col">
                  {historique.map((v) => (
                    <li key={v.id} className="border-t border-filet py-3 first:border-t-0">
                      <LigneVersion version={v} fichier={fichiers[v.fichierId]} morceau={morceau} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </DepotFichiers>
  );
}

function LigneVersion({ version, fichier, morceau, validee = false }: { version: Version; fichier?: Fichier; morceau: Morceau; validee?: boolean }) {
  const [confirmer, setConfirmer] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="flex min-w-0 items-baseline gap-3">
          <span className="text-libelle text-texte-2 tabular-nums">v{version.numero}</span>
          <span className="truncate">{version.nom}</span>
        </p>
        <span className="flex shrink-0 items-center gap-3 text-libelle text-texte-2">
          <span>
            {dateRelative(version.createdAt)}
            {fichier && ` · ${taille(fichier.taille)}`}
          </span>
          <button type="button" onClick={() => void basculerVersionValidee(morceau, version.id)} className="text-texte hover:underline underline-offset-4">
            {validee ? "Retirer" : "Valider"}
          </button>
          <BoutonIcone icone="supprimer" libelle={`Supprimer la version ${version.numero}`} onClick={() => setConfirmer(true)} className="size-8 border-transparent text-texte-2" />
        </span>
      </div>
      <LecteurAudio fichierId={version.fichierId} dureeConnue={fichier?.duree} libelle={`la version ${version.numero}`} />
      <Modale
        ouverte={confirmer}
        titre={`Supprimer la v${version.numero} ?`}
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void supprimerVersion(morceau, version.id).then(() => setConfirmer(false))}>Supprimer</Bouton>
          </>
        }
      >
        <p className="text-texte-2">Le fichier audio sera effacé de l’app. Les autres versions ne bougent pas.</p>
      </Modale>
    </div>
  );
}

/* ---------- Notes ---------- */

function Notes({ morceauId, notes }: { morceauId: string; notes: Note[] }) {
  const [type, setType] = useState<TypeNote>("paroles");
  const [nouvelle, setNouvelle] = useState<string | null>(null);
  const courant = typesNote.find((t) => t.valeur === type)!;
  const liste = notes.filter((n) => n.type === type).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  async function ajouter() {
    const n = await ajouterNote(morceauId, type);
    setNouvelle(n.id);
  }

  return (
    <section aria-labelledby="titre-notes" className="flex flex-col gap-4">
      <h2 id="titre-notes" className="text-libelle text-texte-2">
        Notes
      </h2>
      <div role="tablist" aria-label="Type de note" className="flex flex-wrap gap-6 border-b border-filet">
        {typesNote.map((t) => {
          const n = notes.filter((x) => x.type === t.valeur && x.contenu.trim()).length;
          return (
            <button
              key={t.valeur}
              role="tab"
              aria-selected={type === t.valeur}
              onClick={() => setType(t.valeur)}
              className={`-mb-px border-b pb-3 transition-colors duration-150 ${
                type === t.valeur ? "border-texte text-texte" : "border-transparent text-texte-2 hover:text-texte"
              }`}
            >
              {t.libelle}
              {n > 0 && <span className="ml-2 text-texte-2 tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>

      {liste.map((n) => (
        <BlocNote key={n.id} note={n} libelle={courant.libelle} placeholder={courant.vide} autoFocus={n.id === nouvelle} />
      ))}

      {liste.length === 0 ? (
        <button
          type="button"
          onClick={() => void ajouter()}
          className="rounded-18 border border-filet px-5 py-4 text-left text-texte-2 transition-colors duration-150 hover:bg-surface hover:text-texte"
        >
          {fr(courant.vide)}
        </button>
      ) : (
        <Bouton variante="lien" icone="plus" className="self-start" onClick={() => void ajouter()}>
          Ajouter une note
        </Bouton>
      )}
    </section>
  );
}

function BlocNote({ note, libelle, placeholder, autoFocus }: { note: Note; libelle: string; placeholder: string; autoFocus: boolean }) {
  const [texte, setTexte] = useState(note.contenu);
  // Pendant la frappe, on ne recopie pas la version enregistrée par-dessus.
  const enEdition = useRef(false);
  useEffect(() => {
    if (!enEdition.current) setTexte(note.contenu);
  }, [note.contenu]);

  // Enregistre une seconde après la dernière frappe, et en quittant le champ.
  useEffect(() => {
    if (texte === note.contenu) return;
    const t = setTimeout(() => void modifierNote(note.id, texte), 1000);
    return () => clearTimeout(t);
  }, [texte, note.id, note.contenu]);

  return (
    <div className="group relative">
      <ZoneTexte
        libelle={libelle}
        valeur={texte}
        onChange={setTexte}
        placeholder={fr(placeholder)}
        autoFocus={autoFocus}
        onFocus={() => (enEdition.current = true)}
        onBlur={() => {
          enEdition.current = false;
          if (!texte.trim()) void supprimerNote(note.id);
          else if (texte !== note.contenu) void modifierNote(note.id, texte);
        }}
      />
      <div className="mt-1 flex items-center justify-between text-libelle text-texte-2">
        <span>modifiée {dateRelative(note.updatedAt)}</span>
        <button type="button" onClick={() => void supprimerNote(note.id)} className="opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-texte">
          Supprimer
        </button>
      </div>
    </div>
  );
}

/* ---------- Infos ---------- */

function Infos({ morceau, projets }: { morceau: Morceau; projets: { id: string; titre: string }[] }) {
  const naviguer = useNavigate();
  const [confirmer, setConfirmer] = useState(false);

  return (
    <aside aria-label="Infos" className="flex flex-col gap-6">
      <h2 className="text-libelle text-texte-2">Infos</h2>

      <DepotFichiers
        accept="image/*"
        onFichiers={([img]) => img?.type.startsWith("image/") && void definirCover(morceau, img)}
      >
        {(ouvrir, survol) => (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={ouvrir}
              aria-label={morceau.coverFichierId ? "Remplacer la cover" : "Importer une cover"}
              className={`block w-full rounded-18 transition-opacity duration-150 hover:opacity-90 ${survol ? "outline outline-1 outline-texte-2" : ""}`}
            >
              {morceau.coverFichierId ? (
                <Vignette fichierId={morceau.coverFichierId} taille="plein" arrondi="rounded-18" />
              ) : (
                <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-18 border border-filet text-texte-2">
                  <Icone nom="image" taille={22} />
                  <span className="text-libelle">Importer une cover</span>
                </span>
              )}
            </button>
            {morceau.coverFichierId && (
              <div className="flex gap-4 text-libelle">
                <button type="button" onClick={ouvrir} className="text-texte hover:underline underline-offset-4">
                  Remplacer
                </button>
                <button type="button" onClick={() => void retirerCover(morceau)} className="text-texte-2 hover:text-texte">
                  Retirer
                </button>
              </div>
            )}
          </div>
        )}
      </DepotFichiers>

      <div className="grid grid-cols-2 gap-4">
        <ChampEnregistre
          libelle="BPM"
          numerique
          placeholder="140"
          valeur={morceau.bpm?.toString() ?? ""}
          onEnregistrer={(v) => void modifierMorceau(morceau.id, { bpm: v ? Number(v) : null })}
        />
        <ChampEnregistre
          libelle="Tonalité"
          placeholder="Do mineur"
          valeur={morceau.tonalite ?? ""}
          onEnregistrer={(v) => void modifierMorceau(morceau.id, { tonalite: v.trim() || null })}
        />
      </div>

      <ChampSelect
        libelle="Projet"
        valeur={morceau.projetId ?? ""}
        options={[{ valeur: "", libelle: "Aucun projet" }, ...projets.map((p) => ({ valeur: p.id, libelle: p.titre }))]}
        onChange={(v) => void definirProjet(morceau.id, v || null)}
      />

      <p className="text-libelle text-texte-2">
        Créé {dateRelative(morceau.createdAt)} · modifié {dateRelative(morceau.updatedAt)}
      </p>

      <button type="button" onClick={() => setConfirmer(true)} className="self-start text-libelle text-texte-2 hover:text-texte">
        Supprimer le morceau
      </button>

      <Modale
        ouverte={confirmer}
        titre={`Supprimer « ${morceau.titre} » ?`}
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton
              onClick={async () => {
                await supprimerMorceau(morceau);
                naviguer("/musique", { replace: true });
              }}
            >
              Supprimer
            </Bouton>
          </>
        }
      >
        <p className="text-texte-2">Ses versions, ses notes et sa cover seront effacées de l’app.</p>
      </Modale>
    </aside>
  );
}
