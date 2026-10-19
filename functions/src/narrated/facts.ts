import { NARRATION_ENUMS } from './contract.js';
import { NARRATED_FACT_KEYS_001_200 } from './recipes001_200.js';
import { NARRATED_FACT_KEYS_201_400 } from './recipes201_400.js';
import type { Fact, ObservationKind } from './types.js';

const strings = new Set(['outcome','subtype','bodyPart','zone','direction','distanceBand','height','phase','interventionId','role','destinationZone','stage','cause','buildUpOutcome','state','lane','firstContactTeam','delivery','endZone','progressZone','formation','block','scale','keeperId','firstControl','assistPlayerId','inPlayerId','legacyType','restart','defenderId','opponentReceiverId']);
const numbers = new Set(['intervalStart','intervalEnd','ownCount','opponentCount','opponentsBypassed','durationSeconds','touchCount','continuousControlSeconds','playersBehindBall','localOwn','localOpponent','value','activityMinutes']);
export const NARRATED_FACT_TYPES: Readonly<Record<string, 'string' | 'number' | 'boolean'>> = Object.fromEntries([...new Set([...NARRATED_FACT_KEYS_001_200,...NARRATED_FACT_KEYS_201_400,'inPlayerId','legacyType','keyPass','chance','restart','defenderId','opponentReceiverId'])].map(k => [k, strings.has(k) ? 'string' : numbers.has(k) ? 'number' : 'boolean']));
/** No string truthiness or arbitrary metric names: the vocabulary is the same one the reducers consume. */
export function factsProblem(facts: Record<string, Fact>, kind: ObservationKind): string | null {
  for (const [key,value] of Object.entries(facts)) {
    if (!NARRATED_FACT_TYPES[key]) return `Dato desconocido: ${key}. Revisa el prompt y su versión.`;
    if (typeof value !== NARRATED_FACT_TYPES[key]) return `${key} debe ser ${NARRATED_FACT_TYPES[key]}.`;
    if (NARRATION_ENUMS[key] && !NARRATION_ENUMS[key].includes(String(value))) return `${key} contiene una opción no reconocida.`;
    if (typeof value === 'number' && (value < 0 || (['intervalStart','intervalEnd','durationSeconds','continuousControlSeconds'].includes(key) && value > 9000))) return `${key} está fuera del intervalo permitido.`;
    if (['ownCount','opponentCount','playersBehindBall','localOwn','localOpponent'].includes(key) && (Number(value) > 11 || !Number.isInteger(value))) return `${key} debe ser un número de jugadores entre 0 y 11.`;
  }
  if ((facts.intervalStart == null) !== (facts.intervalEnd == null) || Number(facts.intervalEnd) < Number(facts.intervalStart)) return 'El intervalo necesita inicio y final ordenados.';
  if (facts.goal === true && !['goal','shot'].includes(kind)) return 'Un gol necesita una acción de gol o remate.';
  if (facts.assistPlayerId != null && kind !== 'goal') return 'La asistencia se vincula a un gol.';
  if (facts.inPlayerId != null && kind !== 'substitution') return 'El jugador que entra se vincula al cambio.';
  if (facts.keyPass === true && kind !== 'pass') return 'El pase clave se vincula a un pase.';
  if (facts.onTarget === true && facts.outcome === 'off_target') return 'Un remate fuera no puede estar a puerta.';
  if (facts.ownGoal === true && facts.goal === false) return 'Un autogol no puede declararse sin gol.';
  return null;
}
