// «El palco» · Jugadores: the place's view, ported from the prototype's jugadores() and plantilla() (Numeros.dc.html).
// The numbers come from numerosView, already cut by the page's filters: this only arranges them — the podium in 2-1-3,
// eight rows, the card, cara a cara, the gantt, rachas, hitos, marcas, El campo, the evolution and the whole table.
import { NU_MET, metricLower } from "../numeros/glossary";
import type { Act, NuState, NuView } from "../numeros/view";
import type { IconName } from "./icons";
import { num, plural, val } from "./num";

type V = NuView;
type Card = NonNullable<V["jug"]["vs"]>;
type GjRow = V["gj"]["rows"][number];

export const QUICK = [
  ["goles", "Goles"],
  ["asist", "Asist."],
  ["ga", "G+A"],
  ["min", "Minutos"],
  ["mvp", "MVP"],
] as const;
export const VIEWS = [
  ["ranking", "Ranking"],
  ["campo", "En el campo"],
  ["evo", "Evolución"],
] as const;
export const GJSETS = [
  ["basico", "Básico"],
  ["minutos", "Minutos"],
  ["mesa", "La mesa"],
  ["penaltis", "Penaltis"],
  ["narrado", "Narrado"],
] as const;
const CAMPO = [
  ["pases", "Pases de gol"],
  ["puestos", "Puestos"],
] as const;

/** The ranking the view shows (an unknown key falls back to goals, as numerosView does). */
export const rankKey = (k: string): string => (NU_MET[k] || k === "porra" ? k : "goles");
const labelOf = (k: string): string => (k === "porra" ? "Porra" : (NU_MET[k]?.t ?? k));

/** The podium on its steps: second, first, third (two: second, first). */
export function podiumOrder<T>(p: readonly T[]): T[] {
  const top = p.slice(0, 3);
  return top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
}

interface Tile {
  t: string;
  v: number | string;
}
/** Cara a cara: the same figures side by side, the longer bar wins, and one line that says who wins how many. */
export function versus(a: { name: string; tiles: readonly Tile[] }, b: { name: string; tiles: readonly Tile[] }) {
  let aWins = 0;
  let bWins = 0;
  const rows = a.tiles.map((x, i) => {
    const y = b.tiles[i];
    const av = num(x.v);
    const bv = num(y?.v);
    const m = Math.max(1, av, bv);
    if (av > bv) aWins++;
    if (bv > av) bWins++;
    return {
      key: x.t, t: x.t, a: x.v, b: y?.v ?? "–",
      aw: Math.round((av / m) * 100), bw: Math.round((bv / m) * 100),
      cls: av > bv ? "is-a" : bv > av ? "is-b" : "",
      aria: `${x.t}: ${a.name} ${x.v}, ${b.name} ${y ? y.v : "sin dato"}`,
    };
  });
  const lo = Math.min(aWins, bWins);
  const sum = !rows.length
    ? ""
    : aWins === bWins
      ? `Empate: ${aWins} a ${bWins} en estas cifras.`
      : `${aWins > bWins ? a.name : b.name} gana ${Math.max(aWins, bWins)} de ${rows.length} cifras${lo ? `; ${aWins > bWins ? b.name : a.name}, ${lo}.` : "."}`;
  return { rows, sum };
}

/** The spot the side card shows: the one picked even if nobody has played there yet («Sin estrenar»); with none
 *  picked, the busiest one. */
export function spotOf<S extends { code: string; empty: boolean; min: number }>(spots: readonly S[], puesto: string): S | undefined {
  return spots.find((s) => s.code === puesto) ?? spots.filter((s) => !s.empty).sort((a, b) => b.min - a.min)[0] ?? spots[0];
}

/** The whole table's order: by one column (the cells' figures; «–» always last), then by dorsal. */
export function sortRows<R extends { n: number | ""; cells: readonly { v: number | string }[] }>(rows: readonly R[], ci: number, dir: 1 | -1): R[] {
  return rows.slice().sort((a, b) => {
    const x = val(a.cells[ci]?.v);
    const y = val(b.cells[ci]?.v);
    const byV = Number.isNaN(x) ? (Number.isNaN(y) ? 0 : 1) : Number.isNaN(y) ? -1 : (x - y) * dir;
    return byV || (a.n || 999) - (b.n || 999);
  });
}

