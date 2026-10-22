// Inicio, «La portada»: the bands under the match (the boards' place-portada.js). «Lo que te toca» (what YOU
// have to do, right under the score; «Desde la grada» for the fans), tonight's pitch and plays (the doors to
// /hoy/campo and /hoy/jugadas), and «Por la casa», a door per page with what is happening inside. Pure.
import { scoreText } from "../../../lib/derived/words";
import { stintsAt, type Play } from "./partido";
import { ICON, countWord, draggedOf, hasGameOf, isLiveF, isPlayedF, isPreF, member, playerQ, scoreEdge, scoreNow, type Ctx, type Fase } from "./model";

// ───────────────────────── «Lo que te toca» ─────────────────────────

export type TaskAct = "porra" | "mvp" | "tuyo" | "caja" | "turno" | "alerts" | "camiseta" | "mesa" | "vestuario" | "encuesta" | "rsvp" | "poll";
export interface TaskSeg {
  act: "rsvp" | "poll";
  label: string;
  opts: { id: string; t: string; on: boolean }[];
  /** Something is chosen (the bead shows). */
  on: boolean;
  i: number;
  n: number;
  busy: boolean;
}
export interface Task {
  key: string;
  icon: string;
  cls: string;
  t: string;
  sub: string;
  seg: TaskSeg | null;
  /** A button here (sheet, mark, go to a screen) or a link out. */
  btn: { t: string; act: TaskAct; pri: boolean; out: boolean; popup: boolean; busy: boolean } | null;
  done: string | null;
  pending: boolean;
  error: string;
}

export interface TasksIn {
  /** The convocatoria he can still answer. */
  rsvp: { value: 0 | 1 | 2 | null; yes: number; maybe: number; answered: number; called: number; busy: boolean; error: string } | null;
  /** The porra window is open. */
  porraOpen: boolean;
  caja: { title: string; sub: string; claimed: boolean; canClaim: boolean; busy: boolean; error: string } | null;
  turno: { task: string; sub: string; done: boolean; canMark: boolean; busy: boolean; error: string } | null;
  /** The members' open poll. */
  poll: { title: string; sub: string; opts: { id: string; t: string; on: boolean }[]; seg: boolean; voted: boolean; error: string } | null;
  /** «La mesa» of today is the viewer's. */
  mesaMine: boolean;
}

export interface TasksView {
  h: string;
  sub: string;
  list: Task[];
  all: Task[];
  pending: number;
  /** «Todo lo tuyo» (players only) with the pending count on its badge. */
  door: boolean;
  badge: number;
  note: { t: string; d: string } | null;
  /** tk-1 … tk-4: how many tiles the row holds (the layout balances the columns by it). */
  layout: string;
}

const NEXT: Record<Fase, (c: Ctx) => [string, string]> = {
  semana: (c) => [`Lo siguiente, ${c.N ? `el ${c.N.dow}` : "el calendario"}`, c.N ? `El siete del ${c.N.dow} sale de la pizarra la víspera; te avisamos.` : "Las fechas salen aquí en cuanto la liga las publique."],
  antes: (c) => [`Lo siguiente, a las ${c.M?.time ?? ""}`, "El pitido: el directo, la moviola y tu porra en marcha."],
  pitido: () => ["Lo siguiente, el reloj", "En cuanto la mesa lo arranque empieza el directo."],
  directo: () => ["Nada más por ahora", "Al final: el acta, tus minutos y el voto al MVP."],
  descanso: () => ["Nada más por ahora", "La segunda parte en unos minutos; al final, el acta y el MVP."],
  final: () => ["Lo siguiente, el acta", "Cuando la mesa la publique se abre el voto al MVP."],
  acta: (c) => [c.N ? `Lo siguiente, la ${c.N.j ? `J${c.N.j}` : "próxima"}` : "Lo siguiente, el calendario", c.N ? `La convocatoria contra ${c.N.rival} llega antes del partido.` : "Las fechas salen aquí en cuanto la liga las publique."],
  aplazado: () => ["Lo siguiente, la nueva fecha", "La pone la liga; sale aquí y en los avisos."],
  pendiente: () => ["Lo siguiente, el acta", "Con ella llegan el resultado, los minutos y el MVP."],
};

