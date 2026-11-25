import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { ChampTexte, Option, Segmente } from "@/components/Champs";
import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";
import { Icone } from "@/components/Icone";
import { LecteurAudio } from "@/components/LecteurAudio";
import { MenuDeroulant } from "@/components/MenuDeroulant";
import { Modale } from "@/components/Modale";
import { PastilleStatut } from "@/components/PastilleStatut";
import { depots, useRequete } from "@/data";
import { typeProjet, typesProjet } from "@/content/statuts";
import { fr } from "@/content/typo";
import { ACCEPTE_AUDIO, choisirFichiers } from "@/lib/choisirFichiers";
import { duree } from "@/lib/format";
import type { Piste } from "@/stores/lecteur";
import type { Dossier, Fichier, Id, Morceau, Projet, TypeProjet, Version } from "@/types";
import {
  ajouterAuProjet,
  creerDossier,
  creerProjet,
  estAudio,
  importerSingles,
  ranger,
  renommerDossier,
  supprimerDossier,
  supprimerMorceau,
  supprimerProjet,
} from "./actions";
import { DepotFichiers, Vignette, versionAEcouter } from "./communs";

/* Musique : une librairie. Des dossiers, des projets (EP, album…) et des
   singles, rangés du plus récent au plus ancien. Un seul bouton : Ajouter. */

type Element = { type: "morceau"; morceau: Morceau } | { type: "projet"; projet: Projet };
type Fenetre = null | "projet" | "dossier" | { renommer: Dossier } | { ranger: { type: "morceau" | "projet"; id: Id } } | { supprimer: Element | { type: "dossier"; dossier: Dossier } };

const GLISSE = "application/x-ctrl-element";

