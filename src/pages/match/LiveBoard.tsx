// The live scoreboard card of the match page (canvas «Lo que ve la afición»): a lit card with the half and
// the clock, both crests with their names, the score on flip tiles, and the last play on a broadcast strap.
// A goal of ours arriving live flips its tile, rings it in gold and sweeps the card (useGoalCelebration
// decides when); reduced motion leaves the end state.
import { useState, type ReactNode } from "react";
import { clockLabel, clockReading, timeText } from "../../../functions/src/matchClock";
import type { ClubMatch } from "../../lib/clubData";
import type { LastEvent } from "../../lib/derived/scoreboard";
import { useClock } from "../../hooks/useClock";
import { Icon } from "../../components/celeste/icons";
import { agoText } from "./directoModel";

/** One digit tile: the halves of the number and, while `flip`, the old number falling over the new one. */
function Tile({ value, flip, gold }: { value: number; flip: boolean; gold: boolean }) {
  // the number shown before this one: the old half that falls
  const [shown, setShown] = useState({ value, prev: value });
  if (shown.value !== value) setShown({ value, prev: shown.value });
  const prev = shown.value !== value ? shown.value : shown.prev;
  const d = String(value);
  return (
    <span className={`ml-tile${gold ? " gold" : ""}`}>
      <span className="ml-hu" data-d={d} />
      <span className="ml-hl" data-d={d} />
      {flip && prev !== value && (
        <>
          <span className="ml-hl old" data-d={String(prev)} />
          <span className="ml-fb" data-d={d} />
          <span className="ml-fa" data-d={String(prev)} />
        </>
      )}
    </span>
  );
}

/** «1ª parte 18:59», «Descanso 4:10», ticking every second; «En directo 19′» without a clock. */
function LivePill({ match, minute }: { match: Pick<ClubMatch, "clock">; minute: number | null }) {
  const now = useClock(1000);
  if (!match.clock) return <span className="ml-pill"><i aria-hidden="true" />En directo<span className="ck">{minute ?? 0}′</span></span>;
  const r = clockReading(match.clock, now);
  const held = typeof match.clock.heldAt === "number";
  const added = match.clock.added?.[r.period];
  const label = held ? "Pausa" : clockLabel(match.clock);
  return (
    <span className={`ml-pill${held || r.phase === "halftime" ? " cold" : ""}`}>
      <i aria-hidden="true" />
      {label}
      <span className="ck">{r.phase === "halftime" ? timeText(r.breakSeconds) : timeText(r.elapsedSeconds)}</span>
      {added ? <span className="ck">+{added}′</span> : null}
    </span>
  );
}

/** «Abrir la mesa»: la mesa of this match, for its scorers and the admins. */
export function MesaKey({ matchId, className = "", wide = false }: { matchId: string; className?: string; wide?: boolean }) {
  // (a plain link until the mesa's route is in the router tree: the cut-over makes it a typed <Link>)
  return (
    <a className={`ml-pb ${className}`.trim()} href={`/matches/${encodeURIComponent(matchId)}/mesa`} aria-label="Abrir la mesa, para anotadores">
      Abrir la mesa{wide && <small aria-hidden="true">para anotadores</small>}
      <i aria-hidden="true">
        <Icon name="arrow" size={16} stroke={2.4} />
      </i>
    </a>
  );
}

export interface LiveCardProps {
  match: ClubMatch;
  rival: string;
  initials: string;
  gf: number;
  ga: number;
  /** The live minute shown (no clock: the schedule's). */
  minute: number | null;
  last: LastEvent | null;
  /** The last play's own event, for «hace N s». */
  lastAt?: { elapsedSeconds?: number };
  /** «Jornada 7», or "". */
  jornada: string;
  /** A fresh goal is being shown: its side. */
  goal: { ours: boolean; n: number } | null;
  /** The ¡GOL! burst and the sync chip, as the page already draws them. */
  children?: ReactNode;
  /** «Abrir la mesa» in the card's top row (a phone; the desktop has it under the title). */
  mesa?: boolean;
  /** Played, acta pending: the pill says so and nothing ticks. */
  pending?: boolean;
}

export function LiveCard({ match, rival, initials, gf, ga, minute, last, lastAt, jornada, goal, children, mesa = false, pending = false }: LiveCardProps) {
  const now = useClock(1000);
  const flip = !!goal;
  const ours = !!goal?.ours;
  const tone = last?.tone === "gold" ? "g" : last?.tone === "coral" ? "r" : "";
  const ago = pending ? "" : agoText(match, lastAt, now);
  return (
    <section className={`ml-card pt-rise${ours ? " g" : ""}`} aria-label={pending ? `Marcador provisional contra ${rival}` : `Marcador en directo contra ${rival}`} style={{ animationDelay: ".15s" }}>
      <div className="ml-ct">
        {pending ? (
          <span className="ml-pill cold">
            <i aria-hidden="true" />
            Final · acta pendiente
          </span>
        ) : (
          <LivePill match={match} minute={minute} />
        )}
        {mesa ? (
          <>
            <MesaKey matchId={match.id} className="ml-key" />
            {jornada && <span className="ml-jor dk">{jornada}</span>}
          </>
        ) : (
          jornada && <span className="ml-jor">{jornada}</span>
        )}
      </div>
      <div className="ml-teams">
        <div className="ml-tm">
          <span className="ml-crest" aria-hidden="true">
            <img src="/crest-128.webp" alt="" />
          </span>
          <b>Manchester Piti</b>
        </div>
        <div className="ml-dg" role="img" aria-label={`Manchester Piti ${gf}, ${rival} ${ga}`}>
          <Tile value={gf} flip={flip && ours} gold={ours} />
          <Tile value={ga} flip={flip && !ours} gold={false} />
        </div>
        <div className="ml-tm r">
          <span className="ml-crest r" aria-hidden="true">
            {match.rivalLogoUrl ? <img src={match.rivalLogoUrl} alt="" /> : initials}
          </span>
          <b>{rival}</b>
        </div>
      </div>
      <div className={`ml-now${ours ? " gl" : ""}`} role="status" aria-live="polite">
        <span className={`kk${tone ? ` ${tone}` : ""}`}>{last ? last.tag : pending ? "FINAL" : "EN JUEGO"}</span>
        <span className={`bar${tone ? ` ${tone}` : ""}`}>
          <span className="ml-lp" key={last?.id ?? "none"}>
            <span className="t">
              <b>{last ? (last.tone === "gold" ? `¡${last.title}!` : last.title) : pending ? "Pendiente del acta" : "Arranca el partido"}</b>
              <small>{last ? last.sub || last.label : pending ? "El marcador es provisional hasta que se publique" : "La mesa lo apunta todo, y aquí sale solo"}</small>
            </span>
            <span className="m">
              {last ? `${last.minute}′` : minute != null ? `${minute}′` : ""}
              {ago && <em>{ago}</em>}
            </span>
          </span>
        </span>
      </div>
      {children}
      {ours && <span className="ml-sweep" aria-hidden="true" key={goal?.n} />}
    </section>
  );
}
