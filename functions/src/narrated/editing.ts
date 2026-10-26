import { eventSchema } from '../eventSchema.js';
import { actionProblem } from '../matchAnalysis.js';
import { clockReading, type MatchClock } from '../matchClock.js';
import type { EventType, MatchEvent } from '../matchEngine.js';
import { legacyObservations } from './observations.js';
import { DEFAULT_ANALYSIS_PROFILE, type NarratedAnalysis, type Observation } from './types.js';
import { NARRATION_CARD_SUBTYPES } from './contract.js';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const compact = <T>(value: T): T => Object.fromEntries(Object.entries(value as object).filter(([, v]) => v !== undefined)) as T;
const baseObservation = (event: MatchEvent) => legacyObservations({ id: 'editing', events: [{ ...event, dupOk: true }] })[0];
const factFields: Partial<Record<keyof MatchEvent, string[]>> = {
  outcome: ['outcome', 'onTarget', 'woodwork'], assistPlayerId: ['assistPlayerId'], assistReviewed: ['assistReviewed'],
  inPlayerId: ['inPlayerId'], bodyPart: ['bodyPart'], zone: ['lane'], delivery: ['distanceBand', 'subtype'],
  keyPass: ['keyPass'], possessionSeconds: ['durationSeconds'],
};

/** Moving an action across the real whistle moves its period too. Never assume a planned 25 minutes. */
export function reconcileEventPeriods(before: readonly MatchEvent[], after: MatchEvent[], analysis?: NarratedAnalysis, clock?: MatchClock): MatchEvent[] {
  const old = new Map(before.map(e => [e.id, e]));
  const first = clock?.firstStartedAt != null && clock.firstEndedAt != null ? clockReading(clock, clock.endedAt ?? clock.firstEndedAt).firstSeconds : null;
  return after.map(e => {
    const previous = old.get(e.id);
    if (!previous || previous.period !== e.period || previous.minute === e.minute && previous.elapsedSeconds === e.elapsedSeconds || e.timingUnknown || e.minute == null) return e;
    const from = e.elapsedSeconds ?? e.minute * 60, to = e.elapsedSeconds ?? e.minute * 60 + 59.999;
    let period: number | undefined;
    if (first != null) period = to < first ? 1 : from > first ? 2 : from === to && from === first ? e.period : undefined;
    else {
      const contexts = analysis?.observations.filter(o => o.kind === 'context' && o.period && o.validity !== 'void' && o.validity !== 'pending' && typeof o.facts.intervalStart === 'number' && typeof o.facts.intervalEnd === 'number') ?? [];
      if (!contexts.length) return e;
      period = contexts.find(o => from >= Number(o.facts.intervalStart) && to < Number(o.facts.intervalEnd))?.period;
    }
    return compact({ ...e, period: period as 1 | 2 | undefined });
  });
}

/** Canonical acta edits also update their enrichment. Unrelated narrated facts and stable ids survive.
 * Removed actions retain a void observation as an audit trail; they cannot reappear in statistics. */