export function tasksOf(c: Ctx, i: TasksIn): TasksView {
  const f = c.fase;
  const q = c.quien;
  const mem = member(q);
  const player = playerQ(q);
  const pre = isPreF(f);
  const live = isLiveF(f);
  const semana = f === "semana";
  const pJ = semana ? c.N : c.M;
  const pJn = pJ?.j ? `J${pJ.j}` : "";
  const list: Task[] = [];
  const task = (o: Partial<Task> & Pick<Task, "key" | "icon" | "t">) => {
    const t: Task = { cls: "", sub: "", seg: null, btn: null, done: null, pending: true, error: "", ...o };
    if (t.done) t.cls = `${t.cls} is-done`.trim();
    list.push(t);
  };
  const J = c.M?.j ? `J${c.M.j}` : "";

  if (q === "anotador" && (pre || live || f === "pendiente" || f === "final"))
    task({
      key: "mesa",
      icon: "mesa",
      cls: "is-key",
      t: "Hoy anotas tú",
      sub: pre ? "La mesa abre con «¿Quién ha venido?»; el reloj arranca con el pitido." : live ? "Cada jugada que anotas sale al momento en el directo de todos." : f === "final" ? "Repasa las jugadas y publica el acta." : "Nadie arrancó el reloj: escribe el resultado y publica el acta.",
      btn: { t: pre || live ? "Abrir la mesa" : "Publicar el acta", act: "mesa", pri: true, out: true, popup: false, busy: false },
    });
  if (player && i.rsvp && (semana || f === "antes")) {
    const r = i.rsvp;
    const N = c.N;
    task({
      key: "rsvp",
      icon: "cal",
      t: semana && N ? `¿Vas el ${N.dow}?` : "¿Vas hoy?",
      sub: semana && N ? `${pJn ? `${pJn} · ` : ""}${N.home ? "en Palomeras" : `en casa de ${N.rival}`}, ${N.time} · ${r.yes === 1 ? "viene 1" : `vienen ${r.yes}`}${r.maybe ? `, ${r.maybe} en duda` : ""}` : `Ya han respondido ${r.answered} de ${r.called}`,
      seg: { act: "rsvp", label: semana && N ? `¿Vas el ${N.dow}?` : "¿Vas hoy?", opts: ["Voy", "Duda", "No voy"].map((t, k) => ({ id: String(k), t, on: r.value === k })), on: r.value !== null, i: r.value ?? 0, n: 3, busy: r.busy },
      pending: r.value === null,
      error: r.error,
    });
  }
  if (mem && pJ) {
    const p = c.porra;
    if (i.porraOpen) task({ key: "porra", icon: "ball", t: p ? `Tu porra: ${scoreText(p.us, p.them)}` : "Tu porra, sin poner", sub: `${pJn ? `${pJn} · ` : ""}se cierra con el pitido`, btn: { t: p ? "Cambiarla" : "Poner la porra", act: "porra", pri: false, out: false, popup: true, busy: false }, pending: !p });
    else if (live && p) {
      const sc = scoreNow(c);
      task({ key: "porra", icon: "ball", t: `Tu porra: ${scoreText(p.us, p.them)}`, sub: sc.us === p.us && sc.them === p.them ? "La clavas de momento." : `Se te escapa: ahora va ${scoreText(sc.us, sc.them)}.`, done: "Puesta antes del pitido", pending: false });
    } else if ((f === "final" || f === "acta") && p) {
      const e = scoreEdge(c);
      task({ key: "porra", icon: "ball", t: `Tu porra: ${scoreText(p.us, p.them)}`, sub: e.us === p.us && e.them === p.them ? "Acertaste el resultado." : `No entró: acabó ${scoreText(e.us, e.them)}.`, done: "La porra del equipo, en el vestuario", pending: false });
    }
  }
  if (player && (live || f === "final") && c.P && c.me) {
    const mine = c.P.ledger[c.me];
    const now = stintsAt(mine, c.m);
    const on = mine ? c.P.onAt[Math.min(c.P.duration, c.m)]?.includes(c.me) : false;
    task({
      key: "mine",
      icon: "shirt",
      t: mine ? `${live ? "Llevas" : "Jugaste"} ${now.min} minutos` : "Hoy no juegas",
      sub: mine ? (on && live ? "Ahora estás en el campo." : live ? "Ahora en el banquillo: en F7 se vuelve a entrar." : "Tus tramos, en Lo tuyo.") : q === "anotador" ? "Hoy la mesa es tuya." : "Desde la grada, con el equipo.",
      btn: mine ? { t: "Tu partido", act: "tuyo", pri: false, out: false, popup: false, busy: false } : null,
      done: mine ? null : q === "anotador" ? "Con el reloj de la mesa" : "Con el equipo",
      pending: false,
    });
  }
  if (mem && c.mvp.open && (f === "acta" || semana)) {
    const v = c.mvpVoted;
    const turnout = c.mvp.total !== null && c.mvp.eligible ? ` · ${c.mvp.total} de ${c.mvp.eligible} ya han votado` : "";
    task(
      v
        ? { key: "mvp", icon: "star", t: `Votas a ${v}`, sub: `Puedes cambiarlo${c.mvp.closes ? ` hasta ${c.mvp.closes}` : " mientras siga abierta"}.`, btn: { t: "Cambiar", act: "mvp", pri: false, out: false, popup: true, busy: false }, pending: false }
        : { key: "mvp", icon: "star", cls: "is-mvp", t: `Vota al MVP${J ? ` de la ${J}` : ""}`, sub: `${c.mvp.closes ? `Cierra ${c.mvp.closes}` : "Abierta"}${turnout}`, btn: { t: "Votar", act: "mvp", pri: true, out: false, popup: true, busy: false } },
    );
  }
  if (player && i.caja && (semana || f === "antes" || f === "acta"))
    task(
      i.caja.claimed
        ? { key: "caja", icon: "euro", t: i.caja.title, sub: "Avisado al tesorero: lo marca cuando le llegue.", done: "Avisado", pending: false }
        : { key: "caja", icon: "euro", t: i.caja.title, sub: i.caja.sub, btn: i.caja.canClaim ? { t: "Ya la he pagado", act: "caja", pri: false, out: false, popup: false, busy: i.caja.busy } : null, error: i.caja.error },
    );
  if (q === "jugador" && i.turno && (semana || f === "acta"))
    task(
      i.turno.done
        ? { key: "turno", icon: "wash", t: i.turno.task, sub: "Hecho. Gracias: lo verá el capitán.", done: "Hecho", pending: false }
        : { key: "turno", icon: "wash", t: `Te toca ${i.turno.task.charAt(0).toLocaleLowerCase("es")}${i.turno.task.slice(1)}`, sub: i.turno.sub, btn: i.turno.canMark ? { t: "Hecho", act: "turno", pri: false, out: false, popup: false, busy: i.turno.busy } : null, error: i.turno.error },
    );
  if (q === "socio" && !live && i.poll) {
    const p = i.poll;
    const chosen = p.opts.findIndex((o) => o.on);
    task(
      p.seg
        ? { key: "poll", icon: "poll", t: p.title, sub: p.sub, seg: { act: "poll", label: p.title, opts: p.opts, on: chosen >= 0, i: Math.max(0, chosen), n: p.opts.length, busy: false }, pending: !p.voted, error: p.error }
        : { key: "poll", icon: "poll", t: p.title, sub: p.sub, btn: { t: p.voted ? "Ver la encuesta" : "Votar", act: "encuesta", pri: !p.voted, out: true, popup: false, busy: false }, pending: !p.voted },
    );
  }
  if (!mem) {
    const what = pre ? "del pitido" : live ? "de los goles" : "del próximo partido";
    task({ key: "alerts", icon: "bell", t: c.alerts ? `Te avisamos ${what}` : `Avisarme ${what}`, sub: "En este móvil, sin cuenta. Lo quitas cuando quieras.", btn: { t: c.alerts ? "Quitar" : "Activar", act: "alerts", pri: false, out: false, popup: false, busy: false }, pending: false });
    task({ key: "entrar", icon: "lock", t: "¿Juegas en el Piti?", sub: "Pide entrar al vestuario: la convocatoria, tu sitio en el siete y tu carta.", btn: { t: "Pedir entrar", act: "vestuario", pri: false, out: true, popup: false, busy: false }, pending: false });
    task({ key: "camiseta", icon: "shirt", t: "Ponte la del Piti", sub: "Tu nombre y tu dorsal, como la de verdad.", btn: { t: "Hacerme la mía", act: "camiseta", pri: false, out: false, popup: false, busy: false }, pending: false });
  }
  const pend = list.filter((t) => t.pending).length;
  const shown = list.slice(0, 4);
  const nx = NEXT[f](c);
  const note = shown.length < 3 ? { t: nx[0], d: nx[1] } : null;
  return {
    h: mem ? "Lo que te toca" : "Desde la grada",
    sub: !mem ? "Sin cuenta también se sigue al Piti." : pend ? `${pend === 1 ? "1 cosa pendiente" : `${pend} cosas pendientes`}${q === "socio" ? ", como socia" : ""}` : "Todo al día",
    list: shown,
    all: list,
    pending: pend,
    door: player,
    badge: player ? pend : 0,
    note,
    layout: `tk-${Math.min(4, shown.length + (note ? 1 : 0))}`,
  };
}

