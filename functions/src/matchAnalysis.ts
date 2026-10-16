/** Recorded actions, not estimates. Shared by publication, season totals and all charts. */
import { isGuestId } from "./guests.js";

export const ACTION_LABELS = {
  pass: "Pase", shot: "Remate", cross: "Centro", dribble: "Regate", tackle: "Entrada",
  interception: "Intercepción", recovery: "Recuperación", possession_lost: "Pérdida",
  clearance: "Despeje", block: "Bloqueo de remate", save: "Parada", foul: "Falta cometida",
  foul_received: "Falta recibida", duel: "Duelo", aerial_duel: "Duelo aéreo", throw_in: "Saque de banda",
  goal_kick: "Saque de puerta", kickoff: "Saque de centro", offside: "Fuera de juego",
  carry: "Conducción", touch: "Control", possession: "Tramo de posesión", other_action: "Otra acción",
} as const;
export type ActionType = keyof typeof ACTION_LABELS;
export const OUTCOMES = ["complete", "incomplete", "on_target", "off_target", "blocked", "woodwork", "won", "lost", "held", "parried", "unknown"] as const;
export type Outcome = typeof OUTCOMES[number];
export const OUTCOME_LABELS: Record<Outcome, string> = { complete: "Completado", incomplete: "Fallado", on_target: "A puerta (parado)", off_target: "Fuera", blocked: "Bloqueado", woodwork: "Al palo", won: "Ganado", lost: "Perdido", held: "Blocada", parried: "Despejado", unknown: "Sin precisar" };
export interface ActionDetails {
  team?: "us" | "opponent";
  receiverId?: string;
  opponentPlayer?: string;
  outcome?: Outcome;
  keyPass?: boolean;
  delivery?: "short" | "long" | "cross" | "through" | "throw";
  bodyPart?: "right" | "left" | "head" | "hand" | "other";
  zone?: "left" | "center" | "right";
  x?: number; y?: number; endX?: number; endY?: number;
  possessionSeconds?: number;
  /** Exact playing time, never wall time including the interval. */
  elapsedSeconds?: number;
  timingUnknown?: boolean;
  period?: 1 | 2;
  source?: "live" | "narration" | "manual";
  sourceRef?: string;
}
export interface AnalysisEvent extends ActionDetails { id: string; type: string; minute?: number; playerId?: string; assistPlayerId?: string; note?: string }
export const TECH_KEYS = ["passes", "passesCompleted", "passesFailed", "passesUnknown", "passesReceived", "keyPasses", "longPasses", "longPassesCompleted", "crosses", "crossesCompleted", "shots", "shotsOnTarget", "shotsOffTarget", "shotsBlocked", "shotsWoodwork", "shotGoals", "shotAssists", "chancesCreated", "turnovers", "recoveries", "interceptions", "tackles", "tacklesWon", "tacklesUnknown", "clearances", "blocks", "saves", "dribbles", "dribblesWon", "duels", "duelsWon", "aerialDuels", "aerialDuelsWon", "fouls", "foulsReceived", "throwIns", "goalKicks", "kickoffs", "offsides", "carries", "touches", "cornersTaken", "possessionsSeconds", "recordedActions"] as const;
export type TechnicalStats = Record<typeof TECH_KEYS[number], number>;
export const emptyTechnical = (): TechnicalStats => Object.fromEntries(TECH_KEYS.map(k => [k, 0])) as TechnicalStats;
export const isAnalysisAction = (type: string) => Object.hasOwn(ACTION_LABELS, type);
export const eventSeconds = (e: { elapsedSeconds?: number; minute?: number }) => e.elapsedSeconds ?? (e.minute ?? 0) * 60;
export const eventSide = (e: AnalysisEvent) => e.type.startsWith("opponent_") || e.team === "opponent" ? "opponent" as const : "us" as const;
export function actionProblem(e: AnalysisEvent): string | null {
  if (!isAnalysisAction(e.type) && e.team && e.team !== (e.type.startsWith("opponent_") ? "opponent" : "us")) return "El equipo no corresponde al tipo de evento. Usa el evento rival para acciones del rival.";
  if (e.assistPlayerId && !["goal", "goal_penalty", "goal_freekick"].includes(e.type)) return "El asistente se vincula al gol del Piti. Para un pase que genera un remate, registra un pase clave.";
  if (e.timingUnknown && (e.minute != null || e.elapsedSeconds != null)) return "Una acción sin tiempo conocido no puede incluir un minuto o segundos.";
  const choices: Partial<Record<ActionType, readonly string[]>> = { pass: ["complete", "incomplete", "unknown"], cross: ["complete", "incomplete", "unknown"], shot: ["on_target", "off_target", "blocked", "woodwork", "unknown"], tackle: ["won", "lost", "unknown"], dribble: ["won", "lost", "unknown"], duel: ["won", "lost", "unknown"], aerial_duel: ["won", "lost", "unknown"], save: ["held", "parried", "unknown"] };
  const allowed = choices[e.type as ActionType];
  if (allowed && (!e.outcome || !allowed.includes(e.outcome))) return `Especifica el resultado de ${ACTION_LABELS[e.type as ActionType]}.`;
  if (e.receiverId && (!["pass", "cross", "throw_in", "goal_kick", "kickoff"].includes(e.type) || e.receiverId === e.playerId || e.team === "opponent" || e.outcome === "incomplete")) return "El receptor debe ser otro jugador del Piti en una entrega completada o sin resultado confirmado.";
  if (e.keyPass && (!["pass", "cross"].includes(e.type) || e.outcome !== "complete")) return "Un pase clave debe ser un pase o centro completado que genera un remate.";
  if (e.type === "possession" && !(e.possessionSeconds && e.possessionSeconds > 0)) return "Indica los segundos del tramo de posesión.";
  if (e.type === "other_action" && !e.note?.trim()) return "Describe la acción adicional.";
  return null;
}
export function analyseActions(events: readonly AnalysisEvent[]) {
  const teams = { us: emptyTechnical(), opponent: emptyTechnical() };
  const players: Record<string, TechnicalStats> = {};
  const links = new Map<string, { from: string; to: string; count: number; crosses: number }>();
  const shots: AnalysisEvent[] = [];
  // A guest («guest:g1», guests.ts) plays for the team: his actions count in the team's totals, never in
  // a per-player row, a passing link or a member's shot-assist.
  const scratch = emptyTechnical();
  const player = (id: string) => (isGuestId(id) ? scratch : (players[id] ??= emptyTechnical()));
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const side = eventSide(e);
    const team = teams[side];
    const row = side === "us" && e.playerId && !isGuestId(e.playerId) ? player(e.playerId) : undefined;
    const add = (k: keyof TechnicalStats, n = 1) => { team[k] += n; if (row) row[k] += n; };
    const goal = ["goal", "goal_penalty", "goal_freekick", "opponent_goal"].includes(e.type);
    const pass = e.type === "pass" || e.type === "cross";
    if (isAnalysisAction(e.type) || goal || ["chance", "opponent_chance", "corner", "opponent_corner", "woodwork", "penalty_saved", "penalty_missed"].includes(e.type)) add("recordedActions");
    if (pass) {
      add("passes"); add(e.outcome === "complete" ? "passesCompleted" : e.outcome === "incomplete" ? "passesFailed" : "passesUnknown");
      if (e.outcome === "incomplete") add("turnovers");
      if (e.delivery === "long") { add("longPasses"); if (e.outcome === "complete") add("longPassesCompleted"); }
      const cross = e.type === "cross" || e.delivery === "cross";
      if (cross) { add("crosses"); if (e.outcome === "complete") add("crossesCompleted"); }
      if (e.keyPass) add("keyPasses");
      if (side === "us" && e.outcome === "complete" && e.receiverId) {
        player(e.receiverId).passesReceived++; team.passesReceived++;
        if (e.playerId && !isGuestId(e.playerId) && !isGuestId(e.receiverId)) { const key = `${e.playerId}>${e.receiverId}`; const edge = links.get(key) ?? { from: e.playerId, to: e.receiverId, count: 0, crosses: 0 }; edge.count++; if (cross) edge.crosses++; links.set(key, edge); }
      }
    }
    if (e.type === "shot" || goal || ["woodwork", "penalty_missed"].includes(e.type)) {
      add("shots"); shots.push(e);
      if (goal) { add("shotGoals"); add("shotsOnTarget"); }
      else if (e.type === "woodwork" || e.outcome === "woodwork") add("shotsWoodwork");
      else if (e.outcome === "on_target") add("shotsOnTarget");
      else if (e.outcome === "off_target") add("shotsOffTarget");
      else if (e.outcome === "blocked") add("shotsBlocked");
      if (e.assistPlayerId && side === "us") { player(e.assistPlayerId).shotAssists++; team.shotAssists++; }
    }
    const singles: Record<string, keyof TechnicalStats> = { chance: "chancesCreated", opponent_chance: "chancesCreated", possession_lost: "turnovers", recovery: "recoveries", interception: "interceptions", clearance: "clearances", block: "blocks", save: "saves", penalty_saved: "saves", foul: "fouls", foul_received: "foulsReceived", throw_in: "throwIns", goal_kick: "goalKicks", kickoff: "kickoffs", offside: "offsides", carry: "carries", touch: "touches", corner: "cornersTaken", opponent_corner: "cornersTaken" };
    if (singles[e.type]) add(singles[e.type]);
    if (e.type === "interception") add("recoveries");
    if (e.type === "tackle" && e.outcome !== "won" && e.outcome !== "lost") add("tacklesUnknown");
    for (const [type, attempts, won] of [["tackle", "tackles", "tacklesWon"], ["dribble", "dribbles", "dribblesWon"], ["duel", "duels", "duelsWon"], ["aerial_duel", "aerialDuels", "aerialDuelsWon"]] as const) if (e.type === type) { add(attempts); if (e.outcome === "won") add(won); }
    if (e.type === "dribble" && e.outcome === "lost") add("turnovers");
    if (e.type === "possession") add("possessionsSeconds", e.possessionSeconds ?? 0);
  }
  return { teams, players, links: [...links.values()], shots };
}
export const ratio = (n: number, d: number) => d > 0 ? n / d * 100 : null;
