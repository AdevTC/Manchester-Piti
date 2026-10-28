// The acta stations' words (pure, tested in actaModel.test.ts), as the boards say them (piti-diseno/src/admin/src/
// admin/acta.js): «¿Cuadra?» with its word and its fix, the minutes of each player (a bar per player, its stints),
// what another captain changed («Ver qué cambió»), the stale draft over a published acta (B-ACTA-01), «Así lo verá
// la afición», the consequences of publishing in words, the MVP with its real close (B-PUB-01), the frozen notas
// and the acta's history (matchAudit).
import { calculateLedger, dateMillis, type MatchSheet } from "../../../../../functions/src/matchEngine";
import type { StoredNotas } from "../../../../../functions/src/rating/frozen";
import { notaBand, notaText, type NotaBand } from "../../../../lib/rating/semaforo";
import { plural } from "../../../../lib/derived/words";
import { eventMinute } from "../../../../lib/partidos";
import type { ActaReview, CheckItem } from "../../data/adminLogic";
import { clockTime, shortDate } from "../../data/adminLogic";
import { goalRows, isOurGoal, isRivalGoal, reviewSheet, score, sig } from "../../acta/sheetModel";
import { liveLog } from "../../live/liveModel";

const H = 3_600_000;
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ───────────────────────── «¿Cuadra?» ─────────────────────────
export type CheckKind = "ok" | "mal" | "info";
export type FixKind = "scorer" | "convocatoria" | "datos" | "minute" | "mesa" | null;
export interface CheckRow {
  k: CheckKind;
  /** «Cuadra» · «Falta» · «Ojo»: the state in words, never by colour alone. */
  word: string;
  icon: string;
  title: string;
  detail: string;
  fix: FixKind;
  fixLabel: string;
}
const WORD: Record<CheckKind, [string, string]> = { ok: ["Cuadra", "✓"], mal: ["Falta", "!"], info: ["Ojo", "i"] };
/** Every check of the review with its word, its icon and the fix it offers («Elegir el goleador del gol 3»). */
export function checkRows(review: ActaReview, o: { mesa?: number } = {}): CheckRow[] {
  const fixOf = (i: CheckItem): [FixKind, string] => {
    if (i.tone !== "warn") return [null, ""];
    if (i.key === "goles" && review.firstMissingGoal) return ["scorer", `Elegir el goleador del gol ${review.firstMissingGoal}`];
    if (i.key === "convocatoria") return ["convocatoria", "Completar la convocatoria"];
    if (i.key === "encuentro") return ["datos", "Ir a los datos del partido"];
    if (i.key === "eventos" && /minuto/i.test(i.title)) return ["minute", "Apuntar el minuto"];
    return [null, ""];
  };
  const rows: CheckRow[] = review.items.map((i) => {
    const k: CheckKind = i.tone === "warn" ? "mal" : i.tone === "ok" ? "ok" : "info";
    const [fix, fixLabel] = fixOf(i);
    const detail = i.key === "goles" && i.tone === "warn" && review.missingScorers ? "Toca la fila marcada «¿Quién marcó?» y elígelo: sin él no se publica." : i.detail;
    return { k, word: WORD[k][0], icon: WORD[k][1], title: i.title, detail, fix, fixLabel };
  });
  if (o.mesa) rows.push({ k: "info", word: WORD.info[0], icon: WORD.info[1], title: `Hay ${plural(o.mesa, "jugada nueva", "jugadas nuevas")} de la mesa`, detail: "Incorpóralas arriba antes de publicar.", fix: "mesa", fixLabel: "" });
  return rows;
}
/** The foot's reason: the first thing missing, or what squares. */
export function footReason(review: ActaReview, published: boolean, dirty: boolean): string {
  if (!review.cuadra) return review.missingScorers ? `No cuadra: falta el goleador de ${plural(review.missingScorers, "gol", "goles")}` : `No cuadra: ${review.reasons[0] ?? "revisa el acta"}`;
  if (published) return dirty ? "«Guardar cambios» corrige la web al momento" : "Lo que cambies aquí se corrige en la web al guardar";
  const gf = review.goalsFor;
  return `Cuadra · ${gf === 0 ? "sin goles del Piti" : gf === 1 ? "1 gol, con goleador" : `${gf} goles, todos con goleador`}`;
}

