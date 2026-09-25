/* Petits utilitaires partagés. */

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
    .replace(/-/g, "").slice(0, 12);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

/* Pictogrammes des champs, partagés entre le rendu des blocs et le panneau. */
export const ICON_PATHS = {
  due: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  remind: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
};

/** Icône inline : un <svg> tracé, aux réglages de la charte. */
export function icon(path, size = 18) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = path;
  return svg;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Rectangle englobant d'une liste de {x, y, w, h}. */
export function bounds(items) {
  if (!items.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items) {
    x0 = Math.min(x0, it.x);
    y0 = Math.min(y0, it.y);
    x1 = Math.max(x1, it.x + it.w);
    y1 = Math.max(y1, it.y + it.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const contains = (outer, inner) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

/* Les dates sont stockées en heure locale, en texte : « 2026-09-24 » pour un
   jour, « 2026-09-24T20:00 » pour un instant. Jamais via toISOString, qui passe
   par UTC et décale d'un jour après minuit en heure d'été. */

export function parseLocal(iso) {
  if (!iso) return null;
  return new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
}

export function localISO(date, withTime = false) {
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

const hasTime = (iso) => !!iso && iso.length > 10;

function dayLabel(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day - today) / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  if (days > 1 && days < 7) return d.toLocaleDateString("fr-FR", { weekday: "long" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** « demain », « jeudi 14:30 », « 12 oct. » — relatif quand c'est plus parlant. */
export function formatDate(iso) {
  const d = parseLocal(iso);
  if (!d || isNaN(d)) return "";
  const time = hasTime(iso) ? " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  return dayLabel(d) + time;
}

/** Échéance dans moins d'un jour, ou dépassée. */
export function isSoon(iso) {
  const d = parseLocal(iso);
  if (!d) return false;
  if (hasTime(iso)) return d - Date.now() < 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000) <= 1;
}

export const isPast = (iso) => {
  const d = parseLocal(iso);
  return !!d && d.getTime() <= Date.now();
};

/** Normalisation pour la recherche : sans accents, sans casse. */
export const fold = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
