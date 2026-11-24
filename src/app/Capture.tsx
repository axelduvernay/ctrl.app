import { useEffect, useRef, useState } from "react";
import { Bouton } from "@/components/Bouton";
import { ChampSelect, ChampTexte, ZoneTexte } from "@/components/Champs";
import { Modale } from "@/components/Modale";
import { LecteurAudio } from "@/components/LecteurAudio";
import { depots, useRequete } from "@/data";
import { fr } from "@/content/typo";
import { duree } from "@/lib/format";
import { creerTache } from "@/features/taches/actions";
import { useUi } from "@/stores/ui";

/* Capturer : noter une idée sans chercher où la ranger.
   Mémo vocal (enregistré dans le navigateur), note ou tâche. */

type Onglet = "memo" | "note" | "tache";

const onglets: { valeur: Onglet; libelle: string }[] = [
  { valeur: "memo", libelle: "Mémo vocal" },
  { valeur: "note", libelle: "Note" },
  { valeur: "tache", libelle: "Tâche" },
];

export function Capture() {
  const { capture, fermer } = useUi();
  const [onglet, setOnglet] = useState<Onglet>("note");
  const [morceauId, setMorceauId] = useState("");
  const [texte, setTexte] = useState("");
  const [echeance, setEcheance] = useState("");
  const [memo, setMemo] = useState<{ blob: Blob; duree: number } | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const { donnees: morceaux } = useRequete(() => depots.morceaux.lister());

  useEffect(() => {
    if (!capture) {
      setTexte("");
      setEcheance("");
      setMemo(null);
      setMorceauId("");
    }
  }, [capture]);

  const pret = onglet === "memo" ? !!memo : texte.trim() !== "";

  async function enregistrer() {
    if (!pret) return;
    const m = morceauId || null;
    if (onglet === "note") {
      await depots.notes.creer({ morceauId: m, type: "idee", contenu: texte.trim(), fichierId: null });
      setConfirmation("Note enregistrée.");
    } else if (onglet === "tache") {
      await creerTache(texte, { echeance: echeance || null, morceauId: m });
      setConfirmation("Tâche ajoutée.");
    } else if (memo) {
      const f = await depots.fichiers.creer({
        nom: `Mémo ${new Date().toLocaleString("fr-FR")}.webm`,
        type: memo.blob.type,
        taille: memo.blob.size,
        blob: memo.blob,
        duree: memo.duree,
      });
      await depots.notes.creer({ morceauId: m, type: "idee", contenu: "", fichierId: f.id });
      setConfirmation("Mémo enregistré.");
    }
    fermer();
    setTimeout(() => setConfirmation(null), 2500);
  }

  const optionsMorceaux = [
    { valeur: "", libelle: onglet === "tache" ? "Aucun morceau" : "Sans morceau (dans Musique → Captures)" },
    ...(morceaux ?? []).sort((a, b) => a.titre.localeCompare(b.titre, "fr")).map((x) => ({ valeur: x.id, libelle: x.titre })),
  ];

  return (
    <>
      <Modale
        ouverte={capture}
        titre="Capturer"
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="lien" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void enregistrer()} disabled={!pret}>
              Enregistrer
            </Bouton>
          </>
        }
      >
        <div role="tablist" aria-label="Type de capture" className="flex gap-2">
          {onglets.map((o) => (
            <button
              key={o.valeur}
              role="tab"
              aria-selected={onglet === o.valeur}
              onClick={() => setOnglet(o.valeur)}
              className={`h-10 rounded-full border px-4 text-[15px] transition-colors duration-150 ${
                onglet === o.valeur ? "border-texte-2 bg-fond text-texte" : "border-filet text-texte-2 hover:text-texte"
              }`}
            >
              {o.libelle}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void enregistrer();
          }}
        >
          {onglet === "note" && <ZoneTexte libelle="Note" valeur={texte} onChange={setTexte} placeholder="Une idée, une phrase, une référence…" autoFocus />}
          {onglet === "tache" && (
            <>
              <ChampTexte libelle="Tâche" valeur={texte} onChange={setTexte} placeholder="Ex. Relancer l’ingé son" autoFocus maxLength={140} />
              <label className="flex flex-col gap-2">
                <span className="text-libelle text-texte-2">Échéance (facultatif)</span>
                <input
                  type="date"
                  value={echeance}
                  onChange={(e) => setEcheance(e.target.value)}
                  className="h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
                />
              </label>
            </>
          )}
          {onglet === "memo" && <Enregistreur memo={memo} onMemo={setMemo} />}
          <ChampSelect libelle="Morceau" valeur={morceauId} options={optionsMorceaux} onChange={setMorceauId} />
        </form>
      </Modale>

      {confirmation && (
        <div role="status" className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-filet bg-surface px-5 py-3 text-[15px]">
          {confirmation}
        </div>
      )}
    </>
  );
}

/* ---------- Mémo vocal ---------- */

function Enregistreur({ memo, onMemo }: { memo: { blob: Blob; duree: number } | null; onMemo(m: { blob: Blob; duree: number } | null): void }) {
  const [etat, setEtat] = useState<"pret" | "enregistrement" | "refus">("pret");
  const [secondes, setSecondes] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const debut = useRef(0);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!memo) return setUrl(null);
    const u = URL.createObjectURL(memo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [memo]);

  useEffect(() => {
    if (etat !== "enregistrement") return;
    const t = setInterval(() => setSecondes((Date.now() - debut.current) / 1000), 250);
    return () => clearInterval(t);
  }, [etat]);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function demarrer() {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(flux);
      const morceaux: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
      r.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        onMemo({ blob: new Blob(morceaux, { type: r.mimeType || "audio/webm" }), duree: (Date.now() - debut.current) / 1000 });
        setEtat("pret");
      };
      recorder.current = r;
      debut.current = Date.now();
      setSecondes(0);
      onMemo(null);
      r.start();
      setEtat("enregistrement");
    } catch {
      setEtat("refus");
    }
  }

  if (etat === "refus")
    return (
      <p className="text-texte-2">
        {fr("Le micro n’est pas accessible. Autorise-le dans ton navigateur (icône à gauche de l’adresse), puis réessaie.")}
      </p>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {etat === "enregistrement" ? (
          <Bouton variante="accent" onClick={() => recorder.current?.stop()}>
            Arrêter
          </Bouton>
        ) : (
          <Bouton variante="contour" onClick={() => void demarrer()}>
            {memo ? "Recommencer" : "Enregistrer"}
          </Bouton>
        )}
        <span className="text-libelle text-texte-2 tabular-nums">
          {etat === "enregistrement" ? `Enregistrement… ${duree(secondes)}` : memo ? `Mémo de ${duree(memo.duree)}` : "Le son reste sur cet appareil."}
        </span>
      </div>
      {url && memo && <LecteurAudio source={url} dureeConnue={memo.duree} libelle="le mémo" />}
    </div>
  );
}
