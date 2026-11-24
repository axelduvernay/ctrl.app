/* Menus du board : clic droit, échéance et rappel, catégories, choix d’un
   objet lié, barre de création du bas, sélecteur de boards. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Bouton, BoutonIcone } from "@/components/Bouton";
import { ChampTexte, Option } from "@/components/Champs";
import { Icone, type NomIcone } from "@/components/Icone";
import { Modale } from "@/components/Modale";
import { fr } from "@/content/typo";
import type { Board, Bloc, Categorie, Contact, Id, Morceau, Tache, TypeBloc } from "@/types";
import { basculerMorceauTracklist, creerBoard, majCategories, renommerBoard, supprimerBoard } from "./actions";
import { categoriesDe, enCommande, PALETTE } from "./categories";
import { ajouterColonne, ajouterLigne, supprimerColonne, supprimerLigne } from "./Tableau";

export interface Menu {
  x: number;
  y: number;
  monde: { x: number; y: number };
  blocId: Id | null;
  lienId: Id | null;
  cellule: { l: number; c: number } | null;
}

/* ---------- Clic droit ---------- */

interface ActionsMenu {
  memoriser(): void;
  creerIci(type: TypeBloc): void;
  categorie(id: Id | null): void;
  gererCategories(): void;
  proprietes(): void;
  variante(): void;
  dupliquer(): void;
  supprimer(): void;
  convertir(cle: string): void;
  sortirDeZone(): void;
  retirerLiens(): void;
  couleurZone(c: string | null): void;
  alignerZone(): void;
  renommer(): void;
  alignerTout(): void;
  toutVoir(): void;
  supprimerLien(): void;
  tableau(cellules: string[][]): void;
}

