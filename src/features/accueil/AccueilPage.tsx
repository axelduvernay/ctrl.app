import { useNavigate } from "react-router";
import { EnTete } from "@/components/EnTete";
import { EtatVide } from "@/components/EtatVide";
import { Bouton } from "@/components/Bouton";
import { depots, useRequete } from "@/data";

/* Accueil complet au lot 3. Pour l’instant : salutation et accès au parcours. */
export function AccueilPage() {
  const naviguer = useNavigate();
  const { donnees: profils } = useRequete(() => depots.profils.lister());
  const nom = profils?.[0]?.nomArtiste;
  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="flex flex-col gap-12">
      <EnTete surtitre={date.charAt(0).toUpperCase() + date.slice(1)} titre={nom ? `Bonjour ${nom}` : "Bonjour"} />
      <EtatVide
        titre="Ta semaine et tes morceaux en cours s’afficheront ici."
        action={
          <Bouton variante="lien" iconeApres="fleche" onClick={() => naviguer("/parcours")}>
            Voir le parcours
          </Bouton>
        }
      />
    </div>
  );
}
