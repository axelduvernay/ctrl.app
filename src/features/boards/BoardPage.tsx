import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { ChampTexte, Option } from "@/components/Champs";
import { Icone } from "@/components/Icone";
import { Modale } from "@/components/Modale";
import { depots, useRequete } from "@/data";
import { ActionsEnTete } from "@/app/ActionsEnTete";
import { fr } from "@/content/typo";
import type { Bloc, Id, TypeBloc, VueBoard } from "@/types";
import {
  basculerMorceauTracklist,
  creerBloc,
  deplacerBlocs,
  enregistrerVue,
  modifierBloc,
  relier,
  supprimerBloc,
  supprimerBoard,
  supprimerLien,
} from "./actions";
import { BlocVue, type Contexte } from "./BlocVue";
import { PAS_GRILLE, contient, courbe, courbeVersPoint, toutVoir, versMonde, zoomerAutour, type Rect } from "./geometrie";

type Selection = { type: "bloc" | "lien"; id: Id } | null;

/* Geste en cours : déplacer la vue, des blocs, tirer un lien ou agrandir une zone. */
type Geste =
  | { type: "vue"; ex: number; ey: number; vue: VueBoard }
  | { type: "blocs"; ex: number; ey: number; origines: Map<Id, { x: number; y: number }>; bouge: boolean; principal: Id }
  | { type: "lien"; de: Id }
  | { type: "taille"; id: Id; ex: number; ey: number; w: number; h: number };

const typesCreation: { type: TypeBloc | "morceau-choix" | "contact-choix"; libelle: string }[] = [
  { type: "note", libelle: "Note" },
  { type: "tache", libelle: "Tâche" },
  { type: "tracklist", libelle: "Tracklist" },
  { type: "zone", libelle: "Zone" },
  { type: "morceau-choix", libelle: "Morceau…" },
  { type: "contact-choix", libelle: "Contact…" },
];

export function BoardPage() {
  const { id = "" } = useParams();
  const naviguer = useNavigate();
  const { donnees, chargement } = useRequete(async () => {
    const board = await depots.boards.obtenir(id);
    if (!board) return null;
    const [blocs, liens, morceaux, contacts, taches, versions] = await Promise.all([
      depots.blocs.trouver("boardId", id),
      depots.liens.trouver("boardId", id),
      depots.morceaux.lister(),
      depots.contacts.lister(),
      depots.taches.lister(),
      depots.versions.lister(),
    ]);
    return { board, blocs, liens, contexte: { morceaux, contacts, taches, versions } as Contexte };
  }, [id]);

  if (chargement) return null;
  if (!donnees)
    return (
      <p className="text-texte-2">
        Ce board n’existe plus.{" "}
        <Link to="/boards" className="text-texte underline-offset-4 hover:underline">
          Retour aux boards
        </Link>
      </p>
    );
  return <Canvas key={id} {...donnees} onSupprime={() => naviguer("/boards", { replace: true })} />;
}

