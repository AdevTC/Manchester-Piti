// Inicio's screens (the boards' place-campo.js, place-jugadas.js, place-tuyo.js): /hoy/campo «Acabaron en el
// campo» (the pitch at the moviola's minute beside «Los minutos», a row per player with his stints as bars),
// /hoy/jugadas «Jugada a jugada» (the two halves, the changes of one minute together) and /hoy/lo-tuyo «Lo tuyo»
// (players only). Pure.
import { scoreText } from "../../../lib/derived/words";
import { onFieldAt, scoreAt, stintsAt, type Play, type PlayK } from "./partido";
import { POSN, andList, hasGameOf, isLiveF, isPreF, member, scoreEdge, tramosWord, type Ctx } from "./model";
import { playRows, type PlayRowV, type TasksView } from "./bands";

const CNT = ["", "Un tramo", "Dos tramos", "Tres tramos", "Cuatro tramos", "Cinco tramos", "Seis tramos"];
const pct = (x: number, D: number) => Number(((x / D) * 100).toFixed(2));
const barW = (a: number, b: number, D: number) => Number(((Math.max(0.6, b - a) / D) * 100).toFixed(2));
/** «0–14, 18–32 y desde el 35′». */
function stintsText(st: readonly [number, number][], open: boolean): string {
  return andList(st.map(([a, b], i) => (open && i === st.length - 1 ? `desde el ${Math.round(a)}′` : `${Math.round(a)}⁠–⁠${Math.round(b)}`)));
}

export interface CampoSpot {
  id: string;
  left: number;
  top: number;
  short: string;
  num: string;
  sel: boolean;
  me: boolean;
  dim: boolean;
  captain: boolean;
  tag: { t: string; cls: string } | null;
  label: string;
}
export interface CampoRow {
  id: string;
  name: string;
  num: string;
  me: boolean;
  captain: boolean;
  sub: string;
  minText: string;
  hasTrack: boolean;
  ghost: { l: number; w: number }[];
  bars: { l: number; w: number }[];
  dots: { left: number; cls: string }[];
  headPct: number | null;
  ex: { m: number; dir: string; with: string; withId: string; cls: string }[];
  more: string;
  expandable: boolean;
  open: boolean;
  cls: string;
  label: string;
}
export interface CampoView {
  h: string;
  kicker: string;
  p: string;
  pitchLabel: string;
  spots: CampoSpot[];
  empty: { left: number; top: number }[];
  hasScrub: boolean;
  rangeText: string;
  now: string;
  pitchNote: string | null;
  minH: string;
  minSub: string;
  facts: { v: string; l: string }[];
  hasTracks: boolean;
  rows: CampoRow[];
  lists: { k: string; v: string }[];
  note: string | null;
}

export interface CampoIn {
  open: string | null;
  captain: string | null;
  system: string;
  meet: string | null;
  coverage: string | null;
  /** The kick-off is in the evening («El siete de esta noche»; else «de hoy»). */
  evening: boolean;
}

