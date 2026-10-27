import { NARRATION_ENUMS, NARRATION_SUBTYPES, NARRATION_PARAMETERS } from '../../functions/src/narrated/contract';
import { NARRATED_FACT_TYPES } from '../../functions/src/narrated/facts';
import type { MatchSheet } from '../../functions/src/matchEngine';
import { DEFAULT_ANALYSIS_PROFILE, OBSERVATION_KINDS, type AnalysisProfile } from '../../functions/src/narrated/types';
import { NARRATED_METRICS, NARRATED_CATALOG_SOURCE_SHA256 } from '../../functions/src/narrated/catalogIndex';

/** Play details the web reads and only the narration can give, each asked with its criterion and an example. A big
 *  chance only under the club's declared criterion: never from adjectives. */
function alwaysRecord(profile: AnalysisProfile) {
  const criterion = typeof profile.parameters.bigChanceCriterion === 'string' ? profile.parameters.bigChanceCriterion.trim() : '';
  return {
    why: 'La web lee estos datos de cada jugada y solo los puede dar la narración. Márcalos siempre que se narren o se deduzcan con una regla (provenance deduced con rule). Si no se sabe, omite el dato: nunca lo pongas a false por defecto ni lo supongas. Los ejemplos muestran lo esencial de cada observación; id, order, time y provenance van como en contract.',
    items: [
      {
        ask: 'Pases que entran en el área', facts: ['entersArea'],
        when: 'entersArea:true en cada pase completado, nuestro o del rival, que sale de fuera del área del contrario y lo recibe un compañero dentro de ella. También si además es centro, pase clave o en profundidad: cada dato se registra y la web no lo cuenta dos veces.',
        notWhen: 'Un pase fallado, cortado o despejado antes de llegar; un pase dado ya dentro del área; un balón recibido fuera con el que el receptor entra conduciendo (eso es carry con entersArea:true).',
        examples: [{ narration: '«El 8 la mete desde la frontal y el 9 controla dentro del área»', observations: [{ kind: 'pass', team: 'us', actorId: 'id-del-8', receiverId: 'id-del-9', facts: { outcome: 'complete', entersArea: true } }] }],
      },
      {
        ask: 'Puñetazos y salidas del portero', kind: 'keeper', facts: ['subtype', 'firstControl', 'outcome'], subtypes: ['punch', 'cross_exit', 'cross_caught'],
        when: 'Cuando el portero sale a por un centro o un balón colgado, o despeja de puños, es una observación keeper con el subtype de lo que hace con el balón. punch: lo aleja de puños; lleva firstControl, quién lo controla primero después (us, opponent, out, disputed o unknown), como un despeje, y outcome failed si apenas lo toca o no lo aleja. cross_exit: sale y llega antes que nadie sin atraparlo ni golpearlo de puños, por ejemplo lo desvía con la mano o se anticipa al delantero (outcome complete), o no llega o lo recibe el rival (outcome failed). cross_caught: atrapa el centro.',
        notWhen: 'Una sola observación por intervención: «sale y la atrapa» es cross_caught y «sale y despeja de puños» es punch, nunca además cross_exit. Un remate a puerta que detiene es save (held o parried).',
        examples: [
          { narration: '«Córner; sale el portero y despeja de puños, la recoge el 4»', observations: [{ kind: 'keeper', team: 'us', actorId: 'id-del-portero', facts: { subtype: 'punch', outcome: 'complete', firstControl: 'us' } }] },
          { narration: '«El portero sale al centro, no llega y remata su 9»', observations: [{ kind: 'keeper', team: 'us', actorId: 'id-del-portero', facts: { subtype: 'cross_exit', outcome: 'failed' } }] },
        ],
      },
      {
        ask: 'Zonas', facts: ['zone', 'destinationZone', 'outsideArea'],
        when: 'zone en cada acción con balón cuya zona se narre o se deduzca de la jugada; siempre que se sepa, en pérdidas, pases fallados, regates, recuperaciones e intercepciones. Va desde el lado del equipo que actúa, también en las acciones del rival: own_area es su propia área y opponent_area, la del contrario. Usa la más precisa: el área; si no, el tercio (own_third, middle_third, final_third); la mitad (own_half, opponent_half), solo si no se sabe el tercio. En un pase, zone es desde dónde sale y destinationZone, con los mismos valores, adónde llega; en un regate, dónde supera al rival; en un remate desde fuera del área, además outsideArea:true.',
        notWhen: 'Sin ninguna pista de dónde fue, omite zone: no la deduzcas de la posición habitual del jugador.',
        examples: [
          { narration: '«Recupera el 4 dentro de nuestra área»', observations: [{ kind: 'recovery', team: 'us', actorId: 'id-del-4', facts: { zone: 'own_area' } }] },
          { narration: '«Su 9 regatea al 3 dentro de nuestra área»', observations: [{ kind: 'dribble', team: 'opponent', facts: { outcome: 'won', defenderId: 'id-del-3', zone: 'opponent_area' } }] },
          { narration: '«El 6 falla un pase en la salida, en nuestro tercio»', observations: [{ kind: 'pass', team: 'us', actorId: 'id-del-6', facts: { outcome: 'failed', zone: 'own_third' } }] },
        ],
      },
      criterion
        ? {
            ask: 'Ocasión clarísima', facts: ['bigChance'],
            when: `bigChance:true en el remate, nuestro o del rival (shot, o goal si entra), que cumple el criterio del club, profile.parameters.bigChanceCriterion: «${criterion}». Va solo en el remate, con provenance judgement y su fuente. Si la ocasión sale de un pase, ese pase lleva keyPass:true y el remate links.pass con su id.`,
            notWhen: 'No lo deduzcas de adjetivos («ocasión clarísima», «ocasionaza») ni del resultado: un gol no prueba la ocasión ni un fallo la descarta. Sin datos para aplicar el criterio, omite el dato.',
            examples: [{ narration: '«El 8 deja solo al 7 ante el portero y la tira fuera»', observations: [
              { id: 'pass-40', kind: 'pass', team: 'us', actorId: 'id-del-8', receiverId: 'id-del-7', facts: { outcome: 'complete', keyPass: true } },
              { id: 'shot-41', kind: 'shot', team: 'us', actorId: 'id-del-7', links: { pass: 'pass-40' }, facts: { outcome: 'off_target', bigChance: true }, provenance: { bigChance: { kind: 'judgement', sourceId: 'source-9' } } },
            ] }],
          }
        : { ask: 'Ocasión clarísima', facts: ['bigChance'], when: 'Este perfil no declara bigChanceCriterion: no marques bigChance en ninguna jugada ni añadas tú el criterio al perfil.' },
    ],
  };
}

