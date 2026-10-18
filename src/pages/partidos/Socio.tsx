// The member's own bits of Partidos, in their own chunk: a fan never loads it and the server never renders it
// (the page mounts it only once hydrated and only for a member, useViewer). Each member reads and writes only
// his own answer (matchPrivate/{id}/availability/{uid}): no one else's answers, no counts, here or anywhere
// a fan could see. Voy / Duda / No voy write through the vestuario's setAvailability.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ClubMatch } from "../../lib/clubData";
import { setAvailability, useMe, type Me } from "../vestuario/writes";
import { useLiveDoc } from "../vestuario/live";
import { debutIn, isCalled } from "./model";

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

/** A calendar row's one-line Voy / Duda / No voy, only on upcoming matches where the member is called. */
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

const ANSWER_LINE: Record<Answer | "", string> = { yes: "Vas", maybe: "Dudas", no: "No vas", "": "Aún no has dicho si vas" };

/** The plinth's member line: his answer (before the match), «Debut» or the MVP vote (after the acta). */
export function SocioLine({ match, phase, all }: { match: ClubMatch; phase: string; all: readonly ClubMatch[] }) {
  const me = useMe();
  const answer = useMyAnswer(match.id, me?.uid);
  if (!me) return null;
  if (phase === "acta") {
    const debut = debutIn(match, all, me.playerId);
    return (
      <div className="pl-me">
        <span className="ic" aria-hidden="true">
          ★
        </span>
        <span className="t">{debut ? `Has desbloqueado «Debut»: jugaste ${debut.minutes} minutos.` : "La votación del MVP está abierta."}</span>
        <Link className="a" to="/matches/$matchId" params={{ matchId: match.id }}>
          {debut ? "Ver el acta" : "Votar al MVP"}
        </Link>
      </div>
    );
  }
  if (!["semana", "antes", "pitido", "despues"].includes(phase) || !isCalled(match, me.playerId)) return null;
  const seven = match.starters?.includes(me.playerId ?? "") ?? false;
  return (
    <div className="pl-me">
      <span className="ic" aria-hidden="true">
        {answer === "yes" ? "✓" : answer === "no" ? "✕" : "?"}
      </span>
      <span className="t">
        {ANSWER_LINE[answer]}
        {answer === "yes" && seven ? ", y juegas de inicio." : "."}
      </span>
      <Seg me={me} matchId={match.id} answer={answer} label={`¿Vas contra ${match.rival ?? "el rival"}?`} />
    </div>
  );
}
