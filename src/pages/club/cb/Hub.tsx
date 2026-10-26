// /club · the hub (CL- boards, part-hub): the head with the next match, «Compartir el club» and the club's Instagram
// and YouTube, the vitrina — a lit
// museum case with the piece in focus turning on its peana (drag the range, the arrows or «Darle la vuelta») and the
// shelves in depth with every piece, the missing ones frosted —, the plaque with its date and «Ver el partido»,
// a member's own pieces, and the four doors, each with a living detail of its room.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { prefersReducedMotion } from "../../../components/vidrio/env";
import { SocialIcon } from "../../../components/vidrio/SocialIcon";
import { socialLabel, type SocialLink } from "../../../lib/social";
import { Go, I, Hero3, Obj, type ObjCtx } from "./ui";
import type { Mine, Piece, PieceId } from "./model";
import type { Room } from "./nav";

export interface Door {
  id: Room;
  t: string;
  k: string;
  live: string;
  badge: number;
  badgeText: string;
  // La historia
  jj?: { t: string; s: string; cls: string }[];
  spark?: string;
  dotsP?: string;
  dotsN?: string;
  // El equipo
  front?: string;
  shirt?: string;
  // La gente
  person?: string;
  person2?: string;
  day?: string;
  month?: string;
  cal?: { month: string; day: string; t: string };
  spons?: string[];
  // El vestuario
  sign?: string;
  chips?: string[];
}

export interface HubProps {
  headSub: string;
  next: { text: string; href: string };
  share: () => void;
  /** The club's profiles (Instagram, YouTube), beside «Compartir el club». */
  social: readonly SocialLink[];
  pieces: Piece[];
  focus: PieceId;
  pick: (id: PieceId) => void;
  seasonName: string;
  ctx: ObjCtx;
  /** The kit's back still (the shirt piece's back). */
  back: string | undefined;
  mine: { name: string; list: Mine[] } | null;
  doors: Door[];
  /** The room the hub was left for: its door carries the head's name on the way back. */
  from: Room | null;
  open: (id: Room, e: MouseEvent<HTMLButtonElement>) => void;
}

const pad = (i: number) => `${i + 1 < 10 ? "0" : ""}${i + 1}`;

