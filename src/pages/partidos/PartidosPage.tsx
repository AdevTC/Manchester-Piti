// Partidos (Celeste · "Noche de focos"): the next or live match on a stadium board, the season as a
// strip of tiles and four numbers, and the calendar with filters. From the Design canvas
// "Partidos · elegida"; pure logic in lib/partidos.ts.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSeason } from "../../context/SeasonContext";
import { dateMillis, isCompleted, matchPhase, nextFixture, playerForSeason, nameFor, useClubData, type ClubMatch } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { PlayerLink } from "../../components/celeste/PlayerLink";
import { Icon } from "../../components/celeste/icons";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { Flip } from "../../components/celeste/Flip";
import { Avisos } from "../../components/celeste/Avisos";
import { GoalBurst } from "../../components/celeste/GoalBurst";
import { useGoalCelebration } from "../../components/celeste/useGoalCelebration";
import { WeatherChip } from "../../components/celeste/WeatherChip";
import { leaders, matchEvent, playerLines, type SquadMember } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { ALL_SEASONS_LABEL, useSetSeason } from "../../lib/useSetSeason";
import { opponentInitials } from "../../lib/clubAnalytics";
import { calendarRows, countdownParts, dateParts, lastEvent, liveMinute, resultOf, scoreOf, scorersLine, seasonView, type Filter, type SeasonView } from "../../lib/partidos";
import { AWAITING_ACTA, kickoffState, kickoffText, PENDING_WHISTLE } from "../../lib/derived/kickoff";
import { jornadaNumbers } from "../../lib/derived/jornada";
import { RESULT_LEGEND, RESULT_WORD } from "../../lib/derived/result";
import "../../styles/home.css";
import "../../styles/partidos.css";

const origin = () => (typeof location === "undefined" ? "" : location.origin);
const where = (m: ClubMatch) => (m.home === false ? "fuera" : m.home === true ? "en casa" : "");
const kitLabel = (m: ClubMatch) => (m.kit === "away" ? "2ª equipación" : m.kit === "home" ? "1ª equipación" : "");
const mapsUrl = (venue: string) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(venue);

