// «Turnos» block (CL- boards part-vestuario vx.g.turnos), pure: each job of the match with its icon and who does it
// («Tú, Kevin» when it is his, with «Te toca»), and whether the match is played (only then «Marcar como hecho»).
import { dateMillis, type ClubMatch } from "../../../lib/clubData";
import type { RotaIconId, Turn } from "../../../lib/derived/rota";
import type { IconName } from "../../club/cb/ui";

/** A rota icon in the kit's glyphs (the same map as the match page's Vestuario). */
export const ROTA_ICON: Record<RotaIconId, IconName> = { shirt: "shirt", ball: "ball", car: "away", bottle: "bolt", bag: "shirt", key: "lock" };
/** The job's glyph: a wash for «Lavar…», the table for «La mesa», else its rota icon. */
export const turnIcon = (t: Pick<Turn, "job">): IconName => (/lav/i.test(t.job.name) ? "wash" : /mesa/i.test(t.job.name) ? "mesa" : ROTA_ICON[t.job.icon]);

export interface TurnRow {
  key: string;
  job: string;
  who: string;
  icon: IconName;
  mine: boolean;
  cls: string;
}
export function turnRows(turns: readonly Turn[], playerId: string | null, nameOf: (id: string) => string): TurnRow[] {
  return turns.map((t) => {
    const mine = !!playerId && t.playerId === playerId;
    const name = t.playerId ? nameOf(t.playerId) : "Nadie disponible";
    const swap = t.pinned && t.swappedFrom ? ` · cambio del capitán (le tocaba a ${nameOf(t.swappedFrom)})` : "";
    return { key: t.job.id, job: t.job.name, who: `${mine ? `Tú, ${name}` : name}${swap}`, icon: turnIcon(t), mine, cls: mine ? "is-me" : "" };
  });
}

/** The match has been played (or kicked off): his turn can be marked done. Never a cancelled or postponed one. */
export function turnPlayed(m: Pick<ClubMatch, "status" | "date"> | undefined, now: number): boolean {
  if (!m || m.status === "cancelled" || m.status === "postponed") return false;
  if (m.status === "finished") return true;
  const ko = dateMillis(m.date);
  return Number.isFinite(ko) && ko <= now;
}
