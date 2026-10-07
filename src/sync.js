/* Synchronisation des boards entre appareils et entre personnes, par Supabase.

   Principe : chaque appareil garde une copie locale de chaque board et
   continue de marcher sans réseau. Le cloud tient chaque board avec un
   numéro de version (`rev`).

   - Une modification part dans le cloud quelques secondes après, à
     condition que le cloud n'ait pas bougé entre-temps (on écrit « si
     rev = celle que je connais »). Sinon on récupère sa version, on fusionne
     (voir merge.js) et on réessaie.
   - Le cloud prévient en direct quand quelqu'un d'autre a écrit ; on
     récupère, on fusionne, on affiche.
   - Un partage limité à une zone passe par deux fonctions du serveur, qui
     ne renvoient et n'acceptent que cette zone : le reste du board ne quitte
     jamais le cloud.
   - Un invité (sans compte) lit un board par son lien, en lecture seule.
   - Images, fichiers et morceaux : un dossier privé par board ; et, dès
     qu'un lien de partage existe, une copie publique (chemin impossible à
     deviner) pour que les invités les voient aussi.
   - Une fois par jour, une copie de chaque board est gardée 30 jours.

   La connexion se fait par un code envoyé par e-mail. Aucun mot de passe. */

import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_LIB } from "./config.js";
import { state, on, emit, replaceDoc, isBusy, storeAsset, getMeta, setMeta, openBoard, loadDoc, saveDoc, LOCAL_BOARD } from "./store.js";
import { merge, shareable, withoutWelcome, sameDoc } from "./merge.js";
import { render } from "./render.js";
import { toast } from "./main.js";

const PUSH_DELAY = 1500;
const POLL = 60000;
const POLL_SHARED = 15000;   // zone partagée ou invité : pas de temps réel
const SNAPSHOT_EVERY = 20 * 3600 * 1000;
const KEEP_SNAPSHOTS_DAYS = 30;

let sb = null;              // le client Supabase
let user = null;
let boards = [];            // mes boards et ceux qu'on m'a partagés
let base = null;            // dernière version commune avec le cloud (board ouvert)
let baseRev = 0;
let uploaded = new Set();   // fichiers déjà dans le dossier privé du board
let mirrored = new Set();   // fichiers déjà copiés pour les invités
let hasLinks = false;       // le board ouvert a-t-il un lien de partage actif ?
let channel = null;
let pushTimer = null;
let pollTimer = null;
let status = "off";
let pendingToken = null;    // lien de partage ouvert avant d'être connecté
let startedFor = null;      // le compte pour lequel la synchro a déjà démarré

export const syncUser = () => user;
export const syncStatus = () => status;
export const syncAvailable = () => !!sb;
export const boardsList = () => boards;

const cloud = () => !!user && state.board.id !== "local" && !state.board.guest;
const canWrite = () => state.board.role === "owner" || state.board.role === "editor";
const zoned = () => !!state.board.zone;

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
  retryTimer = setTimeout(() => queue(refresh), 15000);
}

/** Ce qu'il faut rafraîchir selon la situation : le board, ou la vue invité. */
const refresh = () => (state.board.guest ? pullGuest() : reconcile());

/* ---------- Démarrage et connexion ---------- */

/** Démarre la synchro. Renvoie le lien de partage ouvert, s'il y en a un et
    qu'il n'est pas encore accepté : la carte d'arrivée s'en sert. */
export async function initSync() {
  // Un lien de partage : ?s=jeton. On le retire de l'adresse aussitôt.
  const params = new URLSearchParams(location.search);
  if (params.get("s")) {
    pendingToken = params.get("s");
    params.delete("s");
    history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : ""));
  }

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
    return null;
  }

  sb.auth.onAuthStateChange((event, session) => {
    // Le rappel de Supabase ne doit pas attendre nos appels réseau.
    setTimeout(() => {
      // Supabase annonce la session au démarrage alors qu'on vient de la
      // lire : on ne démarre jamais deux fois pour le même compte.
      if (session?.user && session.user.id !== startedFor) {
        startedFor = session.user.id;
        queue(() => start(session.user));
      }
      if (!session && user) stop();
    }, 0);
  });

  on("change", schedulePush);
  on("asset", () => cloud() && queue(syncAssets));
  addEventListener("online", () => queue(refresh));
  addEventListener("focus", () => queue(refresh));
  document.addEventListener("visibilitychange", () => {
    // On quitte l'onglet : on envoie sans attendre. On revient : on récupère.
    if (document.hidden) pushNow();
    else queue(refresh);
  });
  setInterval(() => !document.hidden && cloud() && queue(reconcile), POLL);

  const { data } = await sb.auth.getSession();
  if (data?.session?.user) {
    if (data.session.user.id !== startedFor) {
      startedFor = data.session.user.id;
      await queue(() => start(data.session.user));
    }
    return null;
  }
  setStatus("off");
  if (!pendingToken) return null;
  const info = await linkInfo(pendingToken);
  if (!info) { toast("Ce lien de partage n'existe plus"); pendingToken = null; return null; }
  return { token: pendingToken, ...info };
}

