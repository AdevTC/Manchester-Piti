import { NARRATION_ENUMS, NARRATION_SUBTYPES, NARRATION_PARAMETERS } from '../../functions/src/narrated/contract';
import { NARRATED_FACT_TYPES } from '../../functions/src/narrated/facts';
import type { MatchSheet } from '../../functions/src/matchEngine';
import { DEFAULT_ANALYSIS_PROFILE, OBSERVATION_KINDS } from '../../functions/src/narrated/types';
import { NARRATED_METRICS, NARRATED_CATALOG_SOURCE_SHA256 } from '../../functions/src/narrated/catalog';

/** Portable instructions + the real match. Audio stays in the user's external assistant conversation. */
export function narrationPrompt(matchId: string, sheet: MatchSheet, roster: { id: string; name: string; number: number | null }[]) {
  return JSON.stringify({
    format: 'piti-context/v2', matchId, baseRevision: sheet.revision ?? 0,
    rival: sheet.rival, date: sheet.date, duration: sheet.duration, durationSeconds: sheet.durationSeconds,
    clock: sheet.clock, starters: sheet.starters, bench: sheet.bench, notCalled: sheet.notCalled, roster,
    existingEvents: sheet.events.map(({ sourceRef: _privateSource, ...e }) => e), existingAnalysis: sheet.analysis,
    profile: sheet.analysis?.profile ?? DEFAULT_ANALYSIS_PROFILE,
    instructions: 'Interpreta mi narración entregada en este chat; la web no graba, sube ni transcribe audio. Devuelve únicamente JSON piti-actions/v2 para revisar como borrador. Usa exactamente matchId y baseRevision y analysis.revision del contexto (0 si no existe). Conserva identificadores al corregir; una nueva importación con los mismos ids debe ser idempotente. No calcules ni guardes totales: registra hechos, su procedencia y cobertura. No ejecutes publicaciones. El fragmento literal se conserva solo en sources: nunca en facts, notas públicas, issues ni provenance. No inventes hechos, identidades, posiciones, coordenadas, minutos o resultados.',
    contract: {
      format: 'piti-actions/v2', matchId, baseRevision: sheet.revision ?? 0, events: [], sources: [{ id: 'source-1', quote: 'Fragmento literal privado, máximo 1000 caracteres', audioFrom: 12, audioTo: 15 }],
      analysis: { version: 2, revision: sheet.analysis?.revision ?? 0, profile: sheet.analysis?.profile ?? DEFAULT_ANALYSIS_PROFILE, observations: [{ id: 'pass-1', kind: 'pass', team: 'us', order: 1, facts: { outcome: 'complete' }, provenance: { outcome: { kind: 'explicit', sourceId: 'source-1' } } }], coverage: [{ family: '*', team: 'us', state: 'partial' }, { family: '*', team: 'opponent', state: 'partial' }], issues: [] },
    },
    rules: [
      'events es el acta canónica: goles, asistencias, cambios, tarjetas y acciones ya existentes. analysis.observations amplía detalles sin cambiar el enum del acta. Cuando describes una acción ya en events, usa canonicalEventId y una sola observación compatible; no repitas gol como tiro independiente ni centro como otro pase.',
      'El perfil por defecto es fútbol 7, dos partes de 25 minutos; respeta tiempos reales de acta. time.from/time.to son segundos de juego sin descanso. exact exige ambos iguales. Sin reloj fiable, omite time: la marca de audio va solo en sources y nunca se convierte en minuto de partido.',
      'actorId, receiverId e intendedReceiverId son ids del contexto. defenderId identifica al defensa del Piti en un regate rival. opponentReceiverId identifica al receptor rival, nunca a un jugador del Piti. Rivales: team:opponent y opponentId si está identificado. Sin identidad confirmada, omite el campo. Un pase recibido confirma outcome:complete y receiverId. Un pase fallado solo identifica intendedReceiverId si se conoce; no inventa pérdida ni control rival.',
      'controlBefore/controlAfter pueden ser us, opponent, disputed, out, unknown. Una intercepción no asegura recuperación; un desvío, despeje, balón dividido o pase fallado no asegura cambio de posesión. Solo pérdida a control rival cuando se narra ese control. Conserva lastControlledTeam cuando se conoce.',
      'facts son escalares: booleanos reales, números finitos o claves breves documentadas. outcome complete|failed|pending|neutral; bodyPart right|left|head|other; zone own_area|own_third|own_half|middle_third|opponent_half|final_third|opponent_area; direction forward|backward|lateral; distanceBand short|medium|long; height ground|high; phase counterattack|positional|direct|defence|attack. No uses prosa libre para activar reglas.',
      'Atributos independientes como firstTouch, weakFoot, underPressure, progressive y bigChance solo se afirman si se narran o hay una deducción documentada. provenance por campo: kind explicit|deduced|judgement|unknown, sourceId opcional y rule obligatoria para deduced. No deduzcas valoración subjetiva de una frase genérica.',
      'links agrupa action/pass/shot/duel/possession/attack/restart/chain/cause/loss/followup con ids estables para relacionar hechos, no para duplicarlos. interventionId distingue intervenciones. Un tiro y parada o bloqueo pueden compartir acción e intervención.',
      'Goles, cambios y tarjetas se desglosan individualmente en el acta y nunca se agregan. Agregados: kind:aggregate, quantity entera, aggregate:{kind,scopeId,reconciled}, intervalo y ámbito disjunto. reconciled:true solo si has comprobado que no se solapa con acciones individuales ni otros resúmenes; de lo contrario queda pendiente, no fuerza un total.',
      'coverage declara familia, equipo y opcionalmente from/to. complete solo tras revisar íntegramente esa familia en ese tramo; silencio no significa cero. Lagunas: observación gap y cobertura parcial. Una duda en analysis.issues incluye id/message/eventIds; no bloquea hechos independientes. validity:pending en observaciones afectadas, valid tras resolver; void para retirar una observación sin borrar historial. Para anular goles/cambios/tarjetas corrige también events.',
      'No inventes parámetros de xG, ratings, presión, retención o atribución. Métrica sin evidencia se conserva desconocida/parcial; sin modelo configurado, no configurada. Porcentajes se calculan después sumando numeradores y denominadores, no promediando porcentajes.',
      'Pases incluyen centros y reinicios con pie según perfil; excluyen banda y mano del portero. Desvío rival: pase fallado aunque un compañero recoja después. Recuperación rápida estrictamente antes de 5 segundos, nunca a los 5 exactos. Recuperar de disputa no equivale a recuperar tras pérdida al rival.',
      'Límites: 2500 eventos, 4000 observaciones, acta pública650KB, fuentes150KB, 100 dudas. Reimporta solo correcciones con mismos ids; el resto se conserva. No adjuntes audio ni transcripción completa al JSON.',
    ],
    observationKinds: OBSERVATION_KINDS, factTypes: NARRATED_FACT_TYPES, factEnums: NARRATION_ENUMS, subtypesByKind: NARRATION_SUBTYPES, optionalParameters: NARRATION_PARAMETERS,
    catalogue: { sourceSha256: NARRATED_CATALOG_SOURCE_SHA256, sourceFile: 'catalogo_400_estadisticas_futbol.xlsx', repositoryGuide: 'docs/narration-import-v2.md', metrics: NARRATED_METRICS.filter(m => m.audio.viability !== 'excluded').map(m => ({ id: m.id, category: m.category, name: m.name })) },
  }, null, 2);
}
