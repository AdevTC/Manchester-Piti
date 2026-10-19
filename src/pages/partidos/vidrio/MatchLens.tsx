// The big lens: the chosen jornada, with its tabs by state — Previa (the time and the light of that evening,
// the weather, el siete, the place, the kit), Directo (the score, the momentum ribbon, jugada a jugada, who is
// on the pitch), Acta (the result, the scorers, the match's signature, the MVP, the crónica) — or the one
// view of a postponed, cancelled or «pendiente del acta» jornada. Fans and members read the same; the member's
// own «¿Vas?» loads in its own chunk once hydrated (Socio.tsx), never on the server.
import { lazy, Suspense, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lens, MomentumRibbon, SeeAll, useLiveDock, type RibbonItem, type RibbonKind } from "../../../components/vidrio";
import { AddToCalendar } from "../../../components/celeste/AddToCalendar";
import type { ClubMatch } from "../../../lib/clubData";
import { matchEvent } from "../../../lib/home";
import { mapsUrl, siteOrigin, kitLabel } from "../../../lib/derived/venue";
import { onPitch } from "../../../lib/ficha";
import { parseMatchLineup } from "../../../lib/matchLineup";
import { lineupField } from "../../../lib/derived/lineupField";
import { settled, type EventGlyph } from "../../../lib/eventMeta";
import { clockReading } from "../../../../functions/src/matchClock";
import { feedOf, pulseTrack, agoText } from "../../match/directoModel";
import { useMatchWeather, type MatchWeather } from "../../../lib/weather";
import { playsLog, type PlayRow } from "../../../lib/derived/vidrio/plays";
import { matchSignature, signaturePoint } from "../../../lib/derived/vidrio/signature";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import { venueName, placeLabel } from "../model";
import { capital, endSentence, plural } from "../../../lib/derived/words";
import { distanceText, lensTabs, longDay, rivalInitials, rivalTitle, untilText, whenLine, type LensTab } from "./model";
import { Glyph, PitchLines, RivalCrest, Shirt, SignatureSvg, SunRibbon, type GlyphName } from "./bits";

const RowRsvp = lazy(() => import("../Socio").then((m) => ({ default: m.RowRsvp })));

export interface LensCtx {
  now: number;
  /** A player as a sentence names him («Adrián T.C.»). */
  nameOf: (id: string) => string;
  numOf: (id: string) => string;
  liveMinute: number | null;
  /** Hydrated and a member of the vestuario (the «¿Vas?» row). */
  member: boolean;
  /** The MVP once the vote closed (more than one when it is shared). */
  mvp: { name: string; num: string }[];
  seasonClosed: boolean;
}

interface Props {
  seg: StripSegment;
  ctx: LensCtx;
  tab: LensTab | null;
  onTab: (t: LensTab, from: number, to: number) => void;
  onCartel: () => void;
  onGrowPlays: () => void;
  /** The plays summary carries the shared view-transition-name while it is closed and was the last grown. */
  playsVt: boolean;
  onPip: () => void;
  pipOpen: boolean;
  className?: string;
}

const GLYPH: Partial<Record<EventGlyph, GlyphName>> = { ball: "ball", palo: "post", parada: "glove", cambio: "swap", faltaH: "whistle", faltaR: "whistle", penalti: "whistle", tocado: "whistle" };

export function PlayItem({ r }: { r: PlayRow }) {
  return (
    <li className={`vd-play${r.ours ? "" : " vd-play--them"}`}>
      <span className="vd-clock">{r.minuteText || "·"}</span>
      <span className={`vd-ico${r.card ? ` vd-ico--card${r.card === "r" ? " vd-ico--red" : ""}` : ""}`} aria-hidden="true">
        {r.card ? <i /> : <Glyph name={GLYPH[r.glyph] ?? "pass"} />}
      </span>
      <div>
        <b>{r.title}</b>
        {r.sub && <span>{r.sub}</span>}
      </div>
    </li>
  );
}

/** The lens declares itself the live score's home while it shows tonight's Directo (the float stays away). */
function LiveLensMark() {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLiveDock(ref, "lens");
  return <span ref={ref} className="vp-lensmark" aria-hidden="true" />;
}

