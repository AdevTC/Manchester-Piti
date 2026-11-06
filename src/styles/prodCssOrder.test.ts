// The production build cascades CSS in another order than dev: a route's own stylesheet reaches the page BEFORE the
// shared kit stylesheets it depends on (the server-rendered <head> lists them that way, and Vite folds a shared
// CSS-only chunk into each importer's CSS after the importer's own). In dev the kit comes first. So a page rule that
// overrides a kit rule with the SAME weight wins in dev and loses in production — the Hoy carril on the phone
// (efa2cb39), the Inicio lens, the Números sheet… This guard finds those ties statically:
//
//   a page rule and a kit rule whose selectors may hit the same element (the same ancestors, the same pseudo parts,
//   and every class of both written together in one className somewhere in the app's markup), with the same
//   specificity, setting the same property (shorthands expanded) to different values.
//
// The fix for a hit is to give the page rule more weight than the kit's (`.sc-carril.hy-carril`, `.nu>.nu-sheet`),
// so it wins in both orders. Limits: classes passed through a component's `className` prop or built from template
// expressions are not seen, nor kit rules whose last compound has no class (`.vd-pg>:where(…)`).
import { describe, expect, it } from "vitest";

// Read from disk: vitest runs with `css: false`. node:fs through a typed dynamic import (no Node types in the app).
type Fs = {
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { recursive: true }) => string[];
};
const fsModule = "node:fs";
const { readFileSync, readdirSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;

// vitest runs from the repo root
const files = (dir: string, ext: string) =>
  readdirSync(dir, { recursive: true })
    .map((f) => `${dir}/${f.replaceAll("\\", "/")}`)
    .filter((f) => f.endsWith(ext) && !/\.test\.tsx?$/.test(f));

// ---------- CSS → flat rules ----------

type Rule = { file: string; selector: string; decls: Map<string, string>; important: Set<string> };

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Splits on a separator at the top level (outside (), [] and strings). */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// At-rules whose blocks hold no rules that compete with the page's: keyframes, fonts, registered properties, layered
// rules (every unlayered rule beats a layered one, whatever the order) and @starting-style.
const SKIP_AT = /^@(keyframes|-webkit-keyframes|font-face|property|layer|starting-style|page)\b/;

function parseRules(file: string): Rule[] {
  const css = stripComments(readFileSync(file, "utf8"));
  const rules: Rule[] = [];
  const stack: { prelude: string; skip: boolean }[] = [];
  let buf = "";
  let quote = "";
  let paren = 0;
  for (const ch of css) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(") paren++;
    if (ch === ")") paren--;
    if (paren > 0) {
      buf += ch;
      continue;
    }
    if (ch === "{") {
      const prelude = buf.trim();
      const parentSkip = stack.length > 0 && stack[stack.length - 1].skip;
      stack.push({ prelude, skip: parentSkip || SKIP_AT.test(prelude) });
      buf = "";
    } else if (ch === "}") {
      const open = stack.pop();
      if (open && !open.skip && !open.prelude.startsWith("@")) {
        const decls = new Map<string, string>();
        const important = new Set<string>();
        for (const d of splitTop(buf, ";")) {
          const i = d.indexOf(":");
          if (i < 0) continue;
          const prop = d.slice(0, i).trim().toLowerCase();
          let value = d.slice(i + 1).trim().replace(/\s+/g, " ");
          if (/!important$/i.test(value)) {
            value = value.replace(/\s*!important$/i, "");
            important.add(prop);
          }
          if (prop) decls.set(prop, value);
        }
        for (const s of splitTop(open.prelude, ",")) {
          const selector = s.trim().replace(/\s+/g, " ");
          if (selector) rules.push({ file, selector, decls, important });
        }
      }
      buf = "";
    } else if (ch === ";" && buf.trim().startsWith("@")) {
      buf = ""; // @import / @charset statements
    } else buf += ch;
  }
  return rules;
}

// ---------- selectors ----------

type Spec = [number, number, number];
const add = (a: Spec, b: Spec): Spec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cmp = (a: Spec, b: Spec) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const LEGACY_ELEMENTS = /^:(before|after|first-line|first-letter)$/;

/** Specificity of a selector (Selectors Level 4: :where 0, :is/:not/:has the most specific argument). */
function specificity(sel: string): Spec {
  let spec: Spec = [0, 0, 0];
  let i = 0;
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === "#") {
      const m = /^#[\w-]+/.exec(sel.slice(i));
      spec = add(spec, [1, 0, 0]);
      i += m ? m[0].length : 1;
    } else if (ch === ".") {
      const m = /^\.[\w-]+/.exec(sel.slice(i));
      spec = add(spec, [0, 1, 0]);
      i += m ? m[0].length : 1;
    } else if (ch === "[") {
      const end = sel.indexOf("]", i);
      spec = add(spec, [0, 1, 0]);
      i = end < 0 ? sel.length : end + 1;
    } else if (ch === ":") {
      const m = /^::?[\w-]+/.exec(sel.slice(i));
      const name = m ? m[0] : ":";
      i += name.length;
      let args = "";
      if (sel[i] === "(") {
        let depth = 0;
        const start = i;
        for (; i < sel.length; i++) {
          if (sel[i] === "(") depth++;
          else if (sel[i] === ")" && --depth === 0) break;
        }
        args = sel.slice(start + 1, i);
        i++;
      }
      if (name === ":where") continue;
      if (name === ":is" || name === ":not" || name === ":has" || name === ":matches") {
        const best = splitTop(args, ",")
          .map((a) => specificity(a.trim()))
          .reduce<Spec>((m, s) => (cmp(s, m) > 0 ? s : m), [0, 0, 0]);
        spec = add(spec, best);
      } else if (name.startsWith("::") || LEGACY_ELEMENTS.test(name)) spec = add(spec, [0, 0, 1]);
      else spec = add(spec, [0, 1, 0]);
    } else if (/[a-zA-Z]/.test(ch)) {
      const m = /^[a-zA-Z][\w-]*/.exec(sel.slice(i));
      spec = add(spec, [0, 0, 1]);
      i += m ? m[0].length : 1;
    } else i++;
  }
  return spec;
}

