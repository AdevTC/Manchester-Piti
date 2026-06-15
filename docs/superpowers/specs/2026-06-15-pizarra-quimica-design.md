# La Pizarra — Química / valoración del once (Sub-proyecto 2) — Design

Continuación de #2. Construye, sobre el tablero ya persistente (Sub-proyecto 1, en `main`), una **valoración determinista del once** y las piezas asociadas. Todo el dato sale de stats reales del club; **nunca se inventa** (si falta, se dice). UI con `/impeccable` + "Floodlit Clubhouse".

## Alcance (confirmado: las 4 piezas)

1. **Química / valoración del once** — número 0–100 con count-up + desglose visual + racional.
2. **Stats por línea** — banda DEF/MED/DEL agregando a los del campo.
3. **Sugerir XI por forma reciente** — botón que rellena por rendimiento reciente, no solo posición.
4. **Disponibilidad** — sancionados (derivado de tarjetas) + lesionados (flag admin), con aviso al alinear.

## Decisión: reutilización de stats (confirmada)

`computeStats` + tipos + el recorrido de eventos se **extraen** de `Expedientes.tsx` a **`src/lib/playerStats.ts`** (movimiento verbatim, sin cambio de comportamiento). Expedientes pasa a importar de ahí. La química construye encima. Una sola fuente de verdad (DRY).

## Modelo de eventos (existente, no se toca)

Tipos en `match.events[]`: `goal`, `goal_penalty`, `goal_freekick`, `own_goal`, `assist`, `yellow_card`, `red_card`, `double_yellow`, `penalty_saved`, `penalty_missed`, `woodwork`. `matchesPlayed` se infiere de aparecer en algún evento. `PlayerStats` ya agrega goles (con desglose), asistencias, PJ, amarillas, rojas, dobles, paradas de penalti, autogoles, maderos.

## Fórmula de valoración (determinista, pura)

Base de normalización = **la plantilla de la temporada activa** (todos los jugadores), así el número es relativo al propio club y no se fabrica nada.

Máximos de plantilla: `maxGA = max(g+a)`, `maxPJ = max(PJ)`, `maxSeasons = max(nº temporadas)`, `maxCards = max(yc + 2·rc)`.

Por jugador colocado en el campo:
- `prod = (g+a)/maxGA` (0 si `maxGA==0`)
- `exp = 0.5·(seasons/maxSeasons) + 0.5·(PJ/maxPJ)`
- `disc = 1 − (yc + 2·rc)/maxCards` (1 = limpio; 0 = peor expediente)

Componentes de equipo (media sobre los colocados):
- `P = mean(prod)`, `E = mean(exp)`, `D = mean(disc)`
- `base = 0.50·P + 0.25·E + 0.25·D` (0..1)

Encaje:
- `oop` = colocados cuyo `effectiveZone ≠ slot.zone`
- `empty` = huecos (7 − colocados)
- `fit = clamp(1 − 0.05·oop − 0.12·empty, 0.4, 1)`

`score = round(100 · base · fit)`.

Tier: `≥80 Élite · ≥65 Sólido · ≥50 Competitivo · resto En construcción`.

`missing` = colocados con `PJ==0` (sin historial): cuentan con `prod/exp = 0` (no se inventa) y se avisan en el racional. Racional = driver principal (P/E/D mayor) + flags `{oop} fuera de posición`, `{empty} hueco(s)`, `{missing} sin historial`.

Desglose visual: radar/huella de 4 ejes **Producción · Experiencia · Disciplina · Encaje** (`fit`). Pesos y umbrales afinables en revisión.

## Stats por línea

Agrupar colocados por `slot.zone`. POR aparte; DEF/MED/DEL como 3 columnas con `ΣG+A`, `ΣPJ`, disciplina y nº de jugadores. Sin datos inventados (un jugador sin stats suma 0 y no rompe el agregado).

## Sugerir XI por forma reciente

`recentForm(matches, n=5)` → por jugador, suma sobre los últimos `n` partidos (por fecha): `2·goles + asistencias − 0.5·amarillas − 2·rojas`. `suggestXI`: como Auto-XI pero, por zona, elige a los de mayor forma cuyo `effectiveZone` casa; rellena el resto por forma global. Respeta fijados. No persiste por sí solo (pasa por `commit`, autosave si hay tablero activo).

## Disponibilidad

- **Sancionado** (derivado, determinista): en el partido más reciente (por fecha) en que el jugador tiene eventos, si hay `red_card` o `double_yellow` → sancionado (siguiente partido). Heurística para F7 amateur.
- **Lesionado**: flag manual `players.injured: boolean`, editable por admin desde el panel de posiciones (como `naturalPosition`). La regla Firestore de `players` ya permite `update` admin — **sin cambios de reglas**.
- Señal **no-cromática** (glifo + texto) en el token; aviso agregado ("⚠ N no disponibles alineados") en el panel/estado al colocar a alguien no disponible. Nunca bloquea (solo avisa).

## Archivos

**Nuevos:** `src/lib/playerStats.ts` (extracción pura), `src/pages/pizarra/chemistry.ts` (puro: `teamRating`/`lineStats`/`recentForm`/`suspensionFrom`), `src/pages/pizarra/usePizarraStats.ts` (partidos+eventos de la temporada → `statsById` + forma), `src/pages/pizarra/ChemistryPanel.tsx` (número + radar + banda por línea + racional).

**Modificados:** `src/pages/Expedientes.tsx` (importa de `playerStats.ts`; sin cambio de comportamiento), `src/pages/pizarra/Pizarra.tsx` (render panel, botón "Forma", badges/avisos, toggle lesionado admin), `src/pages/pizarra/PlayerToken.tsx` (badge sancionado/lesionado), `src/pages/pizarra/PizarraControls.tsx` (botón "Sugerir por forma"), `src/pages/pizarra/usePizarraPlayers.ts` (`injured?` + `setInjured` admin), `src/pages/pizarra/Pizarra.css`.

## Verificación / DoD

`npm run build` + `npm run lint` (salida leída). En `?preview`: el número reacciona a cambios del once (count-up), tiers correctos, racional y caveats con datos faltantes; stats por línea; "Sugerir por forma" coloca por rendimiento y respeta fijados; sancionado (derivado) y lesionado (toggle admin) muestran badge + aviso; claro/oscuro, móvil/escritorio, reduced-motion; consola limpia; screenshots; pausa de revisión. Sin reglas/índices nuevos de Firestore.

## Fuera de alcance

Sub-proyecto 3 (póster/compartir/presentación) y 4 (pulido, tests vitest de la lógica pura — los archivos `chemistry.ts`/`playerStats.ts` se dejan estructurados para ello).
