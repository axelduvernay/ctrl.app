/* Rendu d’un bloc du board selon son type. Les nœuds liés (tâche, morceau,
   contact) affichent l’objet de l’app : le même partout. */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Icone } from "@/components/Icone";
import { LecteurAudio } from "@/components/LecteurAudio";
import { PastilleStatut } from "@/components/PastilleStatut";
import { depots, useUrlFichier } from "@/data";
import { libelleRole } from "@/content/modelesMail";
import { libelleJour, taille } from "@/lib/format";
import { Vignette } from "@/features/musique/communs";
import { modifierMorceau } from "@/features/musique/actions";
import { basculerTache, modifierTache } from "@/features/taches/actions";
import type { Bloc, Morceau, Tache, Version } from "@/types";
import { modifierBloc, ordonnerTracklist, pistesDe, renommerTracklist } from "./actions";
import { useBoard } from "./contexte";
import { EditeurTexte } from "./EditeurTexte";
import { Tableau } from "./Tableau";
import { nettoyer, versHtml } from "./texte";

/** La version validée si elle existe, sinon la plus récente. */
export function versionAEcouter(m: Morceau, versions: Version[]) {
  const siennes = versions.filter((v) => v.morceauId === m.id);
  return siennes.find((v) => v.id === m.versionValideeId) ?? [...siennes].sort((a, b) => b.numero - a.numero)[0];
}

const carte = "rounded-18 border border-filet bg-surface";
const stop = { onPointerDown: (e: { stopPropagation(): void }) => e.stopPropagation() };

export function BlocVue({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case "zone":
      return <Zone bloc={bloc} />;
    case "note":
      return <Note bloc={bloc} />;
    case "tache":
      return <BlocTache bloc={bloc} />;
    case "tracklist":
      return <Tracklist bloc={bloc} />;
    case "morceau":
      return <BlocMorceau bloc={bloc} />;
    case "contact":
      return <BlocContact bloc={bloc} />;
    case "image":
      return <BlocImage bloc={bloc} />;
    case "dessin":
      return <Dessin bloc={bloc} />;
    case "tableau":
      return <BlocTableau bloc={bloc} />;
    case "dossier":
      return <Dossier bloc={bloc} />;
  }
}

/* ---------- Pastilles communes : catégorie, échéance, rappel, version ---------- */

function Pastilles({ bloc, echeance }: { bloc: Bloc; echeance?: string | null }) {
  const { categories } = useBoard();
  const cat = categories.find((c) => c.id === bloc.categorieId);
  const date = echeance ?? bloc.echeance;
  if (!cat && !date && !bloc.rappel && !bloc.variante) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-texte-2">
      {cat && (
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: cat.couleur }} />
          {cat.nom}
        </span>
      )}
      {date && (
        <span className="flex items-center gap-1">
          <Icone nom="echeance" taille={12} />
          {libelleJour(date)}
        </span>
      )}
      {bloc.rappel && (
        <span className={`flex items-center gap-1 ${bloc.rappelVu ? "line-through" : ""}`}>
          <Icone nom="rappel" taille={12} />
          {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(bloc.rappel))}
        </span>
      )}
      {bloc.variante && <span className="ml-auto rounded-full border border-filet px-1.5 tabular-nums">v{bloc.variante.numero}</span>}
    </div>
  );
}

/** Texte d’une ligne modifiable en place (titres de zone, tracklist…). */
function TexteLigne({ id, valeur, placeholder, onEnregistrer, className = "" }: { id: string; valeur: string; placeholder: string; onEnregistrer(v: string): void; className?: string }) {
  const { edition, setEdition, memoriser } = useBoard();
  const [texte, setTexte] = useState(valeur);
  const actif = edition?.id === id;
  useEffect(() => {
    if (!actif) setTexte(valeur);
  }, [valeur, actif]);
  if (!actif) return <span className={`${className} ${valeur ? "" : "text-texte-2"}`}>{valeur || placeholder}</span>;
  const quitter = () => {
    if (texte !== valeur) {
      memoriser();
      onEnregistrer(texte);
    }
    setEdition(null);
  };
  return (
    <input
      autoFocus
      value={texte}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={quitter}
      {...stop}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
      }}
      className={`${className} w-full bg-transparent focus:outline-none`}
    />
  );
}

