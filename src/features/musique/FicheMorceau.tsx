import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { ChampSelect, ZoneTexte } from "@/components/Champs";
import { FilAriane } from "@/components/FilAriane";
import { Icone } from "@/components/Icone";
import { LecteurAudio } from "@/components/LecteurAudio";
import { MenuDeroulant } from "@/components/MenuDeroulant";
import { Modale } from "@/components/Modale";
import { depots, useRequete } from "@/data";
import { statut as infoStatut, statuts } from "@/content/statuts";
import { fr } from "@/content/typo";
import { ACCEPTE_AUDIO, choisirFichiers } from "@/lib/choisirFichiers";
import { dateRelative } from "@/lib/format";
import type { Fichier, Morceau, Note, Projet, TypeNote, Version } from "@/types";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import {
  basculerVersionValidee,
  corrigerAnalyse,
  definirCover,
  estAudio,
  importerVersion,
  modifierMorceau,
  modifierNote,
  retirerCover,
  supprimerMorceau,
  supprimerNote,
  supprimerVersion,
} from "./actions";
import { ChampEnregistre, DepotFichiers, Vignette, versionAEcouter } from "./communs";

/* Fiche d’un morceau : le son et ses versions à gauche, un espace de notes
   à droite. Le reste (cover, paroles, BPM, tonalité) est dans « Détails ». */

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
      projets: (await depots.projets.lister()).filter((p) => p.morceauIds.includes(id)),
      dossier: morceau.dossierId ? await depots.dossiers.obtenir(morceau.dossierId) : undefined,
    };
  }, [id]);
  const [details, setDetails] = useState(false);

  if (chargement) return null;
  if (!donnees)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-texte-2">Ce morceau n’existe plus.</p>
        <Link to="/musique" className="text-texte underline-offset-4 hover:underline">
          Retour à la librairie
        </Link>
      </div>
    );

  const { morceau, versions, fichiers, notes, projets, dossier } = donnees;
  const maison = projets.find((p) => p.id === morceau.projetId);
  const parents = [
    { libelle: "Musique", vers: "/musique" },
    ...(dossier ? [{ libelle: dossier.titre, vers: `/musique?dossier=${dossier.id}` }] : []),
    ...(maison ? [{ libelle: maison.titre, vers: `/musique/projets/${maison.id}` }] : []),
  ];
  const infos = [morceau.bpm && `${morceau.bpm} BPM`, morceau.tonalite].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <FilAriane liens={parents} courant={morceau.titre} />
          <ActionsEnTete />
        </div>
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            {morceau.coverFichierId && <Vignette fichierId={morceau.coverFichierId} taille={88} arrondi="rounded-18" />}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <ChampEnregistre
                libelle="Titre"
                valeur={morceau.titre}
                onEnregistrer={(t) => t.trim() && void modifierMorceau(morceau.id, { titre: t.trim() })}
                className="[&>span]:sr-only"
                classeChamp="-mx-2 w-full rounded-12 bg-transparent px-2 text-[40px] leading-tight font-medium tracking-[-0.03em] text-texte hover:bg-surface focus:bg-surface focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-4 text-libelle text-texte-2">
                <ChoixStatut morceau={morceau} />
                {infos && <span className="tabular-nums">{infos}</span>}
                {projets.length > 0 && <span>Dans {projets.map((p) => p.titre).join(", ")}</span>}
              </div>
            </div>
          </div>
          <Bouton variante="contour" icone="details" onClick={() => setDetails(true)}>
            Détails
          </Bouton>
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Son morceau={morceau} versions={versions} fichiers={fichiers} projets={projets} />
        <Notes morceauId={morceau.id} notes={notes} />
      </div>

      <Details ouverte={details} onFermer={() => setDetails(false)} morceau={morceau} notes={notes} />
    </div>
  );
}

/* ---------- Statut : menu discret ---------- */

