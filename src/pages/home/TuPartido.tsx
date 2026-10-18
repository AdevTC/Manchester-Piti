// «Tu partido»: the member layer of Inicio, one card per viewer and phase. It never repeats the match (the hero
// already is the score, the countdown and the venue): it says what is his today: the turno, his own porra (his
// prediction, never the others' before the kick-off), the nota 1–5 from the acta on, the «Debut», la mesa for the
// anotador, the absence for the one away, and a quiet «Modo capitán» for the captains. A lazy chunk, mounted
// client side for members only (HomePage): a fan never loads it nor reads member data.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { dateMillis, nameFor, type ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import type { MatchdayModel, ViewerRole } from "../../lib/derived/matchday";
import { useAvailability, useMatchRatings, useMyPrediction } from "../vestuario/live";
import { rateMatch, useMe } from "../vestuario/writes";
import { useMatchTurns } from "../../lib/useRotaTurns";
import { turnsLine } from "../../lib/derived/rota";
import { formatNota, notaLine, ratingSummary, ratingWindow } from "../../lib/derived/trasElPartido";
import { scorePrediction } from "../../../functions/src/predictions";
import { parseMatchLineup } from "../../lib/matchLineup";
import { madridTime } from "../../lib/derived/madrid";
import { dayWord, niceName, weekday, type MatchView } from "./inicioModel";

const POS: Record<string, string> = {
  POR: "portero",
  DFC: "central",
  LIB: "líbero",
  LI: "lateral izquierdo",
  LD: "lateral derecho",
  MCD: "pivote",
  MC: "centrocampista",
  MI: "interior izquierdo",
  MD: "interior derecho",
  MCO: "mediapunta",
  EI: "extremo izquierdo",
  ED: "extremo derecho",
  DC: "delantero centro",
};

export interface TuPartidoProps {
  day: MatchdayModel;
  view: MatchView;
  role: ViewerRole;
  now: number;
  matches: readonly ClubMatch[];
  players: readonly PlayerDoc[];
  playerId: string | null;
  /** A captain (admin): the quiet «Modo capitán» link. */
  captain: boolean;
  seven: readonly string[];
  /** The day his absence ends (YYYY-MM-DD), when he is away. */
  absentUntil: string | null;
}

interface Mini {
  b: string;
  s: string;
}

