/* Synchronisation du board entre appareils, par Supabase.

   Principe : chaque appareil garde son board en local (IndexedDB) et
   continue de marcher sans réseau. Le cloud tient une copie, une ligne par
   compte, avec un numéro de version (`rev`).

   - Une modification part dans le cloud quelques secondes après, à
     condition que le cloud n'ait pas bougé entre-temps (on écrit « si
     rev = celle que je connais »). Sinon on récupère sa version, on fusionne
     (voir merge.js) et on réessaie.
   - Le cloud prévient en direct quand un autre appareil a écrit ; on
     récupère, on fusionne, on affiche.
   - Images, fichiers et morceaux vont dans un espace de stockage privé, un
     dossier par compte.
   - Une fois par jour, une copie du board est gardée à part : un filet de
     sécurité, sur 30 jours.

   La connexion se fait par un lien envoyé par e-mail (ou le code qu'il
   contient). Aucun mot de passe. */

import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_LIB } from "./config.js";
import { state, on, emit, replaceDoc, isBusy, storeAsset, getMeta, setMeta } from "./store.js";
import { merge, shareable, withoutWelcome, sameDoc } from "./merge.js";
import { render } from "./render.js";
import { toast } from "./main.js";

const PUSH_DELAY = 1500;
const POLL = 60000;
const SNAPSHOT_EVERY = 20 * 3600 * 1000;
const KEEP_SNAPSHOTS_DAYS = 30;

let sb = null;          // le client Supabase
let user = null;
let base = null;        // dernière version commune avec le cloud
let baseRev = 0;
let uploaded = new Set(); // fichiers déjà envoyés
let channel = null;
let pushTimer = null;
let status = "off";

export const syncUser = () => user;
export const syncStatus = () => status;
export const syncAvailable = () => !!sb;

function setStatus(s) {
  if (status === s) return;
  status = s;
  emit("sync", s);
}

/* Les opérations réseau passent une par une : jamais deux écritures qui se
   croisent depuis le même appareil. */
let chain = Promise.resolve();
function queue(task) {
  chain = chain.then(task).catch((err) => {
    console.warn("Synchronisation :", err);
    setStatus(navigator.onLine === false ? "offline" : "error");
    retryLater();
  });
  return chain;
}

let retryTimer = null;
function retryLater() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => user && queue(reconcile), 15000);
}

/* ---------- Démarrage et connexion ---------- */

export async function initSync() {
  try {
    // Un faux client peut être injecté pour les tests, en local seulement.
    const fake = ["localhost", "127.0.0.1"].includes(location.hostname) && window.__ctrlSupabase;
    if (fake) sb = fake;
    else {
      const { createClient } = await import(SUPABASE_LIB);
      sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      });
    }
  } catch (err) {
    console.warn("Synchronisation indisponible", err);
    setStatus("offline");
    return;
  }

  sb.auth.onAuthStateChange((event, session) => {
    // Le rappel de Supabase ne doit pas attendre nos appels réseau.
    setTimeout(() => {
      if (session?.user && session.user.id !== user?.id) start(session.user);
      if (!session && user) stop();
    }, 0);
  });
  const { data } = await sb.auth.getSession();
  if (data?.session?.user) start(data.session.user);
  else setStatus("off");

  on("change", schedulePush);
  on("asset", () => user && queue(syncAssets));
  addEventListener("online", () => user && queue(reconcile));
  addEventListener("focus", () => user && queue(reconcile));
  document.addEventListener("visibilitychange", () => {
    if (!user) return;
    // On quitte l'onglet : on envoie sans attendre. On revient : on récupère.
    if (document.hidden) pushNow();
    else queue(reconcile);
  });
  setInterval(() => user && !document.hidden && queue(reconcile), POLL);
}

async function start(u) {
  user = u;
  const saved = await getMeta("sync");
  if (saved && saved.userId === u.id) {
    base = saved.base;
    baseRev = saved.rev;
  } else {
    base = null;
    baseRev = 0;
  }
  uploaded = new Set((await getMeta("sync-assets-" + u.id)) || []);
  listen();
  emit("sync", status);
  queue(reconcile);
}

function stop() {
  user = null;
  channel?.unsubscribe?.();
  channel = null;
  setStatus("off");
}

/** Envoie le lien (et le code) de connexion par e-mail. */
export async function sendLoginEmail(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Connexion avec le code à 6 chiffres reçu par e-mail. */
export async function verifyCode(email, token) {
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  await pushNow();
  await sb.auth.signOut();
}

/* Le cloud prévient quand la ligne du compte change. On ne lit pas le
   contenu du message : on récupère la version complète. */
function listen() {
  channel?.unsubscribe?.();
  channel = sb
    .channel("board-" + user.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "boards", filter: `user_id=eq.${user.id}` },
      (payload) => {
        const rev = payload?.new?.rev;
        if (!rev || rev > baseRev) queue(reconcile);
      })
    .subscribe();
}

