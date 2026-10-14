// /club «La plantilla por posiciones»: a small night pitch with the 13 positions, each with how many players
// of the season — the same squad «La plantilla en números» counts — have it as their preferida and how many
// more list it in «también» («MC 3 · +2»), and the ones without an exact position apart («Sin posición
// exacta: N», old fichas with only a line said as such). Read from each ficha (resolvePositions).
import type { CSSProperties } from "react";
import { noPositionText, posCountText, posKey, squadByPosition, type SquadNumbersInput } from "../../lib/club";
import { POSITIONS, POS_CODES } from "../../lib/positions";
import { NewBadge } from "../../components/NewBadge";

/** Where a chip goes, and `--w` (0–1: how many players it has against the busiest position) for its halo. */
const spotStyle = (x: number, y: number, w: number): CSSProperties & Record<`--${string}`, string> => ({ left: `${x}%`, top: `${y}%`, "--w": w.toFixed(2) });

const jugadores = (n: number) => `${n} ${n === 1 ? "jugador" : "jugadores"}`;

/** The pitch's lines (portrait, our goal at the bottom), as the positions map draws it. */
function Pitch() {
  return (
    <svg className="cl-pp-lines" viewBox="0 0 40 70" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g fill="none">
        <rect x="1.5" y="1.5" width="37" height="67" rx="0.6" vectorEffect="non-scaling-stroke" />
        <line x1="1.5" y1="35" x2="38.5" y2="35" vectorEffect="non-scaling-stroke" />
        <circle cx="20" cy="35" r="5" vectorEffect="non-scaling-stroke" />
        <rect x="9" y="1.5" width="22" height="9" vectorEffect="non-scaling-stroke" />
        <rect x="9" y="59.5" width="22" height="9" vectorEffect="non-scaling-stroke" />
        <rect x="14.5" y="65" width="11" height="3.5" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

export function PlantillaPosiciones({ squad, seasonName }: { squad: readonly SquadNumbersInput[]; seasonName: string }) {
  const { byCode, none, lineOnly, total } = squadByPosition(squad);
  const noPos = noPositionText(none, lineOnly);
  const key = posKey(byCode);
  const most = Math.max(1, ...POS_CODES.map((c) => byCode[c].main + byCode[c].also));
  return (
    <section className="cl-sec cl-pp" aria-labelledby="cl-pos">
      <div className="cl-hd">
        <span className="hm-kick" style={{ margin: 0 }}>
          {seasonName} <NewBadge feature="posicionesPlantilla" />
        </span>
        <h2 className="cl-h2" id="cl-pos">
          La plantilla por posiciones
        </h2>
      </div>
      <div className="cl-pp-in">
        <div className="cl-pp-pitch">
          <Pitch />
          <ul className="cl-pp-spots" aria-label={`Jugadores por posición · ${seasonName}`}>
            {POS_CODES.map((code) => {
              const n = byCode[code];
              const p = POSITIONS[code];
              const empty = n.main + n.also === 0;
              return (
                <li
                  key={code}
                  className="cl-pp-spot"
                  data-code={code}
                  data-pref={n.main > 0 ? "" : undefined}
                  data-empty={empty ? "" : undefined}
                  style={spotStyle(p.x, p.y, (n.main + n.also) / most)}
                >
                  <span className="cl-pp-chip" aria-hidden="true">
                    {posCountText(code, n)}
                  </span>
                  <span className="hm-sr">
                    {`${p.name} (${code}): ${n.main} de preferida${n.also ? ` y ${n.also} más en «también»` : ""}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="cl-pp-side">
          <p className="cl-pp-legend">
            <span className="cl-pp-key" data-also={key.pref ? undefined : ""} aria-hidden="true">
              {key.chip}
            </span>
            <span>{key.text}</span>
          </p>
          <p className="cl-pp-none">
            <b>{noPos.title}</b>
            <span>{noPos.text}</span>
          </p>
          <p className="st-mono">
            {jugadores(total)} de la temporada · cada uno marca su preferida y las demás donde también juega; el capitán lo confirma.
          </p>
        </div>
      </div>
    </section>
  );
}
