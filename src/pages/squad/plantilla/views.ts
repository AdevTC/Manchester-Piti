// «Plantilla» (the PL- boards): every screen's words and numbers, as the boards' renderVals writes them, over the
// model (model.ts). Pure: the page passes the state of the screen, who looks and the squad; it wires the handlers.
import type { ClubMatch } from "../../../lib/clubData";
import { dateMillis } from "../../../lib/clubData";
import { TonightWord } from "../../../lib/derived/madrid";
import { exchangeMinute } from "../../../lib/partidos";
import { hasAnalysisActions } from "../../../lib/technicalAnalysis";
import type { Achievement } from "../../../lib/derived/achievements";
import {
  SPOTS,
  MONTHS_L,
  adn,
  age,
  album,
  avail,
  birthday,
  heightText,
  joinY,
  leaders,
  lineName,
  lineOrder,
  medals,
  missing,
  partner,
  partners,
  passesBetween,
  podium,
  posLabel,
  posName,
  posOf,
  positions,
  radar,
  radarAvg,
  scoring,
  sign,
  stats,
  techOf,
  type AdnDay,
  type Ctx,
  type PPlayer,
  type PStats,
} from "./model";
import { POS_CODES, type Line } from "../../../lib/positions";

export const SECS = ["ficha", "temporada", "jornadas", "juego", "analisis", "cromo"] as const;
export type Sec = (typeof SECS)[number];
export const SEC_LABEL: Record<Sec, string> = { ficha: "Ficha", temporada: "Temporada", jornadas: "Jornadas", juego: "Juego", analisis: "Análisis", cromo: "Cromo" };
export type Screen = "home" | "cara" | "album" | "player" | "noexiste" | "cargando" | "error";
export type AlFilter = "todos" | "tengo" | "faltan";
export type AnCat = "pases" | "remate" | "defensa" | "parado";
export type Quien = "fan" | "socio" | "jugador" | "capitan";

