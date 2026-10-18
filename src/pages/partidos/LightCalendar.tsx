// «El calendario de luz»: one slice of Palomeras per jornada, each at the light of its own kick-off (the live
// one at the light of now, the played ones at night with their final), drawn by ONE WebGL context
// (PalomerasSlices). The CSS sky and the still paint first (server render); the 3D ground loads after the page,
// only when visible. The featured jornada carries the club's scoreboard object and its plinth.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { PalomerasSlices, type PalomerasFigure, type PalomerasRig, type PalomerasSliceView, type PalomerasState } from "../../components/palomeras3d";
import { useIslaHero } from "../../components/celeste/isla/heroSignal";
import type { ClubMatch } from "../../lib/clubData";
import { dateMillis, isCompleted, matchPhase } from "../../../functions/src/matchEngine";
import { scoreOf } from "../../lib/partidos";
import { settled } from "../../lib/eventMeta";
import { parseMatchLineup } from "../../lib/matchLineup";
import { lineupField } from "../../lib/derived/lineupField";
import { madridTime } from "../../lib/derived/madrid";
import { resultLetter, RESULT_WORD } from "../../lib/derived/result";
import type { MatchdayModel } from "../../lib/derived/matchday";
import type { MatchWeather } from "../../lib/weather";
import { boardOf, dayLine, isLivePhase, lightLabel, placeLabel, rivalLine, sliceLight } from "./model";

type Layout = "phone" | "tab" | "desk";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function layoutNow(): Layout {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "phone";
  if (window.matchMedia("(min-width: 1100px)").matches) return "desk";
  if (window.matchMedia("(min-width: 700px)").matches) return "tab";
  return "phone";
}

/** Default 3-2-1 spots (pitch %, y from our goal) when the match has no lineup with positions. */
const SPOTS: readonly [number, number][] = [
  [50, 8], [18, 30], [50, 26], [82, 30], [34, 54], [66, 54], [50, 80],
];

// (a slice is a postcard of the light: number-only plates, or the seven's names pile up at that size; the
// plinth and the scoreboard already say who scored)
function figuresOf(m: ClubMatch, live: boolean, nameOf: (id: string) => string, numOf: (id: string) => string): PalomerasFigure[] {
  const lineup = parseMatchLineup((m as ClubMatch & { lineup?: unknown }).lineup);
  if (lineup) {
    const field = live ? lineupField(lineup, settled(m.events)) : lineupField(lineup, []);
    return field.spots.map((s) => ({ id: s.id, num: numOf(s.id), name: nameOf(s.id), x: s.x, y: 100 - s.y, gk: s.keeper, plate: "mini" as const }));
  }
  return (m.starters ?? []).slice(0, 7).map((id, i) => ({ id, num: numOf(id), name: nameOf(id), x: SPOTS[i][0], y: SPOTS[i][1], gk: i === 0, plate: "mini" as const }));
}

interface Props {
  md: MatchdayModel;
  slices: readonly ClubMatch[];
  now: number;
  jornada: ReadonlyMap<string, number>;
  nameOf: (id: string) => string;
  numOf: (id: string) => string;
  weather: ReadonlyMap<string, MatchWeather>;
  /** The featured jornada's plinth (rendered under / beside its scene). */
  plinth: ReactNode;
}

export function LightCalendar({ md, slices, now, jornada, nameOf, numOf, weather, plinth }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const featRef = useRef<HTMLDivElement>(null);
  useIslaHero(featRef);
  const [layout, setLayout] = useState<Layout>("phone");
  const [sizes, setSizes] = useState<readonly { w: number; h: number }[]>([]);

  useIsoLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      setLayout(layoutNow());
      const boxes = [...el.querySelectorAll<HTMLElement>("[data-pl-scene]")];
      const next = boxes.map((b) => ({ w: Math.round(b.clientWidth), h: Math.round(b.clientHeight) }));
      setSizes((prev) => (prev.length === next.length && prev.every((p, i) => p.w === next[i].w && p.h === next[i].h) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slices.length]);

  const liveFeat = isLivePhase(md.phase);
  const rig: PalomerasRig = layout === "phone" ? "sliceWide" : "slice";

  const views: PalomerasSliceView[] = slices.map((m, i) => {
    const feat = i === 0;
    const live = feat && liveFeat;
    const light = sliceLight(m, now, live);
    const w = weather.get(m.id);
    const preKick = feat && ["antes", "pitido", "directo1", "descanso", "directo2", "final"].includes(md.phase);
    const s = scoreOf(m);
    const board = !feat
      ? undefined
      : live || md.phase === "final"
        ? `Piti ${s.gf}, ${m.rival ?? "rival"} ${s.ga}`
        : md.phase === "antes"
          ? `Hoy ${madridTime(dateMillis(m.date))}: Piti contra ${m.rival ?? "rival"}`
          : md.phase === "pitido"
            ? "Pendiente del pitido inicial"
            : md.phase === "aplazado"
              ? "Partido aplazado"
              : undefined;
    const state: PalomerasState = {
      at: light.at,
      floodlights: light.floodlights,
      weather: w ? { sky: w.sky, cloud: w.cloud, rain: w.rain } : null,
      away: m.home === false,
      ...(board ? { board, boardKind: "navy" as const } : {}),
      ...(preKick ? { figures: figuresOf(m, live, nameOf, numOf) } : {}),
    };
    const size = sizes[i] ?? (feat ? { w: 366, h: 290 } : { w: 366, h: 150 });
    return {
      rig: feat && layout === "tab" ? "hero820" : rig,
      spot: i + 1,
      state,
      w: Math.max(1, size.w),
      h: Math.max(1, size.h),
      className: feat ? "pl-sl pl-feat" : "pl-sl pl-sm",
      // the overlays (labels, the scoreboard, the plinth) go in as each slice's children
      children: <SliceOverlay m={m} feat={feat} md={md} now={now} j={jornada.get(m.id)} weather={w} featRef={feat ? featRef : undefined} plinth={feat ? plinth : null} />,
    };
  });

  return (
    <div ref={host} className="pl-slices-host">
      <PalomerasSlices views={views} className="pl-slices" />
    </div>
  );
}

