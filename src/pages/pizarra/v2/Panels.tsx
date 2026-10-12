// The board's HUD and tools: the app bar (board name + autosave, the 7/7 chip, undo/redo, la charla),
// the read-only strip, the sheet with its handle, the «Once» tool (Banquillo · Sistema · Plan), the tray
// (tap a slot or a cromo), the «Más» tiles, and the mode bar / rail.
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import type { FormationName, RoleKey, Zone } from "../formations";
import { FORM, SYSTEMS } from "./geometry";
import { Icon, Nuevo } from "./icons";
import { AlbumCromo, BajaCromo } from "./Cromos";
import type { Cromo } from "./model";
import { grabLabel, type Snap } from "./sheet";
import { vars, type Hud, type Modo } from "./view";
import { mag } from "./mag";
import { RAIL } from "./rail";


// ── the command bar: the board (name, match, autosave) · the siete's plates (MEDIA, 7/7, QUÍMICA,
// SISTEMA) — in Jugadas, the repetición bug instead — · deshacer / rehacer · Compartir · La charla ──
export interface AppBarProps {
  crest: ReactNode;
  name: string;
  /** The board's match («J8 · MAD SKY»), if any. */
  matchShort: string | null;
  saveTxt: string;
  saveCls: string;
  hud: Hud;
  /** The «¡Siete listo!» flash is on (the química's «+N» stays out of its way). */
  cele: boolean;
  /** Counts system changes (the plate's flip). */
  sysk: number;
  /** Read-only: the system can't be stepped. */
  ro: boolean;
  noUndo: boolean;
  noRedo: boolean;
  /** Jugadas: the repetición bug takes the plates' slot (it opens the library). */
  bug: { a: string; b: string; k: string; aria: string } | null;
  shareOn: boolean;
  onName: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShare: () => void;
  onCharla: () => void;
  onSys: (d: 1 | -1) => void;
  onSysPick: () => void;
  onQuimica: () => void;
  onBug: () => void;
}

