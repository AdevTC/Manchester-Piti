// «Ha jugado de: MC 320′ · MCD 140′» — the captain's evidence in the ficha's Posiciones (and in the banner of
// a pending proposal) before he approves: where the player really played, every season's actas. Codes, as
// the admin reads them, each with its full name for screen readers (.sr); estimated minutes are said in words.
import { ESTIMATED_TEXT } from "../../../components/posiciones/mapaNav";
import { POSITIONS } from "../../../lib/positions";
import type { PlayerPositions } from "../../../lib/positionStats";
import { AdIcon } from "../ui/icons";
import { EVIDENCE_EMPTY, evidenceLines } from "./plantillaLogic";
import { fmtMinutes } from "../../../lib/derived/minutes";

export function PlayedEvidence({ pos, className }: { pos: PlayerPositions | undefined; className?: string }) {
  const lines = evidenceLines(pos);
  const cls = ["ppe", className].filter(Boolean).join(" ");
  if (!lines.length)
    return (
      <p className={cls + " none"}>
        <AdIcon name="ball" size={13} />
        <span>{EVIDENCE_EMPTY}</span>
      </p>
    );
  return (
    <p className={cls}>
      <AdIcon name="ball" size={13} />
      <span>
        <b>Ha jugado de:</b>{" "}
        {lines.map((l, i) => (
          <span key={l.code} className="ppe-c">
            {i > 0 && " · "}
            {l.code}
            <span className="sr"> ({POSITIONS[l.code].name})</span> {fmtMinutes(l.minutes)}
          </span>
        ))}
        {pos && pos.estimatedMatches > 0 && <small className="ppe-est">{ESTIMATED_TEXT}</small>}
      </span>
    </p>
  );
}