export function campoOf(c: Ctx, i: CampoIn): CampoView {
  const P = c.P;
  const f = c.fase;
  const m = c.m;
  const D = P?.duration ?? 50;
  const hasGame = hasGameOf(c);
  const live = isLiveF(f);
  const pre = isPreF(f);
  const nm = c.names.name;
  const evs = new Map<string, { k: "gol" | "card" | "pen" | "save"; m: number }[]>();
  const add = (id: string, k: "gol" | "card" | "pen" | "save", mm: number) => evs.set(id, [...(evs.get(id) ?? []), { k, m: mm }]);
  for (const p of P?.plays ?? []) {
    // (our plays only: a penalty given against us is theirs, as the boards draw it)
    if (p.side !== "us") continue;
    if (!p.who || p.m > c.edge) continue;
    if (p.k === "gol") add(p.who, "gol", p.m);
    if (p.k === "amarilla" || p.k === "roja") add(p.who, "card", p.m);
    if (p.k === "paradaPenalti") add(p.who, "save", p.m);
  }
  const tagFor = (id: string) => {
    const e = (evs.get(id) ?? []).filter((x) => x.m <= m).pop();
    if (!e) return null;
    return { gol: { t: `Gol ${e.m}′`, cls: "vd-tag--gold" }, card: { t: `Amarilla ${e.m}′`, cls: "vd-tag--amarilla" }, pen: { t: `Penalti ${e.m}′`, cls: "" }, save: { t: "Paró un penalti", cls: "" } }[e.k];
  };
  const slotOf = new Map((P?.lineup ?? []).map((s) => [s.id, s]));
  const slots = P ? (hasGame ? (P.onAt[Math.min(D, m)] ?? []) : P.lineup.map((s) => s.id)) : [];
  const spots: CampoSpot[] = [];
  const empty: { left: number; top: number }[] = [];
  P?.lineup.forEach((s, k) => {
    const id = slots[k];
    const left = s.x;
    const top = Number((6 + s.y * 0.86).toFixed(1));
    if (!id) {
      empty.push({ left, top });
      return;
    }
    const min = hasGame ? stintsAt(P.ledger[id], m).min : 0;
    spots.push({ id, left, top, short: c.names.short(id), num: c.names.num(id), sel: i.open === id, me: id === c.me, dim: f === "aplazado", captain: id === i.captain, tag: tagFor(id), label: `${nm(id)}, ${POSN[s.code] ?? s.code}${hasGame ? `: ${min} minutos` : ""}. Ver sus cambios` });
  });

  let ids: string[];
  if (hasGame && P) ids = Object.keys(P.ledger).sort((a, b) => P.ledger[b].min - P.ledger[a].min || P.ledger[a].st[0][0] - P.ledger[b].st[0][0] || nm(a).localeCompare(nm(b), "es"));
  else ids = [...(P?.lineup.map((s) => s.id) ?? []), ...(P?.match.bench ?? [])];
  const rows = ids.map((id): CampoRow => {
    const L = P?.ledger[id];
    const mine = id === c.me;
    const base: CampoRow = { id, name: nm(id), num: c.names.num(id), me: mine, captain: id === i.captain, sub: "", minText: "", hasTrack: hasGame, ghost: [], bars: [], dots: [], headPct: null, ex: [], more: "", expandable: false, open: false, cls: "", label: "" };
    if (!hasGame || !L) {
      const s = slotOf.get(id);
      base.sub = s ? `Sale de inicio · ${POSN[s.code] ?? s.code}` : f === "aplazado" ? "Convocado, en el banquillo" : "En el banquillo";
      base.minText = s ? s.code : "";
      base.label = `${base.name}, ${base.sub}`;
      base.cls = `${mine ? "is-me " : ""}is-plan`;
      base.hasTrack = false;
      return base;
    }
    const now = stintsAt(L, m);
    const ongoing = live && onFieldAt(L, m, D);
    const shown = now.st;
    base.minText = `${now.min}′`;
    base.sub = !shown.length ? (m < c.edge || live ? "Todavía sin entrar" : "Sin minutos") : L.st.length === 1 && L.st[0][0] === 0 && L.st[0][1] >= D && m >= D ? `Los ${D} minutos, sin salir` : `${CNT[shown.length] ?? `${shown.length} tramos`} · ${stintsText(shown, ongoing)}`;
    base.bars = shown.map(([a, b]) => ({ l: pct(a, D), w: barW(a, b, D) }));
    if (m < c.edge) base.ghost = L.st.filter(([a]) => a <= c.edge).map(([a, b]) => ({ l: pct(a, D), w: barW(a, Math.min(b, c.edge), D) }));
    base.dots = (evs.get(id) ?? []).map((e) => ({ left: pct(e.m, D), cls: `is-${e.k}${e.m > m ? " is-later" : ""}` }));
    base.headPct = m > 0 && m < D ? pct(m, D) : null;
    let seenIn = slotOf.has(id);
    base.ex = L.ex
      .filter((x) => x[0] <= c.edge)
      .map((x) => {
        const isIn = x[2] === 1;
        const word = isIn ? (seenIn ? "Vuelve" : "Entra") : "Sale";
        if (isIn) seenIn = true;
        return { m: x[0], dir: word, with: isIn ? `por ${nm(x[1])}` : `entra ${nm(x[1])}`, withId: x[1], cls: `${isIn ? "is-in" : "is-out"}${x[0] > m ? " is-later" : ""}` };
      });
    const more: string[] = [];
    if (L.pos) {
      const ps = Object.entries(L.pos).map(([k, v]) => `${k} ${Math.round(v)}′`);
      if (ps.length > 1) more.push(`Jugó de ${andList(ps)}.`);
    }
    if (L.g) more.push(L.g === 1 ? "Un gol." : `${L.g} goles.`);
    if (L.a) more.push(L.a === 1 ? "Un pase de gol." : `${L.a} pases de gol.`);
    if (L.sv) more.push(`${L.sv} ${L.sv === 1 ? "parada." : "paradas."}`);
    base.more = more.join(" ");
    base.expandable = base.ex.length > 0 || more.length > 0;
    base.open = i.open === id && base.expandable;
    base.cls = [base.open ? "is-open" : "", mine ? "is-me" : "", L.g ? "is-scorer" : "", live && !ongoing ? "is-off" : "", now.min === 0 ? "is-wait" : "", base.expandable ? "is-x" : ""].filter(Boolean).join(" ");
    base.label = `${base.name}, ${now.min} minutos${shown.length > 1 ? ` en ${shown.length} tramos` : ""}${base.expandable ? (base.open ? ". Cerrar sus cambios" : ". Ver sus cambios") : ""}`;
    return base;
  });

  const all = P ? Object.keys(P.ledger) : [];
  const playedN = all.filter((id) => stintsAt(P?.ledger[id], m).min > 0).length;
  const subsAt = (P?.plays ?? []).filter((p) => p.k === "cambio" && p.m <= m);
  let most: { id: string; n: number } | null = null;
  for (const id of all) {
    const n = stintsAt(P?.ledger[id], m).st.length;
    if (!most || n > most.n) most = { id, n };
  }
  const whole = all.filter((id) => m > 0 && stintsAt(P?.ledger[id], m).min >= m);
  const facts = hasGame
    ? [
        { v: String(playedN), l: "jugaron" },
        { v: String(subsAt.length), l: subsAt.length === 1 ? "cambio" : "cambios" },
        most && most.n > 1 ? { v: String(most.n), l: `tramos de ${nm(most.id)}, el que más` } : { v: String(all.filter((id) => onFieldAt(P?.ledger[id], m, D)).length), l: "en el campo" },
        { v: whole.length === 1 ? `${m}′` : String(whole.length), l: whole.length === 1 ? `${nm(whole[0])}, sin salir` : "sin salir" },
      ]
    : [];
  const lastSub = subsAt.length ? subsAt[subsAt.length - 1].m : null;
  const wave = lastSub !== null ? subsAt.filter((p) => p.m === lastSub) : [];
  const sc = c.P ? (m >= c.edge && c.score ? c.score : scoreAt(c.P.plays, m)) : { us: 0, them: 0 };
  const lists: { k: string; v: string }[] = [];
  const unused = hasGame && P ? [...(P.match.bench ?? []), ...(P.match.starters ?? [])].filter((id, k, a) => a.indexOf(id) === k && !stintsAt(P.ledger[id], c.edge).min) : [];
  if (unused.length) lists.push({ k: live ? "En el banquillo, sin entrar todavía:" : "Sin minutos:", v: `${andList(unused.map(nm))}.` });
  const notCalled = P?.match.notCalled ?? [];
  if (member(c.quien) && notCalled.length) lists.push({ k: hasGame ? "No convocados:" : "No vienen:", v: `${andList(notCalled.map(nm))}.` });
  if (!member(c.quien)) lists.push({ k: "Quién falta y por qué", v: "es cosa del vestuario." });
  const h = pre ? (i.evening ? "El siete de esta noche" : "El siete de hoy") : live ? "En el campo" : f === "aplazado" ? "La convocatoria" : f === "pendiente" ? "El siete que salió" : "Acabaron en el campo";
  const J = c.M?.j ? `J${c.M.j}` : "";
  return {
    h,
    kicker: [J, c.M?.rival, i.system].filter(Boolean).join(" · "),
    p: hasGame
      ? live
        ? "Arrastra el minuto y el campo cambia con cada cambio. Toca a uno para ver sus tramos."
        : "En F7 se entra y se sale las veces que haga falta: aquí, los minutos y los tramos de cada uno. Toca a uno y se abren sus cambios."
      : f === "aplazado"
        ? "La convocatoria como estaba. Se queda para la nueva fecha."
        : f === "pendiente"
          ? "El siete que salió. Los minutos y los cambios llegan con el acta."
          : "El siete que sacó el capitán de la pizarra, y el banquillo.",
    pitchLabel: hasGame ? `En el campo en el minuto ${m}` : "El siete",
    spots,
    empty,
    hasScrub: hasGame,
    rangeText: `Minuto ${m}, ${sc.us} a ${sc.them}`,
    now: `Minuto ${m} · ${scoreText(sc.us, sc.them)}. ${wave.length ? `El último cambio, en el ${lastSub}′: ${wave.length === 1 ? `entra ${wave[0].who ? nm(wave[0].who) : ""} por ${wave[0].out ? nm(wave[0].out) : ""}` : `entran ${andList(wave.map((p) => (p.who ? nm(p.who) : "")))}`}.` : "Todavía sin cambios."}`,
    pitchNote: hasGame ? null : f === "aplazado" ? "Aplazado: el siete se vuelve a sacar con la nueva fecha." : pre ? `${i.captain ? `Capitán: ${nm(i.captain)} (la C).` : ""}${i.meet ? ` Quedada a las ${i.meet}.` : ""}`.trim() || null : "Sin acta todavía: nada de minutos inventados.",
    minH: hasGame ? "Los minutos" : "La convocatoria",
    minSub: hasGame ? (live ? `Hasta el minuto ${m}: la barra crece con el partido.` : "Cada barra es un tramo en el campo; la raya del medio, el descanso.") : "El siete y el banquillo.",
    facts,
    hasTracks: hasGame,
    rows,
    lists,
    note: hasGame && i.coverage ? i.coverage : null,
  };
}

