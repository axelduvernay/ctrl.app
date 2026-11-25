import { useRef } from "react";
import { Icone } from "@/components/Icone";
import { fr } from "@/content/typo";
import { jourIso, jourLong, joursAvant } from "@/lib/format";
import type { Etape } from "@/types";
import { definirObjectif } from "./actions";

/** « dans 9 jours », « demain », « aujourd’hui ». */
export function compteARebours(jour: string) {
  const n = joursAvant(jour);
  if (n === 0) return "aujourd’hui";
  if (n === 1) return "demain";
  if (n > 1) return `dans ${n} jours`;
  return null;
}

/** Date objectif d’une étape : la voir, la fixer ou la changer en un clic
    (calendrier du navigateur). Une date passée n’est jamais un reproche :
    on propose simplement d’en choisir une nouvelle. */
export function ObjectifEtape({ etape, className = "" }: { etape: Etape; className?: string }) {
  const champ = useRef<HTMLInputElement>(null);
  const ouvrir = () => {
    const c = champ.current;
    if (!c) return;
    try {
      c.showPicker();
    } catch {
      c.focus();
    }
  };
  const date = etape.objectif;
  const rebours = date ? compteARebours(date) : null;
  const passee = !!date && joursAvant(date) < 0;

  return (
    <span className={`relative inline-flex items-center gap-2 text-libelle ${className}`}>
      <input
        ref={champ}
        type="date"
        tabIndex={-1}
        aria-hidden
        min={jourIso()}
        value={date ?? ""}
        onChange={(e) => void definirObjectif(etape.id, e.target.value || null)}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
      />
      <Icone nom="echeance" taille={16} className="text-texte-2" />
      {date ? (
        <>
          <button type="button" onClick={ouvrir} className="text-left text-texte underline-offset-4 hover:underline">
            {passee ? fr(`Prévu le ${jourLong(date)}`) : fr(`Objectif : ${jourLong(date)}`)}
          </button>
          <span className="text-texte-2">·</span>
          {passee ? (
            <button type="button" onClick={ouvrir} className="text-texte-2 hover:text-texte">
              Choisir une nouvelle date
            </button>
          ) : (
            <span className="text-texte-2">{rebours}</span>
          )}
          <button
            type="button"
            onClick={() => void definirObjectif(etape.id, null)}
            aria-label="Retirer la date objectif"
            className="flex size-6 items-center justify-center rounded-full text-texte-2 hover:text-texte"
          >
            <Icone nom="fermer" taille={14} />
          </button>
        </>
      ) : (
        <button type="button" onClick={ouvrir} className="text-texte-2 underline-offset-4 hover:text-texte hover:underline">
          Fixe-toi une date objectif
        </button>
      )}
    </span>
  );
}