export function MusiquePage() {
  const naviguer = useNavigate();
  const [params] = useSearchParams();
  const dossierId = params.get("dossier");
  const [fenetre, setFenetre] = useState<Fenetre>(null);
  const [imports, setImports] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  const { donnees } = useRequete(async () => {
    const [morceaux, projets, dossiers, versions, fichiers] = await Promise.all([
      depots.morceaux.lister(),
      depots.projets.lister(),
      depots.dossiers.lister(),
      depots.versions.lister(),
      depots.fichiers.lister(),
    ]);
    return { morceaux, projets, dossiers, versions, durees: new Map(fichiers.map((f: Fichier) => [f.id, f.duree])) };
  });
  if (!donnees) return null;
  const { morceaux, projets, dossiers, versions, durees } = donnees;
  const dossier = dossierId ? dossiers.find((d) => d.id === dossierId) : undefined;
  const ici = dossier?.id ?? null;

  async function importer(fichiers: File[]) {
    const audios = fichiers.filter(estAudio);
    setErreur(audios.length < fichiers.length ? "Seuls les fichiers audio sont acceptés (wav, mp3, m4a, aiff, flac)." : null);
    if (!audios.length) return;
    setImports((n) => n + audios.length);
    try {
      const crees = await importerSingles(audios, ici);
      if (crees.length === 1) naviguer(`/musique/${crees[0]!.id}`);
    } finally {
      setImports((n) => n - audios.length);
    }
  }

  const elements: Element[] = [
    ...projets.filter((p) => (p.dossierId ?? null) === ici).map((projet) => ({ type: "projet" as const, projet })),
    ...morceaux
      .filter((m) => (m.dossierId ?? null) === ici && !projets.some((p) => p.id === m.projetId))
      .map((morceau) => ({ type: "morceau" as const, morceau })),
  ].sort((a, b) => maj(b).localeCompare(maj(a)));
  const dossiersIci = ici ? [] : [...dossiers].sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  const vide = elements.length === 0 && dossiersIci.length === 0;

  // File d’écoute : les singles de la vue, dans l’ordre affiché.
  const file: Piste[] = elements.flatMap((e) => {
    if (e.type !== "morceau") return [];
    const v = versionAEcouter(e.morceau, versions);
    return v ? [pisteDe(e.morceau, v, projets)] : [];
  });

  const ajouter = (
    <MenuDeroulant
      libelle="Ajouter"
      cote="droite"
      declencheur={(ouvert, basculer) => (
        <Bouton icone="plus" onClick={basculer} aria-expanded={ouvert}>
          Ajouter
        </Bouton>
      )}
      elements={[
        { libelle: "Nouveau single", icone: "musique", onClick: () => void choisirFichiers(ACCEPTE_AUDIO).then(importer) },
        { libelle: "Nouveau projet", icone: "tracklist", onClick: () => setFenetre("projet") },
        ...(ici ? [] : [{ libelle: "Nouveau dossier", icone: "dossier" as const, onClick: () => setFenetre("dossier") }]),
      ]}
    />
  );

  return (
    <DepotFichiers accept={ACCEPTE_AUDIO} multiple onFichiers={(l) => void importer(l)}>
      {(choisir, survol) => (
        <div className={`flex flex-col gap-10 rounded-28 transition-colors duration-150 ${survol ? "outline outline-1 outline-offset-8 outline-texte-2" : ""}`}>
          <EnTete titre={dossier?.titre ?? "Musique"} retour={dossier ? [{ libelle: "Musique", vers: "/musique" }] : undefined} actions={ajouter} />

          {imports > 0 && (
            <p role="status" className="text-libelle text-texte-2">
              {fr(imports === 1 ? "Import et analyse du son…" : `Import et analyse de ${imports} sons…`)}
            </p>
          )}
          {erreur && <p className="text-libelle text-texte-2">{fr(erreur)}</p>}

          {vide ? (
            <EtatVide
              titre={dossier ? "Ce dossier est vide." : "Ta librairie est vide."}
              texte={
                dossier
                  ? "Glisse un son ici, ou range des morceaux dedans depuis la librairie (menu … d’un morceau)."
                  : "Glisse un fichier audio ici, ou clique sur « Ajouter ». Le BPM et la tonalité sont détectés tout seuls."
              }
              action={
                <Bouton variante="contour" icone="importer" onClick={choisir}>
                  Importer un son
                </Bouton>
              }
            />
          ) : (
            <ul className="flex flex-col">
              {dossiersIci.map((d) => (
                <LigneDossier
                  key={d.id}
                  dossier={d}
                  nombre={morceaux.filter((m) => m.dossierId === d.id).length + projets.filter((p) => p.dossierId === d.id).length}
                  onMenu={setFenetre}
                />
              ))}
              {elements.map((e) =>
                e.type === "morceau" ? (
                  <LigneMorceau
                    key={e.morceau.id}
                    morceau={e.morceau}
                    projets={projets.filter((p) => p.morceauIds.includes(e.morceau.id))}
                    version={versionAEcouter(e.morceau, versions)}
                    duree={durees.get(versionAEcouter(e.morceau, versions)?.fichierId ?? "")}
                    file={file}
                    onMenu={setFenetre}
                  />
                ) : (
                  <LigneProjet key={e.projet.id} projet={e.projet} morceaux={morceaux} versions={versions} durees={durees} onMenu={setFenetre} />
                ),
              )}
            </ul>
          )}

          <Fenetres fenetre={fenetre} onFermer={() => setFenetre(null)} dossiers={dossiers} ici={ici} />
        </div>
      )}
    </DepotFichiers>
  );
}

const maj = (e: Element) => (e.type === "morceau" ? e.morceau.updatedAt : e.projet.updatedAt);

function pisteDe(m: Morceau, v: Version, projets: Projet[]): Piste {
  const projet = projets.find((p) => p.morceauIds.includes(m.id));
  return { fichierId: v.fichierId, titre: m.titre, sousTitre: projet?.titre, morceauId: m.id, coverFichierId: m.coverFichierId };
}

/* ---------- Lignes ---------- */