export function Hub({ headSub, next, share, social, pieces, focus, pick, seasonName, ctx, back, mine, doors, from, open }: HubProps) {
  const [ry, setRy] = useState(-32);
  const cab = useRef<HTMLDivElement | null>(null);
  // (the case's light follows a mouse or a pen, as the board's cabRef, once a frame; a finger leaves it at rest)
  useEffect(() => {
    const el = cab.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    let wx = "";
    let wy = "";
    const set = () => {
      raf = 0;
      const b = el.getBoundingClientRect();
      const x = `${(((px - b.left) / b.width) * 100).toFixed(1)}%`;
      const y = `${(((py - b.top) / b.height) * 100).toFixed(1)}%`;
      if (x !== wx) el.style.setProperty("--mx", (wx = x));
      if (y !== wy) el.style.setProperty("--my", (wy = y));
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" || document.hidden) return;
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(set);
    };
    el.addEventListener("pointermove", move);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
    };
  }, []);
  const choose = useCallback(
    (id: PieceId) => {
      setRy(-32);
      pick(id);
    },
    [pick],
  );

  const earned = pieces.filter((p) => p.at !== null).length;
  const fIdx = Math.max(0, pieces.findIndex((p) => p.id === focus));
  const fp = pieces[fIdx];
  const fHas = fp.at !== null;
  const meta = fHas ? [fp.date, fp.match].filter(Boolean).join(" · ") : "Por conseguir";
  const note = fHas ? (fp.note ?? "") : fp.cup ? "Cuando llegue la primera copa, tendrá su sitio en la balda de arriba." : "Se ilumina sola el día que se gane.";

  return (
    <div className="cb-hub">
      <header className="cb-hubhead">
        <h1 className="cb-title">El club</h1>
        <p className="cb-sub">{headSub}</p>
        <p className="cb-hubhead__next">
          <Go className="vd-link" href={next.href}>
            {next.text}
          </Go>
        </p>
        <div className="cb-hubacts">
          {social.map((l) => (
            <a key={l.key} className="vd-glass vd-press vd-btn vd-btn--sm cb-soc" href={l.href} target="_blank" rel="noopener noreferrer" aria-label={socialLabel(l)}>
              <SocialIcon name={l.key} className="cb-i" />
              <span>{l.name}</span>
            </a>
          ))}
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm cb-share" onClick={share}>
            <I n="share" />
            <span>Compartir el club</span>
          </button>
        </div>
      </header>

      <section className="cb-show" aria-labelledby="cb-vit-t">
        <div className={`cb-vit${fHas ? "" : " is-empty"}`} ref={cab}>
          <span className="cb-vit__wall" aria-hidden="true" />
          <span className="cb-vit__side cb-vit__side--l" aria-hidden="true" />
          <span className="cb-vit__side cb-vit__side--r" aria-hidden="true" />
          <span className="cb-vit__ceil" aria-hidden="true">
            {pieces.map((p, i) => (
              <i key={p.id} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
          <span className="cb-vit__floor" aria-hidden="true" />
          <p className="cb-vit__plate" id="cb-vit-t">
            <b>La vitrina</b>
            <span>
              {earned} de {pieces.length} piezas · {seasonName}
            </span>
          </p>
          <div className="cb-vit__stage" style={{ "--ry": `${ry}deg` } as CSSProperties}>
            <span className="cb-vit__cone" aria-hidden="true" />
            <div className="cb-vit__turn" aria-hidden="true">
              <div className="cb-vit__obj">
                <Hero3 p={fp} has={fHas} ry={ry} ctx={ctx} back={back} />
              </div>
              <span className="cb-vit__disc" />
            </div>
            <input
              className="cb-vit__range"
              type="range"
              min={-180}
              max={180}
              step={5}
              value={ry}
              onChange={(e) => setRy(Number(e.target.value))}
              aria-label="La peana: arrastra para girar la pieza"
              aria-valuetext={`Girada ${Math.round(ry)} grados`}
            />
          </div>
          <ul className="cb-vit__shelves" aria-label="Las baldas: toca una pieza para llevarla a la peana">
            {pieces.map((p, i) => {
              const has = p.at !== null;
              const on = p.id === focus;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={["cb-slot", has ? "is-has" : "is-not", p.cup ? "is-cup" : "", on ? "is-on" : ""].filter(Boolean).join(" ")}
                    style={{ "--i": i } as CSSProperties}
                    aria-pressed={on}
                    onClick={() => choose(p.id)}
                    aria-label={`${p.kicker}: ${has ? `${p.title}, ${p.detail}` : `por conseguir, ${p.detail}`}`}
                  >
                    <span className="cb-slot__light" aria-hidden="true" />
                    <span className="cb-slot__shadow" aria-hidden="true" />
                    <Obj p={p} has={has} ctx={ctx} />
                    {!has && <span className="cb-slot__frost" aria-hidden="true" />}
                    <span className="cb-slot__lab" aria-hidden="true">
                      <i>{pad(i)}</i>
                      {p.kicker}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <span className="cb-vit__dust" aria-hidden="true" />
          <span className="cb-vit__glass" aria-hidden="true" />
          <span className="cb-vit__frame" aria-hidden="true" />
          <span className="cb-vit__spot" aria-hidden="true" />
        </div>

        <div className="cb-plaque">
          <p className="cb-plaque__n">
            Nº {pad(fIdx)} · {fp.kicker}
          </p>
          <p className={`cb-plaque__t${fHas ? "" : " is-dim"}`}>{fp.title}</p>
          <p className="cb-plaque__d">{fp.detail}</p>
          <p className="cb-plaque__m">{meta}</p>
          <p className="cb-plaque__note">{note}</p>
          <div className="cb-plaque__acts">
            <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => setRy((r) => Math.max(-180, r - 45))} aria-label="Girar a la izquierda">
              <I n="chev-l" />
            </button>
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => setRy((r) => (Math.abs(r) > 90 ? -18 : 180))}>
              Darle la vuelta
            </button>
            <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => setRy((r) => Math.min(180, r + 45))} aria-label="Girar a la derecha">
              <I n="chev-r" />
            </button>
            {fHas && fp.matchId && fp.match && (
              <Go className="vd-link cb-plaque__go" href={`/partidos/${fp.matchId}`}>
                Ver el partido
              </Go>
            )}
          </div>
          {mine && (
            <div className="cb-mine">
              <p className="cb-mine__h">
                <b>Tus piezas, {mine.name}</b>
                <span>Solo las ves tú · {mine.list.filter((m) => m.has).length} de 6.</span>
              </p>
              <ul className="cb-mine__l">
                {mine.list.map((m) => (
                  <li key={m.t} className={m.has ? "is-has" : "is-not"}>
                    <svg aria-hidden="true" focusable="false">
                      <use href={`#vi-${m.has ? "check" : "lock"}`} />
                    </svg>
                    <span>
                      <b>{m.t}</b>
                      <span>{m.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <nav className="cb-doors" aria-label="Las salas del club">
        {doors.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`cb-door cb-door--${d.id}`}
            style={{ viewTransitionName: from === d.id ? `cb-room-${d.id}` : "none" }}
            onClick={(e) => {
              // (only the door you touch carries the name: it grows into the room's head)
              e.currentTarget.style.viewTransitionName = `cb-room-${d.id}`;
              open(d.id, e);
            }}
            aria-label={`${d.t}. ${d.live}${d.badge ? `. ${d.badgeText}` : ""}`}
          >
            <span className="cb-door__arch" aria-hidden="true">
              <span className="cb-door__glow" />
              {d.id === "historia" && (
                <>
                  <svg className="cb-door__spark" viewBox="0 0 120 36" aria-hidden="true" focusable="false">
                    <line className="cb-door__axis" x1="0" y1="18" x2="120" y2="18" />
                    <path d={d.spark} />
                    <path className="cb-door__dotsn" d={d.dotsN} />
                    <path className="cb-door__dotsp" d={d.dotsP} />
                  </svg>
                  <span className="cb-door__jj">
                    {(d.jj ?? []).map((x) => (
                      <span key={x.t} className={x.cls}>
                        <b>{x.t}</b>
                        <i>{x.s}</i>
                      </span>
                    ))}
                  </span>
                </>
              )}
              {d.id === "equipo" && (
                <>
                  {d.front ? <img className="cb-door__front" src={d.front} alt="" width={540} height={600} /> : <span className="cb-door__front" />}
                  {d.shirt ? <img className="cb-door__shirt" src={d.shirt} alt="" width={540} height={600} /> : <span className="cb-door__shirt" />}
                </>
              )}
              {d.id === "gente" &&
                (d.person ? (
                  <>
                    {d.person2 && <img className="cb-door__person2" src={d.person2} alt="" width={540} height={600} />}
                    <img className="cb-door__person" src={d.person} alt="" width={540} height={600} />
                    <span className="cb-door__date">
                      <b>{d.day}</b>
                      <span>{d.month}</span>
                    </span>
                    <span className="cb-door__cake">
                      <svg aria-hidden="true" focusable="false">
                        <use href="#vi-cake" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <>
                    {d.cal && (
                      <span className="cb-door__cal">
                        <span className="cb-door__calm">{d.cal.month}</span>
                        <b>{d.cal.day}</b>
                        <span className="cb-door__calt">{d.cal.t}</span>
                      </span>
                    )}
                    <span className="cb-door__spons">
                      {(d.spons ?? []).map((s) => (
                        <i key={s}>{s}</i>
                      ))}
                      <i className="is-free">+</i>
                    </span>
                  </>
                ))}
              {d.id === "vestuario" && (
                <>
                  <span className="cb-door__tunnel" />
                  <span className="cb-door__sign">{d.sign}</span>
                  <span className="cb-door__chips">
                    {(d.chips ?? []).map((c) => (
                      <i key={c}>{c}</i>
                    ))}
                  </span>
                </>
              )}
            </span>
            <span className="cb-door__txt">
              <span className="cb-door__k">{d.k}</span>
              <b className="cb-door__t">{d.t}</b>
              <span className="cb-door__live">{d.live}</span>
            </span>
            {d.badge > 0 && (
              <span className="cb-door__badge" aria-hidden="true">
                {d.badge}
              </span>
            )}
            <span className="cb-door__go" aria-hidden="true">
              <svg aria-hidden="true" focusable="false">
                <use href="#vi-chev-r" />
              </svg>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
