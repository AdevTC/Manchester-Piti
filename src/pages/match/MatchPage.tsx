// Ficha de partido (Celeste): the stadium board on top (final score, live score with ¡GOL!, or the
// countdown), then tabs — Crónica/Previa/Directo · Campo · Pulso · Vestuario. From the Design canvas
// page "Partidos · elegida"; pure logic in lib/ficha.ts and lib/partidos.ts.
import { useState, type ReactNode } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { isCompleted, matchPhase, playerName, useClubData, dateMillis, type ClubMatch } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { Flip } from "../../components/celeste/Flip";
import { GoalBurst } from "../../components/celeste/GoalBurst";
import { opponentInitials } from "../../lib/clubAnalytics";
import { matchEvent } from "../../lib/home";
import { countdownParts, dateParts, lastEvent, liveMinute, resultOf, scoreOf, seasonView } from "../../lib/partidos";
import { shareClubPage } from "../../lib/share";
import { downloadMatchPoster } from "../../lib/matchPoster";
import { CampoTab, CronicaTab, DirectoTab, PreviaTab, PulsoTab, VestuarioTab } from "./Tabs";
import "../../styles/home.css";
import "../../styles/partidos.css";
import "../../styles/ficha.css";

const origin = () => (typeof location === "undefined" ? "" : location.origin);
const mapsUrl = (venue: string) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(venue);
const GOAL = /^goal/;

function Countdown({ target }: { target: number }) {
  const now = useClock(1000);
  const c = countdownParts(target, now);
  return (
    <div className="pt-cd" role="timer" aria-label={`Faltan ${Number(c.d)} días, ${Number(c.h)} horas y ${Number(c.m)} minutos`}>
      {(
        [
          [c.d, "DÍAS"],
          [c.h, "HORAS"],
          [c.m, "MIN"],
          [c.s, "SEG"],
        ] as const
      ).map(([v, l]) => (
        <div key={l}>
          <Flip value={v} />
          <small>{l}</small>
        </div>
      ))}
    </div>
  );
}

/** The headline of the page, by moment. */
function headline(m: ClubMatch, phase: string, nameOf: (id: string) => string) {
  const rival = m.rival ?? "el rival";
  if (phase === "playing") return `Se juega contra ${rival}`;
  if (!isCompleted(m)) return m.home === false ? `Toca ${rival}, a domicilio` : `Toca ${rival}, en casa`;
  const { gf, ga } = scoreOf(m);
  const count = new Map<string, number>();
  for (const e of m.events ?? []) if (GOAL.test(e.type) && e.playerId) count.set(e.playerId, (count.get(e.playerId) ?? 0) + 1);
  const [top] = [...count.entries()].sort((a, b) => b[1] - a[1]);
  const verdict = gf > ga ? "victoria" : gf === ga ? "empate" : "derrota";
  if (top && top[1] >= 2) return `${top[1] >= 3 ? "Hat-trick" : "Doblete"} de ${nameOf(top[0])} y ${verdict} ${gf}–${ga}`;
  return `${verdict.charAt(0).toUpperCase() + verdict.slice(1)} ${gf}–${ga} ante ${rival}`;
}

