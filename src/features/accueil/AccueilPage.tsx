import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Option } from "@/components/Champs";
import { Modale } from "@/components/Modale";
import { Bouton } from "@/components/Bouton";
import { NumeroEtape, Progression } from "@/components/Progression";
import { PastilleStatut } from "@/components/PastilleStatut";
import { depots, useRequete } from "@/data";
import { integrations } from "@/integrations";
import { contenuDe } from "@/content/parcours";
import { fr } from "@/content/typo";
import { ajouterJours, dateLongue, dateRelative, jourIso, libelleJour } from "@/lib/format";
import { definirSonDuParcours, lireParcours } from "@/features/parcours/actions";
import { ObjectifEtape } from "@/features/parcours/ObjectifEtape";
import { deuxChiffres } from "@/features/parcours/regles";
import { basculerTache, tachesDeLaSemaine } from "@/features/taches/actions";
import { cibleAction } from "./cible";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import type { Etape, Morceau, Sortie, Tache } from "@/types";
import { Icone } from "@/components/Icone";

export function AccueilPage() {
  const { donnees } = useRequete(async () => {
    const [p, morceaux, taches, sorties] = await Promise.all([
      lireParcours(),
      depots.morceaux.lister(),
      depots.taches.lister(),
      depots.sorties.lister(),
    ]);
    return { ...p, morceaux, taches, sorties };
  });
  if (!donnees) return null;
  const nom = donnees.profil?.nomArtiste;

  return (
    <div className="flex flex-col gap-16">
      <header className="flex flex-wrap items-end justify-between gap-6 max-md:flex-col-reverse max-md:items-stretch">
        <div>
          <p className="mb-1 text-libelle text-texte-2">{dateLongue()}</p>
          <h1 className="text-page">{nom ? `Bonjour ${nom}` : "Bonjour"}</h1>
        </div>
        <div className="flex items-center justify-between gap-2">
          {/* Sur téléphone, Réglages n’a pas d’onglet : il s’ouvre d’ici. */}
          <Link to="/reglages" aria-label="Réglages" className="flex size-11 items-center justify-center rounded-full border border-filet text-texte-2 hover:text-texte md:hidden">
            <Icone nom="reglages" taille={18} />
          </Link>
          <ActionsEnTete />
        </div>
      </header>

      <BlocParcours donnees={donnees} />

      <div className="grid gap-12 border-t border-filet pt-10 lg:grid-cols-[1.1fr_1fr_1fr]">
        <CetteSemaine taches={donnees.taches} morceaux={donnees.morceaux} etape={donnees.enCours} />
        <EnCours morceaux={donnees.morceaux} />
        <Stats />
      </div>
    </div>
  );
}

/* ---------- Ton parcours ---------- */

type Donnees = Awaited<ReturnType<typeof lireParcours>> & {
  morceaux: Morceau[];
  sorties: Sortie[];
};

