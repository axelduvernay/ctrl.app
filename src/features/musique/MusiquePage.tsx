import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";
import { Bouton } from "@/components/Bouton";
import { ChampTexte, Segmente } from "@/components/Champs";
import { Modale } from "@/components/Modale";
import { PastilleStatut } from "@/components/PastilleStatut";
import { depots, useRequete } from "@/data";
import { statuts, typeProjet, typesProjet } from "@/content/statuts";
import { dateRelative } from "@/lib/format";
import type { Morceau, StatutMorceau, TypeProjet } from "@/types";
import { creerMorceau, creerProjet } from "./actions";
import { ChoixStatut, Vignette } from "./communs";

type Vue = "catalogue" | "projets";

export function MusiquePage() {
  const [params, setParams] = useSearchParams();
  const vue: Vue = params.get("vue") === "projets" ? "projets" : "catalogue";
  const [creation, setCreation] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <EnTete
        titre="Musique"
        actions={
          <Bouton icone="plus" onClick={() => setCreation(true)}>
            {vue === "catalogue" ? "Nouveau morceau" : "Nouveau projet"}
          </Bouton>
        }
      />

      <div role="tablist" aria-label="Vue" className="flex gap-6 border-b border-filet">
        {(["catalogue", "projets"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={vue === v}
            onClick={() => setParams(v === "projets" ? { vue: v } : {})}
            className={`-mb-px border-b pb-3 transition-colors duration-150 ${
              vue === v ? "border-texte text-texte" : "border-transparent text-texte-2 hover:text-texte"
            }`}
          >
            {v === "catalogue" ? "Catalogue" : "Projets"}
          </button>
        ))}
      </div>

      {vue === "catalogue" ? <Catalogue onCreer={() => setCreation(true)} /> : <Projets onCreer={() => setCreation(true)} />}

      {vue === "catalogue" ? (
        <NouveauMorceau ouverte={creation} onFermer={() => setCreation(false)} />
      ) : (
        <NouveauProjet ouverte={creation} onFermer={() => setCreation(false)} />
      )}
    </div>
  );
}

/* ---------- Catalogue ---------- */