// ───────────────────────── tonight: the pitch door and the plays ─────────────────────────

export interface Spot {
  id: string;
  /** Horizontal pitch (phone): our goal on the left. */
  left: number;
  top: number;
  /** Vertical pitch (tablet up): our goal at the bottom. */
  vx: number;
  vy: number;
  short: string;
  num: string;
  me: boolean;
  dim: boolean;
  tag: string | null;
}

export interface PlayRowV {
  key: string;
  m: number;
  k: Play["k"];
  title: string;
  sub: string;
  icon: string;
  card: boolean;
  red: boolean;
  them: boolean;
  gold: boolean;
  /** A wave of changes in one minute: who came in for whom. */
  pairs: { inn: string; innId: string; out: string }[] | null;
  label: string;
}

/** The plays as rows, the changes of one minute folded into one («Tres cambios a la vez»). */
export function playRows(plays: readonly Play[], name: (id: string) => string): PlayRowV[] {
  const out: PlayRowV[] = [];
  for (const p of plays) {
    const last = out[out.length - 1];
    if (p.k === "cambio") {
      const pair = { inn: p.who ? name(p.who) : "", innId: p.who ?? "", out: p.out ? name(p.out) : "" };
      if (last?.pairs && last.m === p.m) {
        last.pairs.push(pair);
        continue;
      }
      out.push({ key: p.id, m: p.m, k: "cambio", title: "Cambio", sub: "", icon: "swap", card: false, red: false, them: false, gold: false, pairs: [pair], label: "" });
      continue;
    }
    const card = p.k === "amarilla" || p.k === "roja" || p.k === "rivalAmarilla" || p.k === "rivalRoja";
    out.push({ key: p.id, m: p.m, k: p.k, title: p.title, sub: p.sub, icon: ICON[p.k] || "ball", card, red: p.k === "roja" || p.k === "rivalRoja", them: p.side === "them", gold: p.k === "gol", pairs: null, label: `Minuto ${p.m}, ${p.title}` });
  }
  for (const r of out) {
    if (!r.pairs) continue;
    const n = r.pairs.length;
    r.title = n === 1 ? "Cambio" : `${countWord(n)} cambios a la vez`;
    r.label = `Minuto ${r.m}: ${r.pairs.map((x) => `entra ${x.inn} por ${x.out}`).join(", ")}`;
  }
  return out;
}

