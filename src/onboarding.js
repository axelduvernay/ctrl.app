/* La carte d'arrivée.

   À la toute première visite, une seule carte au centre, sur le board
   flouté : un champ e-mail, et « Continuer en tant qu'invité » en petit
   dessous. Rien d'autre.

   Dès qu'une adresse plausible est tapée, un bouton glisse dans le champ.
   À l'envoi, le champ se transforme en cases pour le code reçu par e-mail ;
   la dernière case remplie valide toute seule. La même carte sert ensuite à
   se connecter depuis le menu. */

import { el, icon } from "./util.js";
import { sendLoginEmail, verifyCode, syncAvailable, syncUser, openAsGuest } from "./sync.js";
import { toast } from "./main.js";

const SEEN = "ctrl-onboarded";
const CODE_LENGTH = 6;
const ARROW = '<path d="M5 12h14M13 6l6 6-6 6"/>';
const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

let overlay = null;

/** Première visite, pas connecté : la carte. Un lien de partage ouvert sans
    être connecté : la carte aussi, qui dit qui partage quoi. */
export function maybeOnboard(link) {
  if (syncUser() || !syncAvailable()) return;
  if (link) return showLogin({ firstVisit: true, link });
  let seen = null;
  try { seen = localStorage.getItem(SEEN); } catch {}
  if (seen) return;
  showLogin({ firstVisit: true });
}

function remember(value) {
  try { localStorage.setItem(SEEN, value); } catch {}
}

export function showLogin({ firstVisit = false, link = null } = {}) {
  if (overlay) return;
  let email = "";
  // Lien « peut modifier » : il faut un compte. Lien de lecture : au choix.
  const guestAllowed = !link || link.role === "viewer";

  const field = el("input", {
    type: "email", class: "ob-email", placeholder: "Ton e-mail",
    autocomplete: "email", inputmode: "email", "aria-label": "Adresse e-mail",
  });
  const go = el("button", { type: "submit", class: "ob-go", "aria-label": "Recevoir le code", tabindex: "-1" }, icon(ARROW, 18));
  const form = el("form", { class: "ob-field" }, field, go);
  const cells = el("div", { class: "ob-code", role: "group", "aria-label": "Code reçu par e-mail" });
  const note = el("p", { class: "ob-note" });
  const guest = el("button", {
    type: "button", class: "ob-guest",
    text: !firstVisit ? "Fermer" : guestAllowed ? "Continuer en tant qu'invité" : "Plus tard",
  });

  // Ouvert par un lien : qui partage, quoi, et ce qu'on pourra en faire.
  const invite = link ? el("div", { class: "ob-invite" },
    el("div", { class: "ob-from", text: link.owner_email ? `${link.owner_email} te partage` : "On te partage" }),
    el("div", { class: "ob-what", text: link.zone_name ? `la zone « ${link.zone_name} »` : `« ${link.name} »` }),
    el("div", { class: "ob-role", text: link.role === "editor" ? "Tu pourras le modifier : connecte-toi avec ton e-mail." : "En lecture seule." })) : null;

  const card = el("div", { class: "ob-card", "data-step": "email" },
    el("div", { class: "ob-mark" }, logo()),
    invite,
    note,
    el("div", { class: "ob-stage" }, form, cells),
    guest);
  overlay = el("div", { class: "onboard", role: "dialog", "aria-modal": "true", "aria-label": "Connexion" }, card);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  setTimeout(() => field.focus(), 350);

  // Une adresse plausible : le bouton glisse dans le champ.
  field.addEventListener("input", () => {
    const ok = looksLikeEmail(field.value);
    card.classList.toggle("has-email", ok);
    go.tabIndex = ok ? 0 : -1;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!looksLikeEmail(field.value) || card.classList.contains("is-busy")) return;
    email = field.value.trim();
    card.classList.add("is-busy");
    try {
      await sendLoginEmail(email);
      toCode();
    } catch (err) {
      shake();
      toast(/rate|limit|seconds/i.test(err.message) ? "Trop d'envois, réessaie dans quelques minutes" : "Envoi impossible : " + err.message);
    } finally {
      card.classList.remove("is-busy");
    }
  });

  guest.addEventListener("click", () => {
    if (link && guestAllowed) openAsGuest(link.token);
    else if (firstVisit && !link) remember("guest");
    close();
  });

  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !firstVisit) close();
    e.stopPropagation(); // les raccourcis du board restent muets derrière la carte
  });

  /* Le champ e-mail se replie et les cases du code se déplient à sa place,
     une à une. */
  function toCode(length = CODE_LENGTH) {
    note.replaceChildren(
      el("span", { text: `Code envoyé à ${email}` }),
      el("button", { type: "button", class: "ob-edit", text: "modifier", onclick: toEmail }));
    cells.replaceChildren(...Array.from({ length }, (_, i) => {
      const c = el("input", {
        class: "ob-cell", inputmode: "numeric", autocomplete: i ? "off" : "one-time-code",
        maxlength: "1", "aria-label": `Chiffre ${i + 1}`, style: `--i:${i}`,
      });
      c.addEventListener("input", () => onDigit(c, i));
      c.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !c.value && i) cellAt(i - 1).focus();
      });
      c.addEventListener("paste", onPaste);
      return c;
    }));
    card.dataset.step = "code";
    setTimeout(() => cellAt(0).focus(), 380);
  }

  function toEmail() {
    card.dataset.step = "email";
    note.replaceChildren();
    setTimeout(() => field.focus(), 300);
  }

  const cellAt = (i) => cells.children[i];
  const code = () => [...cells.children].map((c) => c.value).join("");

  function onDigit(c, i) {
    const digits = c.value.replace(/\D/g, "");
    // Le remplissage automatique d'iOS colle tout le code dans la première case.
    if (digits.length > 1) return fill(digits);
    c.value = digits;
    if (digits && i < cells.children.length - 1) cellAt(i + 1).focus();
    if (code().length === cells.children.length) submit();
  }

  function onPaste(e) {
    const digits = (e.clipboardData?.getData("text") || "").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    fill(digits);
  }

  function fill(digits) {
    if (digits.length > cells.children.length) toCode(digits.length);
    [...cells.children].forEach((c, i) => { c.value = digits[i] || ""; });
    cellAt(Math.min(digits.length, cells.children.length) - 1)?.focus();
    if (code().length === cells.children.length) submit();
  }

  async function submit() {
    card.classList.add("is-busy");
    try {
      await verifyCode(email, code());
      remember("user");
      card.classList.add("is-done");
      setTimeout(close, 650);
    } catch {
      shake();
      [...cells.children].forEach((c) => { c.value = ""; });
      cellAt(0).focus();
      toast("Code incorrect ou expiré");
    } finally {
      card.classList.remove("is-busy");
    }
  }

  function shake() {
    card.classList.remove("is-shaking");
    void card.offsetWidth;
    card.classList.add("is-shaking");
  }

  function close() {
    overlay?.classList.remove("is-open");
    overlay?.classList.add("is-closing");
    const o = overlay;
    overlay = null;
    setTimeout(() => o?.remove(), 450);
  }
}

function logo() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 512 512");
  svg.innerHTML = '<rect width="512" height="512" rx="112" fill="#141415"/><rect x="96" y="96" width="320" height="320" rx="72" fill="none" stroke="#E06D3B" stroke-width="28"/><path d="M176 288l80-80 80 80" fill="none" stroke="#F4F0EA" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}
