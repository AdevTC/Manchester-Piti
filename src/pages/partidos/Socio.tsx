// The member's own bits on Partidos, in their own chunk: a fan never loads them and the server never renders
// them (the page mounts them only once hydrated and only for a member, useViewer). «¿Vas?»: each member reads and
// writes only his own answer (matchPrivate/{id}/availability/{uid}): no one else's answers, no counts, here or
// anywhere a fan could see; Voy / Duda / No voy write through the vestuario's setAvailability. «Tu porra»: his
// own prediction (matchPrivate/{id}/predictions/{uid}), the vestuario's PredictionForm while it is open, and only
// «Tu porra: 2–1» once the match has kicked off.
import { useId, useState } from "react";
import { predictionOpen } from "../../../functions/src/predictions";
import { PredictionForm } from "../../components/celeste/PredictionForm";
import { useClubData, type ClubMatch } from "../../lib/clubData";
import { setAvailability, useMe, type Me } from "../vestuario/writes";
import { useLiveDoc, useMyPrediction } from "../vestuario/live";
import { isCalled } from "./model";

type Answer = "yes" | "maybe" | "no";
const readAnswer = (d: { response?: unknown } | undefined): Answer | "" =>
  d?.response === "yes" || d?.response === "maybe" || d?.response === "no" ? d.response : "";

/** The member's own answer for a match (live). */
function useMyAnswer(matchId: string, uid: string | undefined): Answer | "" {
  return useLiveDoc<Answer | "">(uid ? `matchPrivate/${matchId}/availability/${uid}` : null, "response", readAnswer, "").data;
}

const OPTIONS: readonly { v: Answer; label: string; cls: string }[] = [
  { v: "yes", label: "Voy", cls: "yes" },
  { v: "maybe", label: "Duda", cls: "du" },
  { v: "no", label: "No voy", cls: "no" },
];

function Seg({ me, matchId, answer, label }: { me: Me; matchId: string; answer: Answer | ""; label: string }) {
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
  return (
    <>
      <div className="pl-seg pl-rsvp-seg" role="group" aria-label={label}>
        {OPTIONS.map((o) => (
          <button key={o.v} type="button" className={answer === o.v ? `on ${o.cls}` : o.cls} aria-pressed={answer === o.v} disabled={busy} onClick={() => pick(o.v)}>
            {answer === o.v && (
              <span aria-hidden="true" className="mk">
                {o.v === "yes" ? "✓" : o.v === "maybe" ? "?" : "✕"}
              </span>
            )}
            {o.label}
          </button>
        ))}
      </div>
      {failed && (
        <p className="pl-rsvp-err" role="alert">
          No se ha guardado. Prueba otra vez.
        </p>
      )}
    </>
  );
}

/** The previa's «Tu porra»: before kick-off his saved score (or none yet) and the form behind «Ponerla» /
 *  «Cambiarla»; after it, read-only «Tu porra: 2–1» (nothing when he didn't play it). */
export function PorraRow({ match }: { match: ClubMatch }) {
  const me = useMe();
  const { players } = useClubData();
  const saved = useMyPrediction(match.id, me?.uid);
  const [editing, setEditing] = useState(false);
  const formId = useId();
  if (!me) return null;
  const open = predictionOpen(match);
  const score = saved.data ? `${saved.data.goalsFor}–${saved.data.goalsAgainst}` : "";
  if (!open) {
    if (!score) return null;
    return (
      <p className="vp-porra">
        <b>Tu porra: {score}</b>
        <span className="vp-sub">Cerrada desde el pitido.</span>
      </p>
    );
  }
  return (
    <div className="vp-porra">
      <p className="vp-porra__row">
        <b>{score ? `Tu porra: ${score}` : saved.loading ? "Tu porra…" : "Tu porra, sin poner"}</b>
        <span className="vp-sub">Solo tú la ves hasta el pitido.</span>
      </p>
      <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" aria-expanded={editing} aria-controls={formId} onClick={() => setEditing((v) => !v)}>
        {editing ? "Cerrar la porra" : score ? "Cambiarla" : "Ponerla"}
      </button>
      {editing && (
        <div id={formId} className="vp-porra__form">
          <PredictionForm match={match} players={players} uid={me.uid} />
        </div>
      )}
    </div>
  );
}

/** The previa's Voy / Duda / No voy, only on upcoming matches where the member is called. */
export function RowRsvp({ match, j }: { match: ClubMatch; j?: number }) {
  const me = useMe();
  const answer = useMyAnswer(match.id, me?.uid);
  if (!me || !isCalled(match, me.playerId)) return null;
  return (
    <div className="pl-rsvp">
      <span className="q" aria-hidden="true">
        ¿Vas?
      </span>
      <Seg me={me} matchId={match.id} answer={answer} label={`¿Vas a la jornada ${j ?? ""} contra ${match.rival ?? "el rival"}?`.replace("  ", " ")} />
    </div>
  );
}