function Canvas({
  board,
  blocs,
  liens,
  contexte,
  onSupprime,
}: {
  board: { id: Id; titre: string; vue: VueBoard };
  blocs: Bloc[];
  liens: { id: Id; deBlocId: Id; versBlocId: Id }[];
  contexte: Contexte;
  onSupprime(): void;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const [vue, setVue] = useState<VueBoard>(board.vue);
  const [positions, setPositions] = useState<Map<Id, { x: number; y: number }>>(new Map());
  const [tailleZone, setTailleZone] = useState<{ id: Id; w: number; h: number } | null>(null);
  const [mesures, setMesures] = useState<Map<Id, { w: number; h: number }>>(new Map());
  const [selection, setSelection] = useState<Selection>(null);
  const [edition, setEdition] = useState<Id | null>(null);
  const [geste, setGeste] = useState<Geste | null>(null);
  const [pointeur, setPointeur] = useState<{ x: number; y: number } | null>(null);
  const [menuCreation, setMenuCreation] = useState(false);
  const [menuBoard, setMenuBoard] = useState(false);
  const [choix, setChoix] = useState<"morceau" | "contact" | "tracklist" | null>(null);
  const [tracklistCible, setTracklistCible] = useState<Id | null>(null);
  const [renommer, setRenommer] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  // Double-clic détecté à la main : le pointeur est capturé par le board.
  const dernierClic = useRef<{ id: Id; t: number } | null>(null);

  // Premier affichage d’un board neuf : l’origine du monde au centre de l’écran.
  useEffect(() => {
    if (board.vue.x === 0 && board.vue.y === 0 && cadre.current) {
      const r = cadre.current.getBoundingClientRect();
      setVue((v) => ({ ...v, x: r.width / 2, y: r.height / 2 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La vue s’enregistre au repos, pas à chaque image.
  useEffect(() => {
    const t = setTimeout(() => void enregistrerVue(board.id, vue), 400);
    return () => clearTimeout(t);
  }, [vue, board.id]);

  /* Taille réelle des blocs (hauteur selon le contenu), pour les liens. */
  const observateur = useMemo(
    () =>
      new ResizeObserver((entrees) => {
        setMesures((m) => {
          const suivant = new Map(m);
          for (const e of entrees) {
            const el = e.target as HTMLElement;
            suivant.set(el.dataset.bloc!, { w: el.offsetWidth, h: el.offsetHeight });
          }
          return suivant;
        });
      }),
    [],
  );
  useEffect(() => () => observateur.disconnect(), [observateur]);
  const mesurer = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) observateur.observe(el);
    },
    [observateur],
  );

  const rect = useCallback(
    (b: Bloc): Rect => {
      const p = positions.get(b.id) ?? b;
      const m = mesures.get(b.id);
      const taille = tailleZone?.id === b.id ? tailleZone : null;
      return { x: p.x, y: p.y, w: taille?.w ?? m?.w ?? b.largeur, h: taille?.h ?? m?.h ?? (b.hauteur || 80) };
    },
    [positions, mesures, tailleZone],
  );

  /* Molette : deux doigts pour se déplacer, pincement ou ⌘/Ctrl pour zoomer. */
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const surMolette = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-defile]")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Pincement : petits pas réguliers ; molette de souris : bornée à ±18 % par cran.
      if (e.ctrlKey || e.metaKey) {
        const pas = Math.max(-20, Math.min(20, e.deltaY));
        setVue((v) => zoomerAutour(v, Math.exp(-pas * 0.01), e.clientX - r.left, e.clientY - r.top));
      }
      else setVue((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", surMolette, { passive: false });
    return () => el.removeEventListener("wheel", surMolette);
  }, []);

  /* Clavier : Suppr efface la sélection, Échap désélectionne. */
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, select, dialog")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        if (selection.type === "bloc") void supprimerBloc(selection.id);
        else void supprimerLien(selection.id);
        setSelection(null);
      } else if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [selection]);

  const pointMonde = (e: { clientX: number; clientY: number }) => {
    const r = cadre.current!.getBoundingClientRect();
    return versMonde(vue, e.clientX - r.left, e.clientY - r.top);
  };

  function debutFond(e: React.PointerEvent) {
    if (e.button !== 0) return;
    setSelection(null);
    setMenuCreation(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGeste({ type: "vue", ex: e.clientX, ey: e.clientY, vue });
  }

  function debutBloc(e: React.PointerEvent, b: Bloc) {
    if (e.button !== 0 || edition === b.id) return;
    e.stopPropagation();
    cadre.current!.setPointerCapture(e.pointerId);
    const origines = new Map<Id, { x: number; y: number }>();
    const r0 = rect(b);
    origines.set(b.id, { x: r0.x, y: r0.y });
    // Déplacer une zone déplace les blocs qu’elle contient.
    if (b.type === "zone")
      for (const autre of blocs) if (autre.id !== b.id && autre.type !== "zone" && contient(r0, rect(autre))) origines.set(autre.id, { x: rect(autre).x, y: rect(autre).y });
    setGeste({ type: "blocs", ex: e.clientX, ey: e.clientY, origines, bouge: false, principal: b.id });
  }

  function debutLien(e: React.PointerEvent, b: Bloc) {
    e.stopPropagation();
    cadre.current!.setPointerCapture(e.pointerId);
    setGeste({ type: "lien", de: b.id });
    setPointeur(pointMonde(e));
  }

  function debutTaille(e: React.PointerEvent, b: Bloc) {
    e.stopPropagation();
    cadre.current!.setPointerCapture(e.pointerId);
    const r = rect(b);
    setGeste({ type: "taille", id: b.id, ex: e.clientX, ey: e.clientY, w: r.w, h: r.h });
  }

  function mouvement(e: React.PointerEvent) {
    if (!geste) return;
    if (geste.type === "vue") setVue({ ...geste.vue, x: geste.vue.x + e.clientX - geste.ex, y: geste.vue.y + e.clientY - geste.ey });
    else if (geste.type === "blocs") {
      const dx = (e.clientX - geste.ex) / vue.zoom;
      const dy = (e.clientY - geste.ey) / vue.zoom;
      if (!geste.bouge && Math.hypot(e.clientX - geste.ex, e.clientY - geste.ey) < 3) return;
      if (!geste.bouge) setGeste({ ...geste, bouge: true });
      const suivant = new Map<Id, { x: number; y: number }>();
      geste.origines.forEach((o, bid) => suivant.set(bid, { x: o.x + dx, y: o.y + dy }));
      setPositions(suivant);
    } else if (geste.type === "lien") setPointeur(pointMonde(e));
    else if (geste.type === "taille")
      setTailleZone({ id: geste.id, w: Math.max(240, geste.w + (e.clientX - geste.ex) / vue.zoom), h: Math.max(160, geste.h + (e.clientY - geste.ey) / vue.zoom) });
  }

  async function fin(e: React.PointerEvent) {
    const g = geste;
    setGeste(null);
    if (!g) return;
    if (g.type === "blocs") {
      if (g.bouge) {
        await deplacerBlocs([...positions].map(([bid, p]) => ({ id: bid, ...p })));
        setPositions(new Map());
      } else {
        setSelection({ type: "bloc", id: g.principal });
        const maintenant = performance.now();
        const b = parId.get(g.principal);
        if (dernierClic.current?.id === g.principal && maintenant - dernierClic.current.t < 400 && b && b.type !== "morceau" && b.type !== "contact") {
          setEdition(g.principal);
          dernierClic.current = null;
        } else dernierClic.current = { id: g.principal, t: maintenant };
      }
    } else if (g.type === "lien") {
      setPointeur(null);
      const cible = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-bloc]");
      if (cible?.dataset.bloc) await relier(board.id, g.de, cible.dataset.bloc);
    } else if (g.type === "taille" && tailleZone) {
      await modifierBloc(g.id, { largeur: Math.round(tailleZone.w), hauteur: Math.round(tailleZone.h) });
      setTailleZone(null);
    }
  }

  /* Création au centre de l’écran, légèrement décalée pour ne pas empiler. */
  async function creer(type: TypeBloc, extra: Partial<Pick<Bloc, "refId" | "titre">> = {}) {
    const r = cadre.current!.getBoundingClientRect();
    const c = versMonde(vue, r.width / 2, r.height / 2);
    const decalage = (blocs.length % 5) * 24;
    const b = await creerBloc(board.id, type, c.x + decalage, c.y + decalage, extra);
    setSelection({ type: "bloc", id: b.id });
    if (type === "note") setEdition(b.id);
    setMenuCreation(false);
  }

  function zoomer(facteur: number) {
    const r = cadre.current!.getBoundingClientRect();
    setVue((v) => zoomerAutour(v, facteur, r.width / 2, r.height / 2));
  }

  function cadrer() {
    const r = cadre.current!.getBoundingClientRect();
    setVue(toutVoir(blocs.map(rect), r.width, r.height));
  }

  const zones = blocs.filter((b) => b.type === "zone");
  const autres = blocs.filter((b) => b.type !== "zone");
  const parId = new Map(blocs.map((b) => [b.id, b]));
  const pas = PAS_GRILLE * vue.zoom;

  const rendreBloc = (b: Bloc) => {
    const p = positions.get(b.id) ?? b;
    const choisi = selection?.type === "bloc" && selection.id === b.id;
    const taille = tailleZone?.id === b.id ? tailleZone : null;
    return (
      <div
        key={b.id}
        ref={mesurer}
        data-bloc={b.id}
        onPointerDown={(e) => debutBloc(e, b)}
        className={`group absolute ${geste?.type === "blocs" && geste.origines.has(b.id) ? "cursor-grabbing" : "cursor-grab"} ${
          choisi ? "rounded-[20px] outline outline-1 outline-offset-2 outline-texte-2" : ""
        }`}
        style={{ left: p.x, top: p.y, ...(b.type === "zone" ? { width: taille?.w ?? b.largeur, height: taille?.h ?? b.hauteur } : {}) }}
      >
        <BlocVue
          bloc={taille ? { ...b, largeur: taille.w, hauteur: taille.h } : b}
          contexte={contexte}
          edition={edition === b.id}
          onEditer={(a) => setEdition(a ? b.id : null)}
          onAjouterMorceaux={() => {
            setTracklistCible(b.id);
            setChoix("tracklist");
          }}
        />
        {/* Poignée pour tirer un lien vers un autre bloc. */}
        <span
          role="presentation"
          title="Tirer pour relier"
          onPointerDown={(e) => debutLien(e, b)}
          className={`absolute top-1/2 -right-2 size-4 -translate-y-1/2 cursor-crosshair rounded-full border border-texte-2 bg-fond transition-opacity duration-150 ${
            choisi ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
        {b.type === "zone" && (
          <span
            role="presentation"
            title="Agrandir la zone"
            onPointerDown={(e) => debutTaille(e, b)}
            className="absolute right-3 bottom-3 size-3 cursor-nwse-resize rounded-[3px] border-r border-b border-texte-2 opacity-0 group-hover:opacity-100"
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 left-[88px] overflow-hidden bg-fond">
      {/* Calque du board */}
      <div
        ref={cadre}
        className={`absolute inset-0 touch-none select-none ${geste?.type === "vue" ? "cursor-grabbing" : ""}`}
        onPointerDown={debutFond}
        onPointerMove={mouvement}
        onPointerUp={(e) => void fin(e)}
        onPointerCancel={() => setGeste(null)}
      >
        <div
          aria-hidden
          className="grille-board absolute inset-0"
          style={{ backgroundSize: `${pas}px ${pas}px`, backgroundPosition: `${vue.x}px ${vue.y}px` }}
        />
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate3d(${vue.x}px, ${vue.y}px, 0) scale(${vue.zoom})` }}>
          {zones.map(rendreBloc)}
          <svg className="absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
            {liens.map((l) => {
              const a = parId.get(l.deBlocId);
              const b = parId.get(l.versBlocId);
              if (!a || !b) return null;
              const d = courbe(rect(a), rect(b));
              const choisi = selection?.type === "lien" && selection.id === l.id;
              return (
                <g key={l.id}>
                  <path d={d} fill="none" stroke={choisi ? "var(--texte)" : "var(--texte-2)"} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer"
                    style={{ pointerEvents: "stroke" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelection({ type: "lien", id: l.id });
                    }}
                  />
                </g>
              );
            })}
            {geste?.type === "lien" && pointeur && parId.get(geste.de) && (
              <path d={courbeVersPoint(rect(parId.get(geste.de)!), pointeur)} fill="none" stroke="var(--texte)" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {autres.map(rendreBloc)}
        </div>

        {blocs.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-[22px]">Ton board est vide.</p>
            <p className="max-w-sm text-texte-2">{fr("Ajoute une note, une tâche, une tracklist ou une zone avec le bouton +. Tire un trait depuis le rond d’un bloc pour le relier à un autre.")}</p>
          </div>
        )}
      </div>

      {/* Barre du haut */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-6 px-8 pt-8 lg:px-[72px]">
        <nav aria-label="Fil d’Ariane" className="pointer-events-auto flex items-center gap-2 rounded-full bg-fond/90 py-1 pr-2 text-libelle text-texte-2">
          <Link to="/boards" className="hover:text-texte">
            Boards
          </Link>
          <span aria-hidden>/</span>
          <span className="text-texte">{board.titre}</span>
        </nav>
        <div className="pointer-events-auto relative flex items-center gap-2">
          <ActionsEnTete />
          <BoutonIcone icone="menu" libelle="Options du board" onClick={() => setMenuBoard((m) => !m)} className="bg-fond" />
          {menuBoard && (
            <div role="menu" className="absolute top-14 right-0 z-30 flex w-60 flex-col rounded-18 border border-filet bg-surface p-2">
              <button role="menuitem" type="button" onClick={() => (setRenommer(true), setMenuBoard(false))} className="rounded-12 px-3 py-2 text-left hover:bg-filet">
                Renommer
              </button>
              <button role="menuitem" type="button" disabled className="flex items-center justify-between rounded-12 px-3 py-2 text-left text-texte-2">
                Partager par lien <span className="text-libelle">bientôt</span>
              </button>
              <button role="menuitem" type="button" onClick={() => (setConfirmer(true), setMenuBoard(false))} className="rounded-12 px-3 py-2 text-left text-texte-2 hover:bg-filet hover:text-texte">
                Supprimer le board
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bouton + de création (orange : action de création) */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        {menuCreation && (
          <div role="menu" className="flex gap-1 rounded-full border border-filet bg-surface p-1">
            {typesCreation.map((t) => (
              <button
                key={t.type}
                role="menuitem"
                type="button"
                onClick={() =>
                  t.type === "morceau-choix" ? (setChoix("morceau"), setMenuCreation(false)) : t.type === "contact-choix" ? (setChoix("contact"), setMenuCreation(false)) : void creer(t.type)
                }
                className="h-10 rounded-full px-4 text-[15px] whitespace-nowrap text-texte hover:bg-filet"
              >
                {t.libelle}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-label="Ajouter un bloc"
          aria-expanded={menuCreation}
          onClick={() => setMenuCreation((m) => !m)}
          className="flex size-14 items-center justify-center rounded-full bg-accent text-sur-accent transition-transform duration-150"
        >
          <Icone nom={menuCreation ? "fermer" : "plus"} taille={24} />
        </button>
      </div>

      {/* Zoom */}
      <div className="absolute right-8 bottom-8 flex items-center gap-1 rounded-full border border-filet bg-fond px-2 py-1 lg:right-[72px]">
        <BoutonIcone icone="moins" libelle="Dézoomer" onClick={() => zoomer(1 / 1.2)} className="size-9 border-transparent" />
        <button type="button" onClick={() => setVue((v) => ({ ...v, zoom: 1 }))} className="w-14 text-center text-[15px] tabular-nums" title="Revenir à 100 %">
          {Math.round(vue.zoom * 100)} %
        </button>
        <BoutonIcone icone="plus" libelle="Zoomer" onClick={() => zoomer(1.2)} className="size-9 border-transparent" />
        <BoutonIcone icone="toutVoir" libelle="Tout voir" onClick={cadrer} className="size-9 border-transparent" />
      </div>

      <ChoixObjet
        choix={choix}
        contexte={contexte}
        tracklist={blocs.find((b) => b.id === tracklistCible)}
        onFermer={() => setChoix(null)}
        onChoisir={(type, refId) => {
          setChoix(null);
          void creer(type, { refId });
        }}
      />

      <Renommer ouverte={renommer} titre={board.titre} id={board.id} onFermer={() => setRenommer(false)} />
      <Modale
        ouverte={confirmer}
        titre={`Supprimer « ${board.titre} » ?`}
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void supprimerBoard(board.id).then(onSupprime)}>Supprimer</Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr("Ses blocs et ses liens seront effacés. Les morceaux, contacts et tâches posés dessus restent dans l’app.")}</p>
      </Modale>
    </div>
  );
}

function ChoixObjet({
  choix,
  contexte,
  tracklist,
  onFermer,
  onChoisir,
}: {
  choix: "morceau" | "contact" | "tracklist" | null;
  contexte: Contexte;
  tracklist?: Bloc;
  onFermer(): void;
  onChoisir(type: "morceau" | "contact", refId: Id): void;
}) {
  const titre = choix === "contact" ? "Poser un contact" : choix === "tracklist" ? "Morceaux de la tracklist" : "Poser un morceau";
  const liste =
    choix === "contact"
      ? contexte.contacts.map((c) => ({ id: c.id, titre: c.nom }))
      : contexte.morceaux.map((m) => ({ id: m.id, titre: m.titre }));
  return (
    <Modale ouverte={choix !== null} titre={titre} onFermer={onFermer} actions={choix === "tracklist" && <Bouton onClick={onFermer}>Terminé</Bouton>}>
      {liste.length === 0 ? (
        <p className="text-texte-2">{choix === "contact" ? "Aucun contact. Ajoute-en dans Réseau." : "Aucun morceau. Ajoute-en dans Musique."}</p>
      ) : (
        <div data-defile className="-mx-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-2">
          {liste
            .sort((a, b) => a.titre.localeCompare(b.titre, "fr"))
            .map((o) =>
              choix === "tracklist" && tracklist ? (
                <Option key={o.id} forme="case" choisi={tracklist.morceauIds.includes(o.id)} onClick={() => void basculerMorceauTracklist(tracklist.id, o.id)} titre={o.titre} />
              ) : (
                <Option key={o.id} forme="radio" choisi={false} onClick={() => onChoisir(choix === "contact" ? "contact" : "morceau", o.id)} titre={o.titre} />
              ),
            )}
        </div>
      )}
    </Modale>
  );
}

function Renommer({ ouverte, titre, id, onFermer }: { ouverte: boolean; titre: string; id: Id; onFermer(): void }) {
  const [valeur, setValeur] = useState(titre);
  useEffect(() => setValeur(titre), [titre, ouverte]);
  const valider = () => valeur.trim() && void depots.boards.modifier(id, { titre: valeur.trim() }).then(onFermer);
  return (
    <Modale
      ouverte={ouverte}
      titre="Renommer le board"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="lien" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={valider} disabled={!valeur.trim()}>
            Renommer
          </Bouton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          valider();
        }}
      >
        <ChampTexte libelle="Titre" valeur={valeur} onChange={setValeur} autoFocus maxLength={80} />
      </form>
    </Modale>
  );
}
