/* Interactions au pointeur : déplacement de la caméra, sélection, glisser,
   redimensionnement, création.

   Tout passe par un seul jeu d'écouteurs sur #canvas avec capture du pointeur :
   une fois un geste commencé, il se termine proprement même si le curseur sort
   de la fenêtre. */

import { state, begin, commit, mutate, addBlock, addZone, addLink, linkBetween, raise, item, emit,
         childrenOf, adopt, zoneAt } from "./store.js";
import { toWorld, panBy, zoomAt, viewCenter } from "./viewport.js";
import { render, nodeFor, curveTo } from "./render.js";
import { moveItem, indexAt, renameItem } from "./lists.js";
import { toast } from "./main.js";
import { startEditing } from "./editor.js";
import { openContextMenu } from "./menus.js";
import { scheduleArchive, cancelArchive, unarchive } from "./archive.js";
import { openProps } from "./props.js";
import { contains, overlaps } from "./util.js";
import { addPoint, previewPath, finishPath, pathBounds, translatePoints } from "./draw.js";

let canvas, marquee, ink;
let gesture = null;
let spaceHeld = false;

/* Registre des pointeurs actifs : deux doigts simultanés déclenchent le
   pincement, qui prend le pas sur le geste en cours. Indispensable sur iPhone,
   où il n'existe pas de molette. */
const pointers = new Map();
let pinch = null;

export function initInteract() {
  canvas = document.getElementById("canvas");
  marquee = document.getElementById("marquee");
  ink = document.getElementById("ink");

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("dblclick", onDoubleClick);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("click", onClick);

  addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isTyping(e.target)) { spaceHeld = true; canvas.classList.add("is-panning"); }
  });
  addEventListener("keyup", (e) => {
    if (e.code === "Space") { spaceHeld = false; canvas.classList.remove("is-panning"); }
  });
  addEventListener("blur", () => { spaceHeld = false; canvas.classList.remove("is-panning"); });
}

const isTyping = (node) => node && (node.isContentEditable || node.tagName === "INPUT" || node.tagName === "TEXTAREA");

/* ---------- Molette : déplacement et zoom ---------- */

function onWheel(e) {
  e.preventDefault();
  // Le pincement du trackpad arrive comme un wheel + ctrlKey.
  if (e.ctrlKey || e.metaKey) {
    zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
  } else {
    panBy(-e.deltaX, -e.deltaY);
  }
}

/* ---------- Début de geste ---------- */

