import { useEffect } from "react";
import { useNavigate } from "react-router";
import type { Board } from "@/types";
import { boardParDefaut } from "./actions";

// Une seule recherche à la fois (React lance l’effet deux fois en développement).
let enCours: Promise<Board> | null = null;

/** L’onglet Boards ouvre directement un board : le dernier ouvert, sinon
    « Mon board », créé au premier passage. Les autres boards se choisissent
    dans le menu du titre. */
export function BoardsPage() {
  const naviguer = useNavigate();
  useEffect(() => {
    enCours ??= boardParDefaut().finally(() => setTimeout(() => (enCours = null), 0));
    void enCours.then((b) => naviguer(`/boards/${b.id}`, { replace: true }));
  }, [naviguer]);
  return null;
}
