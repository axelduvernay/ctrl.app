import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Bouton } from "@/components/Bouton";
import { ChampSelect, ChampTexte, Option, ZoneTexte } from "@/components/Champs";
import { depots, useRequete } from "@/data";
import { integrations } from "@/integrations";
import { modelesMail, remplir } from "@/content/modelesMail";
import { fr } from "@/content/typo";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { FilAriane } from "@/components/FilAriane";
import { envoyerMail } from "./actions";

/** Composer un mail (prods, maquettes, liens) depuis l’app. Gmail est
    simulé : l’envoi est enregistré dans l’historique avec la mention « simulé ». */
export function EnvoiPage() {
  const [params] = useSearchParams();
  const naviguer = useNavigate();
  const [contactId, setContactId] = useState(params.get("contact") ?? "");
  const [modeleId, setModeleId] = useState("");
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [choix, setChoix] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const { donnees } = useRequete(async () => {
    const [contacts, morceaux, profils] = await Promise.all([depots.contacts.lister(), depots.morceaux.lister(), depots.profils.lister()]);
    return { contacts, morceaux, profil: profils[0], gmail: await integrations.gmail.estConnectee() };
  });

  const modeles = useMemo(() => {
    const role = donnees?.profil?.role;
    return [...modelesMail].sort((a, b) => Number(!!role && b.pour.includes(role)) - Number(!!role && a.pour.includes(role)));
  }, [donnees?.profil?.role]);

  const contact = donnees?.contacts.find((c) => c.id === contactId);
  const titres = choix.map((id) => donnees?.morceaux.find((m) => m.id === id)?.titre).filter((t): t is string => !!t);

  // Choisir un modèle remplit l’objet et le texte (modifiables ensuite).
  useEffect(() => {
    const m = modelesMail.find((x) => x.id === modeleId);
    if (!m || !donnees) return;
    const v = { prenom: contact?.nom.split(" ")[0] ?? "", nomArtiste: donnees.profil?.nomArtiste ?? "", morceaux: titres };
    setObjet(remplir(m.objet, v));
    setCorps(remplir(m.corps, v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeleId, contactId, choix.join()]);

  if (!donnees) return null;

  async function envoyer() {
    if (!contact || !objet.trim() || envoi) return;
    setEnvoi(true);
    await envoyerMail({ contact, objet, corps, morceauIds: choix, modeleId: modeleId || null });
    naviguer(`/reseau/${contact.id}`, { replace: true });
  }

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between gap-6">
        <FilAriane liens={[{ libelle: "Réseau", vers: "/reseau" }]} courant={"Nouveau mail"} />
        <ActionsEnTete />
      </div>

      <h1 className="text-[40px] leading-tight font-medium tracking-[-0.03em]">Écrire un mail</h1>

      {!donnees.gmail && (
        <p className="max-w-[720px] rounded-18 border border-filet px-5 py-4 text-texte-2">
          {fr("Gmail est simulé pour l’instant : le mail n’est pas vraiment envoyé, il est enregistré dans ton historique avec la mention « simulé ».")}
        </p>
      )}

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <form
          className="flex min-w-0 flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void envoyer();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampSelect
              libelle="À"
              valeur={contactId}
              options={[{ valeur: "", libelle: "Choisis un contact" }, ...donnees.contacts.map((c) => ({ valeur: c.id, libelle: c.email ? `${c.nom} (${c.email})` : c.nom }))]}
              onChange={setContactId}
            />
            <ChampSelect
              libelle="Modèle"
              valeur={modeleId}
              options={[{ valeur: "", libelle: "Sans modèle" }, ...modeles.map((m) => ({ valeur: m.id, libelle: m.titre }))]}
              onChange={setModeleId}
            />
          </div>
          <ChampTexte libelle="Objet" valeur={objet} onChange={setObjet} maxLength={160} />
          <div className="flex flex-col gap-2">
            <span className="text-libelle text-texte-2">Message</span>
            <ZoneTexte libelle="Message" valeur={corps} onChange={setCorps} placeholder="Ton message, tes liens d’écoute…" />
          </div>
          <div className="flex items-center gap-4">
            <Bouton type="submit" icone="envoyer" disabled={!contact || !objet.trim() || envoi}>
              {donnees.gmail ? "Envoyer (simulé)" : "Enregistrer l’envoi (simulé)"}
            </Bouton>
            {contact && !contact.email && <span className="text-libelle text-texte-2">Ce contact n’a pas de mail renseigné.</span>}
          </div>
        </form>

        <aside className="flex flex-col gap-3">
          <h2 className="text-libelle text-texte-2">Morceaux joints</h2>
          {donnees.morceaux.length === 0 ? (
            <p className="text-texte-2">Aucun morceau dans ta librairie.</p>
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {donnees.morceaux
                .sort((a, b) => a.titre.localeCompare(b.titre, "fr"))
                .map((m) => (
                  <Option
                    key={m.id}
                    forme="case"
                    choisi={choix.includes(m.id)}
                    onClick={() => setChoix((c) => (c.includes(m.id) ? c.filter((x) => x !== m.id) : [...c, m.id]))}
                    titre={m.titre}
                  />
                ))}
            </div>
          )}
          <p className="text-libelle text-texte-2">{fr("Ils sont listés dans le mail et ajoutés aux morceaux échangés avec ce contact.")}</p>
        </aside>
      </div>
    </div>
  );
}