// ───────────────────────── the minutes of each player ─────────────────────────
export interface MinutesBar {
  id: string;
  name: string;
  num: string;
  minutes: number;
  started: boolean;
  /** «Titular» · «Suplente» · «No jugó». */
  word: string;
  /** Each stint as a share of the match (left and width in %, and «12′–40′»). */
  spans: { left: number; width: number; t: string }[];
  /** «KEVIN: 38 minutos, del 0 al 25, del 30 al 43». */
  label: string;
}
/** One bar per player called up (titulares first, then who played most), from the ledger the backend computes. */
export function minutesBars(sheet: MatchSheet, info: (id: string) => { name: string; number: number | null }): { rows: MinutesBar[]; errors: string[]; duration: number } {
  const s = reviewSheet(sheet);
  const ledger = calculateLedger(s, false);
  const d = Math.max(1, s.duration || 50);
  const rows = [...s.starters, ...s.bench]
    .filter((id) => ledger.players[id])
    .map((id) => {
      const p = ledger.players[id];
      const who = info(id);
      const stints = p.stints.filter((x) => x.to > x.from);
      return {
        id,
        name: who.name,
        num: id.startsWith("guest:") ? "INV" : who.number != null ? String(who.number) : "—",
        minutes: p.minutes,
        started: p.started,
        word: p.started ? "Titular" : p.played ? "Suplente" : "No jugó",
        spans: stints.map((x) => ({ left: (100 * x.from) / d, width: (100 * (x.to - x.from)) / d, t: `${x.from}′–${x.to}′` })),
        label: `${who.name}: ${p.minutes ? `${plural(p.minutes, "minuto", "minutos")}, ${stints.map((x) => `del ${x.from} al ${x.to}`).join(", ")}` : "no jugó"}`,
      };
    })
    .sort((a, b) => Number(b.started) - Number(a.started) || b.minutes - a.minutes);
  return { rows, errors: ledger.errors.filter((e) => e !== "Selecciona exactamente 7 titulares."), duration: d };
}

// ───────────────────────── another captain's change ─────────────────────────
/** What `to` has that `from` didn't, in words («Puso a KEVIN en el siete», «Cambió la foto del partido»). */
export function whatChanged(from: MatchSheet, to: MatchSheet, nameOf: (id: string) => string): string[] {
  const out: string[] = [];
  const same = (a: unknown, b: unknown) => sig(a) === sig(b);
  if (from.rival.trim() !== to.rival.trim()) out.push(`Cambió el rival: ${to.rival.trim() || "sin rival"}`);
  if (!same(from.date, to.date)) out.push(Number.isFinite(to.date) ? `Cambió la fecha: ${shortDate(to.date)}, ${clockTime(to.date)}` : "Quitó la fecha");
  if (from.venue !== to.venue || from.home !== to.home) out.push("Cambió el campo");
  if (from.status !== to.status) out.push(to.status === "cancelled" ? "Lo marcó cancelado" : to.status === "postponed" ? "Lo marcó aplazado" : to.status === "finished" ? "Lo marcó finalizado" : "Lo devolvió a por jugar");
  if (from.duration !== to.duration) out.push(`Cambió la duración: ${to.duration} min`);
  const into = (list: "starters" | "bench", word: string) => {
    const added = to[list].filter((id) => !from[list].includes(id));
    if (added.length) out.push(`Puso a ${andList(added.map(nameOf))} en ${word}`);
  };
  into("starters", "el siete");
  into("bench", "el banquillo");
  const gone = [...from.starters, ...from.bench].filter((id) => !to.starters.includes(id) && !to.bench.includes(id));
  if (gone.length) out.push(`Quitó a ${andList(gone.map(nameOf))} de la convocatoria`);
  const was = new Map(from.events.map((e) => [e.id, e]));
  const now = new Map(to.events.map((e) => [e.id, e]));
  const added = to.events.filter((e) => !was.has(e.id)).length;
  const removed = from.events.filter((e) => !now.has(e.id)).length;
  const fixed = to.events.filter((e) => was.has(e.id) && !same(was.get(e.id), e)).length;
  if (added) out.push(`Apuntó ${plural(added, "jugada", "jugadas")}`);
  if (fixed) out.push(`Corrigió ${plural(fixed, "jugada", "jugadas")}`);
  if (removed) out.push(`Quitó ${plural(removed, "jugada", "jugadas")}`);
  if (from.report !== to.report) out.push("Cambió la crónica");
  if (from.photoUrl !== to.photoUrl) out.push("Cambió la foto del partido");
  if (!same(from.gallery, to.gallery)) out.push("Cambió la galería");
  if (from.videoUrl !== to.videoUrl) out.push("Cambió el vídeo");
  if (!same(from.guests ?? [], to.guests ?? [])) out.push("Cambió los invitados");
  if (!same(from.analysis, to.analysis)) out.push("Cambió el análisis narrado");
  if (!out.length && (from.revision ?? 0) !== (to.revision ?? 0)) out.push("Guardó el partido sin cambios en el acta");
  return out;
}

