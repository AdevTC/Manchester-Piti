# Posiciones y sistemas de fútbol 7 — diseño

Fecha: 2026-10-13 · Rama: `feat/posiciones` · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

Hoy cada jugador tiene una sola posición en texto libre (`players/{id}.naturalPosition`) que la web reduce a cuatro líneas (POR/DEF/MED/DEL), y la pizarra ofrece seis formaciones. En el equipo real se juega de muchas maneras y casi todos juegan en más de un sitio. Queremos:

1. Un **catálogo de posiciones de fútbol 7** (13 códigos) con **una posición preferida + una lista de «también puede jugar de»** por jugador.
2. Que **el jugador proponga** sus posiciones y **el capitán/admin las apruebe** (o las gestione directamente).
3. **Historial automático** («ha jugado de…») y **estadísticas por posición**, sin pedir datos nuevos.
4. Que **la pizarra razone por posición exacta** (encaje, química, sugerencias, cambios, familiaridad).
5. **15 sistemas de fútbol 7** (hoy 6), con ficha, «¿Nos encaja?» según la convocatoria y balance por sistema.

Criterio de éxito: ningún jugador queda «Sin posición» por cómo se escribió su dato; un jugador puede declarar varias posiciones; la pizarra sugiere sietes y cambios que respetan esas posiciones; cualquier pantalla que muestra una posición usa el mismo catálogo.

Fuera de alcance (después): roles estilo FC sobre la posición (el modelo deja hueco), auditoría transversal de módulos y sincronización en vivo (proyecto siguiente).

## Situación actual (resumen del mapeo)

- `naturalPosition` es un string libre: unos docs guardan códigos («DEL»), otros palabras («Portero», del seed). La pizarra lo lee con `normZone` (tolerante); admin, club y stats con `toUpperCase()` + match exacto → las palabras salen «Sin posición».
- Hay **10 copias** de la lista de cuatro zonas (`formations.ts`, `schemas.ts LINEUP_ZONES`, `plantillaLogic.ts`, `lib/club.ts`, `statsView.ts`, `perfil/card.ts`, `JugadorPage.tsx`, `AdminLayout.tsx`, `acta/roster.ts`, `ClubPage.tsx`, `perfil/TabCarta.tsx`, `functions/src/shareCard.ts`).
- Dos tablas de casillas que no coinciden: `FORMATIONS` (`pizarra/formations.ts:115-170`, lo que se guarda) y `FORM` (`v2/geometry.ts:93-100`, lo que se ve): lados LI/LD y EI/ED invertidos, LIB vs DFC en 1-3-2, MI/MD vs MC/MC en 2-1-2-1.
- Ya existe un «Jugar de» por pizarra (`Lineup.playerPositions`, zona) y una familiaridad derivada de pizarras oficiales (por zona).
- Ningún acta guarda la posición jugada; sí guarda `stints` y `exchanges` por jugador (`functions/src/matchEngine.ts:73-87`).
- Solo el admin escribe `players` (`firestore.rules:46-48`); `me().playerId` enlaza usuario ↔ ficha.

## 1 · Catálogo y modelo

### Módulo único `src/lib/positions.ts`

Fuente de verdad para web y (copia mínima) funciones. Sustituye las 10 copias.

| Código | Nombre | Línea | Lado |
|---|---|---|---|
| POR | Portero | POR | centro |
| DFC | Central | DEF | centro |
| LIB | Líbero | DEF | centro |
| LI | Lateral izquierdo | DEF | izquierda |
| LD | Lateral derecho | DEF | derecha |
| MCD | Pivote | MED | centro |
| MC | Mediocentro | MED | centro |
| MI | Interior izquierdo | MED | izquierda |
| MD | Interior derecho | MED | derecha |
| MCO | Mediapunta | MED | centro |
| EI | Extremo izquierdo | DEL | izquierda |
| ED | Extremo derecho | DEL | derecha |
| DC | Punta | DEL | centro |

Cada entrada lleva además: nombre largo en mayúsculas para cromos/tarjetas, punto (x, y en %) en el mini-campo de fútbol 7, y **vecinas** entre líneas (fútbol 7: los interiores hacen de carrileros, el pivote cubre de central):

| Posición | Vecinas (además de su misma línea) |
|---|---|
| DFC | MCD |
| LIB | MCD |
| LI / LD | MI / MD |
| MCD | DFC, LIB |
| MI / MD | LI / LD, EI / ED |
| MCO | DC |
| EI / ED | MI / MD |
| DC | MCO |