function Item({ children, onClick, icone, danger = false }: { children: ReactNode; onClick(): void; icone?: NomIcone; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-12 px-3 py-2 text-left text-[15px] hover:bg-filet ${danger ? "text-texte-2 hover:text-texte" : ""}`}
    >
      {icone && <Icone nom={icone} taille={16} className="text-texte-2" />}
      {children}
    </button>
  );
}

const Separateur = () => <div className="my-1 h-px bg-filet" />;

export function MenuContextuel({
  menu,
  bloc,
  nbChoisis,
  categories,
  aDesLiens,
  onFermer,
  actions,
}: {
  menu: Menu;
  bloc?: Bloc;
  nbChoisis: number;
  categories: Categorie[];
  aDesLiens: boolean;
  onFermer(): void;
  actions: ActionsMenu;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sousMenu, setSousMenu] = useState<"categorie" | "couleur" | "convertir" | null>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });

  useEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(menu.x, innerWidth - r.width - 12), y: Math.min(menu.y, innerHeight - r.height - 12) });
    const fermer = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && onFermer();
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    // Ajouté au tour suivant (sinon le clic droit qui ouvre le menu le fermerait),
    // et annulé proprement si le menu disparaît avant.
    const t = setTimeout(() => window.addEventListener("pointerdown", fermer), 0);
    window.addEventListener("keydown", echap);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", fermer);
      window.removeEventListener("keydown", echap);
    };
  }, [menu, onFermer, sousMenu]);

  const agir = (f: () => void) => () => {
    f();
    onFermer();
  };

  let contenu: ReactNode;
  if (menu.lienId && !bloc) {
    contenu = (
      <Item icone="supprimer" danger onClick={agir(actions.supprimerLien)}>
        Supprimer le lien
      </Item>
    );
  } else if (!bloc) {
    contenu = (
      <>
        <Item icone="texte" onClick={agir(() => actions.creerIci("note"))}>
          Nouveau texte ici
        </Item>
        <Item icone="tacheBloc" onClick={agir(() => actions.creerIci("tache"))}>
          Nouvelle tâche ici
        </Item>
        <Item icone="zone" onClick={agir(() => actions.creerIci("zone"))}>
          Nouvelle zone ici
        </Item>
        <Separateur />
        <Item icone="aligner" onClick={agir(actions.alignerTout)}>
          Aligner le board
        </Item>
        <Item icone="toutVoir" onClick={agir(actions.toutVoir)}>
          Tout voir
        </Item>
        <Item onClick={agir(actions.gererCategories)}>Catégories…</Item>
      </>
    );
  } else if (sousMenu === "categorie") {
    contenu = (
      <>
        {categories.map((c) => (
          <Item key={c.id} onClick={agir(() => actions.categorie(bloc.categorieId === c.id ? null : c.id))}>
            <span className="size-2.5 rounded-full" style={{ background: c.couleur }} />
            {c.nom}
            {bloc.categorieId === c.id && <Icone nom="valide" taille={14} className="ml-auto" />}
          </Item>
        ))}
        <Item onClick={agir(() => actions.categorie(null))}>Aucune</Item>
        <Separateur />
        <Item onClick={agir(actions.gererCategories)}>Gérer les catégories…</Item>
      </>
    );
  } else if (sousMenu === "couleur") {
    contenu = (
      <div className="flex flex-col gap-2 p-2">
        <div className="grid grid-cols-4 gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Teinte ${c}`}
              onClick={agir(() => actions.couleurZone(c))}
              className={`size-8 rounded-full border ${bloc.couleur === c ? "border-texte" : "border-filet"}`}
              style={{ background: `color-mix(in srgb, ${c} 45%, var(--surface))` }}
            />
          ))}
        </div>
        <Item onClick={agir(() => actions.couleurZone(null))}>Sans couleur</Item>
      </div>
    );
  } else if (sousMenu === "convertir") {
    contenu = (
      <>
        <Item icone="tacheBloc" onClick={agir(() => actions.convertir("tache"))}>
          Tâche de l’app
        </Item>
        <Item icone="tracklist" onClick={agir(() => actions.convertir("tracklist"))}>
          Tracklist
        </Item>
        <Item icone="dossier" onClick={agir(() => actions.convertir("dossier"))}>
          Dossier
        </Item>
        <Item icone="tableau" onClick={agir(() => actions.convertir("tableau"))}>
          Tableau
        </Item>
        <Item icone="tableau" onClick={agir(() => actions.convertir("decoupage"))}>
          Découpage technique
        </Item>
      </>
    );
  } else {
    const cellules = bloc.cellules ?? [[""]];
    contenu = (
      <>
        {bloc.type === "tableau" && menu.cellule && (
          <>
            <Item onClick={agir(() => actions.tableau(ajouterLigne(cellules, menu.cellule!.l)))}>Ajouter une ligne dessous</Item>
            <Item onClick={agir(() => actions.tableau(ajouterColonne(cellules, menu.cellule!.c)))}>Ajouter une colonne à droite</Item>
            <Item onClick={agir(() => actions.tableau(supprimerLigne(cellules, menu.cellule!.l)))}>Supprimer la ligne</Item>
            <Item onClick={agir(() => actions.tableau(supprimerColonne(cellules, menu.cellule!.c)))}>Supprimer la colonne</Item>
            <Separateur />
          </>
        )}
        {bloc.type === "zone" ? (
          <>
            <Item icone="texte" onClick={agir(actions.renommer)}>
              Renommer
            </Item>
            <Item icone="aligner" onClick={agir(actions.alignerZone)}>
              Aligner la zone
            </Item>
            <Item onClick={() => setSousMenu("couleur")}>Couleur du fond…</Item>
          </>
        ) : (
          <>
            <Item onClick={() => setSousMenu("categorie")}>
              Catégorie…
            </Item>
            {nbChoisis <= 1 && (
              <Item icone="echeance" onClick={agir(actions.proprietes)}>
                Échéance et rappel…
              </Item>
            )}
            {bloc.type === "note" && <Item onClick={() => setSousMenu("convertir")}>Transformer en…</Item>}
          </>
        )}
        <Separateur />
        <Item onClick={agir(actions.variante)}>Créer une variante</Item>
        <Item onClick={agir(actions.dupliquer)}>Dupliquer</Item>
        {bloc.zoneId && <Item onClick={agir(actions.sortirDeZone)}>Sortir de la zone</Item>}
        {aDesLiens && <Item onClick={agir(actions.retirerLiens)}>Retirer ses liens</Item>}
        <Separateur />
        <Item icone="supprimer" danger onClick={agir(actions.supprimer)}>
          {nbChoisis > 1 ? `Supprimer les ${nbChoisis} blocs` : "Supprimer"}
        </Item>
      </>
    );
  }

  return createPortal(
    <div ref={ref} role="menu" className="fixed z-50 flex w-64 flex-col rounded-18 border border-filet bg-surface p-1.5" style={{ left: pos.x, top: pos.y }}>
      {sousMenu && (
        <button type="button" onClick={() => setSousMenu(null)} className="flex items-center gap-2 px-3 py-1.5 text-libelle text-texte-2 hover:text-texte">
          <Icone nom="precedent" taille={14} />
          Retour
        </button>
      )}
      {contenu}
    </div>,
    document.body,
  );
}

/* ---------- Échéance et rappel ---------- */

function enLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function PanneauProprietes({
  bloc,
  tache,
  ecran,
  onFermer,
  onEnregistrer,
}: {
  bloc: Bloc;
  tache?: Tache;
  ecran: { x: number; y: number };
  onFermer(): void;
  onEnregistrer(echeance: string | null, rappel: string | null): void;
}) {
  const [echeance, setEcheance] = useState((bloc.type === "tache" ? tache?.echeance : bloc.echeance) ?? "");
  const [rappel, setRappel] = useState(enLocal(bloc.rappel));
  const valider = async () => {
    // Le rappel sonne par une notification du système, si elle est autorisée.
    if (rappel && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    onEnregistrer(echeance || null, rappel ? new Date(rappel).toISOString() : null);
  };
  return createPortal(
    <div
      role="dialog"
      aria-label="Échéance et rappel"
      className="fixed z-50 flex w-72 flex-col gap-4 rounded-18 border border-filet bg-surface p-5"
      style={{ left: Math.min(ecran.x + 88, innerWidth - 300), top: Math.min(ecran.y + 12, innerHeight - 280) }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onFermer();
        if (e.key === "Enter") void valider();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-libelle text-texte-2">
          <Icone nom="echeance" taille={14} />
          Échéance
        </span>
        <input
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.target.value)}
          className="h-11 rounded-12 border border-filet bg-fond px-3 text-texte focus:border-texte-2 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-libelle text-texte-2">
          <Icone nom="rappel" taille={14} />
          Rappel
        </span>
        <input
          type="datetime-local"
          value={rappel}
          onChange={(e) => setRappel(e.target.value)}
          className="h-11 rounded-12 border border-filet bg-fond px-3 text-texte focus:border-texte-2 focus:outline-none"
        />
      </label>
      <p className="text-[12px] text-texte-2">{fr("Le rappel s’affiche dans l’app (et en notification si tu l’autorises) tant que ctrl.app est ouvert.")}</p>
      <div className="flex justify-end gap-2">
        <Bouton variante="lien" onClick={onFermer}>
          Annuler
        </Bouton>
        <Bouton onClick={() => void valider()}>Enregistrer</Bouton>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Catégories du board ---------- */

export function GestionCategories({ ouverte, board, onFermer }: { ouverte: boolean; board: Board; onFermer(): void }) {
  const [liste, setListe] = useState<Categorie[]>(categoriesDe(board));
  useEffect(() => {
    if (ouverte) setListe(categoriesDe(board));
  }, [ouverte, board]);
  const maj = (i: number, modifs: Partial<Categorie>) => setListe((l) => l.map((c, j) => (j === i ? { ...c, ...modifs } : c)));

  return (
    <Modale
      ouverte={ouverte}
      titre="Catégories du board"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="lien" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            onClick={() =>
              void majCategories(
                board.id,
                liste.filter((c) => c.nom.trim()).map((c) => ({ ...c, nom: c.nom.trim(), commande: enCommande(c.nom) || c.commande })),
              ).then(onFermer)
            }
          >
            Enregistrer
          </Bouton>
        </>
      }
    >
      <p className="text-texte-2">{fr("Tape « / » puis le nom d’une catégorie dans un bloc pour la lui donner. Les touches 1 à 9 filtrent le board.")}</p>
      <ul className="flex flex-col gap-3">
        {liste.map((c, i) => (
          <li key={c.id} className="flex flex-col gap-2 rounded-18 border border-filet p-3">
            <div className="flex items-center gap-3">
              <span className="w-5 text-libelle text-texte-2 tabular-nums">{i + 1}</span>
              <input
                value={c.nom}
                onChange={(e) => maj(i, { nom: e.target.value })}
                aria-label="Nom de la catégorie"
                className="h-10 flex-1 rounded-12 border border-filet bg-fond px-3 text-texte focus:border-texte-2 focus:outline-none"
              />
              <BoutonIcone icone="supprimer" libelle={`Supprimer ${c.nom}`} onClick={() => setListe((l) => l.filter((_, j) => j !== i))} className="size-9 border-transparent" />
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-8">
              {PALETTE.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={`Couleur ${p}`}
                  onClick={() => maj(i, { couleur: p })}
                  className={`size-6 rounded-full border-2 ${c.couleur === p ? "border-texte" : "border-transparent"}`}
                  style={{ background: p }}
                />
              ))}
              <label className="ml-auto flex items-center gap-2 text-libelle text-texte-2">
                <input type="checkbox" checked={c.cochable} onChange={(e) => maj(i, { cochable: e.target.checked })} className="accent-[var(--accent)]" />
                Case à cocher
              </label>
            </div>
          </li>
        ))}
      </ul>
      <Bouton
        variante="contour"
        icone="plus"
        className="self-start"
        onClick={() => setListe((l) => [...l, { id: crypto.randomUUID(), nom: "Nouvelle", couleur: PALETTE[l.length % PALETTE.length]!, commande: "nouvelle", cochable: false }])}
      >
        Ajouter une catégorie
      </Bouton>
    </Modale>
  );
}