// ───────────────────────── /hoy/jugadas ─────────────────────────

export type JugFilter = 0 | 1 | 2 | 3;
export const JUG_FILTERS = ["Todo", "Goles", "Tarjetas", "Cambios"] as const;
const KEEP: (Partial<Record<PlayK, 1>> | null)[] = [null, { gol: 1, rival: 1 }, { amarilla: 1, roja: 1, rivalAmarilla: 1, rivalRoja: 1, penalti: 1 }, { cambio: 1 }];

export interface JugadasView {
  h: string;
  p: string;
  count: string;
  halves: { t: string; n: string; list: PlayRowV[]; empty: boolean; emptyT: string }[];
}

export function jugadasOf(c: Ctx, fi: JugFilter): JugadasView {
  const P = c.P;
  const f = c.fase;
  const m = c.m;
  const D = P?.duration ?? 50;
  const hasGame = hasGameOf(c);
  const keep = KEEP[fi];
  const all: Play[] = hasGame && P ? P.plays.filter((p) => p.m <= m) : [];
  const pick = all.filter((p) => !keep || keep[p.k]);
  const mk = (t: string, list: Play[]) => {
    const rows = playRows(list, c.names.name).reverse();
    return { t, n: list.length === 1 ? "1 jugada" : `${list.length} jugadas`, list: rows, empty: !rows.length, emptyT: fi ? "Nada de esto en esta parte." : "Sin jugadas en esta parte." };
  };
  const halves: JugadasView["halves"] = [];
  if (hasGame) {
    if (m > D / 2) halves.push(mk("Segunda parte", pick.filter((p) => p.m > D / 2)));
    halves.push(mk("Primera parte", pick.filter((p) => p.m <= D / 2)));
  } else
    halves.push({
      t: f === "aplazado" ? "Sin partido" : f === "pendiente" ? "Sin acta" : "Antes del pitido",
      n: "",
      list: [],
      empty: true,
      emptyT: f === "aplazado" ? "Este partido no se jugó: las jugadas llegarán con la nueva fecha." : f === "pendiente" ? "La mesa no arrancó el reloj: las jugadas salen con el acta." : "Todavía no hay jugadas: la primera llega con el pitido.",
    });
  const subs = all.filter((p) => p.k === "cambio");
  const waves = new Set(subs.map((p) => p.m)).size;
  const fan = !member(c.quien) && (f === "acta" || f === "final" || f === "semana");
  return {
    h: fan ? "La noche, jugada a jugada" : "Jugada a jugada",
    p: isLiveF(f) ? "Se añaden solas mientras la mesa anota. Las de cada minuto, juntas." : hasGame ? `Las ${(P?.plays ?? []).filter((p) => p.m <= c.edge).length} jugadas que anotó la mesa, de la última a la primera. Los cambios de un mismo minuto van juntos.` : "Aquí sale cada jugada en cuanto la mesa la anote.",
    count: hasGame ? `${all.length} jugadas hasta el ${m}′ · ${subs.length} ${subs.length === 1 ? "cambio" : "cambios"} en ${waves} ${waves === 1 ? "momento" : "momentos"}` : "",
    halves,
  };
}

