// «La portada»: one screen, the score at its centre. Phone: the lens and the headline first, then «Lo que te
// toca», the pitch and the plays, the doors. Tablet: the centre on top, the pitch and «Lo que te toca» side by
// side. Desktop: el siete | the lens with the headline under it | «Lo que te toca» and the plays, the six doors in
// one row under them (inicio.css balances the columns by how many tiles «Lo que te toca» holds); «Síguenos», the
// club's Instagram and YouTube, closes the page.
import type { ReactNode } from "react";
import type { Kit } from "../../../components/jersey3d/kitStill";
import type { Act, HeroView } from "./model";
import type { DoorsView, NightView, PlayRowV, Task, TaskAct, TasksView } from "./bands";
import { MatchLink, PageLink } from "./links";
import { SocialIcon } from "../../../components/vidrio/SocialIcon";
import { socialLabel, type SocialLink } from "../../../lib/social";
import type { FeaturedSponsor } from "../../../lib/clubExtras";
import { PI, Seg, Tee } from "./ui";

export interface PortadaProps {
  lens: ReactNode;
  hero: HeroView;
  /** What a hero action does: a link out (the match, its mesa, the map) or a button here. */
  act: (a: Act) => ReactNode;
  tasks: TasksView;
  onTask: (t: Task, act: TaskAct, value?: string) => void;
  night: NightView;
  doors: DoorsView;
  /** The club's profiles: «Síguenos» (none → no band). */
  social: readonly SocialLink[];
  /** r12 M-45: the featured sponsor in its dates (clubExtras.featuredSponsor); null → as before. */
  sponsor?: FeaturedSponsor | null;
  kit: Kit;
  matchId: string | null;
  go: (to: "campo" | "jugadas" | "lo-tuyo" | "camiseta") => (e: React.MouseEvent) => void;
  playsAria: string;
  previaOut: ReactNode;
  numOf: (id: string) => string;
}

export function PlayLi({ r, numOf, kit, className }: { r: PlayRowV; numOf: (id: string) => string; kit: Kit; className?: string }) {
  const cls = ["in-play", r.them ? "in-play--them" : "", r.gold ? "is-gold" : "", r.red ? "is-red" : "", r.pairs ? "is-swap" : "", className].filter(Boolean).join(" ");
  return (
    <li className={cls} aria-label={r.label || undefined}>
      <span className="vd-clock">{r.m}′</span>
      <span className="in-play__ic" aria-hidden="true">
        {r.card ? <i className="in-card" /> : <PI name={r.icon} />}
      </span>
      <span className="in-play__t">
        <b>{r.title}</b>
        {r.sub && <span>{r.sub}</span>}
        {r.pairs && (
          <span className="ij-swap">
            {r.pairs.map((x, k) => (
              <span key={k} className="ij-pair">
                <Tee num={numOf(x.innId)} kit={kit} className="ij-pair__tee" />
                <span className="ij-pair__t">
                  <b>{x.inn}</b>
                  <small>por {x.out}</small>
                </span>
              </span>
            ))}
          </span>
        )}
      </span>
    </li>
  );
}

export function TaskTile({ t, onTask, className }: { t: Task; onTask: PortadaProps["onTask"]; className?: string }) {
  return (
    <li className={`vd-glass in-task${t.cls ? ` ${t.cls}` : ""}${className ? ` ${className}` : ""}`}>
      <span className="in-task__ic" aria-hidden="true">
        <PI name={t.icon} />
      </span>
      <div className="in-task__t">
        <b>{t.t}</b>
        <span>{t.sub}</span>
        {t.error && (
          <span className="in-task__err" role="alert">
            {t.error}
          </span>
        )}
      </div>
      {t.seg && <Seg glass={false} className="in-task__seg" label={t.seg.label} opts={t.seg.opts} busy={t.seg.busy} onPick={(id) => onTask(t, t.seg?.act ?? "rsvp", id)} />}
      {t.btn && !t.btn.out && (
        <button type="button" className={`vd-glass vd-press vd-btn vd-btn--sm${t.btn.pri ? " vd-btn--pri" : ""}`} onClick={() => t.btn && onTask(t, t.btn.act)} aria-haspopup={t.btn.popup ? "dialog" : undefined} aria-busy={t.btn.busy || undefined} disabled={t.btn.busy}>
          {t.btn.t}
        </button>
      )}
      {t.btn && t.btn.out && (
        <TaskOut act={t.btn.act} className={`vd-glass vd-press vd-btn vd-btn--sm${t.btn.pri ? " vd-btn--pri" : ""}`} onTask={() => t.btn && onTask(t, t.btn.act)}>
          {t.btn.t}
        </TaskOut>
      )}
      {t.done && (
        <p className="in-task__done">
          <PI name="check" />
          {t.done}
        </p>
      )}
    </li>
  );
}

