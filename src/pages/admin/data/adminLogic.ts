// The admin's domain logic, pure (tested in adminLogic.test.ts): matches merged with their drafts and
// numbered by jornada, the acta review («¿Cuadra?» — the checks MatchEditor's save and the backend's
// saveMatchSheet apply, extracted), the convocatoria state, RSVP counts, the content gaps, and the
// Inicio overview (Por hacer + the live counters). Router-, React- and Firebase-free.
import { calculateLedger, dateMillis, matchPhase, type MatchEvent } from "../../../../functions/src/matchEngine";
import type { ClubMatch } from "../../../lib/clubData";
import type { AdminTarget, Counter, SectionKey } from "../shell/nav";

const TZ = "Europe/Madrid";
const GOAL_TYPES = new Set(["goal", "goal_penalty", "goal_freekick"]);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ───────────────────────── dates (club time) ─────────────────────────
function parts(ms: number, o: Intl.DateTimeFormatOptions) {
  return Object.fromEntries(new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...o }).formatToParts(ms).map((p) => [p.type, p.value]));
}
/** «dom 1 nov» (Madrid). */
export function shortDate(ms: number): string {
  if (!Number.isFinite(ms)) return "sin fecha";
  const p = parts(ms, { weekday: "short", day: "numeric", month: "short" });
  return `${String(p.weekday).replace(".", "")} ${p.day} ${String(p.month).replace(".", "")}`;
}
/** «12:00» (Madrid). */
export function clockTime(ms: number): string {
  if (!Number.isFinite(ms)) return "--:--";
  const p = parts(ms, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}
/** «Lunes 2 nov» (Madrid). */
export function longDay(ms: number): string {
  const p = parts(ms, { weekday: "long", day: "numeric", month: "short" });
  const wd = String(p.weekday);
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${p.day} ${String(p.month).replace(".", "")}`;
}

// ───────────────────────── matches ─────────────────────────
export interface AdminMatch extends ClubMatch {
  /** A draft exists in matchDrafts (its fields are the ones shown). */
  draft: boolean;
  /** The match is in the public calendar (matches). */
  published: boolean;
  /** 1-based number inside its season, by date (null without season). */
  jornada: number | null;
  /** When the draft was last saved (ms), if any. */
  draftSavedAt?: number;
}
type WithUpdated = ClubMatch & { updatedAt?: unknown };

/** Published matches + drafts, one per id (the draft's fields win), oldest first, numbered per season. */
export function mergeMatches(published: readonly ClubMatch[], drafts: readonly WithUpdated[]): AdminMatch[] {
  const byId = new Map<string, AdminMatch>();
  for (const m of published) byId.set(m.id, { ...m, draft: false, published: true, jornada: null });
  for (const d of drafts) {
    const pub = byId.get(d.id);
    const saved = dateMillis(d.updatedAt);
    const { updatedAt: _updated, ...rest } = d;
    void _updated;
    byId.set(d.id, { ...(pub ?? {}), ...rest, draft: true, published: !!pub, jornada: null, draftSavedAt: Number.isFinite(saved) ? saved : undefined });
  }
  const list = [...byId.values()].sort((a, b) => (dateMillis(a.date) || 0) - (dateMillis(b.date) || 0));
  const count = new Map<string, number>();
  for (const m of list) {
    if (!m.seasonId) continue;
    const n = (count.get(m.seasonId) ?? 0) + 1;
    count.set(m.seasonId, n);
    m.jornada = n;
  }
  return list;
}

export type AdminMatchState = "draft" | "acta" | "published" | "next" | "scheduled" | "postponed" | "cancelled";
/** Where a match stands for the captains: a draft, an acta to write (played, unpublished), published… */
export function matchState(m: AdminMatch, now: number, nextId?: string): AdminMatchState {
  if (m.draft) return "draft";
  if (m.status === "cancelled") return "cancelled";
  if (m.status === "postponed") return "postponed";
  const phase = matchPhase(m, now);
  if (phase === "finished") return "published";
  if (phase === "playing" || phase === "awaiting_result") return "acta";
  if (m.id === nextId) return "next";
  return "scheduled";
}
/** The list's groups: Por hacer / Publicados / Por jugar. */
export function matchGroup(state: AdminMatchState): "hacer" | "publicados" | "jugar" {
  return state === "draft" || state === "acta" || state === "next" ? "hacer" : state === "published" || state === "cancelled" ? "publicados" : "jugar";
}
/** The next fixture to prepare: the earliest match still to be played (drafts of new matches included). */
export function nextMatch(matches: readonly AdminMatch[], now: number): AdminMatch | undefined {
  return matches
    .filter((m) => m.status !== "cancelled" && m.status !== "postponed" && ["scheduled", "playing"].includes(matchPhase(m, now)))
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
}
/** The latest played match whose acta is the one to look at: a draft or an unpublished played match
 *  first (oldest pending first), else the last published one. */
export function lastActaMatch(matches: readonly AdminMatch[], now: number): AdminMatch | undefined {
  const played = matches.filter((m) => {
    const t = dateMillis(m.date);
    return Number.isFinite(t) && t <= now && m.status !== "cancelled" && m.status !== "postponed";
  });
  const pending = played.filter((m) => m.draft || matchPhase(m, now) !== "finished");
  if (pending.length) return pending.sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
  return played.sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
}

// ───────────────────────── the acta review («¿Cuadra?») ─────────────────────────
export type CheckTone = "ok" | "warn" | "info";
export interface CheckItem {
  key: "encuentro" | "convocatoria" | "goles" | "fecha" | "eventos" | "asistencias" | "minutos";
  tone: CheckTone;
  title: string;
  detail: string;
}
export type StepKey = "encuentro" | "convocatoria" | "acta" | "publicar";
export interface ActaStep {
  key: StepKey;
  label: string;
  /** Phone tab label. */
  short: string;
  tone: "ok" | "warn" | "";
  /** ✓ / ! / the step number. */
  mark: string;
  /** «dom 1 nov», «7 + 5», «3–1» / «falta 1», «publicada» / «lista» / «pendiente». */
  summary: string;
}
export interface ActaReview {
  /** The sheet is (or, being already played, must become) a finished match. */
  finished: boolean;
  items: CheckItem[];
  /** Everything required is in order: it can be published. */
  cuadra: boolean;
  /** The warn titles, as «Para publicar: …» reasons. */
  reasons: string[];
  /** The footer line: what is missing, or what publishing does. */
  why: string;
  goalsFor: number;
  goalsAgainst: number;
  /** Our goals with a scorer (goal events + rival own goals). */
  named: number;
  missingScorers: number;
  /** 1-based number of the first goal without scorer (null when none is missing). */
  firstMissingGoal: number | null;
  /** Goals of ours with an assist / goals of ours scored by our players. */
  assisted: number;
  ours: number;
  starters: number;
  bench: number;
  notCalled: number;
  unassigned: number;
  ledgerErrors: string[];
  steps: ActaStep[];
}
export interface SheetLike {
  seasonId?: string;
  rival?: string;
  date?: unknown;
  status?: string;
  duration?: number;
  venue?: string;
  starters?: string[];
  bench?: string[];
  notCalled?: string[];
  events?: MatchEvent[];
  goalsFor?: number;
  goalsAgainst?: number;
}

/**
 * The acta's checks — the ones MatchEditor's save and the backend (saveMatchSheet) enforce before
 * publishing: encuentro (season, rival, date; a played match must be marked finished), convocatoria
 * (7 titulares, everyone of the season assigned), the score matching the goals written down (ours with
 * scorer, theirs as rival goals), the match having started, and the ledger's own errors. Assists and
 * minutes are informative. `roster` = the season's player ids; `publishedClean` = published, no draft.
 */
export function reviewActa(sheet: SheetLike, roster: readonly string[], now: number, publishedClean = false): ActaReview {
  const date = dateMillis(sheet.date);
  const played = Number.isFinite(date) && date <= now;
  const status = sheet.status ?? (typeof sheet.goalsFor === "number" ? "finished" : "scheduled");
  const off = status === "cancelled" || status === "postponed";
  const finished = status === "finished" || (played && !off);
  const starters = sheet.starters ?? [];
  const bench = sheet.bench ?? [];
  const notCalled = sheet.notCalled ?? [];
  const events = sheet.events ?? [];
  const assigned = new Set([...starters, ...bench, ...notCalled]);
  const unassigned = roster.filter((id) => !assigned.has(id)).length;
  const ledger = calculateLedger({ starters, bench, notCalled, events, duration: sheet.duration ?? 50 }, finished);
  const gf = sheet.goalsFor ?? 0;
  const ga = sheet.goalsAgainst ?? 0;
  const named = ledger.goalsFor;
  const missingScorers = Math.max(0, gf - named);
  const ourGoals = events.filter((e) => GOAL_TYPES.has(e.type));
  const assisted = ourGoals.filter((e) => e.assistPlayerId).length;
  const rival = (sheet.rival ?? "").trim();
  const items: CheckItem[] = [];

  // encuentro
  if (!sheet.seasonId) items.push({ key: "encuentro", tone: "warn", title: "Falta la temporada", detail: "Elige la temporada en «Encuentro»." });
  else if (!rival) items.push({ key: "encuentro", tone: "warn", title: "Falta el rival", detail: "Escribe el rival en «Encuentro»." });
  else if (!Number.isFinite(date)) items.push({ key: "encuentro", tone: "warn", title: "Falta la fecha", detail: "Pon fecha y hora (Madrid) en «Encuentro»." });
  else if (played && !off && status !== "finished") items.push({ key: "encuentro", tone: "warn", title: "Márcalo como finalizado", detail: `El partido ya se jugó: en «Encuentro», estado Finalizado.` });
  else items.push({ key: "encuentro", tone: "ok", title: sheet.venue ? "Encuentro: rival, fecha, hora y campo" : "Encuentro: rival, fecha y hora", detail: `${rival} · ${shortDate(date)} · ${clockTime(date)}${sheet.venue ? "" : " · campo pendiente"}` });

  // convocatoria
  const nT = starters.length;
  const convOk = (finished ? nT === 7 : nT <= 7) && (!finished || unassigned === 0);
  items.push(
    convOk
      ? { key: "convocatoria", tone: "ok", title: `Convocatoria: ${plural(nT, "titular", "titulares")} y ${plural(bench.length, "suplente", "suplentes")}`, detail: unassigned ? `${plural(unassigned, "jugador", "jugadores")} sin asignar` : "Todos asignados" }
      : {
          key: "convocatoria",
          tone: "warn",
          title: nT > 7 ? "Hay más de siete titulares" : nT === 0 ? "Faltan los titulares" : nT < 7 ? `Faltan titulares (${nT} de 7)` : `Hay ${plural(unassigned, "jugador", "jugadores")} sin asignar`,
          detail: "Cada jugador: titular, suplente o no convocado.",
        },
  );

  if (finished) {
    // goals
    if (missingScorers > 0)
      items.push({ key: "goles", tone: "warn", title: missingScorers === 1 ? `Falta el goleador del gol ${named + 1}` : `Faltan ${missingScorers} goleadores`, detail: `El marcador dice ${gf} y hay ${named} con nombre.` });
    else if (named > gf) items.push({ key: "goles", tone: "warn", title: "Hay más goles apuntados que en el marcador", detail: `El marcador dice ${gf} y hay ${named} apuntados.` });
    else if (ledger.goalsAgainst !== ga)
      items.push({ key: "goles", tone: "warn", title: `Goles de ${rival || "el rival"}: ${ga} en el marcador, ${ledger.goalsAgainst} apuntados`, detail: "Apunta cada gol rival con su minuto." });
    else items.push({ key: "goles", tone: "ok", title: `Goles: ${gf} en el marcador, ${named} con nombre`, detail: `El ${gf}–${ga} cuadra con los goles apuntados.` });
    // date
    if (Number.isFinite(date) && date > now) items.push({ key: "fecha", tone: "warn", title: "El partido todavía no ha comenzado", detail: "Se publica como finalizado cuando ya se ha jugado." });
  }
  // the ledger's other errors (the seven-starters rule is the convocatoria's)
  const ledgerErrors = ledger.errors.filter((e) => e !== "Selecciona exactamente 7 titulares.");
  if (ledgerErrors.length) items.push({ key: "eventos", tone: "warn", title: "Revisa los eventos", detail: ledgerErrors[0] });
  if (finished) {
    items.push({ key: "asistencias", tone: "info", title: `${assisted} de ${ourGoals.length} goles con asistencia`, detail: "Opcional: no impide publicar." });
    if (convOk && !ledgerErrors.length) items.push({ key: "minutos", tone: "ok", title: "Minutos calculados", detail: "Salen de la convocatoria y los cambios." });
  }

  const warns = items.filter((i) => i.tone === "warn");
  const cuadra = warns.length === 0;
  const reasons = warns.map((i) => i.title.charAt(0).toLowerCase() + i.title.slice(1));
  const why = !cuadra
    ? `Para publicar: ${reasons.join(" · ")}.`
    : publishedClean
      ? finished
        ? "Calendario, perfiles y estadísticas al día."
        : "Publicado en el calendario."
      : finished
        ? "Al publicar se actualiza la web y se abre el MVP (48 h)."
        : "Al publicar sale en el calendario.";

  const toneOf = (keys: CheckItem["key"][]): "ok" | "warn" => (items.some((i) => keys.includes(i.key) && i.tone === "warn") ? "warn" : "ok");
  const enc = toneOf(["encuentro"]);
  const cv = toneOf(["convocatoria"]);
  const acta = finished ? toneOf(["goles", "fecha", "eventos"]) : ledgerErrors.length ? "warn" : "";
  const steps: ActaStep[] = [
    { key: "encuentro", label: "Encuentro", short: "Datos", tone: enc, mark: enc === "ok" ? "✓" : "!", summary: Number.isFinite(date) ? shortDate(date) : "sin fecha" },
    { key: "convocatoria", label: "Convocatoria", short: "Convoc.", tone: cv, mark: cv === "ok" ? "✓" : "!", summary: `${nT} + ${bench.length}` },
    {
      key: "acta",
      label: "Acta",
      short: "Acta",
      tone: acta,
      mark: acta === "ok" ? "✓" : acta === "warn" ? "!" : "3",
      summary: !finished ? "sin jugar" : missingScorers ? `falta ${missingScorers}` : `${gf}–${ga}`,
    },
    { key: "publicar", label: "Publicar", short: "Publicar", tone: publishedClean ? "ok" : "", mark: publishedClean ? "✓" : "4", summary: publishedClean ? "publicada" : cuadra ? "lista" : "pendiente" },
  ];
  return {
    finished,
    items,
    cuadra,
    reasons,
    why,
    goalsFor: gf,
    goalsAgainst: ga,
    named,
    missingScorers,
    firstMissingGoal: missingScorers ? named + 1 : null,
    assisted,
    ours: ourGoals.length,
    starters: nT,
    bench: bench.length,
    notCalled: notCalled.length,
    unassigned,
    ledgerErrors,
    steps,
  };
}

// ───────────────────────── convocatoria & RSVP ─────────────────────────
export interface ConvocatoriaState {
  starters: number;
  bench: number;
  notCalled: number;
  unassigned: number;
  /** 1–7 titulares and nobody left to assign. */
  ready: boolean;
  /** Ready and live in the public calendar (no pending draft). */
  published: boolean;
  /** `.st` look: pub (sky ✓), ok (green ✓), warn (amber !). */
  tone: "pub" | "ok" | "warn";
  mark: "✓" | "!";
  text: string;
}
export function convocatoriaState(sheet: Pick<SheetLike, "starters" | "bench" | "notCalled">, roster: readonly string[], publishedClean: boolean): ConvocatoriaState {
  const s = sheet.starters ?? [];
  const b = sheet.bench ?? [];
  const n = sheet.notCalled ?? [];
  const assigned = new Set([...s, ...b, ...n]);
  const unassigned = roster.filter((id) => !assigned.has(id)).length;
  const ready = s.length >= 1 && s.length <= 7 && unassigned === 0;
  const published = ready && publishedClean;
  return {
    starters: s.length,
    bench: b.length,
    notCalled: n.length,
    unassigned,
    ready,
    published,
    tone: published ? "pub" : ready ? "ok" : "warn",
    mark: ready ? "✓" : "!",
    text: published ? "Convocatoria publicada" : unassigned ? `${unassigned} sin asignar en la convocatoria` : s.length > 7 ? "Hay más de siete titulares" : !s.length ? "Faltan los titulares" : "Convocatoria lista para publicar",
  };
}

export interface RsvpCounts {
  yes: number;
  maybe: number;
  no: number;
  /** Players of the roster who have not answered. */
  none: number;
}
/** The members' answers (Voy / Duda / No va) for a match, counted per roster player. */
export function rsvpCounts(answers: readonly { response: "yes" | "no" | "maybe"; playerId: string | null }[], roster: readonly string[]): RsvpCounts {
  const byPlayer = new Map<string, "yes" | "no" | "maybe">();
  let loose = { yes: 0, maybe: 0, no: 0 };
  for (const a of answers) {
    if (a.playerId) byPlayer.set(a.playerId, a.response);
    else loose = { ...loose, [a.response]: loose[a.response] + 1 };
  }
  const c = { ...loose };
  byPlayer.forEach((r) => (c[r] += 1));
  return { ...c, none: roster.filter((id) => !byPlayer.has(id)).length };
}

// ───────────────────────── content ─────────────────────────
export interface ContentGap {
  key: "historias" | "escudo" | "contacto" | "foto";
  title: string;
  detail: string;
}
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
/**
 * What the club page is still missing (the content model has no drafts: everything saved is live, and
 * the editor only accepts HTTPS links, so the honest «por revisar» is what is left to fill in).
 */
export function contentGaps(content: { crestStory?: string; email?: string; instagram?: string; photoUrl?: string }, roster: readonly { name: string; bio?: string }[]): ContentGap[] {
  const gaps: ContentGap[] = [];
  const noStory = roster.filter((p) => !p.bio?.trim()).map((p) => p.name);
  if (noStory.length) {
    const shown = noStory.length > 4 ? [...noStory.slice(0, 3), `${noStory.length - 3} más`] : noStory;
    gaps.push({ key: "historias", title: `Historias de jugadores: ${roster.length - noStory.length} de ${roster.length}`, detail: `Faltan ${andList(shown)}` });
  }
  if (!content.crestStory?.trim()) gaps.push({ key: "escudo", title: "Historia del escudo", detail: "Sin escribir" });
  if (!content.email?.trim() && !content.instagram?.trim()) gaps.push({ key: "contacto", title: "Contacto", detail: "Sin correo ni Instagram" });
  if (!content.photoUrl?.trim()) gaps.push({ key: "foto", title: "Foto del equipo", detail: "Sin foto" });
  return gaps;
}

// ───────────────────────── MVP ─────────────────────────
/** The Jornada card's MVP line (no «MVP:» prefix). */
export function mvpNote(o: {
  /** The vote of the last published match is open until this time. */
  openUntil: number | null;
  /** The last played match's acta is still to publish. */
  actaPending: boolean;
  /** The last closed vote: its jornada, winners' names and their votes. */
  previous: { jornada: number | null; names: string[]; votes: number } | null;
}): string {
  if (o.openUntil) return `votación abierta · cierra el ${shortDate(o.openUntil)} a las ${clockTime(o.openUntil)}. Se abrió sola al publicar.`;
  const prev = o.previous && o.previous.names.length ? `${o.previous.jornada ? `J${o.previous.jornada}: ` : "Última: "}${o.previous.names.length > 1 ? `empate entre ${andList(o.previous.names)}` : `ganó ${o.previous.names[0]}`} con ${plural(o.previous.votes, "voto", "votos")}.` : "";
  if (o.actaPending) return `la votación se abre sola al publicar el acta y dura 48 h.${prev ? ` ${prev}` : ""}`;
  return prev || "la votación se abre sola al publicar cada acta y dura 48 h.";
}

// ───────────────────────── Inicio: Por hacer + counters ─────────────────────────
export interface TodoItem {
  key: "acta" | "convocatoria" | "fichas" | "contenido";
  done: boolean;
  title: string;
  detail: string;
  action: { label: string; tone: "gold" | "line"; target: AdminTarget };
}
export interface OverviewInput {
  last: { match: AdminMatch; review: ActaReview; publishedClean: boolean; mvpOpen: boolean } | null;
  next: { match: AdminMatch; conv: ConvocatoriaState; rsvp: RsvpCounts } | null;
  /** Pending ficha claims: who asks for which player. */
  claims: readonly { uid: string; nickname: string; playerName: string }[];
  contentGaps: readonly ContentGap[];
  /** Matches with an acta to do (drafts + played, unpublished). */
  actasPending: number;
  roster: number;
  seasons: number;
  admins: number;
  doorRequests: number;
}
export type CounterKey = SectionKey | "puerta";
export interface Overview {
  todo: TodoItem[];
  pending: number;
  counters: Record<CounterKey, Counter>;
}
export const jLabel = (m: { jornada: number | null; rival?: string }) => (m.jornada ? `J${m.jornada}` : m.rival || "Partido");

export function buildOverview(o: OverviewInput): Overview {
  const todo: TodoItem[] = [];
  // 1 · the acta
  if (o.last) {
    const { match, review, publishedClean, mvpOpen } = o.last;
    const j = jLabel(match);
    const score = `${review.goalsFor}–${review.goalsAgainst}`;
    todo.push(
      publishedClean
        ? { key: "acta", done: true, title: `Acta ${j} publicada`, detail: mvpOpen ? "MVP abierto 48 h" : `${match.rival ?? ""} · ${score}`, action: { label: "Ver el acta", tone: "line", target: { section: "partidos", matchId: match.id, tab: "acta" } } }
        : {
            key: "acta",
            done: false,
            title: review.cuadra ? `Acta ${j} · cuadra, falta publicar` : `Acta ${j} · ${review.reasons[0] ?? "sin terminar"}`,
            detail: `${match.rival ?? "Rival"} · ${score} · ${match.draft ? "borrador" : "sin empezar"}`,
            action: { label: "Abrir acta", tone: "gold", target: { section: "partidos", matchId: match.id, tab: "acta" } },
          },
    );
  } else {
    todo.push({ key: "acta", done: true, title: "Actas al día", detail: "Ningún partido jugado por cerrar", action: { label: "Ver partidos", tone: "line", target: { section: "partidos" } } });
  }
  // 2 · the convocatoria
  if (o.next) {
    const { match, conv, rsvp } = o.next;
    const j = jLabel(match);
    const when = shortDate(dateMillis(match.date));
    todo.push({
      key: "convocatoria",
      done: conv.published,
      title: conv.published ? `Convocatoria ${j} publicada` : `Convocatoria ${j} · ${conv.unassigned ? `${conv.unassigned} sin asignar` : conv.ready ? "falta publicar" : conv.text.toLowerCase()}`,
      detail: `${match.rival ?? "Rival"} · ${when} · ${plural(rsvp.yes, "viene", "vienen")}`,
      action: { label: conv.published ? "Ver" : "Preparar", tone: "line", target: { section: "convocatorias", matchId: match.id } },
    });
  } else {
    todo.push({ key: "convocatoria", done: true, title: "Sin partidos por jugar", detail: "Programa el siguiente", action: { label: "Nuevo partido", tone: "line", target: { section: "partidos", nuevo: true } } });
  }
  // 3 · fichas
  const nF = o.claims.length;
  const names = [...new Set(o.claims.map((c) => c.playerName))];
  todo.push(
    nF
      ? { key: "fichas", done: false, title: plural(nF, "ficha pendiente", "fichas pendientes"), detail: `${andList(names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} más`] : names)} ${nF === 1 ? "pide su ficha" : "piden su ficha"}`, action: { label: "Revisar", tone: "line", target: { section: "fichas" } } }
      : { key: "fichas", done: true, title: "Fichas al día", detail: "Nada que revisar", action: { label: "Ver", tone: "line", target: { section: "fichas" } } },
  );
  // 4 · contenido
  const nC = o.contentGaps.length;
  todo.push(
    nC
      ? { key: "contenido", done: false, title: `Contenido · ${plural(nC, "cosa por completar", "cosas por completar")}`, detail: o.contentGaps.map((g) => g.title.split(":")[0]).join(" · "), action: { label: "Completar", tone: "line", target: { section: "contenido", seccion: o.contentGaps[0].key } } }
      : { key: "contenido", done: true, title: "Contenido completo", detail: "La web está al día", action: { label: "Ver", tone: "line", target: { section: "contenido" } } },
  );
  const pending = todo.filter((t) => !t.done).length;
  const conv = o.next?.conv;
  const counters: Record<CounterKey, Counter> = {
    inicio: { n: pending, tone: "w", label: plural(pending, "cosa por hacer", "cosas por hacer") },
    partidos: { n: o.actasPending, tone: "w", label: plural(o.actasPending, "acta por hacer", "actas por hacer") },
    convocatorias: { n: conv && !conv.published ? conv.unassigned : 0, tone: "w", label: conv ? `${conv.unassigned} sin asignar` : "" },
    fichas: { n: nF, tone: "hot", label: plural(nF, "ficha pendiente", "fichas pendientes") },
    plantilla: { n: o.roster, tone: "", label: plural(o.roster, "jugador", "jugadores") },
    temporadas: { n: o.seasons, tone: "", label: plural(o.seasons, "temporada", "temporadas") },
    capitanes: { n: o.admins, tone: "", label: plural(o.admins, "administrador", "administradores") },
    contenido: { n: nC, tone: "w", label: plural(nC, "cosa por completar", "cosas por completar") },
    puerta: { n: o.doorRequests, tone: "hot", label: plural(o.doorRequests, "llamando", "llamando") },
  };
  return { todo, pending, counters };
}
