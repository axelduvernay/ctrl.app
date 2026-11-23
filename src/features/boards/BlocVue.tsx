/* Rendu d’un bloc du board selon son type. Les nœuds liés (tâche, morceau,
   contact) affichent l’objet de l’app : le même partout. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Icone } from "@/components/Icone";
import { LecteurAudio } from "@/components/LecteurAudio";
import { PastilleStatut } from "@/components/PastilleStatut";
import { libelleRole } from "@/content/modelesMail";
import { Vignette } from "@/features/musique/communs";
import { basculerTache, modifierTache } from "@/features/taches/actions";
import type { Bloc, Contact, Morceau, Tache, Version } from "@/types";
import { modifierBloc } from "./actions";

export interface Contexte {
  morceaux: Morceau[];
  contacts: Contact[];
  taches: Tache[];
  versions: Version[];
}

interface Props {
  bloc: Bloc;
  contexte: Contexte;
  edition: boolean;
  onEditer(actif: boolean): void;
  onAjouterMorceaux(): void;
}

/** La version validée si elle existe, sinon la plus récente. */
export function versionAEcouter(m: Morceau, versions: Version[]) {
  const siennes = versions.filter((v) => v.morceauId === m.id);
  return siennes.find((v) => v.id === m.versionValideeId) ?? [...siennes].sort((a, b) => b.numero - a.numero)[0];
}

const carte = "rounded-18 border border-filet bg-surface";

export function BlocVue({ bloc, contexte, edition, onEditer, onAjouterMorceaux }: Props) {
  switch (bloc.type) {
    case "zone":
      return <Zone bloc={bloc} edition={edition} onEditer={onEditer} />;
    case "note":
      return <Note bloc={bloc} edition={edition} onEditer={onEditer} />;
    case "tache":
      return <BlocTache bloc={bloc} tache={contexte.taches.find((t) => t.id === bloc.refId)} edition={edition} onEditer={onEditer} />;
    case "tracklist":
      return <Tracklist bloc={bloc} contexte={contexte} edition={edition} onEditer={onEditer} onAjouter={onAjouterMorceaux} />;
    case "morceau":
      return <BlocMorceau morceau={contexte.morceaux.find((m) => m.id === bloc.refId)} versions={contexte.versions} />;
    case "contact":
      return <BlocContact contact={contexte.contacts.find((c) => c.id === bloc.refId)} />;
  }
}

/** Texte modifiable en place : double-clic pour écrire, quitter pour enregistrer. */
function TexteEditable({
  valeur,
  edition,
  onEditer,
  onEnregistrer,
  multiligne = false,
  placeholder,
  className = "",
}: {
  valeur: string;
  edition: boolean;
  onEditer(a: boolean): void;
  onEnregistrer(v: string): void;
  multiligne?: boolean;
  placeholder: string;
  className?: string;
}) {
  const [texte, setTexte] = useState(valeur);
  useEffect(() => {
    if (!edition) setTexte(valeur);
  }, [valeur, edition]);
  const quitter = () => {
    if (texte !== valeur) onEnregistrer(texte);
    onEditer(false);
  };
  if (!edition)
    return <span className={`${className} ${valeur ? "" : "text-texte-2"} whitespace-pre-wrap`}>{valeur || placeholder}</span>;
  const commun = {
    autoFocus: true,
    value: texte,
    placeholder,
    onChange: (e: { target: { value: string } }) => setTexte(e.target.value),
    onBlur: quitter,
    onPointerDown: (e: { stopPropagation(): void }) => e.stopPropagation(),
    onKeyDown: (e: { key: string; shiftKey: boolean; preventDefault(): void; stopPropagation(): void }) => {
      e.stopPropagation();
      if (e.key === "Escape" || (e.key === "Enter" && !multiligne)) {
        e.preventDefault();
        quitter();
      }
    },
    className: `${className} w-full resize-none bg-transparent focus:outline-none`,
  };
  return multiligne ? <textarea rows={Math.max(3, texte.split("\n").length)} {...commun} /> : <input {...commun} />;
}

function Zone({ bloc, edition, onEditer }: { bloc: Bloc; edition: boolean; onEditer(a: boolean): void }) {
  return (
    <div className="size-full rounded-28 border border-filet bg-surface/50 p-6" style={{ width: bloc.largeur, height: bloc.hauteur }}>
      <TexteEditable
        valeur={bloc.titre}
        edition={edition}
        onEditer={onEditer}
        onEnregistrer={(titre) => void modifierBloc(bloc.id, { titre: titre.trim() || "Zone" })}
        placeholder="Zone"
        className="text-[22px] tracking-[-0.01em]"
      />
    </div>
  );
}

function Note({ bloc, edition, onEditer }: { bloc: Bloc; edition: boolean; onEditer(a: boolean): void }) {
  return (
    <div className={`${carte} px-5 py-4 leading-relaxed`} style={{ width: bloc.largeur }}>
      <TexteEditable
        multiligne
        valeur={bloc.contenu}
        edition={edition}
        onEditer={onEditer}
        onEnregistrer={(contenu) => void modifierBloc(bloc.id, { contenu })}
        placeholder="Double-clic pour écrire"
        className="block"
      />
    </div>
  );
}

