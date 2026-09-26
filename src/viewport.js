/* La caméra : conversion écran ↔ monde, déplacement, zoom.

   Convention : un point du monde `p` s'affiche à l'écran en `p * scale + (x, y)`.
   Tout le canvas est rendu par une seule transformation CSS sur #world, ce qui
   laisse le compositeur du navigateur faire le travail — c'est ce qui garde le
   déplacement fluide même avec beaucoup de blocs. */

import { state, saveView, emit } from "./store.js";
import { clamp, bounds } from "./util.js";

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const GRID = 32;

let world, canvas, zoomLabel, settle;

export function initViewport() {
  world = document.getElementById("world");
  canvas = document.getElementById("canvas");
  zoomLabel = document.getElementById("zoom-level");
  apply();
}

export function apply() {
  const { x, y, scale } = state.view;
  world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  world.classList.add("is-moving");
  clearTimeout(settle);
  settle = setTimeout(() => world.classList.remove("is-moving"), 160);
  canvas.style.setProperty("--grid-size", `${GRID * scale}px`);
  canvas.style.setProperty("--grid-x", `${x}px`);
  canvas.style.setProperty("--grid-y", `${y}px`);
  if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)} %`;
  saveView();
  emit("view");
}

/** Coordonnées écran (clientX/clientY) → coordonnées monde. */
export function toWorld(cx, cy) {
  const { x, y, scale } = state.view;
  return { x: (cx - x) / scale, y: (cy - y) / scale };
}

/** Coordonnées monde → coordonnées écran. */
export function toScreen(wx, wy) {
  const { x, y, scale } = state.view;
  return { x: wx * scale + x, y: wy * scale + y };
}

export function panBy(dx, dy) {
  state.view.x += dx;
  state.view.y += dy;
  apply();
}

/** Zoom en gardant le point (cx, cy) de l'écran fixe sous le curseur. */
export function zoomAt(factor, cx, cy) {
  const prev = state.view.scale;
  const next = clamp(prev * factor, MIN_SCALE, MAX_SCALE);
  if (next === prev) return;
  state.view.x = cx - (cx - state.view.x) * (next / prev);
  state.view.y = cy - (cy - state.view.y) * (next / prev);
  state.view.scale = next;
  apply();
}

/* ---------- Zoom doux au pavé tactile ----------

   Le pincement du trackpad arrive par à-coups (des événements wheel). Plutôt
   que de les appliquer tels quels, on les accumule dans une cible, et l'échelle
   la rejoint en suivant un ressort à amortissement critique : départ en
   douceur, arrivée en douceur, sans rebond. Le calcul se fait sur le
   logarithme de l'échelle, pour que zoomer et dézoomer aient le même rythme.

   Des crans magnétiques à 50 %, 100 % et 200 % : en passant près de l'un
   d'eux, le zoom s'y arrête un instant, puis repart si on continue. Le pavé
   tactile ne peut pas vibrer depuis une page web ; le cran se sent donc à
   l'écran, avec une pulsation du niveau de zoom. */

const DETENTS = [0.5, 1, 2];
const DETENT_BAND = 0.07;  // largeur du cran, en logarithme (≈ ±7 %)
const STIFFNESS = 0.09;    // raideur du ressort, par image
const DAMPING = 2 * Math.sqrt(STIFFNESS); // amortissement critique

let raw = null;       // cible brute, somme des gestes
let anchor = null;    // point de l'écran qui reste fixe
let velocity = 0;
let frame = 0;
let lastInput = 0;
let heldAt = null;    // cran où le zoom est retenu

export function smoothZoom(factor, cx, cy) {
  raw = clamp((raw ?? state.view.scale) * factor, MIN_SCALE, MAX_SCALE);
  anchor = { cx, cy };
  lastInput = performance.now();
  if (!frame) frame = requestAnimationFrame(step);
}

/** La cible après les crans : retenue au cran si la cible brute en est proche. */
function detented() {
  const lr = Math.log(raw);
  for (const d of DETENTS) {
    if (Math.abs(lr - Math.log(d)) < DETENT_BAND) {
      if (heldAt !== d) { heldAt = d; pulse(); }
      return d;
    }
  }
  heldAt = null;
  return raw;
}

function step(now) {
  frame = 0;
  const target = Math.log(detented());
  const current = Math.log(state.view.scale);
  velocity += STIFFNESS * (target - current) - DAMPING * velocity;
  let next = current + velocity;
  const settled = Math.abs(target - next) < 0.0005 && Math.abs(velocity) < 0.0005;
  if (settled) { next = target; velocity = 0; }
  zoomAt(Math.exp(next) / state.view.scale, anchor.cx, anchor.cy);
  if (!settled) frame = requestAnimationFrame(step);
  // Geste terminé et zoom posé : le prochain geste repart de l'échelle réelle.
  else if (now - lastInput > 120) raw = null;
  else frame = requestAnimationFrame(step);
}

function pulse() {
  if (!zoomLabel) return;
  zoomLabel.classList.remove("is-detent");
  void zoomLabel.offsetWidth;
  zoomLabel.classList.add("is-detent");
}

export function zoomTo(scale) {
  zoomAt(scale / state.view.scale, innerWidth / 2, innerHeight / 2);
}

/** Amène un rectangle du monde au centre de l'écran, sans changer le zoom. */
export function centerOn(rect, { animate = true } = {}) {
  const { scale } = state.view;
  const target = {
    x: innerWidth / 2 - (rect.x + rect.w / 2) * scale,
    y: innerHeight / 2 - (rect.y + rect.h / 2) * scale,
  };
  animate ? glideTo(target.x, target.y, scale) : (Object.assign(state.view, target), apply());
}

/** Cadre tout le contenu, avec une marge. */
export function fitAll() {
  // Page chargée en arrière-plan ou dans une fenêtre pas encore dimensionnée :
  // cadrer maintenant donnerait un zoom absurde. On attend d'avoir une taille.
  if (innerWidth < 120 || innerHeight < 120) {
    addEventListener("resize", fitAll, { once: true });
    return;
  }
  const items = [...Object.values(state.doc.blocks), ...Object.values(state.doc.zones)];
  const b = bounds(items);
  if (!b) {
    Object.assign(state.view, { x: innerWidth / 2, y: innerHeight / 2, scale: 1 });
    return apply();
  }
  const pad = 80;
  const scale = clamp(
    Math.min((innerWidth - pad * 2) / b.w, (innerHeight - pad * 2) / b.h),
    MIN_SCALE,
    1
  );
  glideTo(
    innerWidth / 2 - (b.x + b.w / 2) * scale,
    innerHeight / 2 - (b.y + b.h / 2) * scale,
    scale
  );
}

/* Déplacement animé de la caméra : sans lui, une recherche qui téléporte
   fait perdre le sens de l'orientation, ce qui ruine la mémoire spatiale. */
let raf = null;

export function glideTo(x, y, scale, ms = 380) {
  cancelAnimationFrame(raf);
  const from = { ...state.view };
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const k = ease(t);
    state.view.x = from.x + (x - from.x) * k;
    state.view.y = from.y + (y - from.y) * k;
    state.view.scale = from.scale + (scale - from.scale) * k;
    apply();
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

/** Le centre de l'écran, en coordonnées monde — où déposer un nouveau bloc. */
export function viewCenter() {
  return toWorld(innerWidth / 2, innerHeight / 2);
}

export { MIN_SCALE, MAX_SCALE, GRID };