async function start(u) {
  user = u;
  await fetchBoards();

  // Premier passage de ce compte sans board : celui de l'appareil devient le sien.
  if (!boards.some((b) => b.role === "owner")) {
    const { data, error } = await sb.from("boards")
      .insert({ owner: u.id, name: "Mon board", doc: shareable(state.doc), rev: 1 })
      .select("id").single();
    if (error) throw error;
    await fetchBoards();
    await setMeta("sync-" + data.id, { base: shareable(state.doc), rev: 1 });
    toast("Board enregistré dans le cloud");
  }

  // Un lien ouvert avant de se connecter : on l'accepte maintenant.
  let target = null;
  if (pendingToken) {
    target = await acceptToken(pendingToken);
    pendingToken = null;
  }
  const fromLocal = state.board.id === "local";
  target ||= boards.find((b) => b.id === state.board.id) || boards.find((b) => b.role === "owner");

  if (fromLocal && target.role === "owner" && !(await getMeta("local-merged-" + u.id))) {
    // Première connexion sur cet appareil : le board local rejoint le board
    // du compte (sans le board d'accueil), rien ne se perd.
    await setMeta("local-merged-" + u.id, true);
    await enter(target, withoutWelcome(shareable(state.doc)), true);
  } else {
    await enter(target);
  }
}

function stop() {
  user = null;
  startedFor = null;
  boards = [];
  channel?.unsubscribe?.();
  channel = null;
  clearInterval(pollTimer);
  setStatus("off");
  // De retour sur le board de l'appareil.
  openBoard({ ...LOCAL_BOARD }).then(render);
}

