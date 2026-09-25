/* Service worker : rend l'app installable et utilisable hors-ligne.

   Stratégie « réseau d'abord, cache en secours » : en développement on voit
   toujours la dernière version du code, et sans réseau l'app démarre quand même.
   Les données, elles, ne passent jamais par ici — elles vivent dans IndexedDB. */

const CACHE = "ctrl-app-v1";

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
    fetch(request)
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
