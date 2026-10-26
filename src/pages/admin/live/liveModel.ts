// The live match, pure (tested in liveModel.test.ts): who is on the pitch and on the bench (the pizarra's
// live board reads it) and the log «Lo que va pasando» that Hoy shows, in the words of the shared catalogue
// (src/lib/liveActions.ts). Scoring itself is la mesa's (src/pages/mesa).
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { onPitch } from "../../../lib/ficha";
import { eventMinute } from "../../../lib/partidos";
import { isLiveActionType, liveAction, liveLine } from "../../../lib/liveActions";
import { guestsLast } from "../../../lib/derived/guests";

/** Who is on the pitch and who can still come in, from the convocatoria and the live events; the guests last. */
export function liveSides(starters: readonly string[] | undefined, bench: readonly string[] | undefined, events: readonly MatchEvent[] | undefined): { field: string[]; bench: string[] } {
  const field = onPitch([...(starters ?? [])], [...(events ?? [])]);
  const off = new Set((events ?? []).filter((e) => (e.type === "red_card" || e.type === "double_yellow") && e.playerId).map((e) => e.playerId as string));
  const called = [...(starters ?? []), ...(bench ?? [])];
  // (the guests after the members, in both lists)
  return { field: guestsLast(field), bench: guestsLast(called.filter((id) => !field.includes(id) && !off.has(id))) };
}

/** A line of «Lo que va pasando». */
export interface LogRow {
  id: string;
  minute: string;
  /** `rv` = theirs, `y` = yellow, `rj` = red / second yellow. */
  cls: "" | "rv" | "y" | "rj";
  icon: "ball" | "card" | "swap" | "flag" | "spark" | null;
  text: string;
  detail: string;
}
const GOALS = new Set(["goal", "goal_penalty", "goal_freekick"]);
/** The plays outside the live catalogue (written from the acta). */
const OTHER: Record<string, string> = { penalty_committed: "Penalti cometido", penalty_received: "Penalti recibido" };
const CLS: Partial<Record<string, LogRow["cls"]>> = { yellow_card: "y", double_yellow: "rj", red_card: "rj" };
const ICON: Partial<Record<string, LogRow["icon"]>> = { opponent_goal: "ball", opponent_own_goal: "ball", yellow_card: "card", double_yellow: "card", red_card: "card", substitution: "swap", chance: "spark", opponent_chance: "spark", corner: "flag", opponent_corner: "flag" };

/** The match's events as the log tells them, newest first, in the catalogue's words (liveLine). */
export function liveLog(events: readonly MatchEvent[] | undefined, rival: string, nameOf: (id: string) => string): LogRow[] {
  const nm = (id?: string) => (id ? nameOf(id) : "—");
  const rows = (events ?? []).map((e, i): LogRow & { order: number; at: number } => {
    const shown = eventMinute(e);
    const base = { id: e.id, minute: shown !== null ? String(shown) : "–", order: i, at: typeof e.minute === "number" ? e.minute : -1 };
    if (GOALS.has(e.type)) {
      const how = e.type === "goal_penalty" ? "de penalti" : e.type === "goal_freekick" ? "de falta" : "";
      const detail = !e.playerId ? "falta el goleador" : [how, e.assistPlayerId ? `pase de ${nm(e.assistPlayerId)}` : ""].filter(Boolean).join(" · ");
      return { ...base, cls: "", icon: "ball", text: liveLine("goal", e.playerId && nm(e.playerId)), detail };
    }
    // a «Cambio de sitio»: two on the pitch trade places, nobody comes on or goes off
    if (e.type === "position_swap") return { ...base, cls: "", icon: "swap", text: `Cambio de sitio · ${nm(e.playerId)} ↔ ${nm(e.inPlayerId)}`, detail: "" };
    if (e.type === "own_goal") return { ...base, cls: "rv", icon: "ball", text: liveLine("opponent_goal", rival), detail: `en propia de ${nm(e.playerId)}` };
    if (!isLiveActionType(e.type)) return { ...base, cls: "", icon: null, text: `${OTHER[e.type] ?? "Jugada"} · ${nm(e.playerId)}`, detail: "" };
    const act = liveAction(e.type);
    // who the line is about: the rival for their plays (and their autogol), who comes in for a change,
    // nobody for a chance or corner of the whole team («Ocasión del Piti»)
    const who = act.side === "them" || act.type === "opponent_own_goal" ? rival : act.second === "in" ? nm(e.inPlayerId) : act.player === "optional" ? e.playerId && nm(e.playerId) : nm(e.playerId);
    const detail = act.second === "in" ? `sale ${nm(e.playerId)}` : act.pad === "oca" || act.pad === "cor" ? (e.note ?? "") : "";
    return { ...base, cls: CLS[e.type] ?? (act.side === "them" ? "rv" : ""), icon: ICON[e.type] ?? null, text: liveLine(act, who), detail };
  });
  rows.sort((a, b) => b.at - a.at || b.order - a.order);
  return rows.map((r) => ({ id: r.id, minute: r.minute, cls: r.cls, icon: r.icon, text: r.text, detail: r.detail }));
}
