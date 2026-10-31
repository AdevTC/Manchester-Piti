// «El palco» · El juego: the prototype's juego(), mesa(), catalogo(), ficha() and the export sheet (Numeros.dc.html),
// on the app's view model. `v` is already cut by every filter; this only arranges it as the prototype draws it.
import { CAT_FAMILIES, CAT_SIZE } from "../numeros/catalog";
import type { Act, NuState, NuView } from "../numeros/view";
import { ICON } from "./icons";
import { plural } from "./num";

type V = Pick<NuView, "juego" | "ws" | "cat" | "mt" | "json">;
type St = Pick<NuState, "jug" | "partidos" | "team" | "catX" | "catFam" | "catN" | "wsColumns" | "exFmt" | "sheetId" | "place">;

/** A status dot's class: complete, partial, nothing. */
export const stCls = (status: string | undefined): "is-ok" | "is-part" | "" => (status === "ok" || status === "is-ok" ? "is-ok" : /part/.test(status ?? "") ? "is-part" : "");

/** «De un vistazo» in three families, by the statistic's words (the prototype's FAMS); the rest go to the last one. */
export const FAMS = [
  { t: "Ataque", re: /^(Goles|Asistencias|Remates|Pases que acaban|Centros|Regates|Ocasiones|Tiros|Disparos)/i },
  { t: "El balón", re: /^(Pases intentados|Pases del rival|Precisión|Pases completados|Pérdidas|Controles|Conducciones)/i },
  { t: "Defensa y portería", re: /^(Recuperaciones|Interceptaciones|Despejes|Duelos|Entradas|Bloqueos|Paradas|Porterías|Tarjetas|Amarillas|Faltas)/i },
] as const;

export function famsOf<T extends { t: string }>(tiles: readonly T[]): { t: string; tiles: T[] }[] {
  const used = new Set<T>();
  const fams = FAMS.map((f) => ({
    t: f.t,
    tiles: tiles.filter((x) => {
      if (used.has(x) || !f.re.test(x.t)) return false;
      used.add(x);
      return true;
    }),
  }));
  const rest = tiles.filter((x) => !used.has(x));
  if (rest.length) fams[fams.length - 1].tiles.push(...rest);
  return fams.filter((f) => f.tiles.length);
}

/** No figure: «–» (the engine writes «-»). */
const dash = (x: unknown): string => {
  const s = String(x ?? "").trim();
  return !s || s === "-" ? "–" : s;
};

/** The place: header, controls, de un vistazo, the four doors, the clock, the pass, the tramos, what is narrated. */
export function juego(v: V, st: St, act: Pick<Act, "open" | "grow">) {
  const g = v.juego;
  const tiles = g.tiles.map((x) => ({ id: x.id, t: x.t, v: dash(x.v), cls: stCls(x.status), statusT: x.statusT, sub: x.sub, open: () => act.open("metric", x.id) }));
  const prec = tiles.find((x) => /^Precisión/.test(x.t) && x.v !== "–");
  const ps = g.passes;
  const locked = st.jug.length > 0;
  return {
    kick: g.kick, title: g.title, sub: g.sub,
    // (a player's plays are ours: with one chosen, «El rival» waits)
    teams: g.teamOpts.map((o, i) => ({ ...o, off: locked && i === 1 })),
    partes: g.parteOpts,
    locked, lockT: "Con un jugador elegido, cuentan solo sus jugadas.",
    who: [{ key: "", t: "Todos", n: "" as number | string, on: !st.jug.length, hasN: false, pick: g.whoAll }].concat(g.who.map((p) => ({ ...p, hasN: true }))),
    fams: famsOf(tiles),
    slices: g.slices, slicesN: Math.max(1, g.slices.length), clockCap: g.clockCap,
    pass: { c: ps.completed || 0, f: ps.failed || 0, u: ps.unknown || 0 },
    passMeta: `${ps.attempted || 0} intentados${prec ? ` · ${prec.v} de precisión` : ""}`,
    passAria: `${ps.completed || 0} pases completados, ${ps.failed || 0} fallados y ${ps.unknown || 0} sin resultado`,
    pairs: g.pairs, noPairs: !g.pairs.length,
    tramos: g.tramos, tramN: Math.max(1, g.tramos.length), tramT: g.tramT || "Dónde cambia el juego", tramSub: g.tramSub,
    cov: g.cov, note: g.note, hasNote: !!g.note,
    openGraf: () => act.grow("graficas"), openMesa: () => act.grow("mesa"), openCat: () => act.grow("catalogo"), openExport: () => act.open("export"),
    mesaT: `Siete vistas rápidas o tus columnas, entre ${v.ws.total}`,
    catT: `Catálogo · ${CAT_SIZE} estadísticas`, catS: `Una ficha para cada una, en palabras sencillas, en ${CAT_FAMILIES} familias`,
  };
}

