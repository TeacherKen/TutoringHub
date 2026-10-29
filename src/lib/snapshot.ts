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
  // Mark inner scroll boxes (e.g. a scrolling game board) before cleaning, while both trees still match.
  const orig = doc.documentElement.querySelectorAll("*");
  const copy = clone.querySelectorAll("*");
  orig.forEach((el, i) => {
    if ((el.scrollTop > 0 || el.scrollLeft > 0) && copy[i]) {
      copy[i].setAttribute("data-th-scroll", `${Math.round(el.scrollLeft)}:${Math.round(el.scrollTop)}`);
    }
  });
  clean(clone);
  let head = clone.querySelector("head");
  if (!head) {
    head = doc.createElement("head");
    clone.prepend(head);
  }
  const base = doc.createElement("base");
  base.setAttribute("href", baseHref);
  head.prepend(base);
  // Remember what part of the page the student can see, so the tutor sees the same view.
  const win = doc.defaultView;
  clone.setAttribute("data-scroll-x", String(Math.round(win?.scrollX ?? 0)));
  clone.setAttribute("data-scroll-y", String(Math.round(win?.scrollY ?? 0)));
  clone.setAttribute("data-vw", String(Math.round(win?.innerWidth ?? 1024)));
  clone.setAttribute("data-vh", String(Math.round(win?.innerHeight ?? 700)));
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
  const w = Math.round(el.getBoundingClientRect().width) + 32;
  const h = Math.round(el.getBoundingClientRect().height) + 32;
  return `<!doctype html><html class="${htmlClass}" data-vw="${w}" data-vh="${h}"><head><base href="${location.origin}/">${styles}${inline}</head><body style="padding:16px">${clone.outerHTML}</body></html>`;
}
