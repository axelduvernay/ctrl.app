import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Logo } from "@/components/Logo";
import { Bouton } from "@/components/Bouton";
import { ChampTexte, Compteur, Option, Segmente } from "@/components/Champs";
import { Progression } from "@/components/Progression";
import { depots, useRequete } from "@/data";
import { integrations } from "@/integrations";
import { terminerOnboarding, type ReponsesOnboarding } from "@/features/parcours/actions";
import { genererParcours, deuxChiffres } from "@/features/parcours/regles";
import { contenuEtape, parcoursParCas } from "@/content/parcours";
import { fr } from "@/content/typo";
import { Icone } from "@/components/Icone";
import { ConnexionCompte } from "@/app/ConnexionCompte";
import { useCompte } from "@/stores/compte";
import type { DejaPublie, Distributeur, Objectif, ReseauSocial, Role } from "@/types";

/* Questionnaire du premier lancement, en 4 étapes, puis le résultat. */

const roles: { valeur: Role; titre: string; detail: string }[] = [
  { valeur: "artiste", titre: "Artiste", detail: "je chante, je rappe" },
  { valeur: "beatmaker", titre: "Beatmaker", detail: "je produis" },
  { valeur: "les-deux", titre: "Les deux", detail: "je fais tout" },
];

const publications: { valeur: DejaPublie; libelle: string }[] = [
  { valeur: "nulle-part", libelle: "Nulle part" },
  { valeur: "soundcloud-youtube", libelle: "SoundCloud, YouTube" },
  { valeur: "streaming", libelle: "Streaming" },
];

const distributeurs: { valeur: Distributeur; libelle: string }[] = [
  { valeur: "oui", libelle: "Oui" },
  { valeur: "non", libelle: "Non" },
  { valeur: "ne-sait-pas", libelle: "Je ne sais pas" },
];

const plateformes = ["Instagram", "TikTok", "YouTube", "SoundCloud", "X"];

const objectifs: { valeur: Objectif; titre: string }[] = [
  { valeur: "sortir-sur-plateformes", titre: "Sortir mes sons sur les plateformes" },
  { valeur: "grandir-reseaux", titre: "Faire grandir mes réseaux" },
  { valeur: "sortir-regulierement", titre: "Sortir plus régulièrement" },
  { valeur: "developper-reseau", titre: "Développer mon réseau" },
];

const TOTAL = 5;

