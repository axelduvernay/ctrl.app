/* Lissage du tracé à main levée, repris du prototype ctrl.mind : un trait
   capturé brut tremble. Quatre étapes : filtrer les points trop proches,
   moyenne glissante pondérée, simplification de Ramer-Douglas-Peucker, puis
   courbe de Catmull-Rom convertie en Béziers. On garde une courbe, nette à
   tous les zooms et légère. */

export interface Point {
  x: number;
  y: number;
}

function filtrer(points: Point[], min = 2): Point[] {
  const r: Point[] = [];
  for (const p of points) {
    const d = r[r.length - 1];
    if (!d || Math.hypot(p.x - d.x, p.y - d.y) >= min) r.push(p);
  }
  return r;
}

function lisser(points: Point[]): Point[] {
  if (points.length < 3) return points;
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const a = points[i - 1]!;
    const b = points[i + 1]!;
    return { x: (a.x + 2 * p.x + b.x) / 4, y: (a.y + 2 * p.y + b.y) / 4 };
  });
}

function distanceSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  if (!l) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function simplifier(points: Point[], tolerance = 1.2): Point[] {
  if (points.length < 3) return points;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceSegment(points[i]!, points[0]!, points[points.length - 1]!);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= tolerance) return [points[0]!, points[points.length - 1]!];
  return [...simplifier(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplifier(points.slice(index), tolerance)];
}

function courbe(points: Point[]): string {
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y} l 0.01 0`;
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Points bruts (monde) → bloc dessin : position, taille et tracé relatif. */
export function vectoriser(bruts: Point[], zoom: number) {
  const points = simplifier(lisser(filtrer(bruts, 2 / zoom)), 1.2 / zoom);
  const marge = 4;
  const x1 = Math.min(...points.map((p) => p.x)) - marge;
  const y1 = Math.min(...points.map((p) => p.y)) - marge;
  const x2 = Math.max(...points.map((p) => p.x)) + marge;
  const y2 = Math.max(...points.map((p) => p.y)) + marge;
  const w = Math.max(8, x2 - x1);
  const h = Math.max(8, y2 - y1);
  return { x: x1, y: y1, w, h, d: courbe(points.map((p) => ({ x: p.x - x1, y: p.y - y1 }))) };
}
