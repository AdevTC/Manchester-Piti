// «El partido» · the Vestuario screen (P- boards, place-vestuario): the team's own place. A fan sees the door
// (and the public MVP and nota); a member sees what he has to do now, by moment, the most urgent first and in
// glass (the one thing to touch), the rest quieter and, on a phone, folded into «N más · Ver todo». Every control
// writes the team's real data through vestuarioState's `act` (¿Vas?, the porra, the MVP vote, the nota, la caja,
// «Avisar de que no puedo», the turno). The words and the order are the board's; vestuarioModel holds the logic.
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { apiError } from "../../../lib/clubApi";
import { madridTime } from "../../../lib/derived/madrid";
import { POSITIONS, type PosCode } from "../../../lib/positions";
import { rsvpSummary } from "../../../lib/rsvp";
import { formatNota, ratingSummary, votesText } from "../../../lib/derived/trasElPartido";
import { voteLeft } from "../../../lib/vestuario";
import { jobTask } from "../../../lib/derived/rota";
import type { RotaIconId } from "../../../lib/derived/rota";
import type { IconName } from "./bits";
import { Go, Icon, Tee } from "./bits";
import type { PageCtx } from "./ctx";
import { scoreAt } from "./model";
import { whenWords } from "./words";
import { andList, blockOrder, cap, comma, dash, euros, foldOf, porraDistribution, bestLine, subOf, teamRank, TEAM_BLOCKS, verdict, verdictWord, type Block } from "./vestuarioModel";
import type { Answer, VestuarioState } from "./vestuarioState";
import "./vestuario.css";

const STAR = "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z";
const SAID: Record<Answer, string> = { yes: "Vas", maybe: "Dudas", no: "No vas" };
const OPTS: [Answer, string][] = [
  ["yes", "Voy"],
  ["maybe", "Duda"],
  ["no", "No voy"],
];
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });
const DAYNUM = new Intl.DateTimeFormat("es-ES", { day: "numeric", timeZone: "Europe/Madrid" });
const ROTA_ICON: Record<RotaIconId, IconName> = { shirt: "shirt", ball: "ball", car: "away", bottle: "bolt", bag: "shirt", key: "lock" };

/** «el martes a las 21:00». */
const atWords = (ms: number): string => `el ${WEEKDAY.format(ms)} a las ${madridTime(ms)}`;
/** «Hoy, 19:00» (the kick-off, short). */
const kickShort = (ms: number, now: number): string => whenWords(ms, now).replace(" a las ", ", ");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const r0 = (x: number) => Math.round(x);

/** Radio keys: the arrows (and Home / End) move the focus between the choices; Space or Enter chooses. */
function radioKeys(e: KeyboardEvent<HTMLButtonElement>) {
  const k = e.key;
  const step = k === "ArrowRight" || k === "ArrowDown" ? 1 : k === "ArrowLeft" || k === "ArrowUp" ? -1 : 0;
  if (!step && k !== "Home" && k !== "End") return;
  const g = e.currentTarget.parentElement;
  const bs = g ? Array.from(g.querySelectorAll<HTMLButtonElement>('[role="radio"]')) : [];
  if (!bs.length) return;
  e.preventDefault();
  const i = bs.indexOf(e.currentTarget);
  const to = k === "Home" ? 0 : k === "End" ? bs.length - 1 : (i + step + bs.length) % bs.length;
  bs.forEach((b, j) => (b.tabIndex = j === to ? 0 : -1));
  bs[to].focus();
}

function Star({ fill }: { fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={STAR} fill={fill ? "currentColor" : undefined} />
    </svg>
  );
}

