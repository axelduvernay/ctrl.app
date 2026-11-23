import { Link } from "react-router";
import { EnTete } from "@/components/EnTete";
import { fr } from "@/content/typo";

/** Distribution depuis l’app : prévue, pas encore là. Aucune fausse
    fonctionnalité : on explique et on renvoie vers la checklist. */
export function DistributionPage() {
  return (
    <div className="flex flex-col gap-12">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-libelle text-texte-2">
        <Link to="/sorties" className="hover:text-texte">
          Sorties
        </Link>
        <span aria-hidden>/</span>
        <span className="text-texte">Distribution</span>
      </nav>
      <EnTete surtitre="Bientôt" titre="Distribution" />
      <div className="flex max-w-[640px] flex-col gap-6 text-texte-2">
        <p className="text-[22px] leading-snug text-texte">
          {fr("À terme, tu pourras envoyer ton morceau sur les plateformes sans quitter ctrl.app.")}
        </p>
        <p>
          {fr(
            "Pour l’instant, la sortie passe par un distributeur : un service qui envoie ton morceau sur Spotify, Deezer, Apple Music et les autres, puis te reverse tes revenus. Les plus utilisés par les indépendants : DistroKid, TuneCore, Amuse ou LANDR. Compare le prix (à l’année ou par sortie) et la part qu’ils gardent.",
          )}
        </p>
        <p>{fr("La checklist de chaque sortie t’aide à tout préparer avant l’envoi : version finale, cover, métadonnées, date.")}</p>
        <Link to="/sorties" className="self-start text-texte underline-offset-4 hover:underline">
          Voir mes sorties
        </Link>
      </div>
    </div>
  );
}