/**
 * B-ACTA-01: a draft over a published acta that the published one has overtaken (a convocatoria or «Mandar a la mesa»
 * moved the published revision while the draft kept its own). Saving or publishing it would be refused for ever;
 * `revision` is the one to save with («Recargar y conservar mis cambios»).
 */
export function staleDraft(m: { draft?: boolean; published?: boolean; revision?: number }, published: { revision?: number } | undefined): { revision: number } | null {
  if (!m.draft || !m.published || !published) return null;
  const pub = published.revision ?? 0;
  return pub !== (m.revision ?? 0) ? { revision: pub } : null;
}

// ───────────────────────── «Así lo verá la afición» ─────────────────────────
/** «ADRIÁN 9′», «Autogol de FUSION 7 46′»: each goal of ours with its scorer, in the order written. */
export function fanScorers(sheet: MatchSheet, nameOf: (id: string) => string): string[] {
  const rival = sheet.rival.trim() || "el rival";
  return goalRows(sheet)
    .filter((g) => g.kind === "og" || g.scorer)
    .map((g) => {
      const e = sheet.events.find((x) => x.id === g.id);
      const shown = e ? eventMinute(e) : (g.minute ?? null);
      const who = g.kind === "og" ? `Autogol de ${rival}` : nameOf(g.scorer!);
      return `${who}${shown != null ? ` ${shown}′` : ""}`;
    });
}
export type Letter = "G" | "E" | "P";
export const letterOf = (gf: number, ga: number): Letter => (gf > ga ? "G" : gf === ga ? "E" : "P");
export const letterWord = (l: Letter) => (l === "G" ? "ganado" : l === "P" ? "perdido" : "empate");

/** «el martes, 19:05» (Madrid). */
export function dayName(ms: number): string {
  const weekday = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" }).format(ms);
  return `el ${weekday}, ${clockTime(ms)}`;
}
/** «1 día y 8 h», «5 h», «40 min». */
export function leftWords(to: number, now: number): string {
  const ms = Math.max(0, to - now);
  const d = Math.floor(ms / (24 * H));
  const h = Math.floor((ms % (24 * H)) / H);
  const m = Math.ceil((ms % H) / 60_000);
  if (d) return h ? `${plural(d, "día", "días")} y ${h} h` : plural(d, "día", "días");
  if (h) return `${h} h`;
  return `${Math.max(1, m)} min`;
}

