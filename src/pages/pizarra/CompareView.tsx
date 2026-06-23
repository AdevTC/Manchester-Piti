import React, { useState } from "react";
import type { LineupDoc } from "./lineupDoc";
import { ratingForLineupDoc, type PlayerMeta, type SquadNorms } from "./chemistry";
import type { PlayerStats } from "../../lib/playerStats";
import { ZONE_LABEL } from "./formations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

interface CompareViewProps {
  boards: LineupDoc[]; // mine + official, deduped
  statsById: Map<string, PlayerStats>;
  metaById: Map<string, PlayerMeta>;
  norms: SquadNorms;
  onClose: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ boards, statsById, metaById, norms, onClose }) => {
  const [aId, setAId] = useState(boards[0]?.id ?? "");
  const [bId, setBId] = useState(boards[1]?.id ?? boards[0]?.id ?? "");
  const A = boards.find((x) => x.id === aId);
  const B = boards.find((x) => x.id === bId);

  const evalBoard = (d?: LineupDoc) =>
    d ? ratingForLineupDoc(d.slots, d.playerPositions, statsById, metaById, norms) : null;

  const col = (d: LineupDoc | undefined, r: ReturnType<typeof evalBoard>, side: "a" | "b") => (
    <div className={`pz-cmp-col pz-cmp-col--${side}`}>
      <Select value={side === "a" ? aId : bId} onValueChange={side === "a" ? setAId : setBId}>
        <SelectTrigger size="sm" className="w-full" aria-label={`Tablero ${side === "a" ? "A" : "B"}`}>
          <SelectValue placeholder="Tablero" />
        </SelectTrigger>
        <SelectContent className="z-[1100]">
          {boards.map((x) => (
            <SelectItem key={x.id} value={x.id}>
              {x.name}
              {x.isOfficial ? " ·oficial" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {r && d ? (
        <>
          <div className="pz-cmp-score">{r.rating.score}</div>
          <div className="pz-cmp-tier">{r.rating.tier}</div>
          <div className="pz-cmp-formation">{d.formation}</div>
          <ul className="pz-cmp-lines">
            {r.lines.map((l) => (
              <li key={l.zone}>
                <span>{ZONE_LABEL[l.zone]}</span>
                <b>{l.goals + l.assists}</b> G+A
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="pz-cmp-empty">Sin tablero.</p>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wide">Comparar alineaciones</DialogTitle>
        </DialogHeader>
        {boards.length < 1 ? (
          <p className="pz-cmp-empty">Guarda al menos un tablero para comparar.</p>
        ) : (
          <div className="pz-cmp-grid">
            {col(A, evalBoard(A), "a")}
            <div className="pz-cmp-vs" aria-hidden="true">VS</div>
            {col(B, evalBoard(B), "b")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
