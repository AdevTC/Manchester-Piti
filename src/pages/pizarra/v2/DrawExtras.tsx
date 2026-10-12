// Bloque 4 on the pitch and in Dibujar: the layer inside the frame (the pinned strokes — Unir, Foco,
// Medir, Fuera de juego —, the rival's red tokens, the players picked for a tool, and the handles that
// bend a jugada's paths), and Dibujar's own controls for those tools (pick players by keyboard, the
// fuera de juego lines, the «Rival» toggle, «Convertir el dibujo en jugada»).
import type { StrokeKind } from "../drawings";
import { Icon } from "./icons";
import { vars } from "./view";
import type { ExtraView, RivalToken } from "./drawTools";
import type { CurveHandle } from "./playPaths";
import "../../../styles/pizarra-dibujo.css";

export interface DrawLayerProps {
  view: ExtraView | null;
  rival: RivalToken[] | null;
  /** The players picked for Unir / Medir, waiting (frame %). */
  picked: { id: string; x: string; y: string }[];
  /** A jugada's paso being edited: the handles at the middle of each path (data-piece «c:<id>»). */
  handles: CurveHandle[] | null;
  handleAria: (h: CurveHandle) => string;
}

export function DrawLayer({ view, rival, picked, handles, handleAria }: DrawLayerProps) {
  return (
    <>
      {view && view.lines.length > 0 && (
        <svg className="dr-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {view.lines.map((l) => (
            <path key={l.id} className={"dr-l dr-" + l.kind + " " + l.cls + (l.sel ? " dr-sel" : "")} d={l.d} />
          ))}
        </svg>
      )}
      {view?.focos.map((f) => (
        <span key={f.id} className={"dr-foco " + f.cls + (f.sel ? " dr-sel" : "")} style={vars({ "--x": f.x, "--y": f.y })} aria-hidden="true" />
      ))}
      {view?.labels.map((t) => (
        <span key={t.id} className={"dr-lab " + t.cls + (t.sel ? " dr-sel" : "")} style={vars({ "--x": t.x, "--y": t.y })} aria-hidden="true">
          {t.text}
        </span>
      ))}
      {rival?.map((r) => (
        <span key={r.i} className={"dr-rv" + (r.noted ? " dr-noted" : "")} style={vars({ "--x": r.x, "--y": r.y, "--sc": r.sc })} title={r.aria} aria-hidden="true">
          <b>{r.num}</b>
        </span>
      ))}
      {picked.map((p) => (
        <span key={p.id} className="dr-pk-r" style={vars({ "--x": p.x, "--y": p.y })} aria-hidden="true" />
      ))}
      {handles?.map((h) => (
        <button key={h.id} type="button" className={"dr-ch" + (h.bent ? " dr-bent" : "")} style={vars({ "--x": h.x, "--y": h.y })} data-piece={"c:" + h.id} aria-label={handleAria(h)} />
      ))}
    </>
  );
}

export type PinTool = Extract<StrokeKind, "unir" | "foco" | "medir">;
const PIN_TOOLS: { k: PinTool; label: string; hint: string }[] = [
  { k: "unir", label: "Unir", hint: "Elige de 2 a 4 jugadores, en orden, y pulsa «Unir»: la línea o el rombo se mueve con ellos." },
  { k: "foco", label: "Foco", hint: "Toca un jugador para ponerle el foco." },
  { k: "medir", label: "Medir", hint: "Elige dos jugadores, o arrastra sobre el césped de un punto a otro (campo de 60 × 40 m)." },
];

export interface DrawToolsBarProps {
  tool: StrokeKind;
  onTool: (k: PinTool) => void;
  /** The seven on the pitch, to pick from without touching the grass. */
  players: { id: string; name: string; num: number }[];
  picked: string[];
  onPick: (id: string) => void;
  onUnir: () => void;
  fuera: { nos: boolean; rival: boolean; canRival: boolean };
  onFuera: (side: "nos" | "rival") => void;
  /** The board has a rival seven, and its tokens are on the pitch. */
  rival: { has: boolean; on: boolean };
  onRival: () => void;
  canConvert: boolean;
  onConvert: () => void;
}

export function DrawToolsBar(p: DrawToolsBarProps) {
  const cur = PIN_TOOLS.find((t) => t.k === p.tool) ?? null;
  return (
    <div className="dr-bar">
      <h3>Pegado a los jugadores</h3>
      <div className="tools dr-tools" role="group" aria-label="Herramientas pegadas a los jugadores">
        {PIN_TOOLS.map((t) => (
          <button key={t.k} type="button" className="dt" onClick={() => p.onTool(t.k)} aria-pressed={p.tool === t.k}>
            <Icon n={t.k === "unir" ? "link" : t.k === "foco" ? "eye" : "swap"} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {cur && (
        <>
          <p className="dr-hint">{cur.hint}</p>
          {p.players.length ? (
            <div className="dr-pk" role="group" aria-label={"Jugadores para «" + cur.label + "»"}>
              {p.players.map((x) => {
                const k = p.picked.indexOf(x.id);
                return (
                  <button key={x.id} type="button" className="dr-chip" onClick={() => p.onPick(x.id)} aria-pressed={k >= 0}>
                    {k >= 0 && p.tool !== "foco" ? <b className="dr-ord">{k + 1}</b> : null}
                    {x.num + " " + x.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty">Coloca a alguien en el campo para usar esta herramienta.</p>
          )}
          {p.tool === "unir" && (
            <div className="row">
              <button type="button" className="b3" onClick={p.onUnir} disabled={p.picked.length < 2}>
                <Icon n="link" w={15} />
                {p.picked.length >= 2 ? "Unir a los " + p.picked.length : "Unir a los elegidos"}
              </button>
            </div>
          )}
        </>
      )}
      <div className="row dr-row">
        <button type="button" className="tg" onClick={() => p.onFuera("nos")} aria-pressed={p.fuera.nos}>
          Fuera de juego · nuestra línea
        </button>
        <button type="button" className="tg" onClick={() => p.onFuera("rival")} aria-pressed={p.fuera.rival} disabled={!p.fuera.canRival && !p.fuera.rival}>
          Fuera de juego · la suya
        </button>
        {p.rival.has ? (
          <button type="button" className="tg dr-rv-t" onClick={p.onRival} aria-pressed={p.rival.on}>
            Rival
          </button>
        ) : null}
      </div>
      {!p.rival.has && <p className="empty">El siete rival se añade en Siete → Plan; con él, su línea del fuera de juego.</p>}
      <div className="row dr-row">
        <button type="button" className="b3" onClick={p.onConvert} disabled={!p.canConvert}>
          <Icon n="film" w={16} />
          Convertir el dibujo en jugada
        </button>
      </div>
      {!p.canConvert && <p className="empty">Dibuja una carrera, un pase o una conducción que salga de un jugador para convertirlo en jugada.</p>}
    </div>
  );
}
