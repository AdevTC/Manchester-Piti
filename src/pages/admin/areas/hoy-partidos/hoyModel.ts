// HOY Y PARTIDOS · Hoy's model (the boards' SCM.toca / hechas / semana / lede, model.js, on the app's data): «Te toca»
// with one action per row (most urgent first), what is done (folded), the days from the last jornada to the next
// with their hitos, and the line under «Hoy». Pure: the hook in Hoy.tsx gathers its input.
import { dateMillis } from "../../../../../functions/src/matchEngine";
import type { ActaReview, AdminMatch, ContentGap } from "../../data/adminLogic";
import type { CarrilPhase } from "../../partido/carril";
import { clockTime, shortDate } from "../../data/adminLogic";
import { DayFull, dateNum, dayKey, dayName, dayShort, euros, list, monthShort, plural, rel, relDay } from "./fmt";
import { jWord } from "./matchWords";
import { rivalCode } from "../../../../lib/eventMeta";

const H = 3_600_000;
const D = 86_400_000;

export interface TocaItem {
  id: string;
  area: "partidos" | "plantilla" | "caja" | "club";
  title: string;
  detail: string;
  /** The button's word («Completar», «Recordar», «Revisar»…). */
  action: string;
  /** Its address in the sala. */
  path: string;
  urg: number;
  /** Other ways out of the same row («Aplazado», «No se jugó»). */
  alt?: { t: string; path: string }[];
}
export interface MatchRow {
  m: AdminMatch;
  phase: CarrilPhase;
  review: Pick<ActaReview, "goalsFor" | "goalsAgainst" | "missingScorers" | "cuadra">;
}
export interface TocaInput {
  now: number;
  matches: readonly MatchRow[];
  /** The next match to prepare, with the shirt names of who has not answered (when its convocatoria went). */
  next: { m: AdminMatch; unanswered: string[]; notified: boolean; scorer: boolean } | null;
  claims: readonly { uid: string; nick: string; shirt: string }[];
  door: readonly { uid: string; name: string; at: number }[];
  caja: readonly { shirt: string; amount: number }[];
  proposals: readonly { playerId: string; playerName: string }[];
  gaps: readonly ContentGap[];
  drafts: readonly { key: string; title: string }[];
  /** The sala's season has no matches yet (a new season): «Nuevo partido» first. */
  emptySeason: { name: string } | null;
}

const base = (m: AdminMatch) => `/admin/partidos/${m.id}`;

