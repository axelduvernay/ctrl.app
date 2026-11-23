import { Outlet } from "react-router";
import { BarreLaterale } from "./BarreLaterale";

/** Coquille de l’app : barre latérale à gauche, écran courant à droite. */
export function Coquille() {
  return (
    <div className="flex min-h-dvh bg-fond">
      <BarreLaterale />
      <main className="min-w-0 flex-1 px-8 py-16 lg:px-[72px]">
        <div className="mx-auto max-w-[1200px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
