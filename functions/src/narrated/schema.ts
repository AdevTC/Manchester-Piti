import { NARRATION_CARD_SUBTYPES } from './contract.js';
import { legacyObservations, rawObservations, unsafeAggregateIds } from './observations.js';
import { factsProblem } from './facts.js';
import { z } from 'zod';
import { OBSERVATION_KINDS, type NarratedAnalysis } from './types.js';
import type { MatchEvent } from '../matchEngine.js';

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const player = z.string().min(1).max(128).regex(/^(?:[A-Za-z0-9_-]+|guest:g[1-4])$/);
const second = z.number().finite().min(0).max(9000);
const key = z.string().max(64).regex(/^[A-Za-z][A-Za-z0-9_]*$/).refine(v => !/quote|transcript|sourceRef|__proto__|constructor|prototype/i.test(v), 'Las citas de origen son privadas.');
const fact = z.union([z.string().max(100), z.number().finite().min(-1000000).max(1000000), z.boolean()]);
const team = z.enum(['us', 'opponent']);
const control = z.enum(['us', 'opponent', 'disputed', 'out', 'unknown']);
const origin = z.strictObject({ kind: z.enum(['explicit', 'deduced', 'judgement', 'unknown']), sourceId: id.optional(), rule: id.optional() });
const facts = z.record(key, fact).refine(v => Object.keys(v).length <= 60, 'Demasiados datos en una observación.');
export const observationSchema = z.strictObject({
  id, kind: z.enum(OBSERVATION_KINDS), team, actorId: player.optional(), intendedReceiverId: player.optional(), receiverId: player.optional(), opponentId: id.optional(), canonicalEventId: id.optional(),
  order: z.number().int().min(0).max(100000), period: z.number().int().min(1).max(8).optional(),
  time: z.strictObject({ from: second, to: second, precision: z.enum(['exact', 'interval', 'approximate']) }).refine(t => t.to >= t.from && (t.precision !== 'exact' || t.from === t.to), 'El intervalo de juego no es válido.').optional(),
  validity: z.enum(['valid', 'void', 'pending']).optional(), quantity: z.number().int().min(1).max(10000).optional(),
  aggregate: z.strictObject({ kind: z.enum(OBSERVATION_KINDS).exclude(['aggregate','goal','substitution']), scopeId: id, reconciled: z.boolean() }).optional(),
  controlBefore: control.optional(), controlAfter: control.optional(), lastControlledTeam: team.optional(),
  links: z.strictObject({ action: id.optional(), pass: id.optional(), shot: id.optional(), duel: id.optional(), possession: id.optional(), attack: id.optional(), restart: id.optional(), chain: id.optional(), cause: id.optional(), loss: id.optional(), followup: id.optional() }).optional(),
  facts, provenance: z.record(key, origin).refine(v => Object.keys(v).length <= 80).optional(),
}).superRefine((o, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const factIssue = factsProblem(o.facts, o.aggregate?.kind ?? o.kind); if (factIssue) fail(factIssue);
  if ((o.kind === 'aggregate') !== !!o.aggregate) fail('Un agregado necesita su clase y ámbito propios.');
  if (o.kind === 'aggregate' && (!o.quantity || o.canonicalEventId || !o.time)) fail('Un agregado necesita cantidad e intervalo y no sustituye una jugada del acta.');
  if (o.aggregate?.kind === 'discipline' && NARRATION_CARD_SUBTYPES.includes(String(o.facts.subtype))) fail('Las tarjetas se desglosan individualmente en el acta; no se agregan.');
  if (o.kind !== 'aggregate' && o.quantity != null && o.quantity !== 1) fail('Las cantidades múltiples necesitan un agregado.');
  if (o.receiverId && o.receiverId === o.actorId) fail('Autor y receptor deben ser distintos.');
  if (o.team === 'opponent' && (o.actorId || o.receiverId || o.intendedReceiverId)) fail('Los jugadores rivales se identifican con opponentId, no con ids de la plantilla.');
  if ((o.facts.defenderId != null || o.facts.opponentReceiverId != null) && o.team !== 'opponent') fail('Las identidades rivales sólo se usan en acciones del rival.');
  if (o.facts.defenderId != null && o.kind !== 'dribble') fail('El defensor superado se identifica en el regate rival.');
  if (o.facts.outcome === 'failed' && o.receiverId) fail('Un pase fallado puede indicar el destinatario previsto; no un receptor confirmado.');
  for (const [field, p] of Object.entries(o.provenance ?? {})) {
    if (!(field in o.facts) && !['actorId','receiverId','intendedReceiverId','time','team','kind','controlBefore','controlAfter','lastControlledTeam','quantity'].includes(field)) fail(`La procedencia ${field} no corresponde a un dato presente.`);
    if (p.kind === 'deduced' && !p.rule) fail(`La deducción ${field} necesita una regla.`);
  }
});
export const narratedAnalysisSchema = z.strictObject({
  version: z.literal(2), revision: z.number().int().min(0),
  profile: z.strictObject({
    id, version: z.number().int().min(1), playersPerSide: z.number().int().min(1).max(11), periodMinutes: z.array(z.number().finite().positive().max(150)).min(1).max(8), baseMinutes: z.number().finite().positive().max(150),
    passes: z.strictObject({ crosses: z.boolean(), restarts: z.boolean(), throwIns: z.boolean(), keeperHands: z.boolean(), deflection: z.enum(['fail','retain']) }),
    parameters: z.record(key, z.union([z.string().max(4000), z.number().finite().min(-1000000).max(1000000), z.boolean(), z.array(z.string().max(80)).max(100)])).refine(v => Object.keys(v).length <= 60),
  }),
  observations: z.array(observationSchema).max(4000),
  coverage: z.array(z.strictObject({ family: z.string().min(1).max(100), team, state: z.enum(['complete','partial','unknown']), from: second.optional(), to: second.optional() }).refine(c => (c.from == null) === (c.to == null) && (c.to == null || c.to >= c.from!), 'La cobertura necesita ambos extremos del intervalo.')).max(300),
  issues: z.array(z.strictObject({ id, message: z.string().min(1).max(400), eventIds: z.array(id).max(100), resolved: z.string().max(400).optional() })).max(100).optional(),
});