export function synchronizeCanonicalAnalysis(analysis: NarratedAnalysis | undefined, before: readonly MatchEvent[], after: readonly MatchEvent[], durationSeconds = 9000): NarratedAnalysis | undefined {
  if (!analysis) return undefined;
  const was = new Map(before.map(e => [e.id, e]));
  const now = new Map(after.map(e => [e.id, e]));
  const removed = new Map<string, string>();
  let changed = false;
  const observations = analysis.observations.map(o => {
    if (!o.canonicalEventId) return o;
    const previous = was.get(o.canonicalEventId), event = now.get(o.canonicalEventId);
    if (!event) {
      if (previous) removed.set(previous.id, o.id);
      if (!previous || o.validity === 'void') return o;
      changed = true;
      return { ...o, validity: 'void' as const };
    }
    if (previous && equal(previous, event)) return o;
    const base = baseObservation(event);
    const typeChanged = !previous || previous.type !== event.type;
    const next: Observation = { ...o, facts: { ...o.facts }, ...(o.provenance ? { provenance: { ...o.provenance } } : {}) };
    const touched = new Set<string>();
    const set = (key: 'kind' | 'team' | 'actorId' | 'receiverId' | 'period' | 'time', value: unknown) => {
      if (!equal(next[key], value)) touched.add(key);
      Object.assign(next, { [key]: value });
    };
    if (typeChanged) {
      set('kind', base.kind);
      for (const key of previous ? Object.keys(baseObservation(previous).facts) : []) delete next.facts[key];
      if (base.kind !== 'goal') { delete next.facts.assistPlayerId; delete next.facts.assistReviewed; }
      if (base.kind !== 'substitution') delete next.facts.inPlayerId;
      if (base.kind !== 'pass') delete next.facts.keyPass;
      if (base.kind !== 'goal' && base.kind !== 'shot') delete next.facts.goal;
      for (const [key, value] of Object.entries(base.facts)) if (key !== 'throughBall') next.facts[key] = value;
      for (const key of new Set([...Object.keys(o.facts), ...Object.keys(next.facts)])) if (!equal(o.facts[key], next.facts[key])) touched.add(key);
    } else {
      for (const [field, keys] of Object.entries(factFields)) if (!equal(previous[field as keyof MatchEvent], event[field as keyof MatchEvent])) {
        for (const key of keys) {
          if (base.facts[key] === undefined) delete next.facts[key]; else next.facts[key] = base.facts[key];
          if (!equal(o.facts[key], next.facts[key])) touched.add(key);
        }
      }
    }
    if (typeChanged || previous?.team !== event.team) set('team', base.team);
    if (typeChanged || previous?.playerId !== event.playerId) set('actorId', base.actorId);
    if (typeChanged || previous?.receiverId !== event.receiverId) {
      set('receiverId', base.receiverId);
      if (base.receiverId || next.intendedReceiverId === o.receiverId) next.intendedReceiverId = base.receiverId;
    }
    const timeChanged = !previous || previous.minute !== event.minute || previous.elapsedSeconds !== event.elapsedSeconds || previous.timingUnknown !== event.timingUnknown;
    if (timeChanged) set('time', base.time ? { ...base.time, to: Math.min(base.time.to, Math.max(base.time.from, durationSeconds)) } : undefined);
    if (!previous || previous.period !== event.period) set('period', base.period);
    else if (timeChanged && base.time) {
      const context = analysis.observations.find(c => c.kind === 'context' && c.validity !== 'void' && c.validity !== 'pending' && c.period && typeof c.facts.intervalStart === 'number' && typeof c.facts.intervalEnd === 'number' && base.time!.from >= c.facts.intervalStart && base.time!.to < c.facts.intervalEnd);
      if (context) set('period', context.period);
    }
    if (next.team === 'opponent') { delete next.actorId; delete next.receiverId; delete next.intendedReceiverId; }
    if (next.team === 'us') delete next.opponentId;
    if (!previous && o.validity === 'void') next.validity = 'valid';
    for (const key of touched) if (key in next.facts || ['actorId', 'receiverId', 'time', 'team', 'kind'].includes(key)) (next.provenance ??= {})[key] = { kind: 'explicit', rule: 'manual-correction' };
    if (next.provenance) for (const key of Object.keys(next.provenance)) {
      if (touched.has(key)) next.provenance[key] = { kind: 'explicit', rule: 'manual-correction' };
      if (!(key in next.facts) && !['actorId', 'receiverId', 'intendedReceiverId', 'opponentId', 'time', 'team', 'kind', 'controlBefore', 'controlAfter', 'quantity'].includes(key)) delete next.provenance[key];
    }
    const clean = compact(next);
    if (equal(o, clean)) return o;
    changed = true;
    return clean;
  });
  const issues = analysis.issues?.map(issue => ({ ...issue, eventIds: issue.eventIds.map(id => removed.get(id) ?? id) }));
  return changed ? { ...analysis, observations, ...(issues ? { issues } : {}) } : analysis;
}