/** A task's link out: the vestuario (and its polls), la mesa. */
function TaskOut({ act, className, children, onTask }: { act: TaskAct; className: string; children: ReactNode; onTask: () => void }) {
  if (act === "mesa")
    return (
      <button type="button" className={className} onClick={onTask}>
        {children}
      </button>
    );
  return (
    <PageLink to="vestuario" className={className}>
      {children}
    </PageLink>
  );
}

export function Portada(p: PortadaProps) {
  const { hero, tasks, night, doors, kit } = p;
  return (
    <div className={`in-portada ${tasks.layout}`}>
      <div className="in-center">
        {p.lens}
        <div className="in-head">
          {hero.kicker && <p className="in-head__k">{hero.kicker}</p>}
          <h1 className="in-h1">{hero.h1}</h1>
          {hero.lede && <p className="in-lede">{hero.lede}</p>}
          {hero.me && (
            <p className="in-me">
              <i aria-hidden="true">{hero.meIni}</i>
              <span>{hero.me}</span>
            </p>
          )}
          {hero.acts.length > 0 && <div className="in-acts">{hero.acts.map((a) => p.act(a))}</div>}
          {hero.wx && (
            <p className="in-wx">
              <PI name={hero.wxIcon} />
              <span>{hero.wx}</span>
            </p>
          )}
        </div>
      </div>

      <section className="in-band in-tasks" aria-labelledby="in-tasks-h">
        <header className="in-band__head">
          <div>
            <h2 id="in-tasks-h">{tasks.h}</h2>
            <p>{tasks.sub}</p>
          </div>
          {tasks.door && (
            <a className="vd-glass vd-press vd-btn vd-btn--sm in-band__go" href="/hoy/lo-tuyo" onClick={p.go("lo-tuyo")}>
              Todo lo tuyo
              {tasks.badge > 0 && (
                <span className="vd-badge" aria-hidden="true">
                  {tasks.badge}
                </span>
              )}
              <PI name="chev-r" />
            </a>
          )}
        </header>
        {/* (keyed by its tiles: when the viewer becomes known the row is a new one, at its start — a snapping row
            whose tiles change in place re-snaps to whichever survives) */}
        <ul key={tasks.list.map((t) => t.key).join(" ")} data-scroll-x="" className="in-tasks__l" style={{ viewTransitionName: "in-tuyo" }}>
          {tasks.list.map((t) => (
            <TaskTile key={t.key} t={t} onTask={p.onTask} />
          ))}
          {tasks.note && (
            <li className="in-task in-task--note">
              <span className="in-task__ic" aria-hidden="true">
                <PI name="cal" />
              </span>
              <div className="in-task__t">
                <b>{tasks.note.t}</b>
                <span>{tasks.note.d}</span>
              </div>
            </li>
          )}
        </ul>
      </section>

      <div className="in-left">
        {!night.noPitch && (
          <section className="in-band in-pitchband" aria-labelledby="in-night-h">
            <header className="in-band__head">
              <div>
                <h2 id="in-night-h">{night.h}</h2>
                <p>{night.sub}</p>
              </div>
            </header>
            <a className={`in-pdoor${night.dim ? " is-dim" : ""}`} href="/hoy/campo" onClick={p.go("campo")} aria-label={night.pitchAria}>
              <div className="vd-pitch in-pitch" style={{ viewTransitionName: "in-pitch" }} aria-hidden="true">
                <svg className="vd-pitch__lines in-pitch__h" viewBox="0 0 140 100" preserveAspectRatio="none">
                  <rect x="3" y="4" width="134" height="92" rx="1" />
                  <line x1="70" y1="4" x2="70" y2="96" />
                  <circle cx="70" cy="50" r="11" />
                  <rect x="3" y="26" width="17" height="48" />
                  <rect x="120" y="26" width="17" height="48" />
                </svg>
                <svg className="vd-pitch__lines in-pitch__v" viewBox="0 0 100 124" preserveAspectRatio="none">
                  <rect x="4" y="3" width="92" height="118" rx="1" />
                  <line x1="4" y1="62" x2="96" y2="62" />
                  <circle cx="50" cy="62" r="10" />
                  <rect x="27" y="3" width="46" height="15" />
                  <rect x="27" y="106" width="46" height="15" />
                </svg>
                {night.spots.map((s) => (
                  <span key={s.id} className={`vd-player in-spot${s.me ? " is-me" : ""}${s.dim ? " is-dim" : ""}`} style={{ "--hx": `${s.left}%`, "--hy": `${s.top}%`, "--vx": `${s.vx}%`, "--vy": `${s.vy}%` } as React.CSSProperties}>
                    <Tee num={s.num} kit={kit} className="in-spot__tee" />
                    <span className="vd-player__name">{s.short}</span>
                    {s.tag && <span className="vd-tag vd-tag--gold in-spot__tag">{s.tag}</span>}
                  </span>
                ))}
              </div>
              <span className="in-pdoor__foot">
                <span className="in-pdoor__facts">
                  {night.facts.map((f) => (
                    <span key={f.l}>
                      <b>{f.v}</b> {f.l}
                    </span>
                  ))}
                </span>
                <span className="vd-glass vd-btn vd-btn--sm in-pdoor__go">
                  {night.pitchGo}
                  <PI name="chev-r" />
                </span>
              </span>
            </a>
          </section>
        )}
        <section className="in-band in-playsdoor" style={{ viewTransitionName: "in-plays" }} aria-label={p.playsAria}>
          {night.isPlays ? (
            <>
              <h3 className="in-k">
                {night.playsH}
                <span>{night.playsN}</span>
              </h3>
              <ol className="in-plays">
                {night.plays.map((r) => (
                  <PlayLi key={r.key} r={r} numOf={p.numOf} kit={kit} className={r.xtra ? "is-xtra" : undefined} />
                ))}
              </ol>
              <p className="in-playsdoor__foot">
                <span>{night.playsMore}</span>
                <a className="vd-glass vd-press vd-btn vd-btn--sm" href="/hoy/jugadas" onClick={p.go("jugadas")}>
                  Jugada a jugada
                  <PI name="chev-r" />
                </a>
              </p>
            </>
          ) : (
            <>
              <h3 className="in-k">
                {night.previaH}
                <span>{night.previaJ}</span>
              </h3>
              <dl className="in-previa">
                {night.previa.map((r) => (
                  <div key={r.k}>
                    <dt>{r.k}</dt>
                    <dd>{r.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="in-playsdoor__foot">
                <span>{night.previaNote}</span>
                {p.previaOut}
              </p>
            </>
          )}
        </section>
      </div>

      <section className="in-band in-doors" aria-labelledby="in-doors-h">
        <header className="in-band__head">
          <div>
            <h2 id="in-doors-h">Por la casa</h2>
            <p>Cada puerta lleva a su sitio, con lo que pasa ahora dentro.</p>
          </div>
        </header>
        <ul className="in-doors__g">
          <li className="in-door in-door--partidos">
            <PageLink to="partidos" className="in-door__a">
              <span className="in-door__t">
                <b>Partidos</b>
                <span>{doors.partidos}</span>
              </span>
              <span className="in-jor" aria-hidden="true">
                {doors.jornadas.map((j) => (
                  <span key={j.key} className={`in-jor__j ${j.cls}`}>
                    <b>{j.top}</b>
                    <small className="in-jor__s">{j.bot}</small>
                    <small className="in-jor__l">{j.botL}</small>
                  </span>
                ))}
              </span>
              <DoorGo />
            </PageLink>
          </li>
          <li className="in-door in-door--plantilla">
            <PageLink to="plantilla" className="in-door__a">
              <span className="in-door__t">
                <b>Plantilla</b>
                <span>{doors.plantilla}</span>
              </span>
              <span className="in-rail" aria-hidden="true">
                <i className="in-rail__bar" />
                {doors.rail.map((r) => (
                  <span key={r.id} className="in-hang">
                    <svg className="in-hang__hook" viewBox="0 0 24 30">
                      <path d="M12 29V17M12 17c0-3 5-3.4 5-8a5 5 0 0 0-10 0" />
                    </svg>
                    <Tee num={r.num} className="in-hang__tee" />
                  </span>
                ))}
              </span>
              <DoorGo />
            </PageLink>
          </li>
          <li className="in-door in-door--numeros">
            <PageLink to="numeros" className="in-door__a">
              <span className="in-door__t">
                <b>Estadísticas</b>
                <span>{doors.numeros}</span>
              </span>
              <span className="in-big" aria-hidden="true">
                <b>{doors.big}</b>
                <span>{doors.bigL}</span>
              </span>
              <DoorGo />
            </PageLink>
          </li>
          <li className="in-door in-door--club">
            <PageLink to="club" className="in-door__a">
              <span className="in-door__t">
                <b>Club</b>
                <span>{doors.club}</span>
              </span>
              {doors.bday ? (
                <span className="in-clubv" aria-hidden="true">
                  <Tee num={doors.bday.num} className="in-clubv__tee" />
                  <span className="in-clubv__t">
                    <b>{doors.bdayDay}</b>
                    <span>{doors.bdayWho}</span>
                  </span>
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="in-clubd" aria-hidden="true">
                <PI name="trophy" />
                <span>{doors.vitrina}</span>
              </span>
              <DoorGo />
            </PageLink>
          </li>
          <li className={`in-door in-door--vest${doors.locked ? " is-locked" : ""}`}>
            <PageLink to="vestuario" className="in-door__a">
              <span className="in-door__t">
                <b>El vestuario</b>
                <span>{doors.vest}</span>
              </span>
              {doors.vestL.length > 0 ? (
                <span className="in-vest__l" aria-hidden="true">
                  {doors.vestL.map((v) => (
                    <span key={v.t}>
                      <PI name={v.icon} />
                      {v.t}
                    </span>
                  ))}
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="in-vest" aria-hidden="true">
                <PI name={doors.vestIcon} />
                <span>{doors.vestD}</span>
              </span>
              <DoorGo />
            </PageLink>
          </li>
          <li className="in-door in-door--tee">
            <a href="/camiseta" onClick={p.go("camiseta")} className="in-door__a">
              <span className="in-door__t">
                <b>Ponte la del Piti</b>
                <span>{doors.tee}</span>
              </span>
              <Tee num={doors.mine?.num} className="in-door__tee" vt="in-tee" />
              <DoorGo />
            </a>
          </li>
        </ul>
      </section>

      {(p.social.length > 0 || p.sponsor) && (
        <section className="in-band in-follow" aria-labelledby="in-follow-h">
          <header className="in-band__head">
            <div>
              <h2 id="in-follow-h">{p.social.length > 0 ? "Síguenos" : "Nos apoya"}</h2>
              <p>{p.social.length > 0 ? "El Piti también juega fuera de la web." : "El patrocinador del Piti."}</p>
            </div>
          </header>
          <ul className="in-follow__g">
            {p.social.map((l) => (
              <li key={l.key}>
                <a className="vd-glass vd-press in-follow__a" href={l.href} target="_blank" rel="noopener noreferrer" aria-label={socialLabel(l)}>
                  <span className="in-follow__ic" aria-hidden="true">
                    <SocialIcon name={l.key} size={24} />
                  </span>
                  <span className="in-follow__t">
                    <b>{l.name}</b>
                    <span className="in-follow__h">{l.handle}</span>
                    <span>{l.blurb}</span>
                  </span>
                  <PI name="chev-r" />
                </a>
              </li>
            ))}
            {p.sponsor && <SponsorLi s={p.sponsor} />}
          </ul>
        </section>
      )}
    </div>
  );
}

/** r12 M-45 · the featured sponsor beside the networks: its logo (https) or its initials, its name, and its web
 *  when it has one (a link that says it opens elsewhere). */
function SponsorLi({ s }: { s: FeaturedSponsor }) {
  const ini = s.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const inner = (
    <>
      <span className="in-follow__ic" aria-hidden="true">
        {s.logo ? <img src={s.logo} alt="" width={32} height={32} loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ objectFit: "contain" }} /> : <b>{ini}</b>}
      </span>
      <span className="in-follow__t">
        <b>{s.name}</b>
        <span className="in-follow__h">Nos apoya</span>
        <span>{s.url ? "Visita su web" : "El patrocinador del Piti"}</span>
      </span>
    </>
  );
  return (
    <li className="in-follow__spons">
      {s.url ? (
        <a className="vd-glass vd-press in-follow__a" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name}, patrocinador de Manchester Piti (se abre en otra pestaña)`}>
          {inner}
          <PI name="chev-r" />
        </a>
      ) : (
        <div className="vd-glass in-follow__a">{inner}</div>
      )}
    </li>
  );
}

function DoorGo() {
  return (
    <span className="in-door__go" aria-hidden="true">
      <PI name="chev-r" />
    </span>
  );
}

export { MatchLink };