/** The table's sort as kept in `st.sortK` («goles» goes down, «goles:asc» up); a column the set lacks: the first. */
export function sortOf(sortK: string, keys: readonly string[]): { key: string; dir: 1 | -1 } {
  const [k, d] = sortK.split(":");
  if (keys.includes(k)) return { key: k, dir: d === "asc" ? 1 : -1 };
  return { key: keys[0] ?? "", dir: -1 };
}

const cardOf = (c: Card) => ({
  id: c.id, n: c.n, name: c.name, you: c.you, full: c.full, href: c.href,
  pos: c.pos ? `${c.pos} · ${c.scopeT}` : c.scopeT,
  tiles: c.tiles.map((x) => ({ key: x.t, v: x.v, t: x.t, cls: x.gold ? "is-gold" : "" })),
  rates: c.rates.map((x) => ({ key: x.t, t: x.t, v: x.v })),
  hasStints: c.hasStints, stintT: c.stintT,
  stints: c.stints.map((s, i) => ({ key: i, l: s.l, w: s.w })),
  heat: c.heat.map((h) => ({ key: h.key, j: h.j, g: h.g, label: h.label, cls: [h.cls || "is-nc", h.g ? "is-g" : ""].join(" ").trim() })),
});

export function jugadores(v: V, st: NuState, act: Act) {
  const J = v.jug;
  const rk = rankKey(st.rankK);
  const porra = rk === "porra";
  const label = labelOf(rk);
  const nOf = new Map(v.scope.people.map((p) => [p.key, p.n] as const));
  const pick = J.card.id;
  const quickI = QUICK.findIndex(([k]) => k === rk);
  const total = J.groups.reduce((n, g) => n + g.items.length, 0) + 1; // (+ la porra, in the sheet)
  const choose = (id: string, porraPick: () => void) => (porra ? porraPick : () => act.set({ pick: id, vsOn: false }));
  const rest = J.restAll;
  const rows = (st.allRank ? rest : rest.slice(0, 8)).map((r) => ({
    key: r.id, rk: `${r.rank}º`, n: r.n, name: r.name, you: r.you, val: r.val, w: r.w,
    cls: r.cls, on: !porra && r.id === pick, aria: `${r.rank}º, ${r.name}: ${r.val}`, pick: choose(r.id, r.pick),
  }));
  const people = v.scope.people;
  const others = people.filter((p) => p.key !== pick);
  const vsB = J.vs?.id ?? (st.vsB && st.vsB !== pick ? st.vsB : (others[0]?.key ?? ""));
  const vsOn = st.vsOn && !porra && !!J.vs;
  const vsCard = J.vs;
  const vsPair = vsCard ? versus(J.card, vsCard) : { rows: [], sum: "" };
  const R = v.records;
  const sMax = Math.max(3, ...R.players.map((p) => p.best || 0));
  const C = v.campo;
  const P = spotOf(C.spots, st.puesto);
  const who = P?.who ?? [];
  const wMax = Math.max(1, ...who.map((w) => w.min || 0));
  const starSel = C.star.selected ? C.star : null;
  const ev = R.evo;
  return {
    kick: `Jugadores · ${label}`, title: J.title, sub: J.sub,
    note: st.jug.length === 1 ? "Con un jugador elegido, aquí tienes su ficha; sus jugadas, en El juego." : "",
    quick: QUICK.map(([k, t]) => ({ key: k, t, on: rk === k, pick: () => act.set({ rankK: k, allRank: false }) })),
    quickI: Math.max(0, quickI), quickOn: quickI >= 0,
    moreT: quickI >= 0 ? `Todas (${total})` : label, moreCls: quickI >= 0 ? "" : "is-on",
    openStats: () => act.open("stats"),
    views: VIEWS.map(([k, t]) => ({ key: k, t, on: st.jugView === k, pick: () => act.set({ jugView: k }) })),
    viewI: Math.max(0, VIEWS.findIndex(([k]) => k === st.jugView)),
    isRank: st.jugView === "ranking", isCampo: st.jugView === "campo", isEvo: st.jugView === "evo",
    openTable: () => act.grow("jugadores"),
    // the porra: the team's only (the door), or a season still without points
    locked: J.locked, porraEmpty: J.porraEmpty, onlyOne: J.onlyOne,
    podCls: `n${Math.min(3, J.podium.length)}`,
    podium: podiumOrder(J.podium).map((p) => ({
      key: p.id, val: p.val, n: p.n, name: p.name, you: p.you, rk: `${p.rank}º`, s: p.rank === 1 ? 108 : 82,
      lvl: `is-${Math.min(3, p.rank)}${rk === "mvp" && p.rank === 1 ? " is-gold" : ""}`,
      on: !porra && p.id === pick, aria: `${p.rank}º, ${p.name}: ${p.val}`, pick: choose(p.id, p.pick),
    })),
    rows, hasMore: rest.length > 8, allT: st.allRank ? "Ver menos" : J.moreT, toggleAll: () => act.set({ allRank: !st.allRank }),
    listAria: `Ranking de ${porra ? "la porra" : metricLower(rk)}`,
    meLine: st.allRank ? "" : J.meLine, race: J.race,
    voteOpen: J.voteOpen, mvpList: J.hasMvp ? J.mvpList : [],
    showCard: !porra,
    card: cardOf(J.card),
    isVs: vsOn, noVs: !vsOn,
    startVs: () => act.set({ vsOn: true, vsB }),
    endVs: () => act.set({ vsOn: false }),
    vs: {
      a: { n: J.card.n, name: J.card.name }, b: { n: vsCard?.n ?? "", name: vsCard?.name ?? "" }, rows: vsPair.rows, sum: vsPair.sum,
      opts: others.map((p) => ({ key: p.key, t: p.t, n: p.n, on: p.key === vsB, pick: () => act.set({ vsB: p.key }) })),
    },
    ganttT: J.stintT || "La última jornada, minuto a minuto",
    gantt: J.stintRows.map((g) => ({
      key: g.key, name: g.name, min: g.min, label: g.label, cls: g.cls,
      st: g.st.map((s) => ({ key: s.key, l: s.l, w: Math.max(0, Math.min(100 - parseFloat(s.l), parseFloat(s.w))).toFixed(1) })),
    })),
    ganttNote: J.stintNote, ganttNone: J.ganttNone,
    streakOpts: R.streakOpts, streakI: Math.max(0, R.streakI), streakSub: R.streakSub, noStreaks: R.noPlayers,
    streaks: R.players.map((p) => ({
      key: p.key, name: p.name, cur: p.cur, live: p.live, line: `${p.range}${p.best ? ` · récord ${p.best}` : ""}`,
      curW: Math.round(((p.cur || 0) / sMax) * 100), bestW: Math.min(99, Math.round(((p.best || 0) / sMax) * 100)),
    })),
    hitos: R.hitos,
    indRec: R.indRec.filter((r) => r.has).map((r) => ({ key: r.key, t: r.t, v: r.v, line: r.line, n: nOf.get(r.img) ?? "", pick: r.pick })),
    multi: R.multi, multiNone: R.multiNone,
    cvOpts: CAMPO.map(([k, t]) => ({ key: k, t, on: (st.campoView === "puestos" ? "puestos" : "pases") === k, pick: () => act.set({ campoView: k }) })),
    cvI: st.campoView === "puestos" ? 1 : 0,
    isPases: st.campoView !== "puestos", isPuestos: st.campoView === "puestos",
    arcs: C.arcs,
    stars: C.stars.map((s) => ({
      key: s.key, left: s.left, top: s.top, size: Math.max(10, Math.round(s.size * 1.25)), name: s.name, label: s.label,
      cls: st.star && st.star !== s.id ? "is-dim" : s.cls, on: st.star === s.id, pick: s.pick,
    })),
    starSel: starSel
      ? { name: starSel.name, line: starSel.line, n: nOf.get(starSel.id) ?? "", gives: starSel.gives, takes: starSel.takes, noGives: starSel.noGives, noTakes: starSel.noTakes, open: () => act.set({ jugView: "ranking", pick: starSel.id, vsOn: false }), clear: starSel.clear }
      : null,
    top: C.top, noLinks: C.noLinks, pasesSub: C.sub,
    spots: C.spots.map((s) => ({
      key: s.key, x: s.x, y: s.y, code: s.code, owner: s.empty ? "Sin estrenar" : s.owner, min: s.empty ? "" : `${s.min}′`,
      label: s.label, cls: s.cls, on: s.code === P?.code, pick: s.pick,
    })),
    spot: {
      code: P?.code ?? "", name: P?.name ?? "",
      line: !P || P.empty ? "Sin estrenar" : `Dueño: ${P.owner} · ${P.min} minutos en total`,
      who: who.map((x) => ({
        key: x.id, name: x.name, min: x.min, w: Math.round(((x.min || 0) / wMax) * 100),
        ga: (x.g ? plural(x.g, "gol", "goles") : "") + (x.g && x.a ? " · " : "") + (x.a ? plural(x.a, "asistencia", "asistencias") : ""),
      })),
    },
    unused: C.unused, noPos: C.spots.every((s) => s.empty) ? C.sub : "",
    evoOpts: R.evoOpts, evoI: Math.max(0, R.evoI),
    evoLines: ev.d.map((d, i) => ({ key: i, d, cls: `l${i % 6}` })),
    evoKeys: ev.keys.map((k, i) => ({ key: k.key, name: k.name, v: k.v, cls: `k${i % 6}` })),
    evoAria: ev.cap || "La evolución, jornada a jornada", evoFrom: "J1", evoTo: ev.keys.length ? `J${ev.n}` : "", evoOne: ev.one && ev.keys.length > 0,
    evoPeople: R.evoPeople,
  };
}
export type JugView = ReturnType<typeof jugadores>;

