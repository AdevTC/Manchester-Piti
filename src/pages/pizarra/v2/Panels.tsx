// The board's HUD and tools: the app bar (board name + autosave, the 7/7 chip, undo/redo, la charla),
// the read-only strip, the sheet with its handle, the «Once» tool (Banquillo · Sistema · Plan), the tray
// (tap a slot or a cromo), the «Más» tiles, the panels still to come, and the mode bar / rail.
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import type { FormationName, RoleKey, Zone } from "../formations";
import { FORM, SYSTEMS } from "./geometry";
import { Icon, Nuevo } from "./icons";
import { AlbumCromo, BajaCromo } from "./Cromos";
import type { Cromo } from "./model";
import { grabLabel, type Snap } from "./sheet";
import { vars, type Hud, type Modo } from "./view";

// Buttons that lean toward the pointer (the gold ones).
const magMove = (e: PointerEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  el.style.setProperty("--tx", (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(1));
  el.style.setProperty("--ty", (((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(1));
};
const magLeave = (e: PointerEvent<HTMLElement>) => {
  e.currentTarget.style.removeProperty("--tx");
  e.currentTarget.style.removeProperty("--ty");
};
const mag = { onPointerMove: magMove, onPointerLeave: magLeave };

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
      <button type="button" className="ib gold mag" {...mag} onClick={p.onCharla} aria-label="La charla: presentar el once">
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

// ── «Once»: Banquillo · Sistema · Plan ──
export type OnceTab = "b" | "s" | "p";

export function OnceTabs({ tab, onTab }: { tab: OnceTab; onTab: (t: OnceTab) => void }) {
  return (
    <div className="tabrow">
      <div className="tabs" role="group" aria-label="Herramienta del once">
        <button type="button" onClick={() => onTab("b")} aria-pressed={tab === "b"}>
          Banquillo
        </button>
        <button type="button" onClick={() => onTab("s")} aria-pressed={tab === "s"}>
          Sistema
        </button>
        <button type="button" onClick={() => onTab("p")} aria-pressed={tab === "p"}>
          Plan <Nuevo />
        </button>
      </div>
    </div>
  );
}

export interface RepRow {
  id: string;
  num: number;
  name: string;
  m: string;
  min: string;
}

export interface BenchTabProps {
  ro: boolean;
  hot: boolean;
  recentLabel: string;
  rail: Cromo[];
  selBench: string | null;
  meId: string | null;
  railPage: { n: number; of: number };
  seasonName: string;
  q: string;
  zf: string;
  oc: boolean;
  seasons: { id: string; name: string }[];
  seasonId: string;
  bajas: Cromo[];
  counts: { les: number; san: number; ina: number };
  rep: RepRow[];
  repTxt: string;
  canRotate: boolean;
  galLeg: { l: string; t: string }[];
  onSuggest: () => void;
  onAuto: () => void;
  onTapBench: (id: string, el: HTMLElement) => void;
  onRailNext: () => void;
  onQ: (q: string) => void;
  onZf: (z: string) => void;
  onOc: () => void;
  onSeason: (id: string) => void;
  onRotate: () => void;
}

const ZONE_FILTERS = ["Todos", "POR", "DEF", "MED", "DEL"];

export function BenchTab(p: BenchTabProps) {
  return (
    <>
      <div className={"rail" + (p.hot ? " hot" : "")} data-bench="1" role="group" aria-label="Banquillo: arrastra un cromo al campo o tócalo">
        <button type="button" className="pk gold mag" {...mag} onClick={p.onSuggest} disabled={p.ro} aria-label="Sugerir siete por forma reciente: abre un sobre">
          <Icon n="pack" w={22} />
          <b>Sugerir siete</b>
          <small>SOBRE · {p.recentLabel || "FORMA"}</small>
        </button>
        <button type="button" className="pk dark" onClick={p.onAuto} disabled={p.ro} aria-label="Auto-colocar por posición">
          <Icon n="wand" w={22} />
          <b>Auto-colocar</b>
          <small>POR POSICIÓN</small>
        </button>
        {p.rail.map((c) => (
          <AlbumCromo key={c.id} p={c} sel={p.selBench === c.id} me={p.meId === c.id} onTap={p.onTapBench} />
        ))}
      </div>
      {p.railPage.of > 1 && (
        <div className="pgr">
          <button type="button" className="b3" onClick={p.onRailNext} aria-label="Más cromos del banquillo">
            {"Más cromos · " + p.railPage.n + "/" + p.railPage.of + " "}
            <Icon n="chevR" w={14} />
          </button>
        </div>
      )}
      {!p.rail.length && <p className="tr-e">{p.q || p.zf !== "Todos" ? "Nadie en el banquillo con ese filtro." : "No queda nadie libre en el banquillo."}</p>}
      <div className="s-half">
        <h3>Buscar en la colección · {p.seasonName}</h3>
        <label className="srch">
          <Icon n="search" w={18} />
          <input type="search" placeholder="Nombre o dorsal" value={p.q} onChange={(e) => p.onQ(e.target.value)} aria-label="Buscar jugador" />
        </label>
        <div className="seg5" role="group" aria-label="Filtrar por zona">
          {ZONE_FILTERS.map((z) => (
            <button key={z} type="button" onClick={() => p.onZf(z)} aria-pressed={p.zf === z}>
              {z}
            </button>
          ))}
        </div>
        <div className="al-row">
          <button type="button" className="tg" onClick={p.onOc} aria-pressed={p.oc}>
            Solo convocados <Nuevo />
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
        <h3>Bajas · el auto no las coloca</h3>
        <div className="bj4">
          {p.bajas.map((b) => (
            <BajaCromo key={b.id} p={b} />
          ))}
          <div className="lg">
            <span>Lesionado · {p.counts.les}</span>
            <span>Sancionado · {p.counts.san}</span>
            <span>Inactivo · {p.counts.ina}</span>
          </div>
        </div>
      </div>
      <div className="s-full">
        <h3>
          Reparto de minutos <Nuevo />
        </h3>
        <div className="rep">
          {p.rep.map((r) => (
            <div key={r.id} className="rep-r">
              <b>{r.num}</b>
              <span>{r.name}</span>
              <i style={vars({ "--m": r.m })} aria-hidden="true" />
              <small>{r.min}</small>
            </div>
          ))}
        </div>
        <div className="eq">
          <p>{p.repTxt}</p>
          <button type="button" className="b3" onClick={p.onRotate} disabled={p.ro || !p.canRotate}>
            <Icon n="rot" />
            Darle minutos
          </button>
        </div>
        <h3>
          Galones · mantén pulsado un cromo <Nuevo />
        </h3>
        <div className="leg">
          {p.galLeg.map((g) => (
            <span key={g.l}>
              <b>{g.l}</b>
              {g.t}
            </span>
          ))}
        </div>
      </div>
    </>
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
  onSystem: (f: FormationName) => void;
  onLibre: () => void;
  onGrid: () => void;
  onReset: () => void;
}

export function SystemTab(p: SystemTabProps) {
  return (
    <>
      <div className="sysg" role="group" aria-label="Sistema de juego">
        {SYSTEMS.map((k) => (
          <button key={k} type="button" className="sy" onClick={() => p.onSystem(k)} aria-pressed={!p.free && p.formation === k} aria-label={"Sistema " + k} disabled={p.ro}>
            <MiniSystem name={k} />
            <b>{k}</b>
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
        </button>
      </div>
      {p.free && !p.ro ? (
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="tg" onClick={p.onGrid} aria-pressed={p.grid}>
            Ajustar a la rejilla
          </button>
          <button type="button" className="b3" onClick={p.onReset}>
            <Icon n="reset" />
            Reset de posiciones
          </button>
        </div>
      ) : (
        !p.free && <p style={{ marginTop: 10 }}>Cada sistema mueve a los siete con su animación. También puedes cambiarlo con las flechas del campo.</p>
      )}
    </>
  );
}

export function PlanSoon() {
  return (
    <p className="soon">
      <Icon n="plan" w={16} />
      <span>
        El plan en el campo: línea defensiva, presión, amplitud, salida y foco de ataque. <Nuevo>próximamente</Nuevo>
      </span>
    </p>
  );
}

// ── the tray: candidates for a slot, and what to do with the cromo in your hand ──
export interface TrayData {
  kick: string;
  title: string;
  cards: Cromo[];
  meId: string | null;
  page: { n: number; of: number };
  pageCls: string;
  hot: boolean;
  held: null | {
    id: string;
    name: string;
    gal: { key: RoleKey; letter: string; label: string; on: boolean }[];
    pos: { z: Zone; on: boolean }[];
  };
}

export interface TrayProps {
  d: TrayData;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onCard: (id: string) => void;
  onGal: (k: RoleKey) => void;
  onPos: (z: Zone) => void;
  onBench: () => void;
  onFicha: () => void;
  onFan: () => void;
}

export function Tray({ d, ...p }: TrayProps) {
  const x0 = useRef<number | null>(null);
  // Swipe the deck to page through the cromos.
  const down = (e: PointerEvent<HTMLDivElement>) => {
    x0.current = (e.target as Element).closest(".ac") ? null : e.clientX;
  };
  const upSwipe = (e: PointerEvent<HTMLDivElement>) => {
    if (x0.current == null) return;
    const dx = e.clientX - x0.current;
    x0.current = null;
    if (Math.abs(dx) > 40) (dx < 0 ? p.onNext : p.onPrev)();
  };
  return (
    <>
      <div className="sh-h">
        <div>
          <span className="k2">{d.kick}</span>
          <h2>{d.title}</h2>
        </div>
        <button type="button" className="ib" onClick={p.onPrev} disabled={d.page.n <= 1} aria-label="Cromos anteriores">
          <Icon n="chevL" />
        </button>
        <button type="button" className="ib" onClick={p.onNext} disabled={d.page.n >= d.page.of} aria-label="Más cromos">
          <Icon n="chevR" />
        </button>
        <button type="button" className="ib" onClick={p.onClose} aria-label="Cerrar">
          <Icon n="x" />
        </button>
      </div>
      <div className={"trayc " + d.pageCls + (d.hot ? " hot" : "")} data-bench="1" role="group" aria-label={d.title} onPointerDown={down} onPointerUp={upSwipe}>
        {d.cards.map((c) => (
          <AlbumCromo key={c.id} p={c} sel={false} me={d.meId === c.id} onTap={() => p.onCard(c.id)} />
        ))}
      </div>
      {!d.cards.length && <p className="tr-e">No queda nadie libre en el banquillo para este hueco.</p>}
      <div className="s-half">
        {d.held && (
          <div className="ops">
            <span>Galones</span>
            <div className="gr4" role="group" aria-label={"Galones de " + d.held.name}>
              {d.held.gal.map((g) => (
                <button key={g.key} type="button" className="gb" onClick={() => p.onGal(g.key)} aria-pressed={g.on} aria-label={g.label + (g.on ? ": " + d.held?.name : "")}>
                  {g.letter}
                </button>
              ))}
            </div>
            <span>Juega de</span>
            <div className="gr4 p" role="group" aria-label={"Posición de " + d.held.name + " en este once"}>
              {d.held.pos.map((q) => (
                <button key={q.z} type="button" className="gb" onClick={() => p.onPos(q.z)} aria-pressed={q.on}>
                  {q.z}
                </button>
              ))}
            </div>
            <div className="row">
              <button type="button" className="b3" onClick={p.onBench}>
                <Icon n="bench" />
                Al banquillo
              </button>
              <button type="button" className="b3" onClick={p.onFicha}>
                <Icon n="info" w={16} />
                Ver ficha
              </button>
              <button type="button" className="b3" onClick={p.onFan}>
                <Icon n="dots" w={16} />
                Menú rápido <Nuevo />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── «Más» and the panels still to come ──
export function MasPanel({ tacSum, onGo }: { tacSum: string; onGo: (m: Modo | "plan") => void }) {
  return (
    <>
      <div className="sh-h">
        <div>
          <span className="k2">Todo lo demás</span>
          <h2>Más</h2>
        </div>
      </div>
      <div className="tiles">
        <button type="button" className="tile go" onClick={() => onGo("charla")}>
          <Icon n="whistle" w={22} />
          <b>La charla</b>
          <small>El once, el plan y la jugada</small>
        </button>
        <button type="button" className="tile" onClick={() => onGo("tableros")}>
          <Icon n="boards" w={22} />
          <b>Tableros</b>
          <small>Míos, oficial, partido</small>
        </button>
        <button type="button" className="tile" onClick={() => onGo("comparar")}>
          <Icon n="compare" w={22} />
          <b>Comparar</b>
          <small>Dos onces cara a cara</small>
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

const SOON: Partial<Record<Modo, { kick: string; title: string; txt: string; back?: boolean }>> = {
  quimica: { kick: "Química del once", title: "Química", txt: "El radar del once, la química por líneas y cada luz explicada." },
  jugadas: { kick: "Repetición", title: "Jugadas", txt: "Córners, faltas, salida de balón y tus jugadas, paso a paso." },
  dibujar: { kick: "Trazos de luz", title: "Dibujar", txt: "Carreras, pases, conducciones y zonas dibujadas sobre el césped." },
  tableros: { kick: "Guardado automático", title: "Tableros", txt: "Tus tableros, el oficial del equipo y el partido de cada uno.", back: true },
  comparar: { kick: "Cara a cara", title: "Comparar", txt: "Dos onces frente a frente, con quién entra y quién sale en el campo.", back: true },
  compartir: { kick: "Al grupo del equipo", title: "Compartir", txt: "El cartel de los siete para mandarlo al grupo.", back: true },
  ajustes: { kick: "Lo que enseñan los cromos", title: "Ajustes", txt: "Qué enseñan los cromos, la cámara, el sonido y el partido de día.", back: true },
  charla: { kick: "La charla", title: "El guion", txt: "Presenta el sistema, los siete, el plan y la jugada antes del partido.", back: true },
};

export function SoonPanel({ modo, onBack }: { modo: Modo; onBack: () => void }) {
  const s = SOON[modo];
  if (!s) return null;
  return (
    <>
      <div className="sh-h">
        {s.back && (
          <button type="button" className="back" onClick={onBack}>
            <Icon n="chevL" w={16} />
            Más
          </button>
        )}
        <div>
          <span className="k2">{s.kick}</span>
          <h2>{s.title}</h2>
        </div>
      </div>
      <p className="soon">
        <Icon n="film" w={16} />
        <span>
          {s.txt} <Nuevo>llega pronto</Nuevo>
        </span>
      </p>
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
      {b("editar", <Icon n="card" />, "Once")}
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