const mins = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "minuto" : "minutos"}`;

/** «el 25» from «2026-10-25». */
const untilWord = (ymd: string) => `el ${Number(ymd.slice(8, 10))}`;

export function TuPartido({ day, view, role, now, matches, players, playerId, captain, seven, absentUntil }: TuPartidoProps) {
  const me = useMe();
  const m = day.match;
  const p = view.phase;
  const uid = me?.uid;
  const after = p === "acta" || p === "despues";
  const prediction = useMyPrediction(m && p !== "pretemporada" && p !== "aplazado" ? m.id : undefined, uid);
  const turns = useMatchTurns(m ?? undefined, matches, !!m && !isLivePhase(p));
  const ratings = useMatchRatings(m && after ? m.id : undefined);
  // (the captain's count: the called who haven't answered — member-only data, and only while it matters)
  const capOn = captain && !!m && (p === "semana" || p === "antes");
  const answers = useAvailability(capOn ? m.id : undefined);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState("");

  const player = players.find((x) => x.id === playerId) ?? null;
  const nameOf = (id: string) => nameFor(players.find((x) => x.id === id), m?.seasonId);
  const myName = player ? niceName(nameFor(player, m?.seasonId)) : (me?.name ?? "Tú");
  const dorsal = player?.number != null ? String(player.number) : "";
  const meta = dorsal ? `${myName}, dorsal ${dorsal}` : myName;
  const ko = day.kickoff;
  const when = ko ? dayWord(ko, now) : "";

  // his porra (own only), with its points once the score is in
  const pr = prediction.data;
  const porra: Mini | null = pr
    ? {
        b: `Tu porra: ${pr.goalsFor}–${pr.goalsAgainst}`,
        s:
          p === "final" || after
            ? `${scorePrediction(pr, { goalsFor: view.gf, goalsAgainst: view.ga }, m?.events ?? []).total} puntos${p === "final" ? " provisionales" : ""}`
            : isLivePhase(p)
              ? `Ahora va ${view.gf}–${view.ga}`
              : "Cierra al pitido",
      }
    : p === "semana" || p === "antes"
      ? { b: "Porra sin poner", s: "Cierra al pitido" }
      : null;
  const line = turnsLine(turns.turns, nameOf, playerId);
  const turno: Mini | null = line ? { b: line.text, s: "Turnos de la jornada" } : null;

  // the nota, from the acta on (1–5, his own; the average only once there are votes)
  const win = m ? ratingWindow(m, now) : { state: "none" as const };
  const mine = ratings.data.find((r) => r.uid === uid)?.score ?? null;
  const shown = sent ?? mine;
  const summary = ratingSummary(ratings.data);
  const rate = async (n: number) => {
    if (!me || !m) return;
    setSent(n);
    setError("");
    try {
      await rateMatch(me, m.id, n);
    } catch {
      setSent(null);
      setError("No se ha guardado tu nota. Inténtalo otra vez.");
    }
  };

  // what he did tonight (the ledger, once the acta is out)
  const ledger = m && playerId ? m.ledger?.[playerId] : undefined;
  const played = !!ledger?.played;
  const debut =
    played &&
    !!m &&
    !matches.some((x) => x.id !== m.id && x.status === "finished" && dateMillis(x.date) < dateMillis(m.date) && !!playerId && x.ledger?.[playerId]?.played);

  let urgent = false;
  let h = "";
  let lead = "";
  let minis: (Mini | null)[] = [];
  let acts: { label: string; to: "mesa" | "match" | "vestuario"; pri: boolean }[] = [];
  const nota = after && win.state === "open";

  if (role === "anotador") {
    if (p === "semana") {
      h = `${when ? `${when.charAt(0).toUpperCase()}${when.slice(1)}` : "El próximo"} anotas tú`;
      lead = "La mesa abre media hora antes con la ficha del partido ya preparada.";
      acts = [{ label: "Ver cómo es la mesa", to: "mesa", pri: false }];
    } else if (p === "antes") {
      h = "Hoy anotas tú";
      lead = `La mesa ya tiene el partido: el siete, el banquillo y ${m?.rival ?? "el rival"}. Ábrela antes de las ${ko ? madridTime(ko) : "el pitido"}.`;
      acts = [{ label: "Abrir la mesa", to: "mesa", pri: true }];
      urgent = true;
    } else if (p === "pitido") {
      h = "Arranca tú el reloj";
      lead = `Son más de las ${ko ? madridTime(ko) : "la hora"} y todos esperan el pitido. Al arrancarlo, empieza el directo para todos.`;
      acts = [{ label: "Abrir la mesa y arrancar", to: "mesa", pri: true }];
      urgent = true;
    } else if (isLivePhase(p)) {
      h = "Llevas la mesa";
      lead = "Cada jugada que apuntas llega a todos al momento.";
      acts = [{ label: "Volver a la mesa", to: "mesa", pri: true }];
    } else if (p === "final") {
      h = "Cierra el acta";
      lead = "Revisa goles, tarjetas y minutos y publícala: así se abren las notas y el MVP.";
      acts = [{ label: "Revisar y publicar el acta", to: "mesa", pri: true }];
      urgent = true;
    } else if (p === "aplazado") {
      h = "Esta vez no hay mesa";
      lead = "Te volverá a tocar el día de la nueva fecha; te avisamos.";
    } else {
      h = "Acta publicada";
      lead = "Con el acta se movieron la clasificación, el pichichi y los logros.";
      minis = [porra];
    }
  } else if (role === "ausente") {
    h = after ? "Vuelves para la próxima" : absentUntil ? `Estás de baja hasta ${untilWord(absentUntil)}` : "Estás de baja";
    lead = "Apuntaste una ausencia: la convocatoria no te cuenta hasta que vuelvas.";
    acts = [{ label: "Cambiar mi ausencia", to: "vestuario", pri: false }];
  } else if (p === "pretemporada") {
    h = "Tu ficha está lista";
    lead = "Cuando salga el calendario te llegará la primera convocatoria.";
    minis = [turno, { b: "Tu carta", s: "Por estrenar" }];
  } else if (p === "semana") {
    h = role === "noconvocado" ? "Convocatoria abierta" : `Te esperan ${when}`;
    lead = "Responde en tu asiento de la primera fila: con eso el capitán cierra el siete.";
    minis = [turno, porra];
  } else if (p === "antes") {
    if (role === "titular") {
      const code = m ? parseMatchLineup((m as ClubMatch & { lineup?: unknown }).lineup)?.slots.find((s) => s.playerId === playerId)?.code : undefined;
      h = seven.length ? (code && POS[code] ? `Sales de ${POS[code]}` : "Sales en el siete") : "El siete aún no está";
      lead = seven.length ? "Tu sitio está marcado en el césped, con tu nombre." : "En cuanto el capitán publique el siete lo verás aquí.";
    } else if (role === "suplente") {
      h = "Empiezas en el banquillo";
      lead = "Estás convocado: atento al calentamiento, que el fútbol 7 cambia mucho.";
    } else {
      h = "Esta vez no vas convocado";
      lead = "Desde la grada también cuenta. La próxima convocatoria te espera en tu asiento.";
    }
    minis = [turno, porra];
  } else if (p === "pitido") {
    h = role === "titular" ? "En el campo, listos" : role === "suplente" ? "En el banquillo, listos" : "Desde la grada";
    lead = "El partido arranca en cuanto la mesa pite. Tu porra ya no se puede cambiar.";
    minis = [porra];
  } else if (isLivePhase(p)) {
    const goals = view.events.filter((e) => e.playerId === playerId && /^goal/.test(e.type)).length;
    const assists = view.events.filter((e) => e.assistPlayerId === playerId).length;
    if (goals || assists) {
      h = goals ? (goals === 1 ? "Un gol, de momento" : `${goals} goles, de momento`) : assists === 1 ? "Una asistencia, de momento" : `${assists} asistencias, de momento`;
      lead = "Ya cuenta en tus números.";
    } else {
      h = pr ? `Tu porra: ${pr.goalsFor}–${pr.goalsAgainst}` : "A seguirlo";
      lead = `Ahora va ${view.gf}–${view.ga}. Se decide con el pitido final.`;
    }
    minis = [pr && (goals || assists) ? porra : null, { b: "La nota del vestuario", s: "Se abre con el acta" }];
  } else if (p === "final") {
    h = view.gf > view.ga ? "Victoria" : view.gf < view.ga ? "Esta vez no" : "Empate";
    lead = "Cuando la mesa publique el acta se abren la nota del vestuario y el voto al MVP.";
    minis = [porra];
  } else if (p === "acta") {
    h = "Pon nota al partido";
    lead = `Y vota al MVP tocando su asiento en la primera fila. Sin recuento a la vista hasta que cierre${m?.voteClosesAt ? `, el ${weekday(m.voteClosesAt)} a las ${madridTime(m.voteClosesAt)}` : ""}.`;
    minis = [porra];
  } else if (p === "despues") {
    h = summary.average !== null ? `Nota del vestuario: ${formatNota(summary.average)}` : "Así quedó";
    lead = [summary.count ? notaLine(summary).replace(/^Nota del vestuario: [\d,]+ · /, "Con ") + "." : "", played && ledger ? `Jugaste ${mins(ledger.minutes)}${ledger.goals ? ` y marcaste ${ledger.goals === 1 ? "un gol" : `${ledger.goals} goles`}` : ""}.` : ""]
      .filter(Boolean)
      .join(" ");
    minis = [porra];
  } else if (p === "aplazado") {
    h = "Te avisamos de la nueva fecha";
    lead = "Tu respuesta a la convocatoria se guarda; los turnos pasan al día nuevo.";
  }

  const list = minis.filter((x): x is Mini => !!x);
  const called = m ? [...(m.starters ?? []), ...(m.bench ?? [])] : [];
  const answered = new Set(answers.data.map((a) => a.playerId).filter(Boolean));
  const pending = called.filter((id) => !answered.has(id)).length;

  return (
    <section className={`ei-card lit ei-yo${urgent ? " urgent" : ""}`} aria-labelledby="ei-yo-h">
      <div className="who">
        {dorsal && (
          <span className={`dn${debut && after ? " gold" : ""}`} aria-hidden="true">
            {dorsal}
          </span>
        )}
        <div>
          <p className="ei-meta">{meta}</p>
          <h2 className="ei-h2" id="ei-yo-h">
            {h}
          </h2>
        </div>
      </div>
      {lead && <p className="ei-lead">{lead}</p>}
      {list.length > 0 && (
        <div className="ei-mini">
          {list.map((x) => (
            <div key={x.b}>
              <b>{x.b}</b>
              <span>{x.s}</span>
            </div>
          ))}
        </div>
      )}
      {nota && (
        <div className="ei-nota" role="group" aria-label="Pon nota al partido del equipo, del 1 al 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={shown === n ? "on" : undefined} aria-pressed={shown === n} onClick={() => void rate(n)}>
              {n}
            </button>
          ))}
          <span>{shown ? `Tu nota: ${shown}` : "Nota del vestuario, de 1 a 5"}</span>
        </div>
      )}
      {error && (
        <p className="ei-err" role="alert">
          {error}
        </p>
      )}
      {debut && after && (
        <div className="ei-logro">
          <span className="md" aria-hidden="true">
            {day.jornada ? `J${day.jornada}` : "1º"}
          </span>
          <div>
            <b>Logro desbloqueado: Debut</b>
            <span>Tu primer partido con el Piti{m?.home !== false ? " en Palomeras" : ""}.</span>
          </div>
        </div>
      )}
      {acts.length > 0 && m && (
        <div className="ei-acts">
          {acts.map((a) =>
            a.to === "mesa" ? (
              <Link key={a.label} className={`ei-btn${a.pri ? " pri" : " ghost"}`} to="/matches/$matchId/mesa" params={{ matchId: m.id }}>
                {a.label}
              </Link>
            ) : a.to === "vestuario" ? (
              <Link key={a.label} className={`ei-btn${a.pri ? " pri" : " ghost"}`} to="/vestuario">
                {a.label}
              </Link>
            ) : (
              <Link key={a.label} className={`ei-btn${a.pri ? " pri" : " ghost"}`} to="/matches/$matchId" params={{ matchId: m.id }}>
                {a.label}
              </Link>
            ),
          )}
        </div>
      )}
      {capOn && !answers.loading && pending > 0 && (
        <p className="ei-cap">
          <span>Modo capitán: {pending} sin responder</span>
          <Link to="/admin/convocar">Ir a Convocar</Link>
        </p>
      )}
    </section>
  );
}

function isLivePhase(p: MatchView["phase"]) {
  return p === "directo1" || p === "descanso" || p === "directo2";
}