API pura: `POSITIONS`, `lineOf(code)`, `isPosition(x)`, `parsePosition(x)` (acepta códigos y palabras en español con o sin tildes — absorbe la tabla de `normZone`, que pasa a delegar aquí; palabras de solo línea como «Defensa» → `null` posición + línea conocida), `fitGrade(player, slotCode)`, `positionLabel(code, "short"|"long")`. `Zone` sigue existiendo como «línea» y se reexporta desde aquí.

### Ficha del jugador (`players/{id}`)

```ts
positions?: { main: PosCode | null; also: PosCode[] }          // aprobado — lo que lee toda la web
positionsProposal?: { main: PosCode | null; also: PosCode[]; at: Timestamp } | null  // propuesta del jugador
positionsReview?: { status: "aprobada" | "ajustada" | "rechazada"; at: Timestamp; by: string } | null
naturalPosition?: string   // se sigue escribiendo = línea de positions.main (compatibilidad: funciones, docs antiguos)
```

- `also`: sin repetidos, sin incluir `main`, máximo 6.
- Lectura (Zod, `schemas.ts`): códigos desconocidos se descartan (no tumban el doc); si `positions` falta, se deriva de `naturalPosition` con `parsePosition` (si solo da línea → `main: null`, línea conocida para la lógica de línea).
- Hueco futuro: `roles?` (no se implementa ahora).

### Reglas (`firestore.rules`)

- Admin: igual que hoy, más validación de forma de `positions` / `positionsReview` cuando cambian.
- Jugador: `update` de `players/{id}` permitido si `teamMember()`, `me().playerId == id`, y `affectedKeys().hasOnly(['positionsProposal'])` con forma válida (`main` código o null, `also` lista ≤6 de códigos, `at == request.time`). También puede poner `positionsProposal` a `null` (retirar).
- Tests de reglas: jugador escribe su propuesta ✓; la de otro ✗; otro campo ✗; códigos inválidos ✗; admin aprueba ✓.

### Flujo propuesta → aprobación

1. Perfil › «Mis posiciones»: el jugador marca en el Mapa y envía → `positionsProposal`.
2. Admin ve «Propuestas pendientes» (Inicio/Hoy + filtro en Plantilla) con la diferencia actual → propuesta.
3. Aprobar: `positions = propuesta`, `positionsProposal = null`, `positionsReview = aprobada`. Ajustar: el admin edita y guarda → `ajustada`. Rechazar → `rechazada`, se mantiene lo aprobado.
4. El jugador ve el estado en su perfil.
5. El admin puede editar `positions` directamente en cualquier momento (sin propuesta).

### Migración

Script único (`scripts/migrate-positions.mjs`, contra emulador primero y luego producción con confirmación) que rellena `positions` desde `naturalPosition` con `parsePosition`. Lo no reconocible o solo-línea queda `main: null` → aparece como «Sin posición» en Admin para completarlo. No se adivina.

## 2 · Sistemas de fútbol 7

Un único catálogo en `src/lib/formations.ts` (`src/pages/pizarra/formations.ts` lo reexporta para no mover sus importadores) sustituye `FORMATIONS` y `FORM`. Cada sistema: id (≤10 caracteres), nombre, carácter, siete casillas `[código, x, y]` con lados correctos, descripción, fuertes, débiles y perfiles que pide. Portero implícito en el nombre.

| Carácter | Id | Nombre | Casillas (sin POR) |
|---|---|---|---|
| Equilibrado | 2-3-1 | Clásico | DFC DFC · MI MC MD · DC |
| | 2-1-2-1 | Rombo | DFC DFC · MCD · MI MD · DC |
| | 2-2-2 | Parejas | DFC DFC · MC MC · DC DC |
| | 2-2-1-1 | Mediapunta | DFC DFC · MCD MC · MCO · DC |
| Defensivo | 3-2-1 | Línea de 3 | LI DFC LD · MC MC · DC |
| | 3-1-2 | Contra | LI DFC LD · MCD · DC DC |
| | 3-1-1-1 | Escalonado | LI DFC LD · MCD · MCO · DC |
| | 4-1-1 | Cerrojo | LI DFC DFC LD · MCD · DC |
| | 3-3 | Falso nueve | LI DFC LD · MI MC MD |
| Ofensivo | 2-1-3 | Tridente | DFC DFC · MCD · EI DC ED |
| | 1-3-2 | Líbero | LIB · MI MC MD · DC DC |
| | 1-2-3 | Todo arriba | LIB · MC MC · EI DC ED |
| | 1-2-2-1 | Alas | LIB · MC MC · EI ED · DC |
| | 1-1-2-1-1 | Rombo alto | LIB · MCD · MI MD · MCO · DC |
| | 2-1-2-1a | Clásico con alas | DFC DFC · MCD · EI ED · DC |

