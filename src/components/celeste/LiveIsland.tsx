// The live island: while a match is being played, a pill at the top of every page with the score and
// the minute; tap it and it opens into the scoreboard with the last thing that happened. Hidden on that
// match's own page, which already is the scoreboard.
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { matchPhase, playerName, useClubData } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";
import { lastEvent, liveMinute, scoreOf } from "../../lib/partidos";
import { opponentInitials } from "../../lib/clubAnalytics";
import { Flip } from "./Flip";
import { Icon } from "./icons";
import "../../styles/partidos.css";

export function LiveIsland() {
  const { matches, players } = useClubData();
  const now = useClock(15_000);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const live = matches.find((m) => matchPhase(m, now) === "playing");
  const shown = !!live && pathname !== `/matches/${live.id}`;
  // The heroes make room for the pill while it is on screen (styles: html[data-isle]).
  useEffect(() => {
    if (!shown) return;
    document.documentElement.dataset.isle = "";
    return () => {
      delete document.documentElement.dataset.isle;
    };
  }, [shown]);
  if (!live || !shown) return null;

  const { gf, ga } = scoreOf(live);
  const rival = live.rival ?? "Rival";
  const ini = live.rivalInitials || opponentInitials(rival);
  const minute = liveMinute(live, now);
  const nameOf = (id: string) => playerName(players.find((p) => p.id === id));
  const last = lastEvent(live.events, nameOf, rival);
  const pct = `${Math.min(100, ((minute ?? 0) / (live.duration ?? 50)) * 100)}%`;
  const label = `En directo: Manchester Piti ${gf}, ${rival} ${ga}, minuto ${minute ?? 0}`;

  return (
    <div className="pt-isle-wrap">
      {open ? (
        <div className="pt-isle open" role="region" aria-label={label}>
          <div className="pt-act">
            <div className="row">
              <span className="tm">
                <img src="/crest-128.webp" alt="" />
                PITI
              </span>
              <span className="sc" aria-hidden="true">
                <Flip value={gf} />
                <Flip value={ga} />
              </span>
              <span className="tm">
                <i>{ini}</i>
                {rival}
              </span>
            </div>
            <span className="bar">
              <i style={{ width: pct }} />
            </span>
            <span className="ev">
              <span className="pt-dot" />
              {minute}′{last ? ` · ${last.who} · ${last.label}` : " · en juego"}
            </span>
            <span className="go">
              <Link to="/matches/$matchId" params={{ matchId: live.id }}>
                Seguir en directo <Icon name="arrow" size={15} stroke={2.2} />
              </Link>
              <button type="button" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </span>
          </div>
        </div>
      ) : (
        <button type="button" className="pt-isle" onClick={() => setOpen(true)} aria-expanded="false" aria-label={`${label}. Abrir el marcador`}>
          <span className="s">
            <img src="/crest-128.webp" alt="" />
            <span>
              {gf}–{ga} {ini}
            </span>
          </span>
          <span className="m">
            <span className="pt-dot" />
            {minute}′
          </span>
        </button>
      )}
    </div>
  );
}
