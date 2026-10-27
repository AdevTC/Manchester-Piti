# Análisis narrado: contrato de importación

El audio y su interpretación se entregan al asistente fuera de la web. En el acta, **Copiar prompt y contexto** exporta la plantilla actual, sus identificadores, el reloj, los eventos, el perfil, el catálogo viable, el vocabulario operativo y, en `alwaysRecord`, los datos que se piden en cada jugada con su criterio y un ejemplo (la ocasión clarísima, solo si el perfil declara `bigChanceCriterion`; el perfil por defecto declara el de Opta). La web recibe únicamente JSON y no graba ni transcribe audio.

## Recorrido en la web

1. En administración, abre el acta del partido y su editor de análisis. Copia **prompt y contexto** y entrégalos al asistente junto con la narración. Incluye los tiempos de juego cuando los conozcas; el tiempo de la grabación no los sustituye.
2. Importa el JSON devuelto. Revisa altas, correcciones, duplicados, dudas y observaciones; puedes editar autor, tiempo, atributos y relaciones antes de incorporarlo al borrador. Publicar el acta es una acción separada.
3. En **Números → Análisis del juego**, usa el resumen o el catálogo por familias. Los filtros de temporadas, partidos y jugadores se combinan; equipo y parte acotan las jugadas. Dentro de cada partido aparece el mismo análisis y un enlace a esa selección en Números.
4. Abre una cifra para consultar su definición, muestra, pendientes, parámetros y jugadas de origen. **Exportar selección** descarga resultados y actas públicas en JSON, con filtros y cobertura, manteniendo los valores desconocidos como `null`. No exporta citas privadas ni datos de cuentas.

Los partidos archivados o cancelados quedan fuera del cálculo. Las métricas condicionadas no se activan por existir en el catálogo: requieren los hechos y criterios descritos en su ficha. Una racha entre partidos exige fechas conocidas; los periodos sin goles o remates requieren cobertura suficiente para demostrar esa ausencia. Las comparaciones con y sin un jugador describen lo observado y no demuestran causalidad.

El archivo `piti-actions/v2` contiene `matchId`, `baseRevision`, `events`, `analysis` y, opcionalmente, `sources`. `analysis.revision` identifica el análisis sobre el que se trabajó. El servidor rechaza revisiones antiguas. La importación conserva los eventos que no aparecen en el archivo y actualiza los identificadores existentes sin duplicarlos. El formato anterior `piti-actions/v1` sigue aceptándose.

Los tipos completos están en `functions/src/narrated/types.ts`; el vocabulario y los parámetros están en `contract.ts` y `facts.ts` dentro del mismo directorio. La definición, procedencia y restricciones de cada métrica del Excel se conservan en `catalog.ts`; las fórmulas ejecutables están en `recipes001_200.ts` y `recipes201_400.ts`. El catálogo registra el hash de su archivo original.

## Hechos, control y tiempos

Los hechos son valores tipados, no totales precalculados. Cada observación tiene identificador estable, clase, equipo, orden y hechos. Autor, receptor, controles antes/después, relaciones y tiempo se añaden únicamente cuando se conocen. `canonicalEventId` amplía una acción del acta: hereda lo conocido y no puede contradecir su autor, resultado, tiempo, gol, asistencia o tarjeta. Goles, tarjetas y sustituciones necesitan esa referencia para mantener alineados marcador, minutos y estadísticas.

Un pase fallado no implica una pérdida al rival; una intercepción no implica recuperación. `controlBefore` y `controlAfter` distinguen Piti, rival, disputa, fuera y desconocido. Las ocasiones sin remate usan `context` y `facts.chance:true`. El contacto rival desvía un pase y lo hace fallido según el perfil, aunque un compañero controle después.

`time` usa segundos del partido sin descanso. `precision:exact` necesita extremos idénticos; los intervalos conservan su incertidumbre. Los intervalos de rol, control o alineación usan `facts.intervalStart/intervalEnd`; no pueden superar la duración del partido. El tiempo de audio sólo aparece en las fuentes privadas y jamás se transforma automáticamente en tiempo de juego.

## Cobertura y correcciones

La cobertura se declara por familia, equipo e intervalo. Silencio no es cero. Las dudas permanecen en `analysis.issues`; sus observaciones se guardan pendientes hasta aclararlas. Una duda no bloquea los hechos independientes. Resolver su texto no reescribe hechos: hay que revisar y confirmar la observación.

Para corregir se reutiliza el identificador. `validity:void` conserva el rastro y excluye la observación; si cambia un gol, cambio o tarjeta, se corrige también el acta canónica. La revisión visual y el editor permiten modificar todo el registro, incluidos referencias, relaciones y tiempos.

Un agregado necesita cantidad, clase, intervalo y ámbito disjunto. `reconciled:true` sólo procede cuando no se solapa con acciones individuales ni con otro agregado del mismo equipo y jugador. Un solapamiento desconocido no acredita conciliación; el servidor lo rechaza y el motor lo trata como pendiente.

## Privacidad, publicación y límites

Las citas literales van exclusivamente en `sources`: máximo 1000 caracteres por fragmento y 150 KB por importación. La procedencia pública contiene sólo identificadores de fuente y regla. Los antiguos `sourceRef` se trasladan a un historial privado al publicar. El historial bajo `matchPrivate/{matchId}/analysisHistory` sólo puede leerlo un administrador y sólo lo escribe el servidor. Sus snapshots se identifican por contenido; las revisiones anteriores no se podan. Borrar el partido elimina ese árbol; archivar lo conserva.

Hay límites de 2500 eventos, 4000 observaciones, 100 dudas y 650 KB de acta. La publicación actualiza el ledger y las estadísticas de temporada con la misma proyección que usan las tablas y gráficas. Las métricas condicionadas permanecen sin configurar hasta que el club declare sus criterios: no se inventan ventanas, políticas de portero, pesos de valoración ni modelos.
