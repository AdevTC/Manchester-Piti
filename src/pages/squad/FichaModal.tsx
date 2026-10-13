import { pct } from "../../lib/technicalAnalysis";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Jersey3D, type Jersey3DRef } from "../../components/jersey3d/Jersey3D";
import { STILL } from "../../components/jersey3d/scene-constants";
import { Icon } from "../../components/celeste/icons";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { useFocusTrap } from "../pizarra/useFocusTrap";
import { formatHeight, missingText, type SquadRow } from "../../lib/squad";
import type { ClubMatch } from "../../lib/clubData";
import type { PositionSet } from "../../lib/positions";
import { playerPositions } from "../../lib/positionStats";
import { PosMap, PosTable } from "./FichaPosiciones";
import { useDesk } from "./useDesk";
import { shareClubPage } from "../../lib/share";
import { VT_SHIRT } from "./Percha";

interface Props {
  row: SquadRow;
  still?: string;
  seasonName: string;
  withStats: boolean;
  kit: "home" | "away";
  theme: "dark" | "light";
  onClose: () => void;
  onStep: (dir: 1 | -1) => void;
  onCompare: () => void;
  /** The finished and pending matches of the season the ficha shows (for «Posiciones»). */
  games?: ClubMatch[];
  /** His positions (preferida + también) for the map. */
  positions?: PositionSet;
}

const NO_GAMES: ClubMatch[] = [];
const NO_POSITIONS: PositionSet = { main: null, also: [] };
type Tab = "ficha" | "temporada" | "posiciones";

/** Long names shrink with their longest word so they never overflow the column. */
function nameFit(name: string): CSSProperties {
  const longest = Math.max(1, ...name.split(/\s+/).map((w) => [...w].length));
  return { "--k": Math.min(1, 8 / longest) } as CSSProperties;
}