// Sur téléphone, le statut et la durée (4e et 5e colonnes) laissent la place au titre.
const ligne =
  "group grid grid-cols-[36px_44px_minmax(0,1fr)_36px] items-center gap-3 border-t border-filet py-3 last:border-b max-md:[&>*:nth-child(4)]:hidden max-md:[&>*:nth-child(5)]:hidden md:grid-cols-[36px_44px_minmax(0,1fr)_120px_56px_36px] md:gap-4";

function MenuLigne({ libelle, elements }: { libelle: string; elements: { libelle: string; icone: "dossier" | "supprimer" | "crayon"; onClick(): void }[] }) {
  return (
    <MenuDeroulant
      libelle={libelle}
      cote="droite"
      elements={elements}
      declencheur={(ouvert, basculer) => (
        <BoutonIcone
          icone="menu"
          libelle={libelle}
          onClick={basculer}
          aria-expanded={ouvert}
          className={`size-9 border-transparent text-texte-2 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 ${ouvert ? "opacity-100" : "opacity-0"}`}
        />
      )}
    />
  );
}

function LigneMorceau({
  morceau,
  projets,
  version,
  duree: d,
  file,
  onMenu,
}: {
  morceau: Morceau;
  projets: Projet[];
  version?: Version;
  duree?: number | null;
  file: Piste[];
  onMenu(f: Fenetre): void;
}) {
  const details = [projets.map((p) => p.titre).join(", "), morceau.bpm && `${morceau.bpm} BPM`, morceau.tonalite].filter(Boolean).join(" · ");
  return (
    <li draggable onDragStart={(e) => e.dataTransfer.setData(GLISSE, JSON.stringify({ type: "morceau", id: morceau.id }))} className={ligne}>
      {version ? (
        <LecteurAudio compact fichierId={version.fichierId} libelle={morceau.titre} file={file} />
      ) : (
        <span className="size-9" title="Aucun son pour l’instant" />
      )}
      <Vignette fichierId={morceau.coverFichierId} taille={44} arrondi="rounded-[10px]" />
      <Link to={`/musique/${morceau.id}`} className="flex min-w-0 flex-col hover:underline-offset-4 [&:hover>span:first-child]:underline">
        <span className="flex min-w-0 items-center gap-2">
          <span className="md:hidden">
            <PastilleStatut valeur={morceau.statut} libelle={false} />
          </span>
          <span className="truncate">{morceau.titre}</span>
        </span>
        {details && <span className="truncate text-libelle text-texte-2">{details}</span>}
      </Link>
      <span className="text-libelle text-texte-2">
        <PastilleStatut valeur={morceau.statut} />
      </span>
      <span className="text-right text-libelle text-texte-2 tabular-nums">{d ? duree(d) : ""}</span>
      <MenuLigne
        libelle={`Options de ${morceau.titre}`}
        elements={[
          { libelle: "Ranger dans un dossier", icone: "dossier", onClick: () => onMenu({ ranger: { type: "morceau", id: morceau.id } }) },
          { libelle: "Supprimer", icone: "supprimer", onClick: () => onMenu({ supprimer: { type: "morceau", morceau } }) },
        ]}
      />
    </li>
  );
}

