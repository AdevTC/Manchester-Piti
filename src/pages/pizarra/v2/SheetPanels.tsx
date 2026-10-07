// The sheet's tools beyond the bench: the plan (Once → Plan), the química, Comparar, Compartir and
// Ajustes, as designed. Each one is a thin view over pure data (plan.ts, quimica.ts, compare.ts,
// cartel.ts); the board does the changes.
import { useId, useState, type ReactNode } from "react";
import type { TacticKey } from "../tactics";
import { Icon, Nuevo, CREST } from "./icons";
import { vars } from "./view";
import { linkMark, tierOf, type Chem } from "./quimica";
import type { TacRow } from "./plan";
import type { TapeRow } from "./compare";
import type { Cartel } from "./cartel";
import type { Squad } from "./model";
import type { ShowKey, ShowPrefs } from "./prefs";

/** The «‹ Más» heading of the panels that live behind «Más». */
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
        <span className="k2">{kick}</span>
        <h2>{title}</h2>
      </div>
      {extra}
    </div>
  );
}

// ── Once → Plan ──
export function PlanTab({ rows, ro, onSet }: { rows: TacRow[]; ro: boolean; onSet: (k: TacticKey, v: string) => void }) {
  const uid = useId();
  return (
    <div className="tac">
      {rows.map((t) => {
        const lid = uid + "tac-" + t.key;
        return (
          <div key={t.key}>
            <span className="lb" id={lid}>
              {t.label}
            </span>
            {t.kind === "esc" ? (
              <span className="esc">
                <input
                  type="range"
                  min={0}
                  max={t.options.length - 1}
                  step={1}
                  value={t.vi}
                  onChange={(e) => {
                    const o = t.options[+e.target.value];
                    if (o && o !== t.value) onSet(t.key, o);
                  }}
                  aria-labelledby={lid}
                  aria-valuetext={t.value}
                  disabled={ro}
                />
                <output>{t.value}</output>
              </span>
            ) : (
              <span className="sg" role="group" aria-labelledby={lid}>
                {t.options.map((o) => (
                  <button key={o} type="button" onClick={() => onSet(t.key, o)} aria-pressed={t.value === o} disabled={ro}>
                    {o}
                  </button>
                ))}
              </span>
            )}
          </div>
        );
      })}
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
}

const rv = (v: number) => (40 * v) / 100;

export function QuimicaPanel({ ch, sq, seasonName, oop }: QuimicaProps) {
  // The big number counts up from 0 when the panel opens, and from the last value on every change.
  const [anim, setAnim] = useState({ v: ch.v, q0: 0, k: 0 });
  if (anim.v !== ch.v) setAnim({ v: ch.v, q0: anim.v, k: anim.k + 1 });
  const [tier, sym] = tierOf(ch.v);
  const why =
    ch.n < 7
      ? "Faltan cromos: la química sube al completar el siete."
      : !ch.gk
        ? "Sin portero natural la química se resiente."
        : 7 - ch.natN
          ? 7 - ch.natN + " fuera de su posición natural: recoloca para sumar."
          : "Todos en su sitio natural.";
  const axes: [string, number][] = [
    ["Ataque", ch.at],
    ["Defensa", ch.de],
    ["Forma", ch.fo],
    ["Experiencia", ch.ex],
  ];
  const radarD = "M50 " + (50 - rv(ch.at)).toFixed(1) + "L" + (50 + rv(ch.de)).toFixed(1) + " 50L50 " + (50 + rv(ch.fo)).toFixed(1) + "L" + (50 - rv(ch.ex)).toFixed(1) + " 50Z";
  const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const luces = ch.links
    .slice()
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map((l) => ({
      key: l.a + "|" + l.b,
      t: l.t,
      who: nm(l.a) + " · " + nm(l.b),
      why: [l.ast ? l.ast + (l.ast > 1 ? " goles juntos" : " gol juntos") : "", l.tog ? l.tog + (l.tog > 1 ? " partidos juntos" : " partido juntos") : "sin partidos juntos", l.nat ? "" : "alguno fuera de sitio"].filter(Boolean).join(" · "),
    }));
  return (
    <>
      <PanelHead kick={"Química del siete · " + seasonName} title="Química" extra={<span className="cnt">{ch.links.length === 1 ? "1 luz" : ch.links.length + " luces"}</span>} />
      <div className="qp-top">
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
          <p>{why}</p>
        </div>
      </div>
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
        <h3>Las luces del siete</h3>
        {luces.length ? (
          <ul className="lk-list">
            {luces.map((li) => (
              <li key={li.key}>
                <span className={"lkb t" + li.t}>{linkMark(li.t)}</span>
                <span>
                  {li.who}
                  <small>{li.why}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Sin luces todavía: coloca cromos vecinos y se encienden.</p>
        )}
        {ch.fresh.length > 0 && (
          <div className="cav">
            <Icon n="alert" w={16} />
            <span>
              <b>Sin historial:</b> {ch.fresh.join(", ")}. Su química cuenta como neutra hasta que {ch.fresh.length > 1 ? "jueguen" : "juegue"}.
            </span>
          </div>
        )}
        {sq.games < 3 && ch.n > 0 && (
          <div className="cav">
            <Icon n="alert" w={16} />
            <span>
              <b>Pocos partidos:</b>{" "}
              {sq.games === 0 ? "esta temporada aún no se ha jugado ninguno; la química solo mira posiciones y forma." : "con " + sq.games + (sq.games === 1 ? " jugado" : " jugados") + ", la química aún es orientativa."}
            </span>
          </div>
        )}
        {oop.length > 0 && (
          <div className="cav">
            <Icon n="alert" w={16} />
            <span>
              <b>Fuera de posición:</b> {oop.join(", ")}. Cada uno resta química: recolócalo o cámbiale el «Jugar de».
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
            Cara a cara · en el campo <Nuevo />
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
  canLink: boolean;
  onShare: () => void;
  onPng: () => void;
  onLink: () => void;
  onBack: () => void;
}

export function CompartirPanel({ cartel, block, busy, canLink, onShare, onPng, onLink, onBack }: CompartirProps) {
  return (
    <>
      <PanelHead kick="Al grupo del equipo" title="Compartir" onBack={onBack} />
      <div className="poster" role="img" aria-label={cartel.aria}>
        <div className="po-h">
          <img src={CREST} alt="" />
          <div>
            <small>{cartel.kick}</small>
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
        <div className="po-f">
          <span>
            QUÍMICA <b>{cartel.qv}</b>
          </span>
          <span>la pizarra</span>
        </div>
      </div>
      <div className="shr">
        <button type="button" className="b2 gold mag" onClick={onShare} disabled={busy || !!block} aria-busy={busy} aria-describedby={block ? "pz-share-why" : undefined}>
          <Icon n="share" w={18} />
          <span>{busy ? "Preparando el cartel…" : "Mandar al grupo"}</span>
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
        <button type="button" className="b3" onClick={onLink} disabled={!canLink}>
          <Icon n="link" w={16} />
          Copiar enlace al tablero
        </button>
      </div>
      {!canLink && <p className="empty">El enlace llega en cuanto el tablero se guarde (con tu primer cambio).</p>}
      <p className="soon">
        <Icon n="film" w={16} />
        <span>
          La jugada como clip animado <Nuevo>próximamente</Nuevo>
        </span>
      </p>
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
}

export function AjustesPanel(p: AjustesProps) {
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
      <div className="sg" role="group" aria-label="Cámara">
        <button type="button" onClick={() => p.onCam("tv")} aria-pressed={p.cam === "tv"}>
          Estadio · TV
        </button>
        <button type="button" onClick={() => p.onCam("top")} aria-pressed={p.cam === "top"}>
          Cenital
        </button>
        <button type="button" onClick={p.on3d} aria-pressed={p.v3}>
          3D
        </button>
      </div>
      <h3>
        Pantalla y sonido <Nuevo />
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
          {p.seasonId === "all" && <option value="all">Histórico total</option>}
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
      <p style={{ marginTop: 10 }}>Para cambiarlos, mantén pulsado un cromo del campo.</p>
    </>
  );
}