export function OnboardingPage() {
  const naviguer = useNavigate();
  const session = useCompte((c) => c.session);
  // Questionnaire refait depuis Réglages : on peut revenir sans rien changer.
  const { donnees: profils } = useRequete(() => depots.profils.lister());
  const dejaInscrit = !!profils?.some((p) => p.onboardingTermineAt);
  const [etape, setEtape] = useState(1);
  const [termine, setTermine] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [nomArtiste, setNomArtiste] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [sonsEnStock, setSonsEnStock] = useState(0);
  const [dejaPublie, setDejaPublie] = useState<DejaPublie | null>(null);
  const [distributeur, setDistributeur] = useState<Distributeur | null>(null);
  const [reseaux, setReseaux] = useState<ReseauSocial[]>([]);
  const [choix, setChoix] = useState<Objectif[]>([]);

  const peutContinuer =
    (etape === 1 && role !== null && nomArtiste.trim() !== "") ||
    (etape === 2 && dejaPublie !== null && distributeur !== null) ||
    (etape === 3 && choix.length > 0) ||
    etape >= 4;

  async function suivant() {
    if (!peutContinuer || envoi) return;
    if (etape < TOTAL) return setEtape(etape + 1);
    if (!role || !dejaPublie || !distributeur) return;
    setEnvoi(true);
    const reponses: ReponsesOnboarding = {
      nomArtiste: nomArtiste.trim(),
      role,
      sonsEnStock,
      dejaPublie,
      distributeur,
      reseaux,
      objectifs: choix,
    };
    await terminerOnboarding(reponses);
    setTermine(true);
  }

  if (termine && dejaPublie) return <Resultat dejaPublie={dejaPublie} onCommencer={() => naviguer("/", { replace: true })} />;

  const basculerReseau = (plateforme: string) =>
    setReseaux((r) =>
      r.some((x) => x.plateforme === plateforme) ? r.filter((x) => x.plateforme !== plateforme) : [...r, { plateforme, abonnes: null }],
    );

  return (
    <Cadre
      haut={
        <>
          <div className="flex items-center justify-between">
            <Logo taille={22} />
            <div className="flex items-center gap-6">
              {dejaInscrit && !termine && (
                <button type="button" onClick={() => naviguer("/reglages")} className="text-libelle text-texte-2 hover:text-texte">
                  Annuler
                </button>
              )}
              <p className="text-libelle text-texte-2 tabular-nums">
                {deuxChiffres(etape)} /{deuxChiffres(TOTAL)}
              </p>
            </div>
          </div>
          <Progression total={TOTAL} faites={etape - 1} className="mt-6" />
        </>
      }
      bas={
        <>
          {etape > 1 ? (
            <Bouton variante="lien" icone="retour" onClick={() => setEtape(etape - 1)}>
              Retour
            </Bouton>
          ) : (
            <span />
          )}
          <Bouton onClick={suivant} disabled={!peutContinuer || envoi}>
            {etape === TOTAL ? (session ? "Voir mon parcours" : "Continuer sans compte") : "Continuer"}
          </Bouton>
        </>
      }
      onEntree={suivant}
    >
      {etape === 1 && (
        <Question numero="01" theme="Profil" titre="Tu fais quoi ?">
          <div role="radiogroup" aria-label="Ton profil" className="flex flex-col gap-2">
            {roles.map((r) => (
              <Option key={r.valeur} forme="radio" choisi={role === r.valeur} onClick={() => setRole(r.valeur)} titre={r.titre} detail={r.detail} />
            ))}
          </div>
          <ChampTexte
            libelle="Ton nom d’artiste"
            valeur={nomArtiste}
            onChange={setNomArtiste}
            placeholder="Comme sur tes sons"
            autoComplete="off"
            maxLength={60}
          />
        </Question>
      )}

      {etape === 2 && (
        <Question numero="02" theme="État des lieux" titre="Où en es-tu ?">
          <Compteur libelle="Sons en stock" aide="Morceaux ou prods, même pas finis." valeur={sonsEnStock} onChange={setSonsEnStock} />
          <Segmente libelle="Déjà publié" options={publications} valeur={dejaPublie} onChange={setDejaPublie} />
          <Segmente libelle="Tu as un distributeur ?" options={distributeurs} valeur={distributeur} onChange={setDistributeur} />
          <div className="flex flex-col gap-3">
            <span className="text-libelle text-texte-2">Réseaux sociaux</span>
            <div className="flex flex-wrap gap-2">
              {plateformes.map((p) => {
                const actif = reseaux.some((r) => r.plateforme === p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => basculerReseau(p)}
                    className={`h-11 rounded-full border px-5 text-[15px] transition-colors duration-150 ${
                      actif ? "border-texte-2 bg-surface text-texte" : "border-filet text-texte-2 hover:text-texte"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            {reseaux.map((r) => (
              <label key={r.plateforme} className="flex items-center justify-between gap-4 rounded-18 border border-filet px-5 py-2">
                <span>{r.plateforme}</span>
                <span className="flex items-center gap-3 text-libelle text-texte-2">
                  abonnés
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Abonnés ${r.plateforme}`}
                    value={r.abonnes ?? ""}
                    onChange={(e) => {
                      const brut = e.target.value.replace(/\D/g, "");
                      setReseaux((liste) =>
                        liste.map((x) => (x.plateforme === r.plateforme ? { ...x, abonnes: brut === "" ? null : Number(brut) } : x)),
                      );
                    }}
                    className="h-10 w-28 rounded-12 border border-filet bg-surface px-3 text-right text-[16px] text-texte tabular-nums focus:border-texte-2 focus:outline-none"
                  />
                </span>
              </label>
            ))}
          </div>
        </Question>
      )}

      {etape === 3 && (
        <Question numero="03" theme="Objectifs" titre="Qu’est-ce que tu veux atteindre ?" sousTitre="Plusieurs choix possibles.">
          <div className="flex flex-col gap-2">
            {objectifs.map((o) => (
              <Option
                key={o.valeur}
                forme="case"
                choisi={choix.includes(o.valeur)}
                onClick={() => setChoix((c) => (c.includes(o.valeur) ? c.filter((x) => x !== o.valeur) : [...c, o.valeur]))}
                titre={o.titre}
              />
            ))}
          </div>
        </Question>
      )}

      {etape === 4 && (
        <Question
          numero="04"
          theme="Connexions"
          titre="Connecte tes comptes"
          sousTitre="Facultatif, modifiable plus tard dans Réglages. Les connexions sont simulées pour l’instant : aucune donnée n’est récupérée."
        >
          <Connexions />
        </Question>
      )}

      {etape === 5 && (
        <Question
          numero="05"
          theme="Compte"
          titre="Garde ta progression"
          sousTitre="Facultatif. Avec ton mail, ton parcours, tes morceaux et tes boards sont sauvegardés et te suivent sur tes autres appareils. Pas de mot de passe : tu reçois un code."
        >
          {session ? (
            <p className="flex items-center gap-2">
              <Icone nom="valide" taille={18} className="text-accent" />
              Connecté avec {session.email}
            </p>
          ) : (
            <ConnexionCompte
              onConnecte={({ compteExistant }) => {
                // Le compte avait déjà un parcours : on le retrouve tel quel.
                if (compteExistant) naviguer("/", { replace: true });
              }}
            />
          )}
        </Question>
      )}
    </Cadre>
  );
}

/* ---------- Mise en page ---------- */