function BlocParcours({ donnees }: { donnees: Donnees }) {
  const naviguer = useNavigate();
  const [choix, setChoix] = useState(false);
  const { parcours, etapes, enCours, morceaux, sorties } = donnees;
  if (!parcours) return null;

  const faites = etapes.filter((e) => e.statut === "validee").length;
  const total = deuxChiffres(etapes.length);
  const contenu = enCours && contenuDe(enCours);
  const morceau = morceaux.find((m) => m.id === (enCours ?? etapes[0])?.morceauId);

  if (!enCours || !contenu)
    return (
      <section className="flex flex-col gap-6">
        <p className="text-libelle text-texte-2">Ton parcours · {parcours.titre}</p>
        <h2 className="text-titre">Toutes les étapes sont validées.</h2>
        <p className="max-w-[560px] text-texte-2">{fr("Ton parcours évoluera avec tes prochaines sorties. Tu peux le revoir à tout moment.")}</p>
        <Bouton variante="lien" iconeApres="fleche" className="self-start" onClick={() => naviguer("/parcours")}>
          Voir le parcours
        </Bouton>
      </section>
    );

  return (
    <section aria-labelledby="titre-parcours" className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-8 max-md:flex-col-reverse max-md:gap-4">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-libelle text-texte-2">Ton parcours · {parcours.titre}</p>
          <h2 id="titre-parcours" className="text-titre">
            {contenu.titre}
            {morceau && <span className="block truncate text-texte-2">{morceau.titre}</span>}
          </h2>
          <ObjectifEtape etape={enCours} />
          {parcours.cas === "A" && morceaux.length > 0 && (
            <button type="button" onClick={() => setChoix(true)} className="self-start text-libelle text-texte-2 hover:text-texte">
              {morceau ? "Changer de son" : "Choisir le son que tu sors"}
            </button>
          )}
        </div>
        <NumeroEtape numero={deuxChiffres(enCours.ordre)} total={total} taille={140} />
      </div>
      <Progression total={etapes.length} faites={faites} />
      <div className="flex flex-wrap items-center gap-6">
        {contenu.action && (
          <Bouton
            onClick={() =>
              // Étape « Choisir le son » : le choix se fait ici, dans la liste de tes morceaux.
              enCours.cle === "choisir-son" && morceaux.length > 0 ? setChoix(true) : naviguer(cibleAction(contenu.action!.vers, morceau, sorties))
            }
          >
            {contenu.action.libelle}
          </Bouton>
        )}
        <Bouton variante={contenu.action ? "lien" : "principal"} iconeApres="fleche" onClick={() => naviguer("/parcours")}>
          Voir le parcours
        </Bouton>
      </div>
      <Modale ouverte={choix} titre="Le son que tu sors" onFermer={() => setChoix(false)}>
        <div className="-mx-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-2">
          {[...morceaux]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((m) => (
              <Option
                key={m.id}
                forme="radio"
                choisi={m.id === morceau?.id}
                titre={m.titre}
                onClick={() => void definirSonDuParcours(m.id === morceau?.id ? null : m.id).then(() => setChoix(false))}
              />
            ))}
        </div>
      </Modale>
    </section>
  );
}

/* ---------- Cette semaine ---------- */