export interface NightView {
  h: string;
  sub: string;
  spots: Spot[];
  dim: boolean;
  pitchAria: string;
  pitchGo: string;
  facts: { v: string; l: string }[];
  isPlays: boolean;
  playsH: string;
  playsN: string;
  plays: (PlayRowV & { xtra: boolean })[];
  playsMore: string;
  previaH: string;
  previaJ: string;
  previa: { k: string; v: string }[];
  previaNote: string;
  /** No seven to draw (no lineup and no starters). */
  noPitch: boolean;
}

export interface NightIn {
  /** «CDM Palomeras · Puente de Vallecas» (the venue's words). */
  venue: string;
  /** «Publicado ayer desde la pizarra» (null: no pizarra lineup). */
  published: string | null;
  /** The meeting time, when the viewer may read it. */
  meet: string | null;
  mesaName: string | null;
  system: string;
  kit: "home" | "away";
  /** The night's kick-off is in the evening («El siete de esta noche»). */
  evening: boolean;
}

export function nightOf(c: Ctx, i: NightIn): NightView {
  const P = c.P;
  const f = c.fase;
  const m = c.m;
  const hasGame = hasGameOf(c);
  const live = isLiveF(f);
  const pre = isPreF(f);
  const semana = f === "semana";
  const J = c.M?.j ? `J${c.M.j}` : "";
  const rival = c.M?.rival ?? "";
  const D = P?.duration ?? 50;
  const slots = P ? (hasGame ? (P.onAt[Math.min(D, m)] ?? []) : P.lineup.map((s) => s.id)) : [];
  const goalAt = new Map<string, number>();
  if (hasGame) for (const p of P?.plays ?? []) if (p.k === "gol" && p.who && p.m <= m) goalAt.set(p.who, p.m);
  const spots: Spot[] = [];
  P?.lineup.forEach((s, k) => {
    const id = slots[k];
    if (!id) return;
    const g = goalAt.get(id);
    spots.push({ id, left: Number((100 - (6 + s.y * 0.86)).toFixed(1)), top: Number((8 + s.x * 0.84).toFixed(1)), vx: s.x, vy: Number((3 + s.y * 0.9).toFixed(1)), short: c.names.short(id), num: c.names.num(id), me: id === c.me, dim: f === "aplazado", tag: g !== undefined ? `Gol ${g}′` : null });
  });
  const ids = P ? Object.keys(P.ledger) : [];
  const playedN = ids.filter((id) => stintsAt(P?.ledger[id], m).min > 0).length;
  const subsN = (P?.plays ?? []).filter((p) => p.k === "cambio" && p.m <= m).length;
  const full = ids.filter((id) => m > 0 && stintsAt(P?.ledger[id], m).min >= m).map((id) => c.names.name(id));
  const allRows = P ? playRows(P.plays.filter((p) => p.m <= m), c.names.name).reverse() : [];
  const mem = member(c.quien);
  const h = pre ? (i.evening ? "El siete de esta noche" : "El siete de hoy") : live ? "En el campo" : f === "aplazado" ? "La convocatoria" : f === "pendiente" ? "El siete que salió" : "Acabaron en el campo";
  const playsH = !mem && (f === "acta" || f === "final" || semana) ? "La noche, jugada a jugada" : "Jugada a jugada";
  return {
    h,
    sub: semana ? `${J ? `${J} ante ` : "Ante "}${rival} · ${i.system}` : pre ? `${i.published ?? "El siete"} · ${i.system}` : live ? `Minuto ${m} · el campo cambia con cada cambio` : f === "aplazado" ? "Se queda para la nueva fecha" : f === "pendiente" ? "El siete que salió; los minutos, con el acta" : `${J ? `${J} · ` : ""}${i.system}`,
    spots,
    dim: f === "aplazado",
    pitchAria: `${hasGame ? `Los minutos de cada uno: ${playedN} jugaron y hubo ${subsN} cambios` : "El siete y el banquillo"}. Abrir`,
    pitchGo: hasGame ? (live ? "Quién está y cuánto lleva" : "Los minutos de cada uno") : "El siete y el banquillo",
    facts: hasGame
      ? [
          { v: String(playedN), l: "jugaron" },
          { v: String(subsN), l: subsN === 1 ? "cambio" : "cambios" },
          { v: full.length ? (full.length === 1 ? full[0] : String(full.length)) : "—", l: "sin salir" },
        ]
      : [
          { v: i.system, l: "el sistema" },
          { v: String(P?.match.bench?.length ?? 0), l: "en el banquillo" },
          ...(i.meet ? [{ v: i.meet, l: "la quedada" }] : []),
        ],
    isPlays: hasGame,
    playsH,
    playsN: hasGame && f !== "pendiente" ? `${(P?.plays ?? []).filter((p) => p.m <= m).length} jugadas` : "",
    plays: allRows.slice(0, 6).map((r, k) => ({ ...r, xtra: k > 3 })),
    playsMore: f === "pendiente" ? "Las jugadas salen con el acta." : allRows.length > 4 ? `${allRows.length - 4} momentos más, con los cambios de cada minuto juntos` : "Todo el partido, en su pantalla",
    previaJ: J,
    previaH: f === "pendiente" ? "Mientras llega el acta" : f === "aplazado" ? "La nueva fecha" : "La previa",
    previa:
      f === "pendiente"
        ? [{ k: "Resultado", v: "Con el acta" }, { k: "Cuándo", v: `${c.M?.dayLong ?? ""}, ${c.M?.time ?? ""}` }, { k: "Dónde", v: i.venue }, ...(i.mesaName ? [{ k: "La mesa", v: `Anota ${i.mesaName}` }] : [])]
        : f === "aplazado"
          ? [{ k: "Nueva fecha", v: "Sin fecha todavía: la pone la liga" }, ...(c.postponed ? [{ k: "Por qué", v: c.postponed }] : []), { k: "Tu respuesta", v: "Se queda para la nueva fecha" }]
          : [{ k: "Dónde", v: i.venue }, { k: "Equipación", v: i.kit === "home" ? "La primera: celeste, cuello marino" : "La segunda: negra y roja" }, ...(i.meet ? [{ k: "Quedada", v: `${i.meet}, en la puerta del campo` }] : []), ...(i.mesaName ? [{ k: "La mesa", v: `Anota ${i.mesaName}` }] : [])],
    previaNote: f === "pendiente" ? "Las jugadas, los goles y los minutos salen con el acta." : f === "aplazado" ? "Te avisamos en cuanto haya fecha." : "Con el tiempo hora a hora y cómo llegar.",
    noPitch: !spots.length,
  };
}