Notas:
- Los seis ids existentes conservan su id; sus casillas guardadas en pizarras antiguas se siguen leyendo (posición y zona del slot guardado). Al corregir los lados, las pizarras viejas se muestran con las etiquetas correctas por índice de casilla.
- `LINEUP_FORMATIONS` (Zod) pasa a ser el catálogo; un id desconocido cae a 2-3-1 al leer (como hoy).
- Modo libre: la posición de una casilla = punto del catálogo más cercano a (x, y).
- **«¿Nos encaja?»**: para la convocatoria del partido (o la plantilla activa si no hay), cada sistema calcula el mejor reparto y muestra «n/7 en su sitio» + qué falta («falta un extremo»).
- **Rival**: el selector de formación del rival usa el mismo catálogo.

## 3 · Lógica

### Encaje (`fitGrade`)

| Grado | Cuándo | Marca (texto + icono, nunca solo color) |
|---|---|---|
| 3 · Preferida | casilla = `main` | «PREF» |
| 2 · También | casilla ∈ `also` | «También» |
| 1 · Adaptado | misma línea que alguna suya, o vecina | «Adaptado» |
| 0 · Fuera de sitio | lo demás | «Fuera» |

- Portería: solo grados 3/2 cuentan; un jugador de campo en POR o un portero en campo es 0 salvo que lo tenga declarado.
- Sin posición declarada: neutro (como hoy «unknown = fits»), marcado «?».
- «Jugar de» por pizarra (`playerPositions`) guarda un código de posición; valores de zona antiguos se leen como «adaptado a esa línea». Schema `lineupPositionsSchema` acepta códigos y zonas.

### Consumidores en la pizarra (`src/pages/pizarra/v2`)

- `model.ts` (`natOf`/`natural`/`fits`) → basado en `fitGrade`; `isFull` exige grado ≥2 en POR.
- `ops.ts autoPlace` y `pack.ts suggestSeven`: rellenan por grado descendente (3 → 2 → 1 → 0), porteros solo en POR.
- `quimica.ts` / `chemPlayer.ts`: «en su sitio» = grado ≥2; adaptado puntúa la mitad.
- `familiarity.ts`: cuenta apariciones por código de posición en pizarras oficiales; marcas «++» (5+) / «+» (2+) por código, con respaldo por línea.
- `cambios.ts` (tandas, `replan`): sustituto ideal por grado en la posición de la casilla.
- `pachanga.ts`, `compare.ts`, `record.ts`, `bench.ts` (filtro por posición), `view.ts`, `ficha.ts`, `moveTo.ts`, `fan.ts`: pasan de zona a posición/grado; la línea se deriva.
- Aviso al publicar «Juega fuera de su sitio» con grado 0.

### Historial: `positionsPlayed`

- En `saveMatchSheet` (funciones), si el partido tiene pizarra oficial (`lineups` con `matchId` + oficial): titulares toman el código de su casilla; quien entra por un `exchange` hereda el código de quien sale. Se guarda en cada participación `positionsPlayed: Record<PosCode, minutos>`.
- Sin pizarra oficial: se usa `positions.main` y `positionsEstimated: true`.
- Script de relleno para partidos ya jugados.
- Lógica pura en `functions/src/positionsPlayed.ts` con tests.

### Estadísticas

- **Por posición**: minutos, partidos, goles, asistencias, tarjetas y valoración por código; cada evento con minuto se asigna a la posición que ocupaba el jugador en ese minuto (vía stints + exchanges + casilla).
- **Por sistema**: con la formación de la pizarra oficial de cada partido: PJ, G/E/P, GF/GC por sistema.
- Constelación (`statsView.ts`): coloca por punto de la posición exacta.

## 4 · Interfaz

### Pieza nueva: «Mapa de posiciones» (componente compartido)