export const narrationSourceSchema = z.strictObject({ id, quote: z.string().min(1).max(1000), audioFrom: z.number().finite().min(0).max(86400).optional(), audioTo: z.number().finite().min(0).max(86400).optional() }).refine(s => s.audioTo == null || (s.audioFrom != null && s.audioTo >= s.audioFrom), 'El intervalo de audio no es válido.');
export type NarrationSource = z.infer<typeof narrationSourceSchema>;
export const narrationSourcesSchema = z.array(narrationSourceSchema).max(1000).refine(s => new Set(s.map(x => x.id)).size === s.length, 'Hay fuentes repetidas.').refine(s => new TextEncoder().encode(JSON.stringify(s)).byteLength <= 150000, 'Las fuentes superan 150 KB.');

const canonicalKind = (e: MatchEvent): string => {
  if (['goal','goal_penalty','goal_freekick','opponent_goal','own_goal','opponent_own_goal'].includes(e.type)) return 'goal';
  if (e.type === 'substitution') return 'substitution';
  if (['yellow_card','double_yellow','red_card','opponent_yellow','opponent_red','opponent_foul','opponent_offside','foul','foul_received','offside','penalty_committed','penalty_received'].includes(e.type)) return 'discipline';
  if (['corner','opponent_corner','throw_in','goal_kick','kickoff'].includes(e.type)) return 'restart';
  if (['woodwork','opponent_woodwork','penalty_missed','opponent_penalty_missed'].includes(e.type)) return 'shot';
  if (e.type === 'possession_lost') return 'loss';
  if (e.type === 'cross') return 'pass';
  if (e.type === 'aerial_duel') return 'duel';
  if (e.type === 'penalty_saved') return 'save';
  if (e.type === 'chance' || e.type === 'opponent_chance') return 'context';
  if (e.type === 'touch') return 'reception';
  if (e.type === 'possession') return 'control';
  return e.type;
};
/** Referential checks are shared by preview and the server; unknown evidence remains unknown. */
export function analysisProblem(analysis: NarratedAnalysis | undefined, events: MatchEvent[], roster: string[], duration: number): string | null {
  if (!analysis) return null;
  const parsed = narratedAnalysisSchema.safeParse(analysis);
  if (!parsed.success) return parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).slice(0, 6).join(' ');
  const unsafe = unsafeAggregateIds(rawObservations({ id: 'validation', events, analysis }));
  if (unsafe.size) return `El agregado ${[...unsafe][0]} se solapa con otras acciones o no tiene un intervalo verificable. Déjalo sin conciliar o corrige su ámbito.`;
  const eventMap = new Map(events.map(e => [e.id, e]));
  const ids = new Set<string>(); const canonical = new Set<string>(); const scopes = new Set<string>(); const players = new Set(roster);
  for (const o of analysis.observations) {
    if (ids.has(o.id)) return `Observación repetida: ${o.id}.`; ids.add(o.id);
    if ([o.actorId,o.receiverId,o.intendedReceiverId].some(p => p && !players.has(p))) return `${o.id}: jugador ajeno a la convocatoria.`;
    if (Number(o.facts.intervalStart ?? 0) > duration || Number(o.facts.intervalEnd ?? 0) > duration || Number(o.facts.durationSeconds ?? 0) > duration) return `${o.id}: el intervalo de hechos supera la duración del partido.`;
    if (o.time && o.time.to > duration) return `${o.id}: el tiempo supera la duración del partido.`;
    if (['assistPlayerId','inPlayerId','keeperId','defenderId'].some(k => typeof o.facts[k] === 'string' && !players.has(String(o.facts[k])))) return `${o.id}: referencia de jugador desconocida en los hechos.`;
    if (o.period && o.period > analysis.profile.periodMinutes.length) return `${o.id}: parte no definida en el perfil.`;
    if ((o.kind === 'goal' || o.kind === 'substitution' || o.facts.goal === true || o.kind === 'discipline' && NARRATION_CARD_SUBTYPES.includes(String(o.facts.subtype))) && o.validity !== 'void' && !o.canonicalEventId) return `${o.id}: goles, cambios y tarjetas necesitan su evento del acta.`;
    if (o.canonicalEventId) {
      const e = eventMap.get(o.canonicalEventId);
      if (!e && o.validity === 'void') continue;
      if (!e || canonical.has(o.canonicalEventId)) return `${o.id}: referencia al acta inexistente o duplicada.`;
      canonical.add(o.canonicalEventId);
      const baseFacts = legacyObservations({ id: 'validation', events: [e] })[0]?.facts ?? {};
      for (const key of ['goal','ownGoal','assistReviewed','inPlayerId','subtype'] as const) if (o.facts[key] != null && baseFacts[key] != null && o.facts[key] !== baseFacts[key]) return `${o.id}: ${key} contradice la jugada del acta.`;
      const legacyOutcome = e.outcome === 'incomplete' ? 'failed' : e.outcome === 'unknown' ? 'pending' : e.outcome;
      if (o.facts.outcome && legacyOutcome && o.facts.outcome !== legacyOutcome && !(legacyOutcome === 'complete' && ['completed','success'].includes(String(o.facts.outcome)))) return `${o.id}: el resultado contradice la jugada del acta.`;
      if (o.receiverId && e.receiverId && o.receiverId !== e.receiverId) return `${o.id}: el receptor contradice el acta.`;
      if (o.facts.assistPlayerId && e.assistPlayerId && o.facts.assistPlayerId !== e.assistPlayerId) return `${o.id}: el asistente contradice el acta.`;
      if (o.time && e.elapsedSeconds != null && (e.elapsedSeconds < o.time.from || e.elapsedSeconds > o.time.to)) return `${o.id}: el tiempo contradice la jugada del acta.`;
      if (o.time && e.elapsedSeconds == null && e.minute != null && (o.time.to < e.minute * 60 || o.time.from >= (e.minute + 1) * 60)) return `${o.id}: el minuto contradice la jugada del acta.`;
      if (canonicalKind(e) !== o.kind) return `${o.id}: la clase no coincide con la jugada del acta.`;
      const side = e.team ?? (e.type.startsWith('opponent_') ? 'opponent' : 'us');
      if (o.team !== side || (o.actorId && e.playerId && o.actorId !== e.playerId)) return `${o.id}: el equipo o autor contradice el acta.`;
      if (o.validity === 'void' && ['goal','substitution','discipline'].includes(o.kind)) return `${o.id}: corrige también el acta para anular esta acción.`;
    }
    if (o.aggregate) { const scope = `${o.team}/${o.aggregate.kind}/${o.aggregate.scopeId}`; if (scopes.has(scope)) return `${o.id}: ámbito agregado repetido.`; scopes.add(scope); }
  }
  const known = new Set([...ids, ...eventMap.keys()]);
  for (const issue of analysis.issues ?? []) if (issue.eventIds.some(id => !known.has(id))) return `${issue.id}: duda vinculada a una acción inexistente.`;
  if (new Set((analysis.issues ?? []).map(i => i.id)).size !== (analysis.issues ?? []).length) return 'Hay dudas con identificadores repetidos.';
  for (const issue of analysis.issues ?? []) if (!issue.resolved?.trim() && analysis.observations.some(o => (issue.eventIds.includes(o.id) || !!o.canonicalEventId && issue.eventIds.includes(o.canonicalEventId)) && o.validity !== 'pending' && o.validity !== 'void')) return `${issue.id}: marca pendientes las observaciones afectadas por la duda.`;
  for (const c of analysis.coverage) if (c.to != null && c.to > duration) return 'La cobertura supera la duración del partido.';
  return null;
}