/** The player's ficha over the page: the shirt flies in from the rail and turns into the 3D kit. */
export function FichaModal({ row, still, seasonName, withStats, kit, theme, onClose, onStep, onCompare, games = NO_GAMES, positions = NO_POSITIONS }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const shirt = useRef<Jersey3DRef>(null);
  const [tab, setTab] = useState<Tab>("ficha");
  const [shared, setShared] = useState(false);
  const desk = useDesk();
  const pos = useMemo(() => playerPositions(row.id, games), [row.id, games]);
  const mapOnStage = desk && tab === "posiciones";
  useFocusTrap(panel, onClose);
  // The page behind stays put while the ficha is open.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);
  const share = () => {
    shareClubPage("jugador", row.id, `${row.name} · Manchester Piti`)
      .then(() => setShared(true))
      .catch(() => {});
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLCanvasElement) return; // the canvas turns the shirt with the arrows
    if (e.key === "ArrowRight") onStep(1);
    if (e.key === "ArrowLeft") onStep(-1);
  };
  const s = row.stats;
  return createPortal(
    <div className="vx sq-layer" data-kit={kit}>
      <div className="sq-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sq-modal" ref={panel} role="dialog" aria-modal="true" aria-labelledby="sq-name" onKeyDown={onKey}>
        <button type="button" className="sq-round sq-close" onClick={onClose} aria-label="Cerrar ficha">
          <Icon name="x" size={18} stroke={2.2} />
        </button>
        <div className="sq-stage" style={{ aspectRatio: `${STILL.w} / ${STILL.h}` }}>
          <div className="glow" aria-hidden="true" />
          <div className="still" style={{ viewTransitionName: VT_SHIRT }}>
            {still ? <img src={still} alt="" draggable={false} /> : <ShirtBack name={row.name} num={row.num} />}
          </div>
          {/* under the map (desktop «Posiciones») the shirt is out of reach: not focusable, not announced, no arrow keys */}
          <div className="sq-shirt-slot" inert={mapOnStage}>
          <Jersey3D
            ref={shirt}
            className="sq-shirt3d"
            kit={kit}
            theme={theme}
            name={row.name.toUpperCase()}
            num={row.num}
            zoom={STILL.zoom}
            lift={STILL.lift}
            reveal={false}
            flip
            label={`Camiseta de ${row.name}, dorsal ${row.num}. Arrástrala o usa las flechas para girarla.`}
          />
          </div>
          {!mapOnStage && (
            <>
              <span className="cap">{kit === "home" ? "1ª" : "2ª"} equipación · arrástrala</span>
              <button type="button" className="sq-round turn" onClick={() => shirt.current?.turn()} aria-label="Girar la camiseta">
                <Icon name="turn" size={19} />
              </button>
            </>
          )}
          <button type="button" className="sq-round nav l" onClick={() => onStep(-1)} aria-label="Jugador anterior">
            <Icon name="left" size={18} stroke={2.2} />
          </button>
          <button type="button" className="sq-round nav r" onClick={() => onStep(1)} aria-label="Jugador siguiente">
            <Icon name="right" size={18} stroke={2.2} />
          </button>
        </div>
        {mapOnStage && (
          <div className="sq-pos-stage" key={`pos-${row.id}`}>
            <PosMap name={row.name} seasonName={seasonName} positions={positions} pos={pos} />
          </div>
        )}
        <div className="sq-info" key={row.id}>
          <div className="sq-tag" style={{ "--d": ".05s" } as CSSProperties}>
            <span className="d">{row.num}</span>
            <span>
              Dorsal
              {row.position && ` · ${row.position}`}
              {row.historic && " · histórico"}
            </span>
          </div>
          <div style={{ "--d": ".1s" } as CSSProperties}>
            <h2 id="sq-name" style={nameFit(row.name)}>
              {row.name}
            </h2>
            {row.full && <p className="full">{row.full}</p>}
          </div>
          <div className="sq-tabs" role="tablist" aria-label="Secciones de la ficha" style={{ "--d": ".16s" } as CSSProperties}>
            <button type="button" role="tab" id="sq-tab-ficha" aria-selected={tab === "ficha"} aria-controls="sq-panel" onClick={() => setTab("ficha")}>
              Ficha
            </button>
            <button type="button" role="tab" id="sq-tab-temporada" aria-label={seasonName} aria-selected={tab === "temporada"} aria-controls="sq-panel" onClick={() => setTab("temporada")}>
              {/* the full name, or «Temporada» where three tabs would truncate it (squad.css) */}
              <span className="lg" aria-hidden="true">
                {seasonName}
              </span>
              <span className="sh" aria-hidden="true">
                Temporada
              </span>
            </button>
            <button type="button" role="tab" id="sq-tab-posiciones" aria-selected={tab === "posiciones"} aria-controls="sq-panel" onClick={() => setTab("posiciones")}>
              Posiciones
            </button>
          </div>
          <div id="sq-panel" role="tabpanel" aria-labelledby={`sq-tab-${tab}`} className="sq-panel" style={{ "--d": ".22s" } as CSSProperties}>
            {tab === "ficha" ? (
              <>
                <dl className="sq-facts">
                  <div>
                    <dt>Edad</dt>
                    <dd>
                      {row.age ?? "—"}
                      {row.age != null && <small>años</small>}
                    </dd>
                  </div>
                  <div>
                    <dt>Altura</dt>
                    <dd>
                      {formatHeight(row.height)}
                      {row.height && <small>m</small>}
                    </dd>
                  </div>
                  <div>
                    <dt>Peso</dt>
                    <dd>
                      {row.weight ?? "—"}
                      {row.weight && <small>kg</small>}
                    </dd>
                  </div>
                  <div>
                    <dt>Cumple</dt>
                    <dd>
                      {row.birthday?.label ?? "—"}
                      {row.birthday && <span>{row.birthday.days === 0 ? "¡Hoy!" : `en ${row.birthday.days} días`}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Signo</dt>
                    <dd className="sm">{row.sign ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Posición</dt>
                    <dd className="sm">
                      {row.position ?? "Por definir"}
                      {row.also && <span className="also">También {row.also}</span>}
                    </dd>
                  </div>
                </dl>
                {row.missing.length > 0 && (
                  <p className="sq-missing">
                    <Icon name="flag" size={16} stroke={2} />
                    Ficha incompleta: falta {missingText(row.missing)}.
                  </p>
                )}
              </>
            ) : tab === "posiciones" ? (
              <div className="sq-pos">
                {!desk && (
                  <div className="sq-pos-pitch">
                    <PosMap name={row.name} seasonName={seasonName} positions={positions} pos={pos} />
                  </div>
                )}
                <PosTable seasonName={seasonName} pos={pos} />
              </div>
            ) : (
              <div className={`sq-season${withStats ? "" : " ph"}`}>
                <div className="row">
                  <div>
                    <b>{s.played}</b>
                    <span>Partidos</span>
                  </div>
                  <div>
                    <b>{s.goals}</b>
                    <span>Goles</span>
                  </div>
                  <div>
                    <b>{s.assists}</b>
                    <span>Asist.</span>
                  </div>
                  <div>
                    <b>{s.minutes ?? "—"}</b>
                    <span>Minutos</span>
                  </div>
                </div>
                {s.technical && <div className="row"><div><b>{s.technical.passesCompleted}/{s.technical.passes}</b><span>Pases completados</span></div><div><b>{pct(s.technical.passesCompleted,s.technical.passesCompleted+s.technical.passesFailed)}</b><span>Precisión</span></div><div><b>{s.technical.shots}</b><span>Remates</span></div><div><b>{s.technical.recoveries}</b><span>Recuperaciones</span></div></div>}
                <p>
                  {withStats
                    ? s.minutes == null
                      ? "Sumado de las actas de la temporada. Los minutos aparecen cuando el acta los registra."
                      : "Sumado de las actas de la temporada."
                    : "Todavía no hay actas: se rellena solo con cada partido, desde la jornada 1."}
                </p>
              </div>
            )}
          </div>
          <div className="sq-acts" style={{ "--d": ".28s" } as CSSProperties}>
            <Link className="hm-btn" to="/jugadores/$playerId" params={{ playerId: row.id }}>
              Ficha completa <Icon name="arrow" size={16} stroke={2.2} />
            </Link>
            <button type="button" className="hm-ghostbtn" onClick={onCompare}>
              <Icon name="swap" size={17} stroke={2} />
              Cara a cara
            </button>
            <button type="button" className="hm-ghostbtn" onClick={share}>
              <Icon name="share" size={17} stroke={2} />
              {shared ? "Enlace listo" : "Compartir"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
