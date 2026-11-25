/* Serveur réel : Supabase (connexion par code reçu par mail, table « objets »,
   stockage « fichiers »). Chargé seulement quand un compte est utilisé. */

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CLE, SUPABASE_URL } from "./config";
import type { Distant, LigneDistante, Session } from "./distant";

export function creerDistantSupabase(): Distant {
  const sb = createClient(SUPABASE_URL, SUPABASE_CLE, {
    auth: { storageKey: "ctrlapp.auth", persistSession: true, autoRefreshToken: true },
  });
  const versSession = (u: { id: string; email?: string } | null | undefined): Session | null => (u ? { uid: u.id, email: u.email ?? "" } : null);

  return {
    async session() {
      const { data } = await sb.auth.getSession();
      return versSession(data.session?.user);
    },
    surSession(rappel) {
      sb.auth.onAuthStateChange((_e, s) => rappel(versSession(s?.user)));
    },
    async envoyerCode(email) {
      // Le mail contient un code (à taper) et un lien (qui ramène ici et connecte aussi).
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}` } });
      if (error) throw new Error(traduire(error.message));
    },
    async verifierCode(email, code) {
      const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
      if (error || !data.user) throw new Error(traduire(error?.message ?? "Code refusé"));
      return versSession(data.user)!;
    },
    async deconnecter() {
      await sb.auth.signOut();
    },
    async envoyer(lignes) {
      for (let i = 0; i < lignes.length; i += 200) {
        const { error } = await sb.from("objets").upsert(lignes.slice(i, i + 200), { onConflict: "owner_id,collection,id" });
        if (error) throw new Error(error.message);
      }
    },
    async recevoir(depuis) {
      const toutes: LigneDistante[] = [];
      for (let page = 0; ; page++) {
        let q = sb.from("objets").select("id, collection, donnees, supprime, modifie_le, recu_le").order("recu_le").range(page * 1000, page * 1000 + 999);
        if (depuis) q = q.gt("recu_le", depuis);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        toutes.push(...(data as LigneDistante[]));
        if (!data || data.length < 1000) return toutes;
      }
    },
    async compter(collection) {
      const { count, error } = await sb.from("objets").select("id", { count: "exact", head: true }).eq("collection", collection).eq("supprime", false);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async deposerFichier(chemin, blob) {
      const { error } = await sb.storage.from("fichiers").upload(chemin, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
      if (error) throw new Error(error.message);
    },
    async lireFichier(chemin) {
      const { data, error } = await sb.storage.from("fichiers").download(chemin);
      if (error || !data) throw new Error(error?.message ?? "Fichier introuvable");
      return data;
    },
  };
}

/** Messages de Supabase les plus courants, en français. */
function traduire(m: string) {
  if (/rate limit/i.test(m)) return "Trop de mails envoyés d’un coup. Attends un peu, ou utilise le dernier code reçu.";
  if (/expired|invalid/i.test(m)) return "Ce code n’est pas bon ou a expiré. Redemande un code.";
  if (/email/i.test(m) && /valid/i.test(m)) return "Cette adresse mail n’est pas valide.";
  if (/fetch|network/i.test(m)) return "Pas de connexion au serveur. Vérifie le réseau.";
  return m;
}