function onPointerDown(e) {
  if (e.button === 2) return; // clic droit : traité par contextmenu
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) return startPinch();
  if (pointers.size > 2) return;

  const target = e.target;

  // Case à cocher, champ de date ou de rappel : action immédiate, pas un glisser.
  if (target.closest("[data-check]") || target.closest("[data-prop]") || target.closest("[data-action]")) return;
  // Nom de zone en cours d'édition : laisser le curseur texte travailler.
  if (isTyping(target)) return;

  canvas.setPointerCapture(e.pointerId);
  const world = toWorld(e.clientX, e.clientY);

  // Déplacement de la caméra : espace enfoncé, bouton du milieu, ou deux doigts.
  if (spaceHeld || e.button === 1) {
    gesture = { mode: "pan", sx: e.clientX, sy: e.clientY };
    canvas.classList.add("is-panning");
    return;
  }

  if (state.tool === "draw") {
    gesture = { mode: "draw", points: [{ x: world.x, y: world.y }] };
    drawPreview(gesture.points);
    return;
  }

  // Un trait de liaison : on le sélectionne, Suppr l'efface.
  const linkHit = target.closest("[data-link]");
  if (linkHit) {
    const id = linkHit.dataset.link;
    if (!(e.shiftKey || e.metaKey || e.ctrlKey)) state.selection.clear();
    state.selection.add(id);
    emit("selection");
    render();
    return;
  }

  // Poignée de connexion : on tire un lien vers un autre bloc.
  const connect = target.closest("[data-connect]");
  if (connect) {
    const from = connect.closest("[data-id]").dataset.id;
    gesture = { mode: "connect", from };
    drawLinkPreview(from, world);
    return;
  }

  // Poignée d'un élément de liste : on le fait glisser à un autre rang.
  const grip = target.closest("[data-item-grip]");
  if (grip) {
    const id = grip.closest("[data-id]").dataset.id;
    begin();
    gesture = { mode: "reorder", id, item: grip.closest("[data-item]").dataset.item };
    nodeFor(id)?.classList.add("is-reordering");
    return;
  }

  const resizeHandle = target.closest("[data-resize]");
  if (resizeHandle) {
    const node = resizeHandle.closest("[data-id]");
    const it = item(node.dataset.id);
    if (it) {
      begin();
      gesture = { mode: "resize", id: it.id, ox: world.x, oy: world.y, w0: it.w, h0: it.h };
    }
    return;
  }

  const node = target.closest("[data-id]");

  if (node) {
    const id = node.dataset.id;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    // Un clic sur un bloc déjà seul sélectionné, ou sur un nom de zone, vaut
    // « modifier ». On le note maintenant, avant que la sélection ne change.
    const wasSoleSelection = state.selection.size === 1 && state.selection.has(id);
    const onZoneName = !!target.closest("[data-zone-name]");

    if (additive) {
      state.selection.has(id) ? state.selection.delete(id) : state.selection.add(id);
    } else if (!state.selection.has(id)) {
      state.selection.clear();
      state.selection.add(id);
    }

    if (state.doc.blocks[id]) raise(id);
    emit("selection");
    render();

    begin();
    gesture = {
      mode: "drag",
      ox: world.x,
      oy: world.y,
      moved: false,
      id,
      additive,
      // Une zone ne se renomme que par son nom : cliquer dans son fond sert à
      // la sélectionner, et le double-clic y crée un bloc.
      editOnRelease: !additive && (onZoneName || (wasSoleSelection && !state.doc.zones[id])),
      at: { x: e.clientX, y: e.clientY },
      items: dragSet(),
    };
    return;
  }

  // Sur le vide.
  if (state.tool === "zone") {
    begin();
    const zone = addZone({ x: world.x, y: world.y, w: 0, h: 0 });
    gesture = { mode: "draw-zone", id: zone.id, ox: world.x, oy: world.y };
    render();
    return;
  }

  if (!e.shiftKey) {
    state.selection.clear();
    emit("selection");
    render();
  }

  // Au doigt, un glissé sur le vide déplace la vue : le lasso à un doigt sur
  // un petit écran est plus souvent une fausse manipulation qu'une intention.
  if (e.pointerType === "touch") {
    gesture = { mode: "pan", sx: e.clientX, sy: e.clientY };
    return;
  }

  gesture = { mode: "marquee", sx: e.clientX, sy: e.clientY, ox: world.x, oy: world.y, base: new Set(state.selection) };
}

/** Ce qui suit le glisser : la sélection, plus le contenu des zones sélectionnées. */
function dragSet() {
  const ids = new Set(state.selection);
  for (const id of state.selection) {
    const zone = state.doc.zones[id];
    if (!zone) continue;
    for (const b of childrenOf(id)) ids.add(b.id);
  }
  return [...ids].map((id) => {
    const it = item(id);
    return it ? { id, x0: it.x, y0: it.y } : null;
  }).filter(Boolean);
}

/* ---------- Déroulement ---------- */

function onPointerMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) return movePinch();
  if (!gesture) return;
  const world = toWorld(e.clientX, e.clientY);

  if (gesture.mode === "pan") {
    panBy(e.clientX - gesture.sx, e.clientY - gesture.sy);
    gesture.sx = e.clientX;
    gesture.sy = e.clientY;
    return;
  }

  if (gesture.mode === "drag") {
    const dx = world.x - gesture.ox;
    const dy = world.y - gesture.oy;
    if (!gesture.moved && Math.hypot(dx, dy) < 3 / state.view.scale) return;
    gesture.moved = true;
    for (const { id, x0, y0 } of gesture.items) {
      const it = item(id);
      if (!it) continue;
      it.x = Math.round(x0 + dx);
      it.y = Math.round(y0 + dy);
    }
    render();
    showDropZone(gesture.id);
    return;
  }

  if (gesture.mode === "connect") {
    drawLinkPreview(gesture.from, world);
    return;
  }

  if (gesture.mode === "reorder") {
    if (moveItem(gesture.id, gesture.item, indexAt(gesture.id, e.clientY))) render();
    return;
  }

  if (gesture.mode === "resize") {
    const it = item(gesture.id);
    if (!it) return;
    let w = Math.max(80, gesture.w0 + world.x - gesture.ox);
    let h = Math.max(48, gesture.h0 + world.y - gesture.oy);
    // Maj enfoncée : les proportions de départ sont gardées. On suit l'axe où
    // le pointeur est allé le plus loin, l'autre s'en déduit.
    if (e.shiftKey && gesture.w0 && gesture.h0) {
      const ratio = gesture.w0 / gesture.h0;
      if (w / gesture.w0 >= h / gesture.h0) h = w / ratio;
      else w = h * ratio;
      if (h < 48) { h = 48; w = h * ratio; }
      if (w < 80) { w = 80; h = w / ratio; }
    }
    it.w = Math.round(w);
    it.h = Math.round(h);
    render();
    return;
  }

  if (gesture.mode === "draw-zone") {
    const z = state.doc.zones[gesture.id];
    if (!z) return;
    z.x = Math.min(gesture.ox, world.x);
    z.y = Math.min(gesture.oy, world.y);
    z.w = Math.abs(world.x - gesture.ox);
    z.h = Math.abs(world.y - gesture.oy);
    render();
    return;
  }

  if (gesture.mode === "draw") {
    if (addPoint(gesture.points, world.x, world.y)) drawPreview(gesture.points);
    return;
  }

  if (gesture.mode === "marquee") {
    const rect = {
      left: Math.min(gesture.sx, e.clientX),
      top: Math.min(gesture.sy, e.clientY),
      width: Math.abs(e.clientX - gesture.sx),
      height: Math.abs(e.clientY - gesture.sy),
    };
    Object.assign(marquee.style, {
      left: rect.left + "px", top: rect.top + "px",
      width: rect.width + "px", height: rect.height + "px",
    });
    marquee.hidden = false;

    const box = {
      x: Math.min(gesture.ox, world.x),
      y: Math.min(gesture.oy, world.y),
      w: Math.abs(world.x - gesture.ox),
      h: Math.abs(world.y - gesture.oy),
    };
    state.selection.clear();
    for (const id of gesture.base) state.selection.add(id);
    for (const b of Object.values(state.doc.blocks)) if (overlaps(box, b)) state.selection.add(b.id);
    for (const z of Object.values(state.doc.zones)) if (overlaps(box, z)) state.selection.add(z.id);
    emit("selection");
    render();
  }
}

/* ---------- Fin de geste ---------- */

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (pinch && pointers.size < 2) {
    pinch = null;
    return;
  }
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  canvas.releasePointerCapture?.(e.pointerId);
  canvas.classList.remove("is-panning");
  marquee.hidden = true;

  if (g.mode === "draw") {
    ink.replaceChildren();
    commitStroke(g.points);
  } else if (g.mode === "connect") {
    ink.replaceChildren();
    finishConnect(g.from, e);
  } else if (g.mode === "reorder") {
    nodeFor(g.id)?.classList.remove("is-reordering");
    commit();
  } else if (g.mode === "drag") {
    if (g.moved) settleInZones(g.items);
    commit();
    // Relâché sans avoir bougé : c'était un clic, pas un glisser.
    if (!g.moved && g.editOnRelease) editItem(g.id, g.at);
  } else if (g.mode === "resize") {
    commit();
  } else if (g.mode === "draw-zone") {
    const z = state.doc.zones[g.id];
    if (z && (z.w < 40 || z.h < 40)) {
      // Un simple clic avec l'outil zone : une zone de taille confortable.
      z.w = 420; z.h = 300;
      z.x = g.ox; z.y = g.oy;
    }
    // Une zone tracée autour de blocs libres les prend avec elle.
    if (z) {
      for (const b of Object.values(state.doc.blocks)) {
        if (!b.zone && !b.archived && contains(z, b)) b.zone = z.id;
      }
    }
    commit();
    state.tool = "select";
    emit("tool");
    state.selection.clear();
    state.selection.add(g.id);
    render();
    const node = nodeFor(g.id);
    if (node) startEditing(g.id, node.querySelector(".zone-name"));
  }
  if (spaceHeld) canvas.classList.add("is-panning");
}

/* ---------- Tracé ---------- */

const STROKE = 3;

/* L'aperçu vit dans un calque à part, en dehors du document : on ne veut ni
   historique ni sauvegarde pour un trait qui n'est pas encore terminé. */
function drawPreview(points) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", previewPath(points));
  path.setAttribute("stroke-width", STROKE);
  ink.replaceChildren(path);
}

