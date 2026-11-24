/* Édition du texte riche d’une note, comme dans le prototype ctrl.mind :
   - barre de mise en forme quand on sélectionne du texte ;
   - « # » ou « ## » puis espace en début de ligne : titre ou sous-titre ;
   - ⌘B ⌘I ⌘U, ⇧⌘T ⇧⌘H ⇧⌘B (titre, sous-titre, texte) ;
   - « / » en début de ligne : menu des commandes. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icone, type NomIcone } from "@/components/Icone";
import { nettoyer, versHtml } from "./texte";

export interface Commande {
  cle: string;
  libelle: string;
  section: string;
  couleur?: string;
  alias?: string[];
}

interface Props {
  html: string;
  /** Point où placer le curseur (clic sur le bloc). */
  point?: { x: number; y: number } | null;
  commandes: Commande[];
  onEnregistrer(html: string): void;
  onQuitter(): void;
  /** La commande reçoit aussi le texte à jour (sans la commande tapée). */
  onCommande(cle: string, html: string): void;
}

const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function blocCourant(racine: HTMLElement): HTMLElement | null {
  const sel = getSelection();
  let n: Node | null = sel?.anchorNode ?? null;
  while (n && n !== racine) {
    if (n instanceof HTMLElement && /^(P|DIV|H1|H2|LI)$/.test(n.tagName)) return n;
    n = n.parentNode;
  }
  return null;
}

/** Texte de la ligne courante, avant le curseur. */
function avantCurseur(racine: HTMLElement): string {
  const sel = getSelection();
  if (!sel?.rangeCount) return "";
  const bloc = blocCourant(racine) ?? racine;
  const r = document.createRange();
  r.selectNodeContents(bloc);
  r.setEnd(sel.anchorNode!, sel.anchorOffset);
  return r.toString();
}

