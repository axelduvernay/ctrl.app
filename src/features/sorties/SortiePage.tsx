import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { Icone } from "@/components/Icone";
import { Modale } from "@/components/Modale";
import { Progression } from "@/components/Progression";
import { depots, useRequete } from "@/data";
import { ordreChecklist, pointsChecklist } from "@/content/checklist";
import { fr } from "@/content/typo";
import { depuisJour, jourIso, libelleJour } from "@/lib/format";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { FilAriane } from "@/components/FilAriane";
import { ChampEnregistre, Vignette } from "@/features/musique/communs";
import { modifierMorceau } from "@/features/musique/actions";
import type { CasParcours, CleChecklist, Metadonnees, Morceau, PostReseau, Sortie } from "@/types";
import { basculerPoint, estFait, majMetadonnees, modifierSortie, pointsAutomatiques, supprimerSortie } from "./actions";
import { EditionPost } from "./SortiesPage";

export function SortiePage() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const [post, setPost] = useState<Partial<PostReseau> | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  const { donnees, chargement } = useRequete(async () => {
    const sortie = await depots.sorties.obtenir(id);
    if (!sortie) return null;
    const [morceaux, posts, sorties, parcours] = await Promise.all([
      depots.morceaux.lister(),
      depots.postsReseaux.lister(),
      depots.sorties.lister(),
      depots.parcours.lister(),
    ]);
    return { sortie, morceaux, posts, sorties, cas: (parcours[0]?.cas ?? "A") as CasParcours };
  }, [id]);

  if (chargement) return null;
  if (!donnees)
    return (
      <p className="text-texte-2">
        Cette sortie n’existe plus.{" "}
        <Link to="/sorties" className="text-texte underline-offset-4 hover:underline">
          Retour aux sorties
        </Link>
      </p>
    );

  const { sortie, morceaux, posts, sorties, cas } = donnees;
  const morceau = morceaux.find((m) => m.id === sortie.morceauId);
  const sesPosts = posts.filter((p) => p.sortieId === sortie.id).sort((a, b) => a.date.localeCompare(b.date));
  const auto = pointsAutomatiques(sortie, morceau, posts);
  const faits = ordreChecklist.filter((c) => estFait(sortie, c, auto)).length;
  const titre = morceau?.titre ?? sortie.metadonnees.titre;
  const ecart = sortie.date ? Math.round((depuisJour(sortie.date).getTime() - depuisJour(jourIso()).getTime()) / 86400000) : null;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <FilAriane liens={[{ libelle: "Sorties", vers: "/sorties" }]} courant={titre} />
          <ActionsEnTete />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            {morceau && <Vignette fichierId={morceau.coverFichierId} taille={72} arrondi="rounded-18" />}
            <div>
              <h1 className="text-[40px] leading-tight font-medium tracking-[-0.03em]">{titre}</h1>
              <p className="text-texte-2">
                {sortie.date
                  ? ecart! > 0
                    ? `Sortie ${libelleJour(sortie.date).toLowerCase()} · dans ${ecart} jour${ecart! > 1 ? "s" : ""}`
                    : ecart === 0
                      ? "Sortie aujourd’hui"
                      : `Sortie le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(depuisJour(sortie.date))}`
                  : "Date à fixer"}
              </p>
            </div>
          </div>
          {morceau && morceau.statut !== "sorti" ? (
            <Bouton onClick={() => void modifierMorceau(morceau.id, { statut: "sorti" })}>Marquer comme sorti</Bouton>
          ) : (
            morceau && (
              <span className="flex items-center gap-2 text-texte-2">
                <Icone nom="valide" taille={16} className="text-accent" />
                Sorti
              </span>
            )
          )}
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="titre-checklist" className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between">
              <h2 id="titre-checklist" className="text-libelle text-texte-2">
                Checklist de sortie
              </h2>
              <span className="text-libelle text-texte-2 tabular-nums">
                {faits} /{ordreChecklist.length}
              </span>
            </div>
            <Progression total={ordreChecklist.length} faites={faits} enCours={false} />
            <ul className="flex flex-col">
              {ordreChecklist.map((cle) => (
                <PointChecklist key={cle} cle={cle} cas={cas} sortie={sortie} auto={!!auto[cle]} fait={estFait(sortie, cle, auto)} morceau={morceau} />
              ))}
            </ul>
          </section>

          <MetadonneesForm sortie={sortie} />
        </div>

        <aside className="flex flex-col gap-8">
          <label className="flex flex-col gap-2">
            <span className="text-libelle text-texte-2">Date de sortie</span>
            <input
              type="date"
              value={sortie.date ?? ""}
              onChange={(e) => void modifierSortie(sortie.id, { date: e.target.value || null })}
              className="h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
            />
          </label>

          <section aria-labelledby="titre-posts" className="flex flex-col gap-3">
            <h2 id="titre-posts" className="text-libelle text-texte-2">
              Contenus réseaux
            </h2>
            {sesPosts.length === 0 && <p className="text-texte-2">{fr("Aucun post planifié pour cette sortie.")}</p>}
            <ul className="flex flex-col gap-2">
              {sesPosts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPost(p)}
                    className="flex w-full flex-col rounded-12 border border-filet px-4 py-3 text-left transition-colors duration-150 hover:bg-surface"
                  >
                    <span>
                      {p.plateforme} · {libelleJour(p.date)}
                    </span>
                    {p.description && <span className="text-libelle text-texte-2">{p.description}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <Bouton
              variante="contour"
              icone="plus"
              className="self-start"
              onClick={() => setPost({ date: sortie.date ?? jourIso(), plateforme: "Instagram", description: "", sortieId: sortie.id })}
            >
              Planifier un post
            </Bouton>
          </section>

          <Link to="/sorties/distribution" className="text-libelle text-texte-2 hover:text-texte">
            {fr("Distribution depuis l’app : bientôt")}
          </Link>
          <button type="button" onClick={() => setConfirmer(true)} className="self-start text-libelle text-texte-2 hover:text-texte">
            Supprimer la sortie
          </button>
        </aside>
      </div>

      <EditionPost post={post} sorties={sorties} morceaux={morceaux} onFermer={() => setPost(null)} />
      <Modale
        ouverte={confirmer}
        titre="Supprimer cette sortie ?"
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton
              onClick={async () => {
                await supprimerSortie(sortie.id);
                naviguer("/sorties", { replace: true });
              }}
            >
              Supprimer
            </Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr("Le morceau et les posts planifiés restent dans l’app.")}</p>
      </Modale>
    </div>
  );
}

