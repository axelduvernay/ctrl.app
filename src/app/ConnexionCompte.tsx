import { useEffect, useState } from "react";
import { Bouton } from "@/components/Bouton";
import { ChampTexte } from "@/components/Champs";
import { fr } from "@/content/typo";
import { depots } from "@/data";
import { envoyerCode, rejoindreAutreOnglet, verifierCode } from "@/data/remote/sync";

/** Connexion par mail : on reçoit un code à 6 chiffres, on le tape. Pas de
    mot de passe. Utilisé à la fin du questionnaire et dans Réglages. */
export function ConnexionCompte({ onConnecte }: { onConnecte(r: { compteExistant: boolean }): void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Le lien du mail s’ouvre dans un nouvel onglet, qui se connecte : on le
  // détecte ici pour continuer sans rien retaper.
  useEffect(() => {
    if (!envoye) return;
    const t = setInterval(async () => {
      if (!(await rejoindreAutreOnglet())) return;
      clearInterval(t);
      const profils = await depots.profils.lister();
      onConnecte({ compteExistant: profils.some((p) => p.onboardingTermineAt) });
    }, 1500);
    return () => clearInterval(t);
  }, [envoye, onConnecte]);

  async function demander() {
    if (!emailValide || attente) return;
    setAttente(true);
    setErreur(null);
    try {
      await envoyerCode(email);
      setEnvoye(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi impossible.");
    }
    setAttente(false);
  }

  async function valider() {
    if (code.trim().length < 6 || attente) return;
    setAttente(true);
    setErreur(null);
    try {
      onConnecte(await verifierCode(email, code));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Code refusé.");
      setAttente(false);
    }
  }

  return (
    <form
      className="flex max-w-[480px] flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void (envoye ? valider() : demander());
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <ChampTexte
        libelle="Ton adresse mail"
        type="email"
        autoComplete="email"
        valeur={email}
        onChange={(v) => {
          setEmail(v);
          setEnvoye(false);
        }}
        placeholder="nom@exemple.fr"
      />
      {envoye && (
        <ChampTexte
          libelle="Code reçu par mail (s’il y en a un)"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={8}
          valeur={code}
          onChange={(v) => setCode(v.replace(/\D/g, ""))}
          placeholder="123456"
        />
      )}
      {erreur && <p role="alert" className="text-libelle text-texte">{fr(erreur)}</p>}
      <div className="flex flex-wrap items-center gap-4">
        {envoye ? (
          <>
            <Bouton type="submit" variante="contour" disabled={code.trim().length < 6 || attente}>
              {attente ? "Vérification…" : "Valider le code"}
            </Bouton>
            <button type="button" onClick={() => void demander()} className="text-libelle text-texte-2 hover:text-texte">
              Renvoyer un code
            </button>
          </>
        ) : (
          <Bouton type="submit" variante="contour" disabled={!emailValide || attente}>
            {attente ? "Envoi…" : "Recevoir un code"}
          </Bouton>
        )}
      </div>
      {envoye && (
        <p className="text-libelle text-texte-2">
          {fr(
            `Mail envoyé à ${email.trim()} (pense aux spams). Clique le lien du mail : un onglet s’ouvre et te connecte, celui-ci suit tout seul. Si le mail contient un code, tape-le ci-dessus.`,
          )}
        </p>
      )}
    </form>
  );
}
