import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Jersey3D, type Jersey3DRef } from "../../components/jersey3d/Jersey3D";
import { STILL } from "../../components/jersey3d/scene-constants";
import { Icon } from "../../components/celeste/icons";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { useFocusTrap } from "../pizarra/useFocusTrap";
import { formatHeight, missingText, type SquadRow } from "../../lib/squad";
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
}

/** Long names shrink with their longest word so they never overflow the column. */
function nameFit(name: string): CSSProperties {
  const longest = Math.max(1, ...name.split(/\s+/).map((w) => [...w].length));
  return { "--k": Math.min(1, 8 / longest) } as CSSProperties;
}

/** The player's ficha over the page: the shirt flies in from the rail and turns into the 3D kit. */
export function FichaModal({ row, still, seasonName, withStats, kit, theme, onClose, onStep, onCompare }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const shirt = useRef<Jersey3DRef>(null);
  const [tab, setTab] = useState<"ficha" | "temporada">("ficha");
  const [shared, setShared] = useState(false);
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
          <span className="cap">{kit === "home" ? "1ª" : "2ª"} equipación · arrástrala</span>
          <button type="button" className="sq-round turn" onClick={() => shirt.current?.turn()} aria-label="Girar la camiseta">
            <Icon name="turn" size={19} />
          </button>
          <button type="button" className="sq-round nav l" onClick={() => onStep(-1)} aria-label="Jugador anterior">
            <Icon name="left" size={18} stroke={2.2} />
          </button>
          <button type="button" className="sq-round nav r" onClick={() => onStep(1)} aria-label="Jugador siguiente">
            <Icon name="right" size={18} stroke={2.2} />
          </button>
        </div>
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
            <button type="button" role="tab" id="sq-tab-temporada" aria-selected={tab === "temporada"} aria-controls="sq-panel" onClick={() => setTab("temporada")}>
              {seasonName}
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
                    <dd className="sm">{row.position ?? "Por definir"}</dd>
                  </div>
                </dl>
                {row.missing.length > 0 && (
                  <p className="sq-missing">
                    <Icon name="flag" size={16} stroke={2} />
                    Ficha incompleta: falta {missingText(row.missing)}.
                  </p>
                )}
              </>
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
