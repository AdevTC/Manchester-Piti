import { useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Jersey3D, type Jersey3DRef } from "../../components/jersey3d/Jersey3D";
import { Icon } from "../../components/celeste/icons";
import { formatHeight, missingText, type SquadRow } from "../../lib/squad";
import { shareClubPage } from "../../lib/share";

interface Props {
  row: SquadRow;
  seasonName: string;
  withStats: boolean;
  kit: "home" | "away";
  theme: "dark" | "light";
  onStep: (dir: 1 | -1) => void;
  onCompare: () => void;
}

/** Long names shrink with their longest word so they never overflow the column. */
function nameFit(name: string): CSSProperties {
  const longest = Math.max(1, ...name.split(/\s+/).map((w) => [...w].length));
  return { "--k": Math.min(1, 8 / longest) } as CSSProperties;
}

/** The selected player: the 3D kit on one side, the ficha (with its season tab) on the other. */
export function Ficha({ row, seasonName, withStats, kit, theme, onStep, onCompare }: Props) {
  const shirt = useRef<Jersey3DRef>(null);
  const [tab, setTab] = useState<"ficha" | "temporada">("ficha");
  const [shared, setShared] = useState(false);
  const share = () => {
    shareClubPage("jugador", row.id, `${row.name} · Manchester Piti`)
      .then(() => setShared(true))
      .catch(() => {});
  };
  const s = row.stats;
  return (
    <section id="sq-ficha" className="sq-ficha hm-card" aria-labelledby="sq-name">
      <div className="sq-stage">
        <span className="cap">{kit === "home" ? "1ª equipación" : "2ª equipación"} · arrástrala para girarla</span>
        <Jersey3D
          ref={shirt}
          className="sq-shirt3d"
          kit={kit}
          theme={theme}
          name={row.name.toUpperCase()}
          num={row.num}
          zoom={0.86}
          lift={0.28}
          flip
          label={`Camiseta de ${row.name}, dorsal ${row.num}. Arrástrala o usa las flechas para girarla.`}
        />
        <button type="button" className="sq-round turn" onClick={() => shirt.current?.turn()} aria-label="Girar la camiseta">
          <Icon name="turn" size={19} />
        </button>
      </div>
      <div className="sq-info" aria-live="polite">
        <div className="sq-tag">
          <span className="d">{row.num}</span>
          <span>
            Dorsal
            {row.position && ` · ${row.position}`}
            {row.historic && " · histórico"}
          </span>
        </div>
        <div>
          <h2 id="sq-name" key={row.id} style={nameFit(row.name)}>
            {row.name}
          </h2>
          {row.full && <p className="full">{row.full}</p>}
        </div>
        <div className="sq-tabs" role="tablist" aria-label="Secciones de la ficha">
          <button type="button" role="tab" id="sq-tab-ficha" aria-selected={tab === "ficha"} aria-controls="sq-panel" onClick={() => setTab("ficha")}>
            Ficha
          </button>
          <button type="button" role="tab" id="sq-tab-temporada" aria-selected={tab === "temporada"} aria-controls="sq-panel" onClick={() => setTab("temporada")}>
            {seasonName}
          </button>
        </div>
        <div id="sq-panel" role="tabpanel" aria-labelledby={`sq-tab-${tab}`} className="sq-panel">
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
        <div className="sq-acts">
          <Link className="hm-btn" to="/jugadores/$playerId" params={{ playerId: row.id }}>
            Ficha completa <Icon name="arrow" size={16} stroke={2.2} />
          </Link>
          <button type="button" className="hm-ghostbtn" onClick={share}>
            <Icon name="share" size={17} stroke={2} />
            {shared ? "Enlace listo" : "Compartir"}
          </button>
          <button type="button" className="hm-ghostbtn" onClick={onCompare}>
            <Icon name="swap" size={17} stroke={2} />
            Comparar
          </button>
          <span className="sp" />
          <button type="button" className="sq-round" onClick={() => onStep(-1)} aria-label="Jugador anterior">
            <Icon name="left" size={18} stroke={2} />
          </button>
          <button type="button" className="sq-round" onClick={() => onStep(1)} aria-label="Jugador siguiente">
            <Icon name="right" size={18} stroke={2} />
          </button>
        </div>
      </div>
    </section>
  );
}
