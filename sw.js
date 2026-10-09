/* Service worker : rend l'app installable et utilisable hors-ligne.

   Stratégie « réseau d'abord, cache en secours » : en développement on voit
   toujours la dernière version du code, et sans réseau l'app démarre quand même.
   Les données, elles, ne passent jamais par ici — elles vivent dans IndexedDB.

   Il reçoit aussi les notifications push (les rappels, app fermée). */

const CACHE = "ctrl-app-v15";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/style.css",
  "./src/main.js",
  "./src/store.js",
  "./src/util.js",
  "./src/viewport.js",
  "./src/render.js",
  "./src/interact.js",
  "./src/editor.js",
  "./src/menus.js",
  "./src/search.js",
  "./src/arrange.js",
  "./src/io.js",
  "./src/welcome.js",
  "./src/archive.js",
  "./src/draw.js",
  "./src/props.js",
  "./src/reminders.js",
  "./src/lists.js",
  "./src/variant.js",
  "./src/format.js",
  "./src/sounds.js",
  "./src/sync.js",
  "./src/merge.js",
  "./src/config.js",
  "./src/onboarding.js",
  "./src/install.js",
  "./src/table.js",
  "./src/share.js",
  "./src/push.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    // `no-cache` : on revalide auprès du serveur plutôt que de servir la copie
    // du navigateur. GitHub Pages autorise dix minutes de cache, pendant
    // lesquelles une mise à jour resterait invisible.
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        // On ne met en cache que ce qui a abouti, et jamais les réponses opaques
        // partielles qui rendraient l'app cassée hors-ligne.
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./index.html");
        return new Response("Hors-ligne", { status: 503, statusText: "Hors-ligne" });
      })
  );
});

/* ---------- Notifications push ---------- */

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "ctrl.app", {
    body: data.body || "",
    // Même étiquette que la notification de l'app ouverte : jamais deux fois.
    tag: data.tag || undefined,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { board: data.board || null, block: data.block || null },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { board, block } = event.notification.data || {};
  const url = new URL("./", self.registration.scope);
  if (block) {
    url.searchParams.set("rappel", block);
    if (board) url.searchParams.set("board", board);
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows.length) {
      const w = windows[0];
      if (block) w.postMessage({ type: "reveal", board, block });
      return w.focus();
    }
    return self.clients.openWindow(url.href);
  })());
});
