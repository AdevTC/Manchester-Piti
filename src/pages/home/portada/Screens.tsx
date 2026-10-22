// Inicio's screens: the head every one shares (back to Inicio and the lens shrunk to the score capsule, the
// title), its «Siguiente», and /hoy/campo, /hoy/jugadas, /hoy/lo-tuyo. (/camiseta is Camiseta.tsx.)
import { useRef, type ReactNode } from "react";
import { useLiveDock } from "../../../components/vidrio";
import type { Kit } from "../../../components/jersey3d/kitStill";
import type { CapView } from "./model";
import type { Task, TaskAct } from "./bands";
import type { CampoView, JugadasView, JugFilter, TuyoView } from "./screenModel";
import { JUG_FILTERS } from "./screenModel";
import { PlayLi, TaskTile } from "./Portada";
import { PageLink } from "./links";
import { PI, Seg, Tee } from "./ui";

export function SubHead({ cap, onBack }: { cap: CapView; onBack: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  useLiveDock(ref, "lens");
  return (
    <div className="in-subhead">
      <a className="vd-glass vd-press vd-btn vd-btn--sm in-back" href="/" onClick={onBack}>
        <PI name="chev-l" />
        Inicio
      </a>
      <a ref={ref} className={`vd-glass in-cap${cap.word ? " is-word" : ""}`} href="/" onClick={onBack} style={{ viewTransitionName: "in-score" }} aria-label={cap.aria}>
        <img src="/crest-128.webp" alt="" width={28} height={28} />
        <b className="in-cap__s">{cap.score}</b>
        {cap.code && (
          <span className="in-cap__r" aria-hidden="true">
            {cap.code}
          </span>
        )}
        {cap.when && (
          <span className="in-cap__w">
            {cap.live && <span className="vd-livedot" aria-hidden="true" />}
            <span className="vd-clock">{cap.when}</span>
          </span>
        )}
        {cap.showProg && <span className="in-cap__prog" style={{ width: `${cap.prog}%` }} aria-hidden="true" />}
      </a>
    </div>
  );
}

export function SubTitle({ kicker, h, p }: { kicker: string; h: string; p: string }) {
  return (
    <header className="in-subtitle">
      {kicker && <p className="in-subtitle__k">{kicker}</p>}
      <h1 className="in-subtitle__h" style={{ viewTransitionName: "in-title" }}>
        {h}
      </h1>
      <p className="in-subtitle__p">{p}</p>
    </header>
  );
}

export function SubNext({ onBack, next }: { onBack: (e: React.MouseEvent) => void; next: { label: string; href: string; go: (e: React.MouseEvent) => void } | null }) {
  return (
    <nav className="in-subnext" aria-label="Seguir">
      <a className="vd-glass vd-press vd-btn vd-btn--sm" href="/" onClick={onBack}>
        <PI name="chev-l" />
        Inicio
      </a>
      {next && (
        <a className="vd-glass vd-press vd-btn vd-btn--sm in-subnext__n" href={next.href} onClick={next.go}>
          {next.label}
          <PI name="chev-r" />
        </a>
      )}
    </nav>
  );
}

// ───────────────────────── /hoy/campo ─────────────────────────

export function Campo({ v, kit, numOf, duration, playing, playLabel, minute, max, onPick, onToggle, onSeek, onPlay }: { v: CampoView; kit: Kit; numOf: (id: string) => string; duration: number; playing: boolean; playLabel: string; minute: number; max: number; onPick: (id: string) => void; onToggle: (id: string) => void; onSeek: (m: number) => void; onPlay: () => void }) {
  return (
    <section className={`in-place in-campo`} aria-label={v.h}>
      <div className="ic-grid">
        <div className="ic-pitchcol">
          <div className="vd-pitch in-pitch ic-pitch" style={{ viewTransitionName: "in-pitch" }}>
            <svg className="vd-pitch__lines" viewBox="0 0 100 124" preserveAspectRatio="none" aria-hidden="true">
              <rect x="4" y="3" width="92" height="118" rx="1" />
              <line x1="4" y1="62" x2="96" y2="62" />
              <circle cx="50" cy="62" r="10" />
              <rect x="27" y="3" width="46" height="15" />
              <rect x="27" y="106" width="46" height="15" />
            </svg>
            <ul className="ic-players" aria-label={v.pitchLabel}>
              {v.spots.map((p) => (
                <li key={p.id} className={["vd-player", "ic-player", p.sel ? "is-sel" : "", p.me ? "is-me" : "", p.dim ? "is-dim" : ""].filter(Boolean).join(" ")} style={{ left: `${p.left}%`, top: `${p.top}%` }}>
                  <button type="button" className="ic-pl" onClick={() => onPick(p.id)} aria-pressed={p.sel} aria-label={p.label}>
                    <Tee num={p.num} kit={kit} className="ic-tee" />
                    <span className="vd-player__name" aria-hidden="true">
                      {p.short}
                    </span>
                  </button>
                  {p.captain && (
                    <span className="ic-cap" aria-hidden="true">
                      C
                    </span>
                  )}
                  {p.me && (
                    <span className="ic-me" aria-hidden="true">
                      Tú
                    </span>
                  )}
                  {p.tag && (
                    <span className={`vd-tag ${p.tag.cls} ic-tag`} aria-hidden="true">
                      {p.tag.t}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {v.empty.map((g, k) => (
              <span key={k} className="ic-ghost" style={{ left: `${g.left}%`, top: `${g.top}%` }} aria-hidden="true" />
            ))}
          </div>
          {v.hasScrub && (
            <>
              <div className="ic-scrub">
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm ic-play" onClick={onPlay} aria-pressed={playing}>
                  <PI name={playing ? "pause" : "play"} />
                  <span>{playLabel}</span>
                </button>
                <label className="ic-range">
                  <span className="ic-range__l">
                    Minuto <b className="vd-clock">{minute}′</b>
                  </span>
                  <input type="range" min={0} max={max} step={1} value={minute} onChange={(e) => onSeek(Number(e.currentTarget.value))} aria-valuetext={v.rangeText} />
                </label>
              </div>
              <p className="ic-now">{v.now}</p>
            </>
          )}
          {v.pitchNote && <p className="ic-now">{v.pitchNote}</p>}
        </div>

        <div className="ic-mincol">
          <header className="ic-minh">
            <h2>{v.minH}</h2>
            <p>{v.minSub}</p>
          </header>
          {v.facts.length > 0 && (
            <ul className="ic-facts">
              {v.facts.map((f) => (
                <li key={f.l}>
                  <b>{f.v}</b>
                  <span>{f.l}</span>
                </li>
              ))}
            </ul>
          )}
          {v.hasTracks && (
            <div className="ic-axis" aria-hidden="true">
              <span>0′</span>
              <span>Descanso</span>
              <span>{duration}′</span>
            </div>
          )}
          <ol className="ic-rows">
            {v.rows.map((r) => (
              <li key={r.id} className={`ic-row${r.cls ? ` ${r.cls}` : ""}`}>
                <button type="button" className="ic-row__b" onClick={() => r.expandable && onToggle(r.id)} aria-expanded={r.expandable ? r.open : undefined} aria-label={r.label}>
                  <Tee num={r.num} kit={kit} className="ic-row__tee" />
                  <span className="ic-row__t" aria-hidden="true">
                    <b>
                      {r.name}
                      {r.me && <i className="ic-me2">Tú</i>}
                      {r.captain && <i className="ic-cap2">C</i>}
                    </b>
                    <span>{r.sub}</span>
                  </span>
                  <span className="ic-row__m" aria-hidden="true">
                    {r.minText}
                  </span>
                  {r.hasTrack && (
                    <span className="ic-tr" aria-hidden="true">
                      <i className="ic-tr__half" />
                      {r.ghost.map((b, k) => (
                        <i key={`g${k}`} className="ic-tr__ghost" style={{ left: `${b.l}%`, width: `${b.w}%` }} />
                      ))}
                      {r.bars.map((b, k) => (
                        <i key={`b${k}`} className="ic-tr__bar" style={{ left: `${b.l}%`, width: `${b.w}%` }} />
                      ))}
                      {r.dots.map((d, k) => (
                        <i key={`d${k}`} className={`ic-tr__dot ${d.cls}`} style={{ left: `${d.left}%` }} />
                      ))}
                      {r.headPct !== null && <i className="ic-tr__head" style={{ left: `${r.headPct}%` }} />}
                    </span>
                  )}
                  {r.expandable && <PI name="chev-r" className="ic-row__chev" />}
                </button>
                {r.open && (
                  <div className="ic-ex">
                    {r.ex.length > 0 && (
                      <ol className="ic-ex__l">
                        {r.ex.map((x, k) => (
                          <li key={k} className={x.cls}>
                            <span className="vd-clock">{x.m}′</span>
                            <span className="ic-ex__dir">{x.dir}</span>
                            <Tee num={numOf(x.withId)} kit={kit} className="ic-ex__tee" />
                            <span className="ic-ex__w">{x.with}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {r.more && <p className="ic-ex__more">{r.more}</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {v.lists.map((l) => (
            <p key={l.k} className="ic-list">
              <b>{l.k}</b> {l.v}
            </p>
          ))}
          {v.note && <p className="ic-note">{v.note}</p>}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── /hoy/jugadas ─────────────────────────

export function Jugadas({ v, fi, onFilter, numOf, kit }: { v: JugadasView; fi: JugFilter; onFilter: (f: JugFilter) => void; numOf: (id: string) => string; kit: Kit }) {
  return (
    <section className="in-place in-jugadas" aria-label={v.h}>
      <div className="ij-bar">
        <Seg className="ij-seg" label="Qué jugadas ver" opts={JUG_FILTERS.map((t, i) => ({ id: String(i), t, on: fi === i }))} onPick={(id) => onFilter(Number(id) as JugFilter)} />
        {v.count && <p className="ij-count">{v.count}</p>}
      </div>
      <div className="ij-cols" style={{ viewTransitionName: "in-plays" }}>
        {v.halves.map((h) => (
          <section key={h.t} className="ij-half" aria-label={h.t}>
            <h2 className="in-k">
              {h.t}
              <span>{h.n}</span>
            </h2>
            {h.empty && <p className="ij-empty">{h.emptyT}</p>}
            <ol className="in-plays ij-plays">
              {h.list.map((r) => (
                <PlayLi key={r.key} r={r} numOf={numOf} kit={kit} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── /hoy/lo-tuyo ─────────────────────────

export function LoTuyo({ v, tasks, onTask, myNum, kit, numOf, duration, onCampo, notices, pushOpts, pushSub, onPush, mineAct }: { v: TuyoView; tasks: readonly Task[]; onTask: (t: Task, act: TaskAct, value?: string) => void; myNum: string; kit: Kit; numOf: (id: string) => string; duration: number; onCampo: (e: React.MouseEvent) => void; notices: readonly { id: string; title: string; when: string }[]; pushOpts: { id: string; t: string; on: boolean }[] | null; pushSub: string; onPush: (id: string) => void; mineAct: (sheet: "porra") => void }) {
  return (
    <section className="in-place in-tuyo" aria-label="Lo tuyo">
      <div className="it-grid">
        <div className="it-col">
          <h2 className="in-k">
            Lo que te toca<span>{v.taskN}</span>
          </h2>
          <ul data-scroll-x="" className="in-tasks__l it-tasks" style={{ viewTransitionName: "in-tuyo" }}>
            {tasks.map((t) => (
              <TaskTile key={t.key} t={t} onTask={onTask} />
            ))}
          </ul>

          <h2 className="in-k it-k2">
            {v.gameH}
            <span>{v.gameN}</span>
          </h2>
          <div className="it-game">
            <Tee num={myNum} kit={kit} className="it-game__tee" />
            <div className="it-game__t">
              <p className="it-game__big">
                <b>{v.min}</b>
                <span>{v.minL}</span>
              </p>
              <p className="it-game__line">{v.line}</p>
              {v.hasTrack && (
                <>
                  <span className="ic-tr it-tr" role="img" aria-label={v.trackLabel}>
                    <i className="ic-tr__half" />
                    {v.bars.map((b, k) => (
                      <i key={k} className="ic-tr__bar" style={{ left: `${b.l}%`, width: `${b.w}%` }} />
                    ))}
                  </span>
                  <span className="ic-axis it-axis" aria-hidden="true">
                    <span>0′</span>
                    <span>Descanso</span>
                    <span>{duration}′</span>
                  </span>
                </>
              )}
            </div>
          </div>
          {v.ex.length > 0 && (
            <ol className="ic-ex__l it-ex">
              {v.ex.map((x, k) => (
                <li key={k} className={x.cls}>
                  <span className="vd-clock">{x.m}′</span>
                  <span className="ic-ex__dir">{x.dir}</span>
                  <Tee num={numOf(x.withId)} kit={kit} className="ic-ex__tee" />
                  <span className="ic-ex__w">{x.with}</span>
                </li>
              ))}
            </ol>
          )}
          <a className="vd-link it-link" href="/hoy/campo" onClick={onCampo}>
            Los minutos de todos
          </a>
        </div>

        <div className="it-col">
          <h2 className="in-k">Lo tuyo</h2>
          <ul className="it-mine">
            {v.mine.map((r) => (
              <li key={r.key} className="it-mine__r">
                <span className="it-mine__ic" aria-hidden="true">
                  <PI name={r.icon} />
                </span>
                <span className="it-mine__t">
                  <b>{r.t}</b>
                  <span>{r.sub}</span>
                  {r.bar !== null && (
                    <span className="it-bar" role="img" aria-label={r.barLabel}>
                      <i style={{ width: `${r.bar}%` }} />
                    </span>
                  )}
                </span>
                {r.go && <MineGo href={r.go.href}>{r.go.t}</MineGo>}
                {r.act && (
                  <button type="button" className="vd-link" onClick={() => r.act && mineAct(r.act.sheet)} aria-haspopup="dialog">
                    {r.act.t}
                  </button>
                )}
              </li>
            ))}
          </ul>

          <h2 className="in-k it-k2">
            Avisos<span>{v.avN}</span>
          </h2>
          {notices.length > 0 ? (
            <ul className="it-av">
              {notices.map((a) => (
                <li key={a.id}>
                  <b>{a.title}</b>
                  <span>{a.when}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="it-push__t">
              <span>Sin avisos nuevos.</span>
            </p>
          )}
          <div className="it-push">
            <p className="it-push__t">
              <b>Avisos a medida</b>
              <span>{pushSub}</span>
            </p>
            {pushOpts && <Seg className="it-push__seg" label="Qué te avisamos en este móvil" opts={pushOpts} onPick={onPush} />}
          </div>
          <p className="it-falta">
            <PI name="cal" />
            <span>
              <b>¿Vas a faltar?</b> Avísalo antes del partido y el capitán lo ve en la pizarra.
            </span>
            <PageLink to="vestuario" className="vd-link">
              Avisar
            </PageLink>
          </p>
        </div>
      </div>
    </section>
  );
}

function MineGo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <PageLink to={href === "/plantilla" ? "plantilla" : "perfil"} className="vd-link">
      {children}
    </PageLink>
  );
}
