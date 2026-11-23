import { useEffect, useState, type DependencyList } from "react";
import { depots } from "./depots";

/** Lance une lecture via les repositories et la relance à chaque écriture. */
export function useRequete<R>(lecture: () => Promise<R>, deps: DependencyList = []) {
  const [donnees, setDonnees] = useState<R | undefined>(undefined);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    const lancer = () =>
      lecture().then((r) => {
        if (!actif) return;
        setDonnees(r);
        setChargement(false);
      });
    void lancer();
    const desabonner = depots.abonner(() => void lancer());
    return () => {
      actif = false;
      desabonner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { donnees, chargement };
}
