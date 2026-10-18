// «La primera fila»: the front row of CDM Palomeras' main stand, seen from the pitch, under Inicio's hero.
// Before the match each seat carries a member's answer to the convocatoria (fans: the published convocados
// and the seven only); during it, the bench; after it, who played, the logros and the MVP vote. Pure
// presentation of a FrontRow (derived/frontRow) plus the member's own two actions: his answer
// (setAvailability, optimistic, rolled back with a message) and his MVP vote (voteMvp).
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState, type CSSProperties } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import type { FrontRow } from "../../../lib/derived/frontRow";
import type { MatchdayModel, ViewerRole } from "../../../lib/derived/matchday";
import type { LightKey } from "../../../lib/derived/sun";
import { endSentence } from "../../../lib/derived/words";
import { setAvailability, voteMvp, type Me } from "../../../pages/vestuario/writes";
import { buzz, playClac, primeClac, readClacPref, writeClacPref } from "./clac";
import { filaView, withAnswer, type Answer, type FilaStatus, type SeatView } from "./view";
import { changesOf, NO_CHANGE, snapKey, snapOf, type Change, type Snap } from "./changes";
import "./primeraFila.css";

export type { Answer, FilaStatus } from "./view";

export interface PrimeraFilaProps {
  /** frontRowOf(…) for this match day and viewer (fans: answers null → no answers, no counts). */
  row: FrontRow;
  /** matchdayOf(…): the phase, its match, the next one, the minute and the score. */
  day: Pick<MatchdayModel, "phase" | "match" | "next" | "minute" | "added" | "score">;
  /** viewerRoleOf(…). */
  viewer: ViewerRole;
  /** lightOf(sunPosition(now).elevation): the hour's light on the stand (the page theme does the rest). */
  light: LightKey;
  /** useMe(): the signed-in member (null: a fan, or not known yet). */
  me: Me | null;
  /** This member's answer to the convocatoria, from the host's useAvailability (null: none). */
  myAnswer?: Answer | null;
  /** This member's MVP vote, from useMyMvpVote(match.id, uid).data ("" none). */
  myVote?: string;
  /** The server's clock (useNow): the convocatoria closes at kickoff. */
  now: number;
  /** The member data's state: loading → a skeleton where the controls go; error → «Reintentar»; offline →
   *  «Sin actualizar desde hace…» (with `staleSince`). */
  status?: FilaStatus;
  staleSince?: number | null;
  onRetry?: () => void;
  /** Force reduced motion (prefers-reduced-motion is honoured anyway). */
  reduced?: boolean;
  className?: string;
}

const SEG: { value: Answer; cls: string; glyph: string; label: string }[] = [
  { value: "yes", cls: "v", glyph: "✓", label: "Voy" },
  { value: "maybe", cls: "d", glyph: "?", label: "Duda" },
  { value: "no", cls: "n", glyph: "✕", label: "No voy" },
];

interface Track {
  key: string;
  snap: Snap;
  change: Change;
  said: string;
}

