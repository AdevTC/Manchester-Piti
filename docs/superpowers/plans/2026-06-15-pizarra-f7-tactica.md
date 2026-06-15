# La Pizarra · Iteración 2 (Fútbol 7, táctica, roles) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar la Pizarra (Fase 1) a fútbol 7, con controles tácticos en dropdown, posición por jugador (natural + override) y un set de funcionalidades (ajustes, validación, Auto-XI, pin, filtro, undo/redo, presentación), más un selector de temporada compartido.

**Architecture:** Se extiende el subsistema existente `src/pages/pizarra/`. El estado del tablero vive en un `Lineup` en memoria dentro de `Pizarra.tsx` (la persistencia sigue siendo de una fase posterior); la única escritura nueva en Firestore es `players/{id}.naturalPosition` (gateada a admin). El selector de temporada sube al shell `Plantilla.tsx` y usa `SeasonContext`.

**Tech Stack:** React 19 + Vite + TS estricto, `@dnd-kit/react` 0.5.0, Firebase Firestore (`onSnapshot`/`updateDoc`), `lucide-react`, CSS por componente + tokens `--mp-*`. Sin Tailwind, sin router.

**Verification model (no hay test runner):** por tarea → `npm run build` (tsc + vite) + `npm run lint` (de los archivos tocados) + verificación en navegador con las preview tools en `?preview` sobre `#plantilla` (modo Pizarra) + commit. Spec de referencia: `docs/superpowers/specs/2026-06-15-pizarra-f7-tactica-design.md`.

**Nota de git:** estamos en `main` con árbol sucio. Antes del primer commit, crear rama de feature y `git add` solo los archivos de cada tarea (nunca `git add -A`). Confirmar con el usuario antes del primer commit.

---

## File Structure

**Nuevos**
- `src/pages/pizarra/tactics.ts` — defs/tipos de instrucciones tácticas + zonas/posiciones F7.
- `src/pages/pizarra/usePizarraSettings.ts` — ajustes de visualización (localStorage).
- `src/pages/pizarra/PizarraControls.tsx` — fila de dropdowns (sistema + instrucciones).
- `src/pages/pizarra/PizarraSettings.tsx` — popover de ajustes (qué mostrar).
- `src/components/SeasonSelector.tsx` — selector de temporada compartido (usa `SeasonContext`).

**Modificados**
- `src/pages/pizarra/formations.ts` — sistemas F7, zonas, etiquetas, 7 slots; `Roles` sin `motm`; tipos `Tactics`/`Zone`; `Lineup` con `tactics`/`playerPositions`/`pinned`.
- `src/pages/pizarra/Pizarra.tsx` — 7 slots, tactics/override/pin/undo-redo/auto-XI/presentación/validación, wiring de ajustes + fuera-de-posición.
- `src/pages/pizarra/PlayerToken.tsx` — respeta ajustes; señal fuera-de-posición; pin; selector de posición.
- `src/pages/pizarra/PitchSlot.tsx` — `zone`; etiqueta de slot vacío según ajuste.
- `src/pages/pizarra/usePizarraPlayers.ts` — exponer `naturalPosition`; setter admin (Firestore).
- `src/pages/pizarra/Pizarra.css` — dropdowns, popover, modo presentación, fuera-de-posición, pins, filtro.
- `src/pages/Plantilla.tsx` — montar `SeasonSelector` en la cabecera (ambos modos).
- `src/pages/Expedientes.tsx` — quitar la barra `.exp-periodo` (la sustituye el selector compartido).

---

## Task 1: Convertir a Fútbol 7 (datos + tipos)

**Files:**
- Modify: `src/pages/pizarra/formations.ts`
- Modify: `src/pages/pizarra/PitchSlot.tsx` (añadir `zone` a `SlotData` no es necesario; el slot ya lleva `position`; añadir `zone` a `SlotState`)
- Modify: `src/pages/pizarra/Pizarra.tsx` (`XI` 11→7; quitar `motm`)
- Modify: `src/pages/pizarra/PlayerToken.tsx` (sin `motm` en glifos — ya viene de `ROLE_META`)