export function ScreenVestuario({ c, v }: { c: PageCtx; v: VestuarioState }) {
  const { d, ui, set, editing, draft, act } = v;
  const f = c.fase;
  const { member, isJ, isMesa } = d.who;
  const { pre, live, done, off } = c;
  const fin = f === "final";
  const m = c.minute;
  const pid = c.viewer.playerId;
  const ok = (p: Promise<unknown>, line: string) =>
    void p.then(
      () => line && c.say(line),
      (e: unknown) => c.say(apiError(e)),
    );
  const name = (id: string) => c.nameOf(id);
  const meetMs = c.kickMs - 30 * 60_000;
  const meet = Number.isFinite(meetMs) ? madridTime(meetMs) : "—";
  const kickT = Number.isFinite(c.kickMs) ? madridTime(c.kickMs) : "—";
  const jPre = c.jornada ? `J${c.jornada}` : "";
  const R = c.result;
  const finalSc = scoreAt(c.plays, c.edge);
  const sc = fin ? finalSc : c.score;

  // ================= ¿Vas?
  const ans = isJ ? d.myAnswer : null;
  const rsvpOpen = d.rsvpOpen;
  const called = [...(c.match.starters ?? []), ...(c.match.bench ?? [])];
  const counts = rsvpSummary(d.answers, called);
  const squad = counts.yes + counts.maybe + counts.no + counts.sin;
  const faltan = !called.length ? "la convocatoria aún no está hecha" : counts.sin ? (counts.sin === 1 ? "falta 1 por contestar" : `faltan ${counts.sin} por contestar`) : "ya ha contestado todo el mundo";
  const rsvpEditing = editing.rsvp;
  const rsvpI = Math.max(0, OPTS.findIndex((o) => o[0] === ans));
  const slot = pid ? c.lineup.slots.find((s) => s.id === pid) : undefined;
  const slotPos = slot && slot.code in POSITIONS ? POSITIONS[slot.code as PosCode].name.toLocaleLowerCase("es") : "";
  let rsvpLine: string;
  if (!isJ) rsvpLine = `${c.lineup.published ? "El siete ya está publicado" : "La convocatoria está en marcha"}; ${faltan}.`;
  else if (!rsvpOpen) rsvpLine = `La convocatoria se cerró a la hora del partido.${ans ? ` Dijiste «${OPTS.find((o) => o[0] === ans)?.[1]}».` : " No llegaste a responder."}`;
  else if (!ans) {
    const when = Number.isFinite(c.kickMs) ? whenWords(c.kickMs, c.now) : "";
    rsvpLine = `${jPre ? `${jPre} contra` : "Contra"} ${c.rival}${when ? `, ${when.charAt(0).toLocaleLowerCase("es")}${when.slice(1)}` : ""}. Aún no has dicho si vas; ${faltan}.`;
  } else rsvpLine = `${SAID[ans]}${ans === "yes" && slotPos ? `, y juegas de ${slotPos}${c.captain === pid ? " con el brazalete" : ""}` : ""}. ${cap(faltan)}.`;
  const rsvpH = !isJ ? "La convocatoria" : ans && !rsvpEditing ? SAID[ans] : "¿Vas?";
  const rsvpNote = rsvpOpen ? (isJ ? (Number.isFinite(c.kickMs) ? kickShort(c.kickMs, c.now) : "Sin fecha") : "Se mueve sola") : "Cerrada";
  const bar: [string, number][] = [
    ["is-yes", counts.yes],
    ["is-maybe", counts.maybe],
    ["is-no", counts.no],
    ["is-pend", counts.sin],
  ];
  const countWords: [number, string][] = [
    [counts.yes, "vienen"],
    [counts.maybe, "en duda"],
    [counts.no, counts.no === 1 ? "no puede" : "no pueden"],
    [counts.sin, "sin responder"],
  ];

  // ================= the porra
  const savedP = d.porra;
  const porraEditing = editing.porra;
  const porraNote = off === "aplazado" ? "En pausa" : off === "pendiente" ? "Espera al acta" : f === "pitido" ? "Se cierra con el pitido" : pre ? "Hasta el pitido inicial" : "Cerrada";
  const { gf, ga, scorer, assist, changed, valid, busy } = draft;
  const porraSaved = !!savedP && !porraEditing && (pre || !!off);
  const scorerLine = savedP ? (savedP.scorers.length > 1 ? `Goleadores: ${andList(savedP.scorers.map(name))}` : savedP.scorer ? `Goleador: ${name(savedP.scorer)}` : savedP.gf ? "Sin goleador" : "Sin goles del Piti") : "";
  const porraMsg = off === "aplazado" ? "La porra no cuenta mientras esté aplazado. Se guarda para la nueva fecha." : off === "pendiente" ? "La porra espera al acta: se puntúa cuando diga el resultado." : "";
  const stepTo = (key: "gf" | "ga", val: number, delta: number) => () => {
    const n = Math.max(0, Math.min(30, val + delta));
    set(key === "gf" && n === 0 ? { gf: 0, scorer: "", assist: "" } : { [key]: n });
  };
  const savePorra = () => {
    if (!changed || !valid || busy) return;
    ok(act.savePorra(), "Porra guardada.");
  };

  // ================= the porra while it is played (and before the acta)
  const v0 = verdict(savedP, sc);
  const VW = (x: NonNullable<typeof v0>) => verdictWord(x, fin);
  const liveH = fin ? "Tu porra, a falta del acta" : "Tu porra, en vivo";
  const nowK = fin ? "Ha acabado" : f === "descanso" && !c.dragged ? "Al descanso" : c.dragged ? `En el ${m}′` : `Ahora, ${m}′`;
  const liveLine = !savedP
    ? "No pusiste porra para este partido."
    : !v0
      ? ""
      : fin
        ? `Pronosticaste ${dash(savedP)} y acabó ${finalSc.us}–${finalSc.them}: ${{ exacta: "la clavaste", cerca: "a un gol", lejos: "esta vez no" }[v0]}. El acta confirma los puntos.`
        : `Pronosticaste ${dash(savedP)}: ${c.dragged ? `en el minuto ${m}, ` : "ahora mismo "}${{ exacta: "la clavas", cerca: "a un gol", lejos: "no la clavas" }[v0]}.`;
  const rank = teamRank(d.picks, sc, { done, ended: fin, uid: d.uid });
  const nP = d.picks.length;
  const teamNote = done ? `${plural(nP, "porra", "porras")}. Puntos con el acta publicada; la clasificación del mes, en tu recorrido de la porra.` : `${plural(nP, "porra", "porras")}. Según las jugadas anotadas hasta ${fin ? "el final" : `el ${m}′`}; los puntos llegan con el acta.`;

  // ================= the MVP
  const ledger = c.match.ledger ?? {};
  const playedIds = [...c.tl.stintsAt(c.duration).map((s) => s.id), ...Object.keys(ledger)].filter((id, i, a) => a.indexOf(id) === i && !!ledger[id]?.played && !id.startsWith("guest:"));
  const mvp = d.mvp;
  const voteOpen = d.voteOpen;
  const myVote = d.myVote;
  const ballot = editing.ballot;
  const mvpPick = ui.mvpPick ?? myVote ?? "";
  const countsMvp = mvp?.counts ?? {};
  const hidden = voteOpen || !Object.keys(countsMvp).length;
  const total = mvp?.total ?? 0;
  const eligible = mvp?.eligible;
  const ofE = eligible ? ` de ${eligible}` : "";
  const race = Object.entries(countsMvp)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || name(a[0]).localeCompare(name(b[0]), "es"));
  const top = race[0]?.[1] ?? 0;
  const winners = d.winners;
  const winner = winners[0] ?? null;
  const winName = andList(winners.map(name));
  const closesAt = typeof c.match.voteClosesAt === "number" ? c.match.voteClosesAt : null;
  const closesIn = closesAt ? voteLeft(closesAt, c.now) : "";
  const closesWords = closesAt ? atWords(closesAt) : "el cierre";
  const mvpResult = done && !voteOpen && !!winner;
  const mvpBars = done && !ballot && !hidden;
  const mvpHidden = hidden && done && !ballot;
  const mvpRace = voteOpen && !ballot;
  const mvpNote = voteOpen ? (closesIn ? `Cierra en ${closesIn}` : "Abierta") : "Votación cerrada";
  const hiddenLine = voteOpen
    ? `${total}${ofE} ya han votado. El recuento no se enseña hasta que cierre, ${closesWords}.`
    : total
      ? `La votación cerró con ${total}${ofE} votos: el MVP sale cuando se publique el recuento.`
      : "Nadie votó al MVP en este partido.";
  const mvpSub = hidden ? `${total}${ofE} ya han votado · se vota a quien jugó` : `${plural(total, "voto", "votos")} del equipo · se vota a quien jugó`;
  const mvpBtn = mvpPick && mvpPick === myVote ? "Voto guardado" : myVote ? "Cambiar mi voto" : "Votar al MVP";
  const mvpBtnOff = !mvpPick || mvpPick === myVote;
  const mineLine = (myVote ? `Votaste a ${name(myVote)}. ${voteOpen ? `Puedes cambiarlo hasta ${closesWords}.` : ""}` : voteOpen ? "Tú aún no has votado." : "No votaste en este partido.").trim();
  const winLine = winner ? `${countsMvp[winner] ?? 0} de ${plural(total, "voto", "votos")} · lo eligió el vestuario` : "";
  const leadLine = hidden ? `${total}${ofE} ya han votado.` : race.length ? `Va primero ${name(race[0][0])} con ${top} votos de ${total}.` : "";
  const mvpK = c.jornada ? `MVP de la J${c.jornada}` : "MVP del partido";
  const vote = () => {
    if (mvpBtnOff) return;
    const who = mvpPick;
    ok(act.vote(), `Voto guardado: ${name(who)}.`);
  };

  // ================= the nota
  const nota = d.myNota;
  const notaEditing = editing.nota;
  const sum = ratingSummary(d.ratings);
  const notaOpen = d.nota.state === "open";
  const notaNote = d.nota.state === "open" ? `Hasta el ${WEEKDAY.format(d.nota.closesAt)} ${DAYNUM.format(d.nota.closesAt)}` : "Cerrada";
  const notaH = notaEditing ? "¿Qué nota le pones al partido?" : nota ? `Tu nota: ${nota} de 5` : "La nota del partido";
  const notaLine = (sum.average === null ? (notaOpen ? "Aún nadie ha puesto nota." : "Nadie le puso nota.") : `Nota del vestuario: ${comma(sum.average)} · ${votesText(sum.count)}.`) + (nota ? ` Tú le pusiste un ${nota}.` : "");
  const pubNota = sum.average === null ? "Aún nadie le ha puesto nota al partido" : `Nota del vestuario: ${formatNota(sum.average)} · ${votesText(sum.count)}`;

  // ================= «Tu partido» and the cromo of the jornada
  const myRow = pid ? c.tl.stintsAt(c.duration).find((s) => s.id === pid) : undefined;
  const L = pid ? ledger[pid] : undefined;
  const iPlayed = !!pid && !!L?.played && !!myRow;
  const linkFicha = member && !isJ && !isMesa;
  const myGoals = c.plays.filter((p) => p.k === "gol" && !!pid && p.who === pid);
  const myAsis = c.plays.filter((p) => p.k === "gol" && !!pid && p.assist === pid);
  const myPen = c.plays.find((p) => p.k === "penalti" && !!pid && p.who === pid);
  const min = myRow ? r0(myRow.min) : 0;
  const segs = myRow?.all ?? [];
  const mainPos = (() => {
    const pp = L?.positionsPlayed;
    const best = pp ? (Object.entries(pp) as [PosCode, number][]).sort((a, b) => b[1] - a[1])[0] : undefined;
    const code = best?.[0] ?? (slot?.code as PosCode | undefined);
    return code && code in POSITIONS ? POSITIONS[code].name.toLocaleLowerCase("es") : "";
  })();
  const scAt = (mm: number) => {
    const s = scoreAt(c.plays, mm);
    return `${s.us}–${s.them}`;
  };
  const keyPasses = L?.keyPasses ?? 0;
  const cromoLine = myGoals.length ? `El gol del ${scAt(myGoals[0].m)}` : myAsis.length ? `El pase del ${scAt(myAsis[0].m)}` : keyPasses ? `${L?.passesCompleted ?? 0} pases buenos` : `${min}′ en el campo`;
  const cromoFoot = `${min}′${myGoals.length ? ` · ${plural(myGoals.length, "gol", "goles")}` : myAsis.length ? ` · ${myAsis.length} asis.` : keyPasses ? ` · ${plural(keyPasses, "pase clave", "pases clave")}` : ""}`;
  const pts = d.porraPoints;
  const nums: [string | number, string][] = [
    [`${min}′`, "minutos"],
    [myGoals.length, myGoals.length === 1 ? "gol" : "goles"],
    [myAsis.length, myAsis.length === 1 ? "asistencia" : "asistencias"],
    [pts ?? "–", "puntos de porra"],
  ];
  const passes = L?.passes ?? 0;
  const partidoLine = iPlayed
    ? `Los ${min} minutos${mainPos ? ` de ${mainPos}` : ""}${segs.length > 1 ? `, en ${segs.length} tramos (${segs.map((g) => `${r0(g.from)}–${r0(g.to)}`).join(", ")})` : ""}${c.captain === pid ? ", con el brazalete" : ""}.${myGoals.length || myAsis.length ? ` ${cromoLine} fue tuyo.` : ""}${myPen ? ` Te pitaron un penalti en el ${myPen.m}.` : ""}${passes ? ` ${L?.passesCompleted ?? 0} de ${passes} pases buenos, ${(L?.recoveries ?? 0) + (L?.interceptions ?? 0)} recuperaciones.` : ""}`
    : "";
  const partidoRes = `${jPre ? `${jPre} · ` : ""}${R.verb} ${R.dash}`;
  const firstMark = myGoals[0] ?? myAsis[0];
  const cromoHint = firstMark ? `Sale de tu partido: ${cromoLine.toLocaleLowerCase("es")}, en el ${firstMark.m}′. Ya está con los de tu temporada.` : `Sale de tu partido: ${min} minutos${keyPasses ? ` y ${keyPasses === 1 ? "un pase de remate" : `${keyPasses} pases de remate`}` : ""}. Ya está con los de tu temporada.`;
  const me = pid ? c.people.get(pid) : undefined;
  const cromoName = me?.short ?? "";
  const cromoAlt = `Tu cromo de la jornada: ${cromoName}${me?.num ? `, dorsal ${me.num}` : ""}, ${jPre ? `${jPre} ` : ""}contra ${c.rival}. ${cromoLine}, ${cromoFoot}.`;
  const mesaLine = `Llevaste la mesa: ${plural(c.plays.length, "jugada anotada", "jugadas anotadas")} y el acta publicada. Sin mesa no hay directo.`;

  // ================= the porra of the jornada (after the acta)
  const dist = porraDistribution(d.picks, { us: R.us, them: R.them }, savedP);
  const resH = !nP ? "Nadie hizo porra" : dist.exact ? `${dist.exact} de ${nP} clavaron el ${R.dash}` : `Nadie clavó el ${R.dash}`;
  const best = bestLine(d.picks);
  const resMine = savedP ? `Tú dijiste ${dash(savedP)}: ${plural(pts ?? 0, "punto", "puntos")}.${best ? ` ${best}` : ""}` : `No hiciste porra en este partido.${best ? ` ${best}` : ""}`;

  // ================= la caja
  const caja = d.caja;
  const claimed = !!caja?.claim;
  const cajaTask = isJ && !!caja && caja.owes && !claimed;
  const cajaLine = caja
    ? `${claimed ? "Has avisado de que la pagaste: lo confirma un capitán. " : !caja.owes ? "Estás al día con la caja. " : done || fin ? `Debes ${euros(caja.fee)} del campo y el árbitro. ` : `${euros(caja.fee)} · campo y árbitro. `}${caja.paid} de ${caja.of} ya la han pagado.`
    : "";

  // ================= turnos
  const myTurn = pid ? d.turns.find((t) => t.playerId === pid) : undefined;
  const turnosH = done && isJ && myTurn && !d.turnDone ? `Te toca ${jobTask(myTurn.job)}` : "Turnos";
  const turnRows = d.turns.map((t) => {
    const mine = !!pid && t.playerId === pid;
    const icon: IconName = /lav/i.test(t.job.name) ? "wash" : /mesa/i.test(t.job.name) ? "mesa" : ROTA_ICON[t.job.icon];
    return { key: t.job.id, job: t.job.name, icon, who: mine ? "Te toca" : t.playerId ? name(t.playerId) : "Nadie disponible", cls: mine ? `is-me${d.turnDone && done ? " is-done" : ""}` : "" };
  });
  const canDone = done && isJ && !!myTurn;

  // ================= ausentes
  const day = d.day;
  const absRows = [...d.absences]
    .sort((a, b) => Number(b.uid === d.uid) - Number(a.uid === d.uid))
    .map((a) => {
      const mine = a.uid === d.uid;
      const single = a.from === a.to;
      const sameMonth = a.to.slice(0, 7) === day.slice(0, 7);
      const why = single && Number.isFinite(c.kickMs) ? `No puede${mine ? "s" : ""} el ${WEEKDAY.format(c.kickMs)} ${DAYNUM.format(c.kickMs)}` : `Ausente hasta el ${Number(a.to.slice(8, 10))}${sameMonth ? "" : ` ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][Number(a.to.slice(5, 7)) - 1]}`}`;
      return { id: a.id, name: mine ? "Tú" : a.playerId ? name(a.playerId) : a.name, why };
    });
  const myAbs = d.myAbsence;
  const canWarn = (isJ || isMesa) && f === "antes" && !myAbs && !!day;
  const warned = !!myAbs;
  const canUnwarn = !!myAbs && myAbs.from === day && myAbs.to === day;
  const warnedLine = canUnwarn ? (isMesa ? "Has avisado de que no puedes: la mesa busca a otro." : "Has avisado de que no puedes: cuenta como «No voy».") : "Tienes una ausencia en esas fechas: cuenta como «No voy».";

  // ================= la mesa (the anotador), the calm lines
  const mesaH = fin ? "Falta publicar el acta" : off === "pendiente" ? "El acta, desde la mesa" : "Hoy anotas tú";
  const mesaNote = live ? "En directo" : fin ? "Final" : "La mesa";
  const mesaLineNow =
    f === "antes"
      ? `Llevas la mesa: el reloj, las jugadas y el acta. Ven a la quedada de las ${meet} con el móvil cargado.`
      : f === "pitido"
        ? "Arranca el reloj con el pitido: el directo de todos sale de la mesa."
        : f === "descanso"
          ? `Descanso, ${R.half}. Arranca la segunda parte desde la mesa cuando ruede el balón.`
          : live
            ? `Vas por el minuto ${c.edge}. Cada jugada que anotas sale al momento aquí y en el marcador.`
            : fin
              ? `Acabó ${R.dash}. Repasa las jugadas y publica el acta: con ella llegan los puntos, el MVP y la nota.`
              : "Nadie arrancó el reloj. Escribe el resultado y las jugadas desde la mesa y publica el acta.";
  const mesaBtn = live ? "Volver a la mesa" : "Abrir la mesa";
  const paused = { line1: "La convocatoria se abre cuando el partido tenga fecha.", line2: savedP ? `Tu porra, ${dash(savedP)}, se guarda; no cuenta mientras esté aplazado.` : "La porra no cuenta mientras esté aplazado.", line3: isJ || isMesa ? "Sin turnos ni caja hasta que se juegue." : "" };
  const pend = { line1: savedP ? `Tu porra, ${dash(savedP)}, se puntúa cuando el acta diga el resultado.` : "La porra espera al acta.", line2: "El MVP y la nota se abren al publicarla." };

  // ================= the fan: the public bits
  const pubRace = f === "acta" || (f === "despues" && !winner);
  const pubWin = f === "despues" && !!winner;
  const pubRaceLine = hidden
    ? f === "despues"
      ? total
        ? `La votación del MVP cerró con ${total}${ofE} votos: el MVP sale con el recuento.`
        : "Nadie votó al MVP en este partido."
      : `El vestuario vota al MVP hasta ${closesWords}: ya han votado ${total}${ofE}.`
    : `La carrera del MVP: ${race.length ? `${name(race[0][0])} va primero con ${top} votos.` : "sin votos todavía."}${closesIn ? ` Cierra en ${closesIn}.` : ""}`;

  // ================= the ready line
  const cajaWord = caja ? (claimed ? "la caja está avisada" : !caja.owes ? "la caja, al día" : "") : "";
  const readyH = isJ ? "Lo tienes todo" : "Todo listo";
  const readyLine = `${isJ ? `${andList([ans ? SAID[ans] : "No respondiste", `tu porra es ${savedP ? dash(savedP) : "–"}`, cajaWord].filter(Boolean))}.` : `Tu porra es ${savedP ? dash(savedP) : "–"}.`}${f === "antes" ? ` Quedada a las ${meet} en ${c.venueShort}.` : " Ahora, a jugar."}`;

  // ================= the order
  const absShow = absRows.length > 0 || canWarn || warned;
  const has: Partial<Record<Block, boolean>> = {
    caja: !!caja,
    turnos: d.turns.length > 0,
    ausentes: absShow,
    team: nP > 0,
    partido: (isJ && iPlayed) || isMesa || linkFicha,
    mvp: !!closesAt || !!mvp,
    nota: d.nota.state !== "none",
  };
  const B = blockOrder({ fase: f, who: d.who, tasks: v.tasks, has });
  const fold = foldOf(B, { open: ui.more, tasky: { mesa: true, door: true, rsvp: rsvpEditing, porra: porraEditing, caja: cajaTask, mvp: ballot, nota: notaEditing }, isJ, gold: mvpResult });
  const b = fold.b;
  const porraBtnCls = B[0] === "porra" ? "vd-btn--pri" : "";
  const hasTeam = TEAM_BLOCKS.some((k) => B.includes(k));
  const sub = subOf(f, d.who, v.tasks, winner ? winName : null, mesaH);
  const colMe = !member ? "Lo que hay dentro" : isMesa && (pre || live || fin || off === "pendiente") ? "Lo tuyo, en la mesa" : "Lo tuyo";
  const colTeam = !member ? "Lo que el vestuario cuenta a todos" : "Del equipo";
  const cls = ["pp-place", "pp-place--vestuario", member ? "is-member" : "is-fan", ui.more ? "is-open" : ""].filter(Boolean).join(" ");
  const blk = (id: Block, extra: string, labelledby: string | null, children: ReactNode, aria?: string) =>
    b[id].show ? (
      <section className={`ves-blk ${extra} ${b[id].c}`.trim()} style={{ order: b[id].o }} aria-labelledby={labelledby ?? undefined} aria-label={aria}>
        {children}
      </section>
    ) : null;
  const scorers = d.candidates.map((x) => ({ v: x, t: name(x) }));
  const winTee = winner ? <Tee kit={c.kit} num={c.numOf(winner)} className="ves-win__tee" /> : <Tee kit={c.kit} className="ves-win__tee" />;

  return (
    <section className={cls} aria-labelledby="ves-h">
      <header className="pp-place__head">
        <div>
          <h2 id="ves-h">Vestuario</h2>
          <p>{sub}</p>
        </div>
      </header>
      <div className="pp-place__body ves-body" id="ves-body">
        <div className="ves-col ves-col--me">
          <h3 className="ves-colk">{colMe}</h3>
          {blk(
            "mesa",
            "ves-mesa",
            "ves-mesa-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-mesa-h">{mesaH}</h3>
                <span>{mesaNote}</span>
              </div>
              <p className="ves-p">{mesaLineNow}</p>
              <div className="ves-acts">
                <a
                  className="vd-glass vd-press vd-btn vd-btn--pri"
                  href={`${c.base}/mesa`}
                  onClick={(e) => {
                    e.preventDefault();
                    c.go("mesa");
                  }}
                >
                  <Icon name="mesa" />
                  {mesaBtn}
                </a>
              </div>
            </>,
          )}
          {blk(
            "ready",
            "ves-ready",
            "ves-ready-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-ready-h">
                  <Icon name="check" className="pp-i ves-ok" />
                  {readyH}
                </h3>
              </div>
              <p className="ves-p">{readyLine}</p>
            </>,
          )}
          {blk(
            "rsvp",
            "ves-rsvp",
            "ves-rsvp-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-rsvp-h">{rsvpH}</h3>
                <span>{rsvpNote}</span>
              </div>
              <p className="ves-p">{rsvpLine}</p>
              {rsvpEditing && (
                <div className={`vd-glass vd-seg vi-rsvp ves-seg ${ans ? "" : "ves-nobead"}`.trim()} role="radiogroup" aria-label={`¿Vas ${Number.isFinite(c.kickMs) ? `${whenWords(c.kickMs, c.now).split(" a las ")[0].toLocaleLowerCase("es")} ` : ""}contra ${c.rival}?`} style={{ "--n": 3, "--i": rsvpI } as CSSProperties}>
                  <span className="vd-shelf__bead" aria-hidden="true" />
                  {OPTS.map(([val, t], j) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      className="vd-seg__b"
                      aria-checked={ans === val}
                      tabIndex={j === rsvpI ? 0 : -1}
                      onKeyDown={radioKeys}
                      onClick={() => ok(act.rsvp(val), val === "yes" ? "Apuntado: vas." : val === "maybe" ? "Apuntado: en duda." : "Apuntado: no vas.")}
                    >
                      {ans === val && <Icon name="check" />}
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <div className="ves-bar" aria-hidden="true">
                {bar.map(([k, n]) => (
                  <i key={k} className={k} style={{ width: `${squad ? ((n / squad) * 100).toFixed(1) : 0}%` }} />
                ))}
              </div>
              <p className="ves-counts" aria-live="polite">
                {countWords.map(([n, t]) => (
                  <span key={t}>
                    <b>{n}</b> {t}
                  </span>
                ))}
              </p>
              {isJ && rsvpOpen && !!ans && !rsvpEditing && (
                <button type="button" className="vd-link ves-change" onClick={() => set({ rsvpEdit: true })}>
                  Cambiar mi respuesta
                </button>
              )}
              {isJ && rsvpOpen && !!ans && rsvpEditing && (
                <button type="button" className="vd-link ves-change" onClick={() => set({ rsvpEdit: false })}>
                  Dejarla como estaba
                </button>
              )}
            </>,
          )}
          {blk(
            "porra",
            "ves-porra",
            "ves-porra-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-porra-h">Tu porra</h3>
                <span>{porraNote}</span>
              </div>
              {porraEditing && (
                <>
                  <div className="ves-steps" role="group" aria-label={`Tu porra: Piti contra ${c.rival}`}>
                    <div className="ves-step">
                      <span className="ves-step__t">Piti</span>
                      <div className="ves-step__ctl">
                        <button type="button" className="vd-glass vd-press vd-ibtn ves-step__b" aria-label="Un gol menos del Piti" disabled={gf === 0} onClick={stepTo("gf", gf, -1)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                        <output className="ves-step__n" aria-live="polite">
                          {gf}
                        </output>
                        <button type="button" className="vd-glass vd-press vd-ibtn ves-step__b" aria-label="Un gol más del Piti" disabled={gf === 30} onClick={stepTo("gf", gf, 1)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M6 12h12M12 6v12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <span className="ves-step__dash" aria-hidden="true">
                      –
                    </span>
                    <div className="ves-step">
                      <span className="ves-step__t">{c.rival}</span>
                      <div className="ves-step__ctl">
                        <button type="button" className="vd-glass vd-press vd-ibtn ves-step__b" aria-label={`Un gol menos de ${c.rival}`} disabled={ga === 0} onClick={stepTo("ga", ga, -1)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                        <output className="ves-step__n" aria-live="polite">
                          {ga}
                        </output>
                        <button type="button" className="vd-glass vd-press vd-ibtn ves-step__b" aria-label={`Un gol más de ${c.rival}`} disabled={ga === 30} onClick={stepTo("ga", ga, 1)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M6 12h12M12 6v12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <label className="ves-field">
                    <span className="vd-label">Tu goleador</span>
                    <select className="vd-input ves-sel" value={scorer} disabled={gf === 0} onChange={(e) => set({ scorer: e.target.value, ...(e.target.value === assist ? { assist: "" } : {}) })}>
                      <option value="">Elegir jugador</option>
                      {scorer && !d.candidates.includes(scorer) && (
                        <option value={scorer} disabled>
                          {name(scorer)} · no disponible
                        </option>
                      )}
                      {scorers.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ves-field">
                    <span className="vd-label">Asistencia (si quieres)</span>
                    <select className="vd-input ves-sel" value={assist} disabled={gf === 0} onChange={(e) => set({ assist: e.target.value })}>
                      <option value="">No pronostico asistencia</option>
                      {scorers
                        .filter((o) => o.v !== scorer)
                        .map((o) => (
                          <option key={o.v} value={o.v}>
                            {o.t}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button type="button" className="vd-link ves-rulesb" aria-expanded={ui.rules} onClick={() => set({ rules: !ui.rules })}>
                    {ui.rules ? "Ocultar cómo se puntúa" : "Cómo se puntúa"}
                  </button>
                  {ui.rules && (
                    <ul className="ves-lines ves-rules">
                      <li>Resultado exacto: 3 puntos. Solo quién gana o el empate: 1 punto.</li>
                      <li>Cada gol de tu goleador: 2 puntos más; desde su segundo gol, 2 más por cada uno.</li>
                      <li>Cada pase de gol de tu asistencia: 1 punto más, y 3 más si el pase es para tu goleador.</li>
                      <li>Se cierra con el pitido inicial y se puntúa con el acta.</li>
                    </ul>
                  )}
                  <div className="ves-acts">
                    <button type="button" className={`vd-glass vd-press vd-btn ${porraBtnCls} ves-save`.replace(/\s+/g, " ")} aria-disabled={!changed || !valid || busy} onClick={savePorra}>
                      {busy ? "Guardando…" : savedP && !changed ? "Porra guardada" : savedP ? "Cambiar mi porra" : "Guardar mi porra"}
                    </button>
                    {!!savedP && (
                      <button type="button" className="vd-link" onClick={() => set({ porraEdit: false, gf: null, ga: null, scorer: null, assist: null })}>
                        No cambiarla
                      </button>
                    )}
                  </div>
                  <p className="ves-hint">{!valid ? "Elige quién marca para poder guardarla." : "Puedes cambiarla hasta el pitido inicial. Solo tú la ves antes del inicio."}</p>
                </>
              )}
              {porraSaved && savedP && (
                <div className="ves-pick">
                  <b className="vd-score ves-pick__n" role="img" aria-label={`Tu porra: ${savedP.gf} a ${savedP.ga}`}>
                    <span aria-hidden="true">{dash(savedP)}</span>
                  </b>
                  <div>
                    <p className="ves-pick__t">{scorerLine}</p>
                    {d.porraOpen && (
                      <button type="button" className="vd-link ves-change" onClick={() => set({ porraEdit: true })}>
                        Cambiar mi porra
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!porraEditing && !savedP && !off && <p className="ves-p">{d.porraLoading ? "Cargando tu porra…" : pre ? "La porra se cierra con el pitido inicial." : "No pusiste porra para este partido."}</p>}
              {porraMsg && <p className="ves-p">{porraMsg}</p>}
            </>,
          )}
          {blk(
            "live",
            "ves-live",
            "ves-live-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-live-h">{liveH}</h3>
                <span className="vd-provtag">{fin ? "Falta el acta" : "Si acaba así"}</span>
              </div>
              {savedP && v0 && (
                <div className={`ves-vs is-${v0}`}>
                  <div className="ves-vs__c">
                    <span className="ves-k">Tu porra</span>
                    <b className="vd-score">{dash(savedP)}</b>
                  </div>
                  <div className="ves-vs__c">
                    <span className="ves-k">{nowK}</span>
                    <b className="vd-score">
                      {sc.us}–{sc.them}
                    </b>
                  </div>
                  <p className="ves-verdict">
                    <Icon name="check" />
                    {VW(v0)}
                  </p>
                </div>
              )}
              <p className="ves-p" aria-live="polite">
                {liveLine}
              </p>
            </>,
          )}
          {blk(
            "mvp",
            "ves-mvp",
            "ves-mvp-h",
            <>
              {mvpResult && (
                <div className="ves-win">
                  {winTee}
                  <div className="ves-win__t">
                    <p className="ves-win__k">
                      <Star />
                      {mvpK} · votación cerrada
                    </p>
                    <h3 id="ves-mvp-h" className="ves-win__n">
                      MVP: {winName}
                    </h3>
                    <p className="ves-hint">{winLine}</p>
                  </div>
                </div>
              )}
              {ballot && (
                <>
                  <div className="ves-hd">
                    <h3 id="ves-mvp-h">Vota al MVP</h3>
                    <span>{mvpNote}</span>
                  </div>
                  <p className="ves-hint">{mvpSub}</p>
                  <div className="ves-ballot" role="radiogroup" aria-labelledby="ves-mvp-h">
                    {playedIds.map((id) => (
                      <button key={id} type="button" role="radio" className="ves-cand" aria-checked={mvpPick === id} tabIndex={(mvpPick ? mvpPick === id : id === playedIds[0]) ? 0 : -1} onKeyDown={radioKeys} onClick={() => set({ mvpPick: id })}>
                        <Tee kit={c.kit} num={c.numOf(id)} className="ves-cand__tee" />
                        <span className="ves-cand__n">
                          {name(id)}
                          {id === pid && <small> · tú</small>}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="ves-acts">
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--gold" aria-disabled={mvpBtnOff} onClick={vote}>
                      <Star fill />
                      {mvpBtn}
                    </button>
                    {!!myVote && (
                      <button type="button" className="vd-link" onClick={() => set({ mvpEdit: false, mvpPick: null })}>
                        No cambiarlo
                      </button>
                    )}
                  </div>
                  <span className="vd-vh">{leadLine}</span>
                </>
              )}
              {mvpRace && (
                <div className="ves-hd">
                  <h3 id="ves-mvp-h">La carrera del MVP</h3>
                  <span>{mvpNote}</span>
                </div>
              )}
              {!mvpResult && !ballot && !mvpRace && (
                <div className="ves-hd">
                  <h3 id="ves-mvp-h">El MVP</h3>
                  <span>{mvpNote}</span>
                </div>
              )}
              {mvpHidden && <p className="ves-p">{hiddenLine}</p>}
              {mvpBars && (
                <>
                  <ol className="ves-bars ves-race" aria-label="Los votos del MVP">
                    {race.slice(0, voteOpen ? 4 : 3).map(([id, n], i) => (
                      <li key={id} className={[i === 0 ? "is-lead" : "", id === myVote ? "is-mine" : ""].filter(Boolean).join(" ") || undefined}>
                        <span className="ves-bars__t">
                          {name(id)}
                          {id === myVote && <small> · tu voto</small>}
                        </span>
                        <span className="ves-bars__bar" aria-hidden="true">
                          <i style={{ width: `${Math.max(6, Math.round((n / Math.max(1, top)) * 100))}%` }} />
                        </span>
                        <b className="ves-bars__n">{n}</b>
                      </li>
                    ))}
                  </ol>
                  <p className="ves-p">{mineLine}</p>
                </>
              )}
              {voteOpen && !!myVote && !ballot && (
                <div className="ves-acts">
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--gold" onClick={() => set({ mvpEdit: true, mvpPick: myVote })}>
                    <Star fill />
                    Cambiar tu voto
                  </button>
                </div>
              )}
            </>,
          )}
          {blk(
            "nota",
            "ves-nota",
            "ves-nota-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-nota-h">{notaH}</h3>
                <span>{notaNote}</span>
              </div>
              {notaEditing && (
                <div className="ves-stars" role="radiogroup" aria-labelledby="ves-nota-h">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" className={`ves-star ${nota && n <= nota ? "is-on" : ""}`.trim()} aria-checked={nota === n} aria-label={`${n} de 5`} tabIndex={(nota ? nota === n : n === 1) ? 0 : -1} onKeyDown={radioKeys} onClick={() => ok(act.rate(n), `Nota guardada: ${n} de 5.`)}>
                      <Star />
                      <b aria-hidden="true">{n}</b>
                    </button>
                  ))}
                </div>
              )}
              {!notaEditing && !!nota && (
                <div className="ves-stars ves-stars--still" role="img" aria-label={`Tu nota: ${nota} de 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`ves-star ${n <= nota ? "is-on" : ""}`.trim()} aria-hidden="true">
                      <Star />
                    </span>
                  ))}
                </div>
              )}
              <p className="ves-p" aria-live="polite">
                {notaLine}
              </p>
              <div className="ves-acts ves-acts--links">
                {!notaEditing && !!nota && notaOpen && (
                  <button type="button" className="vd-link" onClick={() => set({ notaEdit: true })}>
                    Cambiar mi nota
                  </button>
                )}
                {notaEditing && !!nota && (
                  <button type="button" className="vd-link" onClick={() => set({ notaEdit: false })}>
                    Dejarla como estaba
                  </button>
                )}
                {notaEditing && !!nota && (
                  <button type="button" className="vd-link" onClick={() => ok(act.unrate(), "Has quitado tu nota.")}>
                    Quitar mi nota
                  </button>
                )}
              </div>
            </>,
          )}
          {blk(
            "partido",
            "ves-partido",
            "ves-partido-h",
            <>
              {isJ && iPlayed && (
                <>
                  <div className="ves-hd">
                    <h3 id="ves-partido-h">Tu partido</h3>
                    <span>{partidoRes}</span>
                  </div>
                  <div className="ves-nums">
                    {nums.map(([n, s]) => (
                      <p key={s} className="vd-count">
                        <b>{n}</b>
                        <span>{s}</span>
                      </p>
                    ))}
                  </div>
                  <p className="ves-p">{partidoLine}</p>
                  <div className="ves-cromo-row">
                    <figure className="ves-cromo is-saved" role="img" aria-label={cromoAlt}>
                      <span className="ves-cromo__top" aria-hidden="true">
                        <img src="/crest-128.webp" alt="" width={18} height={18} />
                        {jPre ? `${jPre} · ` : ""}
                        {c.rival}
                      </span>
                      <Tee kit={c.kit} num={c.numOf(pid ?? "")} className="ves-cromo__tee" />
                      <b className="ves-cromo__name" aria-hidden="true">
                        {cromoName}
                      </b>
                      <span className="ves-cromo__line" aria-hidden="true">
                        {cromoLine}
                      </span>
                      <span className="ves-cromo__foot" aria-hidden="true">
                        {cromoFoot}
                      </span>
                      <span className="ves-cromo__sheen" aria-hidden="true" />
                    </figure>
                    <div className="ves-cromo__side">
                      <h4 className="ves-h4">Tu cromo de la jornada</h4>
                      <p className="ves-hint">{cromoHint}</p>
                      <div className="ves-acts">
                        <span className="vd-glass vd-btn vd-btn--sm ves-cromo__got">
                          <Icon name="check" />
                          Guardado en tus cromos
                        </span>
                        <Go className="vd-link" href="/perfil/temporada/cromos">
                          Ver tus cromos
                        </Go>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {linkFicha && (
                <>
                  <div className="ves-hd">
                    <h3 id="ves-partido-h">Tu partido</h3>
                    <span>{partidoRes}</span>
                  </div>
                  <p className="ves-p">Vincula tu ficha para ver aquí tus minutos, tus tramos y tus acciones de cada partido.</p>
                  <div className="ves-acts">
                    <Go className="vd-link" href="/perfil/cuenta">
                      Vincular mi ficha
                    </Go>
                    <Go className="vd-link" href="/perfil/temporada">
                      Tu recorrido en la porra
                    </Go>
                  </div>
                </>
              )}
              {isMesa && (
                <>
                  <div className="ves-hd">
                    <h3 id="ves-partido-h">Tu partido, en la mesa</h3>
                    <span>{partidoRes}</span>
                  </div>
                  <p className="ves-p">{mesaLine}</p>
                </>
              )}
            </>,
          )}
          {blk(
            "caja",
            "ves-caja",
            "ves-caja-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-caja-h">
                  <Icon name="euro" />
                  La caja del partido
                </h3>
                <span>{caja ? euros(caja.fee) : ""}</span>
              </div>
              <p className="ves-p">{cajaLine}</p>
              <div className="ves-acts">
                {caja?.owes && !claimed && (
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => ok(act.pay(), "Avisado: lo confirma un capitán.")}>
                    <Icon name="euro" />
                    Ya la he pagado
                  </button>
                )}
                {claimed && (
                  <button type="button" className="vd-link" onClick={() => ok(act.unpay(), "Aviso de pago deshecho.")}>
                    Deshacer el aviso
                  </button>
                )}
              </div>
            </>,
          )}
          {blk(
            "paused",
            "ves-paused",
            "ves-paused-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-paused-h">
                  <Icon name="cal" />
                  Todo en pausa
                </h3>
              </div>
              <ul className="ves-lines">
                <li>{paused.line1}</li>
                <li>{paused.line2}</li>
                {paused.line3 && <li>{paused.line3}</li>}
              </ul>
            </>,
          )}
          {blk(
            "pend",
            "ves-pend",
            "ves-pend-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-pend-h">
                  <Icon name="mesa" />
                  La porra espera al acta
                </h3>
                <span>Sin acta</span>
              </div>
              <ul className="ves-lines">
                <li>{pend.line1}</li>
                <li>{pend.line2}</li>
              </ul>
            </>,
          )}
          {blk(
            "door",
            "ves-door",
            "ves-door-h",
            <>
              <div className="ves-hd">
                <h3 id="ves-door-h">
                  <Icon name="lock" />
                  Lo del equipo, dentro
                </h3>
              </div>
              <ul className="ves-door__list">
                <li>
                  <Icon name="check" />
                  ¿Vas?, la quedada y los ausentes
                </li>
                <li>
                  <Icon name="star" />
                  La porra, la del equipo y sus puntos
                </li>
                <li>
                  <Icon name="trophy" />
                  El voto del MVP y la nota del partido
                </li>
                <li>
                  <Icon name="wash" />
                  Los turnos y la caja
                </li>
              </ul>
              <div className="ves-acts">
                <Go className="vd-glass vd-press vd-btn vd-btn--pri" href="/vestuario/puerta">
                  <Icon name="lock" />
                  Entrar al vestuario
                </Go>
              </div>
              <p className="ves-hint">¿Juegas en el Piti? Pide entrar y te abre un capitán.</p>
            </>,
          )}
        </div>
        {hasTeam && (
          <div className="ves-col ves-col--team">
            <h3 className="ves-colk">{colTeam}</h3>
            {blk(
              "quedada",
              "ves-qd",
              "ves-qd-h",
              <>
                <b className="vd-clock ves-qd__h">{meet}</b>
                <div>
                  <h3 id="ves-qd-h" className="ves-qd__t">
                    La quedada
                  </h3>
                  <p className="ves-p">{d.meetingNote || `En ${c.venueShort}, media hora antes del pitido de las ${kickT}.`}</p>
                </div>
              </>,
            )}
            {blk(
              "turnos",
              "ves-turnos",
              "ves-turnos-h",
              <>
                <div className="ves-hd">
                  <h3 id="ves-turnos-h">{turnosH}</h3>
                  <span>¿A quién le toca?</span>
                </div>
                <ul className="ves-turns">
                  {turnRows.map((t) => (
                    <li key={t.key} className={t.cls || undefined}>
                      <Icon name={t.icon} />
                      <span className="ves-turns__j">{t.job}</span>
                      <b className="ves-turns__w">{t.who}</b>
                    </li>
                  ))}
                </ul>
                {canDone && (
                  <div className="ves-acts">
                    <button
                      type="button"
                      className="vd-glass vd-press vd-btn vd-btn--sm"
                      aria-pressed={d.turnDone}
                      onClick={() =>
                        void act.toggleTurn().then(
                          (on) => c.say(on ? "Turno hecho." : "Turno sin hacer."),
                          (e: unknown) => c.say(apiError(e)),
                        )
                      }
                    >
                      <Icon name="check" />
                      {d.turnDone ? "Hecho" : "Marcar como hecho"}
                    </button>
                  </div>
                )}
              </>,
            )}
            {blk(
              "ausentes",
              "ves-aus",
              "ves-aus-h",
              <>
                <div className="ves-hd">
                  <h3 id="ves-aus-h">Ausentes</h3>
                  <span>{absRows.length ? plural(absRows.length, "ausente", "ausentes") : "Nadie ausente"}</span>
                </div>
                {absRows.length > 0 && (
                  <ul className="ves-turns">
                    {absRows.map((a) => (
                      <li key={a.id}>
                        <Icon name="cal" />
                        <span className="ves-turns__j">{a.name}</span>
                        <b className="ves-turns__w ves-aus__why">{a.why}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {canWarn && (
                  <div className="ves-acts">
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => ok(act.warn(), "Avisado: no puedes ir.")}>
                      <Icon name="cal" />
                      Avisar de que no puedo
                    </button>
                  </div>
                )}
                {warned && (
                  <>
                    <p className="ves-p">{warnedLine}</p>
                    {canUnwarn && (
                      <button type="button" className="vd-link" onClick={() => ok(act.unwarn(), "Aviso deshecho.")}>
                        Deshacer el aviso
                      </button>
                    )}
                  </>
                )}
              </>,
            )}
            {blk(
              "team",
              "ves-team",
              "ves-team-h",
              <>
                <div className="ves-hd">
                  <h3 id="ves-team-h">La porra del equipo</h3>
                  <span>{done ? "Puntos de la jornada" : "Clasificación provisional"}</span>
                </div>
                <ol className="ves-rank">
                  {rank.map((r) => (
                    <li key={r.uid} className={r.cls}>
                      <b className="ves-rank__n">
                        {r.name}
                        {r.me && <small> · tú</small>}
                      </b>
                      <span className="ves-rank__p">{r.pick}</span>
                      <span className="ves-rank__v">{r.v}</span>
                    </li>
                  ))}
                </ol>
                <p className="ves-hint">{teamNote}</p>
              </>,
            )}
            {blk(
              "res",
              "ves-res",
              "ves-res-h",
              <>
                <div className="ves-hd">
                  <h3 id="ves-res-h">{resH}</h3>
                  <span>La porra de la jornada</span>
                </div>
                {dist.rows.length > 0 && (
                  <ol className="ves-bars" aria-label="Lo que dijo el equipo">
                    {dist.rows.map((r) => (
                      <li key={r.t} className={r.cls || undefined}>
                        <span className="ves-bars__t">
                          {r.t}
                          {r.real && <small> · el resultado</small>}
                          {r.mine && <small> · tú</small>}
                        </span>
                        <span className="ves-bars__bar" aria-hidden="true">
                          <i style={{ width: `${r.w}%` }} />
                        </span>
                        <b className="ves-bars__n">{r.c}</b>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="ves-p">{resMine}</p>
              </>,
            )}
            {blk(
              "pub",
              "ves-pub",
              null,
              <>
                {pubWin && (
                  <div className="ves-win">
                    {winTee}
                    <div className="ves-win__t">
                      <p className="ves-win__k">
                        <Star />
                        {mvpK}
                      </p>
                      <h3 className="ves-win__n">MVP: {winName}</h3>
                      <p className="ves-hint">{winLine}</p>
                    </div>
                  </div>
                )}
                {pubRace && <p className="ves-p ves-pub__race">{pubRaceLine}</p>}
                <p className="ves-p ves-pub__nota">
                  <Star />
                  {pubNota}
                </p>
              </>,
              "Lo que el vestuario cuenta a todos",
            )}
          </div>
        )}
        {fold.more.show && (
          <div className="vd-more ves-more" style={{ order: fold.more.o }}>
            <span>
              <b>{fold.more.n} más</b> · {fold.more.what}
            </span>
            <button type="button" className="vd-more__btn" aria-expanded={ui.more} aria-controls="ves-body" onClick={() => set({ more: !ui.more })}>
              {ui.more ? "Ver menos" : "Ver todo"}
              <Icon name={ui.more ? "collapse" : "expand"} className="" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