/* ---------- Envoi et réception ---------- */

function schedulePush() {
  if (!user) return;
  clearTimeout(pushTimer);
  if (!sameDoc(state.doc, base || {})) setStatus("pending");
  pushTimer = setTimeout(() => queue(push), PUSH_DELAY);
}

function pushNow() {
  if (!user) return Promise.resolve();
  clearTimeout(pushTimer);
  return queue(push);
}

async function remember() {
  await setMeta("sync", { userId: user.id, base, rev: baseRev });
}

/** Récupère le cloud, fusionne avec l'appareil, et renvoie si besoin. */
async function reconcile() {
  if (!user) return;
  // Pendant un glisser ou une édition, on attend que le geste se termine.
  if (isBusy()) return void setTimeout(() => queue(reconcile), 1500);
  setStatus("syncing");

  const { data: remote, error } = await sb.from("boards").select("doc, rev").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  const local = shareable(state.doc);

  if (!remote) {
    // Premier envoi de ce compte : le board de cet appareil devient celui du cloud.
    const { error: err } = await sb.from("boards").insert({ user_id: user.id, doc: local, rev: 1 });
    if (err) throw err;
    base = local;
    baseRev = 1;
    await remember();
    toast("Board enregistré dans le cloud");
  } else if (remote.rev !== baseRev || !sameDoc(local, base || {})) {
    // Sur un appareil qui n'a jamais synchronisé, le board d'accueil ne doit
    // pas se mêler au vrai board.
    const mine = base ? local : withoutWelcome(local);
    const merged = merge(base, mine, remote.doc);
    if (!sameDoc(merged, local)) {
      // Une copie : le board affiché et la version de référence ne doivent
      // jamais partager les mêmes objets, sinon modifier l'un modifie l'autre.
      replaceDoc(structuredClone(merged));
      render();
    }
    base = merged;
    baseRev = remote.rev;
    await remember();
    if (!sameDoc(merged, remote.doc)) await push();
  }
  await syncAssets();
  setStatus(sameDoc(state.doc, base) ? "synced" : "pending");
}

/** Envoie le board, seulement si le cloud est resté à la version connue. */
async function push() {
  if (!user || !base) return reconcile();
  const doc = shareable(state.doc);
  if (sameDoc(doc, base)) return setStatus("synced");
  setStatus("syncing");
  const next = baseRev + 1;
  const { data, error } = await sb.from("boards")
    .update({ doc, rev: next, updated_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("rev", baseRev)
    .select("rev");
  if (error) throw error;
  // Aucune ligne modifiée : un autre appareil a écrit entre-temps.
  if (!data || !data.length) return reconcile();
  base = doc;
  baseRev = next;
  await remember();
  setStatus(sameDoc(state.doc, base) ? "synced" : "pending");
  await snapshot(doc);
}

/* Une copie par jour au plus, gardée 30 jours : de quoi revenir en arrière
   si une fausse manipulation s'est synchronisée partout. */
async function snapshot(doc) {
  const key = "ctrl-snapshot-" + user.id;
  let last = 0;
  try { last = Number(localStorage.getItem(key)) || 0; } catch {}
  if (Date.now() - last < SNAPSHOT_EVERY) return;
  const { error } = await sb.from("board_history").insert({ user_id: user.id, doc });
  if (error) return console.warn("Copie du jour impossible", error);
  try { localStorage.setItem(key, String(Date.now())); } catch {}
  const limit = new Date(Date.now() - KEEP_SNAPSHOTS_DAYS * 86400000).toISOString();
  await sb.from("board_history").delete().eq("user_id", user.id).lt("created_at", limit);
}

/* ---------- Fichiers ---------- */

function referencedAssets() {
  const keys = new Set();
  for (const b of Object.values(state.doc.blocks)) {
    if (b.asset) keys.add(b.asset);
    for (const it of b.items || []) if (it.asset) keys.add(it.asset);
  }
  return keys;
}

/** Envoie les fichiers que le cloud n'a pas, récupère ceux qui manquent ici. */
async function syncAssets() {
  if (!user) return;
  const bucket = sb.storage.from("assets");
  let received = 0;
  for (const key of referencedAssets()) {
    const path = `${user.id}/${key}`;
    const blob = state.assets.get(key);
    if (blob && !uploaded.has(key)) {
      const { error } = await bucket.upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
      if (error) { console.warn("Envoi impossible", key, error); continue; }
      uploaded.add(key);
      await setMeta("sync-assets-" + user.id, [...uploaded]);
    } else if (!blob) {
      const { data, error } = await bucket.download(path);
      if (error || !data) continue; // pas encore envoyé par l'autre appareil
      await storeAsset(key, data);
      uploaded.add(key);
      received++;
    }
  }
  if (received) {
    await setMeta("sync-assets-" + user.id, [...uploaded]);
    render();
  }
}
