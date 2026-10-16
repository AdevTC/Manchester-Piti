// Tras el partido: the reaction bar under each crónica moment, the «Nota del vestuario» line of the crónica
// and the 1–5 nota in the Vestuario tab. Counts and the average are public; only a member (`me`) writes.
// Pure logic and windows: lib/derived/trasElPartido; the docs come from one listener per subcollection,
// opened by the match page (vestuario/live useMatchReactions / useMatchRatings).
import { useState } from "react";
import { formatNota, momentsFull, momentTally, nextMoments, notaLine, ratingSummary, votesText, whoReacted, type RatingDoc, type RatingWindow, type ReactionDoc, type ReactionId } from "../../lib/derived/trasElPartido";
import { rateMatch, setReactions, unrateMatch, type Me } from "../vestuario/writes";
import "./trasElPartido.css";

const EMPTY: Record<string, ReactionId> = {};

/** The reactions under one crónica moment. `me` null: a fan (or nobody signed in) sees the counts only. */
export function ReactionBar({ matchId, momentId, label, docs, me }: { matchId: string; momentId: string; label: string; docs: readonly ReactionDoc[]; me: Me | null }) {
  const [shown, setShown] = useState<ReactionId | null>(null);
  const [error, setError] = useState("");
  const tally = momentTally(docs, momentId, me?.uid);
  const mineAll = (me && docs.find((d) => d.uid === me.uid)?.moments) || EMPTY;
  const full = !!me && momentsFull(mineAll, momentId);
  const total = tally.reduce((s, r) => s + r.count, 0);
  // A fan sees nothing where nobody reacted yet (an empty bar says nothing to him).
  if (!me && total === 0) return null;
  const react = (id: ReactionId) => {
    setShown(id);
    if (!me) return;
    if (full) {
      setError("Ya has reaccionado a 30 momentos de este partido: quita alguna para reaccionar a este.");
      return;
    }
    setError("");
    setReactions(me, matchId, nextMoments(mineAll, momentId, id)).catch(() => setError("No se ha guardado tu reacción. Inténtalo otra vez."));
  };
  const who = tally.find((r) => r.id === shown && r.count > 0);
  return (
    <div className="tp-bar">
      <div className="tp-rs" role="group" aria-label={`Reacciones · ${label}`} onMouseLeave={() => setShown(null)}>
        {tally.map((r) => {
          const people = r.count ? `: ${whoReacted(r.names)}` : "";
          return (
            <button
              key={r.id}
              type="button"
              className={`tp-r${r.mine ? " mine" : ""}${me ? "" : " ro"}`}
              aria-pressed={me ? r.mine : undefined}
              aria-label={`${r.word}, ${r.count}${r.mine ? ", la tuya" : ""}${people}`}
              onClick={() => react(r.id)}
              onMouseEnter={() => setShown(r.id)}
              onFocus={() => setShown(r.id)}
              onBlur={() => setShown(null)}
            >
              <span className="em" aria-hidden="true">
                {r.emoji}
              </span>
              <span className="wd" aria-hidden="true">
                {r.word}
              </span>
              <b aria-hidden="true">{r.count}</b>
              {r.mine && (
                <small className="tu" aria-hidden="true">
                  Tú
                </small>
              )}
            </button>
          );
        })}
      </div>
      {/* (hover, focus or tap: who reacted so) */}
      <p className="tp-who" aria-hidden="true">
        {who ? `${who.emoji} ${whoReacted(who.names)}` : ""}
      </p>
      {error && (
        <p className="tp-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** «Nota del vestuario: 4,2 · 11 votos» in the crónica's header; nothing without votes. */
export function NotaLine({ ratings }: { ratings: readonly RatingDoc[] }) {
  const line = notaLine(ratingSummary(ratings));
  return line ? <p className="tp-nota">{line}</p> : null;
}

const STARS = [1, 2, 3, 4, 5] as const;
const DAY = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
const TIME = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** The member's nota (Vestuario tab): a 1–5 radio group while it is open, the frozen average afterwards. */
export function NotaCard({ matchId, ratings, me, slot }: { matchId: string; ratings: readonly RatingDoc[]; me: Me; slot: RatingWindow }) {
  const [error, setError] = useState("");
  if (slot.state === "none") return null;
  const summary = ratingSummary(ratings);
  const mine = ratings.find((r) => r.uid === me.uid)?.score ?? null;
  if (slot.state === "closed")
    return (
      <section className="fc-sec" aria-labelledby="tp-nota-h">
        <span className="hm-kick">La nota del partido · cerrada</span>
        <h2 className="hm-h2" id="tp-nota-h">
          {summary.average === null ? "Nadie le puso nota" : `La nota quedó en ${formatNota(summary.average)}`}
        </h2>
        {summary.average !== null && (
          <p className="fc-note">
            {votesText(summary.count)} del vestuario{mine !== null ? ` · tú le pusiste un ${mine}` : ""}.
          </p>
        )}
      </section>
    );
  const save = (score: number) => {
    setError("");
    rateMatch(me, matchId, score).catch(() => setError("No se ha guardado tu nota. Inténtalo otra vez."));
  };
  const remove = () => {
    setError("");
    unrateMatch(me, matchId).catch(() => setError("No se ha quitado tu nota. Inténtalo otra vez."));
  };
  return (
    <section className="fc-sec" aria-labelledby="tp-nota-h">
      <span className="hm-kick">
        La nota del partido · hasta el {DAY.format(slot.closesAt)} a las {TIME.format(slot.closesAt)}
      </span>
      <h2 className="hm-h2" id="tp-nota-h">
        ¿Qué nota le pones al partido?
      </h2>
      <div className="tp-stars" role="radiogroup" aria-labelledby="tp-nota-h">
        {STARS.map((n) => (
          <label key={n} className={`tp-star${mine !== null && n <= mine ? " on" : ""}`}>
            <input type="radio" name={`tp-nota-${matchId}`} value={n} checked={mine === n} onChange={() => save(n)} aria-label={`${n} de 5`} />
            <span className="st" aria-hidden="true">
              {mine !== null && n <= mine ? "★" : "☆"}
            </span>
            <b aria-hidden="true">{n}</b>
          </label>
        ))}
      </div>
      <p className="fc-note" aria-live="polite">
        {summary.average === null ? "Aún nadie ha puesto nota." : notaLine(summary) + "."}
        {mine !== null && ` Tu nota: ${mine}.`}
      </p>
      {mine !== null && (
        <button type="button" className="tp-undo" onClick={remove}>
          Quitar mi nota
        </button>
      )}
      {error && (
        <p className="tp-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
