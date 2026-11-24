/* Texte riche des notes : un HTML réduit et nettoyé (titres, gras, italique,
   souligné, barré, surligné, listes). Tout le reste est retiré. */

const BALISES = new Set(["H1", "H2", "P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "MARK", "UL", "OL", "LI", "SPAN"]);

export function echapper(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Une note d’avant le texte riche (texte brut) devient du HTML. */
export function versHtml(contenu: string) {
  if (!contenu) return "";
  if (/<[a-z][\s\S]*>/i.test(contenu)) return contenu;
  return contenu
    .split("\n")
    .map((l) => `<p>${echapper(l) || "<br>"}</p>`)
    .join("");
}

export function nettoyer(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const racine = doc.body.firstElementChild!;
  const parcourir = (el: Element) => {
    for (const enfant of [...el.children]) {
      parcourir(enfant);
      // Mises en forme écrites en style par le navigateur → balises simples.
      if (enfant instanceof HTMLElement && enfant.tagName === "SPAN") {
        const st = enfant.style;
        let el: Element = enfant;
        const envelopper = (balise: string) => {
          const n = el.ownerDocument.createElement(balise);
          el.replaceWith(n);
          n.append(el);
          return n;
        };
        if (/bold|[6-9]00/.test(st.fontWeight)) envelopper("b");
        if (st.fontStyle === "italic") envelopper("i");
        if (/underline/.test(st.textDecoration || st.textDecorationLine)) envelopper("u");
        if (/line-through/.test(st.textDecoration || st.textDecorationLine)) envelopper("s");
        if (st.backgroundColor) envelopper("mark");
        el = enfant;
      }
      if (!BALISES.has(enfant.tagName)) {
        enfant.replaceWith(...enfant.childNodes);
        continue;
      }
      // Seul l’état « replié » d’un titre est gardé comme attribut.
      for (const a of [...enfant.attributes]) if (a.name !== "data-replie") enfant.removeAttribute(a.name);
      if (enfant.tagName === "STRONG") renommer(enfant, "b");
      else if (enfant.tagName === "EM") renommer(enfant, "i");
      else if (enfant.tagName === "STRIKE") renommer(enfant, "s");
    }
  };
  parcourir(racine);
  return racine.innerHTML.replace(/(<(p|div)>(<br>)?<\/(p|div)>)+$/, "").trim();
}

function renommer(el: Element, balise: string) {
  const nouveau = el.ownerDocument.createElement(balise);
  nouveau.append(...el.childNodes);
  el.replaceWith(nouveau);
}

/** Texte brut (recherche, titre d’une tâche créée depuis une note). */
export function texteBrut(html: string) {
  const doc = new DOMParser().parseFromString(versHtml(html), "text/html");
  return (doc.body.innerText || doc.body.textContent || "").trim();
}
