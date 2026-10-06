// "La carrera del Pichichi": the season replayed on the stadium board, jornada by jornada. Rows sit
// absolutely and slide to their place (transform only), bars grow, the jornada flips. It starts by
// itself once (not with reduced motion) and can be paused, replayed or jumped to any game.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PlayerAnalysis } from "../../lib/clubAnalytics";
import { formatDate } from "../../lib/clubData";
import { framesInLead, raceFrames, type RaceMetric } from "../../lib/statsView";
import { Flip } from "../../components/celeste/Flip";
import { Icon } from "../../components/celeste/icons";

const METRICS: [RaceMetric, string][] = [
  ["goals", "Goles"],
  ["assists", "Asist."],
  ["ga", "G+A"],
];
const VISIBLE = 8;
const STEP_MS = 1500;
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function RaceBoard({ rows, nameOf }: { rows: PlayerAnalysis[]; nameOf: (p: PlayerAnalysis) => string }) {
  const [metric, setMetric] = useState<RaceMetric>("goals");
  const frames = useMemo(() => raceFrames(rows, metric), [rows, metric]);
  const last = frames.length - 1;
  const [j, setJ] = useState(last);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  const play = (from: number) => {
    stop();
    setJ(from);
    if (from >= last) return;
    setPlaying(true);
    timer.current = setInterval(() => {
      setJ((cur) => {
        if (cur + 1 >= last) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setPlaying(false);
        }
        return Math.min(last, cur + 1);
      });
    }, STEP_MS);
  };
  // The first visit to the page replays the season once; reduced motion just shows the standing.
  useEffect(() => {
    if (last < 1 || reducedMotion()) return;
    const t = setTimeout(() => play(0), 900);
    return () => {
      clearTimeout(t);
      if (timer.current) clearInterval(timer.current);
    };
    // play/stop are stable enough: they only touch state setters and the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);
  useEffect(() => setJ((cur) => Math.min(cur, last)), [last]);

  if (!frames.length) return null;
  const frame = frames[Math.min(j, last)];
  // Everyone who appears at any point keeps a row (stable keys, so rows slide instead of remounting).
  const everyone = frames[last].rows.map((r) => r.id);
  for (const f of frames) for (const r of f.rows) if (!everyone.includes(r.id)) everyone.push(r.id);
  const byId = new Map(rows.map((p) => [p.id, p]));
  const at = new Map(frame.rows.map((r) => [r.id, r]));
  const max = Math.max(1, ...frame.rows.map((r) => r.value));
  const shown = Math.max(1, Math.min(VISIBLE, frames[last].rows.length));
  const leaders = frame.rows.filter((r) => r.rank === 1).map((r) => nameOf(byId.get(r.id)!));
  const m = frame.match;
  const label = METRICS.find(([k]) => k === metric)![1];
  const ended = !playing && j >= last;
  const lead = [...framesInLead(frames.slice(0, j + 1)).entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <article className="st-race" aria-labelledby="st-race-t">
      <div className="st-race-hd">
        <div className="st-race-title">
          <span className="st-new">nuevo</span>
          <h2 id="st-race-t" className="st-led">
            La carrera del Pichichi
          </h2>
          <span className="st-mono">La temporada, jornada a jornada</span>
        </div>
        <div className="st-seg sm" role="group" aria-label="Qué carrera ver">
          {METRICS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={metric === k}
              onClick={() => {
                setMetric(k);
                if (playing || j < last) play(0);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="st-jor">
        <div className="fl">
          <Flip value={`J${j + 1}`} className="st-jflip" />
          <small>JORNADA</small>
        </div>
        <div className="cap">
          <small>{formatDate(m.date)}</small>
          <Link to="/matches/$matchId" params={{ matchId: m.id }}>
            {m.goalsFor}–{m.goalsAgainst} {m.home === false ? "en casa de" : "contra"} {m.rival ?? "Rival"}
          </Link>
          <span>
            {leaders.length ? (
              <>
                En cabeza: <b>{leaders.join(", ")}</b>
              </>
            ) : (
              "Nadie ha marcado aún"
            )}
          </span>
        </div>
      </div>
      <ol className="st-rrows" style={{ height: `calc(${shown} * var(--rh))` }} aria-hidden="true">
        {everyone.map((id) => {
          const r = at.get(id);
          const p = byId.get(id)!;
          const pos = r ? r.pos : VISIBLE;
          const off = !r || r.pos >= VISIBLE;
          return (
            <li key={id} className={`st-rrow${r?.rank === 1 ? " lead" : ""}${off ? " off" : ""}`} style={{ transform: `translateY(calc(${Math.min(pos, VISIBLE)} * var(--rh)))` }}>
              <span className="rk">{r?.rank ?? ""}</span>
              <span className="sh">{p.number ?? "·"}</span>
              <span className="mid">
                <span className="nm">{nameOf(p)}</span>
                <span className="tr">
                  <i style={{ width: `${((r?.value ?? 0) / max) * 100}%` }} />
                </span>
              </span>
              <span className={`vl${r?.delta ? (j % 2 ? " hitA" : " hitB") : ""}`}>{r?.value ?? 0}</span>
            </li>
          );
        })}
      </ol>
      <ol className="hm-sr" aria-label={`${label} tras la jornada ${j + 1}`}>
        {frame.rows.slice(0, VISIBLE).map((r) => (
          <li key={r.id}>
            {r.rank}. {nameOf(byId.get(r.id)!)}: {r.value}
          </li>
        ))}
      </ol>
      {frames.length <= 12 ? (
        <div className="st-tl" role="group" aria-label="Ir a una jornada">
          {frames.map((f, i) => (
            <button
              key={f.match.id}
              type="button"
              className={i < j ? "done" : undefined}
              aria-pressed={i === j}
              aria-label={`Jornada ${i + 1}, ${f.match.rival ?? "rival"}`}
              onClick={() => {
                stop();
                setJ(i);
              }}
            >
              J{i + 1}
            </button>
          ))}
        </div>
      ) : (
        <label className="st-range">
          <span className="st-mono">
            Partido {j + 1} de {frames.length}
          </span>
          <input
            type="range"
            min={0}
            max={last}
            value={j}
            onChange={(e) => {
              stop();
              setJ(Number(e.target.value));
            }}
          />
        </label>
      )}
      <div className="st-race-ft">
        <button type="button" className="hm-btn st-play" onClick={() => (playing ? stop() : play(ended ? 0 : j))}>
          <Icon name={playing ? "pause" : ended ? "turn" : "play"} size={16} stroke={2.2} />
          {playing ? "Pausa" : ended ? "Repetir" : "Seguir"}
        </button>
        <span className="st-mono">
          {lead ? (
            <>
              Más jornadas en cabeza: <b>{nameOf(byId.get(lead[0])!)}</b> ({lead[1]})
            </>
          ) : (
            "Cada jornada, la tabla se reordena sola"
          )}
        </span>
      </div>
    </article>
  );
}

/** The gold ribbon of headlines (streaks alive, leaders, records) that runs under the board. */
export function Ticker({ lines }: { lines: string[] }) {
  const [paused, setPaused] = useState(false);
  if (!lines.length) return null;
  const run = (hidden: boolean) => (
    <span className="run" aria-hidden={hidden || undefined}>
      {lines.map((l) => (
        <span key={l}>
          <i />
          {l}
        </span>
      ))}
    </span>
  );
  return (
    <div className={`st-tick${paused ? " paused" : ""}`}>
      <span className="lab">EN EL MARCADOR</span>
      <div className="rail" aria-hidden="true">
        <div className="track">
          {run(true)}
          {run(true)}
        </div>
      </div>
      <ul className="hm-sr">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <button type="button" className="tp" onClick={() => setPaused(!paused)} aria-label={paused ? "Reanudar el rótulo" : "Pausar el rótulo"}>
        <Icon name={paused ? "play" : "pause"} size={16} />
      </button>
    </div>
  );
}