function Countdown({ target }: { target: number }) {
  const now = useClock(1000);
  const c = countdownParts(target, now);
  const label = `Faltan ${Number(c.d)} días, ${Number(c.h)} horas y ${Number(c.m)} minutos`;
  return (
    <div className="pt-cd" role="timer" aria-label={label}>
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

function Board({ view, nameOf }: { view: SeasonView; nameOf: (id: string) => string }) {
  const now = useClock(15_000);
  const m = view.live ?? view.next;
  const goalShow = useGoalCelebration(view.live, now);
  if (!m) {
    return (
      <article className="pt-board pt-rise" style={{ animationDelay: ".15s" }} aria-label="Primer partido, por publicar">
        <div className="pt-btop">
          <span>PRIMER PARTIDO</span>
          <b>POR PUBLICAR</b>
        </div>
        <div className="pt-cd" aria-hidden="true">
          {["DÍAS", "HORAS", "MIN", "SEG"].map((l) => (
            <div key={l}>
              <Flip value="–" className="ph" />
              <small>{l}</small>
            </div>
          ))}
        </div>
        <p className="pt-meta">
          Fecha por publicar
          <small>La cuenta atrás arranca sola cuando se publique la próxima jornada</small>
        </p>
        <div className="pt-acts">
          <AddToCalendar className="hm-btn" label="Suscribirme al calendario" feed={`${origin()}/calendario.ics`} />
        </div>
      </article>
    );
  }
  const j = view.jornada.get(m.id);
  const rival = m.rival ?? "Rival";
  const ini = m.rivalInitials || opponentInitials(rival);
  const d = dateParts(m.date);
  const live = m === view.live;
  // The date has come and nobody has started the clock: no frozen 00:00 countdown.
  const pending = !live && kickoffState(m, now) === "pending_whistle";
  const { gf, ga } = scoreOf(m);
  const minute = live ? liveMinute(m, now) : null;
  const last = live ? lastEvent(m.events, nameOf, rival) : null;
  const sideUs = m.home === false ? "Visitante" : "Local";
  return (
    <article className={`pt-board pt-rise${live ? " live" : ""}`} style={{ animationDelay: ".15s" }} aria-label={live ? `En directo contra ${rival}` : pending ? `${PENDING_WHISTLE} contra ${rival}` : `Próximo partido: ${rival}`}>
      <div className="pt-btop">
        <span>
          {live ? "" : "PRÓXIMO · "}JORNADA {j} · {(where(m) || m.competition || "").toUpperCase()}
        </span>
        {live ? (
          <span className="pt-live">
            <span className="pt-dot" />
            EN DIRECTO · {minute}′
          </span>
        ) : (
          <b>{dateMillis(m.date) - now < 86_400_000 * 7 ? "ESTA SEMANA" : d.long.toUpperCase()}</b>
        )}
      </div>
      <div className="pt-teams">
        <div className="pt-team">
          <img src="/crest-128.webp" alt="" />
          <b>MANCHESTER PITI</b>
          <small>{sideUs}</small>
        </div>
        {live ? (
          <div className="pt-score" role="status" aria-label={`Marcador: ${gf} a ${ga}`}>
            <Flip value={gf} still={!goalShow.flip} />
            <i>–</i>
            <Flip value={ga} still={!goalShow.flip} />
          </div>
        ) : (
          <span className="pt-vs">vs</span>
        )}
        <div className="pt-team">
          {m.rivalLogoUrl ? <img src={m.rivalLogoUrl} alt="" /> : <span className="ini">{ini}</span>}
          <b>{rival}</b>
          <small>{m.home === false ? "Local" : "Visitante"}</small>
        </div>
      </div>
      {live ? (
        <>
          <div className="pt-prog" aria-hidden="true">
            <i style={{ width: `${Math.min(100, ((minute ?? 0) / (m.duration ?? 50)) * 100)}%` }} />
          </div>
          <div className="pt-last" aria-live="polite">
            <b>{last ? `${last.minute}′` : `${minute}′`}</b>
            <span>{last ? `${last.who} · ${last.label}` : "Arranca el partido"}</span>
          </div>
          <div className="pt-acts">
            <Link className="hm-btn" to="/matches/$matchId" params={{ matchId: m.id }}>
              Seguir en directo <Icon name="arrow" size={16} stroke={2.2} />
            </Link>
          </div>
          <GoalBurst burst={goalShow.burst} who={last?.goal ? `${last.who} · ${last.minute}′` : undefined} />
        </>
      ) : (
        <>
          {pending ? (
            <div className="pt-last" role="status">
              <b>{d.time}</b>
              <span>{PENDING_WHISTLE}</span>
            </div>
          ) : (
            <Countdown target={dateMillis(m.date)} />
          )}
          <p className="pt-meta">
            {d.long.charAt(0).toUpperCase() + d.long.slice(1)} · {d.time}
            {where(m) && ` · ${where(m)}`}
            {m.venue && <small>{m.venue}</small>}
          </p>
          {(kitLabel(m) || m.competition) && (
            <div className="pt-chips">
              <WeatherChip match={m} now={now} />
              {kitLabel(m) && (
                <span className="pt-chip">
                  <Icon name="shirt" size={14} /> {kitLabel(m)}
                </span>
              )}
              {m.competition && <span className="pt-chip">{m.competition}</span>}
            </div>
          )}
          <div className="pt-acts">
            <AddToCalendar className="hm-btn" label="Añadir al calendario" event={matchEvent(m, origin())} />
            {m.venue && (
              <a className="hm-ghostbtn" href={mapsUrl(m.venue)} target="_blank" rel="noreferrer">
                Cómo llegar <Icon name="arrow" size={16} stroke={2.2} />
              </a>
            )}
          </div>
        </>
      )}
    </article>
  );
}

export function PartidosPage() {
  const { matches, players, loading } = useClubData();
  const { seasons, selectedSeasonId } = useSeason();
  // The season is URL-authoritative (SeasonUrlSync): picking one navigates, it never writes the context.
  const setSeason = useSetSeason();
  const now = useClock(60_000);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const seasonId = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const view = seasonView(matches, seasonId, now);
  // the live row's score flips only for a fresh goal, as the board's does (a late old one just changes it)
  const rowGoal = useGoalCelebration(view.live, now);
  // a name in a match's own season (the board: the current season's; each row: its match's)
  const nameIn = (sid: string | undefined) => (id: string) => nameFor(players.find((p) => p.id === id), sid);
  const nameOf = nameIn(seasonId);

  // Jornada of every match within its own season (the list can show any season).
  const jornada = jornadaNumbers(matches);
  const listMatches = selectedSeasonId === "all" ? matches : matches.filter((m) => m.seasonId === selectedSeasonId);
  const rows = calendarRows(listMatches, filter, search, now);

  const squad: SquadMember[] = players
    .filter((p) => p.seasons?.includes(seasonId))
    .map((raw) => {
      const p = playerForSeason(raw, seasonId, seasons);
      return { id: p.id, name: nameFor(p), num: p.number != null ? String(p.number) : "" };
    });
  const scorers = leaders(playerLines(squad, view.played), "goals", 4);

  const pj = view.played.length;
  const live = !!view.live;
  const pre = !pj && !view.next && !live;
  const nextPending = !!view.next && kickoffState(view.next, now) === "pending_whistle";
  const ghost = live ? "EN JUEGO" : view.next ? `J${view.jornada.get(view.next.id)} · ${view.next.rival ?? ""}` : (season?.name ?? "Temporada").toUpperCase();
  const lead = live
    ? "Se está jugando. El marcador se mueve solo, gol a gol, desde el acta."
    : pre
      ? `El calendario de ${season?.name ?? "la temporada"} aún no está publicado. En cuanto lo esté, cada partido llega aquí con su cuenta atrás.`
      : `${pj ? `${pj} ${pj === 1 ? "jornada" : "jornadas"}, ${view.wins} ${view.wins === 1 ? "victoria" : "victorias"}.` : "Todo por estrenar."} ${view.next ? (nextPending ? `La siguiente, ${PENDING_WHISTLE.toLowerCase()}.` : "La siguiente, en la cuenta atrás.") : ""}`;

  return (
    <div className="vx hm pt" aria-busy={loading}>
      <CelesteBackdrop />
      <CelesteHeader
        active="partidos"
        sub="Partidos"
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
      <section className="pt-hero" aria-labelledby="pt-t">
        <div className="pt-beams" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="pt-ghost" aria-hidden="true">
          {ghost}
        </div>
        <div className="pt-hero-in">
          <div className="pt-rise">
            <div className="pt-tags">
              <span className="hm-kick" style={{ margin: 0 }}>
                {season?.name ?? "Temporada"}
                {pre && " · pretemporada"}
              </span>
            </div>
            <h1 className="pt-h1" id="pt-t">
              Partidos
            </h1>
            <p className="pt-lead">{lead}</p>
          </div>
          {!loading && <Board view={view} nameOf={nameOf} />}
        </div>
      </section>
      <main className="pt-main">
        <section className="pt-sec pt-season-sec" aria-labelledby="pt-s">
          <span className="hm-kick">
            {season?.name ?? "Temporada"} · {pj} {pj === 1 ? "jugado" : "jugados"}
            {view.tiles.length > 0 && ` de ${view.tiles.length}`}
          </span>
          <h2 className="hm-h2" id="pt-s">
            {pj ? `${view.wins} ${view.wins === 1 ? "victoria" : "victorias"} en ${pj}` : "Todo por estrenar"}
          </h2>
          {view.tiles.length > 0 && (
            <>
              <div className="pt-tira">
                {view.tiles.map((t, i) => (
                  <Link
                    key={t.id}
                    to="/matches/$matchId"
                    params={{ matchId: t.id }}
                    className={`pt-tile ${t.result ?? t.state}`}
                    style={{ animationDelay: `${(i * 0.035).toFixed(2)}s` }}
                    aria-label={`Jornada ${t.j}, ${t.rival}: ${t.result ? RESULT_WORD[t.result] : t.state === "live" ? "en juego" : t.state === "awaiting" ? AWAITING_ACTA.toLowerCase() : "por jugar"}`}
                  >
                    {t.state === "live" ? "●" : t.state === "awaiting" ? "…" : (t.result ?? "·")}
                  </Link>
                ))}
              </div>
              <div className="pt-legend">
                <span>J1</span>
                <span>{RESULT_LEGEND}</span>
                <span>J{view.tiles.length}</span>
              </div>
            </>
          )}
          <dl className={`pt-nums${pj ? "" : " ph"}`}>
            <div className="hl">
              <dt>jugados</dt>
              <dd>{pj}</dd>
            </div>
            <div>
              <dt>G · E · P</dt>
              <dd>
                {view.wins}·{view.draws}·{view.losses}
              </dd>
            </div>
            <div className="hl">
              <dt>a favor</dt>
              <dd>{view.gf}</dd>
            </div>
            <div>
              <dt>en contra</dt>
              <dd>{view.ga}</dd>
            </div>
          </dl>
        </section>

        <section className="pt-sec" aria-labelledby="pt-c">
          <span className="hm-kick">Jornada a jornada</span>
          <h2 className="hm-h2" id="pt-c">
            El calendario
          </h2>
          <div className="pt-tools">
            <div className="pt-seg" role="group" aria-label="Filtrar partidos">
              {(
                [
                  ["all", "Todos"],
                  ["next", "Próximos"],
                  ["results", "Resultados"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="pt-search">
              <Icon name="search" size={18} />
              <span className="hm-sr">Buscar rival</span>
              <input type="search" placeholder="Buscar rival…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {seasons.length > 1 && (
              <select className="pt-season" aria-label="Temporada" value={selectedSeasonId} onChange={(e) => setSeason(e.target.value)}>
                <option value="all">{ALL_SEASONS_LABEL}</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {rows.length > 0 ? (
            <ol className="pt-list">
              {rows.map((m) => (
                <li key={m.id}>
                  <Row m={m} j={jornada.get(m.id)} now={now} nameOf={nameIn(m.seasonId)} next={m.id === view.next?.id} still={!rowGoal.flip} />
                </li>
              ))}
            </ol>
          ) : listMatches.length ? (
            <p className="pt-more">Ningún partido con ese filtro.</p>
          ) : (
            <div className="pt-list">
              {[1, 2, 3].map((n) => (
                <div className="pt-ghostrow" key={n}>
                  <b>J{n}</b>
                  <span>{n === 1 ? "Por confirmar · el capitán publica la fecha" : "Por confirmar"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="pt-aside" aria-label="Más de la temporada">
          {scorers.length > 0 && (
            <div className="pt-card">
              <span className="hm-kick" style={{ margin: 0 }}>
                Goles de la temporada
              </span>
              <h3>
                <PlayerLink id={scorers[0].id} seasonId={seasonId} variant="quiet">{scorers[0].name}</PlayerLink> lleva {scorers[0].stats.goals}
              </h3>
              <ol className="pt-pich">
                {scorers.map((s, i) => (
                  <li key={s.id}>
                    <i>{i + 1}</i>
                    <span>
                      <PlayerLink id={s.id} seasonId={seasonId} variant="quiet">{s.name}</PlayerLink>
                    </span>
                    <b>{s.stats.goals}</b>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <Avisos />
          <div className="pt-card">
            <span className="hm-kick" style={{ margin: 0 }}>
              En tu móvil
            </span>
            <h3>Todos los partidos, solos en tu calendario</h3>
            <p>Fechas, cambios de hora y resultados llegan a Google, Apple u Outlook sin hacer nada.</p>
            <div className="pt-acts" style={{ justifyContent: "flex-start" }}>
              <AddToCalendar className="hm-ghostbtn" label="Suscribirme" feed={`${origin()}/calendario.ics`} />
            </div>
          </div>
        </aside>
      </main>
      <CelesteFooter />
      <CelesteDock active="partidos" />
    </div>
  );
}

function Row({ m, j, now, nameOf, next, still }: { m: ClubMatch; j?: number; now: number; nameOf: (id: string) => string; next: boolean; still: boolean }) {
  const d = dateParts(m.date);
  const phase = matchPhase(m, now);
  const live = phase === "playing";
  const done = isCompleted(m);
  // «Pendiente del pitido inicial» / «Pendiente del acta» when the clock never started.
  const waiting = done ? null : kickoffText(m, now);
  const { gf, ga } = scoreOf(m);
  const r = done ? resultOf(m) : undefined;
  const rival = m.rival ?? "Rival";
  const meta = done
    ? [scorersLine(m.events, nameOf) || "Sin goles del Piti", where(m)].filter(Boolean).join(" · ")
    : phase === "postponed"
      ? "Aplazado"
      : waiting
        ? [waiting, where(m)].filter(Boolean).join(" · ")
        : [where(m), d.long].filter(Boolean).join(" · ");
  const aria = `Jornada ${j ?? "?"}, ${rival}, ${d.long}${done ? `: ${gf} a ${ga}` : live ? ": en directo" : ` a las ${d.time}`}${waiting ? `: ${waiting.toLowerCase()}` : ""}`;
  return (
    <Link className={`pt-row${live ? " live" : next ? " next" : ""}`} to="/matches/$matchId" params={{ matchId: m.id }} aria-label={aria}>
      <span className="when">
        <small>J{j ?? "·"}</small>
        <b>{d.day}</b>
        <small>{d.mon}</small>
      </span>
      <span className="mid">
        <span className="ln">
          <span className="tn us">PITI</span>
          {done || live ? (
            <span className="sc">
              <Flip value={gf} still={live && still} />
              <Flip value={ga} still={live && still} />
            </span>
          ) : (
            <span className="sc">
              <Flip value={d.time} className="t" />
            </span>
          )}
          <span className="tn">{rival}</span>
        </span>
        <span className="meta">{live ? "En directo" : meta}</span>
      </span>
      {r ? (
        <span className={`pt-res ${r}`} aria-hidden="true">
          {r}
        </span>
      ) : live ? (
        <span className="tag live">● EN DIRECTO</span>
      ) : next ? (
        <span className="tag">PRÓXIMO</span>
      ) : null}
    </Link>
  );
}

export default PartidosPage;