/** Splits off the last compound selector: what comes before it (ancestors + combinator) and the compound. */
function lastCompound(sel: string): { prefix: string; compound: string } {
  let depth = 0;
  for (let i = sel.length - 1; i >= 0; i--) {
    const ch = sel[i];
    if (ch === ")" || ch === "]") depth++;
    else if (ch === "(" || ch === "[") depth--;
    else if (depth === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~")) {
      return { prefix: sel.slice(0, i + 1).replace(/\s*([>+~])\s*/g, "$1").trim(), compound: sel.slice(i + 1).trim() };
    }
  }
  return { prefix: "", compound: sel };
}

/** The compound's top-level classes, and the rest of it (element, pseudo-classes, pseudo-element) as a key. */
function classesOf(compound: string): { classes: string[]; rest: string } {
  const classes: string[] = [];
  let rest = "";
  let depth = 0;
  for (let i = 0; i < compound.length; i++) {
    const ch = compound[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (depth === 0 && ch === ".") {
      const m = /^\.([\w-]+)/.exec(compound.slice(i));
      if (m) {
        classes.push(m[1]);
        i += m[0].length - 1;
        continue;
      }
    }
    rest += ch;
  }
  return { classes, rest };
}

// ---------- properties ----------

const SIDES = ["top", "right", "bottom", "left"];
const sided = (p: string, suffix = "") => SIDES.map((s) => `${p}-${s}${suffix}`);
const LONGHANDS: Record<string, string[]> = {
  margin: sided("margin"),
  "margin-block": ["margin-top", "margin-bottom"],
  "margin-inline": ["margin-left", "margin-right"],
  "margin-block-start": ["margin-top"],
  "margin-block-end": ["margin-bottom"],
  "margin-inline-start": ["margin-left"],
  "margin-inline-end": ["margin-right"],
  padding: sided("padding"),
  "padding-block": ["padding-top", "padding-bottom"],
  "padding-inline": ["padding-left", "padding-right"],
  "padding-block-start": ["padding-top"],
  "padding-block-end": ["padding-bottom"],
  "padding-inline-start": ["padding-left"],
  "padding-inline-end": ["padding-right"],
  inset: SIDES,
  "inset-block": ["top", "bottom"],
  "inset-inline": ["left", "right"],
  "inset-block-start": ["top"],
  "inset-block-end": ["bottom"],
  "inset-inline-start": ["left"],
  "inset-inline-end": ["right"],
  border: [...sided("border", "-width"), ...sided("border", "-style"), ...sided("border", "-color")],
  "border-width": sided("border", "-width"),
  "border-style": sided("border", "-style"),
  "border-color": sided("border", "-color"),
  ...Object.fromEntries(SIDES.map((s) => [`border-${s}`, [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]])),
  "border-block": ["border-top-width", "border-top-style", "border-top-color", "border-bottom-width", "border-bottom-style", "border-bottom-color"],
  "border-inline": ["border-left-width", "border-left-style", "border-left-color", "border-right-width", "border-right-style", "border-right-color"],
  "border-radius": ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  background: ["background-color", "background-image", "background-position", "background-size", "background-repeat", "background-attachment", "background-origin", "background-clip"],
  font: ["font-family", "font-size", "font-weight", "font-style", "font-variant", "font-stretch", "line-height"],
  "grid-template": ["grid-template-columns", "grid-template-rows", "grid-template-areas"],
  grid: ["grid-template-columns", "grid-template-rows", "grid-template-areas", "grid-auto-flow", "grid-auto-rows", "grid-auto-columns"],
  "grid-area": ["grid-row-start", "grid-column-start", "grid-row-end", "grid-column-end"],
  "grid-row": ["grid-row-start", "grid-row-end"],
  "grid-column": ["grid-column-start", "grid-column-end"],
  gap: ["row-gap", "column-gap"],
  "grid-gap": ["row-gap", "column-gap"],
  overflow: ["overflow-x", "overflow-y"],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  "place-items": ["align-items", "justify-items"],
  "place-content": ["align-content", "justify-content"],
  "place-self": ["align-self", "justify-self"],
  transition: ["transition-property", "transition-duration", "transition-timing-function", "transition-delay", "transition-behavior"],
  animation: ["animation-name", "animation-duration", "animation-timing-function", "animation-delay", "animation-iteration-count", "animation-direction", "animation-fill-mode", "animation-play-state"],
  outline: ["outline-width", "outline-style", "outline-color"],
  "text-decoration": ["text-decoration-line", "text-decoration-style", "text-decoration-color", "text-decoration-thickness"],
  "list-style": ["list-style-type", "list-style-position", "list-style-image"],
  "container": ["container-name", "container-type"],
  "-webkit-mask": ["mask-image", "mask-position", "mask-size", "mask-repeat"],
  mask: ["mask-image", "mask-position", "mask-size", "mask-repeat"],
  "-webkit-mask-image": ["mask-image"],
  "-webkit-backdrop-filter": ["backdrop-filter"],
};
const longhands = (prop: string) => LONGHANDS[prop] ?? [prop];
const overlaps = (a: string, b: string) => a === b || longhands(a).some((p) => longhands(b).includes(p));

// ---------- markup: which classes are written together ----------

/** Every class token set written in one className attribute in the app's TSX. */
function classSets(): Set<string>[] {
  const sets: Set<string>[] = [];
  for (const file of files("src", ".tsx")) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/className=/g)) {
      let i = (m.index ?? 0) + m[0].length;
      let text = "";
      if (src[i] === '"' || src[i] === "'") {
        const end = src.indexOf(src[i], i + 1);
        text = src.slice(i, end + 1);
      } else if (src[i] === "{") {
        let depth = 0;
        const start = i;
        for (; i < src.length; i++) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}" && --depth === 0) break;
        }
        text = src.slice(start, i + 1);
      }
      const tokens = new Set<string>();
      for (const lit of text.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
        const body = (lit[1] ?? lit[2] ?? lit[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
        for (const t of body.split(/\s+/)) if (/^[a-zA-Z][\w-]*$/.test(t)) tokens.add(t);
      }
      if (tokens.size > 1) sets.push(tokens);
    }
  }
  return sets;
}

