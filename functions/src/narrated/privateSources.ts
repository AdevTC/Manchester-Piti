import type { MatchEvent, MatchSheet } from '../matchEngine.js';
import type { NarrationSource } from './schema.js';

export function publicNarrationEvents(events: MatchEvent[]): MatchEvent[] {
  return events.map(({ sourceRef: _privateSource, ...event }) => event);
}
/** Source text only lives below matchPrivate, never inside the public match or bundle. */
export function narrationSnapshot(sheet: Pick<MatchSheet, 'events' | 'analysis'>, sources: NarrationSource[] = []) {
  const refs = new Map(sources.map(s => [s.id, s]));
  for (const e of sheet.events) if (e.sourceRef) refs.set(`event-${e.id}`, { id: `event-${e.id}`, quote: e.sourceRef });
  if (!sheet.analysis && !refs.size) return null;
  return { ...(sheet.analysis ? { analysis: sheet.analysis } : {}), events: publicNarrationEvents(sheet.events), sources: [...refs.values()] };
}
