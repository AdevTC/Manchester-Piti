// The member's own bits on Partidos, in their own chunk: a fan never loads them and the server never renders
// them (the page mounts them only once hydrated and only for a member, useViewer).
// - The convocatoria (members: socio and jugador): its numbers, «3 vienen · 0 en duda · 0 no vienen · 13 sin
//   responder» (matchPrivate/{id}/availability, which only the vestuario reads — a fan keeps «Convocados 11…»),
//   the line under them (the jugador's own: «Vas, y juegas de lateral derecho con el brazalete. Faltan 13 por
//   contestar.») and his Voy / Duda / No voy (setAvailability, his own answer only).
// - «Tu porra»: his own prediction (matchPrivate/{id}/predictions/{uid}) — before the whistle with the
//   vestuario's PredictionForm behind «Ponerla» / «Cambiarla», while live how it stands («Ahora mismo la
//   clavas»), after it how it went («Fue 3–1: a un gol»).
// - His MVP vote while it is open: «Tú aún no has votado.» / «Votaste a Alcides. Puedes cambiarlo hasta el
//   martes.» and the gold «Vota al MVP» (the vote itself lives on the match page). Never anyone else's vote.
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { predictionOpen } from "../../../functions/src/predictions";
import { PredictionForm } from "../../components/celeste/PredictionForm";
import { useClubData, type ClubMatch } from "../../lib/clubData";
import { parseMatchLineup } from "../../lib/matchLineup";
import { POSITIONS } from "../../lib/positions";
import { rsvpSummary } from "../../lib/rsvp";
import { setAvailability, useMe, type Me } from "../vestuario/writes";
import { useAvailability, useLiveDoc, useMyMvpVote, useMyPrediction } from "../vestuario/live";
import { isCalled } from "./model";
import { porraVerdict } from "./vidrio/model";
import { Glyph } from "./vidrio/bits";

type Answer = "yes" | "maybe" | "no";
const readAnswer = (d: { response?: unknown } | undefined): Answer | "" =>
  d?.response === "yes" || d?.response === "maybe" || d?.response === "no" ? d.response : "";

/** The member's own answer for a match (live). */
function useMyAnswer(matchId: string, uid: string | undefined): Answer | "" {
  return useLiveDoc<Answer | "">(uid ? `matchPrivate/${matchId}/availability/${uid}` : null, "response", readAnswer, "").data;
}

const OPTIONS: readonly { v: Answer; label: string }[] = [
  { v: "yes", label: "Voy" },
  { v: "maybe", label: "Duda" },
  { v: "no", label: "No voy" },
];

/** Voy / Duda / No voy: the glass segmented control with its bead, the whole column wide. */
function RsvpGlass({ me, matchId, answer, label }: { me: Me; matchId: string; answer: Answer | ""; label: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pick = (v: Answer) => {
    if (busy || v === answer) return;
    setBusy(true);
    setFailed(false);
    setAvailability(me, matchId, v)
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  };
  const at = Math.max(0, OPTIONS.findIndex((o) => o.v === answer));
  return (
    <>
      <div className={`vd-glass vd-seg vp-rsvp${answer ? "" : " vp-rsvp--none"}`} role="group" aria-label={label} aria-busy={busy || undefined} style={{ "--n": 3, "--i": at } as CSSProperties}>
        <span className="vd-shelf__bead" aria-hidden="true" />
        {OPTIONS.map((o) => (
          <button key={o.v} type="button" className="vd-seg__b" aria-pressed={answer === o.v} disabled={busy} onClick={() => pick(o.v)}>
            {answer === o.v && <Glyph name="check" />}
            {o.label}
          </button>
        ))}
      </div>
      {failed && (
        <p className="vp-rsvp-err" role="alert">
          No se ha guardado. Prueba otra vez.
        </p>
      )}
    </>
  );
}

const SAID: Record<Answer, string> = { yes: "Vas", maybe: "Dudas", no: "No vas" };

/** The convocatoria for a member: the numbers, the line, and the jugador's «¿Vas?». `fallback`: the fan's
 *  line, while the answers load. */
export function MemberConvo({ match, j, captainId, fallback }: { match: ClubMatch; j?: number; captainId: string | null; fallback: string }) {
  const me = useMe();
  const answers = useAvailability(match.id);
  const mine = useMyAnswer(match.id, me?.uid);
  const called = [...(match.starters ?? []), ...(match.bench ?? [])];
  if (!me) return <p className="vp-sub">{fallback}</p>;
  const sum = rsvpSummary(
    answers.data.map((a) => ({ response: a.response, playerId: a.playerId })),
    called,
  );
  const faltan = sum.sin ? `${sum.sin === 1 ? "falta" : "faltan"} ${sum.sin} por contestar` : "ya ha contestado todo el mundo";
  const lineup = parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup);
  const captain = (match as ClubMatch & { captainId?: string | null }).captainId ?? captainId;
  const playing = isCalled(match, me.playerId);
  let line: string;
  if (playing && me.playerId) {
    const slot = lineup?.slots.find((s) => s.playerId === me.playerId);
    const role = slot ? `juegas de ${POSITIONS[slot.code].name.toLocaleLowerCase("es")}` : match.starters?.includes(me.playerId) ? "eres titular" : "empiezas en el banquillo";
    const arm = captain === me.playerId ? " con el brazalete" : "";
    line = mine === "yes" ? `${SAID.yes}, y ${role}${arm}. ${capitalFirst(faltan)}.` : mine ? `${SAID[mine]}. ${capitalFirst(faltan)}.` : `Aún no has dicho si vas; ${faltan}.`;
  } else {
    const seven = !!lineup || (match.starters?.length ?? 0) > 0;
    line = `${seven ? "El siete ya está publicado" : "La convocatoria está abierta"}; ${faltan}.`;
  }
  return (
    <>
      <p className="vp-counts" aria-label={`La convocatoria: ${sum.yes} vienen, ${sum.maybe} en duda, ${sum.no} no vienen, ${sum.sin} sin responder`}>
        <span>
          <b>{sum.yes}</b> vienen
        </span>
        <span>
          <b>{sum.maybe}</b> en duda
        </span>
        <span>
          <b>{sum.no}</b> no vienen
        </span>
        <span>
          <b>{sum.sin}</b> sin responder
        </span>
      </p>
      <p className="vp-sub">{line}</p>
      {playing && <RsvpGlass me={me} matchId={match.id} answer={mine} label={`¿Vas a la jornada ${j ?? ""} contra ${match.rival ?? "el rival"}?`.replace("  ", " ")} />}
    </>
  );
}