// ---------- the check ----------

type Hit = { key: string; props: string[] };

function ties(pageRules: Rule[], kitRules: Rule[], sets: Set<string>[]): Hit[] {
  // the kit by what must be equal on both sides: ancestors, weight and the compound's non-class part
  const kit = new Map<string, { r: Rule; classes: string[] }[]>();
  for (const r of kitRules) {
    const last = lastCompound(r.selector);
    const kc = classesOf(last.compound);
    if (!kc.classes.length) continue;
    const key = `${last.prefix}|${specificity(r.selector).join(",")}|${kc.rest}`;
    kit.set(key, [...(kit.get(key) ?? []), { r, classes: kc.classes }]);
  }
  // which className attributes carry each class: two classes are written together when their lists meet
  const where = new Map<string, Set<number>>();
  sets.forEach((s, i) => {
    for (const c of s) where.set(c, (where.get(c) ?? new Set()).add(i));
  });
  const seen = new Map<string, boolean>();
  const together = (classes: string[]) => {
    const key = [...classes].sort().join(" ");
    let ok = seen.get(key);
    if (ok === undefined) {
      const lists = classes.map((c) => where.get(c) ?? new Set<number>()).sort((x, y) => x.size - y.size);
      ok = [...lists[0]].some((i) => lists.every((l) => l.has(i)));
      seen.set(key, ok);
    }
    return ok;
  };
  const byKey = new Map<string, Set<string>>();
  for (const p of pageRules) {
    const pLast = lastCompound(p.selector);
    const pc = classesOf(pLast.compound);
    if (!pc.classes.length) continue;
    for (const k of kit.get(`${pLast.prefix}|${specificity(p.selector).join(",")}|${pc.rest}`) ?? []) {
      if (k.classes.every((c) => pc.classes.includes(c))) continue; // the same selector (or the page's own copy)
      if (!together([...new Set([...pc.classes, ...k.classes])])) continue;
      const props: string[] = [];
      for (const [pp, pv] of p.decls) {
        for (const [kp, kv] of k.r.decls) {
          if (!overlaps(pp, kp)) continue;
          if (pp === kp && pv === kv) continue;
          if (p.important.has(pp) !== k.r.important.has(kp)) continue; // !important decides, not the order
          props.push(pp === kp ? pp : `${pp}/${kp}`);
        }
      }
      if (!props.length) continue;
      const key = `${p.file.replace(/^src\//, "")} ${p.selector} ⟷ ${k.r.file.replace(/^src\//, "")} ${k.r.selector}`;
      const acc = byKey.get(key) ?? new Set<string>();
      for (const x of props) acc.add(x);
      byKey.set(key, acc);
    }
  }
  return [...byKey].map(([key, props]) => ({ key, props: [...props].sort() })).sort((a, b) => a.key.localeCompare(b.key));
}