/** Portable instructions + the real match. Audio stays in the user's external assistant conversation. */
export function narrationPrompt(matchId: string, sheet: MatchSheet, roster: { id: string; name: string; number: number | null }[]) {
  const profile = sheet.analysis?.profile ?? DEFAULT_ANALYSIS_PROFILE;
  return JSON.stringify({
    format: 'piti-context/v2', matchId, baseRevision: sheet.revision ?? 0,
    rival: sheet.rival, date: sheet.date, duration: sheet.duration, durationSeconds: sheet.durationSeconds,
    clock: sheet.clock, starters: sheet.starters, bench: sheet.bench, notCalled: sheet.notCalled, roster,
    existingEvents: sheet.events.map(({ sourceRef: _privateSource, ...e }) => e), existingAnalysis: sheet.analysis,
    profile,
    instructions: 'Interpreta mi narración entregada en este chat; la web no graba, sube ni transcribe audio. Devuelve únicamente JSON piti-actions/v2 para revisar como borrador. Usa exactamente matchId y baseRevision y analysis.revision del contexto (0 si no existe). Conserva identificadores al corregir; una nueva importación con los mismos ids debe ser idempotente. No calcules ni guardes totales: registra hechos, su procedencia y cobertura. Registra en cada jugada los datos de alwaysRecord siempre que la narración los permita. No ejecutes publicaciones. El fragmento literal se conserva solo en sources: nunca en facts, notas públicas, issues ni provenance. No inventes hechos, identidades, posiciones, coordenadas, minutos o resultados.',
    contract: {
      format: 'piti-actions/v2', matchId, baseRevision: sheet.revision ?? 0, events: [], sources: [{ id: 'source-1', quote: 'Fragmento literal privado, máximo 1000 caracteres', audioFrom: 12, audioTo: 15 }],
      analysis: { version: 2, revision: sheet.analysis?.revision ?? 0, profile, observations: [{ id: 'pass-1', kind: 'pass', team: 'us', order: 1, facts: { outcome: 'complete' }, provenance: { outcome: { kind: 'explicit', sourceId: 'source-1' } } }], coverage: [{ family: '*', team: 'us', state: 'partial' }, { family: '*', team: 'opponent', state: 'partial' }], issues: [] },
    },
    rules: [
      'events es el acta canónica: goles, asistencias, cambios, tarjetas y acciones ya existentes. analysis.observations amplía detalles sin cambiar el enum del acta. Cuando describes una acción ya en events, usa canonicalEventId y una sola observación compatible; no repitas gol como tiro independiente ni centro como otro pase.',
      'El perfil por defecto es fútbol 7, dos partes de 25 minutos; respeta tiempos reales de acta. time.from/time.to son segundos de juego sin descanso. exact exige ambos iguales. Sin reloj fiable, omite time: la marca de audio va solo en sources y nunca se convierte en minuto de partido.',
      'actorId, receiverId e intendedReceiverId son ids del contexto. defenderId identifica al defensa del Piti en un regate rival. opponentReceiverId identifica al receptor rival, nunca a un jugador del Piti. Rivales: team:opponent y opponentId si está identificado. Sin identidad confirmada, omite el campo. Un pase recibido confirma outcome:complete y receiverId. Un pase fallado solo identifica intendedReceiverId si se conoce; no inventa pérdida ni control rival.',
      'controlBefore/controlAfter pueden ser us, opponent, disputed, out, unknown. Una intercepción no asegura recuperación; un desvío, despeje, balón dividido o pase fallado no asegura cambio de posesión. Solo pérdida a control rival cuando se narra ese control. Conserva lastControlledTeam cuando se conoce.',
      'facts son escalares: booleanos reales, números finitos o claves breves documentadas. outcome complete|failed|pending|neutral; bodyPart right|left|head|other; zone own_area|own_third|own_half|middle_third|opponent_half|final_third|opponent_area; direction forward|backward|lateral; distanceBand short|medium|long; height ground|high; phase counterattack|positional|direct|defence|attack. No uses prosa libre para activar reglas.',
      'Atributos independientes como firstTouch, weakFoot, underPressure y progressive solo se afirman si se narran o hay una deducción documentada; bigChance, solo como indica alwaysRecord. provenance por campo: kind explicit|deduced|judgement|unknown, sourceId opcional y rule obligatoria para deduced. No deduzcas valoración subjetiva de una frase genérica.',
      'links agrupa action/pass/shot/duel/possession/attack/restart/chain/cause/loss/followup con ids estables para relacionar hechos, no para duplicarlos. interventionId distingue intervenciones. Un tiro y parada o bloqueo pueden compartir acción e intervención.',
      'Goles, cambios y tarjetas se desglosan individualmente en el acta y nunca se agregan. Agregados: kind:aggregate, quantity entera, aggregate:{kind,scopeId,reconciled}, intervalo y ámbito disjunto. reconciled:true solo si has comprobado que no se solapa con acciones individuales ni otros resúmenes; de lo contrario queda pendiente, no fuerza un total.',
      'coverage declara familia, equipo y opcionalmente from/to. complete solo tras revisar íntegramente esa familia en ese tramo; silencio no significa cero. Lagunas: observación gap y cobertura parcial. Una duda en analysis.issues incluye id/message/eventIds; no bloquea hechos independientes. validity:pending en observaciones afectadas, valid tras resolver; void para retirar una observación sin borrar historial. Para anular goles/cambios/tarjetas corrige también events.',
      'No inventes parámetros de xG, ratings, presión, retención o atribución. Métrica sin evidencia se conserva desconocida/parcial; sin modelo configurado, no configurada. Porcentajes se calculan después sumando numeradores y denominadores, no promediando porcentajes.',
      'Pases incluyen centros y reinicios con pie según perfil; excluyen banda y mano del portero. Desvío rival: pase fallado aunque un compañero recoja después. Recuperación rápida estrictamente antes de 5 segundos, nunca a los 5 exactos. Recuperar de disputa no equivale a recuperar tras pérdida al rival.',
      'Límites: 2500 eventos, 4000 observaciones, acta pública650KB, fuentes150KB, 100 dudas. Reimporta solo correcciones con mismos ids; el resto se conserva. No adjuntes audio ni transcripción completa al JSON.',
    ],
    alwaysRecord: alwaysRecord(profile),
    observationKinds: OBSERVATION_KINDS, factTypes: NARRATED_FACT_TYPES, factEnums: NARRATION_ENUMS, subtypesByKind: NARRATION_SUBTYPES, optionalParameters: NARRATION_PARAMETERS,
    catalogue: { sourceSha256: NARRATED_CATALOG_SOURCE_SHA256, sourceFile: 'catalogo_400_estadisticas_futbol.xlsx', repositoryGuide: 'docs/narration-import-v2.md', metrics: NARRATED_METRICS.filter(m => m.audio.viability !== 'excluded').map(m => ({ id: m.id, category: m.category, name: m.name })) },
  }, null, 2);
}
