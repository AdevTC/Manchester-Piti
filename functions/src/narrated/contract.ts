/** Canonical cards change the ledger and cannot be invented by statistical summaries. */
export const NARRATION_CARD_SUBTYPES: readonly string[] = ['yellow_card','double_yellow','red_card','opponent_yellow','opponent_red','yellow','second_yellow','red'];
/** Operational vocabulary for the external narrator. These names are read by the reducers. */
export const NARRATION_ENUMS: Record<string, readonly string[]> = {
  outcome: ['complete','completed','success','failed','pending','unknown','neutral','won','lost','goal','saved','on_target','off_target','blocked','woodwork','held','parried'],
  bodyPart: ['right','left','head','hand','other'], direction: ['forward','backward','lateral'], distanceBand: ['short','medium','long'], height: ['ground','high'],
  zone: ['own_area','own_third','own_half','middle_third','opponent_half','final_third','opponent_area'],
  phase: ['counterattack','positional','direct','defence','attack'], lane: ['left','center','right'],
  state: ['us','opponent','disputed','out','unknown'], firstControl: ['us','opponent','disputed','out','unknown'], firstContactTeam: ['us','opponent','disputed','unknown'],
  stage: ['start','end','halftime','awarded','executed'], block: ['high','medium','low'], buildUpOutcome: ['complete','lost'],
};
export const NARRATION_SUBTYPES: Record<string, readonly string[]> = {
  context: ['chance'], pass: ['cross'], duel: ['aerial'], block: ['pass','shot'], save: ['held','parried'],
  restart: ['corner','freekick','throw_in','goal_kick','kickoff'],
  discipline: ['foul','foul_received','yellow_card','double_yellow','red_card','penalty_received','penalty_committed','offside'],
  keeper: ['cross_caught','punch','cross_exit'], judgement: ['error','defensive_cover'], tactical: ['defensive_cover'],
  run: ['short_support','backward','wide','half_space','ahead','overlap','underlap','behind','cross'], measurement: ['rpe'],
};
export const NARRATION_PARAMETERS: Record<string, string> = {
  quickRecoverySeconds: 'Número de segundos; comparación estrictamente menor. Predeterminado: 5.',
  windowSeconds: 'Ventana positiva en segundos; predeterminado: 300.', windowKind: 'Clase de observación de la ventana; predeterminado: pass.',
  offside: 'Booleano: reglamento de fuera de juego. Predeterminado: false.', temporalToleranceSeconds: 'Número >=0, ancho máximo de incertidumbre temporal aceptado; predeterminado: 0.',
  assistPolicy: 'strict. Exige continuidad y pase completo al goleador; no inventar asistente.',
  scaEligibleKinds: 'Array de clases elegibles declarado por el club.', scaPhasePolicy: 'Criterio explícito y versionado del final de fase para SCA/GCA.',
  retentionSeconds: 'Segundos positivos para verificar conservación.', retentionEndPolicy: 'Criterio explícito del final de seguimiento de la retención.',
  pressureRecoverySeconds: 'Segundos positivos para recuperación tras presión.', wallSeconds: 'Segundos positivos entre ida y vuelta de una pared.',
  defensiveActionKinds: 'Array de clases incluidas en acciones defensivas.', reactionSeconds: 'Segundos positivos de reacción tras pérdida.',
  ppdaZone: 'Zona del vocabulario para PPDA.', ppdaActionKinds: 'Array de clases defensivas incluidas en PPDA.',
  counterpressReactionSeconds: 'Segundos positivos para iniciar contrapresión.', counterpressRecoverySeconds: 'Segundos positivos para recuperar tras contrapresión.', counterpressShotSeconds: 'Segundos positivos para rematar tras contrapresión.',
  bigChanceCriterion: 'Criterio del club, explícito y versionado; no inferir de adjetivos.', deepPassCriterion: 'Definición declarada de pase profundo.', containmentCriterion: 'Definición declarada de contención sin falta.', defensiveCoverCriterion: 'Definición declarada de cobertura defensiva.',
  gpiMethodVersion: 'Identificador de la fórmula declarada.', gpiEligibleKinds: 'Array de clases elegibles para GPI.', gpiExceptionsReviewed: 'Booleano: excepciones revisadas expresamente.',
  dangerSeconds: 'Segundos positivos de la ventana tras pérdida.', reboundSeconds: 'Segundos positivos para verificar remate tras rechace.', throwInProgressZone: 'Zona declarada de progresión tras saque de banda.',
  keeperCleanSheetPolicy: 'full_match o min_minutes; nunca asumir una política.', keeperCleanSheetMinMinutes: 'Minutos positivos, necesarios si la política es min_minutes.',
  ratingWeights: 'Cadena JSON de pesos {ID_métrica:número}; excluye 378, máximo 4000 caracteres.', ratingScaleMin: 'Mínimo de la escala declarada.', ratingScaleMax: 'Máximo superior al mínimo.', ratingBaseline: 'Punto de partida declarado.', ratingRole: 'Código de rol acreditado, por ejemplo GK.', ratingMissingPolicy: 'require_complete; no sustituir métricas desconocidas por cero.',
  splitSecond: 'Segundo de juego que divide los tramos A y B.', substitutionWindowSeconds: 'Segundos positivos antes/después del cambio.', substitutionId: 'Identificador exacto del cambio seleccionado.',
};