// The kit sheets that do NOT ride in the entry: they arrive with the pages that import them, so in production they
// land after a page's own sheet. tokens.css, glass.css and chrome.css (and celeste/base.css, vestuario.css) come with
// the site chrome in the entry and always load before any page sheet, so ties with them resolve as in dev.
const VIDRIO_KIT = ["components", "reading", "transitions", "update", "field", "sky"].map((n) => `src/styles/vidrio/${n}.css`);
const SALA_KIT = ["src/pages/admin/shell/sala.css", ...VIDRIO_KIT];
const SALA_PAGES = [...files("src/pages/admin", ".css"), ...files("src/pages/mesa", ".css")].filter((f) => !SALA_KIT.includes(f));
const SITE_KIT = [...VIDRIO_KIT, "src/styles/vidrio-paginas.css"];
const GLOBAL = ["src/index.css", "src/styles/tailwind.css", "src/styles/fonts.css", "src/styles/theme.css", "src/styles/celeste/base.css", "src/styles/vestuario.css"];
const SITE_PAGES = files("src", ".css").filter(
  (f) => !SALA_PAGES.includes(f) && !SALA_KIT.includes(f) && !SITE_KIT.includes(f) && !GLOBAL.includes(f) && !f.startsWith("src/styles/vidrio/"),
);

