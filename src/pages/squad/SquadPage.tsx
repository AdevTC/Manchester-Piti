import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { useSeason } from "../../context/SeasonContext";
import { nextFixture, playerForSeason, useClubData, type ClubMatch } from "../../lib/clubData";
import { analysePlayer, chronological } from "../../lib/clubAnalytics";
import { currentSeasonId } from "../../lib/vestuario";
import { matchesQuery, sortSquad, squadRow, squadSummary, type SquadRow } from "../../lib/squad";
import { resolvePositions } from "../../lib/positions";
import { leaders, playerLines, seasonPulse, upcomingBirthdays, type SquadMember } from "../../lib/home";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { Percha } from "./Percha";
import { FichaModal } from "./FichaModal";
import { useMvpResults } from "../vestuario/live";
import { mvpOfFrom } from "../../lib/derived/mvpOf";
import { CaraACara } from "./CaraACara";
import { RaceAndBirthdays } from "../home/Sections";
import { useClock } from "../../hooks/useClock";
import { matchdayOf } from "../../lib/derived/matchday";
import { squadLive, type SquadLive } from "../../lib/derived/vidrio/squadLive";
import { mvpWinners } from "../../lib/vestuario";
import { PageSky, useNightGoal } from "../../components/paginas/PageSky";
import "../../styles/celeste/page.css";
import "../../styles/home.css"; // RaceAndBirthdays (the pichichi podium) is home's section
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio-paginas.css";
import "../../styles/squad.css";

/** The duel angles each shirt towards the middle. */
const DUEL_YAW = { a: 0.42, b: -0.42 };

function scrollToId(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
/** Shared-element transition when the browser supports it; plain state change otherwise. */
function transition(update: () => void) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return update();
  document.startViewTransition(() => flushSync(update));
}

/**
 * The open ficha with the MVPs for its ratings by position (the one shared reader, derived/mvpOf). Mounted
 * only while a ficha is open, so the page subscribes to mvpResults only then (stepping between fichas keeps it).
 */
function FichaWithMvps({ now, games, ...props }: Omit<ComponentProps<typeof FichaModal>, "mvpOf" | "games"> & { now: number; games: ClubMatch[] }) {
  const results = useMvpResults();
  const mvpOf = useMemo(() => mvpOfFrom(results, games, now), [results, games, now]);
  return <FichaModal {...props} games={games} mvpOf={mvpOf} />;
}

/** Who won the closed vote of `match` (mounted only then, so the page reads mvpResults only then). */
function MvpProbe({ match, now, onWinners }: { match: ClubMatch; now: number; onWinners: (v: { id: string; ids: readonly string[] }) => void }) {
  const results = useMvpResults();
  const ids = mvpWinners(match, results.get(match.id), now).join("|");
  useEffect(() => onWinners({ id: match.id, ids: ids ? ids.split("|") : [] }), [ids, match.id, onWinners]);
  return null;
}

/** Public squad page («Vidrio»: the light field of the moment, Mona Sans): the shirts on the rail (each opens
 *  its ficha, each says where he is on match day) and the head-to-head. */
