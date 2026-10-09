/* Les notifications push : les rappels sonnent même app fermée.

   L'appareil s'abonne une fois (menu ⋮ → « Activer les notifications », ou
   en posant un rappel) ; le serveur (supabase/functions/push) envoie ensuite
   chaque rappel à l'heure dite.

   Sur iPhone, Apple ne l'autorise qu'à une app ajoutée à l'écran d'accueil
   (iOS 16.4 ou plus récent). */

import { cloudClient, syncUser } from "./sync.js";
import { SUPABASE_URL } from "./config.js";
import { on } from "./store.js";

const SEND = SUPABASE_URL + "/functions/v1/push";

const isIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

let subscribed = false;

/** « on », « off », « denied », « install » (iPhone : l'ajouter d'abord à
    l'écran d'accueil) ou « unsupported ». */
export function pushState() {
  if (isIOS() && !standalone()) return "install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return subscribed && Notification.permission === "granted" ? "on" : "off";
}

export function initPush() {
  checkPush().catch(() => {});
  // Une fois connecté : on remet l'abonnement à jour (fuseau, compte).
  on("boards", () => refresh().catch(() => {}));
}

async function registration() {
  return navigator.serviceWorker.ready;
}

async function refresh() {
  if (!supported() || !syncUser() || Notification.permission !== "granted") return;
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) await save(sub);
}

async function save(sub) {
  const { keys } = sub.toJSON();
  const { error } = await cloudClient().rpc("save_push", {
    sub_endpoint: sub.endpoint, sub_p256dh: keys.p256dh, sub_auth: keys.auth,
    sub_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
  });
  if (error) throw error;
  subscribed = true;
}

async function publicKey() {
  const sb = cloudClient();
  let { data } = await sb.rpc("push_public_key");
  if (!data) {
    // Premier abonnement : la fonction d'envoi crée ses clés.
    const r = await fetch(SEND, { method: "POST" }).then((x) => x.json()).catch(() => null);
    data = r?.publicKey || (await sb.rpc("push_public_key")).data;
  }
  if (!data) throw new Error("Notifications pas encore installées côté serveur");
  return data;
}

/** À appeler sur un geste de l'utilisateur (iOS l'exige). */
export async function enablePush() {
  const state = pushState();
  if (state === "install" || state === "unsupported") throw new Error(state);
  if (!syncUser()) throw new Error("signed-out");
  // La demande d'autorisation d'abord, tant que le geste est « frais ».
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(await publicKey()) });
  }
  await save(sub);
}

export async function disablePush() {
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) {
    try { await cloudClient().rpc("drop_push", { sub_endpoint: sub.endpoint }); } catch {}
    await sub.unsubscribe().catch(() => {});
  }
  subscribed = false;
}

/** Une notification tout de suite, sur tous mes appareils abonnés. */
export async function testPush() {
  const { error } = await cloudClient().rpc("queue_test_push");
  if (error) throw error;
  const r = await fetch(SEND, { method: "POST" });
  if (!r.ok) throw new Error("Fonction d'envoi indisponible");
}

/** L'abonnement s'est-il fait sur cet appareil ? (lu au démarrage) */
export async function checkPush() {
  if (!supported() || Notification.permission !== "granted") return pushState();
  subscribed = !!(await (await registration()).pushManager.getSubscription());
  return pushState();
}

function bytes(base64url) {
  const b64 = (base64url + "===".slice((base64url.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