// Ties that already exist. Each is a page rule that wins in dev and loses in production; they are listed in
// piti-diseno/src/noche-2026-11-07/mantenimiento.md to be checked one by one (a fix changes what production shows,
// back to what dev shows). Fix one → delete its line here. A NEW tie fails the test.
const KNOWN_SALA: string[] = [
  "pages/admin/areas/acta/acta.css .sac-act ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns, min-height}",
  "pages/admin/areas/acta/acta.css .sac-file ⟷ styles/vidrio/reading.css .vd-input {padding-top/padding}",
  "pages/admin/areas/acta/acta.css .sac-foot ⟷ pages/admin/shell/sala.css .sc-primary {gap}",
  "pages/admin/areas/acta/acta.css .sac-foot ⟷ pages/admin/shell/sala.css .sc-primary--pin {display, padding}",
  "pages/admin/areas/acta/acta.css .sac-guest ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/acta/acta.css .sac-link ⟷ styles/vidrio/reading.css .vd-link {color, font-size/font, font-weight, font-weight/font, font/font-family, font/font-weight, text-decoration/text-decoration-color, text-decoration/text-decoration-thickness, text-underline-offset}",
  "pages/admin/areas/acta/acta.css .sac-link--mal ⟷ styles/vidrio/reading.css .vd-link {text-decoration-color, text-decoration-color/text-decoration}",
  "pages/admin/areas/acta/acta.css .sac-mark ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/acta/acta.css .sac-pend__a ⟷ pages/admin/shell/sala.css .sc-primary {gap}",
  "pages/admin/areas/acta/acta.css .sac-pend__a ⟷ pages/admin/shell/sala.css .sc-primary--pin {display}",
  "pages/admin/areas/acta/acta.css .sac-prop ⟷ pages/admin/shell/sala.css .sc-btnrow {display, gap}",
  "pages/admin/areas/acta/acta.css .sac-seg ⟷ styles/vidrio/components.css .vd-seg {height}",
  "pages/admin/areas/acta/acta.css .sac-seg--2 ⟷ styles/vidrio/components.css .vd-seg {--n}",
  "pages/admin/areas/acta/acta.css .sac-step__n ⟷ pages/admin/shell/sala.css .sc-score {line-height}",
  "pages/admin/areas/acta/acta.css .sac-sub-h ⟷ pages/admin/shell/sala.css .sc-h3 {color, font-size, font-weight, margin}",
  "pages/admin/areas/caja/caja.css .cj-cons ⟷ pages/admin/shell/sala.css .sc-rows {margin}",
  "pages/admin/areas/caja/caja.css .cj-sh-lede ⟷ pages/admin/shell/sala.css .sc-p {color, margin}",
  "pages/admin/areas/club/club.css .cl-back ⟷ styles/vidrio/reading.css .vd-link {display, font-size/font, min-height, text-decoration, text-decoration/text-decoration-color, text-decoration/text-decoration-thickness}",
  "pages/admin/areas/club/club.css .cl-cla__meta ⟷ pages/admin/shell/sala.css .sc-form {grid-template-columns}",
  "pages/admin/areas/club/club.css .cl-danger ⟷ styles/vidrio/reading.css .vd-btn {color}",
  "pages/admin/areas/club/club.css .cl-items ⟷ pages/admin/shell/sala.css .sc-rows {border-top}",
  "pages/admin/areas/club/club.css .cl-link ⟷ styles/vidrio/reading.css .vd-link {font-size/font}",
  "pages/admin/areas/club/club.css .cl-mod ⟷ pages/admin/shell/sala.css .sc-row {gap, grid-template-columns}",
  "pages/admin/areas/club/club.css .cl-notice ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/club/club.css .cl-pich ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/club/club.css .cl-rota__r ⟷ pages/admin/shell/sala.css .sc-row {gap, grid-template-columns}",
  "pages/admin/areas/club/club.css .cl-season ⟷ pages/admin/shell/sala.css .sc-row {gap, grid-template-columns, padding}",
  "pages/admin/areas/club/club.css .cl-sec ⟷ pages/admin/shell/sala.css .sc-row {min-height}",
  "pages/admin/areas/club/club.css .cl-sh-lede ⟷ pages/admin/shell/sala.css .sc-p {color, margin}",
  "pages/admin/areas/club/club.css .cl-sub ⟷ pages/admin/shell/sala.css .sc-h3 {margin}",
  "pages/admin/areas/club/club.css .cl-trow ⟷ pages/admin/shell/sala.css .sc-row {gap, grid-template-columns, min-height}",
  "pages/admin/areas/club/club.css .cl-turn ⟷ pages/admin/shell/sala.css .sc-row {align-items, grid-template-columns}",
  "pages/admin/areas/hoy-partidos/hoy.css .hy-after__line ⟷ pages/admin/shell/sala.css .sc-p {font-size}",
  "pages/admin/areas/hoy-partidos/hoy.css .hy-play ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns, min-height}",
  "pages/admin/areas/hoy-partidos/hoy.css .hy-row ⟷ pages/admin/shell/sala.css .sc-row {padding}",
  "pages/admin/areas/hoy-partidos/hp.css .hp-shirt ⟷ pages/admin/shell/sala.css .sc-shirt {display}",
  "pages/admin/areas/hoy-partidos/partidos.css .sc-field small.is-ok::before ⟷ pages/admin/shell/sala.css .sc-field small.is-bad::before {content, font-weight}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-arch__ev ⟷ pages/admin/shell/sala.css .sc-rows {margin-top/margin}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-arch__grid ⟷ pages/admin/shell/sala.css .sc-split {gap, grid-template-columns}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-arch__t ⟷ pages/admin/shell/sala.css .sc-h2 {font-size}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-archlink ⟷ styles/vidrio/reading.css .vd-link {font-size/font}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-arow ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-bad ⟷ pages/admin/shell/sala.css .sc-small {color}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-board__open ⟷ styles/vidrio/reading.css .vd-link {font-size/font}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-danger ⟷ styles/vidrio/reading.css .vd-btn {color}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-logo ⟷ pages/admin/shell/sala.css .sc-field {gap}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-mini-link ⟷ styles/vidrio/reading.css .vd-link {font-size/font}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-play ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns, min-height}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-seg ⟷ styles/vidrio/components.css .vd-seg {max-width}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-seg--3 ⟷ styles/vidrio/components.css .vd-seg {max-width}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-subs__r ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns, min-height}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-turn ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-up ⟷ styles/vidrio/reading.css .vd-link {font-size/font}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-weather ⟷ pages/admin/shell/sala.css .sc-field {gap}",
  "pages/admin/areas/hoy-partidos/partidos.css .spa-why__undo ⟷ styles/vidrio/reading.css .vd-link {font-size/font, min-height}",
  "pages/admin/areas/plantilla/plantilla.css .spl-baja ⟷ styles/vidrio/reading.css .vd-btn {color}",
  "pages/admin/areas/plantilla/plantilla.css .spl-bdays__b ⟷ styles/vidrio/reading.css .vd-link {color, font-size/font, font-weight, font-weight/font, min-height}",
  "pages/admin/areas/plantilla/plantilla.css .spl-claim ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/plantilla/plantilla.css .spl-danger ⟷ styles/vidrio/reading.css .vd-btn {color}",
  "pages/admin/areas/plantilla/plantilla.css .spl-del ⟷ styles/vidrio/reading.css .vd-link {color, font-size/font, gap}",
  "pages/admin/areas/plantilla/plantilla.css .spl-det__b ⟷ styles/vidrio/reading.css .vd-link {color, font-size/font}",
  "pages/admin/areas/plantilla/plantilla.css .spl-fcap ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/plantilla/plantilla.css .spl-fnav ⟷ pages/admin/shell/sala.css .sc-primary--pin {bottom, margin-top, padding, padding-top/padding, z-index}",
  "pages/admin/areas/plantilla/plantilla.css .spl-form ⟷ pages/admin/shell/sala.css .sc-form {grid-template-columns}",
  "pages/admin/areas/plantilla/plantilla.css .spl-free__d ⟷ pages/admin/shell/sala.css .sc-chip {padding}",
  "pages/admin/areas/plantilla/plantilla.css .spl-glance__h ⟷ pages/admin/shell/sala.css .sc-h3 {margin}",
  "pages/admin/areas/plantilla/plantilla.css .spl-orow ⟷ pages/admin/shell/sala.css .sc-row {grid-template-columns}",
  "pages/admin/areas/plantilla/plantilla.css .spl-page ⟷ styles/vidrio/reading.css .vd-link {gap, min-height}",
  "pages/admin/areas/plantilla/plantilla.css .spl-sec ⟷ pages/admin/shell/sala.css .sc-sec {padding}",
  "pages/admin/areas/plantilla/plantilla.css .spl-seg ⟷ styles/vidrio/components.css .vd-seg {max-width}",
  "pages/admin/areas/plantilla/plantilla.css .spl-state ⟷ styles/vidrio/components.css .vd-seg {max-width}",
  "pages/admin/areas/plantilla/plantilla.css .spl-sub ⟷ pages/admin/shell/sala.css .sc-h3 {margin}",
];
const KNOWN_SITE: string[] = [
  "styles/palco/palco.css .nx-seg ⟷ styles/vidrio/components.css .vd-seg {height}",
  "styles/palco/palco.css .nx-shelf ⟷ styles/vidrio/components.css .vd-shelf {height, padding}",
  "styles/partidos-vidrio.css .pa-lens ⟷ styles/vidrio/components.css .vd-lens {--vd-r, padding}",
  "styles/stats-vidrio.css .st-now__table ⟷ styles/vidrio/reading.css .vd-table {font-size}",
  "styles/stats.css .st-hero ⟷ styles/vidrio-paginas.css .vd-pg-head {padding}",
  "styles/tu.css .tu-bell__tabs ⟷ styles/vidrio/components.css .vd-seg {height}",
  "styles/tu.css .tu-more-btn ⟷ styles/vidrio/reading.css .vd-btn {gap, padding}",
  "styles/tu.css .tu-ms__open ⟷ styles/vidrio/reading.css .vd-link {font-size/font}",
  "styles/tu.css .tu-oseg ⟷ styles/vidrio/components.css .vd-seg {height}",
  "styles/tu.css .tu-pd__seg ⟷ styles/vidrio/components.css .vd-seg {max-width}",
];