/** «Te toca», most urgent first. */
export function tocaList(o: TocaInput): TocaItem[] {
  const out: TocaItem[] = [];
  for (const { m, phase, review } of o.matches) {
    const t = dateMillis(m.date);
    if (phase === "pendiente")
      out.push({
        id: `pend-${m.id}`,
        area: "partidos",
        title: `${jWord(m)} · ${m.rival || "Rival"} no llegó a la mesa`,
        detail: `Era el ${shortDate(t)} a las ${clockTime(t)}. ¿Se jugó? Apunta el resultado, o márcalo aplazado o cancelado.`,
        action: "Apuntar el resultado",
        path: `${base(m)}/acta`,
        urg: 1,
        alt: [
          { t: "Aplazado", path: `${base(m)}/datos?estado=aplazado` },
          { t: "No se jugó", path: `${base(m)}/datos?estado=cancelado` },
        ],
      });
    if (phase === "final") {
      const n = review.missingScorers;
      out.push({
        id: `acta-${m.id}`,
        area: "partidos",
        title: `Acta ${jWord(m)} · ${n ? `falta ${plural(n, "goleador", "goleadores")}` : review.cuadra ? "lista para publicar" : "por completar"}`,
        detail: `${m.rival || "Rival"} · ${review.goalsFor}–${review.goalsAgainst}`,
        action: n || !review.cuadra ? "Completar" : "Publicar",
        path: `${base(m)}${n || !review.cuadra ? "/acta" : "/publicar"}`,
        urg: 1,
      });
    }
    // (B-HOY-07: a published acta with a correction in a draft is the web's; the correction is still to publish)
    if (phase === "publicado" && m.draft)
      out.push({ id: `fix-${m.id}`, area: "partidos", title: `Acta ${jWord(m)} · corrección sin publicar`, detail: `${m.rival || "Rival"} · la web cuenta la versión anterior`, action: "Revisar", path: `${base(m)}/acta`, urg: 2 });
  }
  const nx = o.next;
  if (nx) {
    const t = dateMillis(nx.m.date);
    if (Number.isFinite(t) && t - o.now < 4 * D) {
      if (nx.notified && nx.unanswered.length)
        out.push({
          id: `rsvp-${nx.m.id}`,
          area: "partidos",
          title: `${jWord(nx.m)} · ${nx.unanswered.length} sin responder`,
          detail: `${list(nx.unanswered.slice(0, 3))}${nx.unanswered.length > 3 ? ` y ${nx.unanswered.length - 3} más` : ""}`,
          action: "Recordar",
          path: `${base(nx.m)}/convocatoria`,
          urg: 2,
        });
      if (!nx.scorer && nx.m.published) out.push({ id: `scorer-${nx.m.id}`, area: "partidos", title: `${jWord(nx.m)} · nadie anota en la mesa`, detail: `Elige quién lleva la mesa el ${dayName(t)}`, action: "Elegir", path: `${base(nx.m)}/datos`, urg: 3 });
    }
  }
  for (const c of o.claims) out.push({ id: `claim-${c.uid}`, area: "plantilla", title: `@${c.nick || "alguien"} pide la camiseta de ${c.shirt}`, detail: "Una ficha que pide su cuenta", action: "Revisar", path: "/admin/plantilla/socios?ver=fichas", urg: 2 });
  for (const q of o.door) out.push({ id: `door-${q.uid}`, area: "plantilla", title: `Llaman a la puerta: ${q.name}`, detail: q.at ? `Pidió entrar ${rel(q.at, o.now)}` : "Pide entrar al vestuario", action: "Abrir", path: "/admin/plantilla/socios?ver=llaman", urg: 2 });
  if (o.caja.length)
    out.push({ id: "caja-claims", area: "caja", title: `${plural(o.caja.length, "pago avisado", "pagos avisados")} por confirmar`, detail: o.caja.map((c) => `${c.shirt} ${euros(c.amount)}`).join(" · "), action: "Confirmar", path: "/admin/caja", urg: 3 });
  if (o.proposals.length) {
    const names = o.proposals.map((p) => p.playerName);
    out.push({ id: "posiciones", area: "plantilla", title: "Posiciones propuestas · por revisar", detail: list(names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} más`] : names), action: "Revisar", path: `/admin/plantilla/${o.proposals[0].playerId}`, urg: 4 });
  }
  for (const d of o.drafts) out.push({ id: `draft-${d.key}`, area: "club", title: `${d.title} · sin publicar`, detail: "Un borrador de la web del club", action: "Publicar", path: `/admin/club/web/${d.key}`, urg: 5 });
  for (const g of o.gaps) out.push({ id: `gap-${g.key}`, area: "club", title: `${g.title.split(":")[0]} · por completar`, detail: g.detail, action: g.key === "foto" ? "Poner la foto" : "Escribir", path: `/admin/club/web/${g.key}`, urg: g.key === "historias" ? 6 : 7 });
  if (o.emptySeason) out.push({ id: "cal", area: "partidos", title: `La ${o.emptySeason.name} no tiene partidos`, detail: "Crea el primero: rival, fecha y hora; el resto, cuando lo sepas", action: "Nuevo partido", path: "/admin/partidos/nuevo", urg: 1 });
  return out.sort((a, b) => a.urg - b.urg);
}

/** What is done lately, newest first (the fold «N hechas»). */
export function hechas(o: { matches: readonly MatchRow[]; mvp: { j: string; total: number } | null; next: { m: AdminMatch; called: number } | null }): { title: string; detail: string }[] {
  const out: { title: string; detail: string }[] = [];
  const pub = o.matches.filter((r) => r.phase === "publicado").slice(-2).reverse();
  for (const r of pub) out.push({ title: `Acta ${jWord(r.m)} publicada`, detail: `${r.m.rival || "Rival"} ${r.review.goalsFor}–${r.review.goalsAgainst}` });
  if (o.mvp) out.push({ title: `MVP ${o.mvp.j} cerrado`, detail: `Votaron ${o.mvp.total}` });
  if (o.next && o.next.m.convocatoriaNotifiedAt) out.push({ title: `Convocatoria ${jWord(o.next.m)} mandada`, detail: `Avisados ${o.next.called}` });
  return out;
}

export type HitoKind = "partido" | "toca" | "hecho" | "ahora" | "auto" | "luego";
export interface Hito {
  t: number;
  kind: HitoKind;
  text: string;
  path: string;
}
export interface Day {
  key: number;
  t: number;
  today: boolean;
  past: boolean;
  dn: string;
  dd: number;
  mo: string;
  /** Show the month (the first day, or the 1st). */
  showMo: boolean;
  hitos: Hito[];
}

/** The days from the last jornada to the next (at most 17), each with its hitos. */
export function semana(o: {
  now: number;
  matches: readonly MatchRow[];
  last: AdminMatch | null;
  next: AdminMatch | null;
  trainings: readonly { at: number; place: string; confirmed: boolean }[];
  reminders: (m: AdminMatch) => boolean;
}): Day[] {
  const { now } = o;
  const lastT = o.last ? dateMillis(o.last.date) : NaN;
  const nextT = o.next ? dateMillis(o.next.date) : NaN;
  let from = Number.isFinite(lastT) ? lastT : now - 3 * D;
  const to = Number.isFinite(nextT) ? nextT : now + 6 * D;
  if (to - from > 16 * D) from = Math.max(from, now - 5 * D);
  if (from > now) from = now;
  const days: { t: number; k: number }[] = [];
  const seen = new Set<number>();
  const kTo = dayKey(Math.max(to, now));
  for (let t = from; days.length < 17; t += D) {
    const k = dayKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    days.push({ t, k });
    if (k >= kTo) break;
  }
  const hitos: Hito[] = [];
  for (const { m, phase } of o.matches) {
    const t = dateMillis(m.date);
    if (!Number.isFinite(t)) continue;
    const kind: HitoKind = phase === "pendiente" || phase === "final" ? "toca" : phase === "publicado" ? "hecho" : phase === "juego" || phase === "descanso" ? "ahora" : "partido";
    if (phase !== "cancelado") hitos.push({ t, kind, text: `${jWord(m)} · ${rivalCode(m.rival || "Rival", m.rivalShort)} · ${clockTime(t)}`, path: `${base(m)}` });
    if (phase === "publicado" && m.voteClosesAt) hitos.push({ t: m.voteClosesAt, kind: m.voteClosesAt > now ? "auto" : "hecho", text: `Cierra el MVP ${jWord(m)}`, path: `${base(m)}/despues` });
    if (phase === "antes" && m.published && m.convocatoriaNotifiedAt && o.reminders(m)) {
      hitos.push({ t: t - 48 * H, kind: "auto", text: "Recordatorio 48 h", path: `${base(m)}/convocatoria` });
      hitos.push({ t: t - 24 * H, kind: "auto", text: "Recordatorio 24 h", path: `${base(m)}/convocatoria` });
    }
  }
  for (const tr of o.trainings) hitos.push({ t: tr.at, kind: tr.confirmed ? "auto" : "luego", text: `Entreno${tr.place ? ` · ${tr.place}` : ""}`, path: "/admin/club/vestuario" });
  const kNow = dayKey(now);
  return days.map((d, i) => {
    const dd = dateNum(d.t);
    return {
      key: d.k,
      t: d.t,
      today: d.k === kNow,
      past: d.k < kNow,
      dn: dayShort(d.t),
      dd,
      mo: monthShort(d.t),
      showMo: i === 0 || dd === 1,
      hitos: hitos.filter((h) => dayKey(h.t) === d.k).sort((a, b) => a.t - b.t),
    };
  });
}

/** The line under «Hoy». */
export function hoyLede(now: number, hero: { m: AdminMatch; phase: CarrilPhase } | null): string {
  const day = DayFull(now);
  if (!hero) return `${day} · no hay partidos a la vista`;
  const { m, phase } = hero;
  if (phase === "juego" || phase === "descanso") return `${day} · el Piti está jugando: se apunta en la mesa`;
  if (phase === "final") return `${day} · pitado el final: falta el acta`;
  if (phase === "pendiente") return `${day} · la ${jWord(m)} no llegó a la mesa: ¿se jugó?`;
  if (phase === "publicado") return m.draft ? `${day} · acta publicada, con una corrección en borrador` : `${day} · acta publicada: la web ya lo cuenta`;
  const t = dateMillis(m.date);
  return `${day} · ${relDay(t, now)} juega el Piti ${m.home === false ? `en el campo de ${m.rival || "el rival"}` : "en casa"}`;
}