/** The columns the picker lists at once (the search narrows the rest). */
export const COLS_SHOWN = 60;

/** «Todos los números, a tu medida»: the seven quick views + Personalizado, the picker, the sortable table. */
export function mesa(v: V, act: Pick<Act, "set" | "open">, filterT: string) {
  const w = v.ws;
  const keys = w.cols.map((c) => c.key);
  const custom = w.custom;
  // (a column on or off makes the view Personalizado; the table never ends up without columns)
  const toggle = (k: string) => {
    const next = keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k];
    act.set({ wsColumns: next.length ? next : keys });
  };
  const sets: { key: string; t: string; on: boolean; pick: () => void }[] = [...w.sets.map((s) => ({ key: s.key, t: s.t as string, on: s.on, pick: s.pick })), { key: "custom", t: "Personalizado", on: custom, pick: () => act.set({ wsColumns: keys }) }];
  return {
    lead: `Una fila por jugador y una columna por estadística: elige una vista rápida o monta la tuya con las ${w.total} que hay. ${filterT ? `Son las cifras de la selección (${filterT}), de las actas narradas.` : "Son las cifras de toda la temporada, de las actas narradas."}`,
    sets, custom,
    reset: () => act.set({ wsColumns: [...w.resumen], wsSort: undefined }),
    head: w.cols.map((c) => ({ key: c.key, t: c.t, on: c.sort !== "none", aria: c.sort, ic: c.sort === "ascending" ? ICON.sortU : c.sort === "descending" ? ICON.sortD : ICON.sortN, pick: c.pick })),
    rows: w.rows.map((r) => ({
      key: r.key, name: r.name, n: r.n, cls: r.cls,
      cells: r.cells.map((c) => {
        const val = dash(c.v);
        const on = w.cols.find((h) => h.key === c.key)?.sort !== "none";
        const cls = c.status === "partial" ? "is-partial" : val === "–" ? "is-unknown" : "";
        return { key: c.key, v: val, cls: `${cls}${on ? " is-on" : ""}`.trim(), why: c.reason };
      }),
    })),
    foot: w.foot.map((c) => ({ key: c.key, v: dash(c.v), why: c.reason })),
    totalLabel: w.totalLabel,
    q: w.query, onQ: w.setQuery,
    fams: [{ key: "", t: "Todas las familias", n: w.total, on: !w.family, pick: () => w.setFamily("") }].concat(w.families.map((f) => ({ key: f, t: f, n: w.famN[f] ?? 0, on: w.family === f, pick: () => w.setFamily(f) }))),
    cols: w.columns.slice(0, COLS_SHOWN).map((c) => ({ key: c.key, t: c.t, sub: `${c.key}${c.available ? "" : " · sin datos en las actas"}`, on: c.selected, cls: c.available ? "" : "is-na", why: c.available ? c.family : c.reason, pick: () => toggle(c.key) })),
    colCount: `${plural(keys.length, "columna elegida", "columnas elegidas")} · ${w.columns.length} en esta lista${w.columns.length > COLS_SHOWN ? ` (se ven ${COLS_SHOWN}: afina la búsqueda)` : ""}`,
    availableCount: w.availableCount, selectAll: w.selectAll, clear: w.clearColumns,
    n: keys.length, noRows: !w.rows.length,
    dl: () => act.open("export", "csv"),
  };
}

/** Each page of the catalogue. */
export const CAT_PAGE = 24;