// ───────────────────────── publishing, in words ─────────────────────────
export interface PublishWords {
  /** «¿Publicar el acta de la J3?» */
  title: string;
  /** «Manchester Piti 3–2 Red Demons · domingo 18 de octubre». */
  lede: string;
  lines: string[];
}
/** The confirmation's consequences (A-PAR-10): what the web, the MVP, the phones, the notas and the porra get. */
export function publishWords(o: { j: string; sheet: MatchSheet; firstTime: boolean; voteClosesAt: number | null; now: number; played: number; devices: number | null }): PublishWords {
  const { gf, ga } = score(o.sheet);
  const rival = o.sheet.rival.trim() || "el rival";
  const t = o.sheet.date;
  const day = Number.isFinite(t) ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(t) : "sin fecha";
  const closes = o.voteClosesAt ?? o.now + 48 * H;
  const phones = o.devices ? `Avisamos a ${plural(o.devices, "móvil", "móviles")}` : "Avisamos a los móviles del club";
  const lines = o.firstTime
    ? [
        "Sale en el calendario y en las estadísticas de la temporada: perfiles, goleadores y minutos al día.",
        `Se abre el MVP 48 h: votan los socios hasta ${dayName(closes)}. El marcador se queda en FINAL.`,
        `${phones}: «Final: Manchester Piti ${gf}–${ga} ${rival}» y «Vota al MVP».`,
        `Se congelan las notas de ${o.played === 1 ? "el que jugó" : `los ${o.played} que jugaron`} y sale «Ya están las notas».`,
        "Se recalcula la porra de la temporada.",
        "Se puede corregir después: cada cambio queda en el historial del acta.",
      ]
    : [
        "Se corrige lo publicado: calendario, perfiles y estadísticas al día.",
        closes > o.now ? `El MVP sigue abierto hasta ${dayName(closes)}; los votos de quien deje de haber jugado se descartan.` : "El MVP ya se cerró: no se vuelve a abrir.",
        "Las notas se vuelven a calcular con el acta corregida.",
        "Se recalcula la porra de la temporada. No sale ningún aviso nuevo del final.",
        "Queda en el historial del acta.",
      ];
  return { title: o.firstTime ? `¿Publicar el acta de la ${o.j}?` : `¿Corregir el acta de la ${o.j}?`, lede: `Manchester Piti ${gf}–${ga} ${rival} · ${day}`, lines };
}

// ───────────────────────── the MVP (B-PUB-01: the real close, never «48 h») ─────────────────────────
export interface MvpView {
  /** «Votación abierta» · «Votación cerrada» · «Sin votación». */
  tag: string;
  open: boolean;
  has: boolean;
  /** «6 de 14 han votado». */
  part: string;
  pct: number;
  /** «Cierra el martes, 19:05 · faltan 1 día y 8 h» · «Cerró el 20 oct a las 19:05». */
  close: string;
  /** «Vota al MVP hasta el martes, 19:05» (the fan's line). */
  fan: string;
  winner: string;
  canReopen: boolean;
}
export function mvpView(o: { voteClosesAt: unknown; publishedAt: number | null; total: number; eligible: number | null; winners: string[]; now: number }): MvpView {
  const closes = dateMillis(o.voteClosesAt);
  if (!Number.isFinite(closes))
    return { tag: "Sin votación", open: false, has: false, part: "", pct: 0, close: "", fan: "Vota al MVP 48 h, al publicar", winner: "", canReopen: false };
  const open = closes > o.now;
  const eligible = o.eligible ?? 0;
  const part = eligible ? `${o.total} de ${eligible} han votado` : `${plural(o.total, "voto", "votos")}`;
  const pct = eligible ? Math.min(100, Math.round((100 * o.total) / eligible)) : 0;
  const close = open ? `Cierra ${dayName(closes)} · faltan ${leftWords(closes, o.now)}` : `Cerró el ${shortDate(closes)} a las ${clockTime(closes)}`;
  const winner = open ? "" : o.winners.length > 1 ? `MVP compartido: ${andList(o.winners)}` : o.winners.length ? `Ganó ${o.winners[0]}` : o.total ? "Sin ganador" : "Nadie votó";
  // (reopen: within the 7 days of the acta's publication, as the server allows)
  const from = o.publishedAt ?? closes - 48 * H;
  return { tag: open ? "Votación abierta" : "Votación cerrada", open, has: true, part, pct, close, fan: open ? `Vota al MVP hasta ${dayName(closes)}` : "MVP cerrado", winner, canReopen: o.now - from < 7 * 24 * H };
}

// ───────────────────────── the frozen notas ─────────────────────────
export interface NotaRow {
  id: string;
  name: string;
  nota: number;
  text: string;
  band: NotaBand;
  word: string;
  label: string;
}
export function notaRows(notas: StoredNotas | null | undefined, nameOf: (id: string) => string): NotaRow[] {
  if (!notas) return [];
  return Object.entries(notas.players)
    .map(([id, n]) => {
      const b = notaBand(n.nota);
      const name = nameOf(id);
      return { id, name, nota: n.nota, text: notaText(n.nota), band: b.k, word: b.word, label: `${name}: ${notaText(n.nota)}, ${b.word.toLowerCase()}` };
    })
    .sort((a, b) => b.nota - a.nota);
}

