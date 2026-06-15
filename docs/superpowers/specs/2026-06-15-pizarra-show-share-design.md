# La Pizarra — Show & share (Sub-proyecto 3) — Design

Continuación de #2, sobre el tablero persistente (Sub-proyecto 1) y la química (Sub-proyecto 2), ambos en `main`. Añade los momentos "wow"/compartibles. UI con `/impeccable` + "Floodlit Clubhouse". Alcance confirmado: **las 5 piezas**.

## Enfoque de exportación (sin dependencias)

context7 no está conectado y la issue gatea `html-to-image`/`modern-screenshot` tras él. En su lugar el póster se **dibuja directamente en `<canvas>` 2D**: la página ya carga Anton/Archivo, así que tras `await document.fonts.ready` `ctx.fillText` usa esas fuentes. `canvas.toBlob()` → **Web Share API nivel 2** (`navigator.canShare?.({ files })` → `navigator.share`), con **descarga** (anchor + objectURL) como fallback. Determinista, control de píxel, cero deps nuevas. Web Share es API de navegador estable; se usa con feature-detection.

## Piezas

**1 · Póster PNG + compartir.** `poster.ts` (sin React) dibuja un matchday vertical **1080×1350** @2x: fondo navy + halftone, título Anton + temporada + sistema, campo con líneas de cal, **camisetas estilizadas** por slot (dorsal + nombre, posición por color sky), **número de química + tier**, crest (`/crest.png`), y si hay partido vinculado su **marcador**. `SharePanel.tsx` muestra vista previa (la imagen renderizada) + **Compartir** (móvil) / **Descargar**. Nunca inventa: si faltan datos, el póster los omite.

**2 · Presentación del XI (broadcast).** Amplía el `presentMode` existente: cabecera de retransmisión (crest + "MANCHESTER PITI" + sistema + **química con `FlapNumber`**) y **revelado escalonado** de camisetas (rise con `--i`, una a una, estilo Champions). Reduced-motion → todo visible a la vez (FlapNumber ya lo respeta); el revelado realza un estado ya visible (no oculta contenido de forma permanente).

**3 · Barrido de floodlight.** Pasada de luz one-shot al entrar al campo / a presentación: `::after` con gradiente sky que cruza una vez. El `FloodlightCanvas` ambiental se queda. Sin barrido bajo reduced-motion.

**4 · Comparar dos alineaciones ("tale of the tape").** `CompareView.tsx`: eliges tablero A y B (de `useLineups`: míos + oficiales), dos columnas con VS central enfrentando química, tier, stats por línea y sistema. Helper `ratingForLineupDoc(doc, statsById, playersById, norms)` en `chemistry.ts` (reutiliza `teamRating`/`lineStats` construyendo `PlacedPlayer[]` desde los slots del doc + posición natural/override).

**5 · Vincular a partido + marcador.** El tablero gana `matchId` en estado (cargado del doc). "Vincular a partido" lo fija desde los `matches` de la temporada y **autoguarda** (`save` persiste `matchId` desde el estado, no solo vía oficial). Banda de **marcador** sobre el campo y en el póster: rival · GF-GC · resultado con `outcomeOf`/`OUTCOME` de `components/match/matchData` (palabra + **letra V/E/D** no-cromática). 

## Datos y reutilización

- Química/stats: `usePizarraStats` (statsById, norms) + `chemistry.ts` ya en `main`.
- Partidos: `useSeasonMatches` (rival, GF, GC, fecha) ya existe; el selector de vincular y el marcador lo reutilizan.
- Tableros: `useLineups` (míos + oficiales) para el comparador.
- Primitivas: `FlapNumber`, `FloodlightCanvas`, `useReveal`, `presentMode`, `outcomeOf`/`OUTCOME`, `/crest.png`.

## Archivos

**Nuevos:** `src/pages/pizarra/poster.ts` (dibujo canvas + export + share), `src/pages/pizarra/SharePanel.tsx` (preview + descargar/compartir), `src/pages/pizarra/CompareView.tsx` (tale-of-the-tape).

**Modificados:** `src/pages/pizarra/chemistry.ts` (`ratingForLineupDoc` helper), `src/pages/pizarra/Pizarra.tsx` (broadcast reveal + FlapNumber en present, floodlight sweep, `matchId` en estado + vincular, botones compartir/comparar, banda de marcador), `src/pages/pizarra/useLineups.ts` (persistir `matchId` desde estado en `save`), `src/pages/pizarra/PizarraControls.tsx` (botones compartir/comparar/vincular), `src/pages/pizarra/Pizarra.css` (póster dialog, presentación broadcast + reveal, sweep, compare, banda de marcador).

## Verificación / DoD

`npm run build` + `npm run lint` (salida leída). En `?preview`: exportar póster (descarga) + detección de Web Share; presentación con revelado + química FlapNumber; barrido floodlight; comparar A vs B (química/líneas/sistema); vincular partido + marcador con letra V/E/D; claro/oscuro, móvil/escritorio, **reduced-motion** (sin sweep ni stagger, póster idéntico); consola limpia; screenshots; pausa de revisión. **Sin reglas/índices nuevos de Firestore.**

## Fuera de alcance

Sub-proyecto 4 (pulido: bajas drawer, drag overlay, posición natural en toda la plantilla, snap-to-grid, brazalete dibujado, ARIA live de drag, vitest de la lógica pura).