function ChoixStatut({ morceau }: { morceau: Morceau }) {
  const actuel = infoStatut(morceau.statut);
  return (
    <MenuDeroulant
      libelle="Statut"
      elements={statuts.map((s) => ({
        libelle: s.libelle,
        couleur: s.couleur,
        actif: s.valeur === morceau.statut,
        onClick: () => void modifierMorceau(morceau.id, { statut: s.valeur }),
      }))}
      declencheur={(ouvert, basculer) => (
        <button
          type="button"
          onClick={basculer}
          aria-expanded={ouvert}
          aria-label={`Statut : ${actuel.libelle}`}
          className="-ml-2 inline-flex h-8 items-center gap-2 rounded-full px-2 text-texte-2 transition-colors duration-150 hover:bg-surface hover:text-texte"
        >
          <span aria-hidden className="size-2 rounded-full" style={{ background: actuel.couleur }} />
          {actuel.libelle}
          <Icone nom="chevronBas" taille={14} />
        </button>
      )}
    />
  );
}

/* ---------- Le son et ses versions ---------- */

function Son({ morceau, versions, fichiers, projets }: { morceau: Morceau; versions: Version[]; fichiers: Record<string, Fichier>; projets: Projet[] }) {
  const [choisie, setChoisie] = useState<string | null>(null);
  const [import_, setImport] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<Version | null>(null);
  const affichee = versions.find((v) => v.id === choisie) ?? versionAEcouter(morceau, versions);

  async function importer(liste: File[]) {
    const audios = liste.filter(estAudio);
    setErreur(audios.length < liste.length ? "Seuls les fichiers audio sont acceptés (wav, mp3, m4a, aiff, flac)." : null);
    if (!audios.length) return;
    setImport(true);
    try {
      for (const f of audios) await importerVersion(morceau.id, f);
      setChoisie(null);
    } finally {
      setImport(false);
    }
  }

  const ajouter = () => void choisirFichiers(ACCEPTE_AUDIO).then(importer);

  return (
    <DepotFichiers accept={ACCEPTE_AUDIO} multiple onFichiers={(l) => void importer(l)}>
      {(_ouvrir, survol) => (
        <section aria-label="Son" className={`flex min-w-0 flex-col gap-8 rounded-18 transition-colors duration-150 ${survol ? "bg-surface outline outline-1 outline-offset-8 outline-texte-2" : ""}`}>
          {affichee ? (
            <div className="flex flex-col gap-3 rounded-18 border border-filet bg-surface px-5 py-5">
              <LecteurAudio
                fichierId={affichee.fichierId}
                dureeConnue={fichiers[affichee.fichierId]?.duree}
                libelle={`${morceau.titre}, v${affichee.numero}`}
                piste={{ titre: morceau.titre, sousTitre: projets[0]?.titre ?? `v${affichee.numero}`, morceauId: morceau.id, coverFichierId: morceau.coverFichierId }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={ajouter}
              className="flex flex-col items-start gap-1 rounded-18 border border-filet px-6 py-8 text-left transition-colors duration-150 hover:bg-surface"
            >
              <span>{import_ ? "Import et analyse…" : "Aucun son pour l’instant."}</span>
              <span className="text-libelle text-texte-2">Glisse un fichier audio ici, ou clique pour en choisir un.</span>
            </button>
          )}

          {erreur && <p className="text-libelle text-texte-2">{fr(erreur)}</p>}

          {versions.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-libelle text-texte-2">
                  Versions <span className="tabular-nums">· {versions.length}</span>
                </h2>
                <Bouton variante="lien" icone="plus" onClick={ajouter} disabled={import_}>
                  {import_ ? "Analyse…" : "Nouvelle version"}
                </Bouton>
              </div>
              <ul className="flex flex-col">
                {versions.map((v) => {
                  const validee = v.id === morceau.versionValideeId;
                  const active = v.id === affichee?.id;
                  return (
                    <li key={v.id} className="group flex items-center gap-4 border-t border-filet py-2.5 last:border-b">
                      <button type="button" onClick={() => setChoisie(v.id)} className="flex min-w-0 flex-1 items-baseline gap-3 text-left" aria-pressed={active}>
                        <span className="w-7 text-libelle text-texte-2 tabular-nums">v{v.numero}</span>
                        <span className={`truncate ${active ? "text-texte" : "text-texte-2 hover:text-texte"}`}>{v.nom}</span>
                        {validee && <Icone nom="valide" taille={14} className="shrink-0 self-center text-accent" />}
                      </button>
                      <span className="shrink-0 text-libelle text-texte-2">{dateRelative(v.createdAt)}</span>
                      <span className="flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                        <button type="button" onClick={() => void basculerVersionValidee(morceau, v.id)} className="px-2 text-libelle text-texte hover:underline underline-offset-4">
                          {validee ? "Retirer la validation" : "Valider"}
                        </button>
                        <BoutonIcone icone="supprimer" libelle={`Supprimer la version ${v.numero}`} onClick={() => setConfirmer(v)} className="size-8 border-transparent text-texte-2" />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <Modale
            ouverte={confirmer !== null}
            titre={`Supprimer la v${confirmer?.numero ?? ""} ?`}
            onFermer={() => setConfirmer(null)}
            actions={
              <>
                <Bouton variante="lien" onClick={() => setConfirmer(null)}>
                  Annuler
                </Bouton>
                <Bouton onClick={() => void supprimerVersion(morceau, confirmer!.id).then(() => setConfirmer(null))}>Supprimer</Bouton>
              </>
            }
          >
            <p className="text-texte-2">Le fichier audio sera effacé de l’app. Les autres versions ne bougent pas.</p>
          </Modale>
        </section>
      )}
    </DepotFichiers>
  );
}

/* ---------- Notes : un seul espace, enregistré tout seul ---------- */

/** Texte d’une note du morceau (créée à la première frappe), enregistré une
    seconde après la dernière frappe et en quittant le champ. */
function useNote(morceauId: string, note: Note | undefined, type: TypeNote) {
  const [texte, setTexte] = useState(note?.contenu ?? "");
  const enEdition = useRef(false);
  const id = useRef(note?.id ?? null);
  id.current = note?.id ?? id.current;
  useEffect(() => {
    if (!enEdition.current) setTexte(note?.contenu ?? "");
  }, [note?.contenu]);

  const enregistrer = async (valeur: string) => {
    if (id.current) return void (await modifierNote(id.current, valeur));
    if (!valeur.trim()) return;
    const n = await depots.notes.creer({ morceauId, type, contenu: valeur, fichierId: null });
    id.current = n.id;
  };
  useEffect(() => {
    if (texte === (note?.contenu ?? "")) return;
    const t = setTimeout(() => void enregistrer(texte), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte]);

  return {
    texte,
    setTexte,
    onFocus: () => (enEdition.current = true),
    onBlur: () => {
      enEdition.current = false;
      if (texte !== (note?.contenu ?? "")) void enregistrer(texte);
    },
  };
}

function Notes({ morceauId, notes }: { morceauId: string; notes: Note[] }) {
  const tri = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const principale = tri.find((n) => n.type !== "paroles" && !n.fichierId);
  const autres = tri.filter((n) => n.type !== "paroles" && n !== principale);
  const champ = useNote(morceauId, principale, "libre");

  return (
    <aside aria-labelledby="titre-notes" className="flex flex-col gap-4">
      <h2 id="titre-notes" className="text-libelle text-texte-2">Notes</h2>
      <ZoneTexte
        libelle="Notes"
        valeur={champ.texte}
        onChange={champ.setTexte}
        onFocus={champ.onFocus}
        onBlur={champ.onBlur}
        placeholder={fr("Idées, retours, ce qu’il reste à faire… Tout s’enregistre tout seul.")}
      />
      {/* Notes d’avant (mémos vocaux, notes par type) : gardées telles quelles. */}
      {autres.map((n) => (
        <div key={n.id} className="group flex flex-col gap-2">
          {n.fichierId && <LecteurAudio fichierId={n.fichierId} libelle="le mémo vocal" />}
          {n.contenu && <p className="whitespace-pre-wrap text-texte-2">{n.contenu}</p>}
          <button type="button" onClick={() => void supprimerNote(n.id)} className="self-start text-libelle text-texte-2 opacity-0 group-hover:opacity-100 hover:text-texte">
            Supprimer
          </button>
        </div>
      ))}
    </aside>
  );
}

/* ---------- Détails : cover, paroles, BPM, tonalité ---------- */

const NOTES = ["Do", "Do♯", "Ré", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
const TONALITES = NOTES.flatMap((n) => [`${n} majeur`, `${n} mineur`]);

function Details({ ouverte, onFermer, morceau, notes }: { ouverte: boolean; onFermer(): void; morceau: Morceau; notes: Note[] }) {
  const naviguer = useNavigate();
  const [confirmer, setConfirmer] = useState(false);
  const paroles = useNote(morceau.id, notes.find((n) => n.type === "paroles"), "paroles");
  const bpm = morceau.bpm;
  const auto = morceau.analyseAuto !== false && (bpm || morceau.tonalite);
  const tonalites = morceau.tonalite && !TONALITES.includes(morceau.tonalite) ? [morceau.tonalite, ...TONALITES] : TONALITES;

  return (
    <>
      <Modale ouverte={ouverte && !confirmer} titre="Détails" onFermer={onFermer} actions={<Bouton onClick={onFermer}>Terminé</Bouton>}>
        <div className="-mx-2 flex max-h-[62vh] flex-col gap-8 overflow-y-auto px-2">
          <DepotFichiers accept="image/*" onFichiers={([img]) => img?.type.startsWith("image/") && void definirCover(morceau, img)}>
            {(ouvrir, survol) => (
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={ouvrir}
                  aria-label={morceau.coverFichierId ? "Remplacer la cover" : "Importer une cover"}
                  className={`shrink-0 rounded-18 transition-opacity duration-150 hover:opacity-90 ${survol ? "outline outline-1 outline-texte-2" : ""}`}
                >
                  {morceau.coverFichierId ? (
                    <Vignette fichierId={morceau.coverFichierId} taille={96} arrondi="rounded-18" />
                  ) : (
                    <span className="flex size-24 items-center justify-center rounded-18 border border-filet text-texte-2">
                      <Icone nom="image" taille={22} />
                    </span>
                  )}
                </button>
                <div className="flex flex-col gap-1">
                  <span>Cover</span>
                  <span className="flex gap-4 text-libelle">
                    <button type="button" onClick={ouvrir} className="text-texte hover:underline underline-offset-4">
                      {morceau.coverFichierId ? "Remplacer" : "Importer une image"}
                    </button>
                    {morceau.coverFichierId && (
                      <button type="button" onClick={() => void retirerCover(morceau)} className="text-texte-2 hover:text-texte">
                        Retirer
                      </button>
                    )}
                  </span>
                </div>
              </div>
            )}
          </DepotFichiers>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_1.4fr] gap-4">
              <div className="flex flex-col gap-2">
                <ChampEnregistre
                  libelle="BPM"
                  numerique
                  placeholder="—"
                  valeur={bpm?.toString() ?? ""}
                  onEnregistrer={(v) => void corrigerAnalyse(morceau.id, { bpm: v ? Number(v) : null })}
                />
                {bpm && (
                  // Le tempo d’un son peut se lire au double ou à la moitié (trap : 140 ou 70).
                  <span className="flex gap-3 text-libelle">
                    <button type="button" onClick={() => void corrigerAnalyse(morceau.id, { bpm: Math.round(bpm / 2) })} className="text-texte-2 hover:text-texte">
                      ÷ 2
                    </button>
                    <button type="button" onClick={() => void corrigerAnalyse(morceau.id, { bpm: bpm * 2 })} className="text-texte-2 hover:text-texte">
                      × 2
                    </button>
                  </span>
                )}
              </div>
              <ChampSelect
                libelle="Tonalité"
                valeur={morceau.tonalite ?? ""}
                options={[{ valeur: "", libelle: "Inconnue" }, ...tonalites.map((t) => ({ valeur: t, libelle: t }))]}
                onChange={(v) => void corrigerAnalyse(morceau.id, { tonalite: v || null })}
              />
            </div>
            <p className="text-libelle text-texte-2">
              {fr(auto ? "Détectés à l’import du son. Tu peux les corriger." : morceau.analyseAuto === false ? "Réglés à la main." : "Détectés quand tu importes un son.")}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-libelle text-texte-2">Paroles</span>
            <ZoneTexte libelle="Paroles" valeur={paroles.texte} onChange={paroles.setTexte} onFocus={paroles.onFocus} onBlur={paroles.onBlur} placeholder="Écris ou colle tes paroles ici." />
          </div>

          <p className="text-libelle text-texte-2">
            Créé {dateRelative(morceau.createdAt)} · modifié {dateRelative(morceau.updatedAt)}
          </p>
          <button type="button" onClick={() => setConfirmer(true)} className="self-start text-libelle text-texte-2 hover:text-texte">
            Supprimer le morceau
          </button>
        </div>
      </Modale>

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
    </>
  );
}