/* ---------- Zone ---------- */

function Zone({ bloc }: { bloc: Bloc }) {
  const fond = bloc.couleur ? `color-mix(in srgb, ${bloc.couleur} 12%, var(--surface))` : undefined;
  return (
    <div className="size-full rounded-28 border border-filet bg-surface/50 p-6" style={{ width: bloc.largeur, height: bloc.hauteur, background: fond }}>
      <span data-titre-zone className="inline-block max-w-full cursor-text">
        <TexteLigne
          id={bloc.id}
          valeur={bloc.titre}
          placeholder="Zone"
          onEnregistrer={(titre) => void modifierBloc(bloc.id, { titre: titre.trim() || "Zone" })}
          className="text-[22px] tracking-[-0.01em]"
        />
      </span>
    </div>
  );
}

/* ---------- Note (texte riche) ---------- */

function Note({ bloc }: { bloc: Bloc }) {
  const { edition, setEdition, commandes, onCommande, memoriser, categories, basculerFait } = useBoard();
  const cat = categories.find((c) => c.id === bloc.categorieId);
  const enEdition = edition?.id === bloc.id;

  return (
    <div className={`${carte} flex flex-col gap-2 px-5 py-4`} style={{ width: bloc.largeur }}>
      <div className="flex items-start gap-3">
        <div className={`min-w-0 flex-1 ${bloc.fait ? "text-texte-2 line-through" : ""}`}>
          {enEdition ? (
            <EditeurTexte
              html={bloc.contenu}
              point={edition?.point}
              commandes={commandes}
              onEnregistrer={(html) => {
                if (html !== nettoyer(versHtml(bloc.contenu))) {
                  memoriser();
                  void modifierBloc(bloc.id, { contenu: html });
                }
              }}
              onQuitter={() => setEdition(null)}
              onCommande={(cle, html) => onCommande(bloc, cle, html)}
            />
          ) : (
            <TexteAffiche bloc={bloc} />
          )}
        </div>
        {cat?.cochable && (
          <CaseACocher coche={!!bloc.fait} libelle="Fait" onClick={() => basculerFait(bloc)} />
        )}
      </div>
      <Pastilles bloc={bloc} />
    </div>
  );
}

