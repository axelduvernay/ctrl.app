/* Petits éléments partagés par les écrans de l’onglet Musique. */

import { useRef, useState, type ReactNode } from "react";
import { useUrlFichier } from "@/data";
import { Icone } from "@/components/Icone";
import { statuts } from "@/content/statuts";
import type { Morceau, StatutMorceau, Version } from "@/types";

/** La version validée si elle existe, sinon la plus récente. */
export function versionAEcouter(m: Morceau, versions: Version[]) {
  const siennes = versions.filter((v) => v.morceauId === m.id);
  return siennes.find((v) => v.id === m.versionValideeId) ?? siennes.sort((a, b) => b.numero - a.numero)[0];
}

/** Cover importée, ou carré vide si aucune. */
export function Vignette({ fichierId, taille = 48, arrondi = "rounded-12" }: { fichierId: string | null; taille?: number | "plein"; arrondi?: string }) {
  const url = useUrlFichier(fichierId);
  const plein = taille === "plein";
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-filet bg-surface text-texte-2 ${plein ? "aspect-square w-full" : ""} ${arrondi}`}
      style={plein ? undefined : { width: taille, height: taille }}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <Icone nom="musique" taille={plein ? 28 : Math.round(taille * 0.36)} />}
    </span>
  );
}

/** Choix du statut en pilules, avec la pastille de couleur. */
export function ChoixStatut({ valeur, onChange }: { valeur: StatutMorceau; onChange(s: StatutMorceau): void }) {
  return (
    <div role="radiogroup" aria-label="Statut" className="flex flex-wrap gap-2">
      {statuts.map((s) => (
        <button
          key={s.valeur}
          type="button"
          role="radio"
          aria-checked={valeur === s.valeur}
          onClick={() => onChange(s.valeur)}
          className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] transition-colors duration-150 ${
            valeur === s.valeur ? "border-texte-2 bg-surface text-texte" : "border-filet text-texte-2 hover:text-texte"
          }`}
        >
          <span aria-hidden className="size-2 rounded-full" style={{ background: s.couleur }} />
          {s.libelle}
        </button>
      ))}
    </div>
  );
}

/** Champ texte qui s’enregistre quand on le quitte (ou sur Entrée). */
export function ChampEnregistre({
  libelle,
  valeur,
  onEnregistrer,
  placeholder,
  numerique = false,
  className = "",
  classeChamp = "",
}: {
  libelle: string;
  valeur: string;
  onEnregistrer(v: string): void;
  placeholder?: string;
  numerique?: boolean;
  className?: string;
  classeChamp?: string;
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const affiche = brouillon ?? valeur;
  const valider = () => {
    if (brouillon !== null && brouillon !== valeur) onEnregistrer(brouillon);
    setBrouillon(null);
  };
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-libelle text-texte-2">{libelle}</span>
      <input
        value={affiche}
        inputMode={numerique ? "numeric" : undefined}
        placeholder={placeholder}
        onChange={(e) => setBrouillon(numerique ? e.target.value.replace(/\D/g, "") : e.target.value)}
        onBlur={valider}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={
          classeChamp ||
          "h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte placeholder:text-texte-2 focus:border-texte-2 focus:outline-none"
        }
      />
    </label>
  );
}

/** Zone qui accepte des fichiers glissés, et un bouton pour en choisir. */
export function DepotFichiers({
  accept,
  multiple = false,
  onFichiers,
  children,
  className = "",
}: {
  accept: string;
  multiple?: boolean;
  onFichiers(fichiers: File[]): void;
  children: (ouvrir: () => void, survol: boolean) => ReactNode;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  return (
    <div
      className={className}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const liste = [...e.dataTransfer.files];
        if (liste.length) onFichiers(multiple ? liste : liste.slice(0, 1));
      }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const liste = [...(e.target.files ?? [])];
          if (liste.length) onFichiers(liste);
          e.target.value = "";
        }}
      />
      {children(() => input.current?.click(), survol)}
    </div>
  );
}