/** «Catálogo»: the search, the families with their counts (the empty ones hidden), «fuera del audio», the cards. */
export function catalogo(v: V, st: St) {
  const c = v.cat;
  const famOn = c.fams.find((f) => f.on && f.key);
  const all = { ...c.fams[0], n: Object.values(c.famN).reduce((a, b) => a + b, 0) };
  const fams = [all].concat(c.fams.slice(1).filter((f) => c.famN[f.key] || f.on).map((f) => ({ ...f, n: c.famN[f.key] ?? 0 })));
  const narrowed = !!famOn || !!c.q;
  return {
    q: c.q, onQ: c.setQ, x: c.xOn, toggleX: c.toggleX, fams,
    count: `${plural(c.n, "estadística", "estadísticas")}${st.catX ? (narrowed ? ", incluidas las que no se narran por audio" : `, con las ${c.excl} que no se narran por audio`) : ""}`,
    items: c.items.map((x) => ({ key: x.key, id: x.id, fam: x.fam, t: x.t, def: x.def, v: dash(x.v), st: x.stT, cls: stCls(x.cls), open: x.pick })),
    more: c.more, moreT: `Ver ${CAT_PAGE} más (${Math.min(st.catN, c.n)} de ${c.n})`, showMore: c.showMore,
    empty: c.empty, loading: c.loading,
  };
}

/** The ficha's two ways out: the mesa as Personalizado with its column (sorted by it), or its family in the catalogue. */
export function ficha(v: V, st: St, act: Pick<Act, "ask" | "grow">) {
  const m = v.mt;
  if (!m) return null;
  const keys = v.ws.cols.length ? v.ws.cols.map((c) => c.key) : [...v.ws.resumen];
  // (the page moves first — to El juego from another place — and then the window grows on the state it left)
  const later = (g: "mesa" | "catalogo") => globalThis.setTimeout(() => act.grow(g), st.place === "juego" ? 0 : 560);
  return {
    id: m.id, fam: m.fam, t: m.t, v: dash(m.v), st: m.st, cls: stCls(m.cls), def: m.def || "Sin definición en el catálogo.", narr: m.narr || "—", scope: m.scope || "—", why: m.why,
    excluded: m.excluded, rows: m.rows, hasRows: m.rows.length > 0,
    evid: m.evid, noEv: m.noEv, evMore: m.evMore,
    toMesa: () => {
      act.ask("juego", { wsColumns: keys.includes(m.id) ? keys : [...keys, m.id], wsSort: m.id, wsDirection: "desc", wsFamily: m.fam, wsQuery: "" });
      later("mesa");
    },
    toCat: () => {
      act.ask("juego", { catFam: m.fam, catQ: "", catN: CAT_PAGE, catX: m.excluded || st.catX });
      later("catalogo");
    },
  };
}

/** The export sheet's format: the one it was opened with («Descargar» in the mesa opens it on CSV), else the last one. */
export const exFmtOf = (st: St): "json" | "csv" => (st.sheetId === "csv" || st.sheetId === "json" ? st.sheetId : st.exFmt);

/** «Exportar la selección»: JSON (the selection) or CSV (the mesa's table), a preview and the real download. */
export function exportar(v: V, st: St, act: Pick<Act, "set" | "json" | "csv">, filterT: string) {
  const fmt = exFmtOf(st);
  const csv = fmt === "csv";
  const t = v.ws.table;
  const jsonPreview = `${JSON.stringify({ filtro: filterT || "toda la temporada", ...v.json }, null, 2).split("\n").slice(0, 30).join("\n")}\n  …`;
  const csvPreview = `${[t.head.join(";")].concat(t.rows.slice(0, 8).map((r) => r.join(";"))).join("\n")}\n…`;
  return {
    lead: `Lo que estás viendo, con el mismo filtro: ${filterT || "toda la temporada"}. El JSON lleva los partidos, los jugadores y las cifras; el CSV, la tabla de la mesa con sus columnas.`,
    fmts: (
      [
        ["json", "JSON"],
        ["csv", "CSV"],
      ] as const
    ).map(([k, label]) => ({ key: k, t: label, on: fmt === k, pick: () => act.set({ exFmt: k, sheetId: k }) })),
    fmt, preview: csv ? csvPreview : jsonPreview,
    goT: csv ? "Descargar el CSV" : "Descargar el JSON",
    go: () => (csv ? act.csv("mesa") : act.json()),
    doneT: `Descargado: ${csv ? "piti-tabla-estadisticas.csv" : `piti-estadisticas-${v.json.hoy}.json`}`,
  };
}