function canonicalType(o: Observation, previous: MatchEvent): EventType {
  const base = baseObservation(previous);
  if (o.kind === base.kind && o.facts.subtype === base.facts.subtype && o.facts.penalty === base.facts.penalty && o.facts.directFreekick === base.facts.directFreekick && o.facts.ownGoal === base.facts.ownGoal && o.team === base.team) return previous.type;
  if (o.kind === 'goal') return o.facts.ownGoal ? o.team === 'us' ? 'own_goal' : 'opponent_own_goal' : o.team === 'opponent' ? 'opponent_goal' : o.facts.penalty ? 'goal_penalty' : o.facts.directFreekick ? 'goal_freekick' : 'goal';
  if (o.kind === 'discipline' || o.kind === 'restart') {
    const rawSubtype = String(o.facts.subtype ?? '');
    const subtype = ({ yellow: 'yellow_card', second_yellow: 'double_yellow', red: 'red_card', opponent_yellow: 'yellow_card', opponent_red: 'red_card' } as Record<string, string>)[rawSubtype] ?? rawSubtype;
    const opposing: Record<string, EventType> = { corner: 'opponent_corner', foul: 'opponent_foul', yellow_card: 'opponent_yellow', red_card: 'opponent_red', offside: 'opponent_offside' };
    if (o.team === 'opponent' && opposing[subtype]) return opposing[subtype];
    if (['yellow_card', 'double_yellow', 'red_card', 'foul', 'offside', 'penalty_committed', 'penalty_received', 'corner', 'throw_in', 'goal_kick', 'kickoff'].includes(subtype)) return subtype as EventType;
  }
  if (o.kind === 'pass') return o.facts.subtype === 'cross' ? 'cross' : 'pass';
  if (o.kind === 'duel') return o.facts.subtype === 'aerial' ? 'aerial_duel' : 'duel';
  if (o.kind === 'save') return o.facts.penalty ? 'penalty_saved' : 'save';
  const mapping: Partial<Record<Observation['kind'], EventType>> = { substitution: 'substitution', control: 'possession', reception: 'touch', loss: 'possession_lost', carry: 'carry', shot: 'shot', recovery: 'recovery', interception: 'interception', clearance: 'clearance', block: 'block', dribble: 'dribble', tackle: 'tackle' };
  const type = mapping[o.kind];
  if (!type) throw new Error('Este detalle no corresponde a una acción editable del acta. Conserva su tipo o anula la acción y añade el detalle por separado.');
  return type;
}