function LigneProjet({
  projet,
  morceaux,
  versions,
  durees,
  onMenu,
}: {
  projet: Projet;
  morceaux: Morceau[];
  versions: Version[];
  durees: Map<string, number | null>;
  onMenu(f: Fenetre): void;
}) {
  const pistes = projet.morceauIds.map((id) => morceaux.find((m) => m.id === id)).filter((m): m is Morceau => !!m);
  const file: Piste[] = pistes.flatMap((m) => {
    const v = versionAEcouter(m, versions);
    return v ? [{ fichierId: v.fichierId, titre: m.titre, sousTitre: projet.titre, morceauId: m.id, coverFichierId: m.coverFichierId }] : [];
  });
  const total = file.reduce((s, p) => s + (durees.get(p.fichierId) ?? 0), 0);
  const cover = pistes.find((m) => m.coverFichierId)?.coverFichierId ?? null;
  const [survol, setSurvol] = useState(false);
  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData(GLISSE, JSON.stringify({ type: "projet", id: projet.id }))}
      // Un morceau glissé sur un projet s’ajoute à la fin de sa tracklist.
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(GLISSE)) return;
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        setSurvol(false);
        const brut = e.dataTransfer.getData(GLISSE);
        if (!brut) return;
        const element = JSON.parse(brut) as { type: string; id: Id };
        if (element.type !== "morceau") return;
        e.preventDefault();
        e.stopPropagation();
        void ajouterAuProjet(projet.id, [element.id]);
      }}
      className={`${ligne} transition-colors duration-150 ${survol ? "bg-surface" : ""}`}
    >
      {file[0] ? <LecteurAudio compact fichierId={file[0].fichierId} libelle={projet.titre} file={file} /> : <span className="size-9" />}
      {cover ? (
        <Vignette fichierId={cover} taille={44} arrondi="rounded-[10px]" />
      ) : (
        <span className="flex size-11 items-center justify-center rounded-[10px] border border-filet text-texte-2">
          <Icone nom="tracklist" taille={18} />
        </span>
      )}
      <Link to={`/musique/projets/${projet.id}`} className="flex min-w-0 flex-col [&:hover>span:first-child]:underline">
        <span className="truncate underline-offset-4">{projet.titre}</span>
        <span className="truncate text-libelle text-texte-2">
          {typeProjet(projet.type)} · {pistes.length === 0 ? "vide" : pistes.length === 1 ? "1 morceau" : `${pistes.length} morceaux`}
        </span>
      </Link>
      <span />
      <span className="text-right text-libelle text-texte-2 tabular-nums">{total ? duree(total) : ""}</span>
      <MenuLigne
        libelle={`Options de ${projet.titre}`}
        elements={[
          { libelle: "Ranger dans un dossier", icone: "dossier", onClick: () => onMenu({ ranger: { type: "projet", id: projet.id } }) },
          { libelle: "Supprimer", icone: "supprimer", onClick: () => onMenu({ supprimer: { type: "projet", projet } }) },
        ]}
      />
    </li>
  );
}

function LigneDossier({ dossier, nombre, onMenu }: { dossier: Dossier; nombre: number; onMenu(f: Fenetre): void }) {
  const [survol, setSurvol] = useState(false);
  return (
    <li
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(GLISSE)) return;
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        const brut = e.dataTransfer.getData(GLISSE);
        if (!brut) return;
        e.preventDefault();
        e.stopPropagation();
        setSurvol(false);
        void ranger(JSON.parse(brut), dossier.id);
      }}
      className={`${ligne} transition-colors duration-150 ${survol ? "bg-surface" : ""}`}
    >
      <span />
      <span className="flex size-11 items-center justify-center rounded-[10px] bg-surface text-texte-2">
        <Icone nom="dossier" taille={18} />
      </span>
      <Link to={`/musique?dossier=${dossier.id}`} className="flex min-w-0 flex-col [&:hover>span:first-child]:underline">
        <span className="truncate underline-offset-4">{dossier.titre}</span>
        <span className="text-libelle text-texte-2">{nombre === 0 ? "vide" : nombre === 1 ? "1 élément" : `${nombre} éléments`}</span>
      </Link>
      <span />
      <span />
      <MenuLigne
        libelle={`Options de ${dossier.titre}`}
        elements={[
          { libelle: "Renommer", icone: "crayon", onClick: () => onMenu({ renommer: dossier }) },
          { libelle: "Supprimer", icone: "supprimer", onClick: () => onMenu({ supprimer: { type: "dossier", dossier } }) },
        ]}
      />
    </li>
  );
}

/* ---------- Fenêtres : créer, renommer, ranger, supprimer ---------- */