function BlocTache({ bloc, tache, edition, onEditer }: { bloc: Bloc; tache?: Tache; edition: boolean; onEditer(a: boolean): void }) {
  if (!tache) return <div className={`${carte} px-5 py-4 text-texte-2`} style={{ width: bloc.largeur }}>Tâche supprimée</div>;
  return (
    <div className={`${carte} flex items-center gap-4 px-5 py-4`} style={{ width: bloc.largeur }}>
      <TexteEditable
        valeur={tache.titre}
        edition={edition}
        onEditer={onEditer}
        onEnregistrer={(titre) => titre.trim() && void modifierTache(tache.id, { titre: titre.trim() })}
        placeholder="Tâche"
        className={`flex-1 ${tache.faite ? "text-texte-2 line-through" : ""}`}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={tache.faite}
        aria-label={`Terminer : ${tache.titre}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void basculerTache(tache)}
        className={`flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 ${
          tache.faite ? "border-accent bg-accent text-sur-accent" : "border-texte-2 hover:border-texte"
        }`}
      >
        {tache.faite && <Icone nom="valide" taille={14} />}
      </button>
    </div>
  );
}

function Tracklist({
  bloc,
  contexte,
  edition,
  onEditer,
  onAjouter,
}: {
  bloc: Bloc;
  contexte: Contexte;
  edition: boolean;
  onEditer(a: boolean): void;
  onAjouter(): void;
}) {
  const pistes = bloc.morceauIds.map((id) => contexte.morceaux.find((m) => m.id === id)).filter((m): m is Morceau => !!m);
  return (
    <div className={`${carte} flex flex-col gap-1 p-3`} style={{ width: bloc.largeur }}>
      <div className="flex items-center gap-2 px-2 py-1">
        <Icone nom="tracklist" taille={16} className="text-texte-2" />
        <TexteEditable
          valeur={bloc.titre}
          edition={edition}
          onEditer={onEditer}
          onEnregistrer={(titre) => void modifierBloc(bloc.id, { titre: titre.trim() || "Tracklist" })}
          placeholder="Tracklist"
          className="flex-1"
        />
        <span className="text-libelle text-texte-2 tabular-nums">{pistes.length}</span>
      </div>
      <ol className="flex flex-col">
        {pistes.map((m, i) => {
          const v = versionAEcouter(m, contexte.versions);
          return (
            <li key={m.id} className="flex items-center gap-2 rounded-12 px-1 hover:bg-filet/60" onPointerDown={(e) => e.stopPropagation()}>
              {v ? <LecteurAudio compact fichierId={v.fichierId} libelle={m.titre} /> : <span className="size-9 shrink-0" />}
              <span className="w-4 text-libelle text-texte-2 tabular-nums">{i + 1}</span>
              <span className="truncate">{m.titre}</span>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onAjouter}
        className="flex items-center gap-2 rounded-12 px-2 py-2 text-left text-libelle text-texte-2 hover:text-texte"
      >
        <Icone nom="plus" taille={14} />
        Ajouter des morceaux
      </button>
    </div>
  );
}

function BlocMorceau({ morceau, versions }: { morceau?: Morceau; versions: Version[] }) {
  if (!morceau) return <div className={`${carte} w-[260px] px-5 py-4 text-texte-2`}>Morceau supprimé</div>;
  const v = versionAEcouter(morceau, versions);
  return (
    <div className={`${carte} flex w-[260px] items-center gap-3 p-3`}>
      <Vignette fichierId={morceau.coverFichierId} taille={48} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link to={`/musique/${morceau.id}`} onPointerDown={(e) => e.stopPropagation()} className="truncate hover:underline underline-offset-4">
          {morceau.titre}
        </Link>
        <span className="text-libelle text-texte-2">
          <PastilleStatut valeur={morceau.statut} />
        </span>
      </div>
      {v && (
        <span onPointerDown={(e) => e.stopPropagation()}>
          <LecteurAudio compact fichierId={v.fichierId} libelle={morceau.titre} />
        </span>
      )}
    </div>
  );
}

function BlocContact({ contact }: { contact?: Contact }) {
  if (!contact) return <div className={`${carte} w-[240px] px-5 py-4 text-texte-2`}>Contact supprimé</div>;
  return (
    <div className={`${carte} flex w-[240px] items-center gap-3 p-3`}>
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-filet text-libelle uppercase">
        {contact.nom.slice(0, 2)}
      </span>
      <div className="flex min-w-0 flex-col">
        <Link to={`/reseau/${contact.id}`} onPointerDown={(e) => e.stopPropagation()} className="truncate hover:underline underline-offset-4">
          {contact.nom}
        </Link>
        <span className="text-libelle text-texte-2">{libelleRole(contact.role)}</span>
      </div>
    </div>
  );
}
