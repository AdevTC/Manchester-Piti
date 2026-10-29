// «El partido»: the header, the page's identity. The row («‹ Partidos», the title, the jornadas either side, the
// admin's way into the Sala de control, «El cartel») and the lens: crests, the score in rolling digits (or the
// kick-off time, or «Aplazado» / «Sin acta»), the status, the scorers, and «La moviola» — the 50 minutes as a
// pressure ribbon whose playhead drives the score, the sky and whichever screen is open — or, before the whistle,
// «La tarde»: the evening over the ground hour by hour. Under them the lens's actions (la mesa, the avisos, PiP).
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lens, LIVE_MORPH, useLiveDock } from "../../../components/vidrio";
import type { PageCtx } from "./ctx";
import { Go, Icon, RivalCrest } from "./bits";
import { SocialIcon } from "../../../components/vidrio/SocialIcon";
import { matchVideoHref } from "../../../../functions/src/matchVideo";
import type { Play } from "./model";
import { playheadTip, ribbonMarks, ribbonPaths, tardeOf } from "./moviola";

export interface HeadProps {
  c: PageCtx;
  title: string;
  titleS: string;
  status: string;
  scoreLabel: string;
  word: string;
  kickTime: string;
  sync: string | null;
  prev: { href: string; label: string; aria: string } | null;
  next: { href: string; label: string; aria: string } | null;
  admin: { href: string; label: string } | null;
  mesa: { label: string } | null;
  avisos: { label: string; aria: string } | null;
  pip: { open: boolean; toggle: () => void } | null;
  playing: boolean;
  fx: "gold" | "cold" | null;
  goalClasses: string;
  stillT: string;
  stillD: string;
  meet: number | null;
  onPlay: () => void;
  onJump: (dir: 1 | -1) => void;
  onSeek: (m: number, fromDrag: boolean) => void;
  onCartel: () => void;
}

