// /club/historia · La historia (CL- boards, part-historia): «La línea del club» — the season as a line of light, a
// bead per jornada with its letter and the pieces it won above —, its four counts and «La vitrina tras la J…» going
// back to the jornada you drag to; «Repasar la temporada» walks it and announces each new piece. Under it the last
// jornada told in a line and «Lo que viene», the season letter by letter, the moments and who we are.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../components/vidrio/env";
import { Go, I } from "./ui";
import { lensOf, letterOf, lineOf, matchHref, scoreOfJ, type ClubSeason, type Piece } from "./model";

export interface HistoriaProps {
  S: ClubSeason;
  pieces: Piece[];
  /** «Temporada 1 · en curso · sin tabla todavía tras la J1». */
  seasonLine: string;
  last: { k: string; t: string; d: string } | null;
  moments: { y: string; t: string; d: string; cls: string; href: string | null }[];
  story: string;
  meta: string;
  crest: string;
  /** The club's photos (https only). */
  gallery: { url: string; caption: string }[];
  cap: boolean;
  say: (t: string) => void;
}

export function Historia({ S, pieces, seasonLine, last, moments, story, meta, crest, gallery, cap, say }: HistoriaProps) {
  const [h, setH] = useState(S.played);
  const [playing, setPlaying] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [all, setAll] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const freshT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hRef = useRef(h);
  useEffect(() => {
    hRef.current = h;
  }, [h]);
  // (a season that arrives after the first paint starts at today)
  const seen = useRef(S.played);
  useEffect(() => {
    if (seen.current !== S.played) {
      seen.current = S.played;
      setH(S.played);
    }
  }, [S.played]);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (freshT.current) clearTimeout(freshT.current);
    },
    [],
  );
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  const newAt = (j: number) => {
    const got = pieces.filter((p) => p.at === j);
    if (!got.length) return;
    if (freshT.current) clearTimeout(freshT.current);
    setFresh(true);
    say(got.length === 1 ? `Pieza nueva para la vitrina: ${got[0].kicker.toLowerCase()}.` : `${got.length} piezas nuevas para la vitrina en la J${j}.`);
    freshT.current = setTimeout(() => setFresh(false), prefersReducedMotion() ? 400 : 1600);
  };
  const seek = (j: number) => setH(Math.max(0, Math.min(S.played, Math.round(j))));
  const step = (d: number) => {
    const n = hRef.current + d;
    if (n < 0 || n > S.played) return;
    setH(n);
    if (d > 0) newAt(n);
  };
  const play = () => {
    if (prefersReducedMotion()) {
      step(1);
      return;
    }
    const start = hRef.current >= S.played ? 0 : hRef.current;
    setPlaying(true);
    setH(start);
    hRef.current = start;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(
      () => {
        const n = hRef.current + 1;
        if (n > S.played) {
          stop();
          return;
        }
        hRef.current = n;
        setH(n);
        newAt(n);
      },
      S.played > 8 ? 380 : 700,
    );
  };

  const line = lineOf(S, pieces, h, playing);
  const lens = lensOf(S, pieces, h);
  const played = S.jornadas.slice(0, S.played);
  const real = played.filter((x) => x.gf !== null);
  const res = played.map((x) => {
    const L = letterOf(x);
    return { id: x.id, j: x.j, letter: L, score: x.off ? "—" : scoreOfJ(x), code: x.code, cls: x.off ? "is-off" : `is-${String(L).toLowerCase()}`, label: `J${x.j}: ${x.off ? `aplazado ante ${x.rival}` : `${(x.gf ?? 0) > (x.ga ?? 0) ? "ganamos" : (x.gf ?? 0) < (x.ga ?? 0) ? "perdimos" : "empatamos"} ${scoreOfJ(x)} ante ${x.rival}`}` };
  });
  const showRes = all || res.length <= 8 ? res : res.slice(-8);
  const won = real.filter((x) => (x.gf ?? 0) > (x.ga ?? 0)).length;
  const lost = real.filter((x) => (x.gf ?? 0) < (x.ga ?? 0)).length;
  const gf = real.reduce((a, x) => a + (x.gf ?? 0), 0);
  const ga = real.reduce((a, x) => a + (x.ga ?? 0), 0);
  const counts = [
    { v: String(real.length), l: "jugados" },
    { v: `${won}·${real.length - won - lost}·${lost}`, l: "G · E · P" },
    { v: `${gf}–${ga}`, l: "goles" },
    { v: S.pos ? `${S.pos}º` : "—", l: S.pos ? "en la tabla" : "sin tabla aún" },
  ];
  const lastJ = played.length ? played[played.length - 1] : null;
  const upcoming = S.jornadas
    .slice(S.played)
    .filter((x) => !x.off)
    .slice(0, 5);
  const left = S.jornadas.length - S.played;
  const first = S.jornadas[0];

  return (
    <>
      <section className={`vd-glass vd-glass--lens vd-lens cb-lens${fresh ? " is-new" : ""}`} data-vd-lens="22,1.3,10" aria-labelledby="cb-lens-t">
        <span className="vd-glint" aria-hidden="true" />
        <div className="cb-lens__top">
          <div className="cb-lens__id">
            <h2 id="cb-lens-t">La línea del club</h2>
            <p>{seasonLine}</p>
          </div>
          <div className="cb-counts" role="group" aria-label={lens.countsLabel}>
            {lens.counts.map((c) => (
              <p key={c.label} className={`vd-count cb-count${c.pop && fresh ? " is-pop" : ""}`}>
                <b>{c.v}</b>
                <span>{c.label}</span>
              </p>
            ))}
          </div>
        </div>
        <div className={`cb-line${line.cls ? ` ${line.cls}` : ""}`}>
          <div className="cb-line__track">
            <svg className="cb-line__svg" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <line className="cb-line__axis" x1="0" y1="45" x2="1000" y2="45" />
              <path className="cb-line__ghost" d={line.allD} />
              <path className="cb-line__lit" d={line.litD} />
            </svg>
            {line.beads.map((b) => (
              <button
                key={b.j}
                type="button"
                className={`cb-bead ${b.cls}`}
                style={{ left: `${b.left}%`, top: `${b.top}%` }}
                aria-label={b.label}
                tabIndex={-1}
                onClick={() => {
                  if (b.played) {
                    stop();
                    seek(b.j);
                  } else say(`La J${b.j} se juega el ${b.date.toLowerCase()}.`);
                }}
              >
                <span aria-hidden="true">{b.letter}</span>
              </button>
            ))}
            {line.marks.map((k) => (
              <button
                key={k.j}
                type="button"
                className={`vd-glass cb-mark${k.cls ? ` ${k.cls}` : ""}`}
                style={{ left: `${k.left}%` }}
                aria-label={k.label}
                tabIndex={-1}
                onClick={() => {
                  stop();
                  seek(k.j);
                  newAt(k.j);
                }}
              >
                <svg aria-hidden="true" focusable="false">
                  <use href={`#vi-${k.icon}`} />
                </svg>
                {k.many && <b aria-hidden="true">{k.n}</b>}
              </button>
            ))}
            <span className="cb-today" style={{ left: `${line.todayPct}%` }} aria-hidden="true">
              {line.todayLab && <span className="cb-today__l">Hoy</span>}
            </span>
            {line.hasHead && (
              <>
                <div className="cb-head" style={{ left: `${line.headPct}%` }} aria-hidden="true">
                  <span className="cb-head__line" />
                  <span className={`cb-head__tip${line.tipCls ? ` ${line.tipCls}` : ""}`}>{line.tip}</span>
                </div>
                <input
                  className="cb-line__range"
                  type="range"
                  min={0}
                  max={S.played}
                  step={1}
                  value={h}
                  onChange={(e) => {
                    stop();
                    const v = Number(e.target.value);
                    const was = hRef.current;
                    seek(v);
                    if (v > was) newAt(v);
                  }}
                  aria-label="La línea del club: jornada"
                  aria-valuetext={line.valueText}
                />
              </>
            )}
          </div>
          <div className="cb-line__labs" aria-hidden="true">
            <span>{line.startLab}</span>
            <span>{line.endLab}</span>
          </div>
          <div className="cb-line__bar">
            {line.hasHead && (
              <>
                <button
                  type="button"
                  className="vd-glass vd-press vd-ibtn"
                  onClick={() => {
                    stop();
                    step(-1);
                  }}
                  aria-label="Jornada anterior"
                >
                  <I n="chev-l" />
                </button>
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm cb-play" onClick={() => (playing ? stop() : play())} aria-pressed={playing}>
                  <I n={playing ? "pause" : "play"} />
                  <span>{playing ? "Pausa" : "Repasar la temporada"}</span>
                </button>
                <button
                  type="button"
                  className="vd-glass vd-press vd-ibtn"
                  onClick={() => {
                    stop();
                    step(1);
                  }}
                  aria-label="Jornada siguiente"
                >
                  <I n="chev-r" />
                </button>
              </>
            )}
            <p className="cb-line__hint">{line.hint}</p>
            {line.back && (
              <button
                type="button"
                className="vd-link cb-line__back"
                onClick={() => {
                  stop();
                  seek(S.played);
                }}
              >
                Volver a hoy
              </button>
            )}
          </div>
        </div>
        <div className="cb-lshelf">
          <p className="cb-lshelf__t">{lens.shelfT}</p>
          <ul className="cb-lshelf__l">
            {lens.shelf.map((s) => (
              <li key={s.id} className={s.cls} aria-label={s.label}>
                <svg aria-hidden="true" focusable="false">
                  <use href={`#vi-${s.icon}`} />
                </svg>
                <span aria-hidden="true">{s.t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="cb-hnow">
        {lastJ && last && (
          <Go className={`cb-hlast is-${String(letterOf(lastJ)).toLowerCase()}`} href={matchHref(lastJ)}>
            <span className="cb-hlast__k">{last.k}</span>
            <span className="cb-hlast__score">
              <img src="/crest-128.webp" alt="" width={40} height={40} />
              <b>{scoreOfJ(lastJ) || "—"}</b>
              <span className="cb-hlast__rival">
                <i aria-hidden="true">{letterOf(lastJ)}</i>
                {lastJ.rival}
              </span>
            </span>
            <span className="cb-hlast__t">{last.t}</span>
            <span className="cb-hlast__d">{last.d}</span>
            <span className="cb-hlast__go">
              Abrir el partido
              <I n="chev-r" />
            </span>
          </Go>
        )}
        {upcoming.length > 0 && (
          <section className="cb-hup" aria-labelledby="cb-hup-t">
            <h2 id="cb-hup-t" className="cb-h2">
              Lo que viene <span>{left ? `${left}${left === 1 ? " jornada por jugar" : " jornadas por jugar"}` : "Temporada terminada"}</span>
            </h2>
            <ol className="cb-hup__l">
              {upcoming.map((u) => (
                <li key={u.id} className={u.home ? "is-home" : "is-away"}>
                  <Go href={matchHref(u)} aria-label={`J${u.j}, ${u.home ? "contra " : "en casa de "}${u.rival}, ${u.date}${u.time ? ` a las ${u.time}` : ""}`}>
                    <span className="cb-hup__j">J{u.j}</span>
                    <span className="cb-hup__code">{u.code}</span>
                    <b>{u.rival}</b>
                    <span>
                      {u.date} · {u.time ?? "Hora por fijar"}
                    </span>
                    <span className="cb-hup__where">{u.home ? "En casa" : "Fuera"}</span>
                  </Go>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      <div className="cb-hisgrid">
        <section className="cb-season" aria-labelledby="cb-season-t">
          <h2 id="cb-season-t" className="cb-h2">
            La temporada
          </h2>
          <div className="cb-season__counts">
            {counts.map((c) => (
              <p key={c.l} className="vd-count">
                <b>{c.v}</b>
                <span>{c.l}</span>
              </p>
            ))}
          </div>
          {res.length > 0 ? (
            <>
              <ol className="cb-res" aria-label="Resultados de la temporada">
                {showRes.map((r) => (
                  <li key={r.id} className={`cb-res__i ${r.cls}`}>
                    <Go href={`/partidos/${r.id}`} aria-label={r.label}>
                      <span className="cb-res__j">J{r.j}</span>
                      <b className="cb-res__l">{r.letter}</b>
                      <span className="cb-res__s">{r.score}</span>
                      <span className="cb-res__r">{r.code}</span>
                    </Go>
                  </li>
                ))}
              </ol>
              {res.length > 8 && (
                <div className="vd-more">
                  <span>{all ? `Las ${res.length} jornadas` : `${res.length - 8} jornadas más`}</span>
                  <button type="button" className="vd-more__btn" aria-expanded={all} onClick={() => setAll(!all)}>
                    {all ? "Ver menos" : "Ver todas"}
                    <svg aria-hidden="true" focusable="false">
                      <use href={`#vi-${all ? "collapse" : "expand"}`} />
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="cb-empty">{first ? `La temporada empieza el ${first.date.replace(/^\S+ /, `${weekday(first.date)} `)} contra ${first.rival}. Cada jornada se pinta aquí con su letra: G, E o P.` : "La temporada se pinta aquí jornada a jornada, con su letra: G, E o P."}</p>
          )}
          <p className="cb-row-acts">
            <Go className="vd-link" href="/partidos">
              La temporada en Partidos
            </Go>
            <Go className="vd-link" href="/estadisticas">
              Sus números
            </Go>
          </p>
        </section>

        <section className="cb-moments" aria-labelledby="cb-mom-t">
          <h2 id="cb-mom-t" className="cb-h2">
            Los momentos
          </h2>
          <ol className="cb-moments__l">
            {moments.map((m) => (
              <li key={`${m.y}-${m.t}`} className={m.cls}>
                <span className="cb-moments__y">{m.y}</span>
                <div>
                  <b>{m.t}</b>
                  <span>{m.d}</span>
                  {m.href && (
                    <Go className="vd-link" href={m.href}>
                      Ver el partido
                    </Go>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {cap && (
            <Go className="vd-link" href="/admin/contenido?seccion=momentos">
              Editar los momentos
            </Go>
          )}
        </section>

        <section className="cb-story" aria-labelledby="cb-story-t">
          <h2 id="cb-story-t" className="cb-h2">
            Quiénes somos
          </h2>
          <p>{story}</p>
          {meta && (
            <p className="cb-story__meta">
              <I n="flag" />
              {meta}
            </p>
          )}
          {crest && (
            <div className="cb-story__crest">
              <img src="/crest-128.webp" alt="El escudo del Manchester Piti" width={64} height={64} />
              <div>
                <h3>La historia del escudo</h3>
                <p>{crest}</p>
              </div>
            </div>
          )}
          <h3>Del vestuario al campo</h3>
          {gallery.length > 0 && (
            <ul className="cb-gallery" aria-label="Fotos del club">
              {gallery.map((g, i) => (
                <li key={g.url}>
                  <a href={g.url} target="_blank" rel="noopener noreferrer" aria-label={`${g.caption || `Foto ${i + 1}`} (se abre en otra pestaña)`}>
                    <img src={g.url} alt="" loading="lazy" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="cb-empty" hidden={gallery.length > 0}>
            Las fotos del club llegarán aquí cuando el capitán suba la primera.
            {cap && (
              <>
                {" "}
                <Go className="vd-link" href="/admin/contenido?seccion=galeria">
                  Subir fotos
                </Go>
              </>
            )}
          </p>
        </section>
      </div>
    </>
  );
}

const WD: Record<string, string> = { Dom: "domingo", Lun: "lunes", Mar: "martes", Mié: "miércoles", Jue: "jueves", Vie: "viernes", Sáb: "sábado" };
const weekday = (short: string) => WD[short.split(" ")[0]] ?? "";
