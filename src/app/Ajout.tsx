import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bouton } from "@/components/Bouton";
import { ChampSelect, ChampTexte, ZoneTexte } from "@/components/Champs";
import { LecteurAudio } from "@/components/LecteurAudio";
import { Modale } from "@/components/Modale";
import { rolesContact } from "@/content/modelesMail";
import { fr } from "@/content/typo";
import { duree, jourIso } from "@/lib/format";
import { ajouterNoteAuBoard } from "@/features/boards/actions";
import { creerMorceau, importerVersion } from "@/features/musique/actions";
import { creerContact } from "@/features/reseau/actions";
import { creerEvenement } from "@/features/sorties/actions";
import { creerTache } from "@/features/taches/actions";
import { useUi, type TypeAjout } from "@/stores/ui";
import type { RoleContact } from "@/types";

/* Ajout rapide depuis le bouton + : une tâche, un événement, un contact,
   une note (posée sur le board) ou un mémo vocal (rangé dans Musique). */

const titres: Record<TypeAjout, string> = {
  tache: "Nouvelle tâche",
  evenement: "Nouvel événement",
  contact: "Nouveau contact",
  note: "Nouvelle note",
  memo: "Mémo vocal",
};

export function Ajout() {
  const naviguer = useNavigate();
  const { ajout, fermer, annoncer, annonce } = useUi();
  const [texte, setTexte] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [role, setRole] = useState<RoleContact>("artiste");
  const [email, setEmail] = useState("");
  const [memo, setMemo] = useState<{ blob: Blob; duree: number } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setTexte("");
    setEmail("");
    setHeure("");
    setMemo(null);
    setRole("artiste");
    setDate(ajout === "evenement" ? jourIso() : "");
  }, [ajout]);

  const pret = ajout === "memo" ? !!memo : texte.trim() !== "";

  async function enregistrer() {
    if (!pret || envoi || !ajout) return;
    setEnvoi(true);
    try {
      if (ajout === "tache") {
        await creerTache(texte, { echeance: date || null });
        annoncer("Tâche ajoutée.", { vers: "/taches", libelle: "Voir" });
      } else if (ajout === "evenement") {
        await creerEvenement({ titre: texte, date: date || jourIso(), heure: heure || null });
        annoncer("Ajouté au calendrier.", { vers: "/sorties", libelle: "Voir" });
      } else if (ajout === "contact") {
        const c = await creerContact(texte, role, email);
        fermer();
        return naviguer(`/reseau/${c.id}`);
      } else if (ajout === "note") {
        const b = await ajouterNoteAuBoard(texte);
        annoncer(`Note ajoutée à « ${b.titre} ».`, { vers: `/boards/${b.id}`, libelle: "Ouvrir" });
      } else if (memo) {
        const jour = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        const m = await creerMorceau(`Mémo vocal du ${jour}`, "idee");
        await importerVersion(m.id, memo.blob, memo.duree);
        annoncer("Mémo ajouté à ta librairie.", { vers: `/musique/${m.id}`, libelle: "Ouvrir" });
      }
      fermer();
    } finally {
      setEnvoi(false);
    }
  }

  const champDate = (libelle: string) => (
    <label className="flex flex-col gap-2">
      <span className="text-libelle text-texte-2">{libelle}</span>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
      />
    </label>
  );

  return (
    <>
      <Modale
        ouverte={ajout !== null}
        titre={ajout ? titres[ajout] : ""}
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="lien" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton onClick={() => void enregistrer()} disabled={!pret || envoi}>
              {ajout === "memo" && envoi ? "Analyse…" : "Ajouter"}
            </Bouton>
          </>
        }
      >
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void enregistrer();
          }}
        >
          {ajout === "tache" && (
            <>
              <ChampTexte libelle="Tâche" valeur={texte} onChange={setTexte} placeholder="Ex. Relancer l’ingé son" autoFocus maxLength={140} />
              {champDate("Échéance (facultatif)")}
            </>
          )}
          {ajout === "evenement" && (
            <>
              <ChampTexte libelle="Événement" valeur={texte} onChange={setTexte} placeholder="Ex. Session studio" autoFocus maxLength={140} />
              <div className="grid grid-cols-[1fr_160px] gap-4">
                {champDate("Date")}
                <label className="flex flex-col gap-2">
                  <span className="text-libelle text-texte-2">Heure (facultatif)</span>
                  <input
                    type="time"
                    value={heure}
                    onChange={(e) => setHeure(e.target.value)}
                    className="h-12 w-full rounded-12 border border-filet bg-surface px-4 text-texte focus:border-texte-2 focus:outline-none"
                  />
                </label>
              </div>
            </>
          )}
          {ajout === "contact" && (
            <>
              <ChampTexte libelle="Nom" valeur={texte} onChange={setTexte} placeholder="Nom ou pseudo" autoFocus maxLength={120} />
              <ChampSelect libelle="Rôle" valeur={role} options={rolesContact.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} onChange={(v) => setRole(v as RoleContact)} />
              <ChampTexte libelle="Mail (facultatif)" valeur={email} onChange={setEmail} type="email" placeholder="nom@exemple.fr" />
            </>
          )}
          {ajout === "note" && (
            <>
              <ZoneTexte libelle="Note" valeur={texte} onChange={setTexte} placeholder="Une idée, une phrase, une référence…" autoFocus />
              <p className="text-libelle text-texte-2">{fr("Elle est posée sur ton board, au centre.")}</p>
            </>
          )}
          {ajout === "memo" && <Enregistreur memo={memo} onMemo={setMemo} />}
        </form>
      </Modale>

      {annonce && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-filet bg-surface py-2.5 pr-2.5 pl-5 text-[15px]">
          {fr(annonce.texte)}
          {annonce.vers && (
            <Link to={annonce.vers} onClick={() => useUi.setState({ annonce: null })} className="rounded-full px-3 py-1 text-texte underline-offset-4 hover:underline">
              {annonce.libelle}
            </Link>
          )}
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
    return <p className="text-texte-2">{fr("Le micro n’est pas accessible. Autorise-le dans ton navigateur (icône à gauche de l’adresse), puis réessaie.")}</p>;

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
          {etat === "enregistrement" ? `Enregistrement… ${duree(secondes)}` : memo ? `Mémo de ${duree(memo.duree)}` : "Il arrive dans Musique, au statut Idée."}
        </span>
      </div>
      {url && memo && <LecteurAudio source={url} dureeConnue={memo.duree} libelle="le mémo" />}
    </div>
  );
}
