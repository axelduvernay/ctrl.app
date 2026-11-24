/* Bloc tableau, repris du prototype : la première ligne sert d’en-tête.
   En édition : Tab / ⇧Tab cellule suivante ou précédente, Entrée cellule du
   dessous (une ligne s’ajoute à la fin), ⇧Entrée retour à la ligne, coller
   depuis un tableur remplit plusieurs cellules. Clic droit : lignes et colonnes. */

import { useEffect, useRef, useState } from "react";

interface Props {
  cellules: string[][];
  largeur: number;
  edition: boolean;
  /** Cellule où commencer l’édition. */
  depart?: { l: number; c: number } | null;
  onEnregistrer(cellules: string[][]): void;
  onQuitter(): void;
}

const normaliser = (t: string[][]) => {
  const n = Math.max(1, ...t.map((l) => l.length));
  return t.map((l) => [...l, ...Array(n - l.length).fill("")]);
};

export function Tableau({ cellules, largeur, edition, depart, onEnregistrer, onQuitter }: Props) {
  const [grille, setGrille] = useState(() => normaliser(cellules));
  const [focus, setFocus] = useState<{ l: number; c: number } | null>(null);
  const racine = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!edition) setGrille(normaliser(cellules));
  }, [cellules, edition]);

  // Entrée en édition : focus sur la cellule cliquée (ou la première).
  useEffect(() => {
    if (!edition) return;
    const cible = depart ?? { l: 0, c: 0 };
    requestAnimationFrame(() => racine.current?.querySelector<HTMLElement>(`[data-cellule="${cible.l}-${cible.c}"]`)?.focus({ preventScroll: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition]);

  useEffect(() => {
    if (!focus) return;
    const el = racine.current?.querySelector<HTMLElement>(`[data-cellule="${focus.l}-${focus.c}"]`);
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(r);
    }
  }, [focus, grille.length]);

  const colonnes = grille[0]?.length ?? 1;
  const ecrire = (l: number, c: number, v: string) => setGrille((g) => g.map((ligne, i) => (i === l ? ligne.map((x, j) => (j === c ? v : x)) : ligne)));

  function aller(l: number, c: number) {
    if (l >= grille.length) {
      setGrille((g) => [...g, Array(colonnes).fill("")]);
    }
    setFocus({ l, c });
  }

  return (
    <div
      ref={racine}
      onBlur={(e) => {
        if (!edition || racine.current?.contains(e.relatedTarget as Node)) return;
        onEnregistrer(grille);
        onQuitter();
      }}
      className="overflow-hidden rounded-18 border border-filet bg-surface"
      style={{ width: largeur }}
    >
      <table className="w-full table-fixed border-collapse text-[14px]">
        <tbody>
          {grille.map((ligne, l) => (
            <tr key={l} className={l === 0 ? "text-libelle text-texte-2" : ""}>
              {ligne.map((v, c) => (
                <td key={c} className="border-filet align-top [&:not(:first-child)]:border-l [tr:not(:first-child)>&]:border-t">
                  <div
                    data-cellule={`${l}-${c}`}
                    contentEditable={edition}
                    suppressContentEditableWarning
                    tabIndex={edition ? 0 : -1}
                    onPointerDown={(e) => edition && e.stopPropagation()}
                    onFocus={() => setFocus({ l, c })}
                    onInput={(e) => ecrire(l, c, (e.target as HTMLElement).innerText)}
                    onKeyDown={(e) => {
                      if (!edition) return;
                      e.stopPropagation();
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const i = l * colonnes + c + (e.shiftKey ? -1 : 1);
                        if (i < 0) return;
                        aller(Math.floor(i / colonnes), i % colonnes);
                      } else if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        aller(l + 1, c);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        (e.target as HTMLElement).blur();
                      }
                    }}
                    onPaste={(e) => {
                      const texte = e.clipboardData.getData("text/plain");
                      if (!texte.includes("\t") && !texte.includes("\n")) return;
                      e.preventDefault();
                      const lignes = texte.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((x) => x.split("\t"));
                      setGrille((g) => {
                        const n = normaliser(g.map((x) => [...x]));
                        lignes.forEach((ln, i) =>
                          ln.forEach((val, j) => {
                            while (n.length <= l + i) n.push(Array(n[0]!.length).fill(""));
                            if (c + j >= n[0]!.length) n.forEach((row) => row.push(""));
                            n[l + i]![c + j] = val;
                          }),
                        );
                        return n;
                      });
                    }}
                    ref={(el) => {
                      // Texte posé à la main (pas par React) : le curseur ne saute pas pendant la frappe.
                      if (el && document.activeElement !== el && el.innerText !== v) el.innerText = v;
                    }}
                    className="min-h-9 px-3 py-2 break-words whitespace-pre-wrap outline-none focus:bg-filet/50"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Opérations du clic droit sur une cellule. */
export function ajouterLigne(c: string[][], apres: number) {
  const n = normaliser(c);
  n.splice(apres + 1, 0, Array(n[0]!.length).fill(""));
  return n;
}
export function ajouterColonne(c: string[][], apres: number) {
  return normaliser(c).map((l) => [...l.slice(0, apres + 1), "", ...l.slice(apres + 1)]);
}
export function supprimerLigne(c: string[][], i: number) {
  const n = normaliser(c);
  return n.length > 1 ? n.filter((_, j) => j !== i) : n;
}
export function supprimerColonne(c: string[][], i: number) {
  const n = normaliser(c);
  return n[0]!.length > 1 ? n.map((l) => l.filter((_, j) => j !== i)) : n;
}
