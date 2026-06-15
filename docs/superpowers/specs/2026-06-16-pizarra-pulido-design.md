# La Pizarra — Pulido (Sub-proyecto 4) — Design

Cierre de #2, sobre los sub-proyectos 1–3 (en `main`). Mejoras a lo construido + robustez. UI con `/impeccable` + "Floodlit Clubhouse". Alcance confirmado: **los 4 temas**.

## A · UX táctil / móvil

- **Tácticas en acordeón (móvil):** estado `tacticsOpen`; en móvil un botón "Táctica" colapsa las 7 instrucciones (la barra es muy alta). Sistema + acciones siempre visibles. Escritorio: siempre desplegado (CSS).
- **Drag overlay real:** `<DragOverlay>` de `@dnd-kit/react` con una previa de la camiseta que sigue al cursor; indicadores de drop más marcados; animación de drop por defecto.

## B · Plantilla & bajas

- **Posición natural en toda la plantilla:** panel colapsable "Plantilla" que lista **todos** los jugadores de la temporada con chip de posición siempre visible; admin edita la natural ahí (no solo el XI). Reutiliza `setNaturalPosition`.
- **Bajas:** `active` se añade a `PizarraPlayer` (de `PlayerDoc.active`, default true). El banquillo se divide: activos en el rail normal, **`active===false` en un drawer "Bajas" colapsable**. El sembrado y Auto-XI priorizan activos (el caller ordena los ids: activos primero).

## C · Modo libre & galones

- **Modo libre:** *snap-to-grid* opcional (toggle; al soltar, redondea x/y a una rejilla); rejilla/guías visibles en modo libre con snap; **"Reset posiciones"** (re-aplica las coords de la formación con `applyFormation`).
- **Galones:** brazalete de capitán dibujado sobre la camiseta (overlay CSS en el token cuando el jugador es capitán) + **leyenda** ©/P/F/E en el panel de galones (desde `ROLE_META`).

## D · Robustez & tests

- **A11y:** región `aria-live="polite"` visualmente oculta que anuncia cada colocación ("Kevin a Medio", "Erik al banquillo", "Cambio: Kevin ↔ Josh"); **foco atrapado** + restaurado + Esc en todos los diálogos (ajustes, nombrar, oficial, compartir, comparar) vía hook `useFocusTrap`; auditoría reduced-motion de las animaciones nuevas.
- **Tests (vitest):** extraer la lógica pura del tablero de `Pizarra.tsx` a **`lineupOps.ts`** (`locationOf`, `seedLineup(formation, playerIds)`, `placeIntoSlot`, `sendToBench`, `swapPlayers`, `fillLineup(formation, pinnedInSlot, pool, zoneOf)` — usada por Auto-XI y Sugerir-por-forma) + `XI`. Añadir vitest (entorno node, lógica pura) con tests de `lineupOps` y `chemistry`.

## Notas técnicas / riesgos

- **`lineupOps.ts`** queda independiente de `PizarraPlayer` (opera con ids/SlotState), por eso `seedLineup` toma `playerIds: string[]`; el caller ordena activos-primero. Auto-XI y Sugerir-por-forma se reescriben sobre `fillLineup` (una sola fuente de verdad).
- **vitest + Vite 8:** Vite 8 es muy nuevo. Si el peer de vitest no lo admite limpio: fijar versión compatible o, en último caso, dejar `lineupOps.ts` extraído y testeado con un runner mínimo, reportando el bloqueo. La extracción aporta valor por sí sola.
- **DragOverlay**: API en los tipos de `@dnd-kit/react` (`children` puede ser `(source) => ReactNode`).
- **`useFocusTrap(open, ref, onClose)`**: hook reutilizable (trap Tab, Esc cierra, restaura foco al cerrar). Se aplica a cada componente de diálogo.
- Sin reglas/índices nuevos de Firestore.

## Archivos

**Nuevos:** `src/pages/pizarra/lineupOps.ts` (lógica pura extraída + `fillLineup`), `src/pages/pizarra/useFocusTrap.ts` (hook a11y), `src/pages/pizarra/lineupOps.test.ts` + `src/pages/pizarra/chemistry.test.ts` (vitest), `vitest.config.ts`.

**Modificados:** `Pizarra.tsx` (importar lineupOps, bajas split, panel plantilla, aria-live, free-mode snap/reset, tactics accordion state, DragOverlay, captain prop), `PlayerToken.tsx` (`captain` armband), `PizarraControls.tsx` (tactics accordion toggle + free-mode snap/reset controls), `usePizarraPlayers.ts` (`active`), `LineupsPanel.tsx`/`PizarraSettings.tsx`/`SharePanel.tsx`/`CompareView.tsx` (useFocusTrap), `Pizarra.css` (accordion, drawer, plantilla panel, armband, legend, free-mode grid, drag-overlay, sr-only), `package.json` (vitest dev dep + `test` script).

## Verificación / DoD

`npm run build` + `npm run lint` (+ `npm test` si vitest instala limpio), salida leída. En `?preview`: tácticas colapsan en móvil; DragOverlay sigue al cursor; chips de posición en toda la plantilla + edición admin; drawer de bajas; snap-to-grid + reset en modo libre; brazalete + leyenda; aria-live anuncia; foco atrapado en diálogos; reduced-motion sin animaciones nuevas; claro/oscuro, móvil/escritorio; screenshots; pausa de revisión. **Sin Firestore nuevo.**

## Fuera de alcance

Nada pendiente del roadmap tras esto (se cierra #2). Futuras ideas quedan para nuevas issues.