Mini-campo de fútbol 7 con los 13 puntos del catálogo. Modos:
- **Ver**: preferida = ficha llena celeste con código y «PREF»; también = ficha con contorno; el resto tenue. Siempre texto/forma además de color.
- **Editar**: tocar una posición rota nada → también → preferida (solo una preferida; elegir otra degrada la anterior a «también»). Objetivos táctiles ≥44 px; teclado (flechas + Espacio); anuncio ARIA del cambio.
- **Historial**: puntos con tamaño por minutos («MC 320′ · MCD 140′»), etiqueta «estimado» cuando aplique.
- Respeta `prefers-reduced-motion`.

### Integración

| Superficie | Cambio |
|---|---|
| Admin › Plantilla (ficha a ficha) | Selector «Línea» → Mapa en modo editar; lista agrupada por línea derivada; filtro «Propuestas pendientes»; alta pide posiciones; CSV con preferida + también |
| Admin › Inicio/Hoy | Aviso de propuestas con aprobar / ajustar / rechazar en línea |
| Perfil «La carta» | Sección «Mis posiciones»: proponer + estado de la revisión |
| /plantilla › FichaModal | Pestaña de posiciones: Mapa + «Ha jugado de» + stats por posición |
| Cromo, página de jugador, tarjetas compartidas (`functions/src/shareCard.ts`, `social.ts`) | Código exacto + nombre largo |
| Pizarra | Código exacto en cromos; marcas de encaje en casillas/banquillo; filtro de banquillo por posición; **selector de formación** nuevo (15 por carácter, mini-campo, ficha, «¿Nos encaja?») |
| Estadísticas | Secciones «Por posición» y «Por sistema» |
| Club | Reparto de plantilla por posición |
| Convocar, acta, acceso, ⌘K, Hoy | Código exacto donde hoy sale la línea |

Copy en español; códigos visibles siempre acompañados del nombre largo al menos una vez por vista.

### Proceso de diseño

Un agente de diseño (uno a la vez, sin WebGL headless) hace bocetos en el canvas de las **3 piezas nuevas**: (1) Mapa de posiciones en sus tres modos, (2) selector de formación con «¿Nos encaja?», (3) estadísticas por posición y por sistema — 1 móvil + 1 escritorio cada boceto, respetando la piel Celeste. El usuario elige → diseño completo solo de esas piezas. El resto se integra en código y se revisa con `impeccable` sobre capturas reales.

## 5 · Fases (PRs)

1. **Base**: `lib/positions.ts`, catálogo de formaciones unificado (15), esquemas Zod, reglas + tests de reglas, script de migración, sustituir las 10 copias y la tarjeta compartida del servidor. Sin cambios visuales grandes (las vistas muestran el código exacto si existe).
2. **Pizarra**: encaje por grados en todos los consumidores, «Jugar de» por código, selector de formación con «¿Nos encaja?», rival.
3. **Admin + perfil**: Mapa (editar/ver), propuesta → aprobación, avisos.
4. **Historial y estadísticas**: `positionsPlayed` en `saveMatchSheet` + relleno, stats por posición y por sistema, ficha pública, cromo, club.

Fases 2 y 3 pueden ir en paralelo (2 agentes de código, worktrees separados, sin navegadores). Reglas y funciones se despliegan antes de cada merge. Cada fase actualiza los tests que fijan el comportamiento (listados en el mapeo: `boardLogic`, `quimica`, `familiarity`, `cambios`, `bench`, `pachanga`, `record`, `ratings`, `geometry`/`fit`, `plantillaLogic`/`plantillaBoard`, `convocarModel`, `hoyModel`, `club`, `statsView`, `shareCard`, `schemas`, reglas) y pasa `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:rules` y los e2e afectados.

## Riesgos y decisiones

- **Datos antiguos**: lectura tolerante + migración explícita; `naturalPosition` se mantiene escrito para no romper nada que aún lo lea.
- **Pizarras antiguas**: se leen por índice de casilla con el catálogo corregido; las zonas guardadas en `playerPositions` siguen siendo válidas.
- **Propuestas públicas**: `players` es de lectura pública; una propuesta de posiciones no es sensible.
- **Partidos sin pizarra oficial**: historial «estimado», marcado como tal.
- **Clases CSS de la pizarra**: el CSS generado usa nombres cortos (`.cb`…); los componentes nuevos usan prefijos propios.