function Cadre({ haut, bas, children, onEntree }: { haut: ReactNode; bas: ReactNode; children: ReactNode; onEntree?: () => void }) {
  return (
    <main
      className="flex min-h-dvh flex-col bg-fond px-8 lg:px-[72px]"
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEntree && (e.target as HTMLElement).tagName === "INPUT") onEntree();
      }}
    >
      <div className="pt-10">{haut}</div>
      <div className="flex flex-1 flex-col py-16">{children}</div>
      <div className="sticky bottom-0 -mx-8 flex items-center justify-between border-t border-filet bg-fond px-8 py-6 lg:-mx-[72px] lg:px-[72px]">
        {bas}
      </div>
    </main>
  );
}

function Question({
  numero,
  theme,
  titre,
  sousTitre,
  children,
}: {
  numero: string;
  theme: string;
  titre: string;
  sousTitre?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex max-w-[720px] flex-col gap-10">
      <div className="flex flex-col gap-4">
        <p className="text-libelle text-texte-2">
          <span className="text-numero">{numero}</span> {theme}
        </p>
        <h1 className="text-titre">{fr(titre)}</h1>
        {sousTitre && <p className="max-w-[560px] text-texte-2">{fr(sousTitre)}</p>}
      </div>
      {children}
    </section>
  );
}

/* ---------- Étape 4 : connexions simulées ---------- */

function Connexions() {
  const { donnees: spotifyDispo } = useRequete(() => integrations.spotify.estDisponible());
  const { donnees: etats } = useRequete(async () => ({
    gmail: await integrations.gmail.estConnectee(),
    instagram: await integrations.instagram.estConnectee(),
    tiktok: await integrations.tiktok.estConnectee(),
  }));

  const lignes = [
    { cle: "gmail", integration: integrations.gmail, detail: "Envois et suivi du réseau" },
    { cle: "instagram", integration: integrations.instagram, detail: "Stats du compte" },
    { cle: "tiktok", integration: integrations.tiktok, detail: "Stats du compte" },
  ] as const;

  return (
    <ul className="flex flex-col gap-2">
      {lignes.map(({ cle, integration, detail }) => {
        const connecte = etats?.[cle] ?? false;
        return (
          <li key={cle} className="flex items-center justify-between gap-4 rounded-18 border border-filet px-5 py-4">
            <span className="flex flex-col">
              <span>{integration.nom}</span>
              <span className="text-libelle text-texte-2">{connecte ? "Connexion simulée" : detail}</span>
            </span>
            <Bouton
              variante={connecte ? "lien" : "contour"}
              onClick={() => void (connecte ? integration.deconnecter() : integration.connecter())}
            >
              {connecte ? "Déconnecter" : "Connecter"}
            </Bouton>
          </li>
        );
      })}
      <li className="flex items-center justify-between gap-4 rounded-18 border border-filet px-5 py-4">
        <span className="flex flex-col">
          <span className={spotifyDispo ? "" : "text-texte-2"}>{integrations.spotify.nom}</span>
          <span className="text-libelle text-texte-2">Disponible après ta première sortie</span>
        </span>
      </li>
    </ul>
  );
}

/* ---------- Résultat : le parcours généré ---------- */

function Resultat({ dejaPublie, onCommencer }: { dejaPublie: DejaPublie; onCommencer(): void }) {
  const { cas, titre, etapes } = genererParcours(dejaPublie);
  const total = deuxChiffres(etapes.length);
  const sautees = cas === "B" ? parcoursParCas.A.etapes.filter((c) => c === "distributeur" || c === "metadonnees") : [];

  return (
    <Cadre
      haut={<Logo taille={22} />}
      bas={
        <>
          <span className="text-libelle text-texte-2">Ton parcours évolue avec toi, étape par étape.</span>
          <Bouton onClick={onCommencer}>Commencer</Bouton>
        </>
      }
    >
      <section className="flex flex-col gap-12">
        <div className="flex flex-col gap-4">
          <p className="text-libelle text-texte-2">Ton parcours</p>
          <h1 className="text-titre">{titre}</h1>
          <p className="max-w-[560px] text-texte-2">
            {fr(cas === "A"
              ? "Huit étapes pour passer de la maquette au morceau publié. Une à la fois, avec une explication courte et un bouton vers l’action."
              : "Tu publies déjà : le parcours se concentre sur la régularité, les playlists, les stats et ton réseau.")}
          </p>
        </div>

        {sautees.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-libelle text-texte-2">{fr("Étapes sautées : tu connais déjà les distributeurs")}</p>
            <p className="text-texte-2 line-through">{sautees.map((c) => contenuEtape(c)?.titre).join(" · ")}</p>
          </div>
        )}

        <ol className="grid max-w-[880px] gap-x-12 gap-y-4 border-t border-filet pt-8 sm:grid-cols-2">
          {etapes.map((cle, i) => (
            <li key={cle} className="flex items-baseline gap-4">
              <span className={`w-6 text-libelle tabular-nums ${i === 0 ? "text-numero" : "text-texte-2"}`}>{deuxChiffres(i + 1)}</span>
              <span className={i === 0 ? "text-texte" : "text-texte-2"}>{contenuEtape(cle)?.titre}</span>
            </li>
          ))}
        </ol>
        <p className="text-libelle text-texte-2 tabular-nums">
          Tu commences à l’étape 01 /{total}.
        </p>
      </section>
    </Cadre>
  );
}