/** A detail editor changes both representations atomically. Never silently relink a different action. */
export function editNarratedObservation<T extends { events: MatchEvent[]; analysis?: NarratedAnalysis; durationSeconds?: number; duration?: number; clock?: MatchClock }>(sheet: T, observation: Observation): T {
  const old = sheet.analysis?.observations.find(o => o.id === observation.id);
  if (!old || !sheet.analysis) throw new Error('Esta observación ya no está en el acta. Recarga antes de editar.');
  if (old.canonicalEventId !== observation.canonicalEventId) throw new Error('Conserva el vínculo con la acción original del acta.');
  let events = sheet.events;
  const changedFactKeys = Object.keys({ ...old.facts, ...observation.facts }).filter(key => !equal(old.facts[key], observation.facts[key]));
  const changedKeys = ['actorId', 'receiverId', 'intendedReceiverId', 'opponentId', 'time', 'team', 'kind', 'controlBefore', 'controlAfter', 'quantity'].filter(key => !equal(old[key as keyof Observation], observation[key as keyof Observation]));
  observation = { ...observation, ...(observation.provenance ? { provenance: { ...observation.provenance } } : {}) };
  for (const key of [...changedKeys, ...changedFactKeys]) if (key in observation.facts || changedKeys.includes(key)) (observation.provenance ??= {})[key] = { kind: 'explicit', rule: 'manual-correction' };
  if (observation.canonicalEventId) {
    const existing = events.find(e => e.id === observation.canonicalEventId);
    const canonicalChange = changedKeys.some(k => ['actorId', 'receiverId', 'time', 'team', 'kind'].includes(k)) || old.period !== observation.period || changedFactKeys.some(k => ['subtype', 'penalty', 'directFreekick', 'ownGoal', 'assistPlayerId', 'assistReviewed', 'inPlayerId', 'bodyPart', 'lane', 'keyPass', 'durationSeconds', 'distanceBand', 'outcome'].includes(k));
    if (observation.validity === 'pending' && (canonicalChange || !existing)) throw new Error('Confirma la corrección antes de cambiar la acción del acta. Un detalle pendiente no modifica sus goles, tarjetas ni minutos.');
    if (observation.validity === 'void') events = events.filter(e => e.id !== observation.canonicalEventId);
    else if (existing || canonicalChange || old.validity === 'void') {
      if (!existing && old.validity !== 'void') throw new Error('Falta la acción vinculada. Carga el contexto del acta antes de corregir este detalle.');
      const previous = existing ?? { id: observation.canonicalEventId, type: String(old.facts.legacyType ?? old.kind) as EventType };
      const next = { ...previous };
      const typeChanged = old.kind !== observation.kind || ['subtype', 'penalty', 'directFreekick', 'ownGoal'].some(k => old.facts[k] !== observation.facts[k]) || old.team !== observation.team;
      if (typeChanged || !existing) next.type = canonicalType(observation, previous);
      if (old.actorId !== observation.actorId || !existing) next.playerId = observation.actorId;
      if (old.team !== observation.team || !existing) next.team = observation.team;
      if (old.receiverId !== observation.receiverId || !existing) next.receiverId = observation.receiverId;
      if (old.period !== observation.period || !existing) next.period = observation.period as 1 | 2 | undefined;
      if (!equal(old.time, observation.time) || !existing) {
        const t = observation.time;
        if (t && t.precision === 'exact' && Number.isInteger(t.from)) { next.minute = Math.floor(t.from / 60); next.elapsedSeconds = t.from; delete next.timingUnknown; }
        else if (t && t.precision === 'interval' && Math.floor(t.from / 60) === Math.floor(t.to / 60)) { next.minute = Math.floor(t.from / 60); delete next.elapsedSeconds; delete next.timingUnknown; }
        else if (!t) { delete next.minute; delete next.elapsedSeconds; next.timingUnknown = true; }
        else throw new Error('La acción vinculada necesita un segundo exacto o un intervalo dentro de un mismo minuto. No se asignará una hora inventada.');
      }
      const fields: Record<string, keyof MatchEvent> = { assistPlayerId: 'assistPlayerId', assistReviewed: 'assistReviewed', inPlayerId: 'inPlayerId', bodyPart: 'bodyPart', lane: 'zone', keyPass: 'keyPass', durationSeconds: 'possessionSeconds', distanceBand: 'delivery' };
      for (const [fact, field] of Object.entries(fields)) if (!equal(old.facts[fact], observation.facts[fact]) || !existing) Object.assign(next, { [field]: observation.facts[fact] });
      if (old.facts.outcome !== observation.facts.outcome || !existing) {
        const result = observation.facts.outcome;
        const outcome = result === 'failed' ? 'incomplete' : result === 'pending' ? 'unknown' : result;
        if (outcome !== 'goal') Object.assign(next, { outcome });
      }
      if (next.type !== 'substitution' && next.type !== 'position_swap') delete next.inPlayerId;
      if (!['goal', 'goal_penalty', 'goal_freekick'].includes(next.type)) { delete next.assistPlayerId; delete next.assistReviewed; }
      if (observation.team === 'opponent') { delete next.playerId; delete next.receiverId; }
      if (typeChanged && observation.kind !== 'pass' && observation.kind !== 'restart') { delete next.receiverId; delete next.keyPass; delete next.delivery; }
      if (typeChanged && observation.kind !== 'control') delete next.possessionSeconds;
      if (typeChanged && observation.kind === 'goal') delete next.outcome;
      const parsed = eventSchema.safeParse(compact(next));
      if (!parsed.success) throw new Error(parsed.error.issues.map(i => i.message).join(' '));
      const problem = actionProblem(parsed.data);
      if (problem) throw new Error(problem);
      events = existing ? events.map(e => e.id === parsed.data.id ? parsed.data : e) : [...events, parsed.data];
    }
  }
  events = reconcileEventPeriods(sheet.events, events, sheet.analysis, sheet.clock);
  const linked = events.find(e => e.id === observation.canonicalEventId);
  if (linked && observation.kind === 'discipline' && NARRATION_CARD_SUBTYPES.includes(String(observation.facts.subtype))) observation = { ...observation, facts: { ...observation.facts, subtype: baseObservation(linked).facts.subtype } };
  if (linked && linked.period !== sheet.events.find(e => e.id === linked.id)?.period && old.period === observation.period) observation = compact({ ...observation, period: linked.period });
  const analysis = synchronizeCanonicalAnalysis(sheet.analysis, sheet.events, events, sheet.durationSeconds ?? (sheet.duration ?? 150) * 60)!;
  return { ...sheet, events, analysis: { ...analysis, observations: analysis.observations.map(o => o.id === observation.id ? observation : o) } };
}

