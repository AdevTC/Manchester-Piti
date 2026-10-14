// The sheet's tools beyond the bench: the plan (Siete → Plan: the consignas and the reparto de
// minutos), the química, Comparar, Compartir and Ajustes, as designed. Each one is a thin view over pure
// data (plan.ts, bench.ts, quimica.ts, compare.ts, cartel.ts); the board does the changes.
import { useId, useState, type ReactNode } from "react";
import type { TacticKey } from "../tactics";
import { Icon, Nuevo, CREST } from "./icons";
import { nuevoOn } from "./rail";
import { vars } from "./view";
import { plural } from "./plural";
import { chemWhy, lucesOf, lucesTxt, tierOf, type Chem } from "./quimica";
import type { TacRow } from "./plan";
import type { RepRow } from "./bench";
import type { TapeRow } from "./compare";
import { cartelHead, type Cartel } from "./cartel";
import type { Squad } from "./model";
import type { ShowKey, ShowPrefs } from "./prefs";
import { intro3dWanted, setIntro3dWanted } from "./intro";
import { TeamDiamonds } from "./TacticaPanel";
import { ALL_SEASONS_LABEL } from "../../../lib/useSetSeason";

/** A panel's heading: the title speaks first and the old kicker is the line under it (the panels
 *  behind «Más» have «‹ Más» before it). */
export function PanelHead({ kick, title, onBack, extra }: { kick: ReactNode; title: string; onBack?: () => void; extra?: ReactNode }) {
  return (
    <div className="sh-h">
      {onBack && (
        <button type="button" className="back" onClick={onBack}>
          <Icon n="chevL" w={16} />
          Más
        </button>
      )}
      <div>
        <h2>{title}</h2>
        <span className="k2">{kick}</span>
      </div>
      {extra}
    </div>
  );
}

/** The química's big number (it counts up from the last value on every change), its tier and why. */
export function ChemTop({ ch, cls, dm }: { ch: Chem; cls: "qp-top" | "qsum"; dm?: number }) {
  const [anim, setAnim] = useState({ v: ch.v, q0: 0, k: 0 });
  if (anim.v !== ch.v) setAnim({ v: ch.v, q0: anim.v, k: anim.k + 1 });
  const [tier, sym] = tierOf(ch.v);
  return (
    <div className={cls}>
      <div className="qp-big">
        <span className={"qn " + (anim.k % 2 ? "ka" : "kb")} style={vars({ "--q": ch.v, "--q0": anim.q0 })} aria-hidden="true" />
        <span className="sr">{ch.v} de 100</span>
        <small>DE 100</small>
      </div>
      <div>
        <span className="tier">
          <i>{sym}</i>
          {tier}
        </span>
        <p>{chemWhy(ch)}</p>
        {dm != null && <TeamDiamonds n={dm} />}
      </div>
    </div>
  );
}

/** Goals, assists and minutes by line. */
export function ChemLines({ ch }: { ch: Chem }) {
  return (
    <div className="lines">
      {ch.lines.map((l) => (
        <div key={l.z}>
          <b>{l.z}</b>
          <span>
            <strong>{l.g}</strong>gol.
          </span>
          <span>
            <strong>{l.a}</strong>asist.
          </span>
          <span>
            <strong>{l.min}</strong>min
          </span>
        </div>
      ))}
    </div>
  );
}

