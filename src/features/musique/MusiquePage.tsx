import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";

export function MusiquePage() {
  return (
    <div className="flex flex-col gap-12">
      <EnTete titre="Musique" />
      <EtatVide titre="Ton catalogue de prods et de morceaux s’affichera ici." />
    </div>
  );
}
