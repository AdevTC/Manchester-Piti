// «La primera fila»'s words and poses: what each seat looks like and says, the title, the lead and the notes
// under the stand, for one FrontRow (derived/frontRow) at one point of the match day. Pure, so the component
// only draws it and the tests can read it.
import type { FrontRow, Seat, SeatMarker } from "../../../lib/derived/frontRow";
import type { MatchdayModel, ViewerRole } from "../../../lib/derived/matchday";
import type { LightKey } from "../../../lib/derived/sun";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { madridDate, madridTime } from "../../../lib/derived/madrid";
import { isPosCode, POSITIONS } from "../../../lib/positions";
import { dateMillis } from "../../../../functions/src/matchEngine";

export type Answer = "yes" | "maybe" | "no";
/** The member data's state: still reading who the viewer is, failed, or stale while offline. */
export type FilaStatus = "ok" | "loading" | "error" | "offline";

export type Pose = "fold" | "up" | "half" | "empty" | "low";
export interface MarkView {
  /** pf-mk modifier: g y r in out inj pitch logro anota mvpc baja */
  cls: string;
  text: string;
  /** Shorter text for the narrow stand (the logro medal's count). */
  short?: string;
}
export interface SeatView {
  seat: Seat;
  pose: Pose;
  /** On the paper card: ✓, ?, minutes («50′»), «–». */
  face: string;
  /** Under the face: the position of a starter, «1 gol». */
  sub: string;
  crest: boolean;
  gold: boolean;
  dim: boolean;
  mvp: boolean;
  /** «No voy»: an ✕ on the pan of the empty seat. */
  no: boolean;
  marks: MarkView[];
  aria: string;
  /** The member can vote him for MVP by tapping the seat. */
  votable: boolean;
}
export interface CountView {
  cls: string;
  glyph: string;
  text: string;
}
export interface PlayLine {
  minute: string;
  text: string;
}
export interface FilaView {
  title: string;
  lead: string;
  counts: CountView[] | null;
  seats: SeatView[];
  /** Markers line above the seats (live, after, or any marker in the row). */
  marksOn: boolean;
  tape: boolean;
  light: string;
  /** «Levanta tu cartulina»: the member can answer from here. */
  canAnswer: boolean;
  meTitle: string;
  meText: string;
  /** A plain note instead of the controls. */
  note: string | null;
  link: { kind: "vestuario" | "ausencias"; text: string } | null;
  plays: PlayLine[];
  liveNote: string;
  meLive: string;
  endNote: string;
  vote: { open: boolean; title: string; text: string } | null;
}

export interface ViewInput {
  row: FrontRow;
  day: Pick<MatchdayModel, "phase" | "match" | "next" | "minute" | "added" | "score">;
  viewer: ViewerRole;
  light: LightKey;
  /** The member's name for the notes when he has no seat (null: a fan, or not known yet). */
  memberName: string | null;
  /** The MVP vote shown (playerId, "" none). */
  vote: string;
  status: FilaStatus;
  now: number;
}