/** The strongest lights of the seven. */
export function LucesList({ ch, sq, n }: { ch: Chem; sq: Squad; n: number }) {
  const luces = lucesOf(ch, sq, n);
  if (!luces.length) return <p className="empty">Sin luces todavía: coloca cromos vecinos y se encienden.</p>;
  return (
    <ul className="lk-list">
      {luces.map((li) => (
        <li key={li.key}>
          <span className={"lkb t" + li.t}>{li.mark}</span>
          <span>
            {li.who}
            <small>{li.why}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Siete → Plan ──
export interface PlanTabProps {
  rows: TacRow[];
  ro: boolean;
  rep: RepRow[];
  repTxt: string;
  canRotate: boolean;
  /** What the plan does in free mode (plan.ts planNote), shown over the consignas; null with a system. */
  note?: string | null;
  /** Bloque 4 (TacticaPanel.tsx): before the consignas (the record, the phases, the styles) and after them (the conditional plan). */
  top?: ReactNode;
  after?: ReactNode;
  onSet: (k: TacticKey, v: string) => void;
  onRotate: () => void;
}

export function PlanTab({ rows, ro, rep, repTxt, canRotate, note, top, after, onSet, onRotate }: PlanTabProps) {
  const uid = useId();
  return (
    <div className="pg">
      {top}
      {note && (
        <div className="cav">
          <Icon n="alert" w={16} />
          <span>
            <b>Modo libre:</b> {note}
          </span>
        </div>
      )}
      <div className="cons">
        {rows.map((t) => {
          const lid = uid + "tac-" + t.key;
          const last = t.options.length - 1;
          return (
            <div key={t.key} className="con" title={t.ct + ": " + t.cd}>
              <div className="con-t">
                <b>{t.ct}</b>
                <span className="cd2">{t.cd}</span>
              </div>
              <div className="stp" role="group" aria-labelledby={lid}>
                <button type="button" className="ib" onClick={() => onSet(t.key, t.options[t.vi - 1])} disabled={ro || t.vi <= 0} aria-label={t.label + ": opción anterior"}>
                  <Icon n="chevL" w={16} />
                </button>
                {/* (not a live region: the board's one announcer says the change) */}
                <output role="none">
                  <small id={lid}>{t.label}</small>
                  {t.value}
                  <span aria-hidden="true">
                    {t.options.map((o, k) => (
                      <i key={o} className={k === t.vi ? "on" : ""} />
                    ))}
                  </span>
                </output>
                <button type="button" className="ib" onClick={() => onSet(t.key, t.options[t.vi + 1])} disabled={ro || t.vi >= last} aria-label={t.label + ": opción siguiente"}>
                  <Icon n="chevR" w={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {after}
      <h3>Reparto de minutos · temporada</h3>
      <div className="rep">
        {rep.map((r) => (
          <div key={r.id} className={"rep-r" + (r.inS ? " in" : "")}>
            <b>{r.num}</b>
            <span>
              {r.name}
              {r.inS && <em>SIETE</em>}
            </span>
            <i style={vars({ "--m": r.m })} aria-hidden="true" />
            <small>{r.min}</small>
          </div>
        ))}
      </div>
      <div className="eq">
        <p>{repTxt}</p>
        <button type="button" className="b3" onClick={onRotate} disabled={ro || !canRotate}>
          <Icon n="rot" />
          Darle minutos
        </button>
      </div>
    </div>
  );
}

// ── Química ──
export interface QuimicaProps {
  ch: Chem;
  sq: Squad;
  seasonName: string;
  /** Out of position in this seven: «TELLO (DEF›MED)». */
  oop: string[];
  /** La química por jugador: the team's diamonds (0–21). */
  dm?: number;
}

const rv = (v: number) => (40 * v) / 100;

export function QuimicaPanel({ ch, sq, seasonName, oop, dm }: QuimicaProps) {
  const axes: [string, number][] = [
    ["Ataque", ch.at],
    ["Defensa", ch.de],
    ["Forma", ch.fo],
    ["Experiencia", ch.ex],
  ];
  const radarD = "M50 " + (50 - rv(ch.at)).toFixed(1) + "L" + (50 + rv(ch.de)).toFixed(1) + " 50L50 " + (50 + rv(ch.fo)).toFixed(1) + "L" + (50 - rv(ch.ex)).toFixed(1) + " 50Z";
  return (
    <>
      <PanelHead kick={"Química del siete · " + seasonName} title="Química" extra={<span className="cnt">{lucesTxt(ch.links.length)}</span>} />
      <ChemTop ch={ch} cls="qp-top" dm={dm} />
      <div className="s-half">
        <div className="radar">
          <svg viewBox="-14 -10 128 120" role="img" aria-label={"Radar del siete: " + axes.map((a) => a[0].toLowerCase() + " " + a[1]).join(", ")}>
            <path className="rg" d="M50 10L90 50L50 90L10 50Z" />
            <path className="rg" d="M50 30L70 50L50 70L30 50Z" />
            <path className="rg" d="M50 10V90M10 50H90" />
            <path className="ra" d={radarD} style={vars({ d: `path('${radarD}')` })} />
            <text x="50" y="5" textAnchor="middle">
              ATAQUE
            </text>
            <text x="94" y="52">
              DEF.
            </text>
            <text x="50" y="100" textAnchor="middle">
              FORMA
            </text>
            <text x="6" y="52" textAnchor="end">
              EXP.
            </text>
          </svg>
          <dl>
            {axes.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="legl" aria-label="Leyenda de la química">
          <span>
            <i className="t3" />
            ++ Top
          </span>
          <span>
            <i className="t2" />+ Buena
          </span>
          <span>
            <i className="t1" />– Floja
          </span>
        </div>
      </div>
      <div className="s-full">
        <h3>Por líneas · goles, asistencias y minutos</h3>
        <ChemLines ch={ch} />
        <h3>Las luces del siete</h3>
        <LucesList ch={ch} sq={sq} n={4} />
        {ch.fresh.length > 0 && (
          <div className="cav">
            <Icon n="alert" w={16} />
            <span>
              <b>Sin historial:</b> {ch.fresh.join(", ")}. Sin minutos juntos todavía: sus luces son débiles hasta que {ch.fresh.length > 1 ? "jueguen" : "juegue"}.
            </span>
          </div>
        )}
        {sq.games < 3 && ch.n > 0 && (
          <div className="cav">
            <Icon n="alert" w={16} />
            <span>
              <b>Pocos partidos:</b>{" "}
              {sq.games === 0 ? "esta temporada aún no se ha jugado ninguno; la química solo mira posiciones y forma." : "con " + plural(sq.games, "jugado") + ", la química aún es orientativa."}
            </span>
          </div>
        )}
        {oop.length > 0 && (
          <div className="cav">
            <Icon n="alert" w={16} />
            <span>
              <b>Fuera de sitio:</b> {oop.join(", ")}. Cada uno resta química: recolócalo o cámbiale el «Jugar de».
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ── Comparar ──
export interface CompararProps {
  options: { id: string; name: string }[];
  cmpId: string | null;
  aName: string;
  bName: string;
  rows: TapeRow[];
  ins: string[];
  outs: string[];
  onPick: (id: string) => void;
  onBack: () => void;
  onBoards: () => void;
}

export function CompararPanel(p: CompararProps) {
  return (
    <>
      <PanelHead
        kick={
          <>
            Cara a cara · en el campo {nuevoOn("comparar") && <Nuevo />}
          </>
        }
        title="Comparar"
        onBack={p.onBack}
      />
      {!p.options.length || !p.cmpId ? (
        <>
          <p className="empty">No hay otro tablero con el que comparar: duplica este o crea uno nuevo en Tableros.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="b3" onClick={p.onBoards}>
              <Icon n="boards" w={16} />
              Ir a Tableros
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="selw full">
            Contra
            <select value={p.cmpId} onChange={(e) => p.onPick(e.target.value)} aria-label="Tablero con el que comparar">
              {p.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <div className="tape">
            <div className="hd">
              <b>{p.aName}</b>
              <small>vs</small>
              <b>{p.bName}</b>
            </div>
            {p.rows.map((r) => (
              <div key={r.k}>
                <b className={r.ca}>{r.a}</b>
                <small>{r.k}</small>
                <b className={r.cb}>{r.b}</b>
              </div>
            ))}
          </div>
          <h3>Quién cambia · marcado en el campo</h3>
          <div className="chg">
            <div className="in">
              <small>
                <i aria-hidden="true" />
                ENTRAN
              </small>
              <ul>
                {(p.ins.length ? p.ins : ["Nadie"]).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
            <div className="out">
              <small>
                <i aria-hidden="true" />
                SALEN
              </small>
              <ul>
                {(p.outs.length ? p.outs : ["Nadie"]).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
          {!p.ins.length && !p.outs.length && <p className="empty">Los mismos siete: solo cambia la colocación.</p>}
        </>
      )}
    </>
  );
}

// ── Compartir ──
export interface CompartirProps {
  cartel: Cartel;
  /** Why the cartel can't go to the group yet (fewer than seven); null = it can. */
  block: string | null;
  busy: boolean;
  /** The PNG of this cartel is drawn (cartel.ts preparedFor): «Mandar al grupo» waits for it, so the
   *  share sheet opens inside the tap (Safari). Absent = ready. */
  ready?: boolean;
  canLink: boolean;
  onShare: () => void;
  onPng: () => void;
  /** Copy the board's link (`charla` = the link that opens its charla). */
  onLink: (charla: boolean) => void;
  onBack: () => void;
  /** The board's QR, «Clonar este tablero» and the jugada as a video (BoardShare). */
  extra?: ReactNode;
}

export function CompartirPanel({ cartel, block, busy, ready = true, canLink, onShare, onPng, onLink, onBack, extra }: CompartirProps) {
  const waiting = busy || (!ready && !block);
  return (
    <>
      <PanelHead kick="Al grupo del equipo" title="Compartir" onBack={onBack} />
      <div className="poster" role="img" aria-label={cartel.aria}>
        <div className="po-h">
          <img src={CREST} alt="" />
          <div>
            <small>{cartelHead(cartel)}</small>
            <b>LOS SIETE</b>
          </div>
        </div>
        <div className="po-p">
          {cartel.cromos.map((c) => (
            <span key={c.id} className="po-d" style={vars({ "--x": c.x, "--y": c.y })}>
              <b>{c.num}</b>
              <span>{c.name}</span>
            </span>
          ))}
        </div>
        {cartel.cons.length > 0 && (
          <div className="po-f">
            <span>CONSIGNAS</span>
            <span>{cartel.cons.join(" · ")}</span>
          </div>
        )}
        {cartel.bench.length > 0 && (
          <div className="po-f">
            <span>BANQUILLO</span>
            <span>{cartel.bench.join(" · ")}</span>
          </div>
        )}
        {!!cartel.subs?.length && (
          <div className="po-f">
            <span>CAMBIOS</span>
            <span>{cartel.subs.join(" · ")}</span>
          </div>
        )}
        <div className="po-f">
          <span>
            QUÍMICA <b>{cartel.qv}</b>
          </span>
          <span>la pizarra</span>
        </div>
      </div>
      <div className="shr">
        <button type="button" className="b2 gold mag" onClick={onShare} disabled={waiting || !!block} aria-busy={waiting} aria-describedby={block ? "pz-share-why" : undefined}>
          <Icon n="share" w={18} />
          <span>{waiting ? "Preparando el cartel…" : "Mandar al grupo"}</span>
        </button>
        <button type="button" className="b3" onClick={onPng} disabled={busy || !!block} style={{ minHeight: 48 }} aria-label="Descargar el cartel en PNG" aria-describedby={block ? "pz-share-why" : undefined}>
          <Icon n="download" w={16} />
          PNG
        </button>
      </div>
      {block && (
        <p className="why" id="pz-share-why">
          {block}
        </p>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="b3" onClick={() => onLink(false)} disabled={!canLink}>
          <Icon n="link" w={16} />
          Copiar enlace al tablero
        </button>
        <button type="button" className="b3" onClick={() => onLink(true)} disabled={!canLink} aria-label="Copiar el enlace que abre la charla de este tablero">
          <Icon n="whistle" w={16} />
          Enlace a la charla
        </button>
      </div>
      {!canLink && <p className="empty">El enlace llega en cuanto el tablero se guarde (con tu primer cambio).</p>}
      {extra}
    </>
  );
}

// ── Ajustes ──
const SHOW_T: [ShowKey, string][] = [
  ["num", "Dorsal"],
  ["name", "Nombre"],
  ["pos", "Posición"],
  ["gal", "Galones"],
  ["chem", "Química"],
  ["rt", "Nota"],
];

export interface AjustesProps {
  show: ShowPrefs;
  cam: "tv" | "top";
  v3: boolean;
  snd: boolean;
  day: boolean;
  grid: boolean;
  seasons: { id: string; name: string }[];
  seasonId: string;
  galLeg: { l: string; t: string }[];
  onShow: (k: ShowKey) => void;
  onCam: (c: "tv" | "top") => void;
  on3d: () => void;
  onSnd: () => void;
  onDay: () => void;
  onGrid: () => void;
  onSeason: (id: string) => void;
  onBack: () => void;
  /** Turning «Ver la presentación en 3D» on plays it now (else it waits for the next visit). */
  onIntro3d?: () => void;
}

export function AjustesPanel(p: AjustesProps) {
  // «Ver la presentación en 3D»: kept on this device (intro.ts); the opening plays it from the next visit
  const [i3d, setI3d] = useState(intro3dWanted);
  const i3dHint = useId();
  return (
    <>
      <PanelHead kick="Lo que enseñan los cromos" title="Ajustes" onBack={p.onBack} />
      <div className="aj">
        {SHOW_T.map(([k, l]) => (
          <button key={k} type="button" className="tg" onClick={() => p.onShow(k)} aria-pressed={p.show[k]}>
            {l}
          </button>
        ))}
      </div>
      <h3>Cámara</h3>
      <div className="sg two" role="group" aria-label="Cámara">
        <button type="button" onClick={() => p.onCam("tv")} aria-pressed={p.cam === "tv"}>
          Estadio · TV
        </button>
        <button type="button" onClick={() => p.onCam("top")} aria-pressed={p.cam === "top"}>
          Cenital
        </button>
      </div>
      <div className="aj" style={{ marginTop: 6 }}>
        <button type="button" className="tg" onClick={p.on3d} aria-pressed={p.v3}>
          Estadio 3D
        </button>
        <button
          type="button"
          className="tg"
          onClick={() => {
            const on = !i3d;
            setI3d(on);
            setIntro3dWanted(on);
            if (on) p.onIntro3d?.();
          }}
          aria-pressed={i3d && p.v3}
          disabled={!p.v3}
          aria-describedby={i3dHint}
        >
          Ver la presentación en 3D
        </button>
      </div>
      <p id={i3dHint} className="empty" style={{ marginTop: 6 }}>
        {p.v3 ? "Al abrir la pizarra, una vez por visita. Sin ella, la pizarra no descarga el estadio hasta que lo pidas." : "Enciende el Estadio 3D para verla."}
      </p>
      <h3>
        Pantalla y sonido {nuevoOn("ajustes") && <Nuevo />}
      </h3>
      <div className="aj">
        <button type="button" className="tg" onClick={p.onSnd} aria-pressed={p.snd}>
          Sonido
        </button>
        <button type="button" className="tg" onClick={p.onDay} aria-pressed={p.day}>
          Partido de día
        </button>
        <button type="button" className="tg" onClick={p.onGrid} aria-pressed={p.grid}>
          Rejilla en libre
        </button>
      </div>
      <h3>Temporada</h3>
      <label className="selw full">
        Datos de
        <select value={p.seasonId} onChange={(e) => p.onSeason(e.target.value)} aria-label="Temporada de los datos">
          {p.seasonId === "all" && <option value="all">{ALL_SEASONS_LABEL}</option>}
          {p.seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <h3>Galones en los cromos</h3>
      <div className="leg">
        {p.galLeg.map((g) => (
          <span key={g.l}>
            <b>{g.l}</b>
            {g.t}
          </span>
        ))}
      </div>
      <p style={{ marginTop: 10 }}>Para cambiarlos, mantén pulsado un cromo del campo, o en Siete → Cambios («Galones en orden»). Los lanzadores van en orden: tira el primero que esté en el campo.</p>
    </>
  );
}