/** «Toda la plantilla, en una tabla»: the five column sets, sortable both ways, a row opens his card in the ranking. */
export function plantilla(v: V, st: NuState, act: Act) {
  const G = v.gj;
  const keys = G.cols.map((c) => c.key);
  const { key: sortK, dir } = sortOf(st.sortK, keys);
  const ci = keys.indexOf(sortK);
  const setK = st.colSet || "basico";
  return {
    sets: GJSETS.map(([k, t]) => ({ key: k, t, on: setK === k, pick: () => act.set({ colSet: k, sortK: "" }) })),
    setI: Math.max(0, GJSETS.findIndex(([k]) => k === setK)),
    count: `${G.count.replace(/ · ordenado por [^·]+/, "")}.`,
    q: G.q, setQ: G.setQ, empty: G.empty, csv: G.csv,
    cols: G.cols.map((c) => {
      const on = c.key === sortK;
      const ic: IconName = on ? (dir > 0 ? "sortU" : "sortD") : "sortN";
      return {
        key: c.key, t: c.t, on, ic,
        aria: on ? (dir > 0 ? ("ascending" as const) : ("descending" as const)) : ("none" as const),
        pick: () => act.set({ sortK: on && dir < 0 ? `${c.key}:asc` : c.key }),
      };
    }),
    rows: sortRows<GjRow>(G.rows, ci, dir).map((r) => ({
      key: r.key, name: r.name, n: r.n, you: r.you, cls: r.you ? "is-you" : "",
      pick: () => act.set({ grow: null, pick: r.id, vsOn: false, jugView: "ranking" }),
      cells: r.cells.map((c, i) => ({ key: c.key, v: c.v === "" ? "–" : c.v, cls: i === ci ? "is-on" : "" })),
      heat: r.heat.slice(-12).map((h) => ({ key: h.key, g: h.g, cls: [h.cls || "is-nc", h.g ? "is-g" : ""].join(" ").trim() })),
      heatAria: r.heat.map((h) => h.label).join("; ") || "Sin jornadas",
    })),
  };
}

/** «Todas las estadísticas»: every group of the app's metrics and la porra; picking one opens its ranking. */
export function statsSheet(v: V, st: NuState, act: Act) {
  const rk = rankKey(st.rankK);
  const to = (k: string) => () => act.ask("jugadores", { rankK: k, pick: null, allRank: false, jugView: "ranking", grow: null });
  return {
    groups: [
      ...v.jug.groups.map((g) => ({ t: g.t, items: g.items.map((it) => ({ key: it.key, t: it.t, on: rk === it.key, lock: false, pick: to(it.key) })) })),
      { t: "El vestuario", items: [{ key: "porra", t: "Porra", on: rk === "porra", lock: !v.member, pick: to("porra") }] },
    ],
  };
}