/* ---------- Choisir un morceau, un contact, ou les morceaux d’une tracklist ---------- */

export function ChoixObjet({
  choix,
  morceaux,
  contacts,
  tracklist,
  onFermer,
  onChoisir,
  memoriser,
}: {
  choix: "morceau" | "contact" | "tracklist" | null;
  morceaux: Morceau[];
  contacts: Contact[];
  tracklist?: Bloc;
  onFermer(): void;
  onChoisir(type: "morceau" | "contact", refId: Id): void;
  memoriser(): void;
}) {
  const titre = choix === "contact" ? "Poser un contact" : choix === "tracklist" ? "Morceaux de la tracklist" : "Poser un morceau";
  const liste = (choix === "contact" ? contacts.map((c) => ({ id: c.id, titre: c.nom })) : morceaux.map((m) => ({ id: m.id, titre: m.titre }))).sort((a, b) =>
    a.titre.localeCompare(b.titre, "fr"),
  );
  return (
    <Modale ouverte={choix !== null} titre={titre} onFermer={onFermer} actions={choix === "tracklist" && <Bouton onClick={onFermer}>Terminé</Bouton>}>
      {liste.length === 0 ? (
        <p className="text-texte-2">{choix === "contact" ? "Aucun contact. Ajoute-en dans Réseau." : "Aucun morceau. Ajoute-en dans Musique, ou glisse des fichiers audio sur le board."}</p>
      ) : (
        <div data-defile className="-mx-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-2">
          {liste.map((o) =>
            choix === "tracklist" && tracklist ? (
              <Option
                key={o.id}
                forme="case"
                choisi={tracklist.morceauIds.includes(o.id)}
                onClick={() => {
                  memoriser();
                  void basculerMorceauTracklist(tracklist.id, o.id);
                }}
                titre={o.titre}
              />
            ) : (
              <Option key={o.id} forme="radio" choisi={false} onClick={() => onChoisir(choix === "contact" ? "contact" : "morceau", o.id)} titre={o.titre} />
            ),
          )}
        </div>
      )}
    </Modale>
  );
}

/* ---------- Barre de création du bas ---------- */

