import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Bouton } from "@/components/Bouton";
import { EnTete } from "@/components/EnTete";
import { Icone } from "@/components/Icone";
import { Modale } from "@/components/Modale";
import { depots, useRequete } from "@/data";
import { integrations } from "@/integrations";
import { fr } from "@/content/typo";
import { jourIso } from "@/lib/format";
import { lireParcours } from "@/features/parcours/actions";
import { deuxChiffres } from "@/features/parcours/regles";
import { useTheme, type Theme } from "@/stores/theme";
import { useCompte } from "@/stores/compte";
import { ConnexionCompte } from "@/app/ConnexionCompte";
import { deconnecter, synchroniser } from "@/data/remote/sync";

const modes: { valeur: Theme; libelle: string }[] = [
  { valeur: "sombre", libelle: "Sombre" },
  { valeur: "clair", libelle: "Clair" },
];

const libellesRole = { artiste: "Artiste", beatmaker: "Beatmaker", "les-deux": "Artiste et beatmaker" } as const;

export function ReglagesPage() {
  return (
    <div className="flex flex-col gap-12">
      <EnTete titre="Réglages" />
      <Profil />
      <Compte />
      <Comptes />
      <Affichage />
      <Donnees />
      <Reinitialiser />
    </div>
  );
}

function Section({ titre, texte, children }: { titre: string; texte?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-filet pt-8 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-1">
        <h2>{titre}</h2>
        {texte && <p className="text-libelle text-texte-2">{fr(texte)}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/* ---------- Profil et niveau ---------- */

function Profil() {
  const naviguer = useNavigate();
  const [confirmer, setConfirmer] = useState(false);
  const { donnees } = useRequete(lireParcours);
  if (!donnees?.profil) return null;
  const { profil, parcours, etapes, enCours } = donnees;

  return (
    <Section titre="Profil et niveau" texte="Tes réponses au questionnaire ont généré ton parcours.">
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[160px_1fr]">
        <dt className="text-libelle text-texte-2">Nom d’artiste</dt>
        <dd>{profil.nomArtiste}</dd>
        <dt className="text-libelle text-texte-2">Profil</dt>
        <dd>{libellesRole[profil.role]}</dd>
        {parcours && (
          <>
            <dt className="text-libelle text-texte-2">Parcours</dt>
            <dd>
              {parcours.titre} · étape {deuxChiffres(enCours?.ordre ?? etapes.length)} /{deuxChiffres(etapes.length)}
            </dd>
          </>
        )}
      </dl>
      <Bouton variante="contour" className="self-start" onClick={() => setConfirmer(true)}>
        Refaire le questionnaire
      </Bouton>
      <Modale
        ouverte={confirmer}
        titre="Refaire le questionnaire ?"
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => naviguer("/bienvenue")}>Continuer</Bouton>
          </>
        }
      >
        <p className="text-texte-2">
          {fr("Ton parcours sera recalculé à partir de tes nouvelles réponses, et sa progression repartira de l’étape 01. Tes morceaux, contacts et sorties ne bougent pas.")}
        </p>
      </Modale>
    </Section>
  );
}

/* ---------- Compte et synchronisation ---------- */

function Compte() {
  const { session, etat, erreur, derniere, attente } = useCompte();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const naviguer = useNavigate();

  if (!session)
    return (
      <Section
        titre="Compte et synchronisation"
        texte="Connecte-toi avec ton mail pour sauvegarder tes données et les retrouver sur tes autres appareils. Sans compte, tout reste sur cet appareil."
      >
        <ConnexionCompte onConnecte={({ compteExistant }) => setMessage(compteExistant ? "Connecté. Ton compte avait déjà un parcours : il remplace celui de cet appareil. Le reste est réuni." : "Connecté. Tes données sont envoyées sur ton compte.")} />
        {message && <p role="status" className="text-libelle text-texte-2">{fr(message)}</p>}
      </Section>
    );

  const libelleEtat =
    etat === "en-cours"
      ? "Synchronisation…"
      : etat === "hors-ligne"
        ? "Hors ligne : les changements partiront au retour du réseau."
        : etat === "erreur"
          ? `Synchronisation impossible : ${erreur ?? "erreur inconnue"}`
          : derniere
            ? `À jour · ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(derniere))}`
            : "Pas encore synchronisé";

  return (
    <Section titre="Compte et synchronisation" texte="Tes données sont sauvegardées sur ton compte et te suivent sur tes autres appareils.">
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[160px_1fr]">
        <dt className="text-libelle text-texte-2">Compte</dt>
        <dd>{session.email}</dd>
        <dt className="text-libelle text-texte-2">Synchronisation</dt>
        <dd className="flex items-center gap-2">
          {etat === "ok" && <Icone nom="valide" taille={16} className="text-accent" />}
          {fr(libelleEtat)}
          {attente > 0 && etat !== "en-cours" && <span className="text-libelle text-texte-2">· {attente} en attente</span>}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Bouton variante="contour" disabled={etat === "en-cours"} onClick={() => void synchroniser()}>
          Synchroniser maintenant
        </Bouton>
        <Bouton variante="lien" onClick={() => void deconnecter()}>
          Se déconnecter
        </Bouton>
        <button type="button" onClick={() => setConfirmer(true)} className="text-libelle text-texte-2 hover:text-texte">
          Se déconnecter et effacer cet appareil
        </button>
      </div>
      <Modale
        ouverte={confirmer}
        titre="Effacer cet appareil ?"
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton
              onClick={async () => {
                await synchroniser();
                await deconnecter(true);
                naviguer("/bienvenue", { replace: true });
              }}
            >
              Effacer cet appareil
            </Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr("Tes données restent sur ton compte : tu les retrouves en te reconnectant. Cet appareil revient au questionnaire (pratique au stand).")}</p>
      </Modale>
    </Section>
  );
}