/** Envoie le code (et le lien) de connexion par e-mail. */
export async function sendLoginEmail(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Connexion avec le code reçu par e-mail. */
export async function verifyCode(email, token) {
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  await pushNow();
  await sb.auth.signOut();
}

/* ---------- Boards ---------- */

const toBoard = (b) => ({
  id: b.id, name: b.name, role: b.role, zone: b.zone_id || null,
  zoneName: b.zone_name || null, ownerEmail: b.owner_email || null,
});

async function fetchBoards() {
  const { data, error } = await sb.rpc("my_boards");
  if (error) throw error;
  boards = (data || []).map(toBoard)
    .sort((a, b) => (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1) || a.name.localeCompare(b.name));
  try { localStorage.setItem("ctrl-boards", JSON.stringify(boards)); } catch {}
  emit("boards", boards);
}

/* Ouvre un board : sa copie locale tout de suite, puis la synchro. `seed`
   (première connexion) se fusionne au board du cloud. */
async function enter(board, seed = null, merging = false) {
  clearInterval(pollTimer);
  channel?.unsubscribe?.();
  base = null;
  baseRev = 0;
  const localCopy = merging ? seed : await loadDoc(board.id);
  await openBoard(board, localCopy || null);
  // La copie locale est écrite tout de suite : rouvrir ce board ne doit
  // jamais tomber sur un board vide.
  await saveDoc(board.id, state.doc);
  render();
  // Sans copie locale, la version de référence ne veut plus rien dire :
  // on repart de zéro et le cloud fait foi. (Sinon un board vide passerait
  // pour « tout a été effacé ici », et l'effacement partirait au cloud.)
  const saved = localCopy && !merging ? await getMeta("sync-" + board.id) : null;
  base = saved?.base || null;
  baseRev = saved?.rev || 0;
  uploaded = new Set((await getMeta("sync-assets-" + board.id)) || []);
  mirrored = new Set((await getMeta("sync-shared-" + board.id)) || []);
  listen();
  await reconcile();
}

/** Passe à un autre board. */
export function switchBoard(id) {
  return queue(async () => {
    await push();
    const b = boards.find((x) => x.id === id);
    if (b) await enter(b);
  });
}

export function createBoard(name = "Nouveau board") {
  return queue(async () => {
    await push();
    const { data, error } = await sb.from("boards")
      .insert({ owner: user.id, name, doc: {}, rev: 1 }).select("id").single();
    if (error) throw error;
    await fetchBoards();
    await enter(boards.find((b) => b.id === data.id));
  });
}

export function renameBoard(name) {
  name = name.trim();
  if (!name || !cloud() || zoned() || !canWrite()) return;
  return queue(async () => {
    const { error } = await sb.from("boards").update({ name }).eq("id", state.board.id);
    if (error) throw error;
    state.board.name = name;
    await fetchBoards();
    emit("board", state.board);
  });
}

/* ---------- Liens de partage et membres ---------- */

export const shareUrl = (token) => location.origin + location.pathname + "?s=" + token;

async function linkInfo(token) {
  const { data, error } = await sb.rpc("link_info", { t: token });
  if (error || !data) return null;
  return data;
}

/** Le lien d'un rôle (et d'une zone) : celui qui existe, sinon un nouveau. */
export async function ensureLink(role, zone = null) {
  let q = sb.from("board_links").select("token").eq("board_id", state.board.id).eq("role", role).eq("revoked", false);
  q = zone ? q.eq("zone_id", zone) : q.is("zone_id", null);
  const { data } = await q.limit(1);
  let token = data?.[0]?.token;
  if (!token) {
    const res = await sb.from("board_links").insert({ board_id: state.board.id, role, zone_id: zone }).select("token").single();
    if (res.error) throw res.error;
    token = res.data.token;
  }
  hasLinks = true;
  queue(mirrorShared);
  return shareUrl(token);
}

/** Désactive les liens (du board, ou d'une zone). Les membres déjà entrés restent. */
export async function revokeLinks(zone = null) {
  let q = sb.from("board_links").update({ revoked: true }).eq("board_id", state.board.id).eq("revoked", false);
  q = zone ? q.eq("zone_id", zone) : q.is("zone_id", null);
  const { error } = await q;
  if (error) throw error;
}

export async function listMembers() {
  const { data, error } = await sb.from("board_members").select("user_id, email, role, zone_id").eq("board_id", state.board.id);
  if (error) throw error;
  return data || [];
}

export async function removeMember(userId) {
  const { error } = await sb.from("board_members").delete().eq("board_id", state.board.id).eq("user_id", userId);
  if (error) throw error;
}

/** Accepter un lien, une fois connecté : le board rejoint la liste. */
async function acceptToken(token) {
  const { data, error } = await sb.rpc("accept_link", { t: token });
  if (error) { toast("Ce lien de partage n'est plus valable"); return null; }
  await fetchBoards();
  const b = boards.find((x) => x.id === data);
  if (b) toast(b.role === "viewer" ? `« ${b.name} » ajouté, en lecture` : `« ${b.name} » ajouté à tes boards`);
  return b || null;
}

/** Ouvrir un lien sans compte : lecture seule. */
export function openAsGuest(token) {
  return queue(async () => {
    const data = await fetchShared(token);
    if (!data) return toast("Ce lien de partage n'existe plus");
    const board = { id: "shared-" + token.slice(0, 16), name: data.name, role: "viewer", zone: data.zone_id || null, guest: true, token, cloudId: data.board_id };
    await openBoard(board, data.doc);
    base = data.doc;
    baseRev = data.rev;
    render();
    clearInterval(pollTimer);
    pollTimer = setInterval(() => !document.hidden && queue(pullGuest), POLL_SHARED);
    await guestAssets();
  });
}

async function fetchShared(token) {
  const { data, error } = await sb.rpc("shared_doc", { t: token });
  if (error) throw error;
  return data;
}

async function pullGuest() {
  if (!state.board.guest) return;
  const data = await fetchShared(state.board.token);
  if (!data) return;
  if (data.rev !== baseRev) {
    base = data.doc;
    baseRev = data.rev;
    replaceDoc(structuredClone(data.doc));
    render();
    await guestAssets();
  }
}

/* ---------- Envoi et réception ---------- */

/* Le cloud prévient quand le board change — pour qui a accès au board
   entier. Une zone partagée, elle, est relue régulièrement. */
function listen() {
  channel?.unsubscribe?.();
  channel = null;
  clearInterval(pollTimer);
  if (!cloud()) return;
  if (zoned()) {
    pollTimer = setInterval(() => !document.hidden && queue(reconcile), POLL_SHARED);
    return;
  }
  const id = state.board.id;
  channel = sb
    .channel("board-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "boards", filter: `id=eq.${id}` },
      (payload) => {
        const rev = payload?.new?.rev;
        if (!rev || rev > baseRev) queue(reconcile);
      })
    .subscribe();
}

function schedulePush() {
  if (!cloud() || !canWrite()) return;
  clearTimeout(pushTimer);
  if (!sameDoc(state.doc, base || {})) setStatus("pending");
  pushTimer = setTimeout(() => queue(push), PUSH_DELAY);
}

function pushNow() {
  if (!cloud()) return Promise.resolve();
  clearTimeout(pushTimer);
  return queue(push);
}

async function remember() {
  await setMeta("sync-" + state.board.id, { base, rev: baseRev });
}

async function fetchRemote() {
  if (zoned()) {
    const { data, error } = await sb.rpc("zone_doc", { b: state.board.id });
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb.from("boards").select("doc, rev, name").eq("id", state.board.id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Récupère le cloud, fusionne avec l'appareil, et renvoie si besoin. */
async function reconcile() {
  if (!cloud()) return;
  // Pendant un glisser ou une édition, on attend que le geste se termine.
  if (isBusy()) return void setTimeout(() => queue(reconcile), 1500);
  setStatus("syncing");

  const remote = await fetchRemote();
  if (!remote) {
    // Plus d'accès (partage retiré, board supprimé) : retour à son board.
    toast(`« ${state.board.name} » n'est plus accessible`);
    await fetchBoards();
    const mine = boards.find((b) => b.role === "owner");
    if (mine) await enter(mine);
    return;
  }
  if (remote.name && remote.name !== state.board.name) {
    state.board.name = remote.name;
    emit("board", state.board);
  }

  const local = shareable(state.doc);
  if (!canWrite()) {
    // Lecture seule : le cloud fait foi.
    if (!sameDoc(local, remote.doc)) { replaceDoc(structuredClone(remote.doc)); render(); }
    base = remote.doc;
    baseRev = remote.rev;
  } else if (remote.rev !== baseRev || !sameDoc(local, base || {})) {
    const merged = merge(base, local, remote.doc);
    if (!sameDoc(merged, local)) {
      // Une copie : le board affiché et la version de référence ne doivent
      // jamais partager les mêmes objets, sinon modifier l'un modifie l'autre.
      replaceDoc(structuredClone(merged));
      render();
    }
    // Filet de sécurité : avant d'envoyer une grosse suppression, le cloud
    // est mis de côté dans l'historique. Rien ne disparaît sans copie.
    const before = Object.keys(remote.doc?.blocks || {}).length;
    const after = Object.keys(merged.blocks || {}).length;
    if (!zoned() && before >= 5 && after < before * 0.4) {
      await sb.from("board_history").insert({ user_id: user.id, board_id: state.board.id, doc: remote.doc });
    }
    // La version commune avec le cloud, c'est la sienne : ce que la fusion
    // ajoute part ensuite par push(), qui compare à cette référence.
    base = remote.doc;
    baseRev = remote.rev;
    if (!sameDoc(merged, remote.doc)) await push();
  }
  await remember();
  await syncAssets();
  setStatus(sameDoc(state.doc, base || {}) ? "synced" : "pending");
}

/** Envoie le board, seulement si le cloud est resté à la version connue. */
async function push() {
  if (!cloud() || !canWrite()) return;
  if (!base) return reconcile();
  const doc = shareable(state.doc);
  if (sameDoc(doc, base)) return setStatus("synced");
  setStatus("syncing");

  let next;
  if (zoned()) {
    const { data, error } = await sb.rpc("save_zone", { b: state.board.id, part: doc, base_rev: baseRev });
    if (error) throw error;
    if (data == null) return reconcile(); // le board a bougé : relire et fusionner
    next = data;
  } else {
    next = baseRev + 1;
    const { data, error } = await sb.from("boards")
      .update({ doc, rev: next, updated_at: new Date().toISOString() })
      .eq("id", state.board.id).eq("rev", baseRev)
      .select("rev");
    if (error) throw error;
    // Aucune ligne modifiée : quelqu'un a écrit entre-temps.
    if (!data || !data.length) return reconcile();
  }
  base = doc;
  baseRev = next;
  await remember();
  setStatus(sameDoc(state.doc, base) ? "synced" : "pending");
  if (!zoned()) await snapshot(doc);
}

/* Une copie par jour au plus, gardée 30 jours : de quoi revenir en arrière
   si une fausse manipulation s'est synchronisée partout. */
async function snapshot(doc) {
  const key = "ctrl-snapshot-" + state.board.id;
  let last = 0;
  try { last = Number(localStorage.getItem(key)) || 0; } catch {}
  if (Date.now() - last < SNAPSHOT_EVERY) return;
  const { error } = await sb.from("board_history").insert({ user_id: user.id, board_id: state.board.id, doc });
  if (error) return console.warn("Copie du jour impossible", error);
  try { localStorage.setItem(key, String(Date.now())); } catch {}
  const limit = new Date(Date.now() - KEEP_SNAPSHOTS_DAYS * 86400000).toISOString();
  await sb.from("board_history").delete().eq("board_id", state.board.id).lt("created_at", limit);
}

/* ---------- Historique ---------- */

/** Les copies quotidiennes du board ouvert, de la plus récente à la plus ancienne. */
export async function listSnapshots() {
  if (!cloud() || zoned()) return [];
  const { data, error } = await sb.from("board_history")
    .select("id, created_at, doc").eq("board_id", state.board.id)
    .order("created_at", { ascending: false }).limit(KEEP_SNAPSHOTS_DAYS + 5);
  if (error) throw error;
  // Le nombre de blocs de chaque copie : on repère d'un coup d'œil la bonne.
  return (data || []).map((s) => ({ id: s.id, created_at: s.created_at, blocks: Object.keys(s.doc?.blocks || {}).length }));
}

/* Revenir à une copie. Le board actuel est d'abord mis de côté dans
   l'historique : revenir en arrière ne fait jamais rien perdre. */
export async function restoreSnapshot(id) {
  const { data, error } = await sb.from("board_history").select("doc").eq("id", id).maybeSingle();
  if (error || !data) throw error || new Error("Copie introuvable");
  await pushNow();
  const { error: saveError } = await sb.from("board_history")
    .insert({ user_id: user.id, board_id: state.board.id, doc: shareable(state.doc) });
  if (saveError) throw saveError;
  replaceDoc(structuredClone(data.doc));
  render();
  emit("change");
}

/* ---------- Copie de cet appareil ---------- */

/** Le board resté sur cet appareil d'avant la connexion, s'il contient quelque chose. */
export async function deviceCopy() {
  if (!cloud()) return null;
  const doc = await loadDoc("local");
  const n = Object.keys(doc?.blocks || {}).length;
  return n ? { doc, blocks: n } : null;
}

/* Revenir à la copie de cet appareil. Comme pour l'historique, le board
   actuel est d'abord mis de côté. */
export async function restoreDeviceCopy() {
  const copy = await deviceCopy();
  if (!copy) throw new Error("Aucune copie sur cet appareil");
  await pushNow();
  await sb.from("board_history").insert({ user_id: user.id, board_id: state.board.id, doc: shareable(state.doc) });
  replaceDoc(structuredClone(shareable(copy.doc)));
  render();
  emit("change");
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
  if (!cloud()) return;
  const id = state.board.id;
  const bucket = sb.storage.from("assets");
  let received = 0;
  for (const key of referencedAssets()) {
    const blob = state.assets.get(key);
    if (blob && !uploaded.has(key) && canWrite()) {
      const { error } = await bucket.upload(`${id}/${key}`, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
      if (error) { console.warn("Envoi impossible", key, error); continue; }
      uploaded.add(key);
      await setMeta("sync-assets-" + id, [...uploaded]);
    } else if (!blob) {
      let { data } = await bucket.download(`${id}/${key}`);
      // Fichier envoyé par la première version de l'app, rangé par compte.
      if (!data) ({ data } = await bucket.download(`${user.id}/${key}`));
      if (!data) continue; // pas encore envoyé par l'autre appareil
      await storeAsset(key, data);
      uploaded.add(key);
      received++;
    }
  }
  if (received) {
    await setMeta("sync-assets-" + id, [...uploaded]);
    render();
  }
  if (canWrite()) {
    if (!hasLinks) {
      const { data } = await sb.from("board_links").select("token").eq("board_id", id).eq("revoked", false).limit(1);
      hasLinks = !!data?.length;
    }
    if (hasLinks) await mirrorShared();
  }
}

/* Pour les invités sans compte : une copie publique des fichiers d'un board
   partagé par lien. Le chemin contient l'identifiant du board et une clé
   aléatoire, impossibles à deviner. */
async function mirrorShared() {
  if (!cloud() || !canWrite()) return;
  const id = state.board.id;
  const bucket = sb.storage.from("shared");
  for (const key of referencedAssets()) {
    const blob = state.assets.get(key);
    if (!blob || mirrored.has(key)) continue;
    const { error } = await bucket.upload(`${id}/${key}`, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
    if (error) { console.warn("Copie publique impossible", key, error); continue; }
    mirrored.add(key);
  }
  await setMeta("sync-shared-" + id, [...mirrored]);
}

async function guestAssets() {
  let received = 0;
  for (const key of referencedAssets()) {
    if (state.assets.get(key)) continue;
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/shared/${state.board.cloudId}/${key}`);
      if (!res.ok) continue;
      await storeAsset(key, await res.blob());
      received++;
    } catch { /* réseau */ }
  }
  if (received) render();
}