function SliceOverlay({ m, feat, md, now, j, weather, featRef, plinth }: { m: ClubMatch; feat: boolean; md: MatchdayModel; now: number; j?: number; weather?: MatchWeather; featRef?: RefObject<HTMLDivElement | null>; plinth: ReactNode }) {
  const at = dateMillis(m.date);
  const phase = matchPhase(m, now);
  const off = phase === "postponed" || phase === "cancelled";
  const played = isCompleted(m) || phase === "awaiting_result";
  const live = feat && isLivePhase(md.phase);
  const s = scoreOf(m);
  const r = resultLetter(s.gf, s.ga);
  const lit = Number.isFinite(at) ? lightLabel(at) : null;
  const chips: { t: string; cls: string }[] = [{ t: placeLabel(m), cls: m.home === false ? "away" : "" }];
  if (off) chips.push({ t: "Campo cerrado", cls: "" });
  else if (live) chips.push({ t: "Ya con focos", cls: "" });
  else if (played) chips.push({ t: `Final, ${RESULT_WORD[r].toLowerCase()}`, cls: "" });
  else if (lit) chips.push({ t: feat && md.phase === "antes" && !lit.sunny ? "Focos al pitido" : lit.text, cls: lit.sunny ? "ok" : "" });
  if (!played && !off && !live) chips.push({ t: weather ? `${weather.temp}°, ${weather.label.toLowerCase()}` : "Sin previsión aún", cls: "" });
  const time = Number.isFinite(at) ? madridTime(at) : "—";
  const day = Number.isFinite(at) ? (feat && md.phase === "aplazado" ? `era ${dayLine(at, now)}` : dayLine(at, now, feat)) : "fecha por confirmar";
  const aria = `Jornada ${j ?? ""}, ${rivalLine(m)}, ${day} a las ${time}${played ? `: ${RESULT_WORD[r].toLowerCase()} ${s.gf} a ${s.ga}` : live ? `: en juego, ${s.gf} a ${s.ga}` : off ? ": aplazado" : ""}`.replace(/\s+/g, " ");
  const board = feat ? boardOf(md, m, now) : null;
  return (
    <>
      <div className="pl-scene" data-pl-scene ref={featRef}>
        <Link className="pl-hit" to="/matches/$matchId" params={{ matchId: m.id }} aria-label={aria} />
        <span className="pl-shade" aria-hidden="true" />
        <span className="pl-hd" aria-hidden="true">
          <span className="jn">J{j ?? "·"}</span>
          <span className="when">
            <b>{time}</b>
            {day}
          </span>
        </span>
        {board && (
          <span className="pl-sbw" aria-hidden="true">
            <span className="pl-sb">
              <span className="pl-sb-box">
                <span className="pl-sb-face">
                  <span className="pl-sb-tm">PITI</span>
                  <span className="pl-sb-dg">
                    <span className={`pl-sb-n${board.tone === "gold" ? " gold" : ""}`}>{board.gf}</span>
                    <span className="pl-sb-x">:</span>
                    <span className="pl-sb-n">{board.ga}</span>
                  </span>
                  <span className="pl-sb-tm r">{(m.rivalInitials || m.rival || "RIV").slice(0, 3).toUpperCase()}</span>
                  <span className="pl-sb-row">
                    <span className={`pl-sb-k${board.tone === "live" ? " live" : board.tone === "pending" ? " pend" : ""}`}>{board.k}</span>
                    {board.c && <span className="pl-sb-c">{board.c}</span>}
                  </span>
                </span>
                {board.plate && <span className={`pl-sb-plate${board.tone === "gold" ? " gold" : board.tone === "pending" ? " amber" : ""}`}>{board.plate}</span>}
              </span>
              <span className="pl-sb-legs">
                <i />
                <i />
              </span>
            </span>
          </span>
        )}
        {off && (
          <span className="pl-tape" aria-hidden="true">
            <b>APLAZADO</b>
            <b>SIN FECHA</b>
          </span>
        )}
        {!feat && played && (
          <span className="pl-mini" aria-hidden="true">
            <span>
              <b>
                {s.gf}–{s.ga}
              </b>
              <i>{r}</i>
            </span>
          </span>
        )}
        <span className="pl-ft" aria-hidden="true">
          <span className={`rv${off ? " off" : ""}`}>{rivalLine(m)}</span>
          <span className="lt">
            {chips.map((c) => (
              <span key={c.t} className={c.cls || undefined}>
                {c.t}
              </span>
            ))}
          </span>
        </span>
      </div>
      {plinth}
    </>
  );
}