/** HTML de la note, avec les titres repliables (flèche à gauche du titre). */
function TexteAffiche({ bloc }: { bloc: Bloc }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = versHtml(bloc.contenu);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cache = 0; // niveau du titre replié en cours (0 : rien de caché)
    for (const enfant of [...el.children] as HTMLElement[]) {
      const niveau = enfant.tagName === "H1" ? 1 : enfant.tagName === "H2" ? 2 : 0;
      if (niveau && (!cache || niveau <= cache)) cache = 0;
      enfant.style.display = cache ? "none" : "";
      if (niveau && enfant.hasAttribute("data-replie") && !cache) cache = niveau;
    }
  }, [html]);
  if (!html) return <span className="text-texte-2">Double-clic pour écrire</span>;
  return (
    <div
      ref={ref}
      className="texte-riche affichage"
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (!/^H[12]$/.test(t.tagName)) return;
        if (e.clientX - t.getBoundingClientRect().left > 4) return;
        // Clic sur la flèche : replier ou déplier.
        e.stopPropagation();
        const index = [...ref.current!.children].indexOf(t);
        const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
        const titre = doc.body.firstElementChild!.children[index];
        if (!titre) return;
        if (titre.hasAttribute("data-replie")) titre.removeAttribute("data-replie");
        else titre.setAttribute("data-replie", "");
        void modifierBloc(bloc.id, { contenu: doc.body.firstElementChild!.innerHTML });
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CaseACocher({ coche, libelle, onClick }: { coche: boolean; libelle: string; onClick(): void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={coche}
      aria-label={libelle}
      {...stop}
      onClick={onClick}
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 ${
        coche ? "border-accent bg-accent text-sur-accent" : "border-texte-2 hover:border-texte"
      }`}
    >
      {coche && <Icone nom="valide" taille={14} />}
    </button>
  );
}

/* ---------- Tâche (nœud lié) ---------- */

function BlocTache({ bloc }: { bloc: Bloc }) {
  const { taches, basculerFait } = useBoard();
  const tache = taches.find((t) => t.id === bloc.refId);
  if (!tache) return <div className={`${carte} px-5 py-4 text-texte-2`} style={{ width: bloc.largeur }}>Tâche supprimée</div>;
  return (
    <div className={`${carte} flex flex-col gap-2 px-5 py-4`} style={{ width: bloc.largeur }}>
      <div className="flex items-center gap-4">
        <TexteLigne
          id={bloc.id}
          valeur={tache.titre}
          placeholder="Tâche"
          onEnregistrer={(titre) => titre.trim() && void modifierTache(tache.id, { titre: titre.trim() })}
          className={`flex-1 ${tache.faite ? "text-texte-2 line-through" : ""}`}
        />
        <CaseACocher coche={tache.faite} libelle={`Terminer : ${tache.titre}`} onClick={() => basculerFait(bloc)} />
      </div>
      <Pastilles bloc={bloc} echeance={tache.echeance} />
    </div>
  );
}

export function basculerTacheLiee(t: Tache) {
  return basculerTache(t);
}

/* ---------- Listes : tracklist (morceaux) et dossier (fichiers) ---------- */

/** Liste réordonnable à la poignée (glisser-déposer). */
function ListeOrdonnee<T extends { id: string }>({
  elements,
  rendu,
  onOrdre,
}: {
  elements: T[];
  rendu(e: T, i: number): ReactNode;
  onOrdre(ids: string[]): void;
}) {
  const [glisse, setGlisse] = useState<string | null>(null);
  return (
    <ol className="flex flex-col">
      {elements.map((e, i) => (
        <li
          key={e.id}
          draggable
          onDragStart={(ev) => {
            setGlisse(e.id);
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/x-ctrl-ordre", e.id);
          }}
          onDragOver={(ev) => {
            if (!glisse) return;
            ev.preventDefault();
            ev.stopPropagation();
          }}
          onDrop={(ev) => {
            if (!glisse) return;
            ev.preventDefault();
            ev.stopPropagation();
            const ids = elements.map((x) => x.id).filter((x) => x !== glisse);
            ids.splice(i, 0, glisse);
            setGlisse(null);
            onOrdre(ids);
          }}
          onDragEnd={() => setGlisse(null)}
          {...stop}
          className={`group/ligne flex items-center gap-2 rounded-12 px-1 hover:bg-filet/60 ${glisse === e.id ? "opacity-40" : ""}`}
        >
          <span className="cursor-grab text-texte-2 opacity-0 group-hover/ligne:opacity-100" aria-hidden>
            <Icone nom="poignee" taille={14} />
          </span>
          {rendu(e, i)}
        </li>
      ))}
    </ol>
  );
}

function Tracklist({ bloc }: { bloc: Bloc }) {
  const { morceaux, projets, versions, ajouterMorceaux, memoriser } = useBoard();
  const projet = projets.find((p) => p.id === bloc.refId);
  const pistes = pistesDe(bloc, projets)
    .map((id) => morceaux.find((m) => m.id === id))
    .filter((m): m is Morceau => !!m);
  const file = pistes.flatMap((m) => {
    const v = versionAEcouter(m, versions);
    return v ? [{ fichierId: v.fichierId, titre: m.titre, sousTitre: projet?.titre ?? bloc.titre, morceauId: m.id, coverFichierId: m.coverFichierId }] : [];
  });
  return (
    <div className={`${carte} flex flex-col gap-1 p-3`} style={{ width: bloc.largeur }}>
      <div className="flex items-center gap-2 px-2 py-1">
        <Icone nom="tracklist" taille={16} className="text-texte-2" />
        <TexteLigne
          id={bloc.id}
          valeur={projet?.titre ?? bloc.titre}
          placeholder="Tracklist"
          onEnregistrer={(titre) => void renommerTracklist(bloc, titre)}
          className="flex-1"
        />
        <span className="text-libelle text-texte-2 tabular-nums">{pistes.length}</span>
      </div>
      <ListeOrdonnee
        elements={pistes}
        onOrdre={(ids) => {
          memoriser();
          void ordonnerTracklist(bloc, ids);
        }}
        rendu={(m, i) => {
          const v = versionAEcouter(m, versions);
          return (
            <>
              {v ? <LecteurAudio compact fichierId={v.fichierId} libelle={m.titre} file={file} /> : <span className="size-9 shrink-0" />}
              <span className="w-4 text-libelle text-texte-2 tabular-nums">{i + 1}</span>
              <NomRenommable valeur={m.titre} onRenommer={(t) => void modifierMorceau(m.id, { titre: t })} />
            </>
          );
        }}
      />
      <button type="button" {...stop} onClick={() => ajouterMorceaux(bloc)} className="flex items-center gap-2 rounded-12 px-2 py-2 text-left text-libelle text-texte-2 hover:text-texte">
        <Icone nom="plus" taille={14} />
        Ajouter des morceaux
      </button>
      <Pastilles bloc={bloc} />
    </div>
  );
}

/** Nom renommé au double-clic (morceau d’une tracklist, fichier d’un dossier). */
function NomRenommable({ valeur, onRenommer }: { valeur: string; onRenommer(v: string): void }) {
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(valeur);
  if (!edition)
    return (
      <span className="min-w-0 flex-1 truncate" onDoubleClick={() => (setTexte(valeur), setEdition(true))}>
        {valeur}
      </span>
    );
  return (
    <input
      autoFocus
      value={texte}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={() => {
        if (texte.trim() && texte !== valeur) onRenommer(texte.trim());
        setEdition(false);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
      }}
      className="min-w-0 flex-1 bg-transparent focus:outline-none"
    />
  );
}

function Dossier({ bloc }: { bloc: Bloc }) {
  const { fichiers, memoriser } = useBoard();
  const liste = (bloc.fichierIds ?? []).map((id) => fichiers.get(id)).filter((f): f is NonNullable<typeof f> => !!f);
  return (
    <div className={`${carte} flex flex-col gap-1 p-3`} style={{ width: bloc.largeur }}>
      <div className="flex items-center gap-2 px-2 py-1">
        <Icone nom="dossier" taille={16} className="text-texte-2" />
        <TexteLigne id={bloc.id} valeur={bloc.titre} placeholder="Dossier" onEnregistrer={(titre) => void modifierBloc(bloc.id, { titre: titre.trim() || "Dossier" })} className="flex-1" />
        <span className="text-libelle text-texte-2 tabular-nums">{liste.length}</span>
      </div>
      <ListeOrdonnee
        elements={liste}
        onOrdre={(ids) => {
          memoriser();
          void modifierBloc(bloc.id, { fichierIds: ids });
        }}
        rendu={(f) => (
          <>
            <Icone nom="fichier" taille={14} className="shrink-0 text-texte-2" />
            <NomRenommable valeur={f.nom} onRenommer={(nom) => void depots.fichiers.modifier(f.id, { nom })} />
            <span className="shrink-0 text-[12px] text-texte-2">{taille(f.taille)}</span>
            <button
              type="button"
              aria-label={`Ouvrir ${f.nom}`}
              onClick={() => {
                const url = URL.createObjectURL(f.blob);
                window.open(url, "_blank", "noopener");
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
              }}
              className="shrink-0 px-1 text-libelle text-texte-2 hover:text-texte"
            >
              Ouvrir
            </button>
          </>
        )}
      />
      {liste.length === 0 && <p className="px-2 py-2 text-libelle text-texte-2">Glisse des fichiers ici.</p>}
      <Pastilles bloc={bloc} />
    </div>
  );
}

/* ---------- Image, dessin, tableau ---------- */

function BlocImage({ bloc }: { bloc: Bloc }) {
  const url = useUrlFichier(bloc.fichierId ?? null);
  return (
    <div className="overflow-hidden rounded-18 border border-filet bg-surface" style={{ width: bloc.largeur, height: bloc.hauteur }}>
      {url && <img src={url} alt="" draggable={false} className="size-full object-cover" />}
    </div>
  );
}

function Dessin({ bloc }: { bloc: Bloc }) {
  if (!bloc.trace) return null;
  return (
    <svg width={bloc.largeur} height={bloc.hauteur} viewBox={`0 0 ${bloc.trace.w} ${bloc.trace.h}`} preserveAspectRatio="none" className="block overflow-visible">
      <path d={bloc.trace.d} fill="none" stroke="var(--texte)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function BlocTableau({ bloc }: { bloc: Bloc }) {
  const { edition, setEdition, memoriser } = useBoard();
  return (
    <Tableau
      cellules={bloc.cellules ?? [[""]]}
      largeur={bloc.largeur}
      edition={edition?.id === bloc.id}
      depart={edition?.id === bloc.id ? edition.cellule : null}
      onEnregistrer={(cellules) => {
        if (JSON.stringify(cellules) !== JSON.stringify(bloc.cellules)) {
          memoriser();
          void modifierBloc(bloc.id, { cellules });
        }
      }}
      onQuitter={() => setEdition(null)}
    />
  );
}

/* ---------- Nœuds liés : morceau et contact ---------- */

function BlocMorceau({ bloc }: { bloc: Bloc }) {
  const { morceaux, versions } = useBoard();
  const morceau = morceaux.find((m) => m.id === bloc.refId);
  if (!morceau) return <div className={`${carte} w-[260px] px-5 py-4 text-texte-2`}>Morceau supprimé</div>;
  const v = versionAEcouter(morceau, versions);
  return (
    <div className={`${carte} flex w-[260px] flex-col gap-2 p-3`}>
      <div className="flex items-center gap-3">
        <Vignette fichierId={morceau.coverFichierId} taille={48} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Link to={`/musique/${morceau.id}`} {...stop} className="truncate hover:underline underline-offset-4">
            {morceau.titre}
          </Link>
          <span className="text-libelle text-texte-2">
            <PastilleStatut valeur={morceau.statut} />
          </span>
        </div>
        {v && (
          <span {...stop}>
            <LecteurAudio compact fichierId={v.fichierId} libelle={morceau.titre} />
          </span>
        )}
      </div>
      <Pastilles bloc={bloc} />
    </div>
  );
}

function BlocContact({ bloc }: { bloc: Bloc }) {
  const { contacts } = useBoard();
  const contact = contacts.find((c) => c.id === bloc.refId);
  if (!contact) return <div className={`${carte} w-[240px] px-5 py-4 text-texte-2`}>Contact supprimé</div>;
  return (
    <div className={`${carte} flex w-[240px] flex-col gap-2 p-3`}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-filet text-libelle uppercase">
          {contact.nom.slice(0, 2)}
        </span>
        <div className="flex min-w-0 flex-col">
          <Link to={`/reseau/${contact.id}`} {...stop} className="truncate hover:underline underline-offset-4">
            {contact.nom}
          </Link>
          <span className="text-libelle text-texte-2">{libelleRole(contact.role)}</span>
        </div>
      </div>
      <Pastilles bloc={bloc} />
    </div>
  );
}
