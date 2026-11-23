/* Champs de formulaire partagés : surfaces pleines, filets de 1 px. */

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icone } from "./Icone";

const baseChamp =
  "h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte placeholder:text-texte-2 transition-colors duration-150 focus:border-texte-2 focus:outline-none";

interface ChampTexteProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  libelle: string;
  valeur: string;
  onChange(valeur: string): void;
}

export function ChampTexte({ libelle, valeur, onChange, className = "", ...props }: ChampTexteProps) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-libelle text-texte-2">{libelle}</span>
      <input className={baseChamp} value={valeur} onChange={(e) => onChange(e.target.value)} {...props} />
    </label>
  );
}

interface CompteurProps {
  libelle: string;
  aide?: string;
  valeur: number;
  onChange(valeur: number): void;
  min?: number;
}

/** Nombre avec boutons − et +, saisie directe possible. */
export function Compteur({ libelle, aide, valeur, onChange, min = 0 }: CompteurProps) {
  const changer = (n: number) => onChange(Math.max(min, Number.isFinite(n) ? Math.round(n) : min));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-libelle text-texte-2">{libelle}</span>
      <div className="inline-flex h-12 w-fit items-center rounded-full border border-filet">
        <button type="button" aria-label="Moins" onClick={() => changer(valeur - 1)} className="flex size-12 items-center justify-center text-texte-2 hover:text-texte">
          <Icone nom="moins" taille={18} />
        </button>
        <input
          aria-label={libelle}
          inputMode="numeric"
          className="w-16 bg-transparent text-center text-texte tabular-nums focus:outline-none"
          value={valeur}
          onChange={(e) => changer(Number(e.target.value.replace(/\D/g, "")))}
        />
        <button type="button" aria-label="Plus" onClick={() => changer(valeur + 1)} className="flex size-12 items-center justify-center text-texte-2 hover:text-texte">
          <Icone nom="plus" taille={18} />
        </button>
      </div>
      {aide && <span className="text-libelle text-texte-2">{aide}</span>}
    </div>
  );
}

interface OptionProps {
  choisi: boolean;
  onClick(): void;
  titre: string;
  detail?: string;
  /** « radio » : un seul choix ; « case » : plusieurs choix. */
  forme: "radio" | "case";
  disabled?: boolean;
  suffixe?: ReactNode;
}

/** Ligne de choix : rond (un seul choix) ou case (plusieurs). */
export function Option({ choisi, onClick, titre, detail, forme, disabled, suffixe }: OptionProps) {
  return (
    <button
      type="button"
      role={forme === "radio" ? "radio" : "checkbox"}
      aria-checked={choisi}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-18 border px-5 py-4 text-left transition-colors duration-150 disabled:cursor-default disabled:opacity-50 ${
        choisi ? "border-texte-2 bg-surface" : "border-filet hover:bg-surface"
      }`}
    >
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center border transition-colors duration-150 ${
          forme === "radio" ? "rounded-full" : "rounded-[6px]"
        } ${choisi ? "border-texte bg-texte text-sur-inverse" : "border-texte-2"}`}
      >
        {choisi && (forme === "radio" ? <span className="size-2 rounded-full bg-fond" /> : <Icone nom="valide" taille={14} />)}
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-texte">{titre}</span>
        {detail && <span className="text-libelle text-texte-2">{detail}</span>}
      </span>
      {suffixe}
    </button>
  );
}

interface SegmenteProps<T extends string> {
  libelle: string;
  options: { valeur: T; libelle: string }[];
  valeur: NoInfer<T> | null;
  onChange(valeur: NoInfer<T>): void;
}

/** Choix court en pilules, ex. « oui · non · je ne sais pas ». */
export function Segmente<T extends string>({ libelle, options, valeur, onChange }: SegmenteProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-libelle text-texte-2">{libelle}</span>
      <div role="radiogroup" aria-label={libelle} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={valeur === o.valeur}
            onClick={() => onChange(o.valeur)}
            className={`h-11 rounded-full border px-5 text-[15px] transition-colors duration-150 ${
              valeur === o.valeur ? "border-texte-2 bg-surface text-texte" : "border-filet text-texte-2 hover:text-texte"
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChampSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  libelle: string;
  valeur: string;
  options: { valeur: string; libelle: string }[];
  onChange(valeur: string): void;
}

export function ChampSelect({ libelle, valeur, options, onChange, className = "", ...props }: ChampSelectProps) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-libelle text-texte-2">{libelle}</span>
      <span className="relative">
        <select className={`${baseChamp} appearance-none pr-11`} value={valeur} onChange={(e) => onChange(e.target.value)} {...props}>
          {options.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </select>
        <Icone nom="descendre" taille={16} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-texte-2" />
      </span>
    </label>
  );
}

interface ZoneTexteProps {
  valeur: string;
  onChange(valeur: string): void;
  onBlur?(): void;
  onFocus?(): void;
  placeholder?: string;
  libelle: string;
  autoFocus?: boolean;
}

/** Zone de texte qui grandit avec son contenu. */
export function ZoneTexte({ valeur, onChange, onBlur, onFocus, placeholder, libelle, autoFocus }: ZoneTexteProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  }, [valeur]);
  return (
    <textarea
      ref={ref}
      aria-label={libelle}
      rows={3}
      autoFocus={autoFocus}
      value={valeur}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onFocus={onFocus}
      className="min-h-24 w-full resize-none rounded-18 border border-filet bg-surface px-5 py-4 leading-relaxed text-texte placeholder:text-texte-2 focus:border-texte-2 focus:outline-none"
    />
  );
}