/** Transforme le tracé terminé en bloc : courbe lissée, repère local. */
function commitStroke(points) {
  if (!points.length) return;

  const box = pathBounds(points, STROKE);
  // Un trait doit mesurer quelque chose : un clic sec ne laisse rien.
  if (points.length < 2 && box.w < 8) return;

  const local = translatePoints(points, box.x, box.y);
  const block = mutate(() =>
    addBlock({
      kind: "draw",
      x: Math.round(box.x),
      y: Math.round(box.y),
      w: Math.round(box.w),
      h: Math.round(box.h),
      path: finishPath(local),
      viewW: Math.round(box.w),
      viewH: Math.round(box.h),
      stroke: STROKE,
    })
  );

  state.selection.clear();
  emit("selection");
  render();
  return block;
}

/* ---------- Entrer et sortir d'une zone ---------- */

/* Un bloc lâché dans une zone en devient l'enfant ; lâché dehors, il redevient
   libre. Les enfants d'une zone qu'on déplace avec elle ne changent rien. */
function settleInZones(items) {
  showDropZone(null);
  const moved = new Set(items.map((it) => it.id));
  for (const { id } of items) {
    const b = state.doc.blocks[id];
    if (!b || (b.zone && moved.has(b.zone))) continue;
    adopt(b);
  }
}

/* Pendant le glisser, la zone qui va recevoir le bloc s'éclaire. */
let dropZone = null;
function showDropZone(id) {
  const b = id && state.doc.blocks[id];
  const z = b && !(b.zone && state.selection.has(b.zone)) ? zoneAt(b.x + b.w / 2, b.y + Math.min(b.h, 60) / 2) : null;
  const next = z ? z.id : null;
  if (next === dropZone) return;
  if (dropZone) nodeFor(dropZone)?.classList.remove("is-target");
  if (next) nodeFor(next)?.classList.add("is-target");
  dropZone = next;
}

/* ---------- Connexion ---------- */

function drawLinkPreview(from, world) {
  const a = state.doc.blocks[from];
  if (!a) return;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", curveTo(a, world));
  path.setAttribute("class", "link-preview");
  ink.replaceChildren(path);
}

/* Relâché sur un bloc : on les relie, ou on défait le lien s'il existait.
   Relâché dans le vide : un nouveau bloc naît au bout du lien, prêt à écrire —
   c'est la façon la plus rapide de dérouler une idée. */
function finishConnect(from, e) {
  const node = hitTarget(e).closest("[data-id]");
  const to = node && state.doc.blocks[node.dataset.id] ? node.dataset.id : null;
  if (to === from) return;

  if (to) {
    const existing = linkBetween(from, to);
    mutate(() => existing ? delete state.doc.links[existing.id] : addLink(from, to));
    render();
    toast(existing ? "Lien retiré" : "Blocs reliés");
    return;
  }

  const world = toWorld(e.clientX, e.clientY);
  if (node) return; // relâché sur une zone : on ne crée rien
  const block = createBlockAt(world.x + 110, world.y + 24);
  // Le lien rejoint la transaction ouverte par l'édition du nouveau bloc :
  // si le bloc reste vide, il disparaît avec son lien.
  addLink(from, block.id);
  render();
}

/* ---------- Pincement à deux doigts ---------- */

function startPinch() {
  // Un geste à un doigt était peut-être commencé : on l'abandonne proprement.
  if (gesture) {
    if (["drag", "resize", "draw-zone", "reorder"].includes(gesture.mode)) commit();
    if (gesture.mode === "connect" || gesture.mode === "draw") ink.replaceChildren();
    gesture = null;
    marquee.hidden = true;
  }
  pinch = measurePinch();
}

function movePinch() {
  const now = measurePinch();
  if (!pinch || !now || !pinch.distance) return;
  zoomAt(now.distance / pinch.distance, now.cx, now.cy);
  panBy(now.cx - pinch.cx, now.cy - pinch.cy);
  pinch = now;
}

function measurePinch() {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return null;
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  };
}

/* ---------- Clic, double-clic, clic droit ---------- */