export function EditeurTexte({ html, point, commandes, onEnregistrer, onQuitter, onCommande }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [barre, setBarre] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ filtre: string; actif: number } | null>(null);
  const quitte = useRef(false);
  const derniereSelection = useRef<Range | null>(null);

  // Contenu initial et position du curseur (au point cliqué, sinon à la fin).
  useLayoutEffect(() => {
    const el = ref.current!;
    el.innerHTML = versHtml(html) || "<p><br></p>";
    el.focus({ preventScroll: true });
    const sel = getSelection()!;
    const r =
      point && "caretRangeFromPoint" in document
        ? (document as Document & { caretRangeFromPoint(x: number, y: number): Range | null }).caretRangeFromPoint(point.x, point.y)
        : null;
    if (r && el.contains(r.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      const fin = document.createRange();
      fin.selectNodeContents(el);
      fin.collapse(false);
      sel.removeAllRanges();
      sel.addRange(fin);
    }
    if (html === "/") setMenu({ filtre: "", actif: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Barre de mise en forme au-dessus de la sélection.
  useEffect(() => {
    const suivre = () => {
      const sel = getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !ref.current?.contains(sel.anchorNode)) return setBarre(null);
      derniereSelection.current = sel.getRangeAt(0).cloneRange();
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setBarre({ x: r.left + r.width / 2, y: r.top });
    };
    document.addEventListener("selectionchange", suivre);
    return () => document.removeEventListener("selectionchange", suivre);
  }, []);

  const filtres = menu
    ? commandes.filter((c) => {
        const f = normaliser(menu.filtre);
        return !f || [c.cle, c.libelle, ...(c.alias ?? [])].some((x) => normaliser(x).startsWith(f));
      })
    : [];

  function quitter() {
    if (quitte.current) return;
    quitte.current = true;
    onEnregistrer(nettoyer(ref.current!.innerHTML));
    onQuitter();
  }

  function executer(c: Commande) {
    // Retire « /commande » du texte, puis applique.
    const bloc = blocCourant(ref.current!);
    if (bloc) bloc.textContent = (bloc.textContent ?? "").replace(/\/[^\s/]*$/, "");
    setMenu(null);
    const html = nettoyer(ref.current!.innerHTML);
    onEnregistrer(html);
    onCommande(c.cle, html);
  }

  function formater(type: "h1" | "h2" | "p" | "b" | "i" | "u" | "s" | "mark" | "liste") {
    ref.current?.focus({ preventScroll: true });
    // Le clic dans la barre peut avoir déplacé la sélection : on la remet.
    const sel = getSelection();
    if (derniereSelection.current && sel && (sel.isCollapsed || !ref.current?.contains(sel.anchorNode))) {
      sel.removeAllRanges();
      sel.addRange(derniereSelection.current);
    }
    document.execCommand("styleWithCSS", false, "false");
    if (type === "h1" || type === "h2" || type === "p") document.execCommand("formatBlock", false, type);
    else if (type === "b") document.execCommand("bold");
    else if (type === "i") document.execCommand("italic");
    else if (type === "u") document.execCommand("underline");
    else if (type === "s") document.execCommand("strikeThrough");
    else if (type === "liste") document.execCommand("insertUnorderedList");
    else if (type === "mark") {
      const sel = getSelection();
      if (!sel?.rangeCount) return;
      const r = sel.getRangeAt(0);
      const dejaMarque = (r.commonAncestorContainer.parentElement ?? null)?.closest("mark");
      if (dejaMarque) dejaMarque.replaceWith(...dejaMarque.childNodes);
      else {
        const m = document.createElement("mark");
        m.append(r.extractContents());
        r.insertNode(m);
      }
    }
  }

  const boutons: { type: Parameters<typeof formater>[0]; libelle: string; icone?: NomIcone; texte?: string }[] = [
    { type: "h1", libelle: "Titre", texte: "Titre" },
    { type: "h2", libelle: "Sous-titre", texte: "Sous-titre" },
    { type: "p", libelle: "Texte", texte: "Texte" },
    { type: "b", libelle: "Gras", icone: "gras" },
    { type: "i", libelle: "Italique", icone: "italique" },
    { type: "u", libelle: "Souligné", icone: "souligne" },
    { type: "s", libelle: "Barré", icone: "barre" },
    { type: "mark", libelle: "Surligné", icone: "surligne" },
    { type: "liste", libelle: "Liste", icone: "liste" },
  ];

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Texte du bloc"
        className="texte-riche min-h-6 w-full cursor-text outline-none"
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={(e) => {
          // Un clic dans la barre ou le menu ne fait pas quitter l’édition.
          if ((e.relatedTarget as HTMLElement | null)?.closest("[data-barre-texte]")) return;
          quitter();
        }}
        onInput={() => {
          const ligne = avantCurseur(ref.current!);
          const m = /(?:^|\s)\/([^\s/]*)$/.exec(ligne);
          setMenu(m && ligne.trim().startsWith("/") ? { filtre: m[1] ?? "", actif: 0 } : null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          const cmd = e.metaKey || e.ctrlKey;
          if (menu && filtres.length) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              return setMenu({ ...menu, actif: (menu.actif + 1) % filtres.length });
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              return setMenu({ ...menu, actif: (menu.actif - 1 + filtres.length) % filtres.length });
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              return executer(filtres[menu.actif]!);
            }
          }
          if (e.key === "Escape") {
            e.preventDefault();
            if (menu) return setMenu(null);
            return ref.current?.blur();
          }
          if (cmd && e.shiftKey && ["t", "h", "b"].includes(e.key.toLowerCase())) {
            e.preventDefault();
            return formater(e.key.toLowerCase() === "t" ? "h1" : e.key.toLowerCase() === "h" ? "h2" : "p");
          }
          if (e.key === " " && !cmd) {
            const ligne = avantCurseur(ref.current!);
            if (ligne === "#" || ligne === "##") {
              e.preventDefault();
              const bloc = blocCourant(ref.current!);
              if (bloc) bloc.textContent = (bloc.textContent ?? "").replace(/^#{1,2}/, "");
              formater(ligne === "#" ? "h1" : "h2");
            }
          }
        }}
      />

      {menu &&
        filtres.length > 0 &&
        createPortal(
          <div
            data-barre-texte
            onPointerDown={(e) => e.stopPropagation()}
            role="listbox"
            aria-label="Commandes"
            className="fixed z-50 flex max-h-80 w-64 flex-col overflow-y-auto rounded-18 border border-filet bg-surface p-1.5"
            style={(() => {
              const r = ref.current?.getBoundingClientRect();
              return r ? { left: r.left, top: Math.min(r.bottom + 8, innerHeight - 330) } : {};
            })()}
          >
            {filtres.map((c, i) => (
              <div key={c.cle}>
                {(i === 0 || filtres[i - 1]!.section !== c.section) && <p className="px-3 pt-2 pb-1 text-[12px] text-texte-2">{c.section}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === menu.actif}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executer(c)}
                  className={`flex w-full items-center gap-2 rounded-12 px-3 py-2 text-left text-[15px] ${i === menu.actif ? "bg-filet" : ""}`}
                >
                  {c.couleur && <span className="size-2 rounded-full" style={{ background: c.couleur }} />}
                  {c.libelle}
                  <span className="ml-auto text-libelle text-texte-2">/{c.cle}</span>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}

      {barre &&
        createPortal(
          <div
            data-barre-texte
            onPointerDown={(e) => e.stopPropagation()}
            role="toolbar"
            aria-label="Mise en forme"
            className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full border border-filet bg-surface p-1"
            style={{ left: barre.x, top: barre.y - 8 }}
          >
            {boutons.map((b) => (
              <button
                key={b.type}
                type="button"
                title={b.libelle}
                aria-label={b.libelle}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => formater(b.type)}
                className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[13px] text-texte hover:bg-filet"
              >
                {b.icone ? <Icone nom={b.icone} taille={15} /> : b.texte}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
