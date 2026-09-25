/* Le tracé à main levée, en vectoriel.

   Un trait capturé brut tremble : la main oscille, et le pointeur échantillonne
   à intervalles irréguliers. Le trait passe donc par quatre étapes avant d'être
   gardé, et ce qu'on stocke n'est pas la suite des points mais une courbe.

     1. filtrage      — on ignore les points trop proches du précédent
     2. lissage       — moyenne glissante pondérée, qui absorbe le tremblement
     3. simplification — Ramer-Douglas-Peucker, qui retire les points inutiles
     4. ajustement    — Catmull-Rom converti en Béziers cubiques

   Le résultat est un chemin SVG, donc net à tous les zooms et redimensionnable
   sans perte. */

const MIN_DISTANCE = 1.6;   // px monde entre deux points conservés
const SMOOTH_WINDOW = 3;    // demi-largeur de la moyenne glissante
const SIMPLIFY_TOLERANCE = 0.8;
const CURVE_TENSION = 0.5;

/** Ajoute un point à un tracé en cours, s'il apporte quelque chose. */
export function addPoint(points, x, y) {
  const last = points[points.length - 1];
  if (last && Math.hypot(x - last.x, y - last.y) < MIN_DISTANCE) return false;
  points.push({ x, y });
  return true;
}

/** Aperçu pendant le geste : lissage léger seulement, pour rester réactif. */
export function previewPath(points) {
  if (points.length < 2) return dot(points[0]);
  return toCurve(smooth(points, 1));
}

/** Tracé définitif : la chaîne complète. */
export function finishPath(points) {
  if (points.length < 2) return dot(points[0]);
  const cleaned = simplify(smooth(points, SMOOTH_WINDOW), SIMPLIFY_TOLERANCE);
  return toCurve(cleaned);
}

/* Un simple point posé reste visible : sans ça, un clic sec ne laisserait rien. */
function dot(point) {
  if (!point) return "";
  const { x, y } = point;
  return `M ${r(x - 0.4)} ${r(y)} L ${r(x + 0.4)} ${r(y)}`;
}

/* ---------- 2. Lissage ---------- */

/* Moyenne glissante pondérée en triangle : les points voisins comptent moins
   que le point courant, ce qui retire l'oscillation sans écraser les angles
   volontaires. Les extrémités sont laissées intactes pour que le trait
   commence et finisse exactement là où la main l'a voulu. */
function smooth(points, window) {
  if (points.length < 3 || window < 1) return points;
  const out = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    let sx = 0, sy = 0, total = 0;
    for (let k = -window; k <= window; k++) {
      const p = points[i + k];
      if (!p) continue;
      const weight = window + 1 - Math.abs(k);
      sx += p.x * weight;
      sy += p.y * weight;
      total += weight;
    }
    out.push({ x: sx / total, y: sy / total });
  }

  out.push(points[points.length - 1]);
  return out;
}

/* ---------- 3. Simplification ---------- */

/* Ramer-Douglas-Peucker : on ne garde que les points qui s'écartent vraiment
   de la corde. Un trait de 400 points en garde typiquement 40, ce qui allège
   le document et lisse encore un peu le rendu. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const distance = perpendicular(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function perpendicular(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/* ---------- 4. Courbe ---------- */

/* Conversion Catmull-Rom → Bézier cubique. La spline passe exactement par les
   points conservés, et les tangentes sont déduites des voisins : c'est ce qui
   donne un trait continu plutôt qu'une ligne brisée. */
function toCurve(points) {
  if (points.length < 2) return dot(points[0]);
  if (points.length === 2) {
    return `M ${r(points[0].x)} ${r(points[0].y)} L ${r(points[1].x)} ${r(points[1].y)}`;
  }

  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const c1x = p1.x + ((p2.x - p0.x) / 6) * CURVE_TENSION * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * CURVE_TENSION * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * CURVE_TENSION * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * CURVE_TENSION * 2;

    d += ` C ${r(c1x)} ${r(c1y)}, ${r(c2x)} ${r(c2y)}, ${r(p2.x)} ${r(p2.y)}`;
  }

  return d;
}

const r = (n) => Math.round(n * 100) / 100;

/** Rectangle englobant d'un nuage de points, avec la marge du trait. */
export function pathBounds(points, stroke = 3) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const pad = stroke * 2 + 4;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/** Décale un chemin pour qu'il s'exprime dans le repère de son bloc. */
export function translatePoints(points, dx, dy) {
  return points.map((p) => ({ x: p.x - dx, y: p.y - dy }));
}