- [ ] **Step 1: Reescribir `formations.ts` a F7.** Tipos y datos:

```ts
export type Zone = "POR" | "DEF" | "MED" | "DEL";
export type FormationName = "2-3-1" | "3-2-1" | "3-1-2" | "2-1-3" | "1-3-2" | "2-1-2-1";
export const FORMATION_NAMES: FormationName[] = ["2-3-1","3-2-1","3-1-2","2-1-3","1-3-2","2-1-2-1"];
export interface SlotDef { position: string; zone: Zone; x: number; y: number }
export interface SlotState extends SlotDef { slotId: string; playerId: string | null }
export interface Roles { captainId?: string; penaltiesId?: string; freekicksId?: string; cornersId?: string }
export type RoleKey = keyof Roles;

export const FORMATIONS: Record<FormationName, SlotDef[]> = {
  "2-3-1": [
    { position:"POR", zone:"POR", x:50, y:90 },
    { position:"DFC", zone:"DEF", x:33, y:75 }, { position:"DFC", zone:"DEF", x:67, y:75 },
    { position:"MI", zone:"MED", x:22, y:52 }, { position:"MC", zone:"MED", x:50, y:54 }, { position:"MD", zone:"MED", x:78, y:52 },
    { position:"DC", zone:"DEL", x:50, y:22 },
  ],
  "3-2-1": [
    { position:"POR", zone:"POR", x:50, y:90 },
    { position:"LD", zone:"DEF", x:24, y:74 }, { position:"DFC", zone:"DEF", x:50, y:77 }, { position:"LI", zone:"DEF", x:76, y:74 },
    { position:"MC", zone:"MED", x:36, y:52 }, { position:"MC", zone:"MED", x:64, y:52 },
    { position:"DC", zone:"DEL", x:50, y:22 },
  ],
  "3-1-2": [
    { position:"POR", zone:"POR", x:50, y:90 },
    { position:"LD", zone:"DEF", x:24, y:74 }, { position:"DFC", zone:"DEF", x:50, y:77 }, { position:"LI", zone:"DEF", x:76, y:74 },
    { position:"MC", zone:"MED", x:50, y:53 },
    { position:"DC", zone:"DEL", x:35, y:23 }, { position:"DC", zone:"DEL", x:65, y:23 },
  ],
  "2-1-3": [
    { position:"POR", zone:"POR", x:50, y:90 },
    { position:"DFC", zone:"DEF", x:33, y:75 }, { position:"DFC", zone:"DEF", x:67, y:75 },
    { position:"MC", zone:"MED", x:50, y:55 },
    { position:"ED", zone:"DEL", x:22, y:24 }, { position:"DC", zone:"DEL", x:50, y:20 }, { position:"EI", zone:"DEL", x:78, y:24 },
  ],
  "1-3-2": [
    { position:"POR", zone:"POR", x:50, y:90 },
    { position:"DFC", zone:"DEF", x:50, y:76 },
    { position:"MI", zone:"MED", x:24, y:52 }, { position:"MC", zone:"MED", x:50, y:54 }, { position:"MD", zone:"MED", x:76, y:52 },
    { position:"DC", zone:"DEL", x:35, y:24 }, { position:"DC", zone:"DEL", x:65, y:24 },
  ],
  "2-1-2-1": [
    { position:"POR", zone:"POR", x:50, y:90 },
    { position:"DFC", zone:"DEF", x:33, y:76 }, { position:"DFC", zone:"DEF", x:67, y:76 },
    { position:"MCD", zone:"MED", x:50, y:62 },
    { position:"MC", zone:"MED", x:28, y:46 }, { position:"MC", zone:"MED", x:72, y:46 },
    { position:"DC", zone:"DEL", x:50, y:22 },
  ],
};

export const slotIdFor = (i: number) => `pz-slot-${i}`;
export function emptySlots(f: FormationName): SlotState[] {
  return FORMATIONS[f].map((d, i) => ({ ...d, slotId: slotIdFor(i), playerId: null }));
}
export function applyFormation(slots: SlotState[], f: FormationName): SlotState[] {
  return FORMATIONS[f].map((d, i) => ({ ...d, slotId: slotIdFor(i), playerId: slots[i]?.playerId ?? null }));
}
```

  Y `ROLE_META` sin MVP (quitar la entrada `motmId`):

