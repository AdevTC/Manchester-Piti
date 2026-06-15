import React from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import type { LineStat, Rating } from "./chemistry";
import { ZONE_LABEL } from "./formations";

interface ChemistryPanelProps {
  rating: Rating;
  lines: LineStat[];
  /** Placed players flagged unavailable (suspended or injured). */
  unavailableInXI: number;
}

const AXES: { key: "prod" | "exp" | "disc" | "fit"; label: string }[] = [
  { key: "prod", label: "Producción" },
  { key: "exp", label: "Experiencia" },
  { key: "disc", label: "Disciplina" },
  { key: "fit", label: "Encaje" },
];

// 4-axis radar polygon on a 100x100 box: top, right, bottom, left.
function radarPoints(vals: number[]): string {
  const cx = 50, cy = 50, r = 42;
  const ang = [-90, 0, 90, 180].map((d) => (d * Math.PI) / 180);
  return vals.map((v, i) => `${cx + Math.cos(ang[i]) * r * v},${cy + Math.sin(ang[i]) * r * v}`).join(" ");
}

export const ChemistryPanel: React.FC<ChemistryPanelProps> = ({ rating, lines, unavailableInXI }) => {
  const { value, ref } = useCountUp(rating.score);
  const vals = AXES.map((a) => rating[a.key]);
  return (
    <section className="pz-chem" aria-label="Química del once">
      <div className="pz-chem-head">
        <span className="pz-chem-eyebrow">
          <Activity size={13} aria-hidden="true" /> Valoración del once
        </span>
        <span className="pz-chem-tier">{rating.tier}</span>
      </div>

      <div className="pz-chem-body">
        <div className="pz-chem-score">
          <span className="pz-chem-num" ref={ref}>{value}</span>
          <span className="pz-chem-max">/100</span>
        </div>

        <svg className="pz-chem-radar" viewBox="0 0 100 100" aria-hidden="true">
          <polygon className="pz-chem-radar-grid" points="50,8 92,50 50,92 8,50" />
          <line className="pz-chem-radar-grid" x1="50" y1="8" x2="50" y2="92" />
          <line className="pz-chem-radar-grid" x1="8" y1="50" x2="92" y2="50" />
          <polygon className="pz-chem-radar-fill" points={radarPoints(vals)} />
        </svg>

        <ul className="pz-chem-axes">
          {AXES.map((a, i) => (
            <li key={a.key}>
              <span>{a.label}</span>
              <b>{Math.round(vals[i] * 100)}</b>
            </li>
          ))}
        </ul>
      </div>

      <p className="pz-chem-rationale">{rating.rationale}</p>

      {unavailableInXI > 0 && (
        <p className="pz-chem-warn" role="status">
          <AlertTriangle size={13} aria-hidden="true" /> {unavailableInXI} no disponible{unavailableInXI > 1 ? "s" : ""} alineado{unavailableInXI > 1 ? "s" : ""}
        </p>
      )}

      <div className="pz-chem-lines" role="group" aria-label="Stats por línea">
        {lines.map((l) => (
          <div key={l.zone} className="pz-chem-line">
            <span className="pz-chem-line-zone">{ZONE_LABEL[l.zone]}</span>
            <span className="pz-chem-line-ga">
              <b>{l.goals + l.assists}</b> G+A
            </span>
            <span className="pz-chem-line-sub">
              {l.count} jug · {l.pj} PJ{l.cards ? ` · ${l.cards} tarj.` : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