/* ---------- Comptes connectés ---------- */

function Comptes() {
  const { donnees } = useRequete(async () => ({
    gmail: await integrations.gmail.estConnectee(),
    instagram: await integrations.instagram.estConnectee(),
    tiktok: await integrations.tiktok.estConnectee(),
    spotify: await integrations.spotify.estConnectee(),
    spotifyDispo: await integrations.spotify.estDisponible(),
  }));
  if (!donnees) return null;

  const lignes = [
    { cle: "gmail", integration: integrations.gmail, detail: "Envois et suivi du réseau", dispo: true },
    { cle: "instagram", integration: integrations.instagram, detail: "Stats du compte", dispo: true },
    { cle: "tiktok", integration: integrations.tiktok, detail: "Stats du compte", dispo: true },
    { cle: "spotify", integration: integrations.spotify, detail: "Disponible après ta première sortie", dispo: donnees.spotifyDispo },
  ] as const;

  return (
    <Section titre="Comptes connectés" texte="Connexions simulées pour l’instant : aucune donnée n’est récupérée.">
      <ul className="flex flex-col gap-2">
        {lignes.map(({ cle, integration, detail, dispo }) => {
          const connecte = donnees[cle];
          return (
            <li key={cle} className="flex items-center justify-between gap-4 rounded-18 border border-filet px-5 py-4">
              <span className="flex flex-col">
                <span className={dispo ? "" : "text-texte-2"}>{integration.nom}</span>
                <span className="text-libelle text-texte-2">{connecte ? "Connexion simulée" : dispo && cle === "spotify" ? "Stats de streaming" : detail}</span>
              </span>
              {dispo && (
                <Bouton variante={connecte ? "lien" : "contour"} onClick={() => void (connecte ? integration.deconnecter() : integration.connecter())}>
                  {connecte ? "Déconnecter" : "Connecter"}
                </Bouton>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ---------- Mode d’affichage ---------- */

function Affichage() {
  const { theme, choisir } = useTheme();
  const [pleinEcran, setPleinEcran] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const suivre = () => setPleinEcran(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", suivre);
    return () => document.removeEventListener("fullscreenchange", suivre);
  }, []);
  return (
    <Section titre="Mode d’affichage" texte="Le plein écran masque le navigateur : idéal au stand. Échap pour en sortir.">
      <div role="radiogroup" aria-label="Mode d’affichage" className="inline-flex w-fit gap-1 rounded-full border border-filet p-1">
        {modes.map((m) => (
          <button
            key={m.valeur}
            type="button"
            role="radio"
            aria-checked={theme === m.valeur}
            onClick={() => choisir(m.valeur)}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[15px] transition-colors duration-150 ${
              theme === m.valeur ? "bg-surface text-texte" : "text-texte-2 hover:text-texte"
            }`}
          >
            <Icone nom={m.valeur} taille={16} />
            {m.libelle}
          </button>
        ))}
      </div>
      {document.fullscreenEnabled && (
        <Bouton
          variante="contour"
          icone="toutVoir"
          className="self-start"
          onClick={() => void (pleinEcran ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        >
          {pleinEcran ? "Quitter le plein écran" : "Passer en plein écran"}
        </Bouton>
      )}
    </Section>
  );
}

/* ---------- Données ---------- */

function Donnees() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [aImporter, setAImporter] = useState<File | null>(null);

  async function exporter() {
    const blob = await depots.exporter();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ctrl-app-${jourIso()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Export téléchargé.");
  }

  async function importer() {
    if (!aImporter) return;
    try {
      await depots.importer(aImporter);
      setMessage("Données importées.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import impossible.");
    }
    setAImporter(null);
  }

  return (
    <Section
      titre="Données"
      texte="Une copie de toutes tes données (fichiers audio et images compris) dans un fichier .json, à garder ou à importer sur un autre appareil."
    >
      <div className="flex flex-wrap gap-3">
        <Bouton variante="contour" icone="importer" className="[&_svg]:rotate-180" onClick={() => void exporter()}>
          Exporter mes données
        </Bouton>
        <Bouton variante="contour" icone="importer" onClick={() => input.current?.click()}>
          Importer un export
        </Bouton>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            setAImporter(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>
      {message && <p role="status" className="text-libelle text-texte-2">{fr(message)}</p>}
      <Modale
        ouverte={aImporter !== null}
        titre="Importer cet export ?"
        onFermer={() => setAImporter(null)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setAImporter(null)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void importer()}>Remplacer mes données</Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr("Les données actuelles de l’app seront remplacées par celles du fichier.")}</p>
      </Modale>
    </Section>
  );
}

/* ---------- Réinitialiser ---------- */

function Reinitialiser() {
  const naviguer = useNavigate();
  const choisir = useTheme((t) => t.choisir);
  const [confirmer, setConfirmer] = useState(false);

  async function reinitialiser() {
    // Un compte connecté est déconnecté (ses données restent sur le compte).
    if (useCompte.getState().session) await deconnecter();
    await depots.toutEffacer();
    choisir("sombre");
    naviguer("/bienvenue", { replace: true });
  }

  return (
    <Section titre="Réinitialiser l’app" texte="Efface tout et revient au questionnaire. Pratique au stand, entre deux visiteurs.">
      <Bouton variante="contour" className="self-start" onClick={() => setConfirmer(true)}>
        Réinitialiser l’app
      </Bouton>
      <Modale
        ouverte={confirmer}
        titre="Tout effacer ?"
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void reinitialiser()}>Tout effacer</Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr("Profil, parcours, morceaux, fichiers audio, contacts, sorties et boards seront effacés de cet appareil. Exporte tes données avant si tu veux les garder.")}</p>
      </Modale>
    </Section>
  );
}
