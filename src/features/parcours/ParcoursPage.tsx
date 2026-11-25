import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { ChampSelect, ZoneTexte } from "@/components/Champs";
import { Icone } from "@/components/Icone";
import { Modale } from "@/components/Modale";
import { NumeroEtape, Progression } from "@/components/Progression";
import { useRequete } from "@/data";
import { contenuDe, contenuEtape, etapes as catalogue, parcoursParCas } from "@/content/parcours";
import { fr } from "@/content/typo";
import type { Etape } from "@/types";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { FilAriane } from "@/components/FilAriane";
import { ChampEnregistre } from "@/features/musique/communs";
import {
  ajouterEtape,
  deplacerEtape,
  lireParcours,
  modifierEtape,
  renommerParcours,
  retirerEtape,
  revenirAuParcoursPropose,
  rouvrirEtape,
  validerEtape,
} from "./actions";
import { deuxChiffres } from "./regles";

/** Le parcours complet : chaque étape, son explication et son action.
    « Modifier le parcours » permet de le mettre à sa main. */
export function ParcoursPage() {
  const [modification, setModification] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const { donnees } = useRequete(lireParcours);
  if (!donnees?.parcours) return null;

  const { parcours, etapes, enCours } = donnees;
  const faites = etapes.filter((e) => e.statut === "validee").length;
  const total = deuxChiffres(etapes.length);
  const termine = etapes.length > 0 && faites === etapes.length;

  // Étapes proposées qu’on peut (r)ajouter : celles des deux parcours, absentes du sien.
  const presentes = new Set(etapes.map((e) => e.cle));
  const proposables = [...new Set([...parcoursParCas.A.etapes, ...parcoursParCas.B.etapes])].filter((c) => !presentes.has(c));

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between gap-6">
        <FilAriane liens={[{ libelle: "Accueil", vers: "/" }]} courant="Parcours" />
        <ActionsEnTete />
      </div>
      <div className="flex items-end justify-between gap-8">
        <header className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-libelle text-texte-2">Ton parcours</p>
          {modification ? (
            <ChampEnregistre
              libelle="Titre du parcours"
              valeur={parcours.titre}
              onEnregistrer={(t) => t.trim() && void renommerParcours(parcours.id, t)}
              className="[&>span]:sr-only"
              classeChamp="-mx-2 w-full rounded-12 bg-surface px-2 text-[40px] leading-tight font-medium tracking-[-0.03em] text-texte focus:outline-none"
            />
          ) : (
            <h1 className="text-[40px] leading-tight font-medium tracking-[-0.03em]">{parcours.titre}</h1>
          )}
          <div>
            {modification ? (
              <Bouton onClick={() => setModification(false)}>Terminé</Bouton>
            ) : (
              <Bouton variante="contour" onClick={() => setModification(true)}>
                Modifier le parcours
              </Bouton>
            )}
          </div>
        </header>
        {etapes.length > 0 && (
          <NumeroEtape numero={deuxChiffres(termine ? etapes.length : (enCours?.ordre ?? 1))} total={total} taille={112} />
        )}
      </div>
      {etapes.length > 0 && <Progression total={etapes.length} faites={faites} enCours={!termine} />}

      {termine && !modification && (
        <p className="text-texte-2">{fr("Toutes les étapes sont validées. Ajoute-en d’autres avec « Modifier le parcours » quand tu veux.")}</p>
      )}
      {etapes.length === 0 && <p className="text-texte-2">Ton parcours n’a plus d’étape. Ajoute-en une ci-dessous.</p>}

      <ol className="flex flex-col">
        {etapes.map((e, i) =>
          modification ? (
            <EtapeModifiable key={e.id} etape={e} total={total} premiere={i === 0} derniere={i === etapes.length - 1} />
          ) : (
            <LigneEtape key={e.id} etape={e} total={total} ouverte={e.id === enCours?.id} />
          ),
        )}
      </ol>

      {(modification || etapes.length === 0) && (
        <section className="flex flex-col gap-5 rounded-18 border border-filet p-6">
          <h2 className="text-libelle text-texte-2">Ajouter une étape</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Bouton variante="contour" icone="plus" onClick={() => void ajouterEtape(parcours.id, "perso", "Nouvelle étape")}>
              Une étape à moi
            </Bouton>
            {proposables.length > 0 && (
              <ChampSelect
                libelle="Ou une étape proposée"
                className="min-w-72"
                valeur=""
                options={[
                  { valeur: "", libelle: "Choisir une étape proposée…" },
                  ...proposables.map((c) => ({ valeur: c, libelle: contenuEtape(c)?.titre ?? c })),
                ]}
                onChange={(c) => c && void ajouterEtape(parcours.id, c)}
              />
            )}
          </div>
          <button type="button" onClick={() => setConfirmer(true)} className="self-start text-libelle text-texte-2 hover:text-texte">
            Revenir au parcours proposé
          </button>
        </section>
      )}

      <Modale
        ouverte={confirmer}
        titre="Revenir au parcours proposé ?"
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void revenirAuParcoursPropose().then(() => setConfirmer(false))}>Revenir au parcours proposé</Bouton>
          </>
        }
      >
        <p className="text-texte-2">
          {fr("Les étapes et les textes redeviennent ceux proposés d’après ton questionnaire, et la progression repart du début. Le son de ton parcours est gardé.")}
        </p>
      </Modale>
    </div>
  );
}

