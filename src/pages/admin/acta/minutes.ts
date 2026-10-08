// «Minutos y participación» (pure): the ledger the backend computes when it publishes, previewed from
// the acta — minutes, entries / exits and stints per player called up — as the Publicar tab lists it.
import { calculateLedger, type MatchSheet } from "../../../../functions/src/matchEngine";
import { reviewSheet } from "./sheetModel";

export interface MinutesRow {
  id: string;
  name: string;
  minutes: number;
  started: boolean;
  played: boolean;
  /** «inicial · 2 goles», «entra 30′ · sale 45′», «no jugó»… */
  detail: string;
}
export interface MinutesTable {
  rows: MinutesRow[];
  /** The ledger's problems (the same «Revisa los eventos» of the review). */
  errors: string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function minutesTable(sheet: MatchSheet, nameOf: (id: string) => string): MinutesTable {
  const s = reviewSheet(sheet);
  const ledger = calculateLedger(s, false);
  const ids = [...s.starters, ...s.bench];
  const rows = ids
    .filter((id) => ledger.players[id])
    .map((id) => {
      const p = ledger.players[id];
      const parts: string[] = [p.started ? "inicial" : "suplente"];
      for (const x of p.exchanges) parts.push(`${x.direction === "in" ? "entra" : "sale"} ${x.minute}′`);
      if (p.stints.length > 1) parts.push(`tramos ${p.stints.map((t) => `${t.from}–${t.to}′`).join(" · ")}`);
      if (p.dismissed) parts.push("expulsado");
      if (p.goals) parts.push(plural(p.goals, "gol", "goles"));
      if (p.assists) parts.push(plural(p.assists, "asistencia", "asistencias"));
      if (!p.played) parts.push("no jugó");
      return { id, name: nameOf(id), minutes: p.minutes, started: p.started, played: p.played, detail: parts.join(" · ") };
    });
  return { rows, errors: ledger.errors.filter((e) => e !== "Selecciona exactamente 7 titulares.") };
}