```ts
export const ROLE_META: RoleMeta[] = [
  { key:"captainId", label:"Capitán", glyph:"©", aria:"Capitán" },
  { key:"penaltiesId", label:"Penaltis", glyph:"P", aria:"Lanzador de penaltis" },
  { key:"freekicksId", label:"Faltas", glyph:"F", aria:"Lanzador de faltas" },
  { key:"cornersId", label:"Córners", glyph:"E", aria:"Lanzador de córners" },
];
```

- [ ] **Step 2: `Pizarra.tsx`** — cambiar `const XI = 11` → `const XI = 7`. `DEFAULT_FORMATION = "2-3-1"`. Quitar cualquier referencia a `motmId`. (El resto de la lógica de slots es agnóstica al número.)

- [ ] **Step 3: build + lint.**
Run: `npm run build` → Expected: PASS (sin errores de tipos; `motm` ya no existe).
Run: `npx eslint src/pages/pizarra` → Expected: clean.

- [ ] **Step 4: Verificar en navegador.** Preview en `?preview` → Pizarra: 7 slots, sistema 2-3-1 por defecto, banquillo con el resto. `preview_eval`: `document.querySelectorAll('.pz-slot').length === 7`.

- [ ] **Step 5: Commit.** `git add src/pages/pizarra/formations.ts src/pages/pizarra/Pizarra.tsx` → `git commit -m "feat(pizarra): convert board to fútbol 7 (7 slots, F7 systems)"`

---

## Task 2: Controles en dropdown + instrucciones tácticas

**Files:**
- Create: `src/pages/pizarra/tactics.ts`
- Create: `src/pages/pizarra/PizarraControls.tsx`
- Modify: `src/pages/pizarra/formations.ts` (añadir `Tactics` + `defaultTactics`, extender `Lineup`)
- Modify: `src/pages/pizarra/Pizarra.tsx` (estado `tactics`, render `<PizarraControls/>`, quitar la fila de botones)
- Modify: `src/pages/pizarra/Pizarra.css` (estilos de la fila de dropdowns)

- [ ] **Step 1: `tactics.ts`** — defs de instrucciones:

```ts
export type TacticKey = "defLine"|"press"|"width"|"tempo"|"mentality"|"buildup"|"attackFocus";
export interface TacticDef { key: TacticKey; label: string; options: string[]; def: string }
export const TACTICS: TacticDef[] = [
  { key:"defLine", label:"Línea defensiva", options:["Baja","Media","Alta"], def:"Media" },
  { key:"press", label:"Presión", options:["Repliegue","Media","Alta"], def:"Media" },
  { key:"width", label:"Amplitud", options:["Estrecha","Media","Amplia"], def:"Media" },
  { key:"tempo", label:"Ritmo", options:["Pausado","Medio","Rápido"], def:"Medio" },
  { key:"mentality", label:"Mentalidad", options:["Defensiva","Equilibrada","Ofensiva"], def:"Equilibrada" },
  { key:"buildup", label:"Salida de balón", options:["Corta","Mixta","En largo"], def:"Mixta" },
  { key:"attackFocus", label:"Foco de ataque", options:["Bandas","Centro","Equilibrado"], def:"Equilibrado" },
];
export type Tactics = Record<TacticKey, string>;
export const defaultTactics = (): Tactics =>
  Object.fromEntries(TACTICS.map(t => [t.key, t.def])) as Tactics;
```

  En `formations.ts`, extender `Lineup` (importando `Tactics` desde `tactics.ts` o re-declarando): añadir `tactics: Tactics`, `playerPositions: Record<string, Zone>`, `pinned: string[]`.

