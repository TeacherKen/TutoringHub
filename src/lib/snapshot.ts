// Makes a still "picture" of part of a page as plain HTML (no scripts), so the tutor
// can see what the student sees. Form values and button states are copied in.

const DROP = "script, noscript, iframe, object, embed, canvas, video, audio, link[rel=preload], link[rel=modulepreload]";

function copyFormState(from: ParentNode, to: ParentNode) {
  const a = from.querySelectorAll("input, textarea, select");
  const b = to.querySelectorAll("input, textarea, select");
  a.forEach((el, i) => {
    const c = b[i];
    if (!c) return;
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) c.setAttribute("checked", "");
        else c.removeAttribute("checked");
      } else c.setAttribute("value", el.value);
    } else if (el instanceof HTMLTextAreaElement) {
      c.textContent = el.value;
    } else if (el instanceof HTMLSelectElement) {
      c.querySelectorAll("option").forEach((o, j) => (j === el.selectedIndex ? o.setAttribute("selected", "") : o.removeAttribute("selected")));
    }
  });
}

function clean(root: Element) {
  root.querySelectorAll(DROP).forEach((n) => n.remove());
  root.querySelectorAll("*").forEach((n) => {
    for (const attr of [...n.attributes]) {
      if (attr.name.startsWith("on")) n.removeAttribute(attr.name);
      if ((attr.name === "href" || attr.name === "src") && /^\s*javascript:/i.test(attr.value)) n.removeAttribute(attr.name);
    }
  });
}

/** Picture of a whole same-site game page shown in an iframe. */
export function snapshotDocument(doc: Document, baseHref: string): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  copyFormState(doc.documentElement, clone);
  clean(clone);
  let head = clone.querySelector("head");
  if (!head) {
    head = doc.createElement("head");
    clone.prepend(head);
  }
  const base = doc.createElement("base");
  base.setAttribute("href", baseHref);
  head.prepend(base);
  // Show the same scroll position.
  const y = doc.defaultView?.scrollY ?? 0;
  if (y) clone.setAttribute("data-scroll-y", String(Math.round(y)));
  return `<!doctype html>${clone.outerHTML}`;
}

/** Picture of one part of this page (for the built-in games), styled with this page's CSS. */
export function snapshotElement(el: Element): string {
  const clone = el.cloneNode(true) as HTMLElement;
  copyFormState(el, clone);
  clean(clone);
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((l) => `<link rel="stylesheet" href="${new URL((l as HTMLLinkElement).href, location.href).href}">`)
    .join("");
  const inline = [...document.querySelectorAll("head style")].map((st) => `<style>${st.textContent ?? ""}</style>`).join("");
  const htmlClass = document.documentElement.className.replace(/"/g, "");
  return `<!doctype html><html class="${htmlClass}"><head><base href="${location.origin}/">${styles}${inline}</head><body style="padding:16px">${clone.outerHTML}</body></html>`;
}