const report = (hits: Hit[]) => hits.map((h) => `${h.key} {${h.props.join(", ")}}`);

describe("production CSS order: page rules outweigh the kit rules they override", () => {
  const sets = classSets();

  it("catches the Hoy carril's old one-class rule against the real sala.css and markup", () => {
    const probe: Rule = {
      file: "src/probe.css",
      selector: ".hy-carril",
      decls: new Map([["grid-template-columns", "repeat(6,minmax(108px,1fr))"]]),
      important: new Set(),
    };
    expect(report(ties([probe], parseRules("src/pages/admin/shell/sala.css"), sets))).toContain(
      "probe.css .hy-carril ⟷ pages/admin/shell/sala.css .sc-carril {grid-template-columns}",
    );
    // today's rule, scoped, outweighs it
    expect(ties([{ ...probe, selector: ".sc-carril.hy-carril" }], parseRules("src/pages/admin/shell/sala.css"), sets)).toEqual([]);
  });

  it("specificity and shorthands", () => {
    expect(specificity(".a")).toEqual([0, 1, 0]);
    expect(specificity(".a.b::before")).toEqual([0, 2, 1]);
    expect(specificity(":where(.x) .a:hover")).toEqual([0, 2, 0]);
    expect(specificity(".a:not(.b,#c) p")).toEqual([1, 1, 1]);
    expect(lastCompound(".a > .b:hover")).toEqual({ prefix: ".a>", compound: ".b:hover" });
    expect(classesOf("button.a.b:hover")).toEqual({ classes: ["a", "b"], rest: "button:hover" });
    expect(overlaps("margin", "margin-top")).toBe(true);
    expect(overlaps("padding-inline", "padding-top")).toBe(false);
  });

  it("the Sala de control (admin areas, la mesa) against sala.css and the Vidrio kit", () => {
    expect(SALA_PAGES.length).toBeGreaterThan(5);
    expect(report(ties(SALA_PAGES.flatMap(parseRules), SALA_KIT.flatMap(parseRules), sets))).toEqual(KNOWN_SALA);
  });

  it("the rest of the site against the Vidrio kit", () => {
    expect(SITE_PAGES.length).toBeGreaterThan(30);
    expect(report(ties(SITE_PAGES.flatMap(parseRules), SITE_KIT.flatMap(parseRules), sets))).toEqual(KNOWN_SITE);
  });
});
