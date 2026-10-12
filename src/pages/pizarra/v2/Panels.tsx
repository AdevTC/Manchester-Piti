// The board's HUD and tools: the app bar (board name + autosave, the 7/7 chip, undo/redo, la charla),
// the read-only strip, the sheet with its handle, the «Siete» tool (the squad bars, then Convocatoria ·
// Sistema · Plan; the bench grid is the picker), the «Más» tiles, and the mode bar / rail.
import { useId, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { FormationName } from "../formations";
import { FORM, SYSTEMS } from "./geometry";
import { Icon, Nuevo } from "./icons";
import { AlbumCromo, BenchRowItem } from "./Cromos";
import { andList, sysLines, type BenchGroup, type ConvHead, type SquadInfo } from "./bench";
import type { Squad } from "./model";
import { lucesTxt, type Chem } from "./quimica";
import { ChemLines, ChemTop, LucesList, PanelHead } from "./SheetPanels";
import { grabLabel, type Snap } from "./sheet";
import { vars, type Hud, type Modo } from "./view";
import { mag } from "./mag";


export interface AppBarProps {
  crest: ReactNode;
  name: string;
  saveTxt: string;
  saveCls: string;
  hud: Hud;
  noUndo: boolean;
  noRedo: boolean;
  onName: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCharla: () => void;
}

export function AppBar(p: AppBarProps) {
  const { hud } = p;
  return (
    <div className="bar">
      {p.crest}
      <button type="button" className="bname" onClick={p.onName} aria-label={"Tablero " + p.name + ": abrir mis tableros"}>
        <b>{p.name}</b>
        <small>
          <i aria-hidden="true" className={p.saveCls} />
          {p.saveTxt}
        </small>
      </button>
      <span className={"val " + hud.valCls} role="status" aria-label={hud.valAria}>
        {hud.valOk ? <Icon n="check" w={14} /> : <Icon n="alert" w={14} />}
        <b>{hud.valN}</b>
        <small>{hud.valTxt}</small>
      </span>
      <button type="button" className="ib" onClick={p.onUndo} disabled={p.noUndo} aria-label="Deshacer">
        <Icon n="undo" />
      </button>
      <button type="button" className="ib" onClick={p.onRedo} disabled={p.noRedo} aria-label="Rehacer">
        <Icon n="redo" />
      </button>
      <button type="button" className="ib gold mag" {...mag} onClick={p.onCharla} aria-label="La charla: presentar el siete">
        <Icon n="whistle" />
      </button>
    </div>
  );
}

export function ReadOnlyStrip({ label, onDuplicate, onMine }: { label: string; onDuplicate: () => void; onMine: () => void }) {
  return (
    <div className="robar" role="status">
      <b>
        <Icon n="lock" />
        {label}
      </b>
      <button type="button" className="b3" onClick={onDuplicate}>
        <Icon n="copy" />
        Duplicar
      </button>
      <button type="button" className="b3" onClick={onMine}>
        Mi tablero
      </button>
    </div>
  );
}

export interface SheetProps {
  title: string;
  snap: Snap;
  mk: number;
  sheetRef: RefObject<HTMLElement | null>;
  onCycle: () => void;
  onStep: (d: 1 | -1) => void;
  children: ReactNode;
}

export function Sheet({ title, snap, mk, sheetRef, onCycle, onStep, children }: SheetProps) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      onStep(e.key === "ArrowUp" ? 1 : -1);
    }
  };
  return (
    <section className="sheet" aria-label={"Herramientas: " + title} ref={sheetRef}>
      <button type="button" className="grab" onClick={onCycle} onKeyDown={onKey} aria-label={grabLabel(snap)} data-grab="1" />
      <div className={"sh-in " + (mk % 2 ? "ka" : "kb")}>
        {children}
      </div>
    </section>
  );
}

/// ── «Siete»: the squad bars, then Convocatoria · Sistema · Plan ──
export type OnceTab = "b" | "s" | "p";

export interface SquadBarsProps {
  info: SquadInfo;
  /** «3-2-1» / «Libre». */
  sysName: string;
  /** «J8 · MAD SKY» (empty without a match). */
  matchShort: string;
  qv: number;
  qTier: string;
}