type EditableAnalysis = { events: MatchEvent[]; analysis?: NarratedAnalysis; durationSeconds?: number; duration?: number; clock?: MatchClock };
export const emptyNarratedAnalysis = (): NarratedAnalysis => ({ version: 2, revision: 0, profile: structuredClone(DEFAULT_ANALYSIS_PROFILE), observations: [], coverage: [] });

/** New goals, substitutions and cards must also exist in the acta that drives score and minutes. */
export function addNarratedObservation<T extends EditableAnalysis>(sheet: T, observation: Observation): T {
  const analysis = sheet.analysis ?? emptyNarratedAnalysis();
  if (analysis.observations.some(o => o.id === observation.id)) throw new Error('Ese identificador ya existe. Edita la observación o utiliza otro para añadirla.');
  if (analysis.observations.length >= 4000) throw new Error('El análisis admite hasta 4000 observaciones.');
  if (observation.facts.goal === true && observation.kind !== 'goal') throw new Error('Registra el gol como tipo Gol para que también actualice el marcador del acta.');
  const needsCanonical = observation.kind === 'goal' || observation.kind === 'substitution' || observation.kind === 'discipline' && NARRATION_CARD_SUBTYPES.includes(String(observation.facts.subtype));
  if (needsCanonical && !observation.canonicalEventId && observation.validity !== 'void') {
    if (observation.validity === 'pending') throw new Error('Confirma el gol, cambio o tarjeta antes de incorporarlo al acta. Guarda la duda por separado.');
    if (observation.kind === 'substitution' && !observation.facts.inPlayerId) throw new Error('Indica el jugador que entra en el cambio.');
    const id = `n-${observation.id}`;
    if (id.length > 128 || sheet.events.some(e => e.id === id)) throw new Error('El identificador de la acción vinculada no está disponible. Utiliza otro identificador de observación.');
    const linked = { ...observation, canonicalEventId: id };
    return editNarratedObservation({ ...sheet, analysis: { ...analysis, observations: [...analysis.observations, { ...linked, validity: 'void' }] } }, linked);
  }
  return { ...sheet, analysis: { ...analysis, observations: [...analysis.observations, observation] } };
}

/** Removal affects the working acta; immutable publication snapshots retain the original evidence. */
export function removeNarratedObservation<T extends EditableAnalysis>(sheet: T, id: string): T {
  const old = sheet.analysis?.observations.find(o => o.id === id);
  if (!old || !sheet.analysis) return sheet;
  const removed = new Set([id, ...(old.canonicalEventId ? [old.canonicalEventId] : [])]);
  const observations = sheet.analysis.observations.filter(o => o.id !== id).map(o => {
    if (!o.links || !Object.values(o.links).some(value => removed.has(value))) return o;
    const links = Object.fromEntries(Object.entries(o.links).filter(([, value]) => !removed.has(value)));
    return { ...o, links };
  });
  return { ...sheet, events: sheet.events.filter(e => e.id !== old.canonicalEventId), analysis: { ...sheet.analysis, observations, ...(sheet.analysis.issues ? { issues: sheet.analysis.issues.map(q => ({ ...q, eventIds: q.eventIds.filter(ref => !removed.has(ref)) })) } : {}) } };
}
