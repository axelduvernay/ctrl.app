import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";

export function ReseauPage() {
  return (
    <div className="flex flex-col gap-12">
      <EnTete titre="Réseau" />
      <EtatVide titre="Tes contacts et tes envois s’afficheront ici." />
    </div>
  );
}