function Digits({ n }: { n: number }) {
  if (n > 9) return <span aria-hidden="true">{n}</span>;
  return (
    <span className="pp-dg" style={{ "--d": n } as CSSProperties} aria-hidden="true">
      <span className="pp-dg__w">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <span key={d} className="vd-digit">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export function Head(p: HeadProps) {
  const { c } = p;
  const { minute: m, edge, duration, played, pre, live, fase } = c;
  const dragged = c.dragged;
  const wrap = useRef<HTMLDivElement | null>(null);
  useLiveDock(wrap, "lens");
  // the moviola folds its marks by the room it really has
  const track = useRef<HTMLDivElement | null>(null);
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const read = () => setTrackW((w) => (Math.abs(el.offsetWidth - w) > 4 ? el.offsetWidth : w));
    read();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [played]);

  // ---- the lens
  const sc = c.score;
  const ours: { key: string; m: number; name: string; later: boolean }[] = [];
  const theirs: { key: string; m: number; later: boolean }[] = [];
  if (played)
    for (const pl of c.plays) {
      if (pl.m > edge) continue;
      if (pl.k === "gol") ours.push({ key: pl.id, m: pl.m, name: pl.who ? c.nameOf(pl.who) : "Autogol", later: pl.m > m });
      if (pl.k === "rival") theirs.push({ key: pl.id, m: pl.m, later: pl.m > m });
    }
  const lensCls = [p.goalClasses, pre ? "is-pre" : "", c.off ? "is-off" : "", "pp-lens"].filter(Boolean).join(" ");

  // ---- the moviola
  const paths = ribbonPaths(c.pulse, played ? edge : 0, duration);
  const marks = played ? ribbonMarks(c.plays, edge, m, duration, trackW) : [];
  const { tip, at: atPlay, cls: tipCls } = played ? playheadTip(c.plays, m, duration, live ? edge : null) : { tip: "", at: null, cls: "" };
  const movCls = ["pp-mov", live ? "is-live" : "", fase === "descanso" ? "is-half" : "", p.playing ? "is-playing" : ""].filter(Boolean).join(" ");
  const playLabel = p.playing ? "Pausa" : fase === "descanso" ? "Repasar la primera parte" : "Repasar el partido";
  const hint = live && fase !== "descanso" ? `Arrastra para volver a cualquier minuto: la pantalla que tengas abierta vuelve con él. El directo sigue en el ${edge}.` : fase === "descanso" ? "Arrastra o toca una jugada: la pantalla abierta vuelve a ese minuto." : "Arrastra o toca una jugada: el marcador, el cielo y la pantalla abierta vuelven a ese minuto.";
  const valueText = `Minuto ${m}${atPlay ? `, ${atPlay.title}` : ""}. Marcador ${sc.us} a ${sc.them}`;
  const shareAria = `Compartir el momento del minuto ${m}${atPlay ? `: ${atPlay.title.toLowerCase()}` : ""}`;
  const tarde = pre ? tardeOf(c.kickMs, duration, c.now, { whistle: fase === "pitido", member: c.viewer.member, meet: p.meet }) : null;

  const scorers = played && ours.length + theirs.length > 0;
  return (
    <>
      <div className="pp-headrow">
        <Link className="vd-glass vd-press vd-btn vd-btn--sm pp-back" to="/partidos">
          <Icon name="chev-l" />
          Partidos
        </Link>
        <h1 className="pp-title">
          <span className="pp-title__l">{p.title}</span>
          <span className="pp-title__s" aria-hidden="true">
            {p.titleS}
          </span>
        </h1>
        <nav className="pp-jump" aria-label="Partido anterior y siguiente">
          {p.prev ? (
            <Go className="vd-glass vd-press pp-jump__next pp-jump__prev" href={p.prev.href} aria-label={p.prev.aria}>
              <Icon name="chev-l" />
              <span className="pp-jump__l">{p.prev.label}</span>
            </Go>
          ) : (
            <span className="pp-jump__off" aria-disabled="true" title="Es la primera jornada">
              <Icon name="chev-l" />
              <span className="vd-vh">No hay partido anterior: es la primera jornada</span>
            </span>
          )}
          {p.next && (
            <Go className="vd-glass vd-press pp-jump__next" href={p.next.href} aria-label={p.next.aria}>
              <span className="pp-jump__l">{p.next.label}</span>
              <Icon name="chev-r" />
            </Go>
          )}
        </nav>
        {p.admin && (
          <Go className="vd-glass vd-press vd-btn vd-btn--sm pp-admin" href={p.admin.href}>
            <Icon name="lock" />
            <span>{p.admin.label}</span>
          </Go>
        )}
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pp-share" onClick={p.onCartel} aria-haspopup="dialog">
          <Icon name="share" />
          <span>El cartel</span>
        </button>
      </div>

      <div ref={wrap} className="pp-lenswrap">
        <Lens as="section" className={lensCls} refract={{ bezel: 22, strength: 1.3, blur: 10 }} morphName={live || fase === "final" ? LIVE_MORPH : undefined} aria-label="El partido">
          <span className="pp-lens__halo" aria-hidden="true" />
          <div className="pp-lens__board">
            <div className="vd-teams pp-teams">
              <div className="vd-team">
                <img className="vd-team__crest" src="/crest-128.webp" alt="" width={68} height={68} />
                <b>
                  <span className="pp-long">Manchester Piti</span>
                  <span className="pp-short">Piti</span>
                </b>
                <span>{c.match.home === false ? "Fuera" : "En casa"}</span>
              </div>
              <div className="pp-mid">
                {played && (
                  <p className="vd-scoreline vd-score pp-score" role="img" aria-label={p.scoreLabel}>
                    <Digits n={sc.us} />
                    <span className="vd-scoreline__sep" aria-hidden="true" />
                    <Digits n={sc.them} />
                  </p>
                )}
                {pre && (
                  <p className="vd-score pp-kick" role="img" aria-label={p.scoreLabel}>
                    <span aria-hidden="true">{p.kickTime}</span>
                  </p>
                )}
                {c.off && (
                  <p className="pp-word" role="img" aria-label={p.scoreLabel}>
                    <span aria-hidden="true">{p.word}</span>
                  </p>
                )}
              </div>
              <div className="vd-team">
                <RivalCrest logo={c.rivalLogo} code={c.rivalCode} className="vd-team__crest" />
                <b>{c.rival}</b>
                <span>{c.match.home === false ? "En casa" : "Fuera"}</span>
              </div>
            </div>
            <p className="vd-status pp-status">
              {live && fase !== "descanso" && <span className="vd-live">En directo</span>}
              {live && fase !== "descanso" && <span className="vd-clock">{edge}′</span>}
              <span>{p.status}</span>
            </p>
            {p.sync && (
              <p className="pp-sync" role="status">
                <Icon name="wifiOff" />
                {p.sync}
              </p>
            )}
            {scorers && (
              <div className="pp-scorers">
                <ul className="pp-scorers__us" aria-label="Goles del Piti">
                  {ours.map((g) => (
                    <li key={g.key} className={g.later ? "is-later" : undefined}>
                      <span className="vd-clock">{g.m}′</span> {g.name}
                    </li>
                  ))}
                </ul>
                <div className="pp-scorers__them">
                  {theirs.length > 0 && (
                    <p className="pp-scorers__rival" role="img" aria-label={`Goles de ${c.rival}: ${theirs.map((g) => g.m).join(", ")}`}>
                      <span className="pp-scorers__rn" aria-hidden="true">
                        {c.rival}
                      </span>
                      <span className="pp-scorers__mins" aria-hidden="true">
                        {theirs.map((g) => (
                          <span key={g.key} className={`vd-clock${g.later ? " is-later" : ""}`}>
                            {g.m}′
                          </span>
                        ))}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pp-lens__mov">
            <div className={movCls}>
              {played && (
                <>
                  <p className="pp-mov__k" aria-hidden="true">
                    <b>La moviola</b>
                    <span>arriba aprieta el Piti, abajo {c.rival}</span>
                  </p>
                  <div className="pp-mov__track" ref={track}>
                    <div className="vd-ribbon pp-rib" role="group" aria-label={`El partido minuto a minuto: arriba aprieta el Piti, abajo ${c.rival}. Toca una jugada para ir a ese minuto.`}>
                      <svg viewBox="0 0 500 74" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                        <defs>
                          <linearGradient id="pp-us-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#EAF3FC" stopOpacity=".75" />
                            <stop offset="1" stopColor="#6CABDD" stopOpacity=".12" />
                          </linearGradient>
                          <clipPath id="pp-played-clip">
                            <rect x="0" y="0" width={((m / duration) * 500).toFixed(1)} height="74" />
                          </clipPath>
                        </defs>
                        <line className="vd-ribbon__axis" x1="0" y1="37" x2="500" y2="37" />
                        <line className="vd-ribbon__tick" x1="250" y1="18" x2="250" y2="56" strokeDasharray="2 3" />
                        <path className="vd-ribbon__us pp-rib__ghost" d={paths.us} fill="url(#pp-us-grad)" />
                        <path className="vd-ribbon__them pp-rib__ghost" d={paths.them} />
                        <g clipPath="url(#pp-played-clip)">
                          <path className="vd-ribbon__us" d={paths.us} fill="url(#pp-us-grad)" />
                          <path className="vd-ribbon__them" d={paths.them} />
                        </g>
                      </svg>
                      {marks.map((k) => (
                        <button key={k.key} type="button" className={`vd-ribbon__mark ${k.cls}`} style={{ left: `${k.left}%`, top: `${k.top}%` }} aria-label={k.label} tabIndex={-1} onClick={() => p.onSeek(k.to, false)}>
                          {k.icon && <Icon name={k.icon as "ball"} className="" />}
                          {k.n > 1 && (
                            <b className="pp-rib__n" aria-hidden="true">
                              {k.n}
                            </b>
                          )}
                        </button>
                      ))}
                      {live && <span className="vd-ribbon__now pp-rib__live" style={{ left: `${((edge / duration) * 100).toFixed(2)}%` }} aria-hidden="true" />}
                      <span className="vd-ribbon__lab vd-ribbon__lab--start" style={{ left: "0%" }} aria-hidden="true">
                        0′
                      </span>
                      <span className="vd-ribbon__lab" style={{ left: "50%" }} aria-hidden="true">
                        Descanso
                      </span>
                      <span className="vd-ribbon__lab vd-ribbon__lab--end" style={{ left: "100%" }} aria-hidden="true">
                        {duration}′
                      </span>
                    </div>
                    <div className="pp-head" style={{ left: `${((m / duration) * 100).toFixed(2)}%` }} aria-hidden="true">
                      <span className="pp-head__line" />
                      <span className={`pp-head__tip${tipCls ? ` ${tipCls}` : ""}`}>
                        <b className="vd-clock">{m}′</b>
                        <span>{tip}</span>
                      </span>
                    </div>
                    <input className="pp-mov__range" type="range" min={0} max={edge} step={1} value={m} onChange={(e: ChangeEvent<HTMLInputElement>) => p.onSeek(Number(e.target.value), true)} aria-label="La moviola: minuto del partido" aria-valuetext={valueText} />
                  </div>
                  <div className="pp-mov__bar">
                    <button type="button" className="vd-glass vd-press vd-ibtn pp-mov__b" onClick={() => p.onJump(-1)} aria-label="Jugada anterior">
                      <Icon name="chev-l" />
                    </button>
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pp-mov__play" onClick={p.onPlay} aria-pressed={p.playing}>
                      <Icon name={p.playing ? "pause" : "play"} />
                      <span>{playLabel}</span>
                    </button>
                    <button type="button" className="vd-glass vd-press vd-ibtn pp-mov__b" onClick={() => p.onJump(1)} aria-label="Jugada siguiente">
                      <Icon name="chev-r" />
                    </button>
                    {dragged && (
                      <button type="button" className="vd-link pp-mov__back" onClick={() => p.onSeek(edge, false)}>
                        {live ? "Volver al directo" : "Ir al final"}
                      </button>
                    )}
                    <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pp-mov__share" onClick={() => c.open("momento")} aria-haspopup="dialog" aria-label={shareAria}>
                      <Icon name="share" />
                      <span>Compartir el {m}′</span>
                    </button>
                  </div>
                  <p className="pp-mov__hint">{hint}</p>
                </>
              )}
              {tarde && (
                <>
                  <p className="pp-mov__k" aria-hidden="true">
                    <b>La tarde</b>
                    <span>el sol sobre {c.venueShort}, hora a hora</span>
                  </p>
                  <div className="pp-tarde" role="group" aria-label="La tarde del partido, hora a hora">
                    <ol className="pp-tarde__marks pp-tarde__marks--top">
                      {tarde.top.map((t) => (
                        <li key={t.t} className={t.cls || undefined} style={{ left: `${t.left}%` }}>
                          <span>{t.t}</span>
                          <b className="vd-clock">{t.h}</b>
                        </li>
                      ))}
                    </ol>
                    <div className="pp-tarde__sky" aria-hidden="true">
                      <svg viewBox="0 0 500 74" preserveAspectRatio="none" focusable="false">
                        <path className="pp-tarde__curve" d={tarde.sunD} />
                        <line className="pp-tarde__hz" x1="0" y1="56" x2="500" y2="56" />
                      </svg>
                      <span className="pp-tarde__win" style={{ left: `${tarde.winL}%`, width: `${tarde.winW}%` }}>
                        <span>El partido</span>
                      </span>
                      <span className="pp-tarde__sun" style={{ left: `${tarde.sunX}%`, top: `${tarde.sunY}%` }} />
                      {tarde.ticks.map((k) => (
                        <span key={k} className="pp-tarde__tick" style={{ left: `${k}%` }} />
                      ))}
                    </div>
                    <ol className="pp-tarde__marks">
                      {tarde.marks.map((t) => (
                        <li key={t.t} className={t.cls || undefined} style={{ left: `${t.left}%` }}>
                          <b className="vd-clock">{t.h}</b>
                          <span>{t.t}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
              {c.off && (
                <div className="pp-still">
                  <Icon name={c.off === "aplazado" ? "cal" : "mesa"} />
                  <p>
                    <b>{p.stillT}</b>
                    <span>{p.stillD}</span>
                  </p>
                </div>
              )}
            </div>
            <LensActs p={p} />
          </div>
        </Lens>
      </div>
    </>
  );
}

function LensActs({ p }: { p: HeadProps }) {
  const items: ReactNode[] = [];
  if (p.mesa)
    items.push(
      <Go key="mesa" className="vd-glass vd-press vd-btn vd-btn--pri vd-btn--sm" href={`${p.c.base}/mesa`}>
        <Icon name="mesa" />
        {p.mesa.label}
      </Go>,
    );
  if (p.avisos)
    items.push(
      <button key="av" type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => p.c.open("avisos")} aria-haspopup="dialog" aria-label={p.avisos.aria}>
        <Icon name="bell" />
        {p.avisos.label}
      </button>,
    );
  // El vídeo del partido (Encuentro): the whole match on YouTube, in another tab
  const video = matchVideoHref(p.c.match.videoUrl);
  if (video)
    items.push(
      <a key="video" className="vd-glass vd-press vd-btn vd-btn--sm pp-video" href={video} target="_blank" rel="noopener noreferrer" aria-label="Ver el partido en YouTube (se abre en otra pestaña)">
        <SocialIcon name="youtube" className="pp-i" />
        Ver el partido en YouTube
      </a>,
    );
  if (p.pip)
    items.push(
      <button key="pip" type="button" className="vd-glass vd-press vd-btn vd-btn--sm pp-desk" onClick={p.pip.toggle} aria-pressed={p.pip.open}>
        <Icon name="pip" />
        {p.pip.open ? "Traer el marcador" : "Sacar el marcador"}
      </button>,
    );
  return <div className="pp-lensacts">{items}</div>;
}

export type { Play };
