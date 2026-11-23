/* Géométrie du board, reprise du prototype ctrl.mind.
   Convention : un point du monde p s’affiche à l’écran en p × zoom + (x, y). */

import type { VueBoard } from "@/types";

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
export const PAS_GRILLE = 24;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function versMonde(vue: VueBoard, ex: number, ey: number) {
  return { x: (ex - vue.x) / vue.zoom, y: (ey - vue.y) / vue.zoom };
}

/** Zoom en gardant fixe le point (ex, ey) de l’écran. */
export function zoomerAutour(vue: VueBoard, facteur: number, ex: number, ey: number): VueBoard {
  const zoom = borner(vue.zoom * facteur, ZOOM_MIN, ZOOM_MAX);
  if (zoom === vue.zoom) return vue;
  return { x: ex - (ex - vue.x) * (zoom / vue.zoom), y: ey - (ey - vue.y) * (zoom / vue.zoom), zoom };
}

/** Vue qui fait tenir tous les rectangles dans l’écran (largeur × hauteur). */
export function toutVoir(rects: Rect[], largeur: number, hauteur: number): VueBoard {
  if (rects.length === 0) return { x: largeur / 2, y: hauteur / 2, zoom: 1 };
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  const marge = 96;
  const zoom = borner(Math.min((largeur - marge * 2) / (x2 - x1 || 1), (hauteur - marge * 2) / (y2 - y1 || 1)), ZOOM_MIN, 1);
  return { zoom, x: (largeur - (x2 - x1) * zoom) / 2 - x1 * zoom, y: (hauteur - (y2 - y1) * zoom) / 2 - y1 * zoom };
}

/* Courbe entre deux blocs : on part du bord le plus proche plutôt que du
   centre, pour que le trait ne traverse jamais les blocs qu’il relie. */
export function courbe(a: Rect, b: Rect): string {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const p1 = pointDeBord(a, ac, bc);
  const p2 = pointDeBord(b, bc, ac);
  const dx = Math.abs(p2.x - p1.x) * 0.4;
  const sx = p2.x >= p1.x ? 1 : -1;
  return `M ${p1.x} ${p1.y} C ${p1.x + dx * sx} ${p1.y}, ${p2.x - dx * sx} ${p2.y}, ${p2.x} ${p2.y}`;
}

export function courbeVersPoint(a: Rect, p: { x: number; y: number }) {
  return courbe(a, { x: p.x, y: p.y, w: 0, h: 0 });
}

function pointDeBord(r: Rect, depuis: { x: number; y: number }, vers: { x: number; y: number }) {
  const dx = vers.x - depuis.x;
  const dy = vers.y - depuis.y;
  if (!dx && !dy) return depuis;
  const hw = r.w / 2;
  const hh = r.h / 2;
  const t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  return { x: depuis.x + dx * t, y: depuis.y + dy * t };
}

export function contient(zone: Rect, r: Rect) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return cx > zone.x && cx < zone.x + zone.w && cy > zone.y && cy < zone.y + zone.h;
}
