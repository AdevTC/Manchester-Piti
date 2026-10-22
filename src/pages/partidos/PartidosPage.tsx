// Partidos, «La temporada en luz» (the «Vidrio» redesign, V-Partidos boards): the season as a ribbon of light
// — a minimap of every jornada and a window of 6–10 of them, each painted in the light of its own kick-off —
// and a big glass lens on the chosen one (Previa · Directo · Acta), with three ways of looking (Jornadas ·
// Tabla · Números; ?view=tabla and ?view=numeros), «¿Y si…?» on the jornadas still to play, el cartel, the
// filters, the rival search and the season. A desktop keeps everything inside the screen (zones scroll in
// place); ≥ 1800 px is a cockpit (Tabla, the lens and Números side by side). Server-rendered for fans: the
// member's «¿Vas?» loads in its own chunk once hydrated; live data only through the existing hooks.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { partidosVistaAt, partidosVistaPath } from "../../lib/interimScreens";
import { GrowWindow, PipWindow, Shelf, VidrioSky, openScorePip, shelfPanelId, shelfTabId, skyAt, supportsViewTransitions, swap, travel, useDesktop, useLiveDock, useMedia, useReducedMotion, type ScorePip } from "../../components/vidrio";
import { pipBottom } from "../../components/vidrio/live/liveModel";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { ThemeToggle } from "../../components/ThemeToggle";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { useSeason } from "../../context/SeasonContext";
import { useClock } from "../../hooks/useClock";
import { useViewer } from "../../hooks/useViewer";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { nameFor, nextFixture, playerForSeason, useClubData, type ClubMatch } from "../../lib/clubData";
import { useStandings } from "../../lib/useStandings";
import { currentSeasonId, mvpWinners } from "../../lib/vestuario";
import { useMvpResults } from "../vestuario/live";
import { scoreOf, shownMinute } from "../../lib/partidos";
import { useMatchWeather } from "../../lib/weather";
import { cleanSheetsByKeeper, seasonCards } from "../../lib/derived/vidrio/keepers";
import { matchLogros } from "../../lib/derived/vidrio/matchLogros";
import { siteOrigin } from "../../lib/derived/venue";
import { madridDate } from "../../lib/derived/madrid";
import { dateMillis } from "../../../functions/src/matchEngine";
import { endSentence, plural } from "../../lib/derived/words";
import { kickoffHint } from "../../lib/derived/vidrio/hints";
import { seasonLeaders } from "../../lib/derived/vidrio/leaders";
import { cartelOf } from "../../lib/derived/vidrio/cartel";
import { filterPlays, playsLog, PLAY_FILTERS, type PlayFilter } from "../../lib/derived/vidrio/plays";
import { filterStrip, pageWindow, seasonStrip, windowAround, windowAt, type StripFilter } from "../../lib/derived/vidrio/strip";
import { projectTable, remainingFixtures, simulateTable, type PickLetter, type SimPreset } from "../../lib/derived/vidrio/table";
import type { SquadMember } from "../../lib/home";
import { LiveLensMark, MatchLens, PlayItem, type LensCtx } from "./vidrio/MatchLens";
import { Ribbon } from "./vidrio/Ribbon";
import { Tabla, TableHead, TableRows } from "./vidrio/Tabla";
import { LeaderItem, Numeros } from "./vidrio/Numeros";
import { CartelSheet } from "./vidrio/Cartel";
import { Filters, RivalSearch, SeasonPicker, type SeasonOption } from "./vidrio/Tools";
import { Glyph } from "./vidrio/bits";
import { StillContext } from "./vidrio/stills";
import { clockTime, countLine, daysBetween, goalsByStretch, leaguePhrase, niceName, paintOf, seasonSpan, seasonTotals, VISTAS, windowSizeFor, type LensTab, type Vista } from "./vidrio/model";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/partidos-vidrio.css";

const subscribeNothing = () => () => {};
/** False on the server and while hydrating, true once the browser has taken over (member bits wait for it). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

/** How many jornadas the ribbon's window shows at this width (the server's guess: a desktop's 7). */
function useWindowSize(): number {
  return useSyncExternalStore(
    (on) => {
      window.addEventListener("resize", on);
      return () => window.removeEventListener("resize", on);
    },
    () => windowSizeFor(window.innerWidth),
    () => 7,
  );
}