/* ---------- Checklist ---------- */

function PointChecklist({
  cle,
  cas,
  sortie,
  auto,
  fait,
  morceau,
}: {
  cle: CleChecklist;
  cas: CasParcours;
  sortie: Sortie;
  auto: boolean;
  fait: boolean;
  morceau?: Morceau;
}) {
  const point = pointsChecklist[cle];
  const lien =
    morceau && (cle === "cover" || cle === "mix-master")
      ? { vers: `/musique/${morceau.id}`, libelle: cle === "cover" ? "Ouvrir la fiche du morceau" : "Valider la version finale" }
      : cle === "distributeur"
        ? { vers: "/sorties/distribution", libelle: "En savoir plus" }
        : null;

  return (
    <li className="flex items-start gap-4 border-t border-filet py-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={fait}
        aria-label={point.titre[cas]}
        disabled={auto}
        onClick={() => void basculerPoint(sortie, cle)}
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 ${
          fait ? "border-accent bg-accent text-sur-accent" : "border-texte-2 hover:border-texte"
        } disabled:cursor-default`}
      >
        {fait && <Icone nom="valide" taille={14} />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={fait ? "text-texte-2" : "text-texte"}>{point.titre[cas]}</span>
        {auto && <span className="text-libelle text-texte-2">Fait automatiquement d’après tes infos.</span>}
        {!fait && cas === "A" && <span className="max-w-[560px] text-libelle text-texte-2">{fr(point.explication)}</span>}
        {!fait && lien && (
          <Link to={lien.vers} className="mt-1 self-start text-libelle text-texte underline-offset-4 hover:underline">
            {lien.libelle}
          </Link>
        )}
      </div>
    </li>
  );
}

/* ---------- Métadonnées ---------- */

function MetadonneesForm({ sortie }: { sortie: Sortie }) {
  const m = sortie.metadonnees;
  const enregistrer = (calcul: (m: Metadonnees) => Partial<Metadonnees>) => void majMetadonnees(sortie.id, calcul);

  return (
    <section aria-labelledby="titre-meta" className="flex flex-col gap-5">
      <h2 id="titre-meta" className="text-libelle text-texte-2">
        Métadonnées
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampEnregistre libelle="Titre" valeur={m.titre} onEnregistrer={(titre) => enregistrer(() => ({ titre: titre.trim() }))} />
        <ChampEnregistre
          libelle="Artistes (séparés par des virgules)"
          valeur={m.artistes.join(", ")}
          onEnregistrer={(v) => enregistrer(() => ({ artistes: v.split(",").map((a) => a.trim()).filter(Boolean) }))}
        />
        <ChampEnregistre libelle="Genre" placeholder="Rap, R&B, Pop…" valeur={m.genre} onEnregistrer={(genre) => enregistrer(() => ({ genre: genre.trim() }))} />
        <ChampEnregistre
          libelle="ISRC (facultatif)"
          placeholder="Fourni par ton distributeur"
          valeur={m.isrc}
          onEnregistrer={(isrc) => enregistrer(() => ({ isrc: isrc.trim().toUpperCase() }))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-libelle text-texte-2">Crédits</span>
        {m.credits.map((c, i) => (
          <div key={i} className="flex items-end gap-3">
            <ChampEnregistre
              libelle="Nom"
              className="flex-1 [&>span]:sr-only"
              valeur={c.nom}
              placeholder="Nom"
              onEnregistrer={(nom) => enregistrer((a) => ({ credits: a.credits.map((x, j) => (j === i ? { ...x, nom } : x)) }))}
            />
            <ChampEnregistre
              libelle="Rôle"
              className="flex-1 [&>span]:sr-only"
              valeur={c.role}
              placeholder="Rôle (prod, mix, featuring…)"
              onEnregistrer={(role) => enregistrer((a) => ({ credits: a.credits.map((x, j) => (j === i ? { ...x, role } : x)) }))}
            />
            <BoutonIcone icone="fermer" libelle="Retirer ce crédit" onClick={() => enregistrer((a) => ({ credits: a.credits.filter((_, j) => j !== i) }))} className="mb-0.5" />
          </div>
        ))}
        <Bouton variante="lien" icone="plus" className="self-start" onClick={() => enregistrer((a) => ({ credits: [...a.credits, { nom: "", role: "" }] }))}>
          Ajouter un crédit
        </Bouton>
      </div>
    </section>
  );
}