function Tabs({ seg, value, onTab }: { seg: StripSegment; value: LensTab | string; onTab: Props["onTab"] }) {
  const t = lensTabs(seg);
  const ref = useRef<HTMLDivElement | null>(null);
  if (!t.tabs.length || (t.only && t.tabs.length === 1)) return <span className="vp-only">{t.only}</span>;
  const at = Math.max(0, t.tabs.findIndex((x) => x.id === value));
  const go = (to: number) => {
    const tab = t.tabs[to];
    if (!tab || tab.disabled || to === at) return;
    onTab(tab.id, at, to);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = t.tabs.map((x, i) => (x.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(at);
    let to: number | null = null;
    if (e.key === "ArrowRight") to = enabled[Math.min(enabled.length - 1, pos + 1)];
    else if (e.key === "ArrowLeft") to = enabled[Math.max(0, pos - 1)];
    else if (e.key === "Home") to = enabled[0];
    else if (e.key === "End") to = enabled[enabled.length - 1];
    if (to === null || to === undefined) return;
    e.preventDefault();
    go(to);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus();
  };
  return (
    <div ref={ref} className={`vd-glass vd-seg vp-tabs${t.tabs.some((x) => x.small) ? " vp-tabs--wide" : ""}`} role="tablist" aria-label="La jornada" style={{ "--n": t.tabs.length, "--i": at } as CSSProperties} onKeyDown={onKey}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {t.tabs.map((x, i) => (
        <button key={x.id} type="button" role="tab" className="vd-seg__b" aria-selected={i === at} aria-disabled={x.disabled || undefined} tabIndex={i === at ? 0 : -1} onClick={() => go(i)}>
          {x.label}
          {x.live && <span className="vd-livedot" role="img" aria-label="en juego" />}
          {x.small && <small>{x.small}</small>}
        </button>
      ))}
    </div>
  );
}

function Teams({ seg, size }: { seg: StripSegment; size: "dir" | "acta" }) {
  const s = seg.score ?? { gf: 0, ga: 0 };
  return (
    <div className={`vd-teams vp-teams vp-teams--${size}`}>
      <div className="vd-team">
        <img className="vd-team__crest" src="/crest-128.webp" alt="" width={68} height={68} />
        <b>Manchester Piti</b>
        <span>{seg.home ? "En casa" : "Fuera"}</span>
      </div>
      <div className="vd-scoreline vd-score" role="img" aria-label={`Manchester Piti ${s.gf}, ${seg.rival} ${s.ga}`}>
        <span className="vd-digit">{s.gf}</span>
        <span className="vd-scoreline__sep" />
        <span className="vd-digit">{s.ga}</span>
      </div>
      <div className="vd-team">
        <RivalCrest initials={rivalInitials(seg.rival, seg.match.rivalInitials)} />
        <b>{seg.rival}</b>
        <span>{seg.home ? "Fuera" : "En casa"}</span>
      </div>
    </div>
  );
}

const KIND: Record<string, RibbonKind> = {
  goal: "gol", goal_penalty: "gol", goal_freekick: "gol", opponent_goal: "gol", opponent_own_goal: "gol", own_goal: "gol",
  yellow_card: "tarjeta", opponent_yellow: "tarjeta", red_card: "roja", double_yellow: "roja", opponent_red: "roja",
  woodwork: "palo", opponent_woodwork: "palo", save: "parada", penalty_saved: "parada", chance: "ocasion", opponent_chance: "ocasion", substitution: "cambio",
};

function ribbonItems(m: ClubMatch, nameOf: (id: string) => string): RibbonItem[] {
  const feed = feedOf(m, nameOf);
  const byId = new Map(feed.map((f) => [f.id, f]));
  // (only the plays that tilt a match: goals, woodwork, saves and cards; every corner and foul would flood it)
  const SHOWN = new Set<RibbonKind>(["gol", "palo", "parada", "tarjeta", "roja"]);
  return pulseTrack(feed, m.duration ?? 50).ticks.map((t) => {
    const f = byId.get(t.id);
    return { id: t.id, x: t.x, side: t.side, goal: t.goal, h: t.h, kind: f ? (KIND[f.meta.type] ?? "otro") : ("otro" as RibbonKind), label: f ? `Minuto ${f.minute.replace("′", "")}, ${f.title.charAt(0).toLowerCase()}${f.title.slice(1)}` : "" };
  }).filter((it) => SHOWN.has(it.kind ?? "otro"));
}

/** «de la primera parte» · «Descanso» · «de la segunda parte» */
function halfWords(m: ClubMatch, now: number): { minute: boolean; text: string } {
  const phase = m.clock?.phase;
  if (phase === "halftime") return { minute: false, text: "Descanso" };
  if (phase === "ready") return { minute: false, text: "Pendiente del pitido inicial" };
  const period = m.clock ? clockReading(m.clock, now).period : null;
  return { minute: true, text: period === 2 ? "de la segunda parte" : "de la primera parte" };
}

function Previa({ seg, ctx, idBase }: { seg: StripSegment; ctx: LensCtx; idBase: string }) {
  const m = seg.match;
  const weather: MatchWeather | null = useMatchWeather(seg.state === "hoy" || seg.state === "proximo" ? m : undefined, ctx.now);
  const at = seg.at;
  const lineup = parseMatchLineup((m as ClubMatch & { lineup?: unknown }).lineup);
  const starters = m.starters ?? [];
  const showSeven = (seg.state === "hoy" || seg.state === "directo" || seg.state === "jugado") && (lineup || starters.length > 0);
  const system = lineup?.system && /^\d(-\d)+$/.test(lineup.system) ? lineup.system : null;
  const spots = lineup
    ? lineupField(lineup, []).spots.map((s) => ({ id: s.id, left: 100 - s.y, top: s.x }))
    : starters.slice(0, 7).map((id, i) => ({ id, left: [8, 30, 26, 30, 54, 54, 80][i] ?? 50, top: [50, 18, 50, 82, 34, 66, 50][i] ?? 50 }));
  const called = [...starters, ...(m.bench ?? [])];
  const bench = (m.bench ?? []).map(ctx.nameOf);
  const day = at === null ? "Fecha por confirmar" : seg.state === "hoy" ? `Hoy, ${untilText(at, ctx.now).toLowerCase()}` : seg.state === "directo" ? "Hoy, en juego" : capital(longDay(at));
  const resultTxt = seg.score && seg.letter && seg.letter !== "A" ? `${seg.letter === "G" ? "ganamos" : seg.letter === "E" ? "empatamos" : "perdimos"} ${seg.score.gf}–${seg.score.ga}` : "";
  const sub =
    seg.state === "hoy" ? "Llegad media hora antes para calentar." : seg.state === "directo" ? "Empezó a su hora." : seg.state === "jugado" ? (resultTxt ? `Se jugó: ${resultTxt}.` : "Se jugó.") : seg.state === "pendiente" ? "Se tenía que jugar a esta hora." : at !== null ? distanceText(at, ctx.now) : "";
  const conv =
    seg.state === "jugado"
      ? called.length
        ? `Fueron ${called.length} jugadores.`
        : "El acta no dice quién fue."
      : called.length
        ? endSentence(`Convocados ${called.length}: el siete${bench.length ? ` y, en el banquillo, ${new Intl.ListFormat("es", { type: "conjunction" }).format(bench)}` : ""}`)
        : seg.state === "aplazado"
          ? "La convocatoria se abre cuando haya fecha."
          : "La convocatoria se abre al acabar la jornada anterior.";
  const kit = kitLabel(m, m.home === false ? "2ª equipación" : "1ª equipación");
  const venue = m.venue ? venueName(m.venue) : "Campo por confirmar";
  return (
    <div className="vp-pre">
      <div className="vp-col vp-c1">
        <div className="vp-time">
          <span className="vd-score vp-time__n">{at === null ? "--:--" : new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(at)}</span>
          <span className="vp-time__s">
            <b>{day}</b>
            {sub}
          </span>
        </div>
        {at !== null && <SunRibbon kickoff={at} duration={m.duration ?? 50} id={`${idBase}-${seg.id}`} />}
        {seg.state !== "jugado" &&
          (weather ? (
            <p className="vp-wxnow">
              <Glyph name={weather.sky === "rain" || weather.sky === "storm" ? "rain" : weather.sky === "sun" ? "sun" : "cloud"} />
              <span>
                <b>{weather.temp}°</b> {weather.label.toLowerCase()} a la hora del pitido{weather.rain !== null ? `, ${weather.rain} % de lluvia` : ""}
                {weather.approx ? " (el de Madrid)" : ""}.
              </span>
            </p>
          ) : (
            <p className="vp-wxnone">
              <Glyph name="cloud" />
              {seg.state === "directo" ? "Sin previsión: ya se está jugando." : at !== null && at - ctx.now < 7 * 86_400_000 ? "La previsión aún no ha llegado." : "La previsión llega una semana antes."}
            </p>
          ))}
      </div>
      <span className="vp-rule" aria-hidden="true" />
      <div className="vp-col vp-c2">
        <h3 className="vp-k">{showSeven ? (seg.state === "jugado" ? "El siete que salió" : `El siete${system ? `, en ${system}` : ""}`) : "El siete"}</h3>
        {showSeven ? (
          <div className="vd-pitch vp-pitch" role="img" aria-label={`El siete: ${new Intl.ListFormat("es", { type: "conjunction" }).format(spots.map((s) => ctx.nameOf(s.id)))}`}>
            <PitchLines />
            {spots.map((s) => (
              <div key={s.id} className="vd-player" style={{ left: `${s.left}%`, top: `${s.top}%` }}>
                <Shirt num={ctx.numOf(s.id)} size={30} kit={m.kit === "away" ? "away" : "home"} />
                <span className="vd-player__name">{ctx.nameOf(s.id)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="vd-pitch vp-pitch vp-pitch--ghost">
            <PitchLines />
            {[[8, 50], [30, 18], [26, 50], [30, 82], [54, 34], [54, 66], [80, 50]].map(([l, t]) => (
              <span key={`${l}-${t}`} className="vp-ghost" style={{ left: `${l}%`, top: `${t - 8}%` }} aria-hidden="true" />
            ))}
            <p className="vp-ghostnote">Aún sin el siete: el capitán lo saca de la pizarra la víspera.</p>
          </div>
        )}
        <div className="vp-conv">
          <p className="vp-sub">{conv}</p>
          {ctx.member && (seg.state === "hoy" || seg.state === "proximo") && (
            <Suspense fallback={null}>
              <RowRsvp match={m} j={seg.jornada ?? undefined} />
            </Suspense>
          )}
        </div>
      </div>
      <span className="vp-rule" aria-hidden="true" />
      <div className="vp-col vp-c3">
        <div className="vp-mapcol">
          <div className="vp-map" aria-hidden="true">
            <svg className="vp-map__svg" viewBox="0 0 400 86" preserveAspectRatio="xMidYMid slice">
              <rect className="vp-map__bg" width="400" height="86" />
              <circle className="vp-map__park" cx="330" cy="10" r="58" />
              <path className="vp-map__road vp-map__road--big" d="M-10 70 C80 60 140 66 200 72 S330 86 410 64" />
              <path className="vp-map__road" d="M60 -5 L80 90 M250 -5 L240 90 M120 30 L400 22" />
              <rect className="vp-map__pitch" x="170" y="10" width="46" height="28" rx="2" transform="rotate(-8 193 24)" />
            </svg>
            <span className="vp-map__pin">
              <Glyph name="pin" />
            </span>
            <span className="vp-map__lab">{venue}</span>
          </div>
          <div className="vp-venue">
            <b>{venue}</b>
            <span className="vp-sub">{placeLabel(m)}</span>
          </div>
          <div className="vp-btns">
            {m.venue && (
              <a className="vd-glass vd-btn vd-btn--sm vd-press" href={mapsUrl(m.venue)} target="_blank" rel="noreferrer">
                <Glyph name="pin" />
                Cómo llegar
              </a>
            )}
            {at !== null && (seg.state === "hoy" || seg.state === "proximo") && <AddToCalendar className="vd-glass vd-btn vd-btn--sm vd-press" iconName="cal" label="Al calendario" event={matchEvent(m, siteOrigin())} />}
          </div>
        </div>
        <div className="vp-kitrow">
          <div className="vp-kit">
            <Shirt kit={m.kit === "away" ? "away" : "home"} size={40} />
            <div>
              <b>{kit === "2ª equipación" ? "Segunda equipación" : "Primera equipación"}</b>
              <span className="vp-sub">{kit === "2ª equipación" ? "La de fuera" : "Celeste y pantalón marino"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Directo({ seg, ctx, onGrowPlays, playsVt, onPip, pipOpen }: { seg: StripSegment; ctx: LensCtx; onGrowPlays: () => void; playsVt: boolean; onPip: () => void; pipOpen: boolean }) {
  const m = seg.match;
  const live = seg.state === "directo";
  const log = playsLog(m, ctx.nameOf, seg.rival);
  const cap = live ? 4 : 8;
  const shown = log.rows.slice(0, cap);
  const more = log.count - shown.length;
  const half = halfWords(m, ctx.now);
  const latest = settled(m.events).filter((e) => typeof e.elapsedSeconds === "number").sort((a, b) => (b.elapsedSeconds ?? 0) - (a.elapsedSeconds ?? 0))[0];
  const ago = live ? agoText(m, latest, ctx.now) : "";
  const field = live ? onPitch(m.starters, m.events) : [];
  const benchNow = live ? [...(m.starters ?? []), ...(m.bench ?? [])].filter((id, i, all) => !field.includes(id) && all.indexOf(id) === i) : [];
  const list = (ids: string[]) => new Intl.ListFormat("es", { type: "conjunction" }).format(ids.map(ctx.nameOf));
  const letterWord = seg.letter === "G" ? "el Piti gana" : seg.letter === "E" ? "reparto de puntos" : seg.letter === "P" ? "esta vez no" : "";
  return (
    <div className={`vp-dir${live ? "" : " vp-dir--full"}`}>
      {live && <LiveLensMark />}
      <div className="vp-dir__score">
        <Teams seg={seg} size="dir" />
        <p className="vd-status">
          {live ? (
            <>
              <span className="vd-live">En directo</span>
              {half.minute && ctx.liveMinute !== null && <span className="vd-clock">{ctx.liveMinute}′</span>}
              <span>{half.text}</span>
            </>
          ) : (
            <>
              <span>Final</span>
              <span className="vd-clock">{m.duration ?? 50}′</span>
              {letterWord && <span>{letterWord}</span>}
            </>
          )}
        </p>
        <MomentumRibbon items={ribbonItems(m, ctx.nameOf)} duration={m.duration ?? 50} now={live ? (ctx.liveMinute ?? undefined) : undefined} label={`El partido minuto a minuto: arriba aprieta el Piti, abajo ${seg.rival}`} />
        {live && <p className="vp-mesa">{ago ? `Última jugada ${ago}.` : "La mesa lo va contando jugada a jugada."}</p>}
      </div>
      <span className="vp-rule" aria-hidden="true" />
      <div className={`vp-dir__plays vd-grow-src`} style={playsVt ? { viewTransitionName: "vp-grow" } : undefined}>
        <h3 className="vp-k">Jugada a jugada</h3>
        {shown.length ? (
          <ol className={`vd-plays${live ? "" : " vp-plays2"}`}>
            {shown.map((r) => (
              <PlayItem key={r.id} r={r} />
            ))}
          </ol>
        ) : (
          <p className="vp-sub">{live ? "Aún no hay jugadas: la primera entra aquí arriba." : "El acta no trae jugadas de este partido."}</p>
        )}
        <SeeAll
          summary={
            <>
              <b>{plural(more, "jugada más", "jugadas más")}</b> {live ? "desde el minuto 1" : "en el partido"}
            </>
          }
          count={more}
          label="Ver todo el partido"
          onOpen={onGrowPlays}
        />
      </div>
      {live && (
        <div className="vp-dir__side">
          <h3 className="vp-k">En el campo ahora</h3>
          <p className="vp-oncampo">
            {field.length ? endSentence(`${list(field)}${benchNow.length ? `. En el banquillo, ${list(benchNow)}` : ""}`) : "La mesa aún no ha dicho quién está en el campo."}
          </p>
          <div className="vp-acts">
            <Link className="vd-glass vd-btn vd-btn--pri vd-press" to="/matches/$matchId" params={{ matchId: m.id }}>
              Abrir el partido
            </Link>
            <button type="button" className="vd-glass vd-btn vd-press" onClick={onPip} aria-pressed={pipOpen}>
              <Glyph name="pip" />
              Sacar el marcador
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Acta({ seg, ctx }: { seg: StripSegment; ctx: LensCtx }) {
  const m = seg.match;
  const log = playsLog(m, ctx.nameOf, seg.rival);
  const goals = log.rows.filter((r) => r.kind === "gol").sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const sig = matchSignature(m, ctx.now, "b");
  const byId = new Map(log.rows.map((r) => [r.id, r]));
  const duration = m.duration ?? 50;
  const short = seg.rival.split(/\s+/)[0];
  const labels: { id: string; minute: number; text: string; them: boolean; x: number; y: number; left: boolean }[] = [];
  for (const mk of sig?.marks ?? []) {
    if (mk.kind !== "gol" && mk.kind !== "rival" && mk.kind !== "parada") continue;
    if (labels.some((l) => Math.abs(l.minute - mk.minute) < 5)) continue;
    const row = byId.get(mk.eventId);
    const who = mk.kind === "rival" ? short : row?.people[0] ? ctx.nameOf(row.people[0]) : mk.kind === "gol" ? "Gol" : "Parada";
    const p = signaturePoint(mk.minute, duration);
    labels.push({ id: mk.eventId, minute: Math.round(mk.minute), text: who, them: mk.kind === "rival", x: p.x, y: p.y, left: p.left });
    if (labels.length >= 6) break;
  }
  const resultTxt = seg.score && seg.letter && seg.letter !== "A" ? `${seg.letter === "G" ? "ganamos" : seg.letter === "E" ? "empatamos" : "perdimos"} ${seg.score.gf}–${seg.score.ga}` : "";
  const finalLine = seg.provisional ? "Final. El acta llega en unos minutos." : `Final${resultTxt ? `, ${resultTxt}` : ""}. Acta publicada.`;
  const voteOpen = !seg.provisional && typeof m.voteClosesAt === "number" && m.voteClosesAt > ctx.now;
  const report = (m.report ?? "").trim();
  return (
    <div className="vp-acta">
      <div className="vp-col vp-acta__res">
        <Teams seg={seg} size="acta" />
        <p className="vp-final">{finalLine}</p>
        {goals.length > 0 && (
          <ol className={`vp-scorers${goals.length > 4 ? " is-many" : ""}`} aria-label="Goles">
            {goals.map((g) => (
              <li key={g.id} className={g.ours ? "" : "them"}>
                <span className="vd-clock">{g.minuteText || "·"}</span>
                <b>{g.title.replace(/^Gol (de |del )?/, "")}</b>
                {!g.ours && <span className="vd-vh"> (gol del rival)</span>}
                {g.ours && g.sub ? <span>{g.sub.replace(/^Asistencia de /, "pase de ")}</span> : <span />}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="vp-col vp-acta__sigcol">
        {sig ? (
          <>
            <figure className="vp-sigfig" role="img" aria-label="La firma del partido: los picos hacia fuera son los goles del Piti, hacia dentro los del rival">
              <span className="vp-sigfig__svg">
                <SignatureSvg sig={sig} />
              </span>
              <span className="vp-siglabs" aria-hidden="true">
                {labels.map((l) => (
                  <span key={l.id} className={`vp-siglab${l.left ? " vp-siglab--l" : ""}${l.them ? " them" : ""}`} style={{ left: `${l.x}%`, top: `${l.y}%` }}>
                    <b>{l.minute}′</b> {l.text}
                  </span>
                ))}
              </span>
            </figure>
            <p className="vp-sigcap">La firma del partido: hacia fuera aprieta el Piti, hacia dentro el rival.</p>
          </>
        ) : null}
      </div>
      <div className="vp-col vp-acta__side">
        {ctx.mvp.length > 0 ? (
          <div className="vp-mvp">
            <Shirt size={48} num={ctx.mvp[0]?.num} kit={m.kit === "away" ? "away" : "home"} />
            <div>
              <small>
                <Glyph name="star" />
                {ctx.mvp.length > 1 ? "MVP compartido" : "MVP del partido"}
              </small>
              <b>{new Intl.ListFormat("es", { type: "conjunction" }).format(ctx.mvp.map((x) => x.name))}</b>
              <span>Lo eligió el vestuario.</span>
            </div>
          </div>
        ) : voteOpen ? (
          <div className="vp-mvp vp-mvp--open">
            <div>
              <small>
                <Glyph name="star" />
                MVP del partido
              </small>
              <b>Se está votando</b>
              <span>
                El vestuario vota hasta el {longDay(m.voteClosesAt ?? ctx.now)}.{" "}
                {ctx.member && (
                  <Link className="vd-link" to="/matches/$matchId" params={{ matchId: m.id }}>
                    Votar al MVP
                  </Link>
                )}
              </span>
            </div>
          </div>
        ) : null}
        <div className="vp-cron">
          <h3 className="vp-k">La crónica</h3>
          <p>{report || (seg.provisional ? "La crónica llega con el acta." : "Este partido no tiene crónica.")}</p>
          <Link className="vd-link" to="/matches/$matchId" params={{ matchId: m.id }}>
            {report ? "Leer la crónica entera" : "Ver el partido"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Still({ seg, kind }: { seg: StripSegment; kind: "aplazado" | "suspendido" | "pendiente" }) {
  const m = seg.match;
  const big = kind === "aplazado" ? "Aplazado" : kind === "suspendido" ? "Suspendido" : "Pendiente del acta";
  const lede =
    kind === "aplazado"
      ? "Este partido se aplazó: aún no tiene fecha nueva."
      : kind === "suspendido"
        ? "Este partido no se jugará."
        : "Nadie arrancó el partido en la mesa: el resultado llegará con el acta.";
  return (
    <div className={`vp-pp vp-pp--${kind}`}>
      <p className="vp-pp__big" aria-hidden="true">
        {big}
      </p>
      <div className="vp-pp__txt">
        <p className="vd-lede">{lede}</p>
        {kind === "aplazado" && (
          <p className="vp-pp__nd">
            <Glyph name="cal" />
            <b>Nueva fecha por confirmar</b>
          </p>
        )}
        <p className="vp-sub">
          {kind === "pendiente" ? "Sin acta no hay marcador: la tabla y los números no lo cuentan todavía." : "La tabla no cuenta este partido hasta que se juegue; en el «¿y si…?» sigue entre los que faltan."}
        </p>
        <div className="vp-btns">
          {kind === "aplazado" && <AddToCalendar className="vd-glass vd-btn vd-btn--sm vd-press" iconName="cal" label="Avísame en mi calendario" feed={`${siteOrigin()}/calendario.ics`} />}
          <Link className="vd-glass vd-btn vd-btn--sm vd-press" to="/matches/$matchId" params={{ matchId: m.id }}>
            Ver el partido
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MatchLens({ seg, ctx, tab, onTab, onCartel, onGrowPlays, playsVt, onPip, pipOpen, className }: Props): ReactNode {
  const idBase = useId().replace(/:/g, "");
  const t = lensTabs(seg);
  const current = tab && t.tabs.some((x) => x.id === tab && !x.disabled) ? tab : t.initial;
  const venue = seg.match.venue ? venueName(seg.match.venue) : "Campo por confirmar";
  return (
    <Lens as="section" className={`vp-lens${className ? ` ${className}` : ""}`} aria-labelledby={`${idBase}-h`}>
      <header className="vp-lh vd-reg-1">
        <span className="vp-lh__j" aria-hidden="true">
          J{seg.jornada ?? "·"}
        </span>
        <div className="vp-lh__t">
          <h2 className="vp-lh__h" id={`${idBase}-h`}>
            <span className="vd-vh">{seg.jornada ? `Jornada ${seg.jornada}: ` : ""}</span>
            {rivalTitle(seg)}
          </h2>
          <p className="vp-lh__m">
            {whenLine(seg, ctx.now)}. {endSentence(venue)}
          </p>
        </div>
        <div className="vp-lh__end">
          <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press vp-cbtn" onClick={onCartel} aria-label="El cartel de la jornada">
            <Glyph name="share" />
            <span className="vp-cbtn__t">El cartel</span>
          </button>
          <Tabs seg={seg} value={current} onTab={onTab} />
        </div>
      </header>
      <div className="vp-lb vd-reg-2" role={t.tabs.length > 1 ? "tabpanel" : undefined} aria-label={t.tabs.length > 1 ? (t.tabs.find((x) => x.id === current)?.label ?? undefined) : undefined}>
        {current === "previa" && <Previa seg={seg} ctx={ctx} idBase={idBase} />}
        {current === "directo" && <Directo seg={seg} ctx={ctx} onGrowPlays={onGrowPlays} playsVt={playsVt} onPip={onPip} pipOpen={pipOpen} />}
        {current === "acta" && <Acta seg={seg} ctx={ctx} />}
        {(current === "aplazado" || current === "suspendido" || current === "pendiente") && <Still seg={seg} kind={current} />}
      </div>
    </Lens>
  );
}