type GrowKind = "plays" | "tabla" | "gol" | "asi";
interface Sim {
  season: string;
  picks: Record<string, PickLetter>;
  preset: SimPreset;
}

const competitionOf = (list: readonly ClubMatch[]): string => leaguePhrase(list.find((m) => m.competition)?.competition);

/** While a closed season is on screen the live score stays off this page (its matches are not tonight's):
 *  a mark that always counts as «the lens shows it». */
function FloatAway() {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLiveDock(ref, "lens");
  return <span ref={ref} className="vp-floataway" aria-hidden="true" />;
}

export function PartidosPage() {
  const { matches, players, loading, error } = useClubData();
  const { seasons } = useSeason();
  const navigate = useNavigate();
  const now = useClock(30_000);
  const viewer = useViewer();
  const hydrated = useHydrated();
  const member = hydrated && viewer.member;
  const desktop = useDesktop();
  const cockpit = useMedia("(min-width: 1800px)");
  const size = useWindowSize();
  const theme = useDocumentTheme();
  const mvpResults = useMvpResults();
  const reduced = useReducedMotion();

  const url: { temporada?: unknown } = useSearch({ strict: false });
  // (each vista is an address: /partidos, /partidos/tabla, /partidos/balance)
  const vista: Vista = partidosVistaAt(useLocation({ select: (l) => l.pathname }));

  // the season: the one this page's address asks for (?temporada=…, never a choice remembered from another
  // visit), else the one being played
  const current = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const asked = typeof url.temporada === "string" ? url.temporada : null;
  const seasonId = asked && seasons.some((s) => s.id === asked) ? asked : current;
  const setSeason = (id: string) => void navigate({ to: ".", search: (prev) => ({ ...prev, temporada: id === current ? undefined : id }) });
  const season = seasons.find((s) => s.id === seasonId);
  const seasonName = season?.name ?? "La temporada";
  const closed = !!seasonId && seasonId !== current;
  const { standings } = useStandings(seasonId || undefined);

  // names: as a sentence names them («Adrián T.C.»), with the season's dorsal
  const squad: SquadMember[] = players
    .filter((p) => p.seasons?.includes(seasonId))
    .map((raw) => {
      const p = playerForSeason(raw, seasonId, seasons);
      return { id: p.id, name: niceName(nameFor(p, seasonId)), num: p.number != null ? String(p.number) : "" };
    });
  const nameOf = (id: string) => niceName(nameFor(players.find((p) => p.id === id), seasonId || undefined));
  const numOf = (id: string) => squad.find((s) => s.id === id)?.num ?? "";

  // ── the strip of the season
  const strip = seasonStrip(matches, seasonId, now);
  const segs = strip.segments;
  const liveSeg = segs.find((s) => s.state === "directo") ?? null;
  const liveMinute = liveSeg ? shownMinute(liveSeg.match, now) : null;
  // the jornada of the day: live or still to play, else played, waiting for its acta or postponed today
  const todaySeg = closed ? null : strip.todayIndex !== null ? (segs[strip.todayIndex] ?? null) : (segs.find((s) => s.at !== null && daysBetween(now, s.at) === 0 && (s.state === "jugado" || s.state === "pendiente" || s.state === "aplazado")) ?? null);
  const tonightWeather = useMatchWeather(todaySeg?.state === "hoy" ? todaySeg.match : undefined, now);

  // ── what the viewer chose
  const [selRaw, setSel] = useState<{ season: string; id: string } | null>(null);
  const [tabRaw, setTab] = useState<{ id: string; tab: LensTab } | null>(null);
  const [filter, setFilter] = useState<StripFilter>("todos");
  const [ws, setWs] = useState<{ season: string; start: number } | null>(null);
  const [simRaw, setSim] = useState<Sim | null>(null);
  const [grow, setGrow] = useState<{ open: GrowKind | null; from: GrowKind | null }>({ open: null, from: null });
  const [pf, setPf] = useState<PlayFilter>("todo");
  const [cartel, setCartel] = useState(false);
  const [pip, setPip] = useState<ScorePip | null>(null);
  const [sweep, setSweep] = useState(0);
  // (the glint sweeps once across the lens after a pick; never under reduced motion)
  useEffect(() => {
    if (!sweep) return;
    const t = setTimeout(() => setSweep(0), 1100);
    return () => clearTimeout(t);
  }, [sweep]);

  // what the page opens on: the jornada of today (live or still to play), else the one just played (its acta,
  // within a day) or postponed today, else the next one to play (seasonStrip focus)
  const recent = strip.todayIndex === null ? [...segs].reverse().find((s) => s.at !== null && (s.state === "aplazado" ? daysBetween(now, s.at) === 0 : (s.state === "jugado" || s.state === "pendiente") && s.at <= now && now - s.at < 86_400_000)) : undefined;
  const focusId = recent?.id ?? (strip.focusIndex !== null ? (segs[strip.focusIndex]?.id ?? null) : null);
  const selId = selRaw && selRaw.season === seasonId && segs.some((s) => s.id === selRaw.id) ? selRaw.id : focusId;
  const sel = segs.find((s) => s.id === selId) ?? null;
  const tab = tabRaw && tabRaw.id === selId ? tabRaw.tab : null;
  const sim = simRaw && simRaw.season === seasonId ? simRaw : { season: seasonId, picks: {}, preset: "nada" as SimPreset };

  const list = filterStrip(segs, filter);
  const selInList = list.findIndex((s) => s.id === selId);
  // (Tabla on a desktop opens the ribbon on what is still to play, one jornada back: «¿Y si…?» lives there)
  const firstAhead = list.findIndex((s) => s.state === "hoy" || s.state === "proximo");
  const firstOpen = firstAhead >= 0 ? firstAhead : list.findIndex((s) => s.state === "aplazado");
  const simWindow = vista === "tabla" && desktop && !closed && firstOpen >= 0;
  const win = ws && ws.season === seasonId ? windowAt(ws.start, size, list.length) : simWindow ? windowAt(firstOpen - 1, size, list.length) : windowAround(Math.max(0, selInList), size, list.length);

  // ── the table, «si acaba así» and «¿y si…?»
  const rows = standings?.rows ?? null;
  const fixtures = closed ? [] : remainingFixtures(matches, seasonId, now);
  // tonight counts in the table as it ends: live («si acaba así»), or played with the standings not updated yet
  const tonightIn = liveSeg ?? (todaySeg?.state === "jugado" && todaySeg.score && (todaySeg.provisional || (standings?.jornada != null && todaySeg.jornada !== null && standings.jornada < todaySeg.jornada)) ? todaySeg : null);
  const live = tonightIn?.score ? { rival: tonightIn.rival, gf: tonightIn.score.gf, ga: tonightIn.score.ga } : null;
  const simulation = rows ? (closed ? projectTable(rows, null) : simulateTable(rows, fixtures, sim.picks, sim.preset, { live })) : null;
  const real = rows ? projectTable(rows, live) : null;

  // ── números
  const leaders = seasonLeaders(matches, seasonId, squad, now);
  const playedMatches = segs.filter((s) => s.state === "jugado").map((s) => s.match);
  const goals = segs.reduce((a, s) => (s.score && (s.state === "jugado" || s.state === "directo") ? { gf: a.gf + s.score.gf, ga: a.ga + s.score.ga } : a), { gf: 0, ga: 0 });
  const remaining = segs.filter((s) => s.state === "hoy" || s.state === "proximo" || s.state === "aplazado").length;
  const totals = seasonTotals(real?.us ?? null, goals, real?.position ?? null, remaining, !!liveSeg, closed, segs.length);
  const stretch = goalsByStretch(segs.filter((s) => s.state === "jugado" || s.state === "directo").map((s) => s.match));
  const keeperRow = cleanSheetsByKeeper(playedMatches, scoreOf, liveSeg?.match ?? null)[0] ?? null;
  const keeper = keeperRow ? { name: nameFor(players.find((p) => p.id === keeperRow.id), seasonId || undefined), num: numOf(keeperRow.id), clean: keeperRow.clean, provisional: keeperRow.provisional } : null;
  const cards = seasonCards(playedMatches, liveSeg?.match ?? null);
  const left = closed || !remaining ? null : { value: remaining, text: `${plural(remaining, "jornada")}${todaySeg?.state === "hoy" ? ", la primera hoy" : ""}` };

  // ── the real kit stills: each player's own (name and number printed as on the real shirt), both kits; the
  // kit's blank still under a set number, and before it the drawn shirt, stand in until it is ready
  const printed = players.filter((p) => p.seasons?.includes(seasonId)).map((raw) => {
    const p = playerForSeason(raw, seasonId, seasons);
    return { name: nameFor(p, seasonId), num: p.number != null ? String(p.number) : "" };
  });
  const stillOf = usePageKitStills({ on: hydrated, theme, kits: ["home", "away"], players: printed });

  // ── actions (each runs through the kit's choreography: exit → morph → enter)
  const pick = (id: string, focus?: boolean) => {
    const from = segs.findIndex((s) => s.id === selId);
    const to = segs.findIndex((s) => s.id === id);
    const inList = list.some((s) => s.id === id);
    if (!reduced && id !== selId) setSweep((n) => n + 1);
    void swap(to >= from ? "right" : "left", () => {
      setSel({ season: seasonId, id });
      if (!inList) setFilter("todos");
      const l = inList ? list : segs;
      const at = l.findIndex((s) => s.id === id);
      const inWin = inList && at >= win.start && at < win.end;
      if (!inWin) setWs(null);
      setGrow((g) => ({ open: null, from: g.from }));
    }).finished.then(() => {
      if (focus) document.querySelector<HTMLButtonElement>(`.vp-seg[data-seg="${id}"]`)?.focus();
    });
  };
  const page = (dir: 1 | -1) => {
    const next = pageWindow(win.start, dir, size, list.length);
    if (next.start === win.start) return;
    swap(dir > 0 ? "right" : "left", () => setWs({ season: seasonId, start: next.start }));
  };
  const windowAroundIndex = (i: number) => {
    const at = list.findIndex((s) => s.id === segs[i]?.id);
    if (at < 0) return;
    const w = windowAround(at, size, list.length);
    if (w.start !== win.start) setWs({ season: seasonId, start: w.start });
  };
  const goHoy = () => {
    if (focusId) pick(focusId);
  };
  const setVista = (v: Vista) => {
    if (v === vista) return;
    const from = VISTAS.findIndex((x) => x.id === vista);
    const to = VISTAS.findIndex((x) => x.id === v);
    swap(travel(from, to), () => {
      setGrow((g) => ({ open: null, from: g.from }));
      // (another screen: its own parameters start afresh, the season stays)
      void navigate({ to: partidosVistaPath(v), search: () => ({ temporada: typeof url.temporada === "string" ? url.temporada : undefined }) });
    });
  };
  const onSim = (id: string, l: PickLetter) =>
    setSim(() => {
      const picks = { ...sim.picks };
      if (picks[id] === l) delete picks[id];
      else picks[id] = l;
      return { ...sim, picks };
    });
  // focus follows the window: into its title when it grows, back to «Ver todo» when it closes (on a phone the
  // summary is hidden while the window is open, so the browser alone would drop focus to the page's start)
  const opener = useRef<HTMLElement | null>(null);
  const openGrow = (k: GrowKind) => {
    opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const run = () =>
      void swap("up", () => {
        setGrow({ open: k, from: k });
        setPf("todo");
      }).finished.then(() => document.querySelector<HTMLElement>(".vp-grow .vd-grow__head h2")?.focus());
    // (with View Transitions the summary first takes the shared name, a frame before the change is captured)
    if (!supportsViewTransitions()) return run();
    setGrow({ open: null, from: k });
    requestAnimationFrame(run);
  };
  const closeGrow = () =>
    void swap("up", () => setGrow((g) => ({ open: null, from: g.from }))).finished.then(() => {
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus();
    });
  const onPip = () => {
    if (pip) {
      pip.close();
      setPip(null);
      return;
    }
    void openScorePip({ width: 340, height: 160, title: "Manchester Piti, en directo" }).then(setPip);
  };
  const closePip = () => {
    pip?.close();
    setPip(null);
  };

  // ── the light: the chosen jornada's kick-off, the live one's now
  const light = (() => {
    if (sel && (vista === "jornadas" || cockpit)) {
      if (sel.state === "directo") return skyAt(now, true);
      if (sel.light) return { light: sel.light.light, floodlit: sel.light.floodlights };
    }
    return skyAt(now, !!liveSeg);
  })();

  // ── the words around
  const usRow = real?.us ?? null;
  const evening = (at: number | null) => at !== null && Number(clockTime(at).slice(0, 2)) >= 17;
  const tonightHint = liveSeg?.jornada
    ? `J${liveSeg.jornada} en directo`
    : todaySeg?.state === "hoy"
      ? `J${todaySeg.jornada ?? ""} ${evening(todaySeg.at) ? "esta noche" : "hoy"}`
      : todaySeg?.state === "jugado" && todaySeg.score
        ? `J${todaySeg.jornada ?? ""}: ${todaySeg.score.gf}–${todaySeg.score.ga}`
        : todaySeg?.state === "pendiente"
          ? `J${todaySeg.jornada ?? ""}: pendiente del acta`
          : closed || !remaining
        ? "Todo jugado"
        : (() => {
            const next = segs.find((s) => s.state === "proximo");
            return next?.at ? `J${next.jornada ?? ""}: ${kickoffHint(next.at, now)}` : "Por jugar";
          })();
  const tablaHint = usRow && real?.position ? `${liveSeg ? "Si acaba así: " : ""}${real.position}º con ${usRow.pts} ${usRow.pts === 1 ? "punto" : "puntos"}` : "Sin publicar";
  const places = [
    { id: "jornadas", label: "Jornadas", hint: tonightHint },
    { id: "tabla", label: "Tabla", hint: tablaHint },
    { id: "numeros", label: "Números", hint: leaders.goalsHint },
  ];
  const count = countLine(strip.counts, remaining, filter, list.length);
  const options: SeasonOption[] = [...seasons].reverse().map((s) => {
    const own = matches.filter((m) => m.seasonId === s.id);
    const comp = (s.id === seasonId ? leaguePhrase(standings?.competition) : "") || competitionOf(own);
    const span = seasonSpan(own.map((m) => dateMillis(m.date)).filter(Number.isFinite).map(madridDate));
    return {
      id: s.id,
      name: s.name,
      tail: s.id === current ? comp : span || comp,
      sub: s.id === current ? `La de ahora${comp ? `, ${comp}` : ""}` : `Archivada${span ? `: ${span}` : ""}, ${own.length} ${own.length === 1 ? "partido" : "partidos"}`,
    };
  });
  // the logros this acta unlocked (debut, first goal, hat-trick…), over every match of the club
  const selActa = sel && sel.state === "jugado" && !sel.provisional ? sel.match : null;
  // (the React Compiler memoizes this on its inputs)
  const logros = selActa ? matchLogros(selActa, matches, nameOf, { mvpResults, now }).map((l) => ({ icon: l.icon, text: l.text })) : [];
  const selMvp = sel && sel.state === "jugado" ? mvpWinners(sel.match, mvpResults.get(sel.match.id), now).map((id) => ({ name: nameOf(id), num: numOf(id) })) : [];
  const cartelData = sel ? { cartel: cartelOf(sel.match, { jornada: sel.jornada, seasonName, nameOf, now, mvp: selMvp[0]?.name ?? null }), paint: paintOf(sel) } : null;
  const ctx: LensCtx = {
    now,
    nameOf,
    numOf,
    liveMinute,
    member,
    me: member && viewer.playerId ? viewer.playerId : null,
    captainId: season?.captainPlayerId ?? null,
    mvp: selMvp,
    mvpTurnout: (() => {
      const r = sel ? mvpResults.get(sel.match.id) : undefined;
      return r ? { total: r.total, eligible: typeof r.eligible === "number" && r.eligible > 0 ? r.eligible : null } : null;
    })(),
    seasonClosed: closed,
    tonight: !!sel && !!todaySeg && sel.id === todaySeg.id,
    logros,
    // (the cockpit shows the cartel inline in the lens)
    cartel: cockpit ? cartelData : null,
  };
  const simMode = vista === "tabla" && desktop && !closed;
  const results = simulation?.results ?? {};
  const busy = loading && !matches.length;
  const idBase = "vp-vista";
  const lastPlayed = [...segs].reverse().find((s) => s.state === "jugado")?.jornada ?? null;

  const growWindow = (() => {
    if (!grow.open) return null;
    if (grow.open === "plays" && sel) {
      const log = playsLog(sel.match, nameOf, sel.rival);
      const rowsShown = filterPlays(log.rows, pf);
      const halves = rowsShown.length ? [...new Map(rowsShown.map((r) => [r.half, r.half])).keys()].map((h) => ({ h, label: h === 2 ? "Segunda parte" : h === 1 ? "Primera parte" : "Sin minuto", rows: rowsShown.filter((r) => r.half === h) })) : [];
      const seg = PLAY_FILTERS.findIndex((f) => f.id === pf);
      return (
        <GrowWindow
          open
          name="vp-grow"
          className="vp-grow"
          title={`Jugada a jugada, J${sel.jornada ?? ""}`}
          sub={sel.state === "directo" ? `${log.count} jugadas hasta el minuto ${liveMinute ?? 0}; las nuevas entran arriba.` : `${log.count} jugadas, del pitido al final.`}
          filters={
            <div className="vd-glass vd-seg vp-pfilt" role="group" aria-label="Qué jugadas" style={{ "--n": 4, "--i": seg } as CSSProperties}>
              <span className="vd-shelf__bead" aria-hidden="true" />
              {PLAY_FILTERS.map((f) => (
                <button key={f.id} type="button" className="vd-seg__b" aria-pressed={pf === f.id} onClick={() => setPf(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          }
          onClose={closeGrow}
        >
          {ctx.tonight && <LiveLensMark />}
          {halves.length ? (
            halves.map((h) => (
              <div key={String(h.h)}>
                <div className="vd-grow__sec">{h.label}</div>
                <ol className="vd-plays vp-plays2">
                  {h.rows.map((r) => (
                    <PlayItem key={r.id} r={r} />
                  ))}
                </ol>
              </div>
            ))
          ) : (
            <p className="vp-empty">Nada de eso en este partido.</p>
          )}
        </GrowWindow>
      );
    }
    if (grow.open === "tabla" && simulation) {
      const anySim = simulation.picked > 0 || simulation.filled > 0;
      // («Últimos 5»: the league's form of each team, when the table brings it)
      const form = simulation.rows.some((r) => (r.form?.length ?? 0) > 0);
      return (
        <GrowWindow open name="vp-grow" className="vp-grow" title="La tabla entera" sub={`Los ${simulation.rows.length} equipos${anySim ? ", con tus resultados de mentira." : form ? ", con la forma de cada uno." : "."}`} onClose={closeGrow}>
          <table className="vd-table vp-tfull">
            <caption className="vd-vh">La tabla entera</caption>
            <TableHead full form={form} />
            <tbody>
              <TableRows rows={simulation.rows} full anySim={anySim} live={!!liveSeg} form={form} />
            </tbody>
          </table>
        </GrowWindow>
      );
    }
    if (grow.open === "gol" || grow.open === "asi") {
      const list = grow.open === "gol" ? leaders.goals : leaders.assists;
      return (
        <GrowWindow open name="vp-grow" className="vp-grow" title={grow.open === "gol" ? "Todos los goleadores" : "Todas las asistencias"} sub={grow.open === "gol" ? leaders.goalsLine : leaders.assistsLine} onClose={closeGrow}>
          <ol className="vp-rank vp-rank--full">
            {list.map((r) => (
              <LeaderItem key={r.id} r={r} nice={niceName} pos />
            ))}
          </ol>
        </GrowWindow>
      );
    }
    return null;
  })();

  const panelCls = (v: Vista) => `vp-panel vp-panel--${v}${vista === v ? " is-on" : ""}`;
  const announce = sel ? endSentence(`J${sel.jornada ?? ""}, ${sel.home ? "contra" : "en casa de"} ${sel.rival}`) : "";
  const backToNow = () => swap("up", () => setSeason(current));

  return (
    <StillContext.Provider value={stillOf}>
      <div className={`vx vp${grow.open ? " vp-growing" : ""}${closed ? " vp-arch" : ""}${cockpit ? " vp-cockpit" : ""}${!segs.length ? " vp-nojor" : ""}`} aria-busy={loading}>
        <VidrioSky light={light.light} floodlit={light.floodlit} />
        <CelesteHeader active="partidos" sub="Partidos" actions={<ThemeToggle />} live={liveSeg ? true : undefined} />
        {closed && hydrated && <FloatAway />}
        <main className="vp-stage">
          <h1 className="vd-vh">Partidos</h1>
          <div className="vp-tools">
            <div className="vp-tools__l">
              {options.length > 0 && <SeasonPicker options={options} value={seasonId} onPick={(id) => swap("up", () => setSeason(id))} />}
              {segs.length > 0 && (
                <Filters
                  value={filter}
                  onChange={(f) => {
                    const from = ["todos", "proximos", "resultados"].indexOf(filter);
                    const to = ["todos", "proximos", "resultados"].indexOf(f);
                    swap(to > from ? "right" : "left", () => {
                      setFilter(f);
                      setWs(null);
                    });
                  }}
                />
              )}
              {closed ? (
                <p className="vp-archbar">
                  <Glyph name="lock" />
                  Archivada.{" "}
                  <button type="button" className="vd-link" onClick={backToNow}>
                    Volver a la de ahora
                  </button>
                </p>
              ) : (
                <p className="vp-count" aria-live="polite">
                  {count}
                </p>
              )}
            </div>
            {segs.length > 0 && (
              <div className="vp-tools__r">
                <RivalSearch segments={segs} onJump={(id) => pick(id)} />
              </div>
            )}
          </div>
          {closed && (
            <p className="vp-archbar vp-archbar--m">
              <Glyph name="lock" />
              <span>Temporada archivada: todo jugado.</span>{" "}
              <button type="button" className="vd-link" onClick={backToNow}>
                Volver a la de ahora
              </button>
            </p>
          )}

          {error ? (
            <section className="vd-glass vd-lens vp-lens vp-state" role="alert" aria-labelledby="vp-err">
              <h2 id="vp-err" className="vd-h3">
                No nos llegan los partidos
              </h2>
              <p className="vd-body">Suele ser la conexión o el servidor del club. Dale otra vez en un momento; lo que ya viste sigue guardado.</p>
              <div className="vp-btns">
                <button type="button" className="vd-glass vd-btn vd-btn--pri vd-press" onClick={() => window.location.reload()}>
                  Reintentar
                </button>
              </div>
            </section>
          ) : busy ? (
            <section className="vp-skel" aria-busy="true" aria-label="Cargando los partidos">
              <div className="vp-skel__rib" />
              <div className="vp-skel__lens" />
            </section>
          ) : (
            <>
              {segs.length > 0 && (
                <Ribbon
                  strip={strip}
                  list={list}
                  win={win}
                  selId={selId}
                  now={now}
                  liveMinute={liveMinute}
                  simMode={simMode}
                  picks={sim.picks}
                  results={results}
                  onPick={pick}
                  onPage={page}
                  onWindowAround={windowAroundIndex}
                  onSim={onSim}
                  onHoy={goHoy}
                  hoyDisabled={!focusId || (selId === focusId && win.start <= Math.max(0, list.findIndex((s) => s.id === focusId)) && list.findIndex((s) => s.id === focusId) < win.end)}
                  dock={desktop && !closed}
                  tonightTemp={tonightWeather?.temp ?? null}
                />
              )}
              <div className="vp-shelfbar">
                <Shelf places={places} value={vista} onChange={(id) => setVista(id as Vista)} label="Qué ver" idBase={idBase} className="vp-vistas" />
              </div>
              <div className={`vp-main${grow.open ? " is-grow" : ""}`}>
                <div id={shelfPanelId(idBase, "tabla")} role="tabpanel" aria-labelledby={shelfTabId(idBase, "tabla")} className={`${panelCls("tabla")}${cockpit ? " vd-glass vd-window" : ""}${grow.open && grow.open !== "tabla" ? " vd-stepback" : ""}`}>
                  <Tabla
                    sim={simulation}
                    hasTable={!!rows}
                    fixtures={fixtures}
                    picks={sim.picks}
                    preset={sim.preset}
                    onPick={onSim}
                    onPreset={(p) => setSim({ ...sim, preset: p })}
                    onReset={() => setSim({ season: seasonId, picks: {}, preset: "nada" })}
                    live={!!liveSeg}
                    closed={closed}
                    segments={segs}
                    lastPlayed={lastPlayed}
                    tonightJ={tonightIn?.jornada ?? null}
                    startsToday={!lastPlayed && todaySeg?.state === "hoy"}
                    onGrow={() => openGrow("tabla")}
                    tablaVt={!grow.open && grow.from === "tabla"}
                    onTry={() => setVista("tabla")}
                    vistaOn={vista === "tabla"}
                    seasonName={seasonName}
                  />
                </div>
                <div id={shelfPanelId(idBase, "jornadas")} role="tabpanel" aria-labelledby={shelfTabId(idBase, "jornadas")} className={panelCls("jornadas")}>
                  {sel ? (
                    <MatchLens
                      seg={sel}
                      ctx={ctx}
                      tab={tab}
                      onTab={(t, a, b) => swap(b >= a ? "right" : "left", () => setTab({ id: sel.id, tab: t }))}
                      onCartel={() => setCartel(true)}
                      onGrowPlays={() => openGrow("plays")}
                      playsVt={!grow.open && grow.from === "plays"}
                      onPip={onPip}
                      pipOpen={!!pip}
                      sweep={!!sweep}
                      className={grow.open ? "vd-stepback" : undefined}
                    />
                  ) : (
                    !error && (
                      <section className="vd-glass vd-lens vp-lens vp-state" aria-labelledby="vp-pre">
                        <h2 id="vp-pre" className="vd-h3">
                          El calendario aún no está
                        </h2>
                        <p className="vd-body">En cuanto la liga lo publique aparecerán aquí las jornadas, cada una con su hora, su campo y la luz del pitido.</p>
                        <div className="vp-btns">
                          <AddToCalendar className="vd-glass vd-btn vd-btn--pri vd-press" iconName="cal" label="Avísame en mi calendario" feed={`${siteOrigin()}/calendario.ics`} />
                        </div>
                      </section>
                    )
                  )}
                </div>
                <div id={shelfPanelId(idBase, "numeros")} role="tabpanel" aria-labelledby={shelfTabId(idBase, "numeros")} className={`${panelCls("numeros")}${cockpit ? " vd-glass vd-window" : ""}${grow.open && grow.open !== "gol" && grow.open !== "asi" ? " vd-stepback" : ""}`}>
                  <Numeros
                    totals={totals}
                    leaders={leaders}
                    stretch={stretch}
                    keeper={keeper}
                    cards={cards}
                    left={left}
                    today={todaySeg?.state === "hoy" || todaySeg?.state === "directo"}
                    onGrow={openGrow}
                    growVt={!grow.open && (grow.from === "gol" || grow.from === "asi") ? grow.from : null}
                    nice={niceName}
                    duration={segs.find((s) => s.match.duration)?.match.duration ?? 50}
                  />
                </div>
                {growWindow}
              </div>
            </>
          )}
          <p className="vd-vh" aria-live="polite">
            {announce}
          </p>
        </main>
        <CelesteFooter />
        <CelesteDock active="partidos" live={liveSeg ? true : undefined} />
        {cartel && cartelData && <CartelSheet cartel={cartelData.cartel} paint={cartelData.paint} onClose={() => setCartel(false)} />}
        {liveSeg && (
          <PipWindow pip={pip} title={`Manchester Piti contra ${liveSeg.rival}`} onClose={closePip} bottom={pipBottom("/partidos")}>
            <span className="vd-score">
              {liveSeg.score?.gf ?? 0}–{liveSeg.score?.ga ?? 0}
            </span>
            <p>
              <b>{liveSeg.rival}</b>
              {liveMinute !== null && <span className="vd-clock">{liveMinute}′</span>} {liveSeg.match.clock?.phase === "halftime" ? "descanso" : ""}
            </p>
          </PipWindow>
        )}
      </div>
    </StillContext.Provider>
  );
}

export default PartidosPage;