const capitalFirst = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

/** «Tu porra»: before the whistle «Se cierra con el pitido» and the form behind «Ponerla» / «Cambiarla»;
 *  while live how it stands; after it how it went. Nothing once closed if he didn't play it. */
export function PorraCard({ match, score, live, played }: { match: ClubMatch; score: { gf: number; ga: number } | null; live: boolean; played: boolean }) {
  const me = useMe();
  const { players } = useClubData();
  const saved = useMyPrediction(match.id, me?.uid);
  const [editing, setEditing] = useState(false);
  const formId = useId();
  const form = useRef<HTMLDivElement | null>(null);
  // the form opens below the fold of the lens (it scrolls inside on desktop): bring it into sight
  useEffect(() => {
    if (editing) form.current?.scrollIntoView?.({ block: "nearest" });
  }, [editing]);
  if (!me) return null;
  const open = predictionOpen(match);
  const p = saved.data ? { gf: saved.data.goalsFor, ga: saved.data.goalsAgainst } : null;
  const mine = p ? `${p.gf}–${p.ga}` : "";
  if (!open) {
    if (!p) return null;
    const v = score ? porraVerdict(p, score) : null;
    const said = !score ? "Cerrada desde el pitido" : live ? (v === "exacta" ? "Ahora mismo la clavas" : v === "cerca" ? "Ahora mismo, a un gol" : "Ahora mismo no la clavas") : played ? `Fue ${score.gf}–${score.ga}: ${v === "exacta" ? "la clavaste" : v === "cerca" ? "a un gol" : "esta vez no"}` : "Cerrada desde el pitido";
    return (
      <div className="vp-porra">
        <div>
          <b>Tu porra</b>
          <span className="vp-sub">{said}</span>
        </div>
        <span className="vd-score" aria-label={`Tu porra: ${mine}`}>
          {mine}
        </span>
      </div>
    );
  }
  return (
    <div className="vp-porra vp-porra--open">
      <div>
        <b>{mine ? "Tu porra" : saved.loading ? "Tu porra…" : "Tu porra, sin poner"}</b>
        <span className="vp-sub">Se cierra con el pitido</span>
      </div>
      {mine && (
        <span className="vd-score" aria-label={`Tu porra: ${mine}`}>
          {mine}
        </span>
      )}
      <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" aria-expanded={editing} aria-controls={formId} onClick={() => setEditing((v) => !v)}>
        {editing ? "Cerrar la porra" : mine ? "Cambiarla" : "Ponerla"}
      </button>
      {editing && (
        <div ref={form} id={formId} className="vp-porra__form">
          <PredictionForm match={match} players={players} uid={me.uid} />
        </div>
      )}
    </div>
  );
}

/** Directo's line under «En el campo ahora»: «Tu porra, 2–1: ahora mismo la clavas.» */
export function PorraNote({ match, gf, ga }: { match: ClubMatch; gf: number; ga: number }) {
  const me = useMe();
  const saved = useMyPrediction(match.id, me?.uid);
  if (!me || !saved.data) return null;
  const p = { gf: saved.data.goalsFor, ga: saved.data.goalsAgainst };
  const v = porraVerdict(p, { gf, ga });
  return (
    <p className="vp-note vp-porranote">
      Tu porra, {p.gf}–{p.ga}: {v === "exacta" ? "ahora mismo la clavas" : v === "cerca" ? "ahora mismo, a un gol" : "hoy no la clavas, de momento"}.
    </p>
  );
}

/** His MVP vote while the vote is open: the gold «Vota al MVP» (to the match's vote) and where he stands. */
export function MvpMine({ match, until, nameOf }: { match: ClubMatch; until: string; nameOf: (id: string) => string }) {
  const me = useMe();
  const vote = useMyMvpVote(match.id, me?.uid);
  if (!me) return null;
  return (
    <div className="vp-btns vp-mvpme">
      <Link className="vd-glass vd-btn vd-btn--sm vd-btn--gold vd-press" to="/matches/$matchId" params={{ matchId: match.id }}>
        <Glyph name="star" />
        {vote.data ? "Cambiar tu voto" : "Vota al MVP"}
      </Link>
      <p className="vp-note">{vote.data ? `Votaste a ${nameOf(vote.data)}. Puedes cambiarlo hasta ${until}.` : "Tú aún no has votado."}</p>
    </div>
  );
}
