import { useNavigate } from "react-router";
import { Bouton } from "@/components/Bouton";
import { Icone } from "@/components/Icone";
import { NumeroEtape, Progression } from "@/components/Progression";
import { useRequete } from "@/data";
import { contenuEtape } from "@/content/parcours";
import type { Etape } from "@/types";
import { lireParcours, rouvrirEtape, validerEtape } from "./actions";
import { deuxChiffres } from "./regles";
import { ActionsEnTete } from "@/app/ActionsEnTete";

/** Le parcours complet : chaque étape, son explication et son action. */
export function ParcoursPage() {
  const { donnees } = useRequete(lireParcours);
  if (!donnees?.parcours) return null;

  const { parcours, etapes, enCours } = donnees;
  const faites = etapes.filter((e) => e.statut === "validee").length;
  const total = deuxChiffres(etapes.length);
  const termine = faites === etapes.length;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex justify-end">
        <ActionsEnTete />
      </div>
      <div className="flex items-end justify-between gap-8">
        <header>
          <p className="mb-1 text-libelle text-texte-2">Ton parcours</p>
          <h1 className="text-[40px] leading-tight font-medium tracking-[-0.03em]">{parcours.titre}</h1>
        </header>
        <NumeroEtape numero={deuxChiffres(termine ? etapes.length : faites + 1)} total={total} taille={112} />
      </div>
      <Progression total={etapes.length} faites={faites} enCours={!termine} />

      {termine && (
        <p className="text-texte-2">Toutes les étapes sont validées. Ton parcours évoluera avec tes prochaines sorties.</p>
      )}

      <ol className="flex flex-col">
        {etapes.map((e) => (
          <LigneEtape key={e.id} etape={e} total={total} ouverte={e.id === enCours?.id} />
        ))}
      </ol>
    </div>
  );
}

function LigneEtape({ etape, total, ouverte }: { etape: Etape; total: string; ouverte: boolean }) {
  const naviguer = useNavigate();
  const contenu = contenuEtape(etape.cle);
  if (!contenu) return null;
  const validee = etape.statut === "validee";

  return (
    <li className="border-t border-filet py-6">
      <div className="flex items-baseline gap-6">
        <span className={`w-14 shrink-0 text-libelle tabular-nums ${ouverte ? "text-numero" : "text-texte-2"}`}>
          {deuxChiffres(etape.ordre)} /{total}
        </span>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={`text-[22px] tracking-[-0.01em] ${validee || ouverte ? "text-texte" : "text-texte-2"}`}>{contenu.titre}</h2>
            {validee && (
              <span className="flex items-center gap-3 text-libelle text-texte-2">
                <span className="flex items-center gap-1.5 text-texte">
                  <Icone nom="valide" taille={16} className="text-accent" />
                  Validée
                </span>
                <button type="button" onClick={() => void rouvrirEtape(etape)} className="underline-offset-4 hover:underline">
                  Annuler
                </button>
              </span>
            )}
          </div>
          {ouverte && (
            <>
              <p className="max-w-[640px] text-texte-2">{contenu.explication}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Bouton onClick={() => void validerEtape(etape)}>Valider l’étape</Bouton>
                <Bouton variante="contour" iconeApres="fleche" onClick={() => naviguer(contenu.action.vers)}>
                  {contenu.action.libelle}
                </Bouton>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