- [ ] **Step 2: `PizarraControls.tsx`** — props `{ formation, onFormation, freeMode, onToggleFree, tactics, onTactic, onReset }`. Render: dropdown de **Sistema** (`FORMATION_NAMES`), un `<select>` por cada `TACTICS` (label uppercase Archivo encima, valor de `tactics[key]`, `onTactic(key, value)`), y los botones Libre/Reiniciar. Foco gold; agrupados en una barra con gap-gridlines.

- [ ] **Step 3: `Pizarra.tsx`** — añadir `tactics` al estado inicial (`defaultTactics()`); handler `setTactic(key,val)`; sustituir la `.pz-controls`/`.pz-forms` actuales por `<PizarraControls .../>`. `changeFormation` sigue igual (dropdown llama a `onFormation`).

- [ ] **Step 4: CSS** — `.pz-controls` como barra de dropdowns (label uppercase Archivo, select de marca, gap-gridline). Responsive: en móvil se apilan/scroll.

- [ ] **Step 5: build + lint + navegador.** Verificar: dropdown de sistema cambia formación con morph; los 7 dropdowns tácticos cambian valor (`preview_eval` del `<select>`). build PASS, lint clean.

- [ ] **Step 6: Commit.** `git add src/pages/pizarra/tactics.ts src/pages/pizarra/PizarraControls.tsx src/pages/pizarra/formations.ts src/pages/pizarra/Pizarra.tsx src/pages/pizarra/Pizarra.css` → `git commit -m "feat(pizarra): formation + F7 tactics as dropdowns"`

---

## Task 3: Selector de temporada compartido

**Files:**
- Create: `src/components/SeasonSelector.tsx`
- Modify: `src/pages/Plantilla.tsx` (montar el selector en la cabecera, sobre el toggle de modo)
- Modify: `src/pages/Expedientes.tsx` (eliminar el bloque `.exp-periodo`)
- Modify: `src/pages/Plantilla.css` (estilos del selector si hace falta)

- [ ] **Step 1: `SeasonSelector.tsx`** — usa `useSeason()`. Render: label "Temporada" + dropdown/segmented con "Histórico Total" + `seasons`, `aria-pressed`/`value` = `selectedSeasonId`, `onChange` → `setSelectedSeasonId`. Estilo de marca (sky activo). Reutiliza el patrón visual de `.exp-periodo-btn`.

- [ ] **Step 2: `Plantilla.tsx`** — renderizar `<SeasonSelector/>` en `.pl-shell` por encima de `.pl-modes` (cabecera compartida). Sin tocar la lógica de modo.

- [ ] **Step 3: `Expedientes.tsx`** — eliminar el JSX `{seasons.length > 0 && (<div className="exp-periodo">…</div>)}`. Expedientes sigue leyendo `selectedSeasonId` del contexto (sin cambios de datos).

- [ ] **Step 4: build + lint + navegador.** Verificar: el selector aparece en ambos modos; cambiar temporada actualiza Expedientes y Pizarra; Expedientes ya no muestra su barra de período.

- [ ] **Step 5: Commit.** `git add src/components/SeasonSelector.tsx src/pages/Plantilla.tsx src/pages/Expedientes.tsx src/pages/Plantilla.css` → `git commit -m "feat(plantilla): shared season selector across modes"`

---

## Task 4: Posición por jugador (natural + override) + fuera de posición

**Files:**
- Modify: `src/pages/pizarra/usePizarraPlayers.ts` (exponer `naturalPosition`; `setNaturalPosition` admin)
- Modify: `src/pages/pizarra/Pizarra.tsx` (`playerPositions` override; posición efectiva; fuera-de-posición; UI selector)
- Modify: `src/pages/pizarra/PlayerToken.tsx` (señal fuera-de-posición + selector de posición)
- Modify: `src/pages/pizarra/Pizarra.css`

- [ ] **Step 1: `usePizarraPlayers.ts`** — añadir `naturalPosition?: Zone` a `PizarraPlayer` (leído del doc). Exportar:

