// The hero of «La luz del partido»: CDM Palomeras under the real light (palomeras3d: the server paints the
// CSS sky, the client the still and then WebGL), with the match day told over it: the headline, the club
// scoreboard, «Arrastra el sol» and, on wide screens, the plays so far. It reacts to what happens while it is
// on screen: the lights come on (ignite), a fresh goal (goal), the MVP after the vote (mvp). The live island
// steps aside while it is in view (useIslaHero).
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Palomeras, rigDef, sunScreen, lightingOf, mix, type PalomerasHandle, type PalomerasRig, type PalomerasState } from "../../components/palomeras3d";
import { useIslaHero } from "../../components/celeste/isla/heroSignal";
import type { MatchMoment } from "../../lib/derived/moments";
import { ClubScoreboard } from "./ClubScoreboard";
import { SunScrub, type ScrubMark } from "./SunScrub";
import type { BoardFace, HeroCopy } from "./inicioModel";

export interface HeroPlay {
  id: string;
  minute: string;
  /** G (ours), OR (theirs), A (yellow), R (red), ⇄ (change), · (other). */
  k: string;
  tone: "g" | "r" | "y" | "c" | "";
  text: string;
}

interface Props {
  copy: HeroCopy;
  face: BoardFace;
  countdownTo: number | null;
  state: PalomerasState;
  plate?: string;
  /** The plays up to the minute shown (live and final), newest first. */
  plays: readonly HeroPlay[];
  playsTitle: string;
  scrub: {
    at: number;
    scrubbing: boolean;
    marks: readonly ScrubMark[];
    what: string;
    toMs: (minutes: number) => number;
    onScrub: (ms: number) => void;
    onNow: () => void;
  } | null;
  /** A fresh, server-confirmed play to react to (null: none, or scrubbing). */
  moment: MatchMoment | null;
  goalScorer: string | null;
  mvpId: string | null;
  reduced: boolean;
  stale: boolean;
}

const RIGS: readonly [string, PalomerasRig][] = [
  ["(min-width: 1100px)", "hero1440"],
  ["(min-width: 700px)", "hero820"],
];
function readRig(): PalomerasRig {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "hero390";
  return RIGS.find(([q]) => window.matchMedia(q).matches)?.[1] ?? "hero390";
}
/** The camera by width: the client picks it (and follows a resize); the server renders the phone's. */
function useRig(): PalomerasRig {
  return useSyncExternalStore(
    (on) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
      const lists = RIGS.map(([q]) => window.matchMedia(q));
      lists.forEach((l) => l.addEventListener?.("change", on));
      return () => lists.forEach((l) => l.removeEventListener?.("change", on));
    },
    readRig,
    () => "hero390",
  );
}

export function InicioHero({ copy, face, countdownTo, state, plate, plays, playsTitle, scrub, moment, goalScorer, mvpId, reduced, stale }: Props) {
  const hero = useRef<HTMLElement>(null);
  const ground = useRef<PalomerasHandle>(null);
  const rig = useRig();
  useIslaHero(hero);
  const [announce, setAnnounce] = useState("");
  const [accent, setAccent] = useState<"flip" | null>(null);

  // the lights come on while the page is open (not on arrival, not while scrubbing): «Se encienden los focos»
  const lights = state.floodlights;
  const prevLights = useRef(lights);
  const scrubbing = !!scrub?.scrubbing;
  useEffect(() => {
    const was = prevLights.current;
    prevLights.current = lights;
    if (scrubbing || was === lights || lights !== "on") return;
    ground.current?.ignite();
    setAnnounce("Se encienden los focos.");
    setAccent("flip");
    const t = window.setTimeout(() => setAccent(null), 1600);
    return () => window.clearTimeout(t);
  }, [lights, scrubbing]);

  // a fresh goal (the island's rule: only what the server confirmed, as it happens)
  const momentId = moment?.id ?? null;
  const momentKind = moment?.kind ?? null;
  useEffect(() => {
    if (!momentId || scrubbing) return;
    if (momentKind === "gol") ground.current?.goal(true, goalScorer ?? undefined);
    else if (momentKind === "golrival") ground.current?.goal(false);
  }, [momentId, momentKind, goalScorer, scrubbing]);

  // the vote closed while the page was open: the MVP's moment
  const prevMvp = useRef(mvpId);
  useEffect(() => {
    const was = prevMvp.current;
    prevMvp.current = mvpId;
    if (mvpId && was !== mvpId && was === null) ground.current?.mvp(mvpId);
  }, [mvpId]);

  // the sun on the sky (wide screens: the scrub's thumb lives in the panel; the disc marks where the light comes from)
  const { el, minutes, sky } = lightingOf(state.at, state.weather);
  const sun = sunScreen(minutes, el, rigDef(rig));
  const vars = {
    "--sx": `${(sun.x * 100).toFixed(1)}%`,
    "--sy": `${(sun.y * 100).toFixed(1)}%`,
    "--s-rim": mix("#33416a", sky.sun, Math.max(sky.golden, sky.sunI * 0.5)),
    "--s-glow": (sky.sunI * 0.9 + sky.golden * 0.4).toFixed(2),
    "--s-golden": sky.golden.toFixed(2),
  } as CSSProperties;
  const gold = moment && !scrubbing ? (moment.kind === "gol" ? "gold" : moment.kind === "golrival" ? "rival" : null) : null;

  return (
    <section ref={hero} className="ei-hero" aria-labelledby="ei-h1" style={vars} data-rig={rig}>
      <Palomeras ref={ground} rig={rig} state={state} reduced={reduced} className="ei-ground" />
      <div className="ei-fx" aria-hidden="true" />
      <span className={`ei-sun${el < -0.8 ? " down" : ""}${state.weather && state.weather.sky === "rain" ? " hid" : ""}`} aria-hidden="true" />
      <div className="ei-type">
        <p className="ei-kick">
          {copy.live && <i className="ei-live" aria-hidden="true" />}
          {stale ? "Marcador sin actualizar: reconectando" : copy.kick}
        </p>
        <h1 className="ei-h1" id="ei-h1">
          {copy.h1}
        </h1>
        <p className="ei-sub">{copy.sub}</p>
      </div>
      <ClubScoreboard face={face} countdownTo={countdownTo} plate={plate} accent={gold ?? accent} stale={stale} />
      {plays.length > 0 && (
        <div className="ei-plays">
          <h2>{playsTitle}</h2>
          <ol>
            {plays.map((p) => (
              <li key={p.id} className="ei-play">
                <span className="m">{p.minute}</span>
                <span className={`ic ${p.tone}`} aria-hidden="true">
                  {p.k}
                </span>
                <span className="tx">{p.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {scrub ? (
        <SunScrub {...scrub} />
      ) : (
        <p className="ei-hint">La luz de ahora en Palomeras, con la hora de Madrid y la previsión.</p>
      )}
      <p className="hm-sr" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
