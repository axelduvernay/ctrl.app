import { useEffect, useState } from "react";
import { depots } from "./depots";

/** Adresse temporaire (blob:) d’un fichier stocké, libérée au démontage. */
export function useUrlFichier(fichierId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fichierId) return setUrl(null);
    let actif = true;
    let adresse: string | null = null;
    void depots.fichiers.obtenir(fichierId).then((f) => {
      if (!actif || !f) return;
      adresse = URL.createObjectURL(f.blob);
      setUrl(adresse);
    });
    return () => {
      actif = false;
      if (adresse) URL.revokeObjectURL(adresse);
      setUrl(null);
    };
  }, [fichierId]);
  return url;
}