```ts
import { doc, updateDoc } from "firebase/firestore";
export async function setNaturalPosition(playerId: string, pos: Zone | null): Promise<void> {
  await updateDoc(doc(db, "players", playerId), { naturalPosition: pos ?? null });
}
```

- [ ] **Step 2: `Pizarra.tsx`** — `playerPositions: Record<string, Zone>` ya en `Lineup`. Helpers:

```ts
const effectiveZone = (id: string): Zone | undefined =>
  lineup.playerPositions[id] ?? playersById.get(id)?.naturalPosition;
const isOutOfPosition = (slot: SlotState): boolean => {
  if (!slot.playerId) return false;
  const z = effectiveZone(slot.playerId);
  return !!z && z !== slot.zone;
};
```

  Gate admin: `const { profile } = useAuth(); const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";`
  Handlers: `setOverride(id, zone)` (actualiza `lineup.playerPositions`), `saveNatural(id, zone)` (solo admin → `setNaturalPosition`).

- [ ] **Step 3: `PlayerToken.tsx`** — props extra: `outOfPosition: boolean`, `effectiveZone?: Zone`, `canEditNatural: boolean`, `onSetOverride`, `onSaveNatural`. Render: si `outOfPosition` (y ajuste activo) aro punteado + glifo no-cromático ("≠"). Un control (p. ej. menú/`<select>`) para elegir posición: override siempre; natural visible solo si `canEditNatural`.

- [ ] **Step 4: CSS** — `.pz-token.is-oop` (aro punteado gold/sky + badge "≠" no-cromático); estilos del selector de posición.

- [ ] **Step 5: build + lint + navegador.** En `?preview` (admin): asignar natural a un jugador (verificar escritura: `preview_eval` relee el doc o el estado); poner override distinto; colocar en slot de otra zona → aparece señal fuera-de-posición. build PASS, lint clean.

- [ ] **Step 6: Entregar reglas Firestore** (texto en el resumen del usuario; ver §10 del spec).

- [ ] **Step 7: Commit.** `git add src/pages/pizarra/usePizarraPlayers.ts src/pages/pizarra/Pizarra.tsx src/pages/pizarra/PlayerToken.tsx src/pages/pizarra/Pizarra.css` → `git commit -m "feat(pizarra): per-player position (natural + override) and out-of-position cue"`

---

## Task 5: Ajustes de pizarra (qué mostrar)

**Files:**
- Create: `src/pages/pizarra/usePizarraSettings.ts`
- Create: `src/pages/pizarra/PizarraSettings.tsx`
- Modify: `src/pages/pizarra/Pizarra.tsx`, `PlayerToken.tsx`, `PitchSlot.tsx`, `Pizarra.css`

- [ ] **Step 1: `usePizarraSettings.ts`** — estado en `localStorage` (`mp_pizarra_settings`):

```ts
export interface PizarraSettings {
  showNumber: boolean; showName: boolean; showPosition: boolean;
  showGalones: boolean; showEmptyLabels: boolean; showOutOfPosition: boolean;
}
const DEFAULTS: PizarraSettings = { showNumber:true, showName:true, showPosition:false, showGalones:true, showEmptyLabels:true, showOutOfPosition:true };
export function usePizarraSettings(): { settings: PizarraSettings; set: (k: keyof PizarraSettings, v: boolean) => void } { /* read/merge DEFAULTS from localStorage; set persists */ }
```

- [ ] **Step 2: `PizarraSettings.tsx`** — popover (icono `Settings` de lucide) con un toggle por cada ajuste (checkbox accesible, label en español). Usa `<dialog>`/popover o `position: fixed` para no recortarse.

- [ ] **Step 3: Wiring** — `Pizarra.tsx` pasa `settings` a `PlayerToken` (showNumber/Name/Position/Galones/OutOfPosition) y a `PitchSlot` (showEmptyLabels). `PlayerToken` muestra/oculta cada parte según ajustes; la posición efectiva se muestra si `showPosition`.