const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });
const NUMBERS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte"];
/** «siete», «doce»; digits from 21 on. */
export const word = (n: number): string => NUMBERS[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
/** «Erik», «Erik y Kevin», «Erik, Kevin y Jorge». */
export function list(names: readonly string[]): string {
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
const dayIndex = (ms: number) => {
  const [y, m, d] = madridDate(ms).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
/** «hoy», «mañana», «el domingo», «el domingo 25». */
export function whenOf(at: number, now: number): string {
  const days = dayIndex(at) - dayIndex(now);
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  const wd = WEEKDAY.format(at);
  return days > 1 && days < 7 ? `el ${wd}` : `el ${wd} ${Number(madridDate(at).slice(8))}`;
}
/** «el martes a las 20:00», «hoy a las 20:00». */
const closeOf = (at: number, now: number) => `${whenOf(at, now)} a las ${madridTime(at)}`;
const posName = (code: string | null) => (code && isPosCode(code) ? POSITIONS[code].name.toLocaleLowerCase("es") : null);
const min = (m: SeatMarker) => (typeof m.minute === "number" ? `${m.minute}′` : "");
const at = (m: SeatMarker) => (typeof m.minute === "number" ? ` en el ${m.minute}` : "");

const LIGHT: Record<LightKey, string> = { dia: "dia", tarde: "tarde", dorada: "dorada", ocaso: "ocaso", noche: "focos" };

function markOf(m: SeatMarker): MarkView | null {
  switch (m.kind) {
    case "gol":
      return { cls: "g", text: `G ${min(m)}`.trim() };
    case "amarilla":
      return { cls: "y", text: `A ${min(m)}`.trim() };
    case "roja":
      return { cls: "r", text: `R ${min(m)}`.trim() };
    case "entra":
      return { cls: "in", text: `↑${min(m)}` };
    case "sale":
      return { cls: "out", text: `↓${min(m)}` };
    case "lesion":
      return { cls: "inj", text: `+ ${min(m)}`.trim() };
    case "mvp":
      return { cls: "g", text: "MVP" };
    case "anota":
      return { cls: "anota", text: "anota" };
  }
}
function markWord(m: SeatMarker): string {
  switch (m.kind) {
    case "gol":
      return `gol${at(m)}`;
    case "amarilla":
      return `amarilla${at(m)}`;
    case "roja":
      return `roja${at(m)}`;
    case "lesion":
      return `tocado${at(m)}`;
    case "mvp":
      return "mejor del partido";
    case "anota":
      return "anota el partido";
    default:
      return "";
  }
}

const STATE_OF: Record<Answer, "voy" | "duda" | "novoy"> = { yes: "voy", maybe: "duda", no: "novoy" };
const COUNT_OF = { voy: "vienen", duda: "duda", novoy: "no", sinresponder: "sinResponder", ausente: "ausentes" } as const;

/** The row with the member's own answer in it before the listener brings it back (an optimistic answer):
 *  his seat and the counts move at once. Nothing changes without a seat of his or outside the convocatoria. */
export function withAnswer(row: FrontRow, answer: Answer | null): FrontRow {
  if (!answer || row.mode !== "convocatoria" || !row.counts) return row;
  const mine = row.seats.find((s) => s.mine);
  const next = STATE_OF[answer];
  if (!mine || mine.state === next) return row;
  const counts = { ...row.counts };
  const from = COUNT_OF[mine.state as keyof typeof COUNT_OF];
  if (from) counts[from] = Math.max(0, counts[from] - 1);
  counts[COUNT_OF[next]] += 1;
  return { ...row, counts, seats: row.seats.map((s) => (s === mine ? { ...s, state: next } : s)) };
}

/** Every seat of the row, drawn for this mode and viewer. */
function seatsOf(input: ViewInput, voteOpen: boolean): SeatView[] {
  const { row, day, vote, status } = input;
  const answers = row.counts !== null && status !== "loading";
  const member = input.viewer !== "aficionado" && status !== "loading";
  const anyCalled = row.seats.some((s) => s.state === "convocado");
  const aplazado = day.phase === "aplazado";
  return row.seats.map((seat) => {
    const v: SeatView = { seat, pose: "fold", face: "", sub: "", crest: false, gold: false, dim: false, mvp: false, no: false, marks: [], aria: "", votable: false };
    const words: string[] = [];
    const markers = seat.markers;
    const gold = row.sevenPublished && seat.starter;
    if (row.mode === "plantilla") {
      words.push("asiento plegado");
    } else if (row.mode === "convocatoria") {
      if (answers) {
        if (seat.state === "voy") {
          v.pose = "up";
          v.face = "✓";
          if (gold && seat.position) v.sub = seat.position;
          words.push("viene");
        } else if (seat.state === "duda") {
          v.pose = "half";
          v.face = "?";
          words.push("en duda");
        } else if (seat.state === "novoy") {
          v.pose = "empty";
          v.no = true;
          words.push("no va");
        } else if (seat.state === "ausente") {
          v.marks.push({ cls: "baja", text: "de baja" });
          words.push("de baja");
        } else words.push("sin contestar");
      } else if (seat.state === "convocado") {
        v.pose = "up";
        v.crest = true;
        words.push("convocado");
      } else {
        v.dim = anyCalled;
        words.push(anyCalled ? "no convocado" : "por convocar");
      }
      v.gold = gold;
      if (aplazado) v.dim = true;
      for (const m of markers) if (m.kind === "anota") v.marks.push({ cls: "anota", text: "anota" });
      if (markers.some((m) => m.kind === "anota")) words.push("anota el partido");
    } else if (row.mode === "banquillo") {
      const entra = markers.find((m) => m.kind === "entra");
      const sale = markers.find((m) => m.kind === "sale");
      for (const m of markers) {
        const mk = markOf(m);
        if (mk) v.marks.push(mk);
      }
      if (seat.state === "campo") {
        v.pose = "empty";
        if (!entra) v.marks.push({ cls: "pitch", text: "" });
        words.push(entra ? `entró${at(entra)}` : "en el campo");
      } else if (seat.state === "expulsado") {
        v.pose = "empty";
        words.push("expulsado");
      } else if (seat.state === "banquillo" || seat.state === "lesionado") {
        v.pose = "low";
        v.crest = true;
        words.push(sale ? `salió${at(sale)}` : seat.state === "lesionado" ? "tocado, en el banquillo" : "en el banquillo");
      } else {
        v.dim = true;
        words.push(seat.state === "ausente" ? "de baja" : "no convocado");
      }
      v.gold = gold;
      for (const m of markers) if (m.kind !== "entra" && m.kind !== "sale" && m.kind !== "lesion") words.push(markWord(m));
      if (seat.state === "lesionado" && sale) words.push("tocado");
    } else {
      // jugaron: minutes on the card; only the red, the MVP and the logros above it
      if (seat.state === "jugo") {
        v.pose = "up";
        v.face = `${seat.minutes ?? 0}′`;
        const goals = seat.goals ?? 0;
        if (goals) v.sub = goals === 1 ? "1 gol" : `${goals} goles`;
        words.push(`jugó ${seat.minutes ?? 0} minutos`);
        if (goals) words.push(goals === 1 ? "1 gol" : `${goals} goles`);
      } else if (seat.state === "nojugo") {
        v.pose = "low";
        v.face = "–";
        words.push("no llegó a jugar");
      } else {
        v.dim = true;
        words.push(seat.state === "ausente" ? "de baja" : "no convocado");
      }
      for (const m of markers) {
        if (m.kind === "roja") {
          v.marks.push({ cls: "r", text: `R ${min(m)}`.trim() });
          words.push(markWord(m));
        }
        if (m.kind === "mvp") {
          v.mvp = true;
          v.marks.push({ cls: "g", text: "MVP" });
          words.push("mejor del partido");
        }
      }
      const logros = seat.logros ?? [];
      if (logros.length) {
        v.marks.push({ cls: "logro", text: logros.length === 1 ? logros[0] : `${logros.length} logros`, short: String(logros.length) });
        words.push(logros.length === 1 ? `logro ${logros[0]}` : `logros ${list(logros)}`);
      }
      if (voteOpen && member && seat.mvpCandidate) {
        v.votable = true;
        if (vote === seat.playerId) {
          v.marks.push({ cls: "mvpc", text: "tu voto" });
          words.push("tu voto para el mejor del partido");
        }
      }
    }
    v.aria = `${seat.name}, dorsal ${seat.dorsal}: ${words.filter(Boolean).join(", ")}${v.gold ? ", en el siete" : ""}${seat.mine ? " (tú)" : ""}`;
    return v;
  });
}

function countsOf(row: FrontRow): CountView[] | null {
  const c = row.counts;
  if (!c) return null;
  const out: CountView[] = [{ cls: "", glyph: "✓", text: `${c.vienen === 1 ? "Viene" : "Vienen"} ${c.vienen} de ${row.seats.length}` }];
  if (c.duda) out.push({ cls: "d", glyph: "?", text: `${c.duda} en duda` });
  if (c.no) out.push({ cls: "n", glyph: "✕", text: `${c.no} ${c.no === 1 ? "no va" : "no van"}` });
  out.push({ cls: "s", glyph: "–", text: `${c.sinResponder} sin contestar` });
  if (c.ausentes) out.push({ cls: "a", glyph: "B", text: `${c.ausentes} ${c.ausentes === 1 ? "ausente" : "ausentes"}` });
  return out;
}

/** The last two plays that moved the bench (cambios, reds, knocks, cards), newest first. */
function benchPlays(seats: readonly Seat[]): PlayLine[] {
  const lines: { m: number; text: string }[] = [];
  const ins = seats.flatMap((s) => s.markers.filter((m) => m.kind === "entra").map((m) => ({ s, m })));
  const outs = seats.flatMap((s) => s.markers.filter((m) => m.kind === "sale").map((m) => ({ s, m })));
  const used = new Set<(typeof outs)[number]>();
  for (const i of ins) {
    const o = outs.find((x) => !used.has(x) && x.m.minute === i.m.minute);
    if (o) used.add(o);
    lines.push({ m: i.m.minute ?? 0, text: o ? `Entra ${i.s.name} por ${o.s.name}` : `Entra ${i.s.name}` });
  }
  for (const s of seats)
    for (const m of s.markers) {
      if (m.kind === "roja") lines.push({ m: m.minute ?? 0, text: `Roja a ${s.name}` });
      else if (m.kind === "amarilla") lines.push({ m: m.minute ?? 0, text: `Amarilla a ${s.name}` });
      else if (m.kind === "lesion") lines.push({ m: m.minute ?? 0, text: `${s.name}, tocado` });
    }
  return lines
    .sort((a, b) => b.m - a.m)
    .slice(0, 2)
    .map((l) => ({ minute: `${l.m}′`, text: l.text }));
}

/** «Debut para los nueve que jugaron y Primer gol del Piti para Alcides». */
function logrosSentence(seats: readonly Seat[]): string {
  const by = new Map<string, string[]>();
  for (const s of seats) for (const l of s.logros ?? []) by.set(l, [...(by.get(l) ?? []), s.name]);
  const parts = [...by].map(([label, names]) => `${label} para ${names.length > 3 ? `los ${word(names.length)} que jugaron` : list(names)}`);
  return list(parts);
}

export function filaView(input: ViewInput): FilaView {
  const { row, day, viewer, now, status, vote } = input;
  const match = day.match;
  const rival = match?.rival || "el rival";
  const kickoff = match ? dateMillis(match.date) : NaN;
  const hasKickoff = Number.isFinite(kickoff);
  const loading = status === "loading";
  const member = viewer !== "aficionado" && !loading;
  /** The convocatoria's answers are here (members only, by the data). */
  const answers = row.counts !== null && !loading;
  const mine = row.seats.find((s) => s.mine) ?? null;
  const name = mine?.name ?? input.memberName ?? "";
  const voteOpen = row.mode === "jugaron" && row.seats.some((s) => s.mvpCandidate !== undefined);
  const seats = seatsOf(input, voteOpen);
  const view: FilaView = {
    title: "La primera fila",
    lead: "",
    counts: answers && row.mode === "convocatoria" ? countsOf(row) : null,
    seats,
    marksOn: row.mode === "banquillo" || row.mode === "jugaron" || seats.some((s) => s.marks.length > 0),
    tape: day.phase === "aplazado" && row.mode === "convocatoria",
    light: day.phase === "aplazado" ? "nublado" : LIGHT[input.light],
    canAnswer: false,
    meTitle: "",
    meText: "",
    note: null,
    link: null,
    plays: [],
    liveNote: "",
    meLive: "",
    endNote: "",
    vote: null,
  };

  if (row.mode === "plantilla") {
    view.title = "La primera fila, plegada";
    view.lead = "Aún no hay calendario. Cuando el capitán lo publique, cada asiento dirá quién viene.";
    if (!loading) view.note = mine ? `Tu asiento es el ${mine.dorsal}. En cuanto haya partido, lo bajas tú.` : member ? null : `La plantilla son ${word(row.seats.length)}: cada uno con su asiento y su dorsal.`;
    return view;
  }

  if (row.mode === "convocatoria") {
    const called = row.seats.filter((s) => s.state === "convocado").length;
    const starters = row.seats.filter((s) => s.starter).length;
    const when = hasKickoff ? whenOf(kickoff, now) : "";
    const time = hasKickoff ? madridTime(kickoff) : "";
    if (day.phase === "aplazado") {
      view.title = "Aplazado";
      view.lead = `El partido contra ${rival} se ha aplazado. ${answers ? "Tus respuestas se guardan para la nueva fecha." : "La nueva fecha, cuando la confirme la liga."}`;
      if (!loading) view.note = answers ? "Si cambias de planes para la nueva fecha, podrás contestar otra vez cuando se confirme." : "Los asientos se quedan como estaban hasta la nueva fecha.";
      return view;
    }
    const today = when === "hoy";
    if (!today) {
      view.title = hasKickoff ? `La primera fila del ${WEEKDAY.format(kickoff)}` : "La primera fila";
      const head = `Contra ${rival}${when ? `, ${when}` : ""}.`;
      view.lead = answers
        ? `${head} Ve contestando: el capitán hace la convocatoria con vuestras respuestas.`
        : called
          ? `${head} Ya ha salido la convocatoria: ${word(called)} convocados.`
          : `${head} Cuando salga la convocatoria, se bajan los asientos.`;
    } else if (answers) {
      view.lead = `Hoy${time ? ` a las ${time}` : ""} contra ${rival}. ${row.sevenPublished ? "Borde dorado: los siete que salen." : "El siete aún no está: lo publica el capitán desde la pizarra."}`;
    } else {
      view.title = "Los convocados de hoy";
      const bench = called - starters;
      view.lead = !called
        ? `Hoy${time ? ` a las ${time}` : ""} contra ${rival}. La convocatoria aún no ha salido.`
        : row.sevenPublished
          ? `${cap(word(called))} convocados: los ${word(starters)} del borde dorado salen${bench > 0 ? `; ${word(bench)} ${bench === 1 ? "espera" : "esperan"} en el banquillo` : ""}.`
          : `${cap(word(called))} convocados. El siete aún no está.`;
    }
    if (loading) return view;
    if (!answers) {
      view.note = today ? "Las respuestas de cada uno son cosa del vestuario; aquí ves la convocatoria publicada." : "Las respuestas de los jugadores son cosa del vestuario.";
      view.link = { kind: "vestuario", text: "¿Juegas en el Piti? Entra al vestuario" };
      return view;
    }
    const open = !!match && kickoffWindow(match, now) === "open";
    if (viewer === "ausente") {
      view.note = `Tienes una ausencia apuntada para ese día${name ? `, ${name}` : ""}: no hace falta que contestes.`;
      view.link = { kind: "ausencias", text: "Quitar la ausencia" };
      return view;
    }
    if (today && viewer === "anotador") {
      view.note = `Esta vez no juegas${name ? `, ${name}` : ""}: tu asiento se queda plegado porque llevas la mesa.`;
      return view;
    }
    const listed = (match?.starters?.length ?? 0) + (match?.bench?.length ?? 0) > 0 || row.sevenPublished;
    if (today && viewer === "noconvocado" && listed) {
      view.note = `Esta vez no vas convocado${name ? `, ${name}` : ""}: tu asiento se queda plegado. Si alguien se cae, el capitán te avisa.`;
      return view;
    }
    if (!open) {
      view.note = "La convocatoria se cerró a la hora del partido.";
      return view;
    }
    view.canAnswer = true;
    view.meTitle = today ? "Levanta tu cartulina" : `¿Vienes ${when}?`;
    const seat = mine ? `Tu asiento es el ${mine.dorsal}.` : "";
    const pos = posName(mine?.position ?? null);
    view.meText = !mine
      ? "Tu respuesta le llega al capitán al momento."
      : !today
        ? `${seat} Contesta y el capitán lo tiene en cuenta.`
        : viewer === "titular" && row.sevenPublished
          ? `${seat} Sales de titular${pos ? `, de ${pos}` : ""}.`
          : viewer === "suplente"
            ? `${seat} Vas convocado, al banquillo.`
            : `${seat} El siete, en cuanto lo publique el capitán.`;
    return view;
  }

  const score = day.score ? `${day.score.gf}–${day.score.ga}` : "";
  if (row.mode === "banquillo") {
    const benchNow = row.seats.filter((s) => s.state === "banquillo" || s.state === "lesionado");
    const onPitch = row.seats.filter((s) => s.state === "campo").length;
    const entered = row.seats.filter((s) => s.state === "campo" && s.markers.some((m) => m.kind === "entra")).map((s) => s.name);
    const reds = row.seats.flatMap((s) => s.markers.filter((m) => m.kind === "roja").map((m) => ({ s, m }))).sort((a, b) => (b.m.minute ?? 0) - (a.m.minute ?? 0));
    const story = reds[0]
      ? `Roja a ${reds[0].s.name}: su asiento se queda vacío.`
      : entered.length
        ? `${entered.length === 1 ? "Ha entrado" : "Han entrado"} ${list(entered)}.`
        : `${cap(word(onPitch))} en el campo y ${word(benchNow.length)} esperando su turno.`;
    if (day.phase === "pitido") {
      view.title = "El banquillo, listo";
      view.lead = "Pendiente del pitido inicial: la mesa aún no ha puesto el reloj.";
    } else if (day.phase === "descanso") {
      view.title = "Descanso";
      view.lead = `${score ? `${score} al descanso. ` : ""}${story}`;
    } else {
      view.title = "El banquillo";
      const clock = typeof day.minute === "number" ? `Minuto ${day.minute}${day.added ? `, añadido +${day.added}` : ""}` : "";
      view.lead = `${[clock, score].filter(Boolean).join(", ")}${clock || score ? ". " : ""}${story}`;
    }
    view.plays = benchPlays(row.seats);
    view.liveNote = benchNow.length ? `En el banquillo: ${list(benchNow.map((s) => s.name))}.` : "";
    if (member && mine) {
      const entra = mine.markers.find((m) => m.kind === "entra");
      const sale = mine.markers.find((m) => m.kind === "sale");
      const pos = posName(mine.position);
      view.meLive =
        viewer === "anotador"
          ? "Estás anotando el partido."
          : mine.state === "campo"
            ? entra
              ? `Entraste en el ${entra.minute ?? ""}′.`
              : `Estás en el campo desde el 1′${pos ? `, de ${pos}` : ""}.`
            : mine.state === "banquillo" || mine.state === "lesionado"
              ? sale
                ? `Saliste en el ${sale.minute ?? ""}′.`
                : `Estás en el banquillo, con el ${mine.dorsal}.`
              : mine.state === "expulsado"
                ? ""
                : "Hoy lo ves desde la grada.";
    } else if (member && viewer === "anotador") view.meLive = "Estás anotando el partido.";
    return view;
  }

  // jugaron
  view.title = "Los que jugaron";
  const played = row.seats.filter((s) => s.state === "jugo");
  const mvp = row.seats.find((s) => s.markers.some((m) => m.kind === "mvp"));
  const logros = logrosSentence(row.seats);
  const closes = typeof match?.voteClosesAt === "number" ? closeOf(match.voteClosesAt, now) : "";
  if (day.phase === "final") {
    view.lead = `Final${score ? `, ${score}` : ""}. Minutos provisionales hasta que la mesa publique el acta.`;
    view.endNote = "Los logros y la votación del mejor llegan con el acta.";
  } else if (day.phase === "acta" || voteOpen) {
    view.lead = `Acta publicada${score ? `, ${score}` : ""}: ${word(played.length)} jugaron.${voteOpen ? " Ya se vota al mejor del partido." : ""}`;
    view.endNote = member ? (logros ? `Con el acta: ${logros}.` : "") : `La votación del mejor es de los socios${closes ? `; ${closes} sale el resultado` : ""}.`;
  } else {
    const next = day.next;
    const nextAt = next ? dateMillis(next.date) : NaN;
    const nextText = next && Number.isFinite(nextAt) ? ` Siguiente: ${whenOf(nextAt, now)}, contra ${next.rival || "el rival"}${next.home === false ? ", fuera" : next.home ? ", en casa" : ""}.` : "";
    view.lead = `${mvp ? `${mvp.name}, mejor del partido.` : `Partido cerrado${score ? `, ${score}` : ""}.`}${nextText}`;
    view.endNote = logros ? `Logros de la noche: ${logros}.` : "";
  }
  if (voteOpen && member) {
    const voted = vote ? row.seats.find((s) => s.playerId === vote) : undefined;
    const until = closes ? ` hasta ${closes}` : " hasta que cierre";
    view.vote = voted
      ? { open: true, title: `Tu voto: ${voted.name}, el ${voted.dorsal}`, text: `Para cambiarlo, toca otro asiento: vale${until}. El recuento no se ve hasta que cierre.` }
      : {
          open: true,
          title: "Vota al mejor del partido",
          text: `Toca el asiento de uno de los ${word(played.length)} que jugaron. Puedes cambiarlo${until}; nadie ve el recuento hasta entonces.`,
        };
  }
  return view;
}