export function SquadPage() {
  const { matches, players, loading, error } = useClubData();
  const { selectedSeasonId, seasons } = useSeason();
  const theme = useDocumentTheme();
  const [now] = useState(() => Date.now());
  const seasonId =
    selectedSeasonId !== "all" && seasons.some((s) => s.id === selectedSeasonId) ? selectedSeasonId : currentSeasonId(nextFixture(matches, now), matches, seasons);
  const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? "Temporada";
  // match day: the clock of the moment (the percha follows the match as it is played)
  const clock = useClock(15_000);
  const day = useMemo(() => matchdayOf(matches, seasonId, clock), [matches, seasonId, clock]);
  const live = day.phase === "directo1" || day.phase === "descanso" || day.phase === "directo2";
  const night = useNightGoal(day.match, live);
  // the MVP of tonight's match, only once its vote has closed (mvpResults is read only then: MvpProbe)
  const voteClosed = !!day.match && typeof day.match.voteClosesAt === "number" && day.match.voteClosesAt <= clock && (day.phase === "acta" || day.phase === "despues");
  const [mvpOf, setMvpOf] = useState<{ id: string; ids: readonly string[] } | null>(null);
  const mvp = useMemo(() => (voteClosed && mvpOf && mvpOf.id === day.match?.id ? mvpOf.ids : []), [voteClosed, mvpOf, day.match]);
  const lift = night.goal?.side === "us" && night.moment.active ? night.goal.playerId : null;

  const games = useMemo(() => chronological(matches.filter((m) => m.seasonId === seasonId)), [matches, seasonId]);
  const { rows, withStats } = useMemo(() => {
    const list = players
      .filter((p) => p.seasons?.includes(seasonId))
      .map((raw) => {
        const p = playerForSeason(raw, seasonId, seasons);
        return squadRow(p, analysePlayer(p, games), now);
      });
    return { rows: sortSquad(list, "num"), withStats: games.length > 0 };
  }, [games, players, seasonId, seasons, now]);

  // Pichichi, assists and birthdays live here: the home is about the match, this page about the players.
  const race = useMemo(() => {
    const members: SquadMember[] = rows.map((r) => ({ id: r.id, name: r.name, num: r.num, birthDate: players.find((p) => p.id === r.id)?.birthDate }));
    const lines = playerLines(members, seasonPulse(matches, seasonId, now).played);
    return { scorers: leaders(lines, "goals"), assisters: leaders(lines, "assists", 1), birthdays: upcomingBirthdays(members, now) };
  }, [rows, players, matches, seasonId, now]);

  const [query, setQuery] = useState("");
  const [kit, setKit] = useState<"home" | "away">("home");
  const [openId, setOpenId] = useState<string | null>(null);
  const [vtId, setVtId] = useState<string | null>(null);
  const [duel, setDuel] = useState<[string, string] | null>(null);

  const visible = rows.filter((r) => matchesQuery(r, query));
  const open = rows.find((r) => r.id === openId);
  const openRaw = open && players.find((p) => p.id === open.id);
  const openPositions = useMemo(() => {
    const r = openRaw ? resolvePositions(openRaw) : null;
    return r ? { main: r.main, also: r.also } : undefined;
  }, [openRaw]);
  const summary = squadSummary(rows);
  const sl: SquadLive = useMemo(() => squadLive({ day, squad: rows.map((r) => r.id), matches, mvp }), [day, rows, matches, mvp]);

  // Head-to-head: starts with the two first players that have a full ficha.
  const complete = rows.filter((r) => !r.missing.length);
  const [aId, bId] = duel ?? [complete[0]?.id ?? rows[0]?.id ?? "", complete[1]?.id ?? rows.find((r) => r.id !== (complete[0]?.id ?? rows[0]?.id))?.id ?? ""];
  const a = rows.find((r) => r.id === aId);
  const b = rows.find((r) => r.id === bId);

  const shot = (r: SquadRow, yaw = 0) => ({ kit, theme, name: r.name.toUpperCase(), num: r.num, yaw });
  const still = useShirtStills(rows.map((r) => shot(r)), { offMainThread: true });
  const duelStills = useShirtStills([a && shot(a, DUEL_YAW.a), b && shot(b, DUEL_YAW.b)].filter((x) => x != null), { offMainThread: true });
  const stillOf = (r: SquadRow) => still(shot(r));

  const openFicha = (id: string) => {
    flushSync(() => setVtId(id));
    transition(() => setOpenId(id));
  };
  const closeFicha = () => transition(() => setOpenId(null));
  const step = (dir: 1 | -1) => {
    const list = visible.length ? visible : rows;
    const at = list.findIndex((r) => r.id === openId);
    const next = list[(at + dir + list.length) % list.length].id;
    setOpenId(next);
    setVtId(next);
  };
  const pickSide = (side: "a" | "b", id: string) => {
    if (side === "a") setDuel(id === bId ? [id, aId] : [id, bId]);
    else setDuel(id === aId ? [bId, id] : [aId, id]);
  };

  return (
    <div className={`vx vd-pg sq${live ? " vd-pg--live" : ""}`} data-kit={kit} aria-busy={loading}>
      <PageSky now={clock} live={live} moment={night.moment} />
      {voteClosed && day.match && <MvpProbe match={day.match} now={clock} onWinners={setMvpOf} />}
      <CelesteHeader
        active="plantilla"
        sub="Plantilla"
        actions={
          <>
            <ThemeToggle />
          </>
        }
      />

      <section className="sq-hero" aria-labelledby="sq-title" aria-busy={loading}>
        <div className="sq-copy vd-pg-head">
          <h1 id="sq-title">Plantilla</h1>
          {/* (the same words while loading, so the head keeps its lines and nothing below jumps) */}
          <p className="vd-lede sq-lede">
            {loading ? (
              "La plantilla de la temporada."
            ) : sl.stage ? (
              <>
                <span className="sq-lede-l">{sl.lede}</span>
                <span className="sq-lede-s">{sl.ledeShort}</span>
              </>
            ) : (
              `${sl.lede} Toca una camiseta para abrir su ficha.`
            )}
          </p>
          <div className="sq-tools">
            <div className="sq-kit vd-glass" role="group" aria-label="Equipación">
              <button type="button" aria-pressed={kit === "home"} onClick={() => setKit("home")}>
                <i className="sw" />
                1ª
              </button>
              <button type="button" aria-pressed={kit === "away"} onClick={() => setKit("away")}>
                <i className="sw a" />
                2ª
              </button>
            </div>
            <label className="sq-search vd-glass">
              <Icon name="search" size={18} stroke={2} />
              <input type="search" aria-label="Buscar jugador" placeholder="Nombre o dorsal" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
        </div>
        {error ? (
          <p className="sq-empty">No se ha podido cargar la plantilla. Prueba a recargar la página.</p>
        ) : (
          <>
            <Percha rows={visible} still={stillOf} openId={openId} vtId={vtId} onOpen={openFicha} live={sl.stage ? sl.rows : null} lift={lift} />
            {!loading && !visible.length && <p className="sq-empty">{rows.length ? "Nadie lleva ese nombre ni ese dorsal." : `Todavía no hay jugadores en ${seasonName}.`}</p>}
            {visible.length > 0 && (
              <p className="sq-hint">
                <span className="m">Desliza la percha · </span>
                {visible.length} {visible.length === 1 ? "jugador" : "jugadores"} · toca una camiseta para ver su ficha
              </p>
            )}
            {!loading && rows.length > 0 && (
              <div className="sq-sum">
                <div>
                  <b>{summary.size}</b>
                  <span>jugadores</span>
                </div>
                <div>
                  <b>{summary.avgAge ?? "—"}</b>
                  <span>años de media</span>
                </div>
                <div>
                  <b>{summary.quinta?.count ?? "—"}</b>
                  <span>{summary.quinta ? `de la quinta del ${String(summary.quinta.year).slice(2)}` : "sin fechas"}</span>
                </div>
                <div className="g">
                  <b>{summary.incomplete}</b>
                  <span>fichas por completar</span>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {rows.length > 0 && <RaceAndBirthdays scorers={race.scorers} assisters={race.assisters} birthdays={race.birthdays} seasonId={seasonId} />}

      {a && b && a.id !== b.id && (
        <section className="hm-sec" id="sq-cara" aria-labelledby="sq-cara-t">
          <h2 className="hm-h2" id="sq-cara-t">
            Cara a cara
          </h2>
          <p className="hm-lede">
            Elige dos y compáralos.{" "}
            {withStats ? "Toca una esquina para cambiar de jugador. Con sus fichas y lo que llevan de temporada." : "Toca una esquina para cambiar de jugador. Desde la jornada 1 se suman partidos, goles, asistencias y minutos."}
          </p>
          <CaraACara
            rows={rows}
            a={a}
            b={b}
            withStats={withStats}
            kit={kit}
            still={stillOf}
            duelStill={(r, side) => duelStills(shot(r, DUEL_YAW[side]))}
            onPick={pickSide}
            onSwap={() => setDuel([bId, aId])}
          />
        </section>
      )}

      <CelesteFooter />
      <CelesteDock active="plantilla" />

      {open && (
        <FichaWithMvps
          now={now}
          row={open}
          still={stillOf(open)}
          seasonName={seasonName}
          withStats={withStats}
          kit={kit}
          theme={theme}
          onClose={closeFicha}
          onStep={step}
          games={games}
          positions={openPositions}
          onCompare={() => {
            setDuel([open.id, open.id === bId ? aId : bId]);
            closeFicha();
            window.setTimeout(() => scrollToId("sq-cara"), 60);
          }}
        />
      )}
    </div>
  );
}