export function PrimeraFila(props: PrimeraFilaProps) {
  const { day, viewer, light, me, now, status = "ok", staleSince, onRetry, reduced, className } = props;
  const uid = useId();
  const match: ClubMatch | null = day.match;
  const [pendingAnswer, setPendingAnswer] = useState<Answer | null>(null);
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(readClacPref);
  const answer = pendingAnswer ?? props.myAnswer ?? null;
  const vote = pendingVote ?? props.myVote ?? "";
  const row = withAnswer(props.row, pendingAnswer);

  // What changed since the last look: who answered, who came on, who walked off. Tracked during render (the
  // React pattern for state derived from props), so the seat animates and the change is said only once.
  const key = snapKey(row);
  const [track, setTrack] = useState<Track>(() => ({ key, snap: snapOf(row), change: NO_CHANGE, said: "" }));
  if (track.key !== key) {
    const change = changesOf(track.snap, row);
    setTrack({ key, snap: snapOf(row), change, said: change.said || track.said });
  }
  const change = track.change;
  useEffect(() => {
    if (change === NO_CHANGE) return;
    if (change.clac && sound) playClac();
    const t = setTimeout(() => setTrack((s) => (s.change === change ? { ...s, change: NO_CHANGE } : s)), 2200);
    return () => clearTimeout(t);
  }, [change, sound]);

  const say = (said: string) => setTrack((s) => ({ ...s, said }));
  const view = filaView({ row, day, viewer, light, memberName: me?.name ?? null, vote, status, now });

  const respond = (value: Answer) => {
    if (!me || !match || value === answer) return;
    buzz(10);
    if (sound) {
      primeClac();
      playClac();
    }
    setError("");
    setPendingAnswer(value);
    setAvailability(me, match.id, value).then(
      () => setPendingAnswer((p) => (p === value ? null : p)),
      () => {
        setPendingAnswer((p) => (p === value ? null : p));
        const msg = "No se ha guardado tu respuesta. Vuelve a intentarlo.";
        setError(msg);
        say(msg);
      },
    );
  };
  const pick = (s: SeatView) => {
    if (!me || !match || s.seat.playerId === vote) return;
    buzz(12);
    setError("");
    setPendingVote(s.seat.playerId);
    say(endSentence(`Tu voto, para ${s.seat.name}`));
    voteMvp(me, match.id, s.seat.playerId).then(
      () => setPendingVote((p) => (p === s.seat.playerId ? null : p)),
      () => {
        setPendingVote((p) => (p === s.seat.playerId ? null : p));
        const msg = "No se ha guardado tu voto. Vuelve a intentarlo.";
        setError(msg);
        say(msg);
      },
    );
  };
  const toggleSound = () => {
    const on = !sound;
    if (on) primeClac();
    setSound(on);
    writeClacPref(on);
  };

  const half = Math.ceil(view.seats.length / 2);
  const rows = [view.seats.slice(0, half), view.seats.slice(half)].filter((r) => r.length > 0);
  const rowLabel = (r: SeatView[]) => (r.length ? `Asientos, dorsales ${r[0].seat.dorsal} a ${r[r.length - 1].seat.dorsal}` : "");
  const staleMin = typeof staleSince === "number" ? Math.max(1, Math.round((now - staleSince) / 60_000)) : null;
  const lag = props.row.mode === "banquillo" ? "El banquillo puede ir con retraso." : props.row.mode === "convocatoria" ? "Las respuestas pueden ir con retraso." : "Lo que ves puede ir con retraso.";
  const rootCls = ["pf-root", `pf-l-${view.light}`, `pf-m-${props.row.mode}`, view.marksOn ? "pf-mkon" : "", reduced ? "pf-rm" : "", className ?? ""].filter(Boolean).join(" ");

  return (
    <section className={rootCls} aria-labelledby={`${uid}-h`} style={{ "--pf-half": half } as CSSProperties}>
      <div className="pf-in">
        <div className="pf-head">
          <div className="pf-ht">
            <h2 className="pf-h2" id={`${uid}-h`}>
              {view.title}
            </h2>
            {view.lead && <p className="pf-lead">{view.lead}</p>}
          </div>
          {view.counts && (
            <ul className="pf-counts" aria-label="Respuestas de la plantilla">
              {view.counts.map((c) => (
                <li key={c.cls || "v"} className={`pf-cnt${c.cls ? ` ${c.cls}` : ""}`}>
                  <i aria-hidden="true">{c.glyph}</i>
                  {c.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pf-stand">
          <div className="pf-up" aria-hidden="true" />
          {view.tape && (
            <div className="pf-tape" aria-hidden="true">
              <span>Aplazado</span>
              <span>Aplazado</span>
            </div>
          )}
          <div className="pf-rows">
            {rows.map((r, i) => (
              <ol key={i} className="pf-row" aria-label={rowLabel(r)}>
                {r.map((s) => (
                  <SeatItem key={s.seat.playerId} s={s} anim={change.anim[s.seat.playerId]} voted={view.vote !== null && s.seat.playerId === vote} marksOn={view.marksOn} onPick={pick} />
                ))}
              </ol>
            ))}
          </div>
          <div className="pf-rail" aria-hidden="true" />
        </div>

        {status === "loading" && (
          <div className="pf-foot">
            <div className="pf-skel" aria-hidden="true" />
            <p className="pf-note">
              <span>Comprobando quién eres para enseñarte tu asiento…</span>
            </p>
          </div>
        )}

        {view.canAnswer && (
          <div className="pf-foot pf-me">
            <div className="pf-me-t">
              <b>{view.meTitle}</b>
              <span>{view.meText}</span>
            </div>
            <div className="pf-ctl">
              <div className="pf-seg" role="group" aria-label="Tu respuesta a la convocatoria">
                {SEG.map((o) => (
                  <button key={o.value} type="button" className={`pf-seg-b ${o.cls}`} aria-pressed={answer === o.value} onClick={() => respond(o.value)}>
                    <i aria-hidden="true">{o.glyph}</i>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="pf-sub">
                <button type="button" className="pf-tg" aria-pressed={sound} title="Sonido del clac al llegar una respuesta" onClick={toggleSound}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 9h4l5-4v14l-5-4H4z" />
                    <path d="M17 9a4 4 0 010 6" />
                  </svg>
                  <span className="pf-sr">Sonido del </span>clac
                </button>
              </div>
            </div>
          </div>
        )}

        {view.note && (
          <div className="pf-foot">
            <p className="pf-note">
              <InfoIcon />
              <span>{view.note}</span>
            </p>
            {view.link?.kind === "vestuario" && (
              <Link className="pf-a" to="/vestuario">
                {view.link.text}
              </Link>
            )}
            {view.link?.kind === "ausencias" && (
              <Link className="pf-a" to="/vestuario" hash="vx-ausencias">
                {view.link.text}
              </Link>
            )}
          </div>
        )}

        {(view.plays.length > 0 || view.liveNote || view.meLive) && (
          <div className="pf-foot">
            <div className="pf-me-t">
              {view.plays.length > 0 && (
                <ul className="pf-plays" aria-label="Lo último del banquillo">
                  {view.plays.map((p, i) => (
                    <li key={i} className="pf-play">
                      <span className="m">{p.minute}</span>
                      <span>{p.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {view.liveNote && <span>{view.liveNote}</span>}
              {view.meLive && (
                <span>
                  <b>{view.meLive}</b>
                </span>
              )}
            </div>
          </div>
        )}

        {view.vote && (
          <div className="pf-foot">
            <div className="pf-votebox">
              <span className="pf-vb-ic" aria-hidden="true">
                {vote ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11V5.5a1.5 1.5 0 013 0V10" />
                    <path d="M12 10V8.5a1.5 1.5 0 013 0V11" />
                    <path d="M15 11a1.5 1.5 0 013 0v3a7 7 0 01-7 7h-.5a6 6 0 01-4.8-2.4L4 15.5a1.6 1.6 0 012.5-2L9 16V11" />
                  </svg>
                )}
              </span>
              <span className="pf-vb-t">
                <b>{view.vote.title}</b>
                <span>{view.vote.text}</span>
              </span>
            </div>
          </div>
        )}

        {view.endNote && (
          <div className="pf-foot">
            <p className="pf-note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M8 4h8v5a4 4 0 01-8 0z" />
                <path d="M12 13v4M9 20h6" />
              </svg>
              <span>{view.endNote}</span>
            </p>
          </div>
        )}

        {error && (
          <div className="pf-foot">
            <p className="pf-note pf-err">
              <WarnIcon />
              <span>{error}</span>
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="pf-foot">
            <p className="pf-note">
              <WarnIcon />
              <span>
                <b>{props.row.mode === "convocatoria" ? "No ha llegado la convocatoria." : "No han llegado los datos del partido."}</b> Lo que ves puede no estar al día.
              </span>
            </p>
            {onRetry && (
              <button type="button" className="pf-btn" onClick={onRetry}>
                Reintentar
              </button>
            )}
          </div>
        )}

        {status === "offline" && (
          <div className="pf-foot">
            <p className="pf-note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M2 8a15 15 0 0120 0M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0M3 3l18 18" />
              </svg>
              <span>
                <b>{staleMin ? `Sin actualizar desde hace ${staleMin} min.` : "Sin conexión."}</b> {lag}
              </span>
            </p>
          </div>
        )}

        <p className="pf-sr" role="status" aria-live="polite">
          {track.said}
        </p>
      </div>
    </section>
  );
}

function SeatItem({ s, anim, voted, marksOn, onPick }: { s: SeatView; anim: string | undefined; voted: boolean; marksOn: boolean; onPick: (s: SeatView) => void }) {
  const cls = ["pf-seat", s.pose, s.dim ? "dim" : "", s.gold ? "gold" : "", s.mvp ? "mvp" : "", s.no ? "no" : "", s.seat.mine ? "me" : "", voted ? "cand" : "", anim ?? ""].filter(Boolean).join(" ");
  return (
    <li className={cls} aria-label={s.aria}>
      {marksOn && (
        <span className="pf-mks" aria-hidden="true">
          {s.marks.map((m, i) => (
            <i key={i} className={`pf-mk ${m.cls}`}>
              {m.short ? (
                <>
                  <span className="pf-mk-l">{m.text}</span>
                  <span className="pf-mk-s">{m.short}</span>
                </>
              ) : (
                m.text
              )}
            </i>
          ))}
        </span>
      )}
      <span className="pf-sbox" aria-hidden="true">
        <span className="pf-sh" />
        <span className="pf-bk" />
        <span className="pf-pan" />
        <span className="pf-card">
          {s.crest && <img src="/crest-128.webp" alt="" width="128" height="128" loading="lazy" decoding="async" />}
          {s.face && <b>{s.face}</b>}
          {s.sub && <small>{s.sub}</small>}
        </span>
      </span>
      <span className="pf-pl" aria-hidden="true">
        {s.seat.dorsal}
      </span>
      <span className="pf-nm" aria-hidden="true">
        {s.seat.name}
        {s.seat.mine && <em>tú</em>}
      </span>
      {s.votable && <button type="button" className="pf-vote" aria-label={`Votar a ${s.seat.name} como mejor del partido`} aria-pressed={voted} onClick={() => onPick(s)} />}
    </li>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </svg>
  );
}