export function MatchPage() {
  const { matchId } = getRouteApi("/matches/$matchId").useParams();
  const { matches, players, loading } = useClubData();
  const now = useClock(15_000);
  const [tab, setTab] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const match = matches.find((m) => m.id === matchId);
  const nameOf = (id: string) => playerName(players.find((p) => p.id === id));

  const chrome = (children: ReactNode) => (
    <div className="vx hm pt" aria-busy={loading}>
      <CelesteBackdrop />
      <CelesteHeader
        active="partidos"
        sub="Partido"
        actions={
          <>
            <ThemeToggle />
            <Link className="hm-cta-top" to="/vestuario">
              <Icon name="padlock" size={16} stroke={2.2} />
              <span className="t">Vestuario</span>
              <span className="hm-sr">Entrar al vestuario</span>
            </Link>
          </>
        }
      />
      {children}
      <CelesteFooter />
      <CelesteDock active="partidos" />
    </div>
  );

  if (loading) return chrome(<section className="pt-hero" aria-label="Cargando el partido" style={{ minHeight: "100svh" }} />);
  if (!match)
    return chrome(
      <section className="pt-hero">
        <div className="pt-hero-in">
          <h1 className="pt-h1">Partido no encontrado</h1>
          <Link className="hm-btn" to="/partidos">
            Volver a partidos
          </Link>
        </div>
      </section>,
    );

  const phase = matchPhase(match, now);
  const live = phase === "playing";
  const done = isCompleted(match);
  const upcoming = !live && !done;
  const rival = match.rival ?? "Rival";
  const ini = match.rivalInitials || opponentInitials(rival);
  const { gf, ga } = scoreOf(match);
  const d = dateParts(match.date);
  const minute = live ? liveMinute(match, now) : null;
  const last = live ? lastEvent(match.events, nameOf, rival) : null;
  const jornada = match.seasonId ? seasonView(matches, match.seasonId, now).jornada.get(match.id) : undefined;
  const kit = match.kit === "away" ? "2ª equipación" : "1ª equipación";
  const r = done ? resultOf(match) : undefined;
  const goalsOf = (ours: boolean) =>
    (match.events ?? [])
      .filter((e) => (ours ? ["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"] : ["opponent_goal", "own_goal"]).includes(e.type))
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
      .map((e) => ({ id: e.id, min: e.minute != null ? `${e.minute}′` : "", who: e.type === "opponent_goal" ? rival : e.type === "opponent_own_goal" ? "autogol" : e.playerId ? nameOf(e.playerId) : "" }));
  const firstTab = done ? "Crónica" : live ? "Directo" : "Previa";
  const active = tab ?? 0;

  const share = async () => {
    try {
      await shareClubPage("partido", match.id, `Manchester Piti vs ${rival}`);
      setNotice(typeof navigator !== "undefined" && typeof navigator.share === "function" ? "" : "Enlace copiado.");
    } catch {
      setNotice("No se ha compartido el enlace.");
    }
  };
  const poster = async (format: "square" | "story") => {
    try {
      await downloadMatchPoster(match, format);
      setNotice("Cartel descargado.");
    } catch {
      setNotice("No se pudo generar el cartel.");
    }
  };

  return chrome(
    <>
      <section className="pt-hero fc-hero" aria-labelledby="fc-t">
        <div className="pt-beams" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="pt-hero-in">
          <div className="pt-rise">
            <Link className="fc-back" to="/partidos">
              <Icon name="left" size={18} stroke={2.2} />
              <span>Partidos</span>
            </Link>
            <div className="pt-tags">
              <span className="hm-kick" style={{ margin: 0 }}>
                {[match.competition, jornada && `Jornada ${jornada}`].filter(Boolean).join(" · ")}
              </span>
            </div>
            <h1 className="fc-h1" id="fc-t">
              {headline(match, phase, nameOf)}
            </h1>
          </div>
          <article className={`pt-board pt-rise${live ? " live" : ""}`} style={{ animationDelay: ".15s" }} aria-label={done ? `Final: Manchester Piti ${gf}, ${rival} ${ga}` : live ? `En directo contra ${rival}` : `Previa contra ${rival}`}>
            <div className="pt-btop">
              <span>
                {d.long.charAt(0).toUpperCase() + d.long.slice(1)} · {d.time}
              </span>
              {live ? (
                <span className="pt-live">
                  <span className="pt-dot" />
                  EN DIRECTO · {minute}′
                </span>
              ) : (
                <b>{done ? "FINAL" : phase === "postponed" ? "APLAZADO" : phase === "awaiting_result" ? "RESULTADO PENDIENTE" : dateMillis(match.date) - now < 7 * 86_400_000 ? "ESTA SEMANA" : "PRÓXIMO"}</b>
              )}
            </div>
            <div className="pt-teams">
              <div className="pt-team">
                <img src="/crest-128.webp" alt="" />
                <b>MANCHESTER PITI</b>
                <small>{match.home === false ? "Visitante" : "Local"}</small>
              </div>
              {done || live ? (
                <div className="pt-score" role="status" aria-label={`Resultado: ${gf} a ${ga}`}>
                  <Flip value={gf} />
                  <i>–</i>
                  <Flip value={ga} />
                </div>
              ) : (
                <span className="pt-vs">vs</span>
              )}
              <div className="pt-team">
                {match.rivalLogoUrl ? <img src={match.rivalLogoUrl} alt="" /> : <span className="ini">{ini}</span>}
                <b>{rival}</b>
                <small>{match.home === false ? "Local" : "Visitante"}</small>
              </div>
            </div>
            {(done || live) && (goalsOf(true).length > 0 || goalsOf(false).length > 0) && (
              <div className="fc-goals">
                <ul>
                  {goalsOf(true).map((g) => (
                    <li key={g.id}>
                      <b>{g.min}</b> {g.who}
                    </li>
                  ))}
                </ul>
                <ul className="r">
                  {goalsOf(false).map((g) => (
                    <li key={g.id}>
                      <b>{g.min}</b> {g.who}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {live && (
              <>
                <div className="pt-prog" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, ((minute ?? 0) / (match.duration ?? 50)) * 100)}%` }} />
                </div>
                <div className="pt-last" aria-live="polite">
                  <b>{last ? `${last.minute}′` : `${minute}′`}</b>
                  <span>{last ? `${last.who} · ${last.label}` : "Arranca el partido"}</span>
                </div>
                <GoalBurst goals={gf} who={last?.goal ? `${last.who} · ${last.minute}′` : undefined} />
              </>
            )}
            {upcoming && Number.isFinite(dateMillis(match.date)) && phase === "scheduled" && <Countdown target={dateMillis(match.date)} />}
            <div className="pt-chips">
              <span className="pt-chip">
                <Icon name="shirt" size={14} /> {kit}
              </span>
              {match.venue && <span className="pt-chip">{match.venue}</span>}
              {r && <span className={`pt-res ${r}`}>{r}</span>}
            </div>
          </article>
          <div>
            <div className="fc-acts">
              {upcoming && phase === "scheduled" && <AddToCalendar className="hm-btn" label="Añadir al calendario" event={matchEvent(match, origin())} />}
              {upcoming && match.venue && (
                <a className="hm-ghostbtn" href={mapsUrl(match.venue)} target="_blank" rel="noreferrer">
                  Cómo llegar <Icon name="arrow" size={16} stroke={2.2} />
                </a>
              )}
              <button type="button" className="hm-ghostbtn" onClick={() => void share()}>
                <Icon name="share" size={16} /> Compartir
              </button>
              <button type="button" className="hm-ghostbtn" onClick={() => void poster("square")}>
                Cartel cuadrado
              </button>
              <button type="button" className="hm-ghostbtn" onClick={() => void poster("story")}>
                Historia vertical
              </button>
            </div>
            {notice && (
              <p className="fc-status" role="status">
                {notice}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="fc-tabs" role="tablist" aria-label="Secciones del partido">
        <span className="ind" style={{ transform: `translateX(${active * 100}%)` }} aria-hidden="true" />
        {[firstTab, "Campo", "Pulso", "Vestuario"].map((label, i) => (
          <button key={label} type="button" role="tab" id={`fc-tab-${i}`} aria-selected={active === i} aria-controls={`fc-pane-${i}`} onClick={() => setTab(i)}>
            {label}
          </button>
        ))}
      </div>
      <div className={`fc-pane${active === 0 && done ? " wide" : ""}`} role="tabpanel" id={`fc-pane-${active}`} aria-labelledby={`fc-tab-${active}`} key={active}>
        {active === 0 && (done ? <CronicaTab match={match} matches={matches} players={players} nameOf={nameOf} /> : live ? <DirectoTab match={match} nameOf={nameOf} /> : <PreviaTab match={match} matches={matches} />)}
        {active === 1 && <CampoTab match={match} players={players} nameOf={nameOf} live={live} />}
        {active === 2 && <PulsoTab match={match} live={live} minute={minute} />}
        {active === 3 && <VestuarioTab match={match} players={players} phase={phase} />}
      </div>
    </>,
  );
}

export default MatchPage;