- [ ] **Step 4: build + lint + navegador.** Alternar cada toggle y verificar el cambio en las fichas/campo. build PASS, lint clean.

- [ ] **Step 5: Commit.** `git add src/pages/pizarra/usePizarraSettings.ts src/pages/pizarra/PizarraSettings.tsx src/pages/pizarra/Pizarra.tsx src/pages/pizarra/PlayerToken.tsx src/pages/pizarra/PitchSlot.tsx src/pages/pizarra/Pizarra.css` → `git commit -m "feat(pizarra): display settings popover"`

---

## Task 6: Validación 7/7 + Auto-XI + Fijar (pin)

**Files:**
- Modify: `src/pages/pizarra/Pizarra.tsx`, `PlayerToken.tsx`, `Pizarra.css`

- [ ] **Step 1: Validación** — derivar `placed = slots.filter(s=>s.playerId).length`; mostrar "X/7 en el campo" y, si hay slots vacíos, un aviso no intrusivo (texto). (Sin duplicados posibles.)

- [ ] **Step 2: Auto-XI** — botón "Auto" en los controles:

```ts
function autoXI(l: Lineup): Lineup {
  const slots = applyFormation(l.slots, l.formation).map(s => ({ ...s }));
  // conservar pinned en su índice
  const pinnedSet = new Set(l.pinned);
  const keep = new Map<number,string>();
  l.slots.forEach((s,i)=>{ if (s.playerId && pinnedSet.has(s.playerId)) keep.set(i, s.playerId); });
  const taken = new Set(keep.values());
  const pool = allPlayerIds.filter(id => !taken.has(id)); // jugadores disponibles
  slots.forEach((s,i)=>{ s.playerId = keep.get(i) ?? null; });
  // 1ª pasada: emparejar por zona efectiva
  slots.forEach(s => { if (s.playerId) return;
    const idx = pool.findIndex(id => effectiveZone(id) === s.zone);
    if (idx>=0) { s.playerId = pool.splice(idx,1)[0]; }
  });
  // 2ª pasada: rellenar con cualquiera
  slots.forEach(s => { if (s.playerId) return; if (pool.length) s.playerId = pool.shift()!; });
  const bench = pool;
  return { ...l, slots, bench };
}
```
  Envolver en `startViewTransition` (morph), respetar reduced-motion.

- [ ] **Step 3: Pin** — `lineup.pinned: string[]`. Acción para fijar/soltar (botón en la ficha o en su menú). Indicador no-cromático (candado `Lock`). `applyFormation`/`changeFormation` y `autoXI` respetan pinned (no mueven su slot/índice).

- [ ] **Step 4: CSS** — indicador de pin; estilo del aviso de validación; botón Auto.

- [ ] **Step 5: build + lint + navegador.** Verificar: contador correcto; Auto-XI coloca por zona y respeta pin; pin visible; cambio de formación no mueve al fijado. build PASS, lint clean.

- [ ] **Step 6: Commit.** `git add src/pages/pizarra/Pizarra.tsx src/pages/pizarra/PlayerToken.tsx src/pages/pizarra/Pizarra.css` → `git commit -m "feat(pizarra): validation counter, Auto-XI, pin player"`

---

## Task 7: Filtro de banquillo + Deshacer/rehacer + Modo presentación

**Files:**
- Modify: `src/pages/pizarra/Pizarra.tsx`, `Pizarra.css`

- [ ] **Step 1: Filtro de banquillo** — input de búsqueda (por nombre/dorsal) + chips de zona; filtra `benchPlayers` en render (no muta estado). `aria-label` correcto.

- [ ] **Step 2: Undo/redo** — historial:

