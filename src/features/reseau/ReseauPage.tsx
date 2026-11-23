import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Bouton } from "@/components/Bouton";
import { ChampTexte, Segmente } from "@/components/Champs";
import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";
import { Modale } from "@/components/Modale";
import { depots, useRequete } from "@/data";
import { libelleRole, rolesContact } from "@/content/modelesMail";
import { dateRelative } from "@/lib/format";
import type { Contact, Envoi, RoleContact } from "@/types";
import { creerContact, libellesStatut } from "./actions";

export function ReseauPage() {
  const [params, setParams] = useSearchParams();
  const naviguer = useNavigate();
  const vue = params.get("vue") === "envois" ? "envois" : "contacts";
  const [creation, setCreation] = useState(false);

  const { donnees } = useRequete(async () => {
    const [contacts, envois] = await Promise.all([depots.contacts.lister(), depots.envois.lister()]);
    return { contacts, envois };
  });
  if (!donnees) return null;

  return (
    <div className="flex flex-col gap-10">
      <EnTete
        titre="Réseau"
        actions={
          <>
            {donnees.contacts.length > 0 && (
              <Bouton variante="contour" icone="envoyer" onClick={() => naviguer("/reseau/envoi")}>
                Écrire un mail
              </Bouton>
            )}
            <Bouton icone="plus" onClick={() => setCreation(true)}>
              Nouveau contact
            </Bouton>
          </>
        }
      />

      <div role="tablist" aria-label="Vue" className="flex gap-6 border-b border-filet">
        {(["contacts", "envois"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={vue === v}
            onClick={() => setParams(v === "envois" ? { vue: v } : {})}
            className={`-mb-px border-b pb-3 transition-colors duration-150 ${
              vue === v ? "border-texte text-texte" : "border-transparent text-texte-2 hover:text-texte"
            }`}
          >
            {v === "contacts" ? "Contacts" : "Envois"}
            <span className="ml-2 text-texte-2 tabular-nums">{v === "contacts" ? donnees.contacts.length : donnees.envois.length}</span>
          </button>
        ))}
      </div>

      {vue === "contacts" ? (
        <Contacts contacts={donnees.contacts} envois={donnees.envois} onCreer={() => setCreation(true)} />
      ) : (
        <Envois envois={donnees.envois} contacts={donnees.contacts} />
      )}

      <NouveauContact ouverte={creation} onFermer={() => setCreation(false)} />
    </div>
  );
}

function Contacts({ contacts, envois, onCreer }: { contacts: Contact[]; envois: Envoi[]; onCreer(): void }) {
  const [filtre, setFiltre] = useState<RoleContact | "tous">("tous");
  if (contacts.length === 0)
    return (
      <EtatVide
        titre="Aucun contact pour l’instant."
        texte="Artistes, beatmakers, ingés son, graphistes, pros : garde au même endroit qui ils sont, ce que vous avez échangé, et quand relancer."
        action={
          <Bouton variante="contour" icone="plus" onClick={onCreer}>
            Ajouter un contact
          </Bouton>
        }
      />
    );

  const visibles = contacts.filter((c) => filtre === "tous" || c.role === filtre).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Filtrer par rôle" className="flex flex-wrap gap-2">
        {[{ valeur: "tous" as const, libelle: "Tous" }, ...rolesContact].map((r) => {
          const n = r.valeur === "tous" ? contacts.length : contacts.filter((c) => c.role === r.valeur).length;
          if (n === 0 && r.valeur !== "tous") return null;
          return (
            <button
              key={r.valeur}
              type="button"
              role="radio"
              aria-checked={filtre === r.valeur}
              onClick={() => setFiltre(r.valeur)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] transition-colors duration-150 ${
                filtre === r.valeur ? "border-texte-2 bg-surface text-texte" : "border-filet text-texte-2 hover:text-texte"
              }`}
            >
              {r.libelle}
              <span className="text-texte-2 tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
      <ul className="flex flex-col">
        {visibles.map((c) => {
          const dernier = envois.filter((e) => e.contactId === c.id).sort((a, b) => b.envoyeAt.localeCompare(a.envoyeAt))[0];
          return (
            <li key={c.id} className="border-t border-filet last:border-b">
              <Link to={`/reseau/${c.id}`} className="grid grid-cols-[40px_1fr_120px_200px] items-center gap-6 py-4 transition-colors duration-150 hover:bg-surface/60">
                <span aria-hidden className="flex size-10 items-center justify-center rounded-full border border-filet text-libelle uppercase">
                  {c.nom.slice(0, 2)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{c.nom}</span>
                  {c.email && <span className="truncate text-libelle text-texte-2">{c.email}</span>}
                </span>
                <span className="text-libelle text-texte-2">{libelleRole(c.role)}</span>
                <span className="text-right text-libelle text-texte-2">
                  {dernier ? `${libellesStatut[dernier.statut]} · ${dateRelative(dernier.envoyeAt)}` : "Aucun envoi"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Envois({ envois, contacts, compact = false }: { envois: Envoi[]; contacts: Contact[]; compact?: boolean }) {
  if (envois.length === 0)
    return <p className="text-texte-2">Aucun envoi pour l’instant. Les mails envoyés depuis l’app s’affichent ici, avec leur suivi.</p>;
  return (
    <ul className="flex flex-col">
      {[...envois]
        .sort((a, b) => b.envoyeAt.localeCompare(a.envoyeAt))
        .map((e) => {
          const c = contacts.find((x) => x.id === e.contactId);
          return (
            <li key={e.id} className="border-t border-filet last:border-b">
              <Link to={`/reseau/${e.contactId}`} className="flex items-baseline justify-between gap-6 py-4 hover:opacity-80">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{e.objet}</span>
                  <span className="text-libelle text-texte-2">
                    {!compact && c ? `${c.nom} · ` : ""}
                    {dateRelative(e.envoyeAt)}
                    {e.simule && " · simulé"}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-filet px-3 py-1 text-libelle">{libellesStatut[e.statut]}</span>
              </Link>
            </li>
          );
        })}
    </ul>
  );
}

function NouveauContact({ ouverte, onFermer }: { ouverte: boolean; onFermer(): void }) {
  const naviguer = useNavigate();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleContact>("artiste");

  async function creer() {
    if (!nom.trim()) return;
    const c = await creerContact(nom, role, email);
    setNom("");
    setEmail("");
    onFermer();
    naviguer(`/reseau/${c.id}`);
  }

  return (
    <Modale
      ouverte={ouverte}
      titre="Nouveau contact"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="lien" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={() => void creer()} disabled={!nom.trim()}>
            Créer
          </Bouton>
        </>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void creer();
        }}
      >
        <ChampTexte libelle="Nom" valeur={nom} onChange={setNom} placeholder="Nom ou pseudo" autoFocus maxLength={80} />
        <ChampTexte libelle="Mail (facultatif)" type="email" valeur={email} onChange={setEmail} placeholder="nom@exemple.fr" />
        <Segmente libelle="Rôle" options={[...rolesContact]} valeur={role} onChange={(r) => setRole(r as RoleContact)} />
      </form>
    </Modale>
  );
}
