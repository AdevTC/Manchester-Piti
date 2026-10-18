// Partidos, «El calendario de luz»: each jornada of the season at the light of its own kick-off (Palomeras in
// 3D, one WebGL context), the jornada of now with its scoreboard object and plinth, the season in four cards,
// the calendar with filters, rival search and season, and the league table. From the Design canvas «Elegida»
// (EL-Partidos*). The page is server-rendered for fans: member bits (the RSVP, «Debut», the MVP link) load in
// their own chunk once hydrated and only for a member; RSVP answers and counts are never shown to anyone else.
import { lazy, Suspense, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { StandingsTable } from "../../components/celeste/Clasificacion";
import { useStandings } from "../../lib/useStandings";
import { useSeason } from "../../context/SeasonContext";
import { dateMillis, isCompleted, matchPhase, nameFor, nextFixture, playerForSeason, useClubData, type ClubMatch } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";
import { useViewer } from "../../hooks/useViewer";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { skyAt, weatherKind } from "../../components/palomeras3d";
import { matchEvent } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { useSetSeason } from "../../lib/useSetSeason";
import { calendarRows, dateParts, shownMinute, type Filter } from "../../lib/partidos";
import { kitLabel, mapsUrl, siteOrigin } from "../../lib/derived/venue";
import { jornadaNumbers, jornadas } from "../../lib/derived/jornada";
import { matchdayOf, type MatchdayModel } from "../../lib/derived/matchday";
import { RESULT_WORD } from "../../lib/derived/result";
import { sunPosition } from "../../lib/derived/sun";
import { useMatchWeather, type MatchWeather } from "../../lib/weather";
import type { StandingRow } from "../../lib/standings";
import { LightCalendar } from "./LightCalendar";
import {
  featuredOf,
  formOf,
  goalChips,
  isLivePhase,
  leadersOf,
  plinthOf,
  provisionalTable,
  rivalLine,
  rivalSuggestions,
  rowTag,
  skyChipOf,
  sliceMatches,
  whenWord,
  venueName,
  type Cta,
  type Leader,
} from "./model";
import "../../styles/celeste/page.css";
import "../../styles/partidos-luz.css";

const SocioLine = lazy(() => import("./Socio").then((m) => ({ default: m.SocioLine })));
const RowRsvp = lazy(() => import("./Socio").then((m) => ({ default: m.RowRsvp })));

const subscribeNothing = () => () => {};
/** False on the server and while hydrating, true once the browser has taken over (member bits wait for it). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

const ALL = "all";
const FILTERS: readonly [Filter, string][] = [
  ["all", "Todos"],
  ["next", "Próximos"],
  ["results", "Resultados"],
];

function introOf(md: MatchdayModel, season: string, pj: number, wins: number, now: number): string {
  const m = md.match;
  const rival = m?.rival ?? "el rival";
  const record = pj ? `${pj} ${pj === 1 ? "jugado" : "jugados"}, ${wins} ${wins === 1 ? "ganado" : "ganados"}` : "Todo por estrenar";
  switch (md.phase) {
    case "pretemporada":
      return `${season}. La liga aún no ha publicado el calendario.`;
    case "antes":
      return `${season}. ${record}: hoy se juega contra ${rival}.`;
    case "pitido":
      return `${season}. Contra ${rival}, a punto de empezar.`;
    case "directo1":
    case "directo2":
      return `${season}. Se está jugando ahora mismo contra ${rival}.`;
    case "descanso":
      return `${season}. Descanso contra ${rival}, de momento ${md.score?.gf ?? 0}–${md.score?.ga ?? 0}.`;
    case "final":
      return `${season}. Partido acabado contra ${rival}, a falta del acta.`;
    case "acta":
      return `${season}. ${record}; el MVP se vota estos días.`;
    case "aplazado":
      return `${season}. El partido contra ${rival} se ha aplazado.`;
    default: {
      const next = md.phase === "despues" ? md.next : m;
      const at = next ? dateMillis(next.date) : NaN;
      const w = Number.isFinite(at) ? whenWord(at, now) : "";
      return next ? `${season}. ${record}; la siguiente${w ? `, ${w}` : ""}, ${rivalLine(next).toLowerCase()}.` : `${season}. ${record}.`;
    }
  }
}

function CtaButton({ c, m }: { c: Cta; m: ClubMatch }) {
  const cls = `pl-btn ${c.kind}`;
  if (c.to === "maps") return m.venue ? <a className={cls} href={mapsUrl(m.venue)} target="_blank" rel="noreferrer">{c.label}</a> : null;
  if (c.to === "calendar") return <AddToCalendar className={cls} label={c.label} event={matchEvent(m, siteOrigin())} />;
  return (
    <Link className={cls} to="/matches/$matchId" params={{ matchId: c.matchId ?? m.id }}>
      {c.label}
    </Link>
  );
}

function Plinth({ md, m, now, nameOf, socio, all }: { md: MatchdayModel; m: ClubMatch; now: number; nameOf: (id: string) => string; socio: boolean; all: readonly ClubMatch[] }) {
  const p = plinthOf(md, now, nameOf);
  if (!p) return null;
  const goals = isLivePhase(md.phase) || md.phase === "final" || md.phase === "acta" ? goalChips(m, nameOf) : [];
  return (
    <div className="pl-plinth">
      <p className="k">
        <span className={p.tone === "live" ? "pl-live" : p.tone === "pending" ? "pl-live pend" : undefined}>{p.kicker}</span>
      </p>
      <p className="tx">{p.text}</p>
      {goals.length > 0 && (
        <ul className="pl-goals" aria-label="Goles">
          {goals.map((g) => (
            <li key={g.id} className={g.ours ? "us" : "them"}>
              <b>{g.minute !== null ? `${g.minute}′` : "·"}</b>
              {g.who}
              {!g.ours && <span className="hm-sr"> (gol del rival)</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="cta">
        {p.ctas.map((c) => (
          <CtaButton key={c.label} c={c} m={c.matchId && c.matchId !== m.id ? (all.find((x) => x.id === c.matchId) ?? m) : m} />
        ))}
      </div>
      {socio && (
        <Suspense fallback={null}>
          <SocioLine match={m} phase={md.phase} all={all} />
        </Suspense>
      )}
    </div>
  );
}

function Panel({ scene, children, alert }: { scene: { led: string; tone: "cal" | "err"; el: number }; children: ReactNode; alert?: boolean }) {
  const sky = skyAt(scene.el, "despejado");
  return (
    <div className="pl-panel" role={alert ? "alert" : undefined}>
      <div className="scene" style={{ background: `linear-gradient(180deg,${sky.top},${sky.mid} 46%,${sky.hor} 62%,#1d3326 63%,#24432c)` }} aria-hidden="true">
        <span className="std" />
        {scene.tone === "err" && <span className="noise" />}
        <span className={`pl-led ${scene.tone}`}>
          <span>{scene.led}</span>
        </span>
      </div>
      <div className="body">{children}</div>
    </div>
  );
}

function LeaderList({ title, list, none, nameOf }: { title: string; list: Leader[]; none: string; nameOf: (id: string) => string }) {
  return (
    <section className="pl-card pl-lead" aria-label={title}>
      <h2 className="pl-h3">{title}</h2>
      {list.length ? (
        <ol>
          {list.slice(0, 5).map((l) => (
            <li key={l.id}>
              <span className="nm">{nameOf(l.id)}</span>
              <b>{l.n}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="none">{none}</p>
      )}
    </section>
  );
}

const topNames = (list: Leader[], nameOf: (id: string) => string) => {
  if (!list.length) return { n: "0", names: "por estrenar" };
  const top = list.filter((l) => l.n === list[0].n).map((l) => nameOf(l.id));
  return { n: String(list[0].n), names: new Intl.ListFormat("es", { style: "long", type: "conjunction" }).format(top.slice(0, 3)) + (top.length > 3 ? " y más" : "") };
};

function CompactTable({ rows, provisional }: { rows: StandingRow[]; provisional: boolean }) {
  return (
    <table className="pl-tbl">
      <caption className="hm-sr">Clasificación{provisional ? ", provisional" : ""}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="hm-sr">Puesto</span>
          </th>
          <th scope="col">Equipo</th>
          <th scope="col">
            <abbr title="Partidos jugados">PJ</abbr>
          </th>
          <th scope="col">
            <abbr title="Diferencia de goles">DG</abbr>
          </th>
          <th scope="col">
            <abbr title="Puntos">Pts</abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const dg = r.gf - r.gc;
          return (
            <tr key={`${r.team}-${i}`} className={r.isUs ? "us" : undefined} aria-current={r.isUs ? "true" : undefined}>
              <td>{i + 1}</td>
              <th scope="row">
                {r.team}
                {r.isUs && <span className="pl-us">Nosotros</span>}
              </th>
              <td>{r.pj}</td>
              <td>{dg > 0 ? `+${dg}` : dg < 0 ? `−${-dg}` : "0"}</td>
              <td className="pts">{r.pts}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SkyChip({ m }: { m: ClubMatch }) {
  const at = dateMillis(m.date);
  if (!Number.isFinite(at)) return <span className="pl-chip none" aria-hidden="true" />;
  const sky = skyAt(sunPosition(at).elevation, weatherKind(null));
  const c = skyChipOf(at, sky);
  return (
    <span className="pl-chip" style={{ background: c.bg }} aria-hidden="true">
      <i className={c.moon ? "moon" : undefined} style={{ top: `${c.sunTop}%` }} />
      <s className={c.lit ? "on" : undefined} style={{ left: 6 }} />
      <s className={c.lit ? "on" : undefined} style={{ right: 6 }} />
    </span>
  );
}

function Row({ m, j, now, hi, socio }: { m: ClubMatch; j?: number; now: number; hi: boolean; socio: boolean }) {
  const phase = matchPhase(m, now);
  const live = phase === "playing";
  const off = phase === "postponed" || phase === "cancelled";
  const tag = rowTag(m, now, live ? shownMinute(m, now) : null);
  const d = dateParts(m.date);
  const at = dateMillis(m.date);
  const lit = Number.isFinite(at) && sunPosition(at).elevation < 3;
  const upcoming = phase === "scheduled" && Number.isFinite(at) && at > now;
  const done = isCompleted(m) || phase === "awaiting_result";
  const venue = m.venue ? `, ${venueName(m.venue)}` : "";
  const kit = kitLabel(m, m.home === false ? "2ª equipación" : "1ª equipación");
  return (
    <li className={`pl-row${hi ? " hi" : ""}${off ? " off" : ""}${live ? " live" : ""}`}>
      <span className="j" aria-hidden="true">
        J{j ?? "·"}
      </span>
      <SkyChip m={m} />
      <span className={`kit${m.kit === "away" || (m.kit === undefined && m.home === false) ? " away" : ""}`} role="img" aria-label={kit}>
        <Icon name="shirt" size={20} />
      </span>
      <span className="tx">
        <Link to="/matches/$matchId" params={{ matchId: m.id }} aria-label={`Jornada ${j ?? ""}: ${rivalLine(m)}${off ? ", aplazado" : ""}`.replace(/\s+/g, " ")}>
          {rivalLine(m)}
        </Link>
        <span className="wl">
          {d.longCap}, {d.time}
          {venue}
          {lit && !done && !off ? ", con focos" : ""}
        </span>
      </span>
      <span className="tagc">
        {tag.kind === "r" && tag.result ? (
          <span className={`pl-tag r ${tag.result}`}>
            <span className="pl-letter" aria-hidden="true">
              {tag.result}
            </span>
            <span className="hm-sr">{RESULT_WORD[tag.result]} </span>
            {tag.text}
          </span>
        ) : (
          <span className={`pl-tag ${tag.kind}`}>{tag.text}</span>
        )}
      </span>
      <span className="acts">
        {live || phase === "awaiting_result" ? (
          <Link className="pl-act pri" to="/matches/$matchId" params={{ matchId: m.id }}>
            {live ? "Seguir el partido" : "Ver el partido"}
          </Link>
        ) : done ? (
          <Link className="pl-act" to="/matches/$matchId" params={{ matchId: m.id }}>
            Ver el acta
          </Link>
        ) : upcoming ? (
          <>
            {m.venue && (
              <a className="pl-act" href={mapsUrl(m.venue)} target="_blank" rel="noreferrer">
                Cómo llegar
              </a>
            )}
            <AddToCalendar className="pl-act" label="Al calendario" event={matchEvent(m, siteOrigin())} />
          </>
        ) : null}
      </span>
      {socio && upcoming && (
        <Suspense fallback={null}>
          <RowRsvp match={m} j={j} />
        </Suspense>
      )}
    </li>
  );
}

function Skeleton() {
  return (
    <div className="pl-skel" aria-hidden="true">
      <div className="pl-sk big" />
      {[1, 2, 3, 4, 5].map((k) => (
        <div className="pl-sk" key={k} />
      ))}
    </div>
  );
}

export function PartidosPage() {
  const { matches, players, loading, error } = useClubData();
  const { seasons, selectedSeasonId } = useSeason();
  const setSeason = useSetSeason();
  const navigate = useNavigate();
  const now = useClock(60_000);
  const viewer = useViewer();
  const hydrated = useHydrated();
  const socio = hydrated && viewer.member;
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const ids = useId();

  const urlSearch: { view?: unknown; season?: unknown } = useSearch({ strict: false });
  const tabla = urlSearch.view === "tabla";
  // «Todas las temporadas» only when asked for; otherwise the chosen season, or the one being played
  const current = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const all = urlSearch.season === ALL;
  const seasonId = all ? "" : selectedSeasonId !== ALL ? selectedSeasonId : current;
  const season = seasons.find((s) => s.id === seasonId);
  const seasonName = season?.name ?? "Temporada";
  const { standings } = useStandings(seasonId || undefined);

  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), seasonId || undefined);
  const numOf = (id: string) => {
    const p = players.find((x) => x.id === id);
    if (!p) return "";
    const s = playerForSeason(p, seasonId || ALL, seasons);
    return s.number != null ? String(s.number) : "";
  };

  const number = jornadas(matches, seasonId);
  const seasonMatches = matches.filter((m) => number.has(m.id)).sort((a, b) => (number.get(a.id) ?? 0) - (number.get(b.id) ?? 0));
  const md = matchdayOf(matches, seasonId, now);
  const featured = featuredOf(md);
  const slices = sliceMatches(seasonMatches, featured && number.has(featured.id) ? featured : null);
  const live = isLivePhase(md.phase) ? md.match : null;

  // the forecast for the (at most two) jornadas within the next seven days
  const soon = slices.filter((m) => matchPhase(m, now) === "scheduled" && dateMillis(m.date) > now).slice(0, 2);
  const w0 = useMatchWeather(soon[0], now);
  const w1 = useMatchWeather(soon[1], now);
  const weather = new Map<string, MatchWeather>();
  if (soon[0] && w0) weather.set(soon[0].id, w0);
  if (soon[1] && w1) weather.set(soon[1].id, w1);

  const jornada = jornadaNumbers(matches);
  const listMatches = all ? matches : matches.filter((m) => m.seasonId === seasonId);
  const rows = calendarRows(listMatches, filter, search, now);
  const pj = seasonMatches.filter((m) => isCompleted(m)).length;
  const form = formOf(seasonMatches, live);
  const wins = form.letters.filter((l) => l === "G").length;
  const lead = leadersOf(seasonMatches, now);
  const prov = standings ? provisionalTable(standings.rows, live) : null;
  const table = prov ?? standings?.rows ?? null;
  const usAt = table ? table.findIndex((r) => r.isUs) : -1;
  const pre = md.phase === "pretemporada";
  const busy = loading && !matches.length;
  const pich = topNames(lead.goals, nameOf);
  const asis = topNames(lead.assists, nameOf);
  const q = search.trim();
  const hiId = (md.phase === "despues" ? md.next : md.match)?.id;

  const setView = (v: "calendario" | "tabla") => void navigate({ to: "/partidos", search: (prev) => ({ ...prev, view: v === "tabla" ? ("tabla" as const) : undefined }) });
  const pickSeason = (id: string) => setSeason(id);

  const groups: { id: string; name: string; list: ClubMatch[] }[] = all
    ? [...seasons].reverse().map((s) => ({ id: s.id, name: s.name, list: rows.filter((m) => m.seasonId === s.id) })).filter((g) => g.list.length)
    : [{ id: seasonId, name: seasonName, list: rows }];

  return (
    <div className="vx hm pl" aria-busy={loading}>
      <CelesteBackdrop />
      <CelesteHeader active="partidos" sub="Partidos" actions={<ThemeToggle />} />
      <div className="pl-top">
        <div className="pl-title">
          <h1 className="pl-h1">Partidos</h1>
          <p className="pl-intro">{all ? "Todas las temporadas del club, de la más nueva a la más vieja." : introOf(md, seasonName, pj, wins, now)}</p>
        </div>
        <div className={`pl-tools${tabla ? " tabla" : ""}`}>
          <label className="hm-sr" htmlFor={`${ids}-season`}>
            Temporada
          </label>
          <span className="pl-sel">
            <select id={`${ids}-season`} value={all ? ALL : seasonId} onChange={(e) => pickSeason(e.target.value)}>
              {[...seasons].reverse().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={ALL}>Todas las temporadas</option>
            </select>
          </span>
          <div className="pl-seg v" role="group" aria-label="Cómo verlo">
            <button type="button" aria-pressed={!tabla} className={!tabla ? "on" : undefined} onClick={() => setView("calendario")}>
              <Icon name="cal" size={17} /> Calendario
            </button>
            <button type="button" aria-pressed={tabla} className={tabla ? "on" : undefined} onClick={() => setView("tabla")}>
              <Icon name="stats" size={17} /> Tabla
            </button>
          </div>
          {!tabla && (
            <>
              <div className="pl-seg f" role="group" aria-label="Qué partidos ver">
                {FILTERS.map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? "on" : undefined} onClick={() => setFilter(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="pl-search">
                <Icon name="search" size={18} />
                <label className="hm-sr" htmlFor={`${ids}-q`}>
                  Buscar rival
                </label>
                <input id={`${ids}-q`} type="search" placeholder="Buscar rival" value={search} onChange={(e) => setSearch(e.target.value)} />
                {q && (
                  <button type="button" className="x" aria-label="Borrar la búsqueda" onClick={() => setSearch("")}>
                    <Icon name="x" size={16} stroke={2.4} />
                  </button>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {all && !error && (
        <p className="pl-note">
          <Icon name="cal" size={20} />
          <span>Todas las temporadas juntas. La clasificación y el calendario de luz van por temporada: elige una arriba para verlos.</span>
        </p>
      )}

      {error ? (
        <section className="pl-sec" aria-labelledby={`${ids}-err`}>
          <div className="pl-lhead">
            <h2 className="pl-h2">El calendario de luz</h2>
            <p>Sin datos no podemos encender ninguna jornada.</p>
          </div>
          <Panel scene={{ led: "SIN SEÑAL", tone: "err", el: -12 }} alert>
            <h3 id={`${ids}-err`}>No nos llegan los partidos</h3>
            <p>Suele ser la conexión o el servidor del club. Dale otra vez en un momento; lo que ya viste sigue guardado.</p>
            <div className="cta">
              <button type="button" className="pl-btn pri" onClick={() => window.location.reload()}>
                Reintentar
              </button>
            </div>
          </Panel>
        </section>
      ) : busy ? (
        <section className="pl-sec" aria-busy="true" aria-label="Cargando los partidos">
          <div className="pl-lhead">
            <h2 className="pl-h2">El calendario de luz</h2>
            <p>Trayendo las jornadas…</p>
          </div>
          <Skeleton />
        </section>
      ) : tabla ? (
        <div className="pl-tabla">
          <section className="pl-card pl-tcard" aria-labelledby={`${ids}-tt`}>
            <h2 className="pl-h2" id={`${ids}-tt`}>
              Clasificación{season ? `, ${season.name.toLowerCase()}` : ""}
            </h2>
            {prov && <p className="pl-prov">Provisional: así quedaría si el partido acaba ahora</p>}
            {standings ? (
              <>
                <StandingsTable standings={prov ? { ...standings, rows: prov, rowsPrev: standings.rows } : standings} />
                <p className="pl-leg">G ganado, E empatado, P perdido. Se actualiza con cada acta publicada.</p>
              </>
            ) : (
              <p className="pl-none">{all ? "La clasificación va por temporada: elige una arriba para verla." : "La liga aún no ha publicado la clasificación de esta temporada."}</p>
            )}
          </section>
          <div className="side">
            <LeaderList title="Pichichi" list={lead.goals} none="Por estrenar: el primer gol de la temporada se apunta aquí." nameOf={nameOf} />
            <LeaderList title="Asistencias" list={lead.assists} none="Por estrenar: el primer pase de gol también." nameOf={nameOf} />
          </div>
        </div>
      ) : (
        <>
          {!all && pre && (
            <section className="pl-sec" aria-labelledby={`${ids}-pre`}>
              <div className="pl-lhead">
                <h2 className="pl-h2">El calendario de luz</h2>
                <p>Aquí saldrán las jornadas, cada una a la hora del pitido y con el sol donde estará.</p>
              </div>
              <Panel scene={{ led: "J1 · POR FIJAR", tone: "cal", el: -7 }}>
                <h3 id={`${ids}-pre`}>El calendario aún no está</h3>
                <p>En cuanto la liga lo publique aparecerán aquí las jornadas, con su hora, su campo y su luz.</p>
                <div className="cta">
                  <AddToCalendar className="pl-btn pri" label="Avísame en mi calendario" feed={`${siteOrigin()}/calendario.ics`} />
                </div>
              </Panel>
            </section>
          )}
          {!all && !pre && slices.length > 0 && featured && (
            <section className="pl-sec pl-light" aria-labelledby={`${ids}-light`}>
              <div className="pl-lhead">
                <h2 className="pl-h2" id={`${ids}-light`}>
                  El calendario de luz
                </h2>
                <p>Cada jornada a la hora del pitido, con el sol donde estará de verdad y la previsión cuando falta una semana.</p>
              </div>
              <LightCalendar
                md={md}
                slices={slices}
                now={now}
                jornada={number}
                nameOf={nameOf}
                numOf={numOf}
                weather={weather}
                plinth={<Plinth md={md} m={slices[0]} now={now} nameOf={nameOf} socio={socio} all={matches} />}
              />
            </section>
          )}

          {!all && !pre && (
            <div className="pl-sum">
              <div className="pl-card">
                <p className="pl-k">Forma</p>
                <ol className="pl-form" aria-label={form.letters.length ? `Forma: ${form.letters.map((l) => RESULT_WORD[l].toLowerCase()).join(", ")}` : "Forma: aún sin partidos"}>
                  {form.letters.slice(-6).map((l, i) => (
                    <li key={i} className={l}>
                      {l}
                    </li>
                  ))}
                  {Array.from({ length: Math.max(0, Math.min(6, seasonMatches.length) - Math.min(6, form.letters.length)) }, (_, i) => (
                    <li key={`x${i}`} className="x" aria-hidden="true">
                      –
                    </li>
                  ))}
                </ol>
                {form.provisional && <p className="pl-prov">Si acaba así, una {form.provisional}</p>}
              </div>
              <div className="pl-card">
                <p className="pl-k">Clasificación</p>
                <p className="pl-big">
                  {usAt >= 0 && table && table[usAt].pj > 0 ? `${usAt + 1}º` : "–"}
                  <small>{usAt >= 0 && table ? (table[usAt].pj ? `${table[usAt].pts} ${table[usAt].pts === 1 ? "punto" : "puntos"}${prov ? ", si acaba así" : ""}` : "Todos a 0") : "Sin publicar"}</small>
                </p>
              </div>
              <div className="pl-card">
                <p className="pl-k">Pichichi</p>
                <p className="pl-big">
                  {pich.n}
                  <small>{pich.names}</small>
                </p>
              </div>
              <div className="pl-card">
                <p className="pl-k">Asistencias</p>
                <p className="pl-big">
                  {asis.n}
                  <small>{asis.names}</small>
                </p>
              </div>
            </div>
          )}

          <div className="pl-grid">
            <section className="pl-list" aria-labelledby={`${ids}-cal`}>
              <h2 className="pl-h2" id={`${ids}-cal`}>
                {all ? "Todos los partidos" : "Calendario"}
              </h2>
              <p className="hm-sr" role="status" aria-live="polite">
                {rows.length} {rows.length === 1 ? "partido" : "partidos"}
              </p>
              {groups.map((g) => (
                <div key={g.id}>
                  {all && (
                    <div className="pl-ghd">
                      <b>{g.name}</b>
                      <span>
                        {g.list.length} {g.list.length === 1 ? "partido" : "partidos"}
                      </span>
                    </div>
                  )}
                  <ol className="pl-rows">
                    {g.list.map((m) => (
                      <Row key={m.id} m={m} j={jornada.get(m.id)} now={now} hi={m.id === hiId} socio={socio} />
                    ))}
                  </ol>
                </div>
              ))}
              {!rows.length && (
                <div className="pl-empty">
                  {q ? (
                    <>
                      <b>Ningún rival se llama «{q}»</b>
                      <p>Buscamos en {all ? "todas las temporadas" : seasonName.toLowerCase()}. Prueba con uno de estos:</p>
                      <div className="sug">
                        {rivalSuggestions(listMatches).map((r) => (
                          <button key={r} type="button" onClick={() => setSearch(r)}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : pre || !listMatches.length ? (
                    <>
                      <b>Sin partidos todavía</b>
                      <p>En cuanto la liga publique el calendario, las jornadas aparecerán aquí con su hora, su campo y su luz.</p>
                    </>
                  ) : filter === "results" ? (
                    <>
                      <b>Aún no hay resultados</b>
                      <p>{live ? "El primero se está jugando ahora mismo: lo verás aquí en cuanto acabe." : "El primero llega con el estreno."}</p>
                    </>
                  ) : (
                    <>
                      <b>No queda nada por jugar</b>
                      <p>La temporada está cerrada. Mira los resultados o la temporada siguiente cuando salga.</p>
                    </>
                  )}
                </div>
              )}
            </section>
            {!all && !pre && (
              <section className="pl-tablebox" aria-labelledby={`${ids}-tb`}>
                <div className="pl-card">
                  <h2 className="pl-h2" id={`${ids}-tb`}>
                    Clasificación
                  </h2>
                  {prov && <p className="pl-prov">Provisional: así quedaría si acaba ahora</p>}
                  {table ? (
                    <>
                      <CompactTable rows={table} provisional={!!prov} />
                      <button type="button" className="pl-btn ghost wide" onClick={() => setView("tabla")}>
                        Ver la tabla completa
                      </button>
                    </>
                  ) : (
                    <p className="pl-none">La liga aún no ha publicado la clasificación de esta temporada.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      )}
      <CelesteFooter />
      <CelesteDock active="partidos" />
    </div>
  );
}

export default PartidosPage;