```ts
const [past, setPast] = useState<Lineup[]>([]);
const [future, setFuture] = useState<Lineup[]>([]);
const commit = (next: Lineup) => { setPast(p => [...p.slice(-29), lineup]); setFuture([]); setLineup(next); };
const undo = () => setPast(p => { if(!p.length) return p; const prev=p[p.length-1]; setFuture(f=>[lineup,...f]); setLineup(prev); return p.slice(0,-1); });
const redo = () => setFuture(f => { if(!f.length) return f; const nxt=f[0]; setPast(p=>[...p,lineup]); setLineup(nxt); return f.slice(1); });
```
  Encaminar TODAS las mutaciones del tablero por `commit(...)` (placeIntoSlot/swap/sendToBench/changeFormation/autoXI/pin/override). Botones + atajos Ctrl+Z / Ctrl+Shift+Z (o Ctrl+Y). (Las escrituras de posición natural NO entran en el historial.)

- [ ] **Step 3: Modo presentación** — toggle que añade clase `pz--present` (oculta controles/banquillo/galones, agranda el campo, centra el XI); Esc para salir; respeta reduced-motion.

- [ ] **Step 4: CSS** — filtro; barra undo/redo; `.pz--present` (layout limpio).

- [ ] **Step 5: build + lint + navegador.** Verificar: filtrar banquillo; deshacer/rehacer una secuencia de movimientos; entrar/salir de presentación. build PASS, lint clean.

- [ ] **Step 6: Commit.** `git add src/pages/pizarra/Pizarra.tsx src/pages/pizarra/Pizarra.css` → `git commit -m "feat(pizarra): bench filter, undo/redo, presentation mode"`

---

## Task 8: Pulido (responsive, temas, reduced-motion) + verificación final

**Files:**
- Modify: `src/pages/pizarra/Pizarra.css` (y ajustes puntuales donde haga falta)

- [ ] **Step 1: Responsive** — en móvil: la fila de dropdowns se apila/scrollea sin overflow (mismo cuidado que el fix de grid de Fase 1); popover de ajustes y modo presentación usables a 375–390px.

- [ ] **Step 2: Temas + reduced-motion** — verificar claro/oscuro en todos los elementos nuevos (dropdowns, popover, señales). Confirmar `@media (prefers-reduced-motion: reduce)` cubre morph/Auto-XI/presentación; contraste AA en textos nuevos.

- [ ] **Step 3: Verificación final** — `npm run build` + `npm run lint` (archivos tocados), leer y pegar salida. Navegador: recorrido completo (sistema+morph, tácticas, posición natural/override/fuera-de-posición, galones, temporada en ambos modos, ajustes, validación, Auto-XI, pin, filtro, undo/redo, presentación) en claro/oscuro y móvil/escritorio. Screenshots de prueba.

- [ ] **Step 4: Commit.** `git add src/pages/pizarra/Pizarra.css` (+ lo tocado) → `git commit -m "polish(pizarra): responsive, themes, reduced-motion for F7 iteration"`

- [ ] **Step 5: Pausa para revisión** y entrega del texto de reglas Firestore.

---

## Self-review (cobertura del spec)

- §3 F7 formaciones → Task 1. §4 controles dropdown + tácticas → Task 2. §5 posición natural+override+fuera-de-posición → Task 4. §6 galones sin MVP → Task 1. §7 selector temporada → Task 3. §8 A (ajustes)→Task 5; B (fuera-de-posición)→Task 4; C (validación)→Task 6; D (Auto-XI)→Task 6; E (pin)→Task 6; F (filtro)→Task 7; G (undo/redo)→Task 7; H (presentación)→Task 7. §9 modelo de datos → Tasks 1,2,4,5. §10 reglas Firestore → Task 4 Step 6. §12 a11y/temas/reduced-motion → Task 8. §13 verificación → cada tarea + Task 8.
- Sin placeholders de código en los pasos algorítmicos (formaciones, tácticas, autoXI, undo/redo, fuera-de-posición, setNaturalPosition incluidos). UI/CSS rutinaria se describe por comportamiento + clases siguiendo los patrones de Fase 1.
- Consistencia de tipos: `Zone`, `FormationName`, `Tactics`, `Roles` (sin `motm`), `Lineup` (con `tactics`/`playerPositions`/`pinned`) definidos en Task 1-2 y usados coherentemente después.