// ───────────────────────── the acta's history (matchAudit) ─────────────────────────
export interface AuditDoc {
  id: string;
  at: number;
  by: string;
  revision?: number;
  fields: Record<string, unknown>;
}
/** «Publicó el acta · revisión 4», «Descartó el borrador», «Mandó la convocatoria»… */
export function auditWhat(a: AuditDoc): { what: string; detail: string } {
  const f = a.fields;
  const rev = typeof a.revision === "number" ? ` · revisión ${a.revision}` : "";
  if (f.draft === "discarded") return { what: "Descartó el borrador", detail: "Vuelve a lo publicado." };
  if (f.notas === "recalc") return { what: "Recalculó las notas", detail: "Notas congeladas de nuevo." };
  if (typeof f.mvp === "string") return { what: f.mvp === "close" ? "Cerró la votación del MVP" : "Reabrió la votación del MVP 24 h", detail: Number.isFinite(dateMillis(f.voteClosesAt)) ? `Cierra el ${shortDate(dateMillis(f.voteClosesAt))} a las ${clockTime(dateMillis(f.voteClosesAt))}.` : "" };
  if (f.report === "mesa") return { what: `Escribió la crónica corta desde la mesa${rev}`, detail: "" };
  if (typeof f.videoMarks === "number") return { what: `Puso las marcas del vídeo${rev}`, detail: `${plural(f.videoMarks, "gol", "goles")} con su marca.` };
  if (typeof f.duration === "number") return { what: `Cambió la duración a ${f.duration} min${rev}`, detail: "" };
  if (typeof f.guest === "string") return { what: "Añadió un invitado desde la mesa", detail: "" };
  if (typeof f.convocatoria === "string") return { what: f.convocatoria === "notify" ? `Mandó la convocatoria${rev}` : `Guardó la convocatoria${rev}`, detail: "" };
  if (f.lineup && typeof f.lineup === "object") return { what: `Mandó el siete a la mesa${rev}`, detail: "Desde la pizarra." };
  if (typeof f.clockAction === "string") return { what: clockWord(f.clockAction), detail: "El reloj de la mesa." };
  if (typeof f.live === "string") {
    const w: Record<string, string> = { add: "Apuntó una jugada en la mesa", addMany: "Apuntó varios cambios en la mesa", edit: "Corrigió una jugada en la mesa", delete: "Quitó una jugada en la mesa", undo: "Deshizo una jugada en la mesa", finish: "Cerró la mesa", reopen: "Reabrió la mesa" };
    return { what: `${w[f.live] ?? "Apuntó en la mesa"}${rev}`, detail: "" };
  }
  if (Array.isArray(f.scorerUids)) return { what: "Cambió quién anota en la mesa", detail: plural(f.scorerUids.length, "anotador", "anotadores") };
  if (typeof f.porra === "string") return { what: f.porra === "removed" ? "Quitó una porra" : "Corrigió una porra", detail: "" };
  return { what: `Guardó el acta${rev}`, detail: typeof a.revision === "number" && a.revision <= 1 ? "La primera vez que se publicó." : "Publicada o corregida desde la sala." };
}
function clockWord(a: string): string {
  return a === "start" ? "Pitó el inicio" : a === "halftime" ? "Pitó el descanso" : a === "second" ? "Empezó la 2ª parte" : a === "finish" ? "Pitó el final" : a === "reopen" ? "Reabrió el partido" : a === "resume_first" ? "Volvió a la 1ª parte" : "Movió el reloj";
}

// ───────────────────────── small words ─────────────────────────
/** The plays of a group as the acta lists them (the live log's words), by minute. */
export function playLines(events: MatchSheet["events"], rival: string, nameOf: (id: string) => string) {
  return liveLog(events, rival, nameOf).reverse();
}
/** «3 goles», counting ours and theirs. */
export function goalsWord(sheet: Pick<MatchSheet, "events">): string {
  const n = sheet.events.filter((e) => isOurGoal(e) || isRivalGoal(e)).length;
  return plural(n, "gol", "goles");
}
export { lower };