// ───────────────────────── «Por la casa» ─────────────────────────

export interface JorCell {
  key: string;
  top: string;
  bot: string;
  botL: string;
  cls: string;
}

export interface DoorsIn {
  /** The season's jornadas in order (seasonStrip). */
  jornadas: { id: string; j: number | null; rival: string; gf: number | null; ga: number | null; res: "G" | "E" | "P" | ""; off: boolean; live: boolean; sky: "day" | "golden" | "flood"; dayNum: string }[];
  total: number;
  squadN: number;
  /** Five shirts for the rail. */
  rail: { id: string; num: string }[];
  standings: { pos: number; of: number; pts: number } | null;
  leader: { name: string; goals: number } | null;
  birthday: { id: string; num: string; name: string; when: string } | null;
  vitrina: string;
  /** The viewer's printed shirt (a player), else none. */
  mine: { id: string; num: string; short: string } | null;
}

export interface DoorsView {
  partidos: string;
  jornadas: JorCell[];
  plantilla: string;
  rail: { id: string; num: string }[];
  numeros: string;
  big: string;
  bigL: string;
  club: string;
  vitrina: string;
  bday: DoorsIn["birthday"];
  bdayDay: string;
  bdayWho: string;
  vest: string;
  vestD: string;
  vestIcon: string;
  locked: boolean;
  vestL: { icon: string; t: string }[];
  tee: string;
  mine: DoorsIn["mine"];
}

