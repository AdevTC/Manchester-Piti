# Diseño — La Pizarra · Iteración 2 (Fútbol 7, táctica, roles)

**Fecha:** 2026-06-15
**Proyecto:** Manchester Piti — feature "La Pizarra" (issue #1)
**Estado previo:** Fase 1 (núcleo) construida y verificada. Esta iteración refina la Fase 1
con feedback del usuario e incorpora trozos de las Fases 2-3 (táctica, posición natural).

## 1. Contexto

Tras revisar la Fase 1, el usuario pidió: (a) el equipo es de **fútbol 7**, no 11;
(b) el switch de temporada debe estar también en la Pizarra (selector compartido y "global");
(c) las tácticas como **dropdowns** (no la fila de botones), **adaptadas a F7**, con más opciones
al lado; (d) en los galones, **fuera MVP**; (e) **posición/rol por jugador**, seleccionable por
jugador (posición natural guardada + override por alineación); (f) un **brainstorming** de más
funcionalidades, incluido un panel de **ajustes de pizarra** (elegir qué mostrar).

Todas las opcionales del brainstorming (A–H) entran en esta iteración.

## 2. Objetivos / No-objetivos

**Objetivos**
- Convertir el tablero a **fútbol 7** (1 POR + 6 de campo, 7 slots).
- Selector de temporada **compartido** en la cabecera de Plantilla (ambos modos).
- Controles como **dropdowns**: formación F7 + instrucciones tácticas F7.
- **Posición natural** por jugador (guardada, admin) + **override por alineación**; señal de **fuera de posición**.
- Galones sin MVP: capitán, penaltis, faltas, córners.
- Opcionales A–H (ver §8).

**No-objetivos (siguen en fases posteriores)**
- Persistencia completa de `lineups` (guardar/cargar/borrar tableros, alineación oficial).
- Química/valoración determinista, export PNG/Web Share, comparar, vincular a partido, stats por línea.
- (La única escritura nueva en Firestore aquí es el campo `naturalPosition` del jugador.)

## 3. Fútbol 7 — formaciones

7 jugadores = **1 POR + 6 de campo**. Notación sin el portero (los 6 de campo suman 6). El equipo
ataca hacia arriba (delanteros arriba, portero abajo). Slots como `% (x,y)` del campo.

Sistemas (orden de slots: índice 0 = POR, luego DEF izq→der, MED, DEL — mantiene el morph por índice):

| Sistema | Líneas | Carácter |
|---|---|---|
| **2-3-1** | 2 DEF · 3 MED · 1 DEL | Equilibrado (el más común) |
| **3-2-1** | 3 DEF · 2 MED · 1 DEL | Sólido / defensivo |
| **3-1-2** | 3 DEF · 1 MED · 2 DEL | Defensa firme, dos puntas |
| **2-1-3** | 2 DEF · 1 MED · 3 DEL | Ofensivo |
| **1-3-2** | 1 DEF · 3 MED · 2 DEL | Muy ofensivo / posesión |
| **2-1-2-1** | 2 DEF · rombo medio · 1 DEL | Rombo en el medio |

Cada slot tiene una **etiqueta** (POR, LD, DFC, LI, MC, MI, MD, MCO, ED, EI, DC) y una **zona**
∈ {POR, DEF, MED, DEL} usada para la señal de fuera-de-posición. Coordenadas concretas en
`formations.ts` (reescrito para F7). El banquillo recibe a los no titulares (plantilla F7 suele
tener 10-14 jugadores → banquillo de varios).

## 4. Controles — dropdowns (sustituyen la fila de botones)

Fila superior de la Pizarra, todo `<select>`/dropdown accesibles (nativos, gold focus ring):

- **Sistema** (formación): los 6 de §3. Cambiarlo dispara el morph (View Transitions) — sin cambios.
- **Instrucciones tácticas** (cada una un dropdown):
  - **Línea defensiva:** Baja / Media / Alta
  - **Presión:** Repliegue / Media / Alta
  - **Amplitud:** Estrecha / Media / Amplia
  - **Ritmo:** Pausado / Medio / Rápido
  - **Mentalidad:** Defensiva / Equilibrada / Ofensiva
  - **Salida de balón:** Corta / Mixta / En largo  ← "más opciones"
  - **Foco de ataque:** Bandas / Centro / Equilibrado  ← "más opciones"
- Toggle **Libre** y **Reiniciar** se mantienen.

Por defecto cada instrucción arranca en su valor medio/equilibrado. Estado en memoria (parte del
`Lineup`, se persistirá en la fase de persistencia). Estilo gráfico-de-TV de marca (Anton para
títulos, gap-gridlines), no formulario SaaS.

## 5. Posición por jugador (natural + override)

- **Zonas:** POR / DEF / MED / DEL (cuatro), suficientes para detectar fuera-de-posición.
- **Posición natural** (`player.naturalPosition`): atributo del jugador, **editable inline en la
  Pizarra solo por admin/superadmin** (gate en cliente como el resto de la app), guardado en
  Firestore (`players/{id}`). En `?preview` la sesión es admin → testeable.
- **Override por alineación** (`lineup.playerPositions[playerId]`): cualquiera puede, en su tablero,
  asignar a un jugador una posición distinta de la natural; vive en el `Lineup` (memoria ahora).
- **Posición efectiva** = override ?? natural. **Fuera de posición** = `zona(efectiva) ≠ zona(slot)`
  y la posición efectiva está definida. Señal **no-cromática** (p. ej. aro punteado + glifo "≠"),
  nunca solo color.
- UI de selección: al activar un jugador (o vía un control de la ficha), un dropdown de posición.
  El de natural aparece solo si eres admin; el override siempre.

## 6. Galones

`roles = { captainId?, penaltiesId?, freekicksId?, cornersId? }` — **se elimina `motmId` (MVP)**.
Sellos dorados con glifo no-cromático (©, P, F, E). Selects en el panel "Galones" (sin cambios de
patrón, solo quitar MVP).

## 7. Selector de temporada compartido

- Se sube un **único selector de temporada** a la cabecera del shell `Plantilla.tsx`, visible y
  activo en ambos modos. Escribe `selectedSeasonId` en `SeasonContext` (sin cambios de contexto).
- **Expedientes** deja de renderizar su barra `.exp-periodo` (la sustituye el selector compartido).
- Forma: dropdown o segmented de temporadas + "Histórico Total", estilo de marca. Persistencia ya
  la da `SeasonContext` (localStorage).

## 8. Opcionales del brainstorming (todas dentro)

- **A · Ajustes de pizarra:** popover (icono ajustes) con toggles de qué mostrar en cada ficha
  (dorsal, nombre, posición efectiva, galones) y del campo (etiquetas de slot vacío, señal
  fuera-de-posición on/off). Persistido en `localStorage` (`mp_pizarra_settings`). Hook `usePizarraSettings`.
- **B · Fuera de posición:** ver §5 (señal no-cromática). Respeta el toggle de A.
- **C · Validación del once:** contador "X/7 en el campo"; aviso de slots vacíos. (No hay duplicados:
  un jugador está en un único sitio.)
- **D · Auto-XI:** coloca a los jugadores en el sistema actual emparejando posición efectiva con la
  zona del slot (greedy; rellena por zona y luego cualquiera), con morph. Respeta jugadores fijados.
- **E · Fijar jugador (pin):** `lineup.pinned: string[]`. Un jugador fijado no lo mueve el cambio de
  formación ni Auto-XI. Indicador no-cromático (candado) en la ficha.
- **F · Buscar/filtrar banquillo:** input de búsqueda por nombre + filtro por zona; filtra el rail.
- **G · Deshacer/rehacer:** pila de estados de `Lineup` (cap ~30). Botones + teclado (Ctrl+Z / Ctrl+Y).
  No incluye escrituras de posición natural (esas son acción aparte).
- **H · Modo presentación:** toggle que oculta controles/banquillo/galones y muestra el campo + XI
  limpio (escala mayor); Esc para salir. Antesala del "show & share" (Fase 4).

## 9. Modelo de datos

```ts
// players/{id} — NUEVO campo
naturalPosition?: "POR" | "DEF" | "MED" | "DEL";

// Lineup (en memoria; se persistirá en la fase de persistencia)
type Zone = "POR" | "DEF" | "MED" | "DEL";
type FormationName = "2-3-1" | "3-2-1" | "3-1-2" | "2-1-3" | "1-3-2" | "2-1-2-1";
interface SlotState { slotId; position: string; zone: Zone; x; y; playerId: string | null }
interface Tactics { defLine; press; width; tempo; mentality; buildup; attackFocus } // enums string
interface Roles { captainId?; penaltiesId?; freekicksId?; cornersId? }              // sin motm
interface Lineup {
  formation: FormationName; freeMode: boolean;
  slots: SlotState[]; bench: string[]; roles: Roles; tactics: Tactics;
  playerPositions: Record<string, Zone>;  // override por alineación
  pinned: string[];
}
// Ajustes de visualización (localStorage, no en Lineup)
interface PizarraSettings { showNumber; showName; showPosition; showGalones; showEmptyLabels; showOutOfPosition: boolean }
```

## 10. Reglas de Firestore (entregar al usuario)

No existe archivo de reglas en el repo (las activas viven en la consola de Firebase). La única
escritura nueva es `players/{id}.naturalPosition`, **gateada a admin/superadmin**. Entregaré el
fragmento de regla para pegar en la consola, p. ej.:

```
match /players/{playerId} {
  allow read: if request.auth != null;
  allow update: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','superadmin'];
}
```

(Se entrega como texto; no se asume que el repo deba contener el archivo de reglas todavía.)

## 11. Archivos

**Nuevos**
- `src/pages/pizarra/tactics.ts` — definiciones/tipos de instrucciones tácticas + zonas/posiciones.
- `src/pages/pizarra/usePizarraSettings.ts` — ajustes de visualización (localStorage).
- `src/pages/pizarra/PizarraControls.tsx` — fila de dropdowns (sistema + instrucciones).
- `src/pages/pizarra/PizarraSettings.tsx` — popover de ajustes.
- `src/components/SeasonSelector.tsx` (o en el shell) — selector compartido de temporada.

**Modificados**
- `src/pages/pizarra/formations.ts` — sistemas F7, zonas, etiquetas; `Roles` sin motm; tipos Tactics.
- `src/pages/pizarra/Pizarra.tsx` — 7 slots, tactics/override/pin/undo-redo/auto-XI/presentación/validación, wiring de ajustes y fuera-de-posición.
- `src/pages/pizarra/PlayerToken.tsx` — respeta ajustes de visualización; señal fuera-de-posición; pin; selector de posición (natural admin + override).
- `src/pages/pizarra/PitchSlot.tsx` — zona; etiqueta de slot vacío según ajuste.
- `src/pages/pizarra/usePizarraPlayers.ts` — exponer `naturalPosition`; setter admin (escritura Firestore).
- `src/pages/pizarra/Pizarra.css` — dropdowns, popover, modo presentación, fuera-de-posición, pins, filtro banquillo.
- `src/pages/Plantilla.tsx` — selector de temporada compartido en la cabecera.
- `src/pages/Expedientes.tsx` — quitar la barra `.exp-periodo` (la sustituye el selector compartido).

## 12. Accesibilidad y sistema de diseño

- Dropdowns `<select>` nativos (operables por teclado), labels uppercase Archivo, foco gold.
- Señales **no-cromáticas** en fuera-de-posición, pins y galones (glifo + color).
- `prefers-reduced-motion` en morph, Auto-XI y modo presentación.
- Dos temas `--mp-*`; flat-print; respeta todos los "Don'ts". Copy en español. Móvil = lienzo primario.

## 13. Verificación (DoD de la iteración)

- `npm run build` (tsc + vite) y lint de archivos nuevos/modificados **pasan**; salida leída y pegada.
- Navegador (`?preview`): F7 (7 slots), cambio de sistema + morph, cada instrucción táctica, asignar
  posición natural (admin) + override + señal fuera-de-posición, galones sin MVP, selector de
  temporada en ambos modos, ajustes (toggles), Auto-XI, pin, filtro banquillo, deshacer/rehacer,
  modo presentación. Claro/oscuro, móvil/escritorio, reduced-motion. Screenshots.
- Entregar el texto de reglas Firestore. Sin `any`. Pausa para revisión.

## 14. Riesgos / notas

- La escritura de `naturalPosition` adelanta un trozo de persistencia (un campo, admin-gated).
  Si se prefiere, puede degradarse a solo-memoria, pero el diseño confirmado la guarda.
- Densidad de controles: muchos dropdowns; en móvil se apilan/colapsan (acordeón o scroll).
