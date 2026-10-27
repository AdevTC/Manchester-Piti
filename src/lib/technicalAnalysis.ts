import { technicalEvents } from '../../functions/src/narrated/compatibility';
import { eventSide, analyseActions, emptyTechnical, isAnalysisAction, ratio, type AnalysisEvent, type TechnicalStats } from "../../functions/src/matchAnalysis";
import type { ClubMatch } from "./clubData";
import { isVisibleMatch } from "../../functions/src/matchEngine";
import { guestLabel, isGuestId } from "./derived/guests";
import { remember } from "./remember";
export const TECH_LABELS: Record<keyof TechnicalStats, string> = { passes: "Pases intentados", passesCompleted: "Pases completados", passesFailed: "Pases fallados", passesUnknown: "Pases sin resultado", passesReceived: "Pases recibidos", keyPasses: "Pases clave", longPasses: "Pases largos", longPassesCompleted: "Largos completados", crosses: "Centros", crossesCompleted: "Centros completados", shots: "Remates", shotsOnTarget: "A puerta", shotsOffTarget: "Fuera", shotsBlocked: "Remates bloqueados", shotsWoodwork: "Al palo", shotGoals: "Goles de remate", shotAssists: "Asistencias de gol", chancesCreated: "Ocasiones", turnovers: "Pérdidas", recoveries: "Recuperaciones", interceptions: "Intercepciones", tackles: "Entradas", tacklesWon: "Entradas ganadas", tacklesUnknown: "Entradas sin resultado", clearances: "Despejes", blocks: "Bloqueos", saves: "Paradas", dribbles: "Regates", dribblesWon: "Regates ganados", duels: "Duelos", duelsWon: "Duelos ganados", aerialDuels: "Duelos aéreos", aerialDuelsWon: "Duelos aéreos ganados", fouls: "Faltas cometidas", foulsReceived: "Faltas recibidas", throwIns: "Saques de banda", goalKicks: "Saques de puerta", kickoffs: "Saques de centro", offsides: "Fueras de juego", carries: "Conducciones", touches: "Controles", cornersTaken: "Córners", possessionsSeconds: "Segundos de posesión", recordedActions: "Acciones registradas" };
function computeTechnicalAnalysis(matches: readonly ClubMatch[]) {
  matches = matches.filter(isVisibleMatch);
  const events = matches.flatMap(m => technicalEvents(m).map(e => ({ ...e, id: `${m.id}__${e.id}` })));
  const result = analyseActions(events);
  return { ...result, events, games: matches.length, complete: matches.filter(m => m.analysisCoverage === "complete").length, unknownTime: events.filter(e => e.timingUnknown).length };
}
/** The narrated actions of these matches, added up (kept by matches: lib/remember; read only). */
export const technicalAnalysis = remember(computeTechnicalAnalysis);
/** Who took a shot, as the shot map says it: a guest is «Rafa (invitado)» (plain text, no ficha). */
export function shooterName(e: AnalysisEvent, matchOf: (eventId: string) => ClubMatch | undefined, memberName: (id: string) => string): string {
  if (!e.playerId) return eventSide(e) === "opponent" ? "El rival" : "El Piti";
  return isGuestId(e.playerId) ? guestLabel(matchOf(e.id) ?? {}, e.playerId) : memberName(e.playerId);
}
export function technicalForPlayer(id: string, matches: readonly ClubMatch[]) { return technicalAnalysis(matches).players[id] ?? emptyTechnical(); }
export const pct = (n: number, d: number) => { const v = ratio(n, d); return v == null ? "—" : `${v.toFixed(1).replace(".", ",")}%`; };

/**
 * Whether the analysis panel has anything to show: some narrated football action (a pass, a shot, a
 * tackle… — goals, cards and subs alone are the acta, not an analysis). With `playerId`, one of his own:
 * an action he made or a pass he received.
 */
export function hasAnalysisActions(matches: readonly ClubMatch[], playerId?: string): boolean {
  return matches.filter(isVisibleMatch).some((m) =>
    technicalEvents(m).some((e) => isAnalysisAction(e.type) && (!playerId || e.playerId === playerId || e.receiverId === playerId)),
  );
}

/** Coverage is an explicit acta declaration; an empty event array never implies a real zero. */
export function analysisCoverage(matches: readonly ClubMatch[]) {
  matches = matches.filter(isVisibleMatch);
  const rows = matches.map(match => {
    const actions = analyseActions(technicalEvents(match));
    const recorded = actions.teams.us.recordedActions + actions.teams.opponent.recordedActions;
    return { match, recorded, state: match.analysisCoverage === 'complete' ? 'complete' as const : recorded > 0 || match.analysisCoverage === 'partial' ? 'partial' as const : 'none' as const };
  });
  const complete = rows.filter(r=>r.state==='complete').length;
  const partial = rows.filter(r=>r.state==='partial').length;
  const events = matches.flatMap(m=>technicalEvents(m));
  const unassigned = events.filter(e=>eventSide(e)==='us' && !e.playerId && ((isAnalysisAction(e.type) && e.type!=='possession') || ['goal','goal_penalty','goal_freekick','chance','corner'].includes(e.type))).length;
  const uncertain = new Set<keyof TechnicalStats>();
  for (const e of events) {
    if (e.outcome && e.outcome!=='unknown') continue;
    if (e.type==='pass' || e.type==='cross') for(const k of ['passesCompleted','passesFailed','longPassesCompleted','crossesCompleted'] as const) uncertain.add(k);
    if (e.type==='shot') for(const k of ['shotsOnTarget','shotsOffTarget','shotsBlocked','shotsWoodwork'] as const) uncertain.add(k);
    if (e.type==='tackle') uncertain.add('tacklesWon');
    if (e.type==='dribble') uncertain.add('dribblesWon');
    if (e.type==='duel') uncertain.add('duelsWon');
    if (e.type==='aerial_duel') uncertain.add('aerialDuelsWon');
  }
  return { rows, complete, partial, none:rows.length-complete-partial, zeroKnown:rows.length > 0 && complete === rows.length, unassigned, uncertain };
}
export const recordedValue = (n: number, zeroKnown: boolean): string => n === 0 && !zeroKnown ? '—' : String(n);