function Catalogue({ onCreer }: { onCreer(): void }) {
  const [filtre, setFiltre] = useState<StatutMorceau | "tous">("tous");
  const { donnees } = useRequete(async () => {
    const [morceaux, projets, versions] = await Promise.all([
      depots.morceaux.lister(),
      depots.projets.lister(),
      depots.versions.lister(),
    ]);
    return { morceaux, projets, versions };
  });
  if (!donnees) return null;

  const { morceaux, projets, versions } = donnees;
  if (morceaux.length === 0)
    return (
      <EtatVide
        titre="Aucun morceau pour l’instant."
        texte="Ajoute tes prods et tes maquettes, même à l’état d’idée : tout sera au même endroit, avec leurs versions et leurs notes."
        action={
          <Bouton variante="contour" icone="plus" onClick={onCreer}>
            Ajouter ton premier morceau
          </Bouton>
        }
      />
    );

  const compte = (s: StatutMorceau) => morceaux.filter((m) => m.statut === s).length;
  const visibles = morceaux
    .filter((m) => filtre === "tous" || m.statut === filtre)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        <Filtre actif={filtre === "tous"} onClick={() => setFiltre("tous")} libelle="Tous" nombre={morceaux.length} />
        {statuts.map((s) => (
          <Filtre
            key={s.valeur}
            actif={filtre === s.valeur}
            onClick={() => setFiltre(s.valeur)}
            libelle={s.libelle}
            nombre={compte(s.valeur)}
            couleur={s.couleur}
          />
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="py-8 text-texte-2">Aucun morceau avec ce statut.</p>
      ) : (
        <ul className="flex flex-col">
          {visibles.map((m) => (
            <LigneMorceau
              key={m.id}
              morceau={m}
              projet={projets.find((p) => p.id === m.projetId)?.titre}
              nbVersions={versions.filter((v) => v.morceauId === m.id).length}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Filtre({ actif, onClick, libelle, nombre, couleur }: { actif: boolean; onClick(): void; libelle: string; nombre: number; couleur?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actif}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] transition-colors duration-150 ${
        actif ? "border-texte-2 bg-surface text-texte" : "border-filet text-texte-2 hover:text-texte"
      }`}
    >
      {couleur && <span aria-hidden className="size-2 rounded-full" style={{ background: couleur }} />}
      {libelle}
      <span className="text-texte-2 tabular-nums">{nombre}</span>
    </button>
  );
}

function LigneMorceau({ morceau, projet, nbVersions }: { morceau: Morceau; projet?: string; nbVersions: number }) {
  return (
    <li className="border-t border-filet last:border-b">
      <Link
        to={`/musique/${morceau.id}`}
        className="grid grid-cols-[48px_1fr_140px_110px_130px] items-center gap-6 py-4 transition-colors duration-150 hover:bg-surface/60"
      >
        <Vignette fichierId={morceau.coverFichierId} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{morceau.titre}</span>
          {projet && <span className="truncate text-libelle text-texte-2">{projet}</span>}
        </span>
        <span className="text-libelle text-texte-2">
          <PastilleStatut valeur={morceau.statut} />
        </span>
        <span className="text-libelle text-texte-2 tabular-nums">
          {nbVersions === 0 ? "Aucune version" : nbVersions === 1 ? "1 version" : `${nbVersions} versions`}
        </span>
        <span className="text-right text-libelle text-texte-2">modifié {dateRelative(morceau.updatedAt)}</span>
      </Link>
    </li>
  );
}

function NouveauMorceau({ ouverte, onFermer }: { ouverte: boolean; onFermer(): void }) {
  const naviguer = useNavigate();
  const [titre, setTitre] = useState("");
  const [statut, setStatut] = useState<StatutMorceau>("maquette");

  async function creer() {
    if (!titre.trim()) return;
    const m = await creerMorceau(titre, statut);
    setTitre("");
    onFermer();
    naviguer(`/musique/${m.id}`);
  }

  return (
    <Modale
      ouverte={ouverte}
      titre="Nouveau morceau"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="lien" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={creer} disabled={!titre.trim()}>
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
        <ChampTexte libelle="Titre" valeur={titre} onChange={setTitre} placeholder="Même provisoire" autoFocus maxLength={120} />
        <div className="flex flex-col gap-2">
          <span className="text-libelle text-texte-2">Statut</span>
          <ChoixStatut valeur={statut} onChange={setStatut} />
        </div>
      </form>
    </Modale>
  );
}

/* ---------- Projets ---------- */

function Projets({ onCreer }: { onCreer(): void }) {
  const { donnees: projets } = useRequete(() => depots.projets.lister());
  if (!projets) return null;
  if (projets.length === 0)
    return (
      <EtatVide
        titre="Aucun projet pour l’instant."
        texte="Un EP, une mixtape ou une simple tracklist : une liste ordonnée de tes morceaux, à écouter dans l’ordre."
        action={
          <Bouton variante="contour" icone="plus" onClick={onCreer}>
            Créer un projet
          </Bouton>
        }
      />
    );

  return (
    <ul className="flex flex-col">
      {[...projets]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((p) => (
          <li key={p.id} className="border-t border-filet last:border-b">
            <Link
              to={`/musique/projets/${p.id}`}
              className="grid grid-cols-[48px_1fr_140px_130px] items-center gap-6 py-4 transition-colors duration-150 hover:bg-surface/60"
            >
              <span className="flex size-12 items-center justify-center rounded-12 border border-filet text-texte-2">
                <span className="text-libelle">{typeProjet(p.type)}</span>
              </span>
              <span className="truncate">{p.titre}</span>
              <span className="text-libelle text-texte-2 tabular-nums">
                {p.morceauIds.length === 0 ? "Vide" : p.morceauIds.length === 1 ? "1 morceau" : `${p.morceauIds.length} morceaux`}
              </span>
              <span className="text-right text-libelle text-texte-2">modifié {dateRelative(p.updatedAt)}</span>
            </Link>
          </li>
        ))}
    </ul>
  );
}

function NouveauProjet({ ouverte, onFermer }: { ouverte: boolean; onFermer(): void }) {
  const naviguer = useNavigate();
  const [titre, setTitre] = useState("");
  const [type, setType] = useState<TypeProjet>("ep");

  async function creer() {
    if (!titre.trim()) return;
    const p = await creerProjet(titre, type);
    setTitre("");
    onFermer();
    naviguer(`/musique/projets/${p.id}`);
  }

  return (
    <Modale
      ouverte={ouverte}
      titre="Nouveau projet"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="lien" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={creer} disabled={!titre.trim()}>
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
        <ChampTexte libelle="Titre" valeur={titre} onChange={setTitre} placeholder="Ex. Projet EP" autoFocus maxLength={120} />
        <Segmente libelle="Type" options={typesProjet} valeur={type} onChange={setType} />
      </form>
    </Modale>
  );
}
