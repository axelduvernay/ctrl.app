import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { ChampSelect, ChampTexte, Segmente } from "@/components/Champs";
import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";
import { Modale } from "@/components/Modale";
import { Progression } from "@/components/Progression";
import { depots, useRequete } from "@/data";
import { plateformesPost } from "@/content/checklist";
import { fr } from "@/content/typo";
import { depuisJour, jourIso, libelleJour } from "@/lib/format";
import type { Etape, Evenement, Morceau, PostReseau, Sortie } from "@/types";
import { contenuDe } from "@/content/parcours";
import { lireParcours } from "@/features/parcours/actions";
import { creerSortie, enregistrerPost, estFait, modifierEvenement, pointsAutomatiques, supprimerEvenement, supprimerPost } from "./actions";

const joursSemaine = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function SortiesPage() {
  const [params, setParams] = useSearchParams();
  const [creation, setCreation] = useState<string | null>(null);
  const [post, setPost] = useState<Partial<PostReseau> | null>(null);
  const [evenement, setEvenement] = useState<Evenement | null>(null);
  const [mois, setMois] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Depuis l’Accueil : /sorties?nouvelle=<morceau> ouvre la création.
  useEffect(() => {
    const m = params.get("nouvelle");
    if (m !== null) {
      setCreation(m);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const { donnees } = useRequete(async () => {
    const [sorties, posts, morceaux, evenements] = await Promise.all([
      depots.sorties.lister(),
      depots.postsReseaux.lister(),
      depots.morceaux.lister(),
      depots.evenements.lister(),
    ]);
    const objectifs = (await lireParcours()).etapes.filter((e) => e.objectif && e.statut !== "validee");
    return { sorties, posts, morceaux, evenements, objectifs };
  });
  if (!donnees) return null;
  const { sorties, posts, morceaux, evenements, objectifs } = donnees;

  return (
    <div className="flex flex-col gap-10">
      <EnTete
        titre="Sorties"
        actions={
          <Bouton icone="plus" onClick={() => setCreation("")}>
            Nouvelle sortie
          </Bouton>
        }
      />

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <Calendrier
          mois={mois}
          setMois={setMois}
          sorties={sorties}
          posts={posts}
          evenements={evenements}
          objectifs={objectifs}
          onEvenement={setEvenement}
          morceaux={morceaux}
          onJour={(date) => setPost({ date, plateforme: "Instagram", description: "", sortieId: null })}
          onPost={setPost}
        />
        <aside className="flex flex-col gap-8">
          <ProchainesSorties sorties={sorties} posts={posts} morceaux={morceaux} onCreer={() => setCreation("")} />
          <Link to="/sorties/distribution" className="flex flex-col gap-1 rounded-18 border border-filet px-5 py-4 transition-colors duration-150 hover:bg-surface">
            <span>Distribution</span>
            <span className="text-libelle text-texte-2">{fr("Sortir un morceau sans quitter ctrl.app : bientôt.")}</span>
          </Link>
        </aside>
      </div>

      <NouvelleSortie morceauInitial={creation} morceaux={morceaux} sorties={sorties} onFermer={() => setCreation(null)} />
      <EditionPost post={post} sorties={sorties} morceaux={morceaux} onFermer={() => setPost(null)} />
      <EditionEvenement evenement={evenement} onFermer={() => setEvenement(null)} />
    </div>
  );
}

/* ---------- Calendrier ---------- */

function Calendrier({
  mois,
  setMois,
  sorties,
  posts,
  evenements,
  objectifs,
  onEvenement,
  morceaux,
  onJour,
  onPost,
}: {
  mois: Date;
  setMois(d: Date): void;
  sorties: Sortie[];
  posts: PostReseau[];
  evenements: Evenement[];
  objectifs: Etape[];
  onEvenement(e: Evenement): void;
  morceaux: Morceau[];
  onJour(jour: string): void;
  onPost(p: PostReseau): void;
}) {
  const naviguer = useNavigate();
  const aujourdHui = jourIso();
  const decalage = (mois.getDay() + 6) % 7; // lundi en premier
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const cases = Array.from({ length: Math.ceil((decalage + nbJours) / 7) * 7 }, (_, i) => {
    const n = i - decalage + 1;
    return n >= 1 && n <= nbJours ? jourIso(new Date(mois.getFullYear(), mois.getMonth(), n)) : null;
  });
  const titre = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(mois);
  const changer = (n: number) => setMois(new Date(mois.getFullYear(), mois.getMonth() + n, 1));

  return (
    <section aria-label="Calendrier" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] first-letter:uppercase">{titre}</h2>
        <div className="flex items-center gap-1">
          <Bouton variante="lien" onClick={() => setMois(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Aujourd’hui
          </Bouton>
          <BoutonIcone icone="precedent" libelle="Mois précédent" onClick={() => changer(-1)} className="border-transparent" />
          <BoutonIcone icone="suivant" libelle="Mois suivant" onClick={() => changer(1)} className="border-transparent" />
        </div>
      </div>
      <div className="grid grid-cols-7 border-t border-l border-filet">
        {joursSemaine.map((j) => (
          <div key={j} className="border-r border-b border-filet px-3 py-2 text-libelle text-texte-2">
            {j}
          </div>
        ))}
        {cases.map((jour, i) => {
          if (!jour) return <div key={i} className="min-h-28 border-r border-b border-filet bg-surface/40" />;
          const sortiesDuJour = sorties.filter((s) => s.date === jour);
          const postsDuJour = posts.filter((p) => p.date === jour);
          const evenementsDuJour = evenements.filter((e) => e.date === jour).sort((a, b) => (a.heure ?? "").localeCompare(b.heure ?? ""));
          return (
            <div
              key={jour}
              role="button"
              tabIndex={0}
              aria-label={`Planifier un post le ${libelleJour(jour)}`}
              onClick={() => onJour(jour)}
              onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onJour(jour)}
              className="group flex min-h-28 cursor-pointer flex-col gap-1 border-r border-b border-filet p-2 transition-colors duration-150 hover:bg-surface"
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-libelle tabular-nums ${
                  jour === aujourdHui ? "bg-inverse text-sur-inverse" : "text-texte-2"
                }`}
              >
                {depuisJour(jour).getDate()}
              </span>
              {sortiesDuJour.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    naviguer(`/sorties/${s.id}`);
                  }}
                  className="truncate rounded-[8px] bg-filet px-2 py-1 text-left text-[13px] font-medium text-texte"
                >
                  {morceaux.find((m) => m.id === s.morceauId)?.titre ?? s.metadonnees.titre}
                </button>
              ))}
              {objectifs
                .filter((o) => o.objectif === jour)
                .map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      naviguer("/parcours");
                    }}
                    className="truncate px-2 py-0.5 text-left text-[13px] text-texte-2 hover:text-texte"
                  >
                    Objectif · {contenuDe(o).titre}
                  </button>
                ))}
              {evenementsDuJour.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEvenement(ev);
                  }}
                  className="truncate px-2 py-0.5 text-left text-[13px] text-texte hover:underline underline-offset-4"
                >
                  {ev.heure && <span className="text-texte-2 tabular-nums">{ev.heure} </span>}
                  {ev.titre}
                </button>
              ))}
              {postsDuJour.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPost(p);
                  }}
                  className="truncate rounded-[8px] border border-filet px-2 py-1 text-left text-[13px] text-texte-2 hover:text-texte"
                >
                  {p.plateforme}
                  {p.description && ` · ${p.description}`}
                </button>
              ))}
              <span className="mt-auto text-[12px] text-texte-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">+ post</span>
            </div>
          );
        })}
      </div>
      <p className="text-libelle text-texte-2">{fr("Clique sur un jour pour planifier un post. Les sorties apparaissent sur fond plein, tes événements en texte (ajoute-les avec le bouton +).")}</p>
    </section>
  );
}

/* ---------- Prochaines sorties ---------- */

function ProchainesSorties({ sorties, posts, morceaux, onCreer }: { sorties: Sortie[]; posts: PostReseau[]; morceaux: Morceau[]; onCreer(): void }) {
  const liste = [...sorties].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  return (
    <section aria-labelledby="titre-prochaines" className="flex flex-col gap-4">
      <h2 id="titre-prochaines" className="text-libelle text-texte-2">
        Tes sorties
      </h2>
      {liste.length === 0 ? (
        <EtatVide
          titre="Aucune sortie prévue."
          texte="Crée une sortie pour un morceau : tu auras sa checklist, ses métadonnées et sa date dans le calendrier."
          action={
            <Bouton variante="contour" icone="plus" onClick={onCreer}>
              Préparer une sortie
            </Bouton>
          }
        />
      ) : (
        <ul className="flex flex-col">
          {liste.map((s) => {
            const m = morceaux.find((x) => x.id === s.morceauId);
            const auto = pointsAutomatiques(s, m, posts);
            const faits = s.checklist.filter((c) => estFait(s, c.cle, auto)).length;
            return (
              <li key={s.id} className="border-t border-filet">
                <Link to={`/sorties/${s.id}`} className="flex flex-col gap-3 py-4 hover:opacity-80">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{m?.titre ?? s.metadonnees.titre}</span>
                    <span className="shrink-0 text-libelle text-texte-2">{s.date ? libelleJour(s.date) : "Sans date"}</span>
                  </span>
                  <Progression total={s.checklist.length} faites={faits} enCours={false} />
                  <span className="text-libelle text-texte-2 tabular-nums">
                    {faits} /{s.checklist.length} étapes
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- Modales ---------- */

function NouvelleSortie({ morceauInitial, morceaux, sorties, onFermer }: { morceauInitial: string | null; morceaux: Morceau[]; sorties: Sortie[]; onFermer(): void }) {
  const naviguer = useNavigate();
  const [morceauId, setMorceauId] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    if (morceauInitial !== null) {
      setMorceauId(morceauInitial);
      setDate("");
    }
  }, [morceauInitial]);

  const disponibles = morceaux.filter((m) => !sorties.some((s) => s.morceauId === m.id)).sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

  async function creer() {
    const m = morceaux.find((x) => x.id === morceauId);
    if (!m) return;
    const s = await creerSortie(m, date || null);
    onFermer();
    naviguer(`/sorties/${s.id}`);
  }

  return (
    <Modale
      ouverte={morceauInitial !== null}
      titre="Nouvelle sortie"
      onFermer={onFermer}
      actions={
        disponibles.length > 0 && (
          <>
            <Bouton variante="lien" onClick={onFermer}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void creer()} disabled={!morceauId}>
              Créer
            </Bouton>
          </>
        )
      }
    >
      {disponibles.length === 0 ? (
        <p className="text-texte-2">
          {fr(morceaux.length === 0 ? "Ajoute d’abord un morceau dans Musique." : "Tous tes morceaux ont déjà une sortie.")}{" "}
          <Link to="/musique" onClick={onFermer} className="text-texte underline-offset-4 hover:underline">
            Aller dans Musique
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <ChampSelect
            libelle="Morceau"
            valeur={morceauId}
            options={[{ valeur: "", libelle: "Choisis un morceau" }, ...disponibles.map((m) => ({ valeur: m.id, libelle: m.titre }))]}
            onChange={setMorceauId}
          />
          <label className="flex flex-col gap-2">
            <span className="text-libelle text-texte-2">Date de sortie (facultatif)</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
            />
          </label>
        </div>
      )}
    </Modale>
  );
}

export function EditionPost({
  post,
  sorties,
  morceaux,
  onFermer,
}: {
  post: Partial<PostReseau> | null;
  sorties: Sortie[];
  morceaux: Morceau[];
  onFermer(): void;
}) {
  const [brouillon, setBrouillon] = useState<Partial<PostReseau>>({});
  useEffect(() => {
    if (post) setBrouillon(post);
  }, [post]);

  async function enregistrer() {
    if (!brouillon.date) return;
    await enregistrerPost({
      id: brouillon.id,
      date: brouillon.date,
      plateforme: brouillon.plateforme ?? "Instagram",
      description: (brouillon.description ?? "").trim(),
      sortieId: brouillon.sortieId ?? null,
    });
    onFermer();
  }

  return (
    <Modale
      ouverte={post !== null}
      titre={brouillon.id ? "Post planifié" : "Planifier un post"}
      onFermer={onFermer}
      actions={
        <>
          {brouillon.id && (
            <Bouton variante="lien" className="mr-auto text-texte-2" onClick={() => void supprimerPost(brouillon.id!).then(onFermer)}>
              Supprimer
            </Bouton>
          )}
          <Bouton variante="lien" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={() => void enregistrer()} disabled={!brouillon.date}>
            Enregistrer
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="text-libelle text-texte-2">Date</span>
          <input
            type="date"
            value={brouillon.date ?? ""}
            onChange={(e) => setBrouillon((b) => ({ ...b, date: e.target.value }))}
            className="h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
          />
        </label>
        <Segmente
          libelle="Réseau"
          options={plateformesPost.map((p) => ({ valeur: p, libelle: p }))}
          valeur={brouillon.plateforme ?? "Instagram"}
          onChange={(plateforme) => setBrouillon((b) => ({ ...b, plateforme }))}
        />
        <ChampTexte
          libelle="Contenu"
          valeur={brouillon.description ?? ""}
          onChange={(description) => setBrouillon((b) => ({ ...b, description }))}
          placeholder="Ex. Extrait de 15 secondes, coulisses du clip"
          maxLength={140}
        />
        <ChampSelect
          libelle="Sortie liée (facultatif)"
          valeur={brouillon.sortieId ?? ""}
          options={[
            { valeur: "", libelle: "Aucune" },
            ...sorties.map((s) => ({ valeur: s.id, libelle: morceaux.find((m) => m.id === s.morceauId)?.titre ?? s.metadonnees.titre })),
          ]}
          onChange={(v) => setBrouillon((b) => ({ ...b, sortieId: v || null }))}
        />
      </div>
    </Modale>
  );
}

/* ---------- Événement ajouté avec le bouton + ---------- */

function EditionEvenement({ evenement, onFermer }: { evenement: Evenement | null; onFermer(): void }) {
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  useEffect(() => {
    setTitre(evenement?.titre ?? "");
    setDate(evenement?.date ?? "");
    setHeure(evenement?.heure ?? "");
  }, [evenement]);
  if (!evenement) return null;

  const champ = "h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none";
  return (
    <Modale
      ouverte
      titre="Événement"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="lien" onClick={() => void supprimerEvenement(evenement.id).then(onFermer)}>
            Supprimer
          </Bouton>
          <Bouton
            disabled={!titre.trim() || !date}
            onClick={() => void modifierEvenement(evenement.id, { titre: titre.trim(), date, heure: heure || null }).then(onFermer)}
          >
            Enregistrer
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <ChampTexte libelle="Événement" valeur={titre} onChange={setTitre} maxLength={140} />
        <div className="grid grid-cols-[1fr_160px] gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-libelle text-texte-2">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-libelle text-texte-2">Heure</span>
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={champ} />
          </label>
        </div>
      </div>
    </Modale>
  );
}