/** «Tu siete» in numbers: media, química, on the pitch, and the four bars (desktop shows only the bars). */
export function SquadBars({ info, sysName, matchShort, qv, qTier }: SquadBarsProps) {
  return (
    <section className="fsq" aria-label="El siete en números">
      <h2 className="fsq-h">
        Tu siete<small>{[sysName, matchShort].filter(Boolean).join(" · ")}</small>
      </h2>
      <div className="fsq-p">
        <div className="fp">
          <small>MEDIA</small>
          <b>{info.media}</b>
        </div>
        <div className="fp q">
          <small>QUÍMICA</small>
          <b>{qv}</b>
          <span className="dm" role="img" aria-label={qTier}>
            {info.dm.map((on, k) => (
              <i key={k} className={on ? "on" : ""} />
            ))}
          </span>
        </div>
        <div className="fp">
          <small>EN EL CAMPO</small>
          <b>{info.once}</b>
        </div>
      </div>
      <div className="fsq-b">
        {info.bars.map((b) => (
          <div key={b.k} className={"fb" + (b.cls ? " " + b.cls : "")}>
            <span>{b.k}</span>
            <i style={vars({ "--v": b.v })} aria-hidden="true" />
            <b>{b.v}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OnceTabs({ tab, onTab }: { tab: OnceTab; onTab: (t: OnceTab) => void }) {
  return (
    <div className="tabrow">
      <kbd className="bk" aria-hidden="true">
        Q
      </kbd>
      <div className="tabs" role="group" aria-label="Herramienta del siete">
        <button type="button" onClick={() => onTab("b")} aria-pressed={tab === "b"}>
          Convocatoria
        </button>
        <button type="button" onClick={() => onTab("s")} aria-pressed={tab === "s"}>
          Sistema
        </button>
        <button type="button" onClick={() => onTab("p")} aria-pressed={tab === "p"}>
          Plan
        </button>
      </div>
      <kbd className="bk" aria-hidden="true">
        E
      </kbd>
    </div>
  );
}

export type BenchView = "lista" | "cromos";

export interface BenchTabProps {
  ro: boolean;
  /** A pitch cromo is being dragged: the bench is a drop target. */
  hot: boolean;
  /** The «sobre»'s window, «J5–J7» (empty when nothing has been played). */
  recentLabel: string;
  conv: ConvHead;
  groups: BenchGroup[];
  /** «Buscar en la plantilla» is open. */
  srx: boolean;
  q: string;
  zf: string;
  oc: boolean;
  /** «Solo convocados» needs answers to the convocatoria. */
  ocOff: boolean;
  seasons: { id: string; name: string }[];
  seasonId: string;
  /** Lista (FUT rows) or Cromos, on desktop (phones always show the cromo strip). Default: lista. */
  benchView?: BenchView;
  onBenchView?: (v: BenchView) => void;
  onSuggest: () => void;
  onAuto: () => void;
  onAvisar: () => void;
  onSrx: () => void;
  onTapBench: (id: string, el: HTMLElement) => void;
  onQ: (q: string) => void;
  onZf: (z: string) => void;
  onOc: () => void;
  onSeason: (id: string) => void;
}

const ZONE_FILTERS = ["Todos", "POR", "DEF", "MED", "DEL"];

/** The Convocatoria page: the answers, the two big actions, the search, and the bench (rows or cromos). */
export function BenchTab(p: BenchTabProps) {
  const srxId = useId();
  const view = p.benchView ?? "lista";
  const { conv } = p;
  const hot = p.hot ? " hot" : "";
  return (
    <div className="pg pc">
      <div className="cv-h">
        <div className="cv-k">
          <b>{conv.title}</b>
          <span className="k2">{conv.kick}</span>
        </div>
        <ul className="cv-n" aria-label={conv.aria}>
          <li className="cvn voy">
            <Icon n="check" w={13} />
            <b>{conv.voy}</b>voy
          </li>
          <li className="cvn duda">
            <Icon n="doubt" w={13} />
            <b>{conv.duda}</b>duda
          </li>
          <li className="cvn no">
            <Icon n="x" w={12} />
            <b>{conv.no}</b>no va
          </li>
        </ul>
        <button type="button" className="avi" onClick={p.onAvisar} aria-label={conv.dudas.length ? "Avisar a los que dudan: " + andList(conv.dudas) : "Avisar a los que dudan: nadie tiene dudas"}>
          <Icon n="bell" w={15} />
          <span>Avisar a los que dudan</span>
          <em>{conv.dudas.join(" · ")}</em>
        </button>
      </div>
      <div className="cv-a">
        <button type="button" className="b4 gold mag" {...mag} onClick={p.onSuggest} disabled={p.ro} aria-label="Sugerir siete por forma reciente: abre un sobre">
          <Icon n="pack" w={20} />
          <span>
            <b>Sugerir siete</b>
            <small>{"Por forma" + (p.recentLabel ? " · " + p.recentLabel : "")}</small>
          </span>
        </button>
        <button type="button" className="b4" onClick={p.onAuto} disabled={p.ro} aria-label="Auto-colocar: cada uno a su posición natural">
          <Icon n="wand" w={20} />
          <span>
            <b>Auto-colocar</b>
            <small>Cada uno a su sitio</small>
          </span>
        </button>
      </div>
      <div className="srx">
        <button type="button" className="srx-b" onClick={p.onSrx} aria-expanded={p.srx} aria-controls={srxId}>
          <Icon n="search" w={16} />
          <span>Buscar en la plantilla</span>
          <Icon n="chevD" w={16} />
        </button>
        {p.srx && (
          <div className="srx-p" id={srxId}>
            <label className="srch">
              <Icon n="search" w={18} />
              <input type="search" placeholder="Nombre o dorsal" value={p.q} onChange={(e) => p.onQ(e.target.value)} aria-label="Buscar jugador" />
            </label>
            <div className="seg5" role="group" aria-label="Filtrar por posición">
              {ZONE_FILTERS.map((z) => (
                <button key={z} type="button" onClick={() => p.onZf(z)} aria-pressed={p.zf === z}>
                  {z}
                </button>
              ))}
            </div>
            <div className="al-row">
              <button type="button" className="tg" onClick={p.onOc} aria-pressed={p.oc} disabled={p.ocOff}>
                Solo convocados
              </button>
              <label className="selw">
                Temporada
                <select value={p.seasonId} onChange={(e) => p.onSeason(e.target.value)} aria-label="Temporada">
                  {p.seasonId === "all" && <option value="all">Histórico total</option>}
                  {p.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
      <div className="bvt" role="group" aria-label="Vista del banquillo">
        <button type="button" onClick={() => p.onBenchView?.("lista")} aria-pressed={view === "lista"}>
          Lista
        </button>
        <button type="button" onClick={() => p.onBenchView?.("cromos")} aria-pressed={view === "cromos"}>
          Cromos
        </button>
        <kbd aria-hidden="true">R</kbd>
      </div>
      <div className={"cvb" + hot} data-bench="1" role="group" aria-label="Banquillo: arrastra un cromo al campo o tócalo">
        {p.groups.map((g) => (
          <div key={g.k} className={"grp " + g.cls}>
            <h3 className="grp-h">
              <span>{g.t}</span>
              <span className="cnt">{g.rows.length}</span>
            </h3>
            {!g.rows.length && <p className="grp-e">{g.emptyTxt}</p>}
            <div className="bgrid">
              {g.rows.map((r) => (
                <AlbumCromo key={r.id} r={r} onTap={p.onTapBench} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={"cvl" + hot} data-bench="1" role="group" aria-label="Banquillo en lista: arrastra a un jugador al campo o tócalo">
        {p.groups.map((g) => (
          <div key={g.k} className={"lg " + g.cls}>
            <h3 className="lg-h">
              <span>{g.t}</span>
              <span className="cnt">{g.rows.length}</span>
            </h3>
            {!g.rows.length && <p className="grp-e">{g.emptyTxt}</p>}
            {g.rows.map((r) => (
              <BenchRowItem key={r.id} r={r} onTap={p.onTapBench} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniSystem({ name }: { name: FormationName }) {
  return (
    <svg viewBox="0 0 60 80" aria-hidden="true">
      <rect x="2" y="2" width="56" height="76" rx="4" />
      <path d="M2 40h56" />
      {FORM[name].map(([, z, u, v], k) => (
        <circle key={k} className={z === "POR" ? "g" : ""} cx={(2 + (u / 100) * 56).toFixed(1)} cy={(2 + (v / 100) * 76).toFixed(1)} r="4.2" />
      ))}
    </svg>
  );
}

export interface SystemTabProps {
  formation: FormationName;
  free: boolean;
  grid: boolean;
  ro: boolean;
  ch: Chem;
  sq: Squad;
  onSystem: (f: FormationName) => void;
  onLibre: () => void;
  onGrid: () => void;
  onReset: () => void;
}

/** The Sistema page: the six systems and Libre as tiles, then the química of the seven in short. */
export function SystemTab(p: SystemTabProps) {
  return (
    <div className="pg">
      <div className="sysg" role="group" aria-label="Sistema de juego">
        {SYSTEMS.map((k) => (
          <button key={k} type="button" className="sy" onClick={() => p.onSystem(k)} aria-pressed={!p.free && p.formation === k} aria-label={"Sistema " + k} disabled={p.ro}>
            <MiniSystem name={k} />
            <b>{k}</b>
            <small>{sysLines(k)}</small>
          </button>
        ))}
        <button type="button" className="sy lib" onClick={p.onLibre} aria-pressed={p.free} disabled={p.ro} aria-label="Modo libre: arrastra a cualquier sitio">
          <svg viewBox="0 0 60 80" aria-hidden="true">
            <rect x="2" y="2" width="56" height="76" rx="4" />
            <path d="M2 40h56" />
            <circle cx="14" cy="18" r="4.2" />
            <circle cx="44" cy="26" r="4.2" />
            <circle cx="22" cy="50" r="4.2" />
            <circle cx="40" cy="58" r="4.2" />
            <circle className="g" cx="30" cy="72" r="4.2" />
          </svg>
          <b>Libre</b>
          <small>a mano</small>
        </button>
      </div>
      {p.free && !p.ro && (
        <div className="row">
          <button type="button" className="tg" onClick={p.onGrid} aria-pressed={p.grid}>
            Ajustar a la rejilla
          </button>
          <button type="button" className="b3" onClick={p.onReset}>
            <Icon n="reset" />
            Reset de posiciones
          </button>
        </div>
      )}
      <h3>Química del siete · {lucesTxt(p.ch.links.length)}</h3>
      <ChemTop ch={p.ch} cls="qsum" />
      <ChemLines ch={p.ch} />
      <LucesList ch={p.ch} sq={p.sq} n={3} />
    </div>
  );
}

// ── «Más» ──
export function MasPanel({ tacSum, onGo }: { tacSum: string; onGo: (m: Modo | "plan") => void }) {
  return (
    <>
      <PanelHead kick="Todo lo demás" title="Más" />
      <div className="tiles">
        <button type="button" className="tile go" onClick={() => onGo("charla")}>
          <Icon n="whistle" w={22} />
          <b>La charla</b>
          <small>El siete, el plan y la jugada</small>
        </button>
        <button type="button" className="tile" onClick={() => onGo("tableros")}>
          <Icon n="boards" w={22} />
          <b>Tableros</b>
          <small>Míos, oficial, partido</small>
        </button>
        <button type="button" className="tile" onClick={() => onGo("comparar")}>
          <Icon n="compare" w={22} />
          <b>Comparar</b>
          <small>Dos sietes cara a cara</small>
        </button>
        <button type="button" className="tile" onClick={() => onGo("compartir")}>
          <Icon n="share" w={22} />
          <b>Compartir</b>
          <small>Cartel para el grupo</small>
        </button>
        <button type="button" className="tile" onClick={() => onGo("plan")}>
          <Icon n="plan" w={22} />
          <b>El plan</b>
          <small>{tacSum}</small>
        </button>
        <button type="button" className="tile" onClick={() => onGo("ajustes")}>
          <Icon n="sliders" w={22} />
          <b>Ajustes</b>
          <small>Cromos, cámara, sonido</small>
        </button>
      </div>
    </>
  );
}

// ── mode bar (mobile, bottom) / mode rail (desktop, left) ──
export function ModeBar({ modo, onGo }: { modo: Modo; onGo: (m: Modo) => void }) {
  const masOn = ["mas", "tableros", "comparar", "compartir", "ajustes"].includes(modo);
  const b = (m: Modo, icon: ReactNode, label: string, cls = "", nv = false, pressed = modo === m) => (
    <button type="button" className={"mbt" + (cls ? " " + cls : "")} onClick={() => onGo(m)} aria-pressed={pressed}>
      {nv && <Nuevo />}
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="mbar" aria-label="Modos de la pizarra">
      {b("editar", <Icon n="card" />, "Siete")}
      {b("quimica", <Icon n="spark" />, "Química")}
      {b("jugadas", <Icon n="film" />, "Jugadas", "", true)}
      {b("dibujar", <Icon n="pen" />, "Dibujar", "", true)}
      {b("mas", <Icon n="dots" />, "Más", "mob", false, masOn)}
      {b("tableros", <Icon n="boards" />, "Tableros", "dsk")}
      {b("comparar", <Icon n="compare" />, "Comparar", "dsk")}
      {b("compartir", <Icon n="share" w={20} />, "Compartir", "dsk")}
      {b("ajustes", <Icon n="sliders" />, "Ajustes", "dsk")}
      {b("charla", <Icon n="whistle" w={21} />, "La charla", "dsk go")}
    </nav>
  );
}