export function AppBar(p: AppBarProps) {
  const { hud } = p;
  return (
    <header className="cmd" aria-label="La pizarra: tablero y estado">
      <div className="cmd-a">
        {p.crest}
        <button
          type="button"
          className="bname"
          onClick={p.onName}
          aria-label={"Tablero " + p.name + (p.matchShort ? ", " + p.matchShort : "") + ": cambiar de tablero"}
        >
          <small>
            {p.matchShort && <span>{p.matchShort}</span>}
            <i aria-hidden="true" className={p.saveCls} />
            {p.saveTxt}
          </small>
          <b>
            {p.name}
            <Icon n="chevD" w={15} />
          </b>
        </button>
      </div>
      <div className="cmd-s" role="group" aria-label="Estado del siete">
        {p.bug ? (
          <button type="button" className={"bug cbug " + p.bug.k} key={p.bug.k + p.bug.b} onClick={p.onBug} aria-label={p.bug.aria}>
            <i aria-hidden="true" />
            <div>
              <small>{p.bug.a}</small>
              <b>{p.bug.b}</b>
            </div>
          </button>
        ) : (
          <>
            <span className="mdp" role="status" aria-label={"Media del siete: " + hud.media}>
              <small>MEDIA</small>
              <b>{hud.media}</b>
            </span>
            <span className={"val " + hud.valCls} role="status" aria-label={hud.valAria}>
              {hud.valOk ? <Icon n="check" w={14} /> : <Icon n="alert" w={14} />}
              <b>{hud.valN}</b>
              <small>{hud.valTxt}</small>
            </span>
            <span className="sbdw">
              <button type="button" className="sbd" onClick={p.onQuimica} aria-label={"Química " + hud.qv + " de 100, " + hud.tier + ". Abrir la química"}>
                <small>QUÍMICA</small>
                <span className="t">{hud.tier}</span>
                <span className="flp" aria-hidden="true">
                  {hud.qDigits.map((q, k) => (
                    <i key={k} className={q.k} style={vars({ "--d": q.d })}>
                      {q.v}
                    </i>
                  ))}
                </span>
              </button>
              {hud.qUp > 0 && !p.cele && (
                <span className="qup" aria-hidden="true">
                  +{hud.qUp}
                </span>
              )}
            </span>
            <div className="sysp" role="group" aria-label="Sistema de juego">
              <button type="button" className="ib" onClick={() => p.onSys(-1)} disabled={p.ro} aria-label="Sistema anterior">
                <Icon n="chevL" w={16} />
              </button>
              <button type="button" className={"sysn " + (p.sysk % 2 ? "sa" : "sb")} onClick={p.onSysPick} aria-label={"Sistema " + hud.sysName + ": elegir sistema"}>
                <small>SISTEMA</small>
                <b>{hud.sysName}</b>
              </button>
              <button type="button" className="ib" onClick={() => p.onSys(1)} disabled={p.ro} aria-label="Sistema siguiente">
                <Icon n="chevR" w={16} />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="cmd-t">
        <button type="button" className="ib" onClick={p.onUndo} disabled={p.noUndo} aria-label="Deshacer">
          <Icon n="undo" />
        </button>
        <button type="button" className="ib" onClick={p.onRedo} disabled={p.noRedo} aria-label="Rehacer">
          <Icon n="redo" />
        </button>
        <button type="button" className="b3 shb" onClick={p.onShare} aria-pressed={p.shareOn}>
          <Icon n="share" w={16} />
          Compartir
        </button>
        <button type="button" className="chb mag" {...mag} onClick={p.onCharla} aria-label="La charla: presentar el siete">
          <Icon n="whistle" />
          <span>La charla</span>
        </button>
      </div>
    </header>
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
      <div className="tabs" role="group" aria-label="Herramienta del siete">
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
  /** «Solo convocados» needs answers to the convocatoria. */
  ocOff: boolean;
  /** Whose convocatoria the chips show and how it stands. */
  convTxt: string;
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
  /** The bench as FUT list rows or cromos (desktop; R toggles it). */
  benchView?: "lista" | "cromos";
  onBenchView?: (v: "lista" | "cromos") => void;
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
      {!p.rail.length && <p className="tr-e">{p.q || p.zf !== "Todos" || p.oc ? "Nadie en el banquillo con ese filtro." : "No queda nadie libre en el banquillo."}</p>}
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
          <button type="button" className="tg" onClick={p.onOc} aria-pressed={p.oc} disabled={p.ocOff}>
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
        {p.convTxt && <p className="cvl">{p.convTxt}</p>}
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
            <div className="gr4 p" role="group" aria-label={"Posición de " + d.held.name + " en este siete"}>
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

// ── «Más» ──
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

// ── the tools: phone / tablet = the bottom mode bar (Siete · Química · Jugadas · Dibujar · Más); desktop =
// the «Acciones» rail flush left (En el campo / Gestión, a line each and the shortcut 1–8) with the next
// match's card at its foot ──
/** The rail's foot: the board's match and how its convocatoria stands. */
export interface MatchCard {
  kick: string;
  title: string;
  when: string;
  /** Voy / duda / no va (null while there is nothing to count: not read yet, or nobody answered). */
  counts: { voy: number; duda: number; no: number } | null;
  /** Instead of the counts. */
  note: string;
}

export function ModeBar({ modo, onGo, card }: { modo: Modo; onGo: (m: Modo) => void; card: MatchCard | null }) {
  const masOn = ["mas", "tableros", "comparar", "compartir", "ajustes"].includes(modo);
  return (
    <nav className="mbar" aria-label="Herramientas de la pizarra">
      {RAIL.flatMap((grp, gi) => [
        <span key={grp.g} className="mg-h" aria-hidden="true">
          {grp.g}
        </span>,
        ...grp.items.map((x, ii) => (
            <button
              key={x.m}
              type="button"
              className={"mbt" + (gi ? " dsk" : "")}
              onClick={() => onGo(x.m)}
              aria-pressed={modo === x.m}
              aria-label={x.l}
              title={x.l + " · " + x.d}
            >
              <Icon n={x.icon} w={x.w} />
              <span className="mt">
                <b>
                  {x.l}
                  {x.nv && <Nuevo />}
                </b>
                <small>{x.d}</small>
              </span>
              <kbd className="mk" aria-hidden="true">
                {gi * 4 + ii + 1}
              </kbd>
            </button>
        )),
      ])}
      {card && (
        <div className="mft">
          <small>{card.kick}</small>
          <b>{card.title}</b>
          <span>{card.when}</span>
          {card.counts ? (
            <span className="mft-c">
              <i className="v" aria-hidden="true" />
              {card.counts.voy} voy
              <i className="d" aria-hidden="true" />
              {card.counts.duda} duda
              <i className="n" aria-hidden="true" />
              {card.counts.no} no va
            </span>
          ) : (
            <span className="mft-c">{card.note}</span>
          )}
        </div>
      )}
      <button type="button" className="mbt mob" onClick={() => onGo("mas")} aria-pressed={masOn} aria-label="Más">
        <Icon n="dots" />
        <span className="mt">
          <b>Más</b>
        </span>
      </button>
    </nav>
  );
}