function CetteSemaine({ taches, morceaux, etape }: { taches: Tache[]; morceaux: Morceau[]; etape?: Etape }) {
  const aujourdHui = jourIso();
  const liste = tachesDeLaSemaine(taches, aujourdHui, ajouterJours(aujourdHui, 7)).slice(0, 6);
  // L’objectif de l’étape en cours, s’il tombe dans les 7 jours (ou est passé).
  const objectif = etape?.objectif && etape.objectif <= ajouterJours(aujourdHui, 7) ? etape : undefined;

  return (
    <section aria-labelledby="titre-semaine" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 id="titre-semaine" className="text-libelle text-texte-2">
          Cette semaine
        </h2>
        <Link to="/taches" className="text-libelle text-texte hover:underline underline-offset-4">
          Tout voir
        </Link>
      </div>
      {objectif && (
        <Link to="/parcours" className="flex items-start gap-3 rounded-12">
          <Icone nom="echeance" taille={20} className="shrink-0 text-texte-2" />
          <span className="flex min-w-0 flex-col">
            <span className="hover:underline underline-offset-4">{contenuDe(objectif).titre}</span>
            <span className="text-libelle text-texte-2">
              {objectif.objectif! < aujourdHui ? "Objectif passé · choisis une nouvelle date" : `Objectif du parcours · ${libelleJour(objectif.objectif!)}`}
            </span>
          </span>
        </Link>
      )}
      {liste.length === 0 && !objectif ? (
        <p className="text-texte-2">{fr("Rien de prévu. Ajoute une tâche avec le bouton +.")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {liste.map((t) => {
            const m = morceaux.find((x) => x.id === t.morceauId);
            return (
              <li key={t.id} className="flex items-start gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={t.faite}
                  aria-label={`Terminer : ${t.titre}`}
                  onClick={() => void basculerTache(t)}
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-texte-2 transition-colors duration-150 hover:border-texte"
                />
                <span className="flex min-w-0 flex-col">
                  <span>{t.titre}</span>
                  <span className="text-libelle text-texte-2">
                    {[t.echeance ? libelleJour(t.echeance) : "Sans date", m?.titre].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- En cours ---------- */

function EnCours({ morceaux }: { morceaux: Morceau[] }) {
  const liste = morceaux
    .filter((m) => m.statut !== "sorti")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);

  return (
    <section aria-labelledby="titre-en-cours" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 id="titre-en-cours" className="text-libelle text-texte-2">
          En cours
        </h2>
        {liste.length > 0 && (
          <Link to="/musique" className="text-libelle text-texte hover:underline underline-offset-4">
            Tout voir
          </Link>
        )}
      </div>
      {liste.length === 0 ? (
        <p className="text-texte-2">
          {fr("Aucun morceau en cours.")}{" "}
          <Link to="/musique" className="text-texte underline-offset-4 hover:underline">
            Ajouter un morceau
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {liste.map((m) => (
            <li key={m.id}>
              <Link to={`/musique/${m.id}`} className="flex flex-col hover:underline-offset-4 [&:hover>span:first-child]:underline">
                <span>{m.titre}</span>
                <span className="text-libelle text-texte-2">
                  <PastilleStatut valeur={m.statut} /> · modifié {dateRelative(m.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Stats ---------- */

function Stats() {
  const { donnees } = useRequete(async () => {
    const [profil] = await depots.profils.lister();
    return {
      reseaux: profil?.reseaux ?? [],
      instagram: await integrations.instagram.estConnectee(),
      tiktok: await integrations.tiktok.estConnectee(),
      spotifyDispo: await integrations.spotify.estDisponible(),
    };
  });
  if (!donnees) return null;

  const comptes = [
    { nom: "Instagram", connecte: donnees.instagram },
    { nom: "TikTok", connecte: donnees.tiktok },
  ];
  const saisis = donnees.reseaux.filter((r) => r.abonnes != null);
  const aucun = !donnees.instagram && !donnees.tiktok && saisis.length === 0;

  return (
    <section aria-labelledby="titre-stats" className="flex flex-col gap-5">
      <h2 id="titre-stats" className="text-libelle text-texte-2">
        Stats
      </h2>

      {aucun ? (
        <p className="text-texte-2">
          {fr("Connecte Instagram et TikTok pour suivre tes abonnés ici.")}{" "}
          <Link to="/reglages" className="text-texte underline-offset-4 hover:underline">
            Connecter
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {saisis.map((r) => (
            <li key={r.plateforme} className="flex flex-col">
              <span className="text-libelle text-texte-2">{r.plateforme}</span>
              <span className="text-[clamp(28px,1.6vw+22px,40px)] leading-tight font-light tracking-[-0.03em] tabular-nums">
                {r.abonnes!.toLocaleString("fr-FR")}
              </span>
              <span className="text-libelle text-texte-2">abonnés · saisi par toi</span>
            </li>
          ))}
          {comptes
            .filter((c) => c.connecte)
            .map((c) => (
              <li key={c.nom} className="flex flex-col">
                <span>{c.nom}</span>
                <span className="text-libelle text-texte-2">{fr("Connexion simulée : aucune donnée récupérée pour l’instant.")}</span>
              </li>
            ))}
        </ul>
      )}

      <div className="flex flex-col">
        <span>{donnees.spotifyDispo ? "Spotify for Artists" : "Pas encore de sortie en streaming"}</span>
        <span className="text-libelle text-texte-2">
          {donnees.spotifyDispo
            ? fr("Disponible : connexion simulée pour l’instant.")
            : fr("Spotify for Artists : disponible après ta première sortie")}
        </span>
      </div>
    </section>
  );
}