export function BarreBas({
  onCreer,
  onChoisir,
  onImage,
  crayon,
  onCrayon,
  onAligner,
}: {
  onCreer(type: TypeBloc): void;
  onChoisir(type: "morceau" | "contact"): void;
  onImage(f: File[]): void;
  crayon: boolean;
  onCrayon(): void;
  onAligner(): void;
}) {
  const [repliee, setRepliee] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const bouton = (icone: NomIcone, libelle: string, onClick: () => void, actif = false) => (
    <button
      key={libelle}
      type="button"
      title={libelle}
      aria-label={libelle}
      aria-pressed={actif || undefined}
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-full px-3 text-[14px] transition-colors duration-150 ${actif ? "bg-surface text-texte" : "text-texte hover:bg-surface"}`}
    >
      <Icone nom={icone} taille={17} />
      <span className="hidden min-[1680px]:inline">{libelle}</span>
    </button>
  );

  return (
    <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2">
      {!repliee && (
        <div role="toolbar" aria-label="Créer" className="flex items-center gap-0.5 rounded-full border border-filet bg-fond p-1">
          {bouton("texte", "Texte", () => onCreer("note"))}
          {bouton("tacheBloc", "Tâche", () => onCreer("tache"))}
          {bouton("imageBloc", "Image", () => input.current?.click())}
          {bouton("tracklist", "Tracklist", () => onCreer("tracklist"))}
          {bouton("zone", "Zone", () => onCreer("zone"))}
          {bouton("tableau", "Tableau", () => onCreer("tableau"))}
          {bouton("musique", "Morceau", () => onChoisir("morceau"))}
          {bouton("reseau", "Contact", () => onChoisir("contact"))}
          <span className="mx-1 h-6 w-px bg-filet" />
          {bouton("crayon", "Crayon", onCrayon, crayon)}
          {bouton("aligner", "Aligner", onAligner)}
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const f = [...(e.target.files ?? [])];
              if (f.length) onImage(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      <button
        type="button"
        aria-label={repliee ? "Ouvrir la barre de création" : "Replier la barre"}
        onClick={() => setRepliee((r) => !r)}
        className={`flex items-center justify-center rounded-full transition-colors duration-150 ${repliee ? "size-14 bg-accent text-sur-accent" : "size-10 border border-filet bg-fond text-texte-2 hover:text-texte"}`}
      >
        <Icone nom={repliee ? "plus" : "fermer"} taille={repliee ? 24 : 16} />
      </button>
    </div>
  );
}

/* ---------- Sélecteur de boards (clic sur le nom) ---------- */

export function SelecteurBoards({ board, boards, onSupprime, onOuvrir }: { board: Board; boards: Board[]; onSupprime(): void; onOuvrir(id: Id): void }) {
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [renommer, setRenommer] = useState(false);
  const [titre, setTitre] = useState(board.titre);
  const [confirmer, setConfirmer] = useState<Board | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [nom, setNom] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setTitre(board.titre), [board.titre]);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOuvert(false);
    window.addEventListener("pointerdown", fermer);
    return () => window.removeEventListener("pointerdown", fermer);
  }, [ouvert]);

  return (
    <div ref={ref} className="relative">
      {renommer ? (
        <input
          autoFocus
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          onBlur={() => {
            if (titre.trim() && titre !== board.titre) void renommerBoard(board.id, titre);
            setRenommer(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          aria-label="Nom du board"
          className="w-48 bg-transparent text-texte focus:outline-none"
        />
      ) : (
        <button type="button" onClick={() => setOuvert((o) => !o)} className="flex items-center gap-1 text-texte" aria-expanded={ouvert}>
          {board.titre}
          <Icone nom="descendre" taille={14} className="text-texte-2" />
        </button>
      )}
      {ouvert && (
        <div role="menu" className="absolute top-8 left-0 z-40 flex w-64 flex-col rounded-18 border border-filet bg-surface p-1.5">
          {boards
            .sort((a, b) => a.titre.localeCompare(b.titre, "fr"))
            .map((b) => (
              <div key={b.id} className="group flex items-center rounded-12 hover:bg-filet">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOuvert(false);
                    // Re-cliquer le board ouvert : le renommer.
                    if (b.id === board.id) setRenommer(true);
                    else onOuvrir(b.id);
                  }}
                  className="flex-1 px-3 py-2 text-left text-[15px] text-texte"
                >
                  {b.titre}
                  {b.id === board.id && <span className="ml-2 text-libelle text-texte-2">renommer</span>}
                </button>
                <BoutonIcone
                  icone="supprimer"
                  libelle={`Supprimer ${b.titre}`}
                  onClick={() => {
                    setOuvert(false);
                    setConfirmer(b);
                  }}
                  className="size-8 border-transparent opacity-0 group-hover:opacity-100"
                />
              </div>
            ))}
          <div className="my-1 h-px bg-filet" />
          <button type="button" onClick={() => (setOuvert(false), setNouveau(true))} className="flex items-center gap-2 rounded-12 px-3 py-2 text-left text-[15px] hover:bg-filet">
            <Icone nom="plus" taille={14} />
            Nouveau board
          </button>
        </div>
      )}
      <Modale
        ouverte={confirmer !== null}
        titre={`Supprimer « ${confirmer?.titre ?? ""} » ?`}
        onFermer={() => setConfirmer(null)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setConfirmer(null)}>
              Annuler
            </Bouton>
            <Bouton
              onClick={async () => {
                const b = confirmer!;
                setConfirmer(null);
                await supprimerBoard(b.id);
                if (b.id === board.id) onSupprime();
              }}
            >
              Supprimer
            </Bouton>
          </>
        }
      >
        <p className="text-texte-2">{fr("Ses blocs et ses liens seront effacés. Les morceaux, contacts et tâches posés dessus restent dans l’app.")}</p>
      </Modale>
      <Modale
        ouverte={nouveau}
        titre="Nouveau board"
        onFermer={() => setNouveau(false)}
        actions={
          <>
            <Bouton variante="lien" onClick={() => setNouveau(false)}>
              Annuler
            </Bouton>
            <Bouton
              disabled={!nom.trim()}
              onClick={async () => {
                const b = await creerBoard(nom);
                setNom("");
                setNouveau(false);
                naviguer(`/boards/${b.id}`);
              }}
            >
              Créer
            </Bouton>
          </>
        }
      >
        <ChampTexte libelle="Titre" valeur={nom} onChange={setNom} autoFocus maxLength={80} />
      </Modale>
    </div>
  );
}