// ───────────────────────── /hoy/lo-tuyo ─────────────────────────

export interface TuyoIn {
  tasks: TasksView;
  logro: { label: string; text: string; pct: number } | null;
  album: { owned: number; total: number; line: string } | null;
  carta: string;
  notices: { id: string; title: string; when: string; url: string }[];
  unread: number;
  pushI: 0 | 1 | 2 | null;
  pushSub: string;
}

export interface TuyoView {
  taskN: string;
  gameH: string;
  gameN: string;
  min: string;
  minL: string;
  line: string;
  hasTrack: boolean;
  bars: { l: number; w: number }[];
  trackLabel: string;
  ex: { m: number; dir: string; with: string; withId: string; cls: string }[];
  mine: { key: string; icon: string; t: string; sub: string; bar: number | null; barLabel: string; go: { t: string; href: string } | null; act: { t: string; sheet: "porra" } | null }[];
  avN: string;
}

export function tuyoOf(c: Ctx, i: TuyoIn): TuyoView | null {
  const me = c.me;
  const P = c.P;
  if (!me) return null;
  const D = P?.duration ?? 50;
  const hasGame = hasGameOf(c);
  const L = P?.ledger[me];
  const nm = c.names.name;
  const slot = P?.lineup.find((s) => s.id === me) ?? null;
  const v: TuyoView = { taskN: i.tasks.pending ? (i.tasks.pending === 1 ? "1 pendiente" : `${i.tasks.pending} pendientes`) : "Todo al día", gameH: "Tu partido", gameN: [c.M?.j ? `J${c.M.j}` : "", c.M?.rival].filter(Boolean).join(" · "), min: "", minL: "", line: "", hasTrack: false, bars: [], trackLabel: "", ex: [], mine: [], avN: i.unread ? (i.unread === 1 ? "1 nuevo" : `${i.unread} nuevos`) : "Al día" };
  const J = c.M?.j ? `la J${c.M.j}` : "el partido";
  if (hasGame && L) {
    const now = stintsAt(L, c.m);
    const st = now.st;
    v.min = `${now.min}′`;
    v.minL = isLiveF(c.fase) ? `llevas, en ${tramosWord(st.length)}` : `jugaste, en ${tramosWord(st.length)}`;
    v.line = st.length ? `De ${andList(st.map(([a, b]) => `${Math.round(a)} a ${Math.round(b)}`))}.${L.pos && Object.keys(L.pos).length > 1 ? ` Jugaste de ${andList(Object.entries(L.pos).map(([k, x]) => `${k} ${Math.round(x)}′`))}.` : ""}` : "Todavía sin entrar.";
    v.hasTrack = true;
    v.bars = st.map(([a, b]) => ({ l: pct(a, D), w: barW(a, b, D) }));
    v.trackLabel = `Tus tramos en el campo: ${st.map(([a, b]) => `${Math.round(a)} a ${Math.round(b)}`).join(", ")}`;
    let seen = !!slot;
    v.ex = L.ex
      .filter((x) => x[0] <= c.m)
      .map((x) => {
        const isIn = x[2] === 1;
        const w = isIn ? (seen ? "Vuelves" : "Entras") : "Sales";
        if (isIn) seen = true;
        return { m: x[0], dir: w, with: isIn ? `por ${nm(x[1])}` : `entra ${nm(x[1])}`, withId: x[1], cls: isIn ? "is-in" : "is-out" };
      });
  } else if (hasGame) {
    v.min = "0′";
    v.minL = "esta vez";
    v.line = c.quien === "anotador" ? `No jugaste ${J}: estuviste en la mesa, y el acta lleva tu firma.` : `No jugaste ${J}.`;
  } else if (slot) {
    v.min = slot.code;
    v.minL = "sales de inicio";
    v.line = `De ${POSN[slot.code] ?? slot.code} en el ${P?.match.system ?? "3-2-1"}.`;
  } else {
    const bench = !!P?.match.bench?.includes(me);
    v.min = bench ? "Banq." : "—";
    v.minL = bench ? "empiezas en el banquillo" : "esta vez no juegas";
    v.line = c.quien === "anotador" ? "Hoy anotas tú en la mesa: «¿Quién ha venido?», el reloj y cada jugada." : "Te toca esperar tu momento: en F7 se entra y se sale.";
  }
  const played = hasGame;
  const scE = scoreEdge(c);
  v.mine = [
    { key: "porra", icon: "ball", t: c.porra ? `Tu porra: ${scoreText(c.porra.us, c.porra.them)}` : "Tu porra, sin poner", sub: isLiveF(c.fase) ? `Va ${scoreText(c.score?.us ?? 0, c.score?.them ?? 0)}.` : played ? `Acabó ${scoreText(scE.us, scE.them)}.` : "Se cierra con el pitido.", bar: null, barLabel: "", go: null, act: !played ? { t: c.porra ? "Cambiarla" : "Ponerla", sheet: "porra" } : null },
    ...(i.logro ? [{ key: "logro", icon: "trophy", t: i.logro.label, sub: i.logro.text, bar: i.logro.pct, barLabel: i.logro.pct >= 100 ? "Conseguido" : `${i.logro.pct} %`, go: { t: "Logros", href: "/perfil" }, act: null }] : []),
    ...(i.album ? [{ key: "album", icon: "star", t: `${i.album.owned} de ${i.album.total} cromos`, sub: i.album.line, bar: i.album.total ? Math.round((i.album.owned / i.album.total) * 100) : 0, barLabel: `${i.album.owned} de ${i.album.total}`, go: { t: "Álbum", href: "/plantilla" }, act: null }] : []),
    { key: "carta", icon: "shirt", t: "Tu carta", sub: i.carta, bar: null, barLabel: "", go: { t: "Verla", href: "/perfil" }, act: null },
  ];
  void D;
  return v;
}