function onClick(e) {
  const check = hitTarget(e).closest("[data-check]");
  if (check) {
    const id = check.closest("[data-id]").dataset.id;
    let done = false;
    mutate(() => {
      const b = state.doc.blocks[id];
      if (!b) return;
      b.done = !b.done;
      b.updatedAt = Date.now();
      done = b.done;
    });
    render();
    done ? scheduleArchive(id) : (cancelArchive(id), unarchive(id));
    return;
  }

  const prop = hitTarget(e).closest("[data-prop]");
  if (prop) {
    const id = prop.closest("[data-id]").dataset.id;
    state.selection.clear();
    state.selection.add(id);
    emit("selection");
    render();
    openProps(id);
    return;
  }

  // Ouvrir un lien : clic simple sur un bloc lien déjà sélectionné.
  const node = e.target.closest("[data-id]");
  if (node && !e.defaultPrevented) {
    const b = state.doc.blocks[node.dataset.id];
    if (b && b.kind === "link" && e.detail === 1 && state.selection.has(b.id) && state.selection.size === 1) {
      // Volontairement inerte au premier clic : on ouvre au double-clic,
      // pour ne pas quitter le board par accident en sélectionnant.
    }
  }
}

/* Pendant un geste, le pointeur est capturé par #canvas ; le navigateur
   attribue alors le clic et le double-clic au canvas, pas au bloc visé.
   On retrouve donc l'élément réellement sous le curseur. */
function hitTarget(e) {
  return document.elementFromPoint(e.clientX, e.clientY) || e.target;
}

/** Passe un bloc texte ou un nom de zone en édition, curseur au point cliqué. */
function editItem(id, at) {
  const node = nodeFor(id);
  if (!node) return false;
  if (state.doc.zones[id]) {
    startEditing(id, node.querySelector(".zone-name"), at);
    return true;
  }
  const b = state.doc.blocks[id];
  if (b && b.kind === "text") {
    startEditing(id, node.querySelector(".body"), at);
    return true;
  }
  if (b && b.kind === "list") {
    startEditing(id, node.querySelector(".list-title"), at);
    return true;
  }
  return false;
}

function onDoubleClick(e) {
  const node = hitTarget(e).closest("[data-id]");

  // Double-clic dans le fond d'une zone : un bloc naît dedans, comme sur le board.
  if (node && state.doc.zones[node.dataset.id] && !hitTarget(e).closest("[data-zone-name]")) {
    const world = toWorld(e.clientX, e.clientY);
    return createBlockAt(world.x, world.y);
  }

  if (node) {
    const id = node.dataset.id;
    const b = state.doc.blocks[id];
    // Dans une liste, le double-clic renomme l'élément visé ; ailleurs, le titre.
    const itemName = hitTarget(e).closest("[data-item-name]");
    if (itemName) return renameItem(id, itemName.closest("[data-item]").dataset.item, itemName);
    if (b && b.kind === "list" && hitTarget(e).closest(".items, [data-action]")) return;
    if (editItem(id, { x: e.clientX, y: e.clientY })) return;
    if (!b) return;
    if (b.kind === "link") return window.open(b.url, "_blank", "noopener");
    if (b.kind === "file" || b.kind === "image") {
      const url = node.dataset.download || node.querySelector("img")?.src;
      if (url) window.open(url, "_blank", "noopener");
    }
    return;
  }

  const world = toWorld(e.clientX, e.clientY);
  createBlockAt(world.x, world.y);
}

function onContextMenu(e) {
  e.preventDefault();
  const linkHit = hitTarget(e).closest("[data-link]");
  if (linkHit) {
    state.selection.clear();
    state.selection.add(linkHit.dataset.link);
    emit("selection");
    render();
    return openContextMenu(e.clientX, e.clientY, { onEmpty: false, world: toWorld(e.clientX, e.clientY) });
  }
  const node = hitTarget(e).closest("[data-id]");
  if (node && !state.selection.has(node.dataset.id)) {
    state.selection.clear();
    state.selection.add(node.dataset.id);
    emit("selection");
    render();
  }
  if (!node && !state.selection.size) {
    state.selection.clear();
    render();
  }
  openContextMenu(e.clientX, e.clientY, { onEmpty: !node, world: toWorld(e.clientX, e.clientY) });
}

/* ---------- Création ---------- */

export function createBlockAt(x, y, props = {}) {
  let block;
  mutate(() => {
    block = addBlock({ x: Math.round(x - 110), y: Math.round(y - 24), ...props });
  });
  state.selection.clear();
  state.selection.add(block.id);
  state.tool = "select";
  emit("tool");
  emit("selection");
  render();
  const node = nodeFor(block.id);
  if (node && block.kind === "text") startEditing(block.id, node.querySelector(".body"));
  return block;
}

/** Crée un bloc au centre de l'écran — utilisé par le clavier. */
export function createBlockAtCenter(props = {}) {
  const c = viewCenter();
  return createBlockAt(c.x, c.y, props);
}