export function doorsOf(c: Ctx, tasks: TasksView, i: DoorsIn): DoorsView {
  const f = c.fase;
  const live = isLiveF(f);
  const played = isPlayedF(f);
  const semana = f === "semana";
  const mem = member(c.quien);
  const N = c.N;
  const M = c.M;
  const curId = semana ? (N?.matchId ?? null) : (M?.matchId ?? null);
  const curIdx = i.jornadas.findIndex((j) => j.id === curId);
  const sc = scoreNow(c);
  const cells = i.jornadas.map((j): JorCell => {
    const isCur = j.id === curId;
    let gf = j.gf;
    let ga = j.ga;
    let res = j.res;
    if (M && j.id === M.matchId && !semana) {
      if (played && f !== "final") {
        gf = sc.us;
        ga = sc.them;
        res = live ? "" : gf > ga ? "G" : gf < ga ? "P" : "E";
      } else {
        gf = null;
        res = "";
      }
    }
    const top = j.j ? `J${j.j}` : "–";
    const bot = j.off ? "Apl." : res ? res : isCur && live ? "" : j.dayNum;
    const botL = j.off ? "Apl." : res && gf !== null && ga !== null ? `${res} ${scoreText(gf, ga)}` : isCur && live && gf !== null && ga !== null ? scoreText(gf, ga) : j.dayNum;
    return { key: j.id, top, bot, botL, cls: [`is-${(res || "n").toLowerCase()}`, isCur ? "is-cur" : "", isCur && live ? "is-live" : "", j.off ? "is-off" : "", `sky-${j.sky}`].filter(Boolean).join(" ") };
  });
  const long = cells.length > 8;
  const at = curIdx >= 0 ? curIdx : Math.max(0, cells.findIndex((x) => x.bot && /\d/.test(x.bot)));
  const win = long ? cells.slice(Math.max(0, Math.min(cells.length - 6, at - 4)), Math.max(6, Math.min(cells.length, at + 2))) : cells;
  const curJ = semana ? N?.j : M?.j;
  const vestL = mem ? tasks.all.filter((t) => t.pending).slice(0, 3).map((t) => ({ icon: t.icon, t: t.t })) : [];
  const pend = tasks.pending;
  return {
    partidos: live && M ? `${M.j ? `J${M.j}, ` : ""}en directo · ${M.rival}` : `${curJ ? `J${curJ} de ${i.total}` : `${i.total} jornadas`}${semana && N ? ` · el ${N.dow}, ${N.rival}` : played && N ? ` · el ${N.dow} ${N.day}, ${N.rival}` : M && !semana ? ` · hoy, ${M.rival}` : ""}`,
    jornadas: win,
    plantilla: `Los ${i.squadN} de la plantilla, en sus perchas`,
    rail: i.rail,
    numeros: i.standings ? "Goleadores, la tabla y la forma" : "La tabla sale cuando la liga la publique",
    big: i.standings ? `${i.standings.pos}º` : String(i.leader?.goals ?? 0),
    bigL: i.standings ? `de ${i.standings.of} · ${i.standings.pts} puntos` : i.leader ? `${i.leader.goals === 1 ? "gol en la temporada: " : "goles, el que más: "}${i.leader.name}` : "goles en la temporada",
    club: "Esta semana, fuera del campo",
    vitrina: i.vitrina,
    bday: i.birthday,
    bdayDay: i.birthday ? `Cumple ${i.birthday.when}` : "",
    bdayWho: i.birthday ? `${i.birthday.name}, dorsal ${i.birthday.num}. Que no se te pase.` : "",
    vest: mem ? (pend ? (pend === 1 ? "1 cosa pendiente" : `${pend} cosas pendientes`) : "Todo al día") : "Solo para el equipo",
    vestD: mem ? (c.quien === "socio" ? "Tus votos, la porra y las encuestas" : "La pizarra, la porra y la caja") : "Pedir entrar",
    vestIcon: mem ? "shield" : "lock",
    locked: !mem,
    vestL,
    tee: i.mine ? `La tuya, ${i.mine.short} ${i.mine.num}, lista para descargar` : "Tu nombre y tu dorsal, como la de verdad",
    mine: i.mine,
  };
}

export { draggedOf, scoreNow };
