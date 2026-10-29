// The lens of the portada: the match of the day (our crest and the rival's, the score, the hour or the state in
// words, the status line and the scorers) over «La moviola» (the 50 minutes: drag it, touch a play, or let it
// play, and the score, the sky, the pitch and the plays go back to that minute), «La tarde» before the whistle,
// «El último» between matches, or the still when there is nothing to play. It morphs into the screens' capsule
// (view-transition-name in-score) and tells the live system it is on screen (the floating score keeps away).
import { useId, useRef } from "react";
import { MatchLink } from "./links";
import { Lens, useLiveDock } from "../../../components/vidrio";
import type { LensView, MovView } from "./model";
import { PI } from "./ui";
import { RivalMark } from "../../../components/vidrio/RivalMark";

export interface LensActions {
  seek: (m: number) => void;
  mark: (m: number) => void;
  prev: () => void;
  next: () => void;
  toggle: () => void;
  back: () => void;
  campo: (e: React.MouseEvent) => void;
}

export function InicioLens({ lens, mov, playing, fx, acts, actaId, live }: { lens: LensView; mov: MovView; playing: boolean; fx: "gold" | "cold" | null; acts: LensActions; actaId: string | null; live: boolean }) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement | null>(null);
  useLiveDock(ref, "lens");
  const cls = ["pp-lens", "in-lens", fx === "gold" ? "is-goal vd-rim-gold" : "", lens.pre ? "is-pre" : "", lens.off ? "is-off" : ""].filter(Boolean).join(" ");
  return (
    <div ref={ref} className="in-lensbox vd-morph" style={{ viewTransitionName: "in-score" }}>
      <Lens as="section" className={cls} aria-label={lens.aria} refract={{ bezel: 22, strength: 1.3, blur: 10 }}>
        <span className="pp-lens__halo" aria-hidden="true" />
        <div className="pp-lens__board">
          <p className="in-lens__k">
            <span>{lens.kicker}</span>
          </p>
          <div className="vd-teams pp-teams">
            <div className="vd-team">
              <img className="vd-team__crest" src="/crest-128.webp" alt="" width={68} height={68} />
              <b>
                <span className="pp-long">Manchester Piti</span>
                <span className="pp-short">Piti</span>
              </b>
              <span>{lens.usWhere}</span>
            </div>
            <div className="pp-mid">
              {lens.face === "score" && (
                <p className="vd-scoreline vd-score in-score" role="img" aria-label={lens.scoreLabel}>
                  <span className="vd-digit" aria-hidden="true">
                    {lens.us}
                  </span>
                  <span className="vd-scoreline__sep" aria-hidden="true" />
                  <span className="vd-digit" aria-hidden="true">
                    {lens.them}
                  </span>
                </p>
              )}
              {lens.face === "time" && (
                <p className="vd-score in-kick" role="img" aria-label={lens.scoreLabel}>
                  <span className="vd-digit" aria-hidden="true">
                    {lens.time}
                  </span>
                </p>
              )}
              {lens.face === "word" && (
                <p className="pp-word" role="img" aria-label={lens.scoreLabel}>
                  <span aria-hidden="true">{lens.word}</span>
                </p>
              )}
            </div>
            <div className="vd-team">
              {lens.code ? (
                <span className="vd-team__crest vd-team__crest--rival" aria-hidden="true">
                  <RivalMark logo={lens.logo}>{lens.code}</RivalMark>
                </span>
              ) : (
                <span className="vd-team__crest vd-team__crest--rival" aria-hidden="true" />
              )}
              <b>{lens.rival}</b>
              <span>{lens.themWhere}</span>
            </div>
          </div>
          <p className="vd-status pp-status">
            {lens.live && <span className="vd-live">En directo</span>}
            {lens.clock && <span className="vd-clock">{lens.clock}</span>}
            <span>{lens.status}</span>
          </p>
          {lens.hasScorers && (
            <div className="pp-scorers in-scorers">
              <ul className="pp-scorers__us" aria-label="Goles del Piti">
                {lens.ours.map((g, k) => (
                  <li key={k} className={g.later ? "is-later" : undefined}>
                    <span className="vd-clock">{g.m}</span> {g.name}
                  </li>
                ))}
              </ul>
              <ul className="pp-scorers__them" aria-label={`Goles de ${lens.rival}`}>
                {lens.theirs && (
                  <li>
                    <b>{lens.rivalShort}</b> <span className="vd-clock in-mins">{lens.theirs}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        {mov.kind !== "none" && (
          <div className="pp-lens__mov">
            <div className={["pp-mov", live ? "is-live" : "", mov.half ? "is-half" : "", playing ? "is-playing" : ""].filter(Boolean).join(" ")}>
              {mov.kind === "match" && <Moviola mov={mov} uid={uid} rival={lens.rival} playing={playing} acts={acts} />}
              {mov.kind === "tarde" && mov.tarde && <Tarde t={mov.tarde} />}
              {mov.kind === "last" && mov.last && <Ultimo mov={mov} actaId={actaId} onCampo={acts.campo} />}
              {mov.kind === "still" && mov.still && (
                <div className="pp-still">
                  <PI name={mov.still.icon} />
                  <p>
                    <b>{mov.still.t}</b>
                    <span>{mov.still.d}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Lens>
    </div>
  );
}

function Moviola({ mov, uid, rival, playing, acts }: { mov: MovView; uid: string; rival: string; playing: boolean; acts: LensActions }) {
  const D = mov.duration;
  return (
    <>
      <p className="pp-mov__k" aria-hidden="true">
        <b>La moviola</b>
        <span>arriba aprieta el Piti, abajo {rival}</span>
      </p>
      <div className="pp-mov__track">
        <div className="vd-ribbon pp-rib" role="group" aria-label={mov.ribLabel}>
          <svg viewBox="0 0 500 74" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={`in-us-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#EAF3FC" stopOpacity=".75" />
                <stop offset="1" stopColor="#6CABDD" stopOpacity=".12" />
              </linearGradient>
              <clipPath id={`in-played-${uid}`}>
                <rect x="0" y="0" width={mov.playedW} height="74" />
              </clipPath>
            </defs>
            <line className="vd-ribbon__axis" x1="0" y1="37" x2="500" y2="37" />
            <line className="vd-ribbon__tick" x1="250" y1="18" x2="250" y2="56" strokeDasharray="2 3" />
            <path className="vd-ribbon__us pp-rib__ghost" d={mov.usD} fill={`url(#in-us-${uid})`} />
            <path className="vd-ribbon__them pp-rib__ghost" d={mov.themD} />
            <g clipPath={`url(#in-played-${uid})`}>
              <path className="vd-ribbon__us" d={mov.usD} fill={`url(#in-us-${uid})`} />
              <path className="vd-ribbon__them" d={mov.themD} />
            </g>
          </svg>
          {mov.subs.map((s) => (
            <span key={s.left} className={`in-subtick${s.later ? " is-later" : ""}`} style={{ left: `${s.left}%` }} aria-hidden="true">
              <i />
              {s.n > 1 && <b>{s.n}</b>}
            </span>
          ))}
          {mov.marks.map((k) => (
            <button key={k.id} type="button" className={`vd-ribbon__mark ${k.cls}`} style={{ left: `${k.left}%`, top: `${k.top}%` }} aria-label={k.label} onClick={() => acts.mark(k.m)} tabIndex={-1}>
              {k.icon !== "card" && <PI name={k.icon} />}
            </button>
          ))}
          {mov.showLive && <span className="vd-ribbon__now pp-rib__live" style={{ left: `${mov.livePct}%` }} aria-hidden="true" />}
          <span className="vd-ribbon__lab vd-ribbon__lab--start" style={{ left: "0%" }} aria-hidden="true">
            0′
          </span>
          <span className="vd-ribbon__lab" style={{ left: "50%" }} aria-hidden="true">
            Descanso
          </span>
          <span className="vd-ribbon__lab vd-ribbon__lab--end" style={{ left: "100%" }} aria-hidden="true">
            {D}′
          </span>
        </div>
        <div className="pp-head" style={{ left: `${mov.headPct}%` }} aria-hidden="true">
          <span className="pp-head__line" />
          <span className={`pp-head__tip${mov.tipCls ? ` ${mov.tipCls}` : ""}`}>
            <b className="vd-clock">{mov.minute}′</b>
            {mov.tip && <span>{mov.tip}</span>}
          </span>
        </div>
        <input className="pp-mov__range" type="range" min={0} max={mov.max} step={1} value={mov.minute} onChange={(e) => acts.seek(Number(e.currentTarget.value))} aria-label="La moviola: minuto del partido" aria-valuetext={mov.valueText} />
      </div>
      <div className="pp-mov__bar">
        <button type="button" className="vd-glass vd-press vd-ibtn pp-mov__b" onClick={acts.prev} aria-label="Jugada anterior">
          <PI name="chev-l" />
        </button>
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pp-mov__play" onClick={acts.toggle} aria-pressed={playing}>
          <PI name={playing ? "pause" : "play"} />
          <span>{mov.playLabel}</span>
        </button>
        <button type="button" className="vd-glass vd-press vd-ibtn pp-mov__b" onClick={acts.next} aria-label="Jugada siguiente">
          <PI name="chev-r" />
        </button>
        {mov.backable && (
          <button type="button" className="vd-link pp-mov__back" onClick={acts.back}>
            {mov.backLabel}
          </button>
        )}
      </div>
      <p className="pp-mov__hint">{mov.hint}</p>
    </>
  );
}

function Tarde({ t }: { t: NonNullable<MovView["tarde"]> }) {
  return (
    <>
      <p className="pp-mov__k" aria-hidden="true">
        <b>La tarde</b>
        <span>el sol sobre el campo, hora a hora</span>
      </p>
      <div className="pp-tarde" role="group" aria-label={t.label}>
        <ol className="pp-tarde__marks pp-tarde__marks--top">
          {t.top.map((m) => (
            <li key={m.t} className={m.cls || undefined} style={{ left: `${m.left}%` }}>
              <span>{m.t}</span>
              <b className="vd-clock">{m.h}</b>
            </li>
          ))}
        </ol>
        <div className="pp-tarde__sky" aria-hidden="true">
          <svg viewBox="0 0 500 74" preserveAspectRatio="none" focusable="false">
            <path className="pp-tarde__curve" d={t.sunD} />
            <line className="pp-tarde__hz" x1="0" y1="56" x2="500" y2="56" />
          </svg>
          <span className="pp-tarde__win" style={{ left: `${t.winL}%`, width: `${t.winW}%` }}>
            <span>El partido</span>
          </span>
          <span className="pp-tarde__sun" style={{ left: `${t.sunX}%`, top: `${t.sunY}%` }} />
          {t.ticks.map((k) => (
            <span key={k} className="pp-tarde__tick" style={{ left: `${k}%` }} />
          ))}
        </div>
        <ol className="pp-tarde__marks">
          {t.marks.map((m) => (
            <li key={m.t} className={m.cls || undefined} style={{ left: `${m.left}%` }}>
              <b className="vd-clock">{m.h}</b>
              <span>{m.t}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function Ultimo({ mov, actaId, onCampo }: { mov: MovView; actaId: string | null; onCampo: (e: React.MouseEvent) => void }) {
  const l = mov.last;
  if (!l) return null;
  return (
    <div className="in-last">
      <p className="pp-mov__k in-last__k">
        <b>El último</b>
        <span>{l.when}</span>
      </p>
      <div className="in-last__row">
        <img src="/crest-128.webp" alt="" width={34} height={34} />
        <p className="in-last__sc" role="img" aria-label={l.aria}>
          <span aria-hidden="true">{l.score}</span>
        </p>
        <span className="in-last__or" aria-hidden="true">
          <RivalMark logo={l.logo}>{l.code}</RivalMark>
        </span>
        <p className="in-last__t">
          <b>{l.title}</b>
          <span>{l.sub}</span>
        </p>
      </div>
      <svg className="in-last__rib" viewBox="0 0 500 74" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line className="vd-ribbon__axis" x1="0" y1="37" x2="500" y2="37" />
        <path className="vd-ribbon__us" d={mov.usD} fill="rgba(234,243,252,.35)" />
        <path className="vd-ribbon__them" d={mov.themD} />
      </svg>
      <div className="in-last__acts">
        <a className="vd-glass vd-press vd-btn vd-btn--sm" href="/hoy/campo" onClick={onCampo}>
          Los minutos de cada uno
          <PI name="chev-r" />
        </a>
        {actaId && (
          <MatchLink className="vd-link" id={actaId}>
            Leer el acta
          </MatchLink>
        )}
      </div>
    </div>
  );
}
