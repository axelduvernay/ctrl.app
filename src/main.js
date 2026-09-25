/* Point d'entrée : chargement, câblage du chrome, raccourcis clavier. */

import { state, load, on, emit, mutate, removeItems, undo, redo } from "./store.js";
import { initViewport, fitAll, zoomAt, apply } from "./viewport.js";
import { initRender, render, nodeFor } from "./render.js";
import { initInteract, createBlockAtCenter } from "./interact.js";
import { initIO } from "./io.js";
import { initSearch, openSearch, closeSearch, isSearchOpen, toggleFilter, clearFilters } from "./search.js";
import { openMainMenu, closeMenus, applyTheme, duplicate, openArrangeMenu } from "./menus.js";
import { startEditing, stopEditing } from "./editor.js";
import { arrange } from "./arrange.js";
import { initReminders } from "./reminders.js";
import { categoryList } from "./store.js";
import { seedWelcome } from "./welcome.js";
import { overlaps } from "./util.js";
import { save } from "./store.js";

/* Affichée dans le menu : permet de vérifier qu'une mise à jour est arrivée.
   À changer à chaque livraison. */
export const VERSION = "25.09 · 10";

async function boot() {
  applyTheme();
  await load();

  initViewport();
  initRender();
  initInteract();
  initIO();
  initSearch();

  // Tout premier lancement : un board d'accueil plutôt qu'une page vide.
  const empty = !Object.keys(state.doc.blocks).length && !Object.keys(state.doc.zones).length;
  if (empty && !localStorage.getItem("ctrl-welcomed")) {
    seedWelcome();
    localStorage.setItem("ctrl-welcomed", "1");
    save();
    Object.assign(state.view, { x: innerWidth / 2, y: innerHeight / 2, scale: 1 });
    apply();
    setTimeout(fitAll, 60);
  } else if (empty) {
    Object.assign(state.view, { x: innerWidth / 2, y: innerHeight / 2, scale: 1 });
    apply();
  } else if (!anythingVisible()) {
    // Vue héritée d'un autre écran — typiquement le passage du Mac au téléphone.
    setTimeout(fitAll, 60);
  }

  wireChrome();
  wireKeyboard();
  render();
  initReminders();

  registerServiceWorker();

  // Accès de développement, utile pour inspecter ou peupler un board de test.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    window.ctrl = { state, render, arrange, fitAll, toast };
  }
}

/* Installable sur l'écran d'accueil de l'iPhone, et démarrable sans réseau. */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Sans service worker l'app fonctionne, elle perd seulement le hors-ligne.
  });
}

/** Y a-t-il au moins un élément dans le champ de vision actuel ? */
function anythingVisible() {
  const { x, y, scale } = state.view;
  const view = { x: -x / scale, y: -y / scale, w: innerWidth / scale, h: innerHeight / scale };
  const items = [...Object.values(state.doc.blocks), ...Object.values(state.doc.zones)];
  return items.some((it) => overlaps(view, it));
}

/* ---------- Chrome flottant ---------- */

function wireChrome() {
  const toolbar = document.getElementById("toolbar");

  toolbar.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.dataset.tool) {
      state.tool = button.dataset.tool;
      emit("tool");
    } else if (button.dataset.action === "arrange") {
      const rect = button.getBoundingClientRect();
      openArrangeMenu(rect.left - 20, rect.top - 150);
    }
  });

  on("tool", () => {
    for (const button of toolbar.querySelectorAll("[data-tool]")) {
      button.classList.toggle("is-active", button.dataset.tool === state.tool);
    }
    const canvas = document.getElementById("canvas");
    canvas.classList.remove("tool-zone", "tool-draw");
    if (state.tool !== "select") canvas.classList.add("tool-" + state.tool);
  });

  document.getElementById("menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openMainMenu(e.currentTarget);
  });

  document.getElementById("zoombar").addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    const action = button.dataset.zoom;
    if (action === "in") zoomAt(1.25, cx, cy);
    if (action === "out") zoomAt(0.8, cx, cy);
    if (action === "fit") fitAll();
    if (action === "reset") zoomAt(1 / state.view.scale, cx, cy);
  });

  // Un clic ailleurs referme les menus ouverts.
  addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".popup") && !e.target.closest("#menu-btn")) closeMenus();
  }, true);

  addEventListener("resize", () => render());
}

/* ---------- Clavier ---------- */

function wireKeyboard() {
  addEventListener("keydown", (e) => {
    const typing = e.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(e.target.tagName);
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault();
      return openSearch();
    }

    if (mod && e.key.toLowerCase() === "z") {
      if (typing) return;
      e.preventDefault();
      const ok = e.shiftKey ? redo() : undo();
      render();
      toast(ok ? (e.shiftKey ? "Rétabli" : "Annulé") : "Rien à annuler");
      return;
    }

    if (typing) return;

    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      for (const id of Object.keys(state.doc.blocks)) state.selection.add(id);
      for (const id of Object.keys(state.doc.zones)) state.selection.add(id);
      emit("selection");
      return render();
    }

    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (state.selection.size) duplicate([...state.selection]);
      return;
    }

    if (e.key === "Escape") {
      if (isSearchOpen()) return closeSearch();
      closeMenus();
      if (state.tool !== "select") { state.tool = "select"; return emit("tool"); }
      if (state.filters.categories.size || state.filters.done !== null) return clearFilters();
      state.selection.clear();
      emit("selection");
      return render();
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      if (!state.selection.size) return;
      e.preventDefault();
      const count = state.selection.size;
      mutate(() => removeItems([...state.selection]));
      render();
      toast(count > 1 ? `${count} éléments supprimés` : "Supprimé");
      return;
    }

    if (e.key === "Enter" && state.selection.size === 1) {
      const id = [...state.selection][0];
      const node = nodeFor(id);
      if (!node) return;
      e.preventDefault();
      const target = state.doc.zones[id] ? node.querySelector(".zone-name") : node.querySelector(".body");
      return startEditing(id, target);
    }

    // Outils
    if (e.key === "v" || e.key === "V") { state.tool = "select"; return emit("tool"); }
    if (e.key === "z" || e.key === "Z") { state.tool = "zone"; return emit("tool"); }
    if (e.key === "d" || e.key === "D") { state.tool = "draw"; return emit("tool"); }
    if (e.key === "n" || e.key === "N") { e.preventDefault(); return createBlockAtCenter(); }
    // « / » sur le canvas : un nouveau bloc, menu des commandes déjà ouvert.
    if (e.key === "/") {
      e.preventDefault();
      const block = createBlockAtCenter();
      const body = nodeFor(block.id)?.querySelector(".body");
      if (!body) return;
      body.textContent = "/";
      getSelection().collapse(body.firstChild, 1);
      body.dispatchEvent(new Event("input"));
      return;
    }
    if (e.key === "r" || e.key === "R") { e.preventDefault(); return arrange("tidy"); }

    // Filtres rapides : 1 à 4 selon l'ordre des catégories.
    const digit = Number(e.key);
    const cats = categoryList();
    if (digit >= 1 && digit <= cats.length && !e.shiftKey) {
      e.preventDefault();
      return toggleFilter(cats[digit - 1].id);
    }

    if (e.key === "!" || (e.shiftKey && e.code === "Digit1")) {
      e.preventDefault();
      return fitAll();
    }
  });
}

/* ---------- Message éphémère ---------- */

let toastTimer = null;

export function toast(message) {
  const node = document.getElementById("status");
  if (!node) return;
  node.textContent = message;
  node.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2600);
}

boot();