function Fenetres({ fenetre, onFermer, dossiers, ici }: { fenetre: Fenetre; onFermer(): void; dossiers: Dossier[]; ici: Id | null }) {
  const naviguer = useNavigate();
  const [titre, setTitre] = useState("");
  const [type, setType] = useState<TypeProjet>("ep");
  const fermer = () => {
    setTitre("");
    onFermer();
  };

  if (fenetre === "projet" || fenetre === "dossier" || (fenetre && "renommer" in fenetre)) {
    const renomme = fenetre !== "projet" && fenetre !== "dossier" ? fenetre.renommer : null;
    const valider = async () => {
      if (!titre.trim() && !renomme) return;
      if (fenetre === "projet") {
        const p = await creerProjet(titre, type, ici);
        fermer();
        naviguer(`/musique/projets/${p.id}`);
      } else if (fenetre === "dossier") {
        await creerDossier(titre);
        fermer();
      } else if (renomme) {
        if (titre.trim()) await renommerDossier(renomme.id, titre);
        fermer();
      }
    };
    return (
      <Modale
        ouverte
        titre={fenetre === "projet" ? "Nouveau projet" : fenetre === "dossier" ? "Nouveau dossier" : "Renommer le dossier"}
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="lien" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void valider()} disabled={!titre.trim() && !renomme}>
              {renomme ? "Renommer" : "Créer"}
            </Bouton>
          </>
        }
      >
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void valider();
          }}
        >
          <ChampTexte
            libelle="Titre"
            valeur={titre || (renomme && !titre ? renomme.titre : titre)}
            onChange={setTitre}
            placeholder={fenetre === "projet" ? "Ex. Projet EP" : "Ex. Prods 2026"}
            autoFocus
            maxLength={120}
          />
          {fenetre === "projet" && <Segmente libelle="Type" options={typesProjet.filter((t) => t.valeur !== "tracklist")} valeur={type} onChange={setType} />}
        </form>
      </Modale>
    );
  }

  if (fenetre && "ranger" in fenetre) {
    const choix = async (d: Id | null) => {
      await ranger(fenetre.ranger, d);
      fermer();
    };
    return (
      <Modale ouverte titre="Ranger dans un dossier" onFermer={fermer}>
        {dossiers.length === 0 ? (
          <p className="text-texte-2">{fr("Aucun dossier pour l’instant. Crée-en un avec « Ajouter », à la racine de Musique.")}</p>
        ) : (
          <div className="-mx-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-2">
            <Option forme="radio" choisi={ici === null} onClick={() => void choix(null)} titre="Aucun dossier" />
            {dossiers.map((d) => (
              <Option key={d.id} forme="radio" choisi={ici === d.id} onClick={() => void choix(d.id)} titre={d.titre} />
            ))}
          </div>
        )}
      </Modale>
    );
  }

  if (fenetre && "supprimer" in fenetre) {
    const cible = fenetre.supprimer;
    const nom = cible.type === "morceau" ? cible.morceau.titre : cible.type === "projet" ? cible.projet.titre : cible.dossier.titre;
    const texte =
      cible.type === "morceau"
        ? "Ses versions, ses notes et sa cover seront effacées de l’app."
        : cible.type === "projet"
          ? "Ses morceaux restent dans ta librairie."
          : "Ce qu’il contient revient à la racine de Musique.";
    const supprimer = async () => {
      if (cible.type === "morceau") await supprimerMorceau(cible.morceau);
      else if (cible.type === "projet") await supprimerProjet(cible.projet.id);
      else {
        await supprimerDossier(cible.dossier.id);
        if (ici === cible.dossier.id) naviguer("/musique", { replace: true });
      }
      fermer();
    };
    return (
      <Modale
        ouverte
        titre={`Supprimer « ${nom} » ?`}
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="lien" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void supprimer()}>Supprimer</Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr(texte)}</p>
      </Modale>
    );
  }
  return null;
}