function LigneEtape({ etape, total, ouverte }: { etape: Etape; total: string; ouverte: boolean }) {
  const naviguer = useNavigate();
  const contenu = contenuDe(etape);
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
              {contenu.explication && <p className="max-w-[640px] text-texte-2">{contenu.explication}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Bouton onClick={() => void validerEtape(etape)}>Valider l’étape</Bouton>
                {contenu.action && (
                  <Bouton variante="contour" iconeApres="fleche" onClick={() => naviguer(contenu.action!.vers)}>
                    {contenu.action.libelle}
                  </Bouton>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** En mode modification : titre et explication réécrits, ordre, retrait. */
function EtapeModifiable({ etape, total, premiere, derniere }: { etape: Etape; total: string; premiere: boolean; derniere: boolean }) {
  const propose = etape.cle in catalogue ? contenuEtape(etape.cle) : undefined;
  const contenu = contenuDe(etape);
  const [explication, setExplication] = useState(etape.explicationPerso ?? propose?.explication ?? "");
  useEffect(() => setExplication(etape.explicationPerso ?? propose?.explication ?? ""), [etape.explicationPerso, propose?.explication]);
  const modifiee = !!(etape.titrePerso || etape.explicationPerso) && !!propose;

  return (
    <li className="flex gap-6 border-t border-filet py-6">
      <span className="w-14 shrink-0 pt-3 text-libelle text-texte-2 tabular-nums">
        {deuxChiffres(etape.ordre)} /{total}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <ChampEnregistre
          libelle="Titre de l’étape"
          valeur={etape.titrePerso ?? propose?.titre ?? ""}
          onEnregistrer={(t) => void modifierEtape(etape.id, { titrePerso: t.trim() && t.trim() !== propose?.titre ? t.trim() : null })}
        />
        <div className="flex flex-col gap-2">
          <span className="text-libelle text-texte-2">Explication</span>
          <ZoneTexte
            libelle="Explication de l’étape"
            valeur={explication}
            onChange={setExplication}
            placeholder="Ce qu’il y a à faire, en deux ou trois phrases."
            onBlur={() => void modifierEtape(etape.id, { explicationPerso: explication.trim() && explication.trim() !== propose?.explication ? explication.trim() : null })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-libelle text-texte-2">
          {etape.statut === "validee" && <span>Validée</span>}
          {contenu.action && <span>Bouton : {contenu.action.libelle}</span>}
          {modifiee && (
            <button type="button" onClick={() => void modifierEtape(etape.id, { titrePerso: null, explicationPerso: null })} className="hover:text-texte">
              Revenir au texte proposé
            </button>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <BoutonIcone icone="monter" libelle="Monter l’étape" disabled={premiere} onClick={() => void deplacerEtape(etape, -1)} className="size-9 border-transparent disabled:opacity-30" />
        <BoutonIcone icone="descendre" libelle="Descendre l’étape" disabled={derniere} onClick={() => void deplacerEtape(etape, 1)} className="size-9 border-transparent disabled:opacity-30" />
        <BoutonIcone icone="supprimer" libelle="Retirer l’étape" onClick={() => void retirerEtape(etape)} className="size-9 border-transparent" />
      </div>
    </li>
  );
}
