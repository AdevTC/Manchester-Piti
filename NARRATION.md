# Análisis de partidos narrados

## Reloj y permisos

En **Admin → Partidos → Encuentro → Anotadores**, los administradores pueden autorizar a miembros vigentes del vestuario para ese partido. Estos entran en la ficha pública y encuentran la **Mesa de partido** al iniciar sesión. No obtienen acceso al resto de administración ni a publicar actas.

La hora programada sirve para el calendario y la cuenta atrás. El reloj moderno solo arranca con **Iniciar partido**. Se guardan en el servidor inicio, descanso, comienzo de segunda parte y final. Los 25 minutos por parte son orientativos. El descanso no suma tiempo de juego. Los cambios durante el descanso usan el tiempo de juego detenido. Titulares, entradas, salidas, reingresos y expulsiones determinan los segundos jugados. Los acumulados conservan `secondsPlayed`; `minutes` es su representación decimal redondeada a dos decimales.

Cada transición compara la revisión del reloj dentro de una transacción. Una transición desactualizada se rechaza. Las acciones se añaden de forma transaccional y tienen un identificador para evitar duplicar una petición reintentada. Deshacer identifica una jugada concreta. Reiniciar nunca borra jugadas automáticamente.

## Del dictado al acta

1. En **Admin → Partidos → Acta → El partido, acción a acción**, abrir **Importar análisis de una narración** y copiar el contexto. Incluye identidades y dorsales, convocatoria, reloj, revisión y eventos existentes.
2. Compartir ese contexto y narrar el partido en el chat. Indicar el período y tiempos cuando se conozcan. Se puede narrar por fragmentos. El asistente interpreta el relato y genera un archivo `piti-actions/v1`; la web no tiene un servicio de transcripción o un modelo de lenguaje autónomo configurado.
3. Revisar ambigüedades antes de incorporar. Importar el archivo JSON o pegarlo; **Revisar importación** muestra nuevas acciones, correcciones y errores.
4. **Incorporar al borrador** fusiona por identificador. Se puede editar cada acción. **Publicar** valida la secuencia y sustituye atómicamente la contribución del partido a los acumulados, sin sumarla dos veces.

El asistente puede preparar e importar el archivo en una sesión autorizada de administración. No necesita ni debe almacenar credenciales en el archivo. Las modificaciones de otra persona se detectan por revisión: se vuelve a exportar el contexto y se fusiona sobre la versión actual.

## Contrato del archivo

Los identificadores de este ejemplo son ilustrativos: usar siempre los del contexto real.

```json
{
  "format": "piti-actions/v1",
  "matchId": "id-del-partido",
  "baseRevision": 12,
  "coverage": "partial",
  "notes": "Faltan las acciones anteriores al minuto 3.",
  "unresolved": [],
  "events": [
    { "id": "narracion-001", "type": "pass", "minute": 3, "elapsedSeconds": 192, "period": 1, "playerId": "jugador-a", "receiverId": "jugador-b", "outcome": "complete", "delivery": "long", "source": "narration" },
    { "id": "narracion-002", "type": "shot", "minute": 3, "elapsedSeconds": 199, "period": 1, "playerId": "jugador-b", "outcome": "off_target", "zone": "right", "source": "narration" },
    { "id": "narracion-003", "type": "clearance", "playerId": "jugador-c", "timingUnknown": true, "source": "narration" }
  ]
}
```

- Mantener los identificadores al corregir jugadas existentes, también goles y cambios introducidos en vivo. Reimportar el mismo archivo actualiza esas acciones; un id nuevo significa una acción nueva. No introducir de nuevo una jugada existente con otro id.
- `minute` es el minuto transcurrido de juego. `elapsedSeconds` es opcional y conserva segundos exactos; debe cumplir `minute = floor(elapsedSeconds / 60)`. El tiempo excluye el descanso. La segunda parte continúa desde la duración real de la primera, no se fuerza a 25:00. Si el relato usa minutos de cada parte, convertirlos con el reloj del contexto.
- Si no se sabe el minuto de una acción técnica, usar `timingUnknown: true` y omitir ambos campos de tiempo. Los goles, cambios y tarjetas necesitan minuto para validar la participación y los minutos jugados. No inventar tiempos equidistantes a partir del orden del relato.
- `team` puede ser `us` u `opponent`. El autor del Piti usa `playerId`; el rival puede llevar `opponentPlayer` como texto. El receptor del Piti usa `receiverId`. Nunca inventar autores o receptores.
- Solo inferir pase completado cuando el relato establezca una recepción o continuación controlada. Si únicamente dice «la pasa» y no se sabe el resultado, usar `outcome: unknown` y preguntar si es necesario. Un pase erróneo no tiene receptor del Piti.
- Un gol ya cuenta como un remate a puerta: no añadir otro remate para el mismo gol. Un palo es un único remate. Un pase fallado y un regate perdido ya suman una pérdida; una intercepción ya suma recuperación. Centros y pases largos son subconjuntos de pases, no eventos duplicados.
- La asistencia del gol usa `assistPlayerId`. Si se describe el pase que produjo el gol, puede registrarse como pase: suma el pase, sin añadir otra asistencia separada. `keyPass: true` identifica una entrega completada que produce un remate.
- Catálogo completo: `functions/src/matchAnalysis.ts` y `functions/src/matchEngine.ts`. Validación: `functions/src/eventSchema.ts`. Incluye pases, centros, remates, entradas, duelos, regates, pérdidas, recuperaciones, intercepciones, despejes, bloqueos, paradas, faltas, saques, controles, conducciones y acciones adicionales con nota.
- Coordenadas `x,y,endX,endY` entre 0 y 100, ataque hacia arriba (`y=0`). Solo cuando sean conocidas; no derivarlas de la posición nominal del jugador. `zone` puede ser `left`, `center`, `right`. `bodyPart`: `left`, `right`, `head`, `hand`, `other`.
- Solo registrar `possession` con `possessionSeconds` si se conoce la duración de un tramo. No convertir proporción de pases en posesión real. No generar xG sin un modelo e información apropiados.
- `coverage: complete` solo tras revisar todo el partido. Cobertura parcial es el valor por defecto. Cualquier duda pendiente va en `unresolved` y bloquea la incorporación.
- Máximo 2500 eventos y 650 KB por acta publicada. Los fragmentos se fusionan sobre el mismo acta. Las estadísticas cuentan lo registrado, sin completar automáticamente los huecos.

## Verificación local

Con emuladores Auth, Firestore y Functions del proyecto `demo-manchester-piti` activos y el backend compilado:

```sh
pnpm --dir functions build
node functions/test/match-analysis.integration.mjs
node functions/test/club.integration.mjs
pnpm test
pnpm lint
pnpm build
```

La prueba de integración dedicada comprueba permisos, inicios simultáneos, descanso, eventos concurrentes, reintentos, deshacer y correcciones sin duplicar acumulados. Nunca ejecutar pruebas contra Firebase de producción.