export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dot = (s: string) => s.replace(/\.\.$/, ".");
const f1 = (v: number) => v.toFixed(1).replace(".", ",");
const pctx = (a: number, b: number) => (b ? `${String(Math.round((a / b) * 1000) / 10).replace(".", ",")} %` : "—");
const many = (n: number, one?: string, other?: string) => (n === 1 ? `uno${one ? ` ${one}` : ""}` : n ? `${n}${other ? ` ${other}` : ""}` : `ninguno${one ? ` ${one}` : ""}`);
const madrid = (ms: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ...o }).format(ms);
export const clock = (ms: number) => madrid(ms, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const NUMW = ["ninguno", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis"];
const word = (n: number) => NUMW[n] ?? String(n);
const Word = (n: number) => {
  const w = n === 1 ? "Uno" : word(n);
  return w.charAt(0).toLocaleUpperCase("es") + w.slice(1);
};

// ── who looks and the squad
export interface Who {
  quien: Quien;
  member: boolean;
  admin: boolean;
  /** His own ficha (a player member). */
  me: string | null;
}
export interface Squad {
  /** The season's squad, dorsal order. */
  ids: string[];
  by: Map<string, PPlayer>;
  seasonId: string;
  seasonName: string;
  now: number;
  captain: string | null;
  matches: ClubMatch[];
  seasons: { id: string; name: string }[];
  cur: Ctx;
  jornadaOf: (matchId: string) => number | undefined;
  /** Another season's period, or every season's («all»), built when a screen asks for it. */
  seasonCtx: (seasonId: string) => Ctx;
}
export const numOf = (S: Squad) => (id: string) => S.by.get(id)?.n ?? 999;
const nm = (S: Squad, id: string) => S.by.get(id)?.name ?? "Un compañero";
const names = (S: Squad, ids: readonly string[]) => joinY(ids.map((id) => nm(S, id)));

// ── match day and the last match: each one's line on the percha
export interface Tag {
  cls: string;
  text: string;
}
export interface Line_ {
  status: string;
  tone: string;
  tags: Tag[];
  /** The percha's group on match day (0 the seven / on the pitch / played …). */
  grp: number;
  label: string;
}
export type Stage = "pre" | "live" | "after" | null;
export interface DayInput {
  stage: Stage;
  match: ClubMatch | null;
  /** The live minute. */
  minute: number | null;
  score: { gf: number; ga: number } | null;
  /** squadLive's rows (status/tone/tags) for live and after. */
  live: Map<string, { status: string; tone: string; tags: { kind: string; text: string; gold: boolean }[] }>;
  /** The convocatoria's answers by player (members only; null for a fan). */
  rsvp: Map<string, "yes" | "no" | "maybe"> | null;
  /** Who keeps la mesa (members only). */
  mesa: string[];
  /** Who won the closed MVP vote of the match. */
  mvp: string[];
  /** The last finished match of the season (the percha's words on any other day). */
  last: ClubMatch | null;
  /** The next match to play (the lede). */
  next: ClubMatch | null;
}
const TAGW: Record<string, string> = { gol: "Gol", asis: "Asist.", amarilla: "Amarilla", roja: "Roja", parada: "Paró", cambio: "Entró", minutos: "" };

export function matchLines(S: Squad, D: DayInput): Map<string, Line_> {
  const out = new Map<string, Line_>();
  const m = D.match;
  const stage = D.stage;
  const lineup = m ? [...(m.starters ?? [])] : [];
  for (const id of S.ids) {
    const p = S.by.get(id)!;
    const av = avail(p, S.jornadaOf);
    if (!stage || !m) {
      const l = D.last;
      const row = l?.ledger?.[id];
      if (av) {
        out.set(id, { status: av.status, tone: "is-off", tags: [], grp: 2, label: av.text });
        continue;
      }
      if (!l || !l.ledger) continue;
      const j = S.jornadaOf(l.id);
      const jj = j ? `la J${j}` : "el último partido";
      if (row?.played) {
        const tg: Tag[] = [];
        for (const e of l.events ?? []) {
          if (e.playerId !== id || e.dupOf) continue;
          const mm = Math.max(1, Math.ceil(e.elapsedSeconds != null ? e.elapsedSeconds / 60 : (e.minute ?? 0)));
          if (e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick") tg.push({ cls: "vd-tag--gol", text: `Gol ${mm}′` });
          if (e.type === "yellow_card") tg.push({ cls: "vd-tag--amarilla", text: `Amarilla ${mm}′` });
          if (e.type === "red_card") tg.push({ cls: "vd-tag--roja", text: `Roja ${mm}′` });
          if (e.type === "penalty_committed") tg.push({ cls: "", text: `Penalti ${mm}′` });
          if (e.type === "penalty_saved") tg.push({ cls: "vd-tag--parada", text: `Paró ${mm}′` });
        }
        const min = Math.round(row.minutes);
        const tramos = row.stints?.length ?? 0;
        out.set(id, { status: `Jugó ${min}′`, tone: "is-on", tags: tg.slice(0, 3), grp: 0, label: `Jugó ${min} minutos en ${jj}${tramos > 1 ? `, en ${tramos} tramos` : ""}` });
      } else if (row?.benched) out.set(id, { status: "No jugó", tone: "is-bench", tags: [], grp: 1, label: "Convocado, no jugó" });
      else out.set(id, { status: "No convocado", tone: "is-off", tags: [], grp: 2, label: `No convocado para ${jj}` });
      continue;
    }
    if (av && stage === "pre") {
      out.set(id, { status: av.status, tone: "is-off", tags: [], grp: 2, label: av.text });
      continue;
    }
    const inSeven = lineup.includes(id);
    const onBench = (m.bench ?? []).includes(id) && !inSeven;
    const mesa = D.mesa.includes(id);
    if (stage === "pre") {
      if (D.rsvp) {
        const r = D.rsvp.get(id);
        const w = r === "yes" ? "Voy" : r === "maybe" ? "Duda" : r === "no" ? "No viene" : mesa ? "En la mesa" : "Sin responder";
        const tone = w === "Voy" ? "is-on" : w === "Duda" ? "is-doubt" : w === "En la mesa" ? "is-mesa" : "is-off";
        const tags: Tag[] = inSeven ? [{ cls: "pl-tag--seven", text: "En el siete" }] : onBench ? [{ cls: "pl-tag--bench", text: "Banquillo" }] : [];
        out.set(id, { status: w, tone, tags, grp: inSeven ? 0 : onBench ? 1 : mesa ? 3 : 2, label: w + (tags.length ? `, ${tags[0].text.toLocaleLowerCase("es")}` : "") });
      } else {
        const w = inSeven ? "En el siete" : onBench ? "Convocado" : "No juega hoy";
        out.set(id, { status: w, tone: inSeven ? "is-on" : onBench ? "is-bench" : "is-off", tags: [], grp: inSeven ? 0 : onBench ? 1 : 2, label: w });
      }
      continue;
    }
    const sl = D.live.get(id);
    const tags: Tag[] = (sl?.tags ?? []).slice(0, 3).map((t) => ({ cls: `vd-tag--${t.kind}${t.gold && stage === "live" ? " vd-tag--gold" : ""}`, text: TAGW[t.kind] ? `${TAGW[t.kind]} ${t.text}` : t.text }));
    if (stage === "live") {
      if (mesa && !sl?.tone.includes("on")) {
        out.set(id, { status: "En la mesa", tone: "is-mesa", tags: [], grp: 3, label: "En la mesa" });
        continue;
      }
      const st = sl?.status ?? "No juega hoy";
      const tone = sl?.tone === "on" ? "is-on" : sl?.tone === "bench" ? "is-bench" : "is-off";
      out.set(id, { status: st, tone, tags: tone === "is-off" ? [] : tags, grp: tone === "is-on" ? 0 : tone === "is-bench" ? 1 : 2, label: st });
      continue;
    }
    // after
    const row = m.ledger?.[id];
    const played = row ? row.played : sl?.status === "Jugó" || sl?.status?.startsWith("Logro") || sl?.status === "MVP del partido";
    if (D.mvp.includes(id)) out.set(id, { status: "MVP del partido", tone: "is-mvp", tags, grp: 0, label: "MVP del partido" });
    else if (played) {
      const debut = sl?.status === "Logro «Debut»";
      out.set(id, { status: debut ? "Debutó" : "Jugó", tone: "is-on", tags, grp: 0, label: debut ? "Jugó y debutó" : "Jugó" });
    } else if (row?.benched || onBench) out.set(id, { status: "No jugó", tone: "is-bench", tags: [], grp: 1, label: "No jugó" });
    else if (mesa) out.set(id, { status: "En la mesa", tone: "is-mesa", tags: [], grp: 3, label: "Llevó la mesa" });
    else out.set(id, { status: "No convocado", tone: "is-off", tags: [], grp: 2, label: "No convocado" });
  }
  return out;
}

// ── the state of the screen
export interface ViewState {
  screen: Screen;
  focus: string | null;
  sec: Sec;
  period: "cur" | "all";
  duelA: string;
  duelB: string;
  pick: "a" | "b" | null;
  alFilter: AlFilter;
  kit: "home" | "away";
  orden: "dorsal" | "posicion";
  q: string;
  bdayOpen: boolean;
  numOpen: boolean;
  anCat: AnCat;
  anNotes: boolean;
  adnSel: number | null;
  radarVs: "media" | "socio";
  turned: boolean;
  flip: boolean;
  run: number;
  flyHome: string | null;
  said: string;
}

// ── la percha
export interface Hanger {
  id: string;
  num: string;
  name: string;
  pos: string;
  me: boolean;
  status: string;
  tone: string;
  tags: Tag[];
  sep: string;
  vtn: string;
  cur: boolean;
  cls: string;
  label: string;
}
export function railView(S: Squad, st: ViewState, who: Who, lines: Map<string, Line_>, stage: Stage) {
  const isHome = st.screen === "home";
  const focus = st.screen === "player" ? st.focus : null;
  const matchday = !!stage;
  let ids = S.ids.slice();
  const q = fold(st.q).trim();
  if (q && isHome) ids = ids.filter((id) => {
    const p = S.by.get(id)!;
    return /^\d+$/.test(q) ? p.num === q : fold(`${p.name} ${p.shirt} ${p.full}`).includes(q);
  });
  let sepOf: (id: string) => string = () => "";
  const num = numOf(S);
  if (matchday) {
    const lu = S.ids;
    const grp = (id: string) => lines.get(id)?.grp ?? 2;
    ids.sort((a, b) => grp(a) - grp(b) || lu.indexOf(a) - lu.indexOf(b) || num(a) - num(b));
    const GN = stage === "pre" ? ["El siete", "Banquillo", "No vienen o no han dicho", "La mesa"] : stage === "live" ? ["En el campo", "Banquillo y cambiados", "No juegan hoy", "La mesa"] : ["Jugaron", "Banquillo", "No convocados", "La mesa"];
    sepOf = (id) => GN[grp(id)];
  } else if (st.orden === "posicion") {
    ids.sort((a, b) => lineOrder(posOf(S.by.get(a)!).line) - lineOrder(posOf(S.by.get(b)!).line) || num(a) - num(b));
    sepOf = (id) => LINE_LABEL[posOf(S.by.get(id)!).line];
  }
  const loading = st.screen === "cargando";
  if (st.screen === "error") ids = [];
  const picking = st.screen === "cara";
  const target = st.pick ?? "b";
  let lastSep: string | null = null;
  const rail: Hanger[] = ids.map((id) => {
    const p = S.by.get(id)!;
    const m = lines.get(id);
    const sep = isHome ? sepOf(id) : "";
    const showSep = sep && sep !== lastSep ? sep : "";
    lastSep = sep;
    const sel = focus === id || (picking && (id === st.duelA || id === st.duelB));
    return {
      id,
      num: p.num,
      name: loading ? "" : p.name,
      pos: posOf(p).name,
      me: id === who.me && !loading,
      status: m && isHome ? m.status : "",
      tone: m ? m.tone : "",
      tags: m && isHome ? m.tags : [],
      sep: showSep,
      vtn: isHome && st.flyHome === id ? "pl-flight" : "none",
      cur: focus === id,
      cls: [sel ? "is-sel" : "", m ? m.tone : "", picking ? "is-pickable" : "", loading ? "is-ghost" : ""].filter(Boolean).join(" "),
      label: loading
        ? "Cargando"
        : picking
          ? `Poner a ${p.name} en la esquina ${target === "a" ? "1" : "2"}`
          : `${p.name}${p.num ? `, dorsal ${p.num}` : ""}${m ? `: ${m.label}${m.tags.length ? `, ${m.tags.map((t) => t.text).join(", ")}` : ""}` : ""}. Abrir su ficha`,
    };
  });
  const count = S.ids.length;
  const percha = {
    cls: [isHome ? "is-full" : "is-strip", picking ? "is-picking" : ""].filter(Boolean).join(" "),
    label: picking ? `Elige jugador para la esquina ${target === "a" ? "1" : "2"}` : "La plantilla en su percha: elige jugador",
    hint: loading
      ? "Colgando las camisetas…"
      : st.screen === "error"
        ? ""
        : !isHome
          ? focus
            ? "La percha: toca otra camiseta para cambiar de jugador"
            : picking
              ? ""
              : "La percha: toca una camiseta para abrir su ficha"
          : `${ids.length === count ? `${count} camisetas` : `${ids.length} de ${count}`}${matchday ? " · la percha sigue la convocatoria" : " · toca una para abrir su ficha"}`,
  };
  const pick = { on: picking, title: `Toca una camiseta: va a la esquina ${target === "a" ? "1." : "2."}`, sub: "«Cambiar» elige la otra esquina." };
  return { rail, percha, pick, empty: !loading && st.screen !== "error" && ids.length === 0 && S.ids.length > 0 };
}
const LINE_LABEL: Record<Line, string> = { POR: "Porteros", DEF: "Defensas", MED: "Medios", DEL: "Delanteros" };

// ── the lede
export function ledeView(S: Squad, D: DayInput, loading: boolean, error: boolean): { l: string; s: string } {
  const n = S.ids.length;
  if (loading) return { l: "La plantilla de la temporada.", s: "La plantilla de la temporada." };
  if (error) return { l: "No se ha podido cargar la plantilla.", s: "No se ha podido cargar la plantilla." };
  if (!n) return { l: `Todavía no hay jugadores en ${S.seasonName}.`, s: "Todavía no hay jugadores." };
  const base = `Los ${n} de la ${S.seasonName}.`;
  const baseS = `Los ${n}.`;
  const m = D.match;
  const rival = m?.rival ?? "el rival";
  if (D.stage === "pre" && m) {
    const seven = (m.starters ?? []).length;
    const bench = (m.bench ?? []).filter((id) => !(m.starters ?? []).includes(id)).length;
    const ko = dateMillis(m.date);
    const when = TonightWord(ko);
    const line = seven ? `${when}, ${word(seven)} en el siete y ${bench ? `${word(bench)} en el banquillo` : "nadie en el banquillo"}.` : `${when} jugamos contra ${rival}.`;
    return { l: `${line}${seven ? ` Contra ${rival}${Number.isFinite(ko) ? ` a las ${clock(ko)}` : ""}, ${m.home !== false ? "en casa" : "fuera"}.` : ""}`, s: line };
  }
  if (D.stage === "live" && m) {
    const on = [...D.live.values()].filter((r) => r.tone === "on").length;
    const sc = D.score;
    const verb = sc ? (sc.gf > sc.ga ? "Vamos" : sc.gf < sc.ga ? "Perdemos" : "Empatamos") : "";
    return { l: `Ahora, ${word(on)} en el campo.${sc ? ` ${verb} ${sc.gf}–${sc.ga}${D.minute != null ? ` en el ${D.minute}′` : ""} contra ${rival}.` : ""}`, s: `Ahora, ${word(on)} en el campo.` };
  }
  if (D.stage === "after" && m) {
    const k = S.ids.filter((id) => m.ledger?.[id]?.played || D.live.get(id)?.tone === "on" || D.live.get(id)?.tone === "bench").length;
    const gf = m.goalsFor ?? D.score?.gf ?? 0;
    const ga = m.goalsAgainst ?? D.score?.ga ?? 0;
    const res = gf > ga ? "Ganamos" : gf < ga ? "Perdimos" : "Empatamos";
    const mvp = D.mvp.length ? ` y el MVP es ${names(S, D.mvp)}` : "";
    const one = `${Word(k)} ${k === 1 ? "jugó" : "jugaron"} contra ${rival}.`;
    return { l: `${Word(k)} ${k === 1 ? "jugó" : "jugaron"} contra ${rival}. ${res} ${gf}–${ga}${mvp}.`, s: one };
  }
  // any other day: the last match and the next one
  const l = D.last;
  const next = D.next;
  const nextLine = next ? nextPhrase(S, next) : "";
  if (l && l.ledger) {
    const k = S.ids.filter((id) => l.ledger?.[id]?.played).length;
    const j = S.jornadaOf(l.id);
    const first = j === 1;
    const sc = `${l.goalsFor ?? 0}–${l.goalsAgainst ?? 0}`;
    const what = first ? `el debut contra ${l.rival ?? "el rival"} (${sc})` : `${j ? `la J${j}` : "el último partido"} contra ${l.rival ?? "el rival"} (${sc})`;
    return { l: `${base} ${Word(k)} ${k === 1 ? "jugó" : "jugaron"} ${what}${nextLine ? `; ${nextLine}` : ""}.`, s: `${baseS} ${Word(k)} ${k === 1 ? "jugó" : "jugaron"} ${first ? "el debut" : j ? `la J${j}` : "el último partido"}.` };
  }
  if (next) {
    const ko = dateMillis(next.date);
    const d = Number.isFinite(ko) ? `el ${madrid(ko, { weekday: "long" })} ${madrid(ko, { day: "numeric" })}` : "pronto";
    return { l: `${base} La primera acta llega ${d}, contra ${next.rival ?? "el rival"}.`, s: `${baseS} Se estrenan ${d}.` };
  }
  return { l: `${base} Toca una camiseta para abrir su ficha.`, s: `Los ${n} de la temporada. Toca una camiseta.` };
}
function nextPhrase(S: Squad, next: ClubMatch): string {
  const j = S.jornadaOf(next.id);
  const ko = dateMillis(next.date);
  const d = Number.isFinite(ko) ? `el ${madrid(ko, { weekday: "long" })} ${madrid(ko, { day: "numeric" })}` : "pronto";
  const where = next.home !== false ? `en casa contra ${next.rival ?? "el rival"}` : `en casa de ${next.rival ?? "el rival"}`;
  return `${j ? `la J${j}` : "el siguiente"}, ${d} ${where}`;
}

// ── home: el equipo · pichichi · doors and birthdays
export function homeView(S: Squad, st: ViewState, who: Who, D: DayInput, lines: Map<string, Line_>) {
  const now = S.now;
  const count = S.ids.length;
  const P = (id: string) => S.by.get(id)!;
  const ages = S.ids.map((id) => age(P(id), now)).filter((a): a is number => a != null);
  const avg = ages.length ? f1(ages.reduce((a, b) => a + b, 0) / ages.length) : "—";
  const quinta = new Map<string, number>();
  for (const id of S.ids) {
    const b = P(id).birth;
    if (b) quinta.set(b.slice(2, 4), (quinta.get(b.slice(2, 4)) ?? 0) + 1);
  }
  const qk = [...quinta.entries()].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0];
  const incompletes = S.ids.filter((id) => missing(P(id)).length);
  const bdays = S.ids
    .map((id) => ({ id, b: birthday(P(id), now) }))
    .filter((x): x is { id: string; b: NonNullable<ReturnType<typeof birthday>> } => !!x.b)
    .sort((a, b) => a.b.days - b.b.days || numOf(S)(a.id) - numOf(S)(b.id));
  const bdayList = (st.bdayOpen ? bdays : bdays.slice(0, 3)).map((x) => ({ id: x.id, num: P(x.id).num, name: P(x.id).name, label: x.b.label, when: x.b.when, turns: String(x.b.turns), cls: x.b.days === 0 ? "is-today" : "" }));
  if (st.bdayOpen) for (const id of S.ids) if (!P(id).birth) bdayList.push({ id, num: P(id).num, name: P(id).name, label: "—", when: "sin fecha", turns: "", cls: "is-none" });
  const matchday = !!D.stage;
  const eq = {
    title: matchday ? "El equipo, hoy" : "El equipo",
    sub: S.seasonName,
    sum: [
      { v: String(count), t: count === 1 ? "jugador" : "jugadores" },
      { v: avg, t: "años de media" },
      { v: qk ? String(qk[1]) : "—", t: qk ? `de la quinta del ${qk[0]}` : "sin fechas" },
      { v: String(incompletes.length), t: "fichas por completar" },
    ],
    lines: (["POR", "DEF", "MED", "DEL"] as const)
      .map((L) => {
        const xs = S.ids.filter((id) => posOf(P(id)).line === L);
        return { t: `${xs.length} ${lineName(L, xs.length)}`, names: names(S, xs), n: xs.length };
      })
      .filter((l) => l.n > 0),
    bdays: bdayList,
    bdayOpen: st.bdayOpen,
    bdayBtn: st.bdayOpen ? "Ver menos" : `Los ${count} cumpleaños`,
    bdayIcon: st.bdayOpen ? ("collapse" as const) : ("expand" as const),
    noConv: !matchday,
    conv: null as null | { segs: { cls: string; n: number; t: string }[]; title: string; alt: string; link: string; href: string },
    admin: who.admin && incompletes.length > 0 ? { t: `${incompletes.length} ${incompletes.length === 1 ? "ficha por completar:" : "fichas por completar:"}`, d: `${names(S, incompletes)}.` } : null,
  };
  if (matchday && D.match) {
    const grpN = (g: number) => S.ids.filter((id) => lines.get(id)?.grp === g).length;
    const toneN = (t: string) => S.ids.filter((id) => lines.get(id)?.tone === t).length;
    let segs: { cls: string; n: number; t: string }[];
    if (D.stage === "pre")
      segs = D.rsvp
        ? [
            { cls: "is-on", n: toneN("is-on"), t: "vienen" },
            { cls: "is-doubt", n: toneN("is-doubt"), t: "en duda" },
            { cls: "is-off", n: S.ids.filter((id) => lines.get(id)?.status === "No viene").length, t: "no pueden" },
            { cls: "is-none", n: S.ids.filter((id) => lines.get(id)?.status === "Sin responder").length, t: "sin responder" },
          ]
        : [
            { cls: "is-on", n: grpN(0), t: "en el siete" },
            { cls: "is-mid", n: grpN(1), t: "en el banquillo" },
            { cls: "is-off", n: grpN(2), t: "no juegan hoy" },
          ];
    else if (D.stage === "live") segs = [{ cls: "is-on", n: grpN(0), t: "en el campo" }, { cls: "is-mid", n: grpN(1), t: "en el banquillo" }, { cls: "is-off", n: grpN(2), t: "no juegan hoy" }, { cls: "is-none", n: grpN(3), t: "en la mesa" }];
    else segs = [{ cls: "is-on", n: grpN(0), t: "jugaron" }, { cls: "is-mid", n: grpN(1), t: "sin minutos" }, { cls: "is-off", n: grpN(2), t: "no convocados" }, { cls: "is-none", n: grpN(3), t: "en la mesa" }];
    segs = segs.filter((s) => s.n > 0);
    const ko = dateMillis(D.match.date);
    eq.conv = {
      segs,
      title: D.stage === "pre" ? `La convocatoria, a las ${clock(now)}` : D.stage === "live" ? `En juego, minuto ${D.minute ?? 0}` : "El partido de cada uno",
      alt: segs.map((c) => `${c.n} ${c.t}`).join(", "),
      link: D.stage === "pre" ? `Ver el partido: ${D.match.rival ?? "el rival"}${Number.isFinite(ko) ? ` a las ${clock(ko)}` : ""}` : D.stage === "live" ? "Ver el partido en directo" : "Ver el acta del partido",
      href: `/partidos/${D.match.id}`,
    };
  }
  const cur = S.cur;
  const actas = cur.games.length > 0;
  const pod = podium(S.ids, cur, numOf(S));
  const lg = leaders(S.ids, cur, "g");
  const la = leaders(S.ids, cur, "a");
  const lastJ = cur.games.length ? S.jornadaOf(cur.games[cur.games.length - 1].id) : undefined;
  const pi = {
    sub: `${S.seasonName}${!actas ? " · aún sin actas" : lastJ ? ` · después de la J${lastJ}` : ""}`,
    title: !lg.n ? "¿Quién será el primer Pichichi?" : lg.ids.length > 1 ? `Pichichi compartido: ${names(S, lg.ids)}, ${lg.n}${lg.n === 1 ? " gol." : " goles."}` : `${nm(S, lg.ids[0])}, Pichichi: ${lg.n}${lg.n === 1 ? " gol." : " goles."}`,
    assists: !la.n
      ? "La tabla arranca en cero para todos y se actualiza sola con cada gol y cada asistencia del acta."
      : la.ids.length === 1
        ? `${nm(S, la.ids[0])} es quien más goles regala: ${la.n}${la.n === 1 ? " asistencia." : " asistencias."}`
        : `${names(S, la.ids)} comparten el liderato: ${la.n}${la.n === 1 ? " asistencia" : " asistencias"} cada uno.`,
    steps: [1, 0, 2].map((k) => {
      const r = pod.slice(0, 3)[k];
      if (!r) return { has: false as const, cls: `is-p${k + 1}`, place: k + 1, placeText: `Puesto ${k + 1}: por decidir` };
      const shared = pod.slice(0, 3).filter((x) => x.place === r.place).length > 1;
      const p = P(r.id);
      return {
        has: true as const,
        id: r.id,
        num: p.num,
        cls: `is-p${r.place}`,
        name: p.name,
        goals: `${r.g}${r.g === 1 ? " gol" : " goles"}${shared ? " · compartido" : ""}`,
        place: r.place,
        placeText: `Puesto ${r.place}${shared ? ", compartido" : ""}`,
        label: `${p.name}, puesto ${r.place}${shared ? " compartido" : ""}, ${r.g} goles. Ver su temporada`,
      };
    }),
  };
  const albMe = who.me && S.by.has(who.me) ? album(who.me, S.matches, S.ids, S.seasonId, S.cur.jornada) : null;
  const door = {
    a: st.duelA,
    b: st.duelB,
    cara: `${nm(S, st.duelA)} contra ${nm(S, st.duelB)}: elige a dos y compáralos`,
    albumT: who.me ? "Tu álbum" : "El álbum",
    album: albMe ? `${albMe.owned.length} de ${count} cromos · ${albMe.line}` : `Los ${count} cromos de la temporada`,
    albumIds: (albMe && albMe.owned.length ? albMe.owned : S.ids).slice(0, 3),
  };
  return { eq, pi, door };
}

// ── cara a cara
export interface DuelRow {
  t: string;
  hint: string;
  av: string;
  bv: string;
  ap: number;
  bp: number;
  aw: string;
  bw: string;
  cls: string;
}
export function duelView(S: Squad, st: ViewState) {
  const A = S.by.get(st.duelA)!;
  const B = S.by.get(st.duelB)!;
  const ctx = S.cur;
  const sa = stats(A.id, ctx);
  const sb = stats(B.id, ctx);
  const actas = ctx.games.length > 0;
  const noMin = sa.min == null || sb.min == null;
  const ga = (x: PStats) => (!x.pj ? null : noMin ? (x.g + x.a) / x.pj : x.min ? (x.g + x.a) / (x.min / 50) : null);
  const raA = scoring(A.id, ctx);
  const raB = scoring(B.id, ctx);
  const meA = medals(A.id, S.matches, ctx, S.seasons);
  const meB = medals(B.id, S.matches, ctx, S.seasons);
  const paA = partner(A.id, S.ids, ctx);
  const paB = partner(B.id, S.ids, ctx);
  const wins = { a: 0, b: 0, n: 0 };
  const row = (t: string, av: number | null, bv: number | null, fmt: (x: number) => string, floor: number, better: "more" | "less" | null, hint = ""): DuelRow => {
    const na = av == null;
    const nb = bv == null;
    const mx = Math.max(na ? 0 : av, nb ? 0 : bv, floor + 1);
    const pa = na ? 0 : Math.max(6, Math.round(((av - floor) / (mx - floor)) * 100));
    const pb = nb ? 0 : Math.max(6, Math.round(((bv - floor) / (mx - floor)) * 100));
    let aw = "";
    let bw = "";
    if (better && !na && !nb) {
      wins.n++;
      if (av !== bv) {
        const aWins = better === "more" ? av > bv : av < bv;
        if (aWins) {
          aw = "is-win";
          wins.a++;
        } else {
          bw = "is-win";
          wins.b++;
        }
      }
    }
    return { t, hint, av: na ? "—" : fmt(av), bv: nb ? "—" : fmt(bv), ap: pa, bp: pb, aw: `${aw}${na ? " is-none" : ""}`.trim(), bw: `${bw}${nb ? " is-none" : ""}`.trim(), cls: "" };
  };
  const trow = (t: string, av: string, bv: string): DuelRow => ({ t, hint: "", av, bv, ap: 0, bp: 0, aw: "is-text", bw: "is-text", cls: "is-text" });
  const id_ = (x: number) => String(x);
  const yr = (x: number) => `${x} años`;
  const kg = (x: number) => `${x} kg`;
  const mn = (x: number) => `${x}′`;
  const pc = (x: number) => `${Math.round(x)} %`;
  const now = S.now;
  let rows: DuelRow[] = [row("Edad", age(A, now), age(B, now), yr, 17, null), row("Altura", A.h, B.h, (x) => heightText(x) ?? "—", 150, "more"), row("Peso", A.w, B.w, kg, 50, null)];
  const hito = (m: Achievement | undefined) => (m && m.progress ? `${m.label} · faltan ${Math.max(0, m.progress.goal - m.progress.now)}` : "—");
  if (actas)
    rows = rows.concat([
      row("Partidos", sa.pj, sb.pj, id_, 0, "more"),
      row("Goles", sa.g, sb.g, id_, 0, "more"),
      row("Asistencias", sa.a, sb.a, id_, 0, "more"),
      row("Minutos", sa.min, sb.min, mn, 0, "more"),
      row(noMin ? "G+A por partido" : "G+A por 50′", ga(sa), ga(sb), f1, 0, "more", noMin ? "sin minutos en las actas" : ""),
      row("Victorias con él", sa.pj ? (sa.wins / sa.pj) * 100 : null, sb.pj ? (sb.wins / sb.pj) * 100 : null, pc, 0, "more"),
      row("Racha marcando", raA.now, raB.now, (x) => `${x}${x === 1 ? " partido" : " partidos"}`, 0, "more", `la mejor: ${raA.best} y ${raB.best}`),
      row("Veces MVP", sa.mvp, sb.mvp, id_, 0, "more"),
      row("Amarillas", sa.am, sb.am, id_, 0, "less", "menos es mejor"),
      trow("Próximo hito", hito(meA.next[0]), hito(meB.next[0])),
      trow("Mejor socio", paA ? nm(S, paA.id) : "—", paB ? nm(S, paB.id) : "—"),
    ]);
  const tally = !wins.n ? "" : wins.a === wins.b ? `Empatados: ${wins.a} a ${wins.b} en ${wins.n} datos` : `${wins.a > wins.b ? A.name : B.name} manda: gana en ${Math.max(wins.a, wins.b)} de ${wins.n}`;
  const verdict: string[] = [];
  if (actas) verdict.push(sa.g === sb.g ? `Empatados a ${sa.g}${sa.g === 1 ? " gol." : " goles."}` : `${sa.g > sb.g ? A.name : B.name} va por delante en goles (${Math.max(sa.g, sb.g)} a ${Math.min(sa.g, sb.g)}).`);
  if (A.h && B.h) verdict.push(A.h === B.h ? `Misma altura: ${heightText(A.h)} cada uno.` : `${A.h > B.h ? `${A.name} le saca ${A.h - B.h} cm a ${B.name}` : `${B.name} le saca ${B.h - A.h} cm a ${A.name}`}.`);
  else verdict.push(`A ${!A.h ? A.name : B.name} le falta la altura en su ficha; sin ese dato la comparación queda a medias.`);
  const ageA = age(A, now);
  const ageB = age(B, now);
  if (ageA != null && ageB != null && ageA !== ageB) verdict.push(`${ageA < ageB ? A.name : B.name} es el más joven de los dos.`);
  if (paA && paA.id === B.id && paB && paB.id === A.id) verdict.push("Son el uno el mejor socio del otro.");
  const corner = (p: PPlayer, k: "a" | "b") => ({ id: p.id, num: p.num, name: p.name, pos: posOf(p).name, chg: `Jugador ${k === "a" ? 1 : 2}: ${p.name}. Cambiar jugador`, picking: (st.pick ?? "b") === k, cls: (st.pick ?? "b") === k ? "is-picking" : "" });
  return {
    sub: actas ? "Con sus fichas y lo que llevan de temporada. La percha elige: toca una camiseta y va a la esquina marcada." : "Desde la jornada 1 se suman partidos, goles, asistencias y minutos.",
    a: corner(A, "a"),
    b: corner(B, "b"),
    rows,
    verdict: verdict.map(dot),
    caption: `${A.name} contra ${B.name}`,
    tally,
    note: actas ? (noMin ? "Las actas no registran minutos para los dos: los goles y pases se cuentan por partido." : "") : "Partidos, goles, asistencias y minutos se suman solos con cada acta, desde la jornada 1.",
  };
}

// ── el álbum
export function albumView(S: Squad, st: ViewState, who: Who) {
  const count = S.ids.length;
  const albMe = who.me && S.by.has(who.me) ? album(who.me, S.matches, S.ids, S.seasonId, S.cur.jornada) : null;
  const filters: [AlFilter, string][] = [["todos", "Todos"], ["tengo", "Los tengo"], ["faltan", "Me faltan"]];
  const cards = S.ids
    .filter((id) => {
      if (!albMe || st.alFilter === "todos") return true;
      const own = albMe.owned.includes(id);
      return st.alFilter === "tengo" ? own : !own;
    })
    .map((id) => {
      const p = S.by.get(id)!;
      const own = albMe ? albMe.owned.includes(id) : true;
      const mine = id === who.me;
      const sub = !albMe ? posOf(p).name : mine ? (own ? "El tuyo" : "El tuyo, al jugar") : own ? `Desde la ${albMe.at.get(id) || "temporada"}` : "Te falta";
      return { id, num: p.num, name: p.name, sub, cls: albMe ? `${own ? "is-own" : "is-miss"}${mine ? " is-self" : ""}` : "is-club", label: `${p.name}${p.num ? `, dorsal ${p.num}` : ""}${albMe ? (own ? ": lo tienes" : ": te falta") : ""}. Ver su cromo` };
    });
  return {
    title: who.me ? "Tu álbum" : "El álbum",
    mine: !!albMe,
    owned: albMe ? albMe.owned.length : 0,
    total: count,
    pct: albMe && count ? Math.round((albMe.owned.length / count) * 100) : 0,
    line: albMe ? albMe.line : "",
    sub: albMe ? "Cada partido que juegas con alguien, su cromo pasa a tu álbum." : who.quien === "socio" ? `Los ${count} cromos de la temporada. El tuyo se llena jugando.` : `Los ${count} cromos de la temporada.`,
    note: albMe ? "Toca un cromo para verlo en grande." : who.quien === "socio" ? "Cuando tengas ficha, cada partido que juegues suma el cromo de los que juegan contigo." : "En el vestuario, cada jugador colecciona los cromos de los que juegan con él.",
    door: !who.member || who.quien === "socio",
    doorLabel: !who.member ? "Entrar al vestuario" : "Pedir mi ficha en el vestuario",
    fI: (["todos", "tengo", "faltan"] as AlFilter[]).indexOf(st.alFilter),
    filters: filters.map(([k, t]) => ({ k, t, on: st.alFilter === k })),
    cards,
    empty: cards.length === 0,
    emptyText: st.alFilter === "tengo" ? "Aún no tienes ninguno: el primero llega con tu primer partido." : "No te falta ninguno.",
  };
}

// ── a player
export const ANCATS: AnCat[] = ["pases", "remate", "defensa", "parado"];
const MEDAL_TIER = ["Logro", "Bronce", "Plata", "Oro"];
export function playerView(S: Squad, st: ViewState, who: Who, lines: Map<string, Line_>, opts: { mvpVote: { j: number | null; total: number; eligible: number } | null }) {
  const focus = st.focus!;
  const fp = S.by.get(focus)!;
  const count = S.ids.length;
  const idx = S.ids.indexOf(focus);
  const prev = S.by.get(S.ids[(idx + count - 1) % count])!;
  const next = S.by.get(S.ids[(idx + 1) % count])!;
  const ctx = st.period === "all" ? S.seasonCtx("all") : S.cur;
  const mL = lines.get(focus);
  const ps = stats(focus, ctx);
  const pos = posOf(fp);
  const isCap = focus === S.captain;
  const curLabel = S.seasonName;
  const me = who.me;
  const admin = who.admin;
  const now = S.now;
  const seasonsWord = `${fp.seasons || 1} ${(fp.seasons || 1) === 1 ? "temporada" : "temporadas"} en el club`;
  const hero = {
    id: focus,
    n: fp.num,
    name: fp.name,
    full: [fp.full !== fp.name ? fp.full : "", isCap ? "Capitán del equipo" : "", fp.num ? `Dorsal ${fp.num}` : "", seasonsWord].filter(Boolean).join(" · "),
    kick: `${pos.name}${fp.active === false ? " · Histórico" : " · Plantilla"}`,
    status: mL ? mL.status : "",
    tone: mL ? mL.tone : "",
    tags: mL ? mL.tags : [],
    self: me === focus,
    admin,
    cls: me === focus ? "is-me" : "",
    turned: st.turned,
    shirtAlt: `Camiseta de ${fp.name}${fp.num ? `, dorsal ${fp.num}` : ""}${st.turned ? ", vista de frente" : ", vista de espaldas con su nombre y su dorsal"}.`,
    prevLabel: `Jugador anterior: ${prev.name}${prev.num ? `, dorsal ${prev.num}` : ""}`,
    nextLabel: `Jugador siguiente: ${next.name}${next.num ? `, dorsal ${next.num}` : ""}`,
    prevId: prev.id,
    nextId: next.id,
  };
  const crumb = { l: `${fp.num ? `Dorsal ${fp.num} · ` : ""}${idx + 1} de ${count} en la percha`, s: fp.num ? `Dorsal ${fp.num}` : fp.name };

  // Ficha
  const bd = birthday(fp, now);
  const ag = age(fp, now);
  const miss = missing(fp);
  const av = avail(fp, S.jornadaOf);
  const med = medals(focus, S.matches, ctx, S.seasons);
  const par = partner(focus, S.ids, ctx);
  const clearedAt = fp.sanctionClearedAt && !fp.sanction ? new Date(fp.sanctionClearedAt) : null;
  const clearedTxt = clearedAt ? `${Number(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric" }).format(clearedAt))} de ${MONTHS_L[Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", month: "numeric" }).format(clearedAt)) - 1]}` : "";
  const fi = {
    facts: [
      { t: "Edad", v: ag != null ? `${ag} años` : "—", x: "", cls: ag == null ? "is-none" : "" },
      { t: "Altura", v: heightText(fp.h) ?? "—", x: "", cls: fp.h ? "" : "is-none" },
      { t: "Peso", v: fp.w ? `${fp.w} kg` : "—", x: "", cls: fp.w ? "" : "is-none" },
      { t: "Cumple", v: bd ? bd.label : "—", x: bd ? (bd.days === 0 ? "¡Hoy!" : bd.days <= 30 ? bd.when : "") : "", cls: bd ? (bd.days === 0 ? "is-today" : "") : "is-none" },
      { t: "Signo", v: sign(fp) ?? "—", x: "", cls: sign(fp) ? "" : "is-none" },
      { t: "Estado", v: av ? av.status.split(" · ")[0] : "Disponible", x: av ? (av.k === "sanction" ? av.text.replace("Sancionado ", "") : "No está disponible") : "", cls: av ? "is-alert" : "" },
      { t: "Posición", v: pos.exact ? posName(fp.main) : fp.natural ? `${pos.name}, sin puesto exacto` : "Por definir", x: fp.also.length ? `También ${fp.also.map((c) => `${posLabel(c).toLocaleLowerCase("es")} (${c})`).join(" · ")}` : "", cls: "is-wide" },
    ],
    missing: miss.length ? `Ficha incompleta: falta ${joinY(miss)}.${admin ? " La completas en Admin › Plantilla." : ""}` : "",
    club: [fp.num ? `Dorsal ${fp.num}` : "", seasonsWord].filter(Boolean).join(" · "),
    cleared: clearedTxt ? `Cumplió su sanción: el capitán la levantó el ${clearedTxt}.` : "",
    photoNote: fp.photo ? "" : admin ? "Sin foto en su ficha: su cromo lleva la camiseta. La foto se sube en Admin › Plantilla." : "",
    quote: fp.quote,
    bio: fp.bio,
    noStory: !fp.quote && !fp.bio && admin ? "Sin presentación todavía: «Su frase» y «Presentación» se escriben en Admin › Contenido." : "",
    medals: med.got.map((m) => {
      const tier = MEDAL_TIER[m.tier];
      const gold = m.tier === 3 || m.family === "mvp";
      return { t: m.label, d: m.detail.toLocaleLowerCase("es").includes(tier.toLocaleLowerCase("es")) ? m.detail : `${tier} · ${m.detail}`, icon: gold ? ("star" as const) : /gol/i.test(m.label) ? ("ball" as const) : /enalti/i.test(m.label) ? ("glove" as const) : ("trophy" as const), cls: gold ? "is-gold" : "" };
    }),
    noMedals: !med.got.length,
    next: med.next.map((n) => ({ t: n.label, pct: n.progress && n.progress.goal ? Math.min(100, Math.round((n.progress.now / n.progress.goal) * 100)) : 0, txt: n.progress ? `${Math.round(n.progress.now)} de ${n.progress.goal}` : n.detail })),
    partner: par ? { id: par.id, name: nm(S, par.id), line: par.passes ? `${par.together} minutos juntos en el campo · pases: ${many(par.toHim, "suyo", "suyos")} para ${nm(S, par.id)} y ${many(par.fromHim)} de ${nm(S, par.id)} para él` : `${par.games}${par.games === 1 ? " partido juntos" : " partidos juntos"}, ${par.wins}${par.wins === 1 ? " victoria" : " victorias"} · pases de gol: ${many(par.toHim, "suyo", "suyos")} para ${nm(S, par.id)} y ${many(par.fromHim)} de ${nm(S, par.id)} para él` } : null,
  };

  // Temporada
  const days = adn(focus, ctx);
  const last12 = days.slice(-12);
  let streakGA = 0;
  for (let k = days.length - 1; k >= 0; k--) {
    if (!days[k].on) continue;
    if (days[k].g + days[k].a > 0) streakGA++;
    else break;
  }
  const gaVal = ps.min ? (ps.g + ps.a) / (ps.min / 50) : ps.pj ? (ps.g + ps.a) / ps.pj : null;
  const nx = med.next[0];
  const nxLeft = nx?.progress ? Math.max(0, nx.progress.goal - nx.progress.now) : null;
  const rec = (v: number) => (ps.tracked ? v : "—");
  const tiles: { a: string; b: string | number; key: boolean }[] = [
    { a: "Partidos", b: ps.pj, key: true },
    { a: "Goles", b: ps.g, key: true },
    { a: "Asistencias", b: ps.a, key: true },
    { a: "Minutos registrados", b: ps.min == null ? "—" : `${ps.min}′`, key: true },
    { a: "Titular", b: rec(ps.tit), key: false },
    { a: "Suplente inicial", b: rec(ps.sup), key: false },
    { a: "No convocado", b: rec(ps.nc), key: false },
    { a: "Entradas", b: rec(ps.inn), key: false },
    { a: "Salidas", b: rec(ps.out), key: false },
    { a: "Amarillas", b: ps.am, key: false },
    { a: "Expulsiones", b: ps.rojas, key: false },
    { a: "Ocasiones", b: ps.ocas, key: false },
    { a: "Al palo", b: ps.palo, key: false },
    { a: "Paradas", b: ps.paradas, key: false },
    { a: "Faltas hechas", b: ps.fh, key: false },
    { a: "Faltas recibidas", b: ps.fr, key: false },
    { a: "Penaltis parados", b: ps.pen, key: false },
    { a: "Goles de penalti", b: ps.gpen, key: false },
    { a: "Goles de falta", b: ps.gfal, key: false },
    { a: "Penaltis cometidos", b: rec(ps.pcom), key: false },
    { a: "Penaltis recibidos", b: rec(ps.prec), key: false },
  ];
  const zero = (t: { b: string | number }) => t.b === 0 || t.b === "0" || t.b === "—";
  const nz = tiles.filter((t) => !zero(t));
  const zs = tiles.filter(zero);
  const analysedGames = ctx.games.filter((m) => hasAnalysisActions([m], focus));
  const mvpS = opts.mvpVote && st.period === "cur" ? `la votación de la ${opts.mvpVote.j ? `J${opts.mvpVote.j}` : "última jornada"} sigue abierta: ${opts.mvpVote.total} de ${opts.mvpVote.eligible} han votado` : ps.mvp === 1 ? "partido" : "partidos";
  const allSeasons = S.seasons.filter((s) => S.matches.some((m) => m.seasonId === s.id && m.ledger?.[focus]?.played) || s.id === S.seasonId);
  const te = {
    title: st.period === "all" ? "Todo el historial" : curLabel,
    four: [
      { v: String(ps.pj), t: "Partidos" },
      { v: String(ps.g), t: "Goles" },
      { v: String(ps.a), t: "Asistencias" },
      { v: ps.min == null ? "—" : `${ps.min}′`, t: "Minutos" },
    ],
    chips: [
      { t: "MVP", v: String(ps.mvp), s: mvpS, cls: ps.mvp ? "is-gold" : "" },
      { t: ps.min == null ? "G+A por partido" : "G+A por 50′", v: gaVal == null ? "—" : f1(gaVal), s: ps.min == null ? "sin minutos en las actas" : "goles y pases", cls: "" },
      { t: "Victorias con él", v: ps.pj ? `${Math.round((ps.wins / ps.pj) * 100)} %` : "—", s: `${ps.wins} de ${ps.pj}`, cls: "" },
      { t: "Racha G+A", v: String(streakGA), s: streakGA ? "seguidos, viva" : "por empezar", cls: "" },
      { t: "Próximo hito", v: nx ? nx.label : "—", s: nxLeft != null ? `faltan ${nxLeft}` : "", cls: "" },
    ],
    note: !ctx.games.length ? "Todavía no hay actas: se rellena solo con cada partido, desde la jornada 1." : ps.min == null ? "Sumado de las actas de la temporada. Los minutos aparecen cuando el acta los registra." : "Sumado de las actas de la temporada.",
    seasons: allSeasons.map((s) => {
      const x = stats(focus, s.id === S.seasonId ? S.cur : S.seasonCtx(s.id));
      return { t: s.name, pj: x.pj, g: x.g, a: x.a, min: x.min == null ? "—" : `${x.min}′`, mvp: x.mvp };
    }),
    nums: (st.numOpen ? nz.concat(zs) : nz).map((t) => ({ a: t.a, b: String(t.b), cls: nz.includes(t) ? "" : "is-zero" })),
    numsMore: zs.length > 0,
    numsOpen: st.numOpen,
    numsRest: `${zs.length}${zs.length === 1 ? " dato" : " datos"}`,
    numsRestT: "en cero o sin registrar",
    numsBtn: st.numOpen ? "Ver menos" : `Ver los ${zs.length} datos`,
    numsIcon: st.numOpen ? ("collapse" as const) : ("expand" as const),
    tech: analysedGames.length
      ? analysedGames.length === 1
        ? `La ${S.jornadaOf(analysedGames[0].id) ? `J${S.jornadaOf(analysedGames[0].id)}` : "jornada"} lleva análisis narrado: está entero en la sección «Análisis».`
        : `${analysedGames.length} actas llevan análisis narrado: está entero en la sección «Análisis».`
      : "Aparece cuando el acta lleva el análisis narrado: pases y creación, remate, defensa y duelos, balón parado y disciplina. Las actas de esta temporada no lo llevan todavía.",
  };
  if (!nz.length && !st.numOpen) te.nums = [{ a: "Todavía sin números", b: "", cls: "is-zero" }];

  // Jornadas
  const sel = st.adnSel != null && last12[st.adnSel] ? st.adnSel : last12.length - 1;
  const res = { G: "Ganamos", E: "Empatamos", P: "Perdimos" } as const;
  const d0 = last12[sel];
  const stint = stintOf(d0);
  const jl = (d: AdnDay) => (d.j ? `J${d.j}` : "—");
  const jo = {
    has: last12.length > 0,
    adn: last12.map((d, i) => ({
      i,
      j: jl(d),
      res: d.res,
      h: !d.on ? 4 : d.min != null ? Math.max(8, Math.round((d.min / d.duration) * 100)) : 100,
      goals: d.g,
      assists: d.a,
      mvp: d.mvp,
      on: i === sel,
      cls: [d.on ? "" : "is-no", d.min == null && d.on ? "is-unk" : "", `is-${d.res}`].filter(Boolean).join(" "),
      label: `${d.j ? `Jornada ${d.j}` : "Partido"} contra ${d.rival}: ${d.on ? `${d.min != null ? `${d.min} minutos, ` : ""}${d.g} goles, ${d.a} asistencias${d.mvp ? ", MVP" : ""}` : "no jugó"}. ${res[d.res]} ${d.sc}`,
    })),
    stint,
    sel: d0 ? { id: d0.id, t: `${jl(d0)} · ${d0.rival}${d0.home ? ", en casa." : ", fuera."}`, d: `${res[d0.res]} ${d0.sc} · ${d0.on ? `${d0.min != null ? `${d0.min}′ · ` : ""}${d0.g} G · ${d0.a} A${d0.mvp ? " · MVP" : ""}` : "no jugó"}` } : null,
    enc: days
      .filter((d) => d.on)
      .slice(-10)
      .reverse()
      .map((d) => ({ id: d.id, res: d.res, cls: `is-${d.res}`, rival: d.rival, when: `${jl(d)}${d.home ? " · en casa" : " · fuera"}`, sc: d.sc, me: `${d.min != null ? `${d.min}′ · ` : ""}${d.g} G · ${d.a} A` })),
    changes: d0 ? changesOf(S, focus, d0) : "",
  };

  // Juego
  const pp = positions(focus, ctx);
  const top = pp.lines[0];
  const po = {
    sub: `${st.period === "all" ? "Todo el historial" : curLabel} · minutos por posición exacta, según las actas`,
    spots: POS_CODES.map((c) => {
      const line = pp.lines.find((l) => l.code === c);
      return { code: c, x: SPOTS[c].x, y: SPOTS[c].y, cls: [c === fp.main || (!fp.main && top && top.code === c) ? "is-main" : "", fp.also.includes(c) ? "is-also" : "", line ? "is-played" : ""].filter(Boolean).join(" "), min: line && line.min != null ? `${line.min}′` : "" };
    }),
    alt: `Dónde ha jugado ${fp.name}: ${pp.lines.length ? pp.lines.map((l) => `${posLabel(l.code)}${l.min != null ? `, ${l.min} minutos` : ""}`).join("; ") : "aún en ningún puesto"}. Su puesto: ${pos.name}.`,
    lead: !pp.lines.length
      ? "Cada acta dice dónde jugó: la pizarra oficial del partido o, sin ella, su posición preferida."
      : pp.known
        ? `Más minutos de ${posName(top.code)}: ${top.min}′ en ${top.matches}${top.matches === 1 ? " partido." : " partidos."}`
        : `Sin pizarra oficial en las actas: cuenta su posición preferida, ${posName(fp.main ?? top.code)}, en ${top.matches}${top.matches === 1 ? " partido." : " partidos."}`,
    rows: pp.lines.map((l) => ({ code: l.code, name: posName(l.code), min: l.min != null ? `${l.min}′` : "—", pj: l.matches, g: l.goals, a: l.assists, rating: l.rating == null ? "—" : f1(l.rating) })),
    note: "Valoración: su GLOBAL en los partidos que jugó sobre todo en ese puesto; aparece desde el segundo.",
    reviewT: me === focus ? "Tus posiciones." : "Sus posiciones.",
    review: !(me === focus || admin)
      ? ""
      : fp.review
        ? `${{ aprobada: "El capitán aprobó la propuesta", ajustada: "El capitán ajustó la propuesta", rechazada: "El capitán no aceptó la propuesta" }[fp.review.status]}${fp.review.at ? ` el ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long" }).format(fp.review.at)}` : ""}.`
        : me === focus
          ? "Aún no has propuesto las tuyas: dile al capitán dónde te gusta jugar."
          : "Sin propuesta suya todavía.",
    reviewLink: me === focus ? "Proponer mis posiciones" : "",
  };
  const rd = radar(focus, S.ids, ctx);
  const vsSocio = st.radarVs === "socio" && par;
  const vsVals = vsSocio && par ? radar(par.id, S.ids, ctx) : radarAvg(S.ids, ctx);
  const AX = ["Goleador", "Asistente", "G+A", "Presencia", "Disciplina", "Especialista"];
  const pts = (vals: number[]) => vals.map((v, i) => {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    const r = Math.max(4, v);
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
  const ra = {
    has: ps.pj > 0,
    me: pts(rd),
    vs: pts(vsVals),
    r100: pts([100, 100, 100, 100, 100, 100]),
    r66: pts([66, 66, 66, 66, 66, 66]),
    r33: pts([33, 33, 33, 33, 33, 33]),
    axes: AX.map((n, i) => {
      const a = ((i * 60 - 90) * Math.PI) / 180;
      return { n, l: (50 + Math.cos(a) * 45).toFixed(1), t: (50 + Math.sin(a) * 45).toFixed(1) };
    }),
    alt: `Su radar: ${AX.map((n, i) => `${n} ${rd[i]}`).join(", ")}. Comparado con ${vsSocio && par ? nm(S, par.id) : "la media de la plantilla"}.`,
    vsI: vsSocio ? 1 : 0,
    vsSocio: !!vsSocio,
    socioLabel: par ? `${nm(S, par.id)}, su socio` : "Su socio",
    hasSocio: !!par,
    vsName: vsSocio && par ? nm(S, par.id) : "Media de la plantilla",
  };
  const gm = ps.goalMin;
  const gmx = Math.max(1, ...gm);
  const cl = {
    bins: ["0′", "10′", "20′", "30′", "40′"].map((t, i) => ({ t, n: gm[i], h: Math.round((gm[i] / gmx) * 100) })),
    alt: `Cuándo marca: ${gm.map((n, i) => `${n} entre el ${i * 10} y el ${i * 10 + 10}`).join(", ")}`,
    note: ps.g ? `${ps.g}${ps.g === 1 ? " gol" : " goles"} por tramos de diez minutos.` : "El reloj se llena con su primer gol.",
  };
  const prs = partners(focus, S.ids, ctx, numOf(S));
  const maxG = Math.max(1, ...prs.map((x) => x.games));
  const co = {
    has: prs.length > 0,
    stars: prs.map((x, i) => {
      const a = (i / prs.length) * Math.PI * 2 - Math.PI / 2;
      const r = 62 - (x.links ? 14 : 0);
      const cx = 100 + Math.cos(a) * r * 1.25;
      const cy = 80 + Math.sin(a) * r;
      return {
        id: x.id,
        x: cx.toFixed(1),
        y: cy.toFixed(1),
        r: (3 + (x.games / maxG) * 4).toFixed(1),
        w: (0.6 + Math.min(x.links, 8) * 0.5).toFixed(1),
        cls: x.links ? "is-link" : "",
        name: nm(S, x.id),
        lx: ((100 + Math.cos(a) * (r * 1.25 + 10)) / 2).toFixed(1),
        ly: ((80 + Math.sin(a) * (r + 10)) / 1.6).toFixed(1),
        al: Math.cos(a) > 0.35 ? "is-r" : Math.cos(a) < -0.35 ? "is-l" : Math.sin(a) < 0 ? "is-t" : "is-b",
      };
    }),
    alt: `Con quién se entiende: ${prs.map((x) => `${nm(S, x.id)}, ${x.games}${x.games === 1 ? " partido" : " partidos"}${x.links ? ` y ${x.links} pases` : ""}`).join("; ")}.`,
  };

  // Análisis
  const an = analysisView(S, focus, ctx, st, ps, analysedGames);

  // Cromo
  const lg = leaders(S.ids, ctx, "g");
  const la = leaders(S.ids, ctx, "a");
  const badges: { t: string; cls: string }[] = [];
  if (lg.n && lg.ids.includes(focus)) badges.push({ t: "Pichichi", cls: "" });
  if (la.n && la.ids.includes(focus)) badges.push({ t: "Máx. asistente", cls: "" });
  if (ps.mvp) badges.push({ t: `MVP ×${ps.mvp}`, cls: "is-gold" });
  const albMe = me && S.by.has(me) ? album(me, S.matches, S.ids, S.seasonId, S.cur.jornada) : null;
  const ownIt = !!albMe && albMe.owned.includes(focus);
  const cr = {
    pos: pos.name,
    plate: fp.shirt,
    historic: fp.active === false,
    badges,
    line: `${ps.pj} PJ · ${ps.g} G · ${ps.a} A`,
    period: st.period === "all" ? "Todo el historial" : curLabel,
    flip: st.flip,
    flipLabel: st.flip ? "Ver el frente" : "Darle la vuelta",
    cls: [st.flip ? "is-flip" : "", `is-run${st.run % 2}`].filter(Boolean).join(" "),
    tiles: tiles.map((t) => ({ a: t.a.replace("Minutos registrados", "Minutos"), b: String(t.b).replace("′", " min") })),
    alt: `Cromo de ${fp.name}${fp.num ? `, dorsal ${fp.num}` : ""}, ${pos.name}: ${ps.pj}${ps.pj === 1 ? " partido, " : " partidos, "}${ps.g}${ps.g === 1 ? " gol, " : " goles, "}${ps.a}${ps.a === 1 ? " asistencia" : " asistencias"}${badges.length ? `. ${badges.map((b) => b.t).join(", ")}` : ""}. Por detrás, sus 21 números.`,
    album: !who.member
      ? "Los cromos se coleccionan en el vestuario: cada partido, el de los que juegan contigo."
      : !me
        ? "Tu álbum empieza cuando tengas ficha."
        : focus === me
          ? "Tu cromo: el primero de tu álbum en cuanto juegas."
          : ownIt
            ? `Lo tienes en tu álbum desde la ${albMe?.at.get(focus) || "temporada"}.`
            : "Te falta: juega con él y es tuyo.",
    albCls: me && focus !== me && !ownIt ? "is-miss" : "",
    albumLink: !!me,
  };

  const hints: Record<Sec, string> = {
    ficha: pos.name,
    temporada: `${ps.pj} PJ · ${ps.g} G · ${ps.a} A`,
    jornadas: last12.length ? `Las últimas ${last12.length}` : "Sin partidos",
    juego: `${fp.main || (top && top.code) || pos.name}${top && top.min != null ? `, ${top.min}′` : ""}`,
    analisis: an.has ? `Cobertura ${an.coverage}` : "Sin narrar",
    cromo: fp.num ? `Nº ${fp.num}` : fp.name,
  };
  const tabs = SECS.map((id) => ({ id, label: SEC_LABEL[id], hint: hints[id], on: st.sec === id }));
  const si = SECS.indexOf(st.sec);
  const secNav = { prev: SECS[(si + SECS.length - 1) % SECS.length], next: SECS[(si + 1) % SECS.length] };
  return { hero, crumb, fi, te, jo, po, ra, cl, co, an, cr, tabs, secNav, per: { i: st.period === "all" ? 1 : 0, cur: st.period !== "all", all: st.period === "all", curLabel } };
}

function stintOf(d0: AdnDay | undefined) {
  if (!d0 || !d0.on) return { has: false, segs: [] as { l: string; w: string }[], marks: [] as { x: string; cls: string }[], label: "" };
  const D = d0.duration;
  const st0 = d0.stints.length ? d0.stints : d0.min != null ? [{ from: 0, to: d0.min }] : [];
  if (!st0.length) return { has: false, segs: [], marks: [], label: "" };
  const r = (x: number) => Math.round(x);
  return {
    has: true,
    segs: st0.map((x) => ({ l: ((x.from / D) * 100).toFixed(1), w: ((Math.max(0.6, x.to - x.from) / D) * 100).toFixed(1) })),
    marks: d0.exchanges.map((e) => ({ x: ((e.minute / D) * 100).toFixed(1), cls: e.direction === "in" ? "is-in" : "is-out" })),
    label: `En el campo ${st0.map((x) => `del ${r(x.from)} al ${r(x.to)}`).join(", ")}: ${d0.min ?? r(st0.reduce((s, x) => s + x.to - x.from, 0))} minutos.`,
    end: `${D}′`,
  };
}
function changesOf(S: Squad, id: string, d0: AdnDay): string {
  const m = S.matches.find((g) => g.id === d0.id);
  const j = d0.j ? `la J${d0.j}` : "ese partido";
  if (!d0.on) return m?.ledger?.[id]?.notCalled || !m?.ledger?.[id] ? `No fue convocado para ${j}.` : "No salió del banquillo.";
  if (!m?.ledger?.[id]) return "El acta de ese partido no registra los cambios.";
  if (!d0.exchanges.length) return `Ni un cambio: jugó los ${d0.min ?? d0.duration} minutos seguidos.`;
  return `${d0.exchanges.map((e) => `${e.direction === "in" ? "Entró en el " : "Salió en el "}${exchangeMinute(m.events, id, e)}′ por ${S.by.get(e.with)?.name ?? "un compañero"}`).join(" · ")}. En el fútbol 7 los cambios son libres: ${d0.stints.length}${d0.stints.length === 1 ? " tramo" : " tramos"} en el campo.`;
}

function analysisView(S: Squad, id: string, ctx: Ctx, st: ViewState, ps: PStats, analysed: ClubMatch[]) {
  if (!analysed.length || !ps.pj)
    return {
      has: false as const,
      coverage: "",
      noneText: ps.pj ? "Ninguna de sus actas lleva el análisis narrado (pases, remates, duelos, balón parado): aparece aquí en cuanto una lo lleve." : "No ha jugado en este período: no hay acciones narradas suyas.",
    };
  const x = techOf(id, ctx);
  const complete = analysed.every((m) => m.analysisCoverage === "complete");
  const coverage = complete ? "completa" : "parcial";
  const CATS: Record<AnCat, { t: string; key: keyof typeof x; keyT: string; rows: [string, string | number][] }> = {
    pases: { t: "Pases y creación", key: "passesCompleted", keyT: "Pases completados", rows: [["Pases", `${x.passesCompleted} de ${x.passes}`], ["Precisión", pctx(x.passesCompleted, x.passesCompleted + x.passesFailed)], ["Pases recibidos", x.passesReceived], ["Pases clave", x.keyPasses], ["Pases largos", `${x.longPassesCompleted} de ${x.longPasses}`], ["Centros", `${x.crossesCompleted} de ${x.crosses}`], ["Ocasiones creadas", x.chancesCreated], ["Conducciones", x.carries]] },
    remate: { t: "Remate", key: "shots", keyT: "Remates", rows: [["Remates", x.shots], ["A puerta", x.shotsOnTarget], ["Fuera", x.shotsOffTarget], ["Bloqueados", x.shotsBlocked], ["Al palo", x.shotsWoodwork], ["Goles de remate", x.shotGoals], ["Conversión", pctx(x.shotGoals, x.shots)], ["Regates", `${x.dribblesWon} de ${x.dribbles}`]] },
    defensa: { t: "Defensa y duelos", key: "recoveries", keyT: "Recuperaciones", rows: [["Recuperaciones", x.recoveries], ["Intercepciones", x.interceptions], ["Entradas", `${x.tacklesWon} de ${x.tackles}`], ["Despejes", x.clearances], ["Bloqueos", x.blocks], ["Duelos", `${x.duelsWon} de ${x.duels}`], ["Duelos aéreos", `${x.aerialDuelsWon} de ${x.aerialDuels}`], ["Pérdidas", x.turnovers], ["Paradas", x.saves]] },
    parado: { t: "Balón parado y disciplina", key: "fouls", keyT: "Faltas hechas", rows: [["Saques de banda", x.throwIns], ["Saques de puerta", x.goalKicks], ["Saques de centro", x.kickoffs], ["Córners", x.cornersTaken], ["Faltas hechas", x.fouls], ["Faltas recibidas", x.foulsReceived], ["Fueras de juego", x.offsides], ["Amarillas", ps.am], ["Penaltis cometidos", ps.pcom]] },
  };
  const cat = st.anCat;
  const C = CATS[cat];
  const ranked = S.ids
    .filter((o) => (ctx.rows.get(o)?.matchesPlayed ?? 0) > 0)
    .map((o) => ({ id: o, v: techOf(o, ctx)[C.key] || 0 }))
    .sort((a, b) => b.v - a.v || numOf(S)(a.id) - numOf(S)(b.id));
  const top = Math.max(1, ...ranked.map((r) => r.v));
  const place = ranked.findIndex((r) => r.id === id) + 1;
  const j = analysed.length === 1 ? S.jornadaOf(analysed[0].id) : undefined;
  const what = analysed.length === 1 ? `${j ? `J${j}` : "Un partido"} contra ${analysed[0].rival ?? "el rival"}` : `${analysed.length} partidos narrados`;
  const notes = analysed.map((m) => (m as ClubMatch & { analysisNotes?: string }).analysisNotes).filter((s): s is string => !!s && !!s.trim());
  return {
    has: true as const,
    coverage,
    sub: `${what} · ${x.recordedActions} ${x.recordedActions === 1 ? "acción suya narrada" : "acciones suyas narradas"} · cobertura ${coverage}`,
    rates: [
      { t: "Precisión de pase", v: pctx(x.passesCompleted, x.passesCompleted + x.passesFailed), s: `${x.passesCompleted} de ${x.passesCompleted + x.passesFailed} con resultado conocido` },
      { t: "Remates a puerta", v: pctx(x.shotsOnTarget, x.shots), s: `${x.shotsOnTarget} de ${x.shots} remates` },
      { t: "Conversión", v: pctx(x.shotGoals, x.shots), s: `${x.shotGoals}${x.shotGoals === 1 ? " gol" : " goles"} en ${x.shots} remates` },
      { t: "Regates ganados", v: pctx(x.dribblesWon, x.dribbles), s: `${x.dribblesWon} de ${x.dribbles} regates` },
    ],
    cats: ANCATS.map((k) => ({ k, t: CATS[k].t, on: k === cat })),
    catI: ANCATS.indexOf(cat),
    catT: C.t,
    rows: C.rows.map(([a, b]) => ({ a, b: String(b), cls: b === 0 || b === "0 de 0" || b === "—" ? "is-zero" : "" })),
    rankT: `Quién destaca: ${C.keyT.toLocaleLowerCase("es")}`,
    rankLine: place ? `${nm(S, id)} es ${place}º de ${ranked.length} en ${C.keyT.toLocaleLowerCase("es")}.` : "",
    rank: ranked.slice(0, 8).map((r) => ({ id: r.id, name: nm(S, r.id), v: r.v, w: Math.max(3, Math.round((r.v / top) * 100)), cls: r.id === id ? "is-me" : "" })),
    net: S.ids
      .filter((o) => o !== id && (passesBetween(ctx, id, o) || passesBetween(ctx, o, id)))
      .map((o) => ({ id: o, name: nm(S, o), to: passesBetween(ctx, id, o), from: passesBetween(ctx, o, id), sum: passesBetween(ctx, id, o) + passesBetween(ctx, o, id) }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 6),
    notes: notes.join(" "),
    hasNotes: notes.length > 0,
    notesOpen: st.anNotes,
    notesBtn: st.anNotes ? "Ocultar cómo se cuenta" : "Cómo se cuentan las acciones",
  };
}
