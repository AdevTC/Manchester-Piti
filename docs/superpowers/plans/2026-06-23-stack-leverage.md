# Sacar el máximo del stack: dedup realtime · bundle · URL-state · offline · validación async · tests · rules (11 mejoras)

> **Para el agente ejecutor:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para implementar este plan fase a fase. Los pasos usan checkboxes (`- [ ]`). **Cada fase es independiente y se integra por separado: 1 merge `--no-ff` por fase a `main` (sin PR, salvo que el usuario diga lo contrario).** Respeta `CLAUDE.md`: pnpm; nada de `any` (usa `unknown` y estrecha); sin refactors fuera de alcance ni "de paso"; ejecuta `pnpm lint && pnpm test && pnpm build` y LEE la salida antes de decir "hecho"; sin `--no-verify`; sin dependencias sin usar. Verifica las APIs de librería con context7 antes de confiar en un snippet. **TDD donde haya lógica pura.** Para cada fase: implementador + revisión de cumplimiento de spec + revisión de calidad de código, y arregla lo que salga antes de cerrar.

**Goal:** El stack de la issue #3/#4 (Router · Query · Zod · RHF · Motion · caché Firestore) está instalado y validado, pero **infrautilizado**: el puente realtime→cache solo lo consume `SeasonContext`, las mutaciones no tienen optimismo/offline, los loaders solo cubren las rutas de detalle, casi todo el estado de UI vive en `useState` (se pierde al recargar), el bundle arrastra un chunk de iconos enorme, y **no hay tests de UI**. Esta issue exprime lo construido: deduplica suscripciones, recorta bundle, lleva estado a la URL, añade escritura optimista/offline, valida unicidad en async, blinda con tests/CI y audita las reglas de seguridad.

**Architecture:** SPA cliente React 19 / Vite / TS sobre Firebase Auth + Firestore. Marco autenticado dentro de `RouterProvider` (TanStack Router); `AuthProvider`/`SeasonProvider` + `QueryClientProvider`/`MotionConfig` por encima. Colecciones mayormente realtime (`onSnapshot`). Las mejoras son aditivas: no reescriben el núcleo ni rompen suscripciones realtime que funcionan.

**Tech Stack (YA instalado, no reinstalar):** `firebase@^12` (`persistentLocalCache`), `zod@^4`, `@tanstack/react-router@^1.170`, `@tanstack/react-query@^5.101`, `react-hook-form@^7` + `@hookform/resolvers@^5`, `motion@^12`, `lucide-react`, `@dnd-kit/react`. Devtools de router y query cableadas en DEV. **No instalado:** `@tanstack-query-firebase/react` (puente bespoke), runner de E2E. *(Aparte: hay una migración a shadcn/Tailwind en la rama `feat/shadcn-tailwind-migration` — es un carril independiente; trabaja sobre lo que esté en `main` y evita pisar sus componentes.)*

---

## Estado actual (tras issue #4 — lee esto antes de empezar)

- **`src/lib/useFirestoreCollection.ts`** — puente: `mapSnapshotDocs(snap, map)` (mapea y descarta los que devuelven `null`), `handleSnapshotError(qc, key, err)` (loguea + `qc.setQueryData(key, [])` para que `isPending` termine), `useFirestoreCollection(key, q, map)` (suscribe `onSnapshot` → `setQueryData`; `useQuery` con `staleTime: Infinity`). **Consumido SOLO por `SeasonContext`** (`["seasons"]`). Tests puros en `useFirestoreCollection.test.ts`.
- **Suscripciones realtime duplicadas (objetivo de la Fase 1):** abren su propio `onSnapshot` por separado a las mismas colecciones — `src/pages/MatchCenter.tsx` (`players`+`matches`), `src/pages/Stats.tsx` (`players`+`matches`), `src/pages/Expedientes.tsx` (`players` filtrado por temporada), `src/pages/Admin.tsx` (`seasons`/`players`/`users`/`matches`, ya validados con `parseDocs`), `src/pages/pizarra/usePizarraPlayers.ts` (`players`), `useSeasonMatches.ts` (`matches`), `useLineups.ts` (`lineups`, con rama localStorage en `?preview`). La resolución por-temporada del dorsal/nombre vive en cada consumidor (`playersMaps` en MatchCenter; `resolve()` en pizarra/Expedientes) — debe **preservarse** tras migrar al puente.
- **Mutaciones Admin** — `src/pages/admin/useAdminMutations.ts` (`useUpsert`/`useDelete` × season/player/match). Sin optimismo ni invalidación: el realtime refresca la UI. Estados `isPending`/`onError`/`onSuccess` unificados.
- **Loaders/prefetch** — `src/lib/detailQueries.ts` (`matchDetailQuery`, `playerDetailQuery`, `playersNameMapQuery`); `loader: ensureQueryData(...)` solo en `/matches/$matchId` y `/jugadores/$playerId`. Las listas (MatchCenter/Stats/Plantilla) NO tienen loader (son realtime) y gestionan su propio `loading` con `useState`.
- **Search params tipados** — `rootSearchSchema` (`season`) en el root route; `plantillaSearchSchema` (`mode`) en `/plantilla`; puente `SeasonUrlSync`. El RESTO del estado de UI es `useState` y se pierde al recargar: tab de Stats (`general|compare`), tab de Admin (`matches|roster|seasons|admins`), filtros/orden de Expedientes, jugadores seleccionados del comparador.
- **Forms** — todos los de Admin + `NicknameSetup` en RHF + `zodResolver`. Validaciones data-dependientes **imperativas en `onSubmit`**: dorsal duplicado por temporada (jugador), goles-vs-eventos (partido). Unicidad de nickname con `getDocs` one-shot dentro de `AuthContext.registerNickname`.
- **Esquemas** — `src/lib/schemas.ts`: `seasonMatchSchema`/`lineupSchema` son `z.looseObject` (permisivos, passthrough); `parseDocs` descarta+`console.error` los docs inválidos (sin superficie para el usuario/monitorización). `dropNullFields` normaliza `null`→ausente.
- **Motion** — reveals `initial/animate`, crossfade de ruta, `AnimatePresence`+`layout` en las filas del board, flip de `FlapTile`. **Deferido:** micro-interacción del número destacado de Stats (`useCountUp`+Motion); shared-layout en la Pizarra (conflicto con `@dnd-kit`). Un canvas de focos con micro-motion perpetuo en Landing.
- **Bundle** — `pnpm build` avisa de chunks >500 kB: `lucide-react` ~724 kB (el mayor) e `index` ~491 kB. Hay code-split por ruta (`lazyRouteComponent`).
- **Tests** — solo `schemas.test.ts` + `useFirestoreCollection.test.ts` (puros). **Sin tests de componente/integración/E2E.** No hay `@testing-library/react` ni runner E2E instalados. 1 warning de eslint preexistente (`Stats.tsx:195` exhaustive-deps).
- **Firebase** — `persistentLocalCache` (lecturas offline + cola de escrituras). Reglas de seguridad activas (el mock de `?preview` da `permission-denied`), pero el estado de auditoría es desconocido; la memoria de Pizarra marca las reglas de `lineups` como pendientes. `firebase.json` tiene un rewrite SPA que asume Firebase Hosting. Lint con `eslint-plugin-react-hooks@^7` (reglas react-compiler; `react-hooks/set-state-in-effect` es ERROR — por eso F4 de #4 derivó en render en vez de effect, y se usó `useWatch` para evitar un warning de react-compiler).

**Hatches DEV de verificación** (`import.meta.env.DEV`): `?preview` (marco autenticado mock — sirve para router/rutas/Motion/validación de forms; las escrituras dan `permission-denied`), `?login` (login real, pero el popup de Google se bloquea en navegador automatizado). Dev server en **:3000 (strictPort)**. Aviso: **Admin/NicknameSetup no se pueden verificar a fondo sin sesión real**; el preview headless pausa el frameloop de Motion (animaciones congeladas), así que Motion se verifica en pestaña real.

---

## Orden recomendado de ejecución

`Fase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11` (de mayor ratio valor/riesgo a más ambicioso/protector). Las fases 1–3 son las de mayor retorno. **Si priorizas seguridad sobre features**, adelanta las fases 9 (tests), 10 (E2E/CI) y 11 (reglas). Cada fase compila, pasa tests y es un merge independiente.

---

## Fase 1 — Deduplicar suscripciones realtime con el puente (`matches`/`players`/`lineups`)

**Por qué:** hoy `MatchCenter`, `Stats`, `Expedientes`, `Admin` y los hooks de pizarra abren cada uno su propio `onSnapshot` a `players`/`matches` → suscripciones realtime DUPLICADAS a las mismas colecciones (más listeners, más lecturas de Firestore/cuota, re-fetch al navegar). El puente `useFirestoreCollection` (testeado, pero solo usado por `SeasonContext`) deduplica por `queryKey` → **una sola suscripción por colección, caché compartida entre páginas y datos calientes al navegar**, con estados load/error homogéneos. Es la mayor pieza "construida en #4 y deferida".

**Files:**
- Modify: `src/pages/pizarra/usePizarraPlayers.ts`, `src/pages/pizarra/useSeasonMatches.ts`, `src/pages/pizarra/useLineups.ts`
- Modify: `src/pages/MatchCenter.tsx`, `src/pages/Stats.tsx`, `src/pages/Expedientes.tsx`
- Modify (opcional, si no añade riesgo): los `onSnapshot` de lectura de `src/pages/Admin.tsx`
- Modify (si hace falta): `src/lib/useFirestoreCollection.ts` (exponer lo necesario sin romper su contrato)

- [ ] **Step 1: Inventario de suscripciones y shapes.** Lista cada `onSnapshot` por colección y la derivación posterior (filtros por temporada, `playersMaps`, `resolve()` de dorsal/nombre, orden, `loading`). La caché del puente guarda los **docs crudos validados**; la derivación por-temporada se queda en el consumidor (`useMemo`). Define las `queryKey` canónicas (p. ej. `["players"]`, `["matches", seasonId]` o `["matches"]` + filtro en memoria, `["lineups", seasonId]`).
- [ ] **Step 2: Migrar los hooks de pizarra** (`usePizarraPlayers`, `useSeasonMatches`, `useLineups`) a `useFirestoreCollection`, conservando EXACTO el mapper validado de F1-de-#4 (Zod + `dropNullFields`, descarta inválidos), la rama `?preview`/localStorage de `useLineups`, y las interfaces públicas. `loading` deriva de `isPending`.
- [ ] **Step 3: Migrar `MatchCenter`/`Stats`/`Expedientes`** para que `players`/`matches` vengan del puente (misma `queryKey` → suscripción compartida). Conserva `playersMaps`/`resolve()`/filtros/orden en `useMemo`. Sin regresión visual ni de realtime.
- [ ] **Step 4 (opcional): `Admin`** — enrutar sus 4 lecturas por el puente si no complica las escrituras (Fase 4 de #4 ya validó esas lecturas). Documenta qué quedó migrado (sin caps silenciosos).
- [ ] **Step 5: Verificar y commit.** `pnpm test && pnpm lint && pnpm build`. En `?preview`: navega MatchCenter→Stats→Plantilla y confirma que los datos siguen pintando, el selector de temporada filtra, y (DEV) el nº de listeners no crece por página (React Query Devtools muestra una sola query por colección). Commit: `perf(data): dedupe realtime subscriptions through the shared cache bridge`.

**Considerar (no obligatorio):** evaluar `@tanstack-query-firebase/react` (adapter oficial) como reemplazo del puente bespoke; adoptarlo SOLO si reduce código sin perder el contrato (validación/descarte, error→`[]`, `staleTime: Infinity`). Si el puente actual basta, documenta por qué se mantiene.

**Aceptación:** una sola suscripción realtime por colección compartida entre páginas; sin regresión realtime/visual; derivación por-temporada intacta; interfaces públicas de los hooks sin cambios; tests verdes.

---

## Fase 2 — Optimización de bundle (lucide + code-split + análisis)

**Por qué:** el build avisa de chunks >500 kB; `lucide-react` (~724 kB) es el mayor y casi seguro entra entero por un import no tree-shakeable. Recortarlo baja el JS inicial y mejora el tiempo de carga.

**Files:**
- Modify: imports de iconos donde se use `lucide-react` (varios componentes)
- Modify (si aplica): `vite.config.ts` (manualChunks/análisis)

- [ ] **Step 1: Diagnóstico.** Genera un análisis del bundle (p. ej. `rollup-plugin-visualizer` en DEV o `vite build` con sourcemaps) y confirma de dónde sale el peso de `lucide-react` y del chunk `index`.
- [ ] **Step 2: Tree-shaking de iconos.** Asegura imports por icono (`import { Calendar } from "lucide-react"` ya debería tree-shakear; si no, usa la ruta `lucide-react/icons/<icon>` o un wrapper). Verifica con context7 la forma recomendada en la versión instalada. Objetivo: que el chunk de iconos baje drásticamente.
- [ ] **Step 3: Chunking.** Si procede, define `build.rollupOptions.output.manualChunks` para separar vendor pesado (firebase, motion) del `index`, sin romper el code-split por ruta existente.
- [ ] **Step 4 (opcional): React Compiler.** Evalúa habilitar el React Compiler (React 19) para auto-memoización; si añade complejidad o riesgo, omítelo y documenta.
- [ ] **Step 5: Verificar y commit.** `pnpm build` y compara tamaños de chunks (antes/después, sin caps silenciosos en el reporte). Sin regresión funcional. Commit: `perf(build): shrink the icon bundle and tune code-splitting`.

**Aceptación:** chunk de iconos reducido de forma medible; sin warning nuevo; build OK; sin regresión de UI.

---

## Fase 3 — Estado de UI en la URL (tabs/filtros como search params tipados)

**Por qué:** el patrón `?season`/`?mode` funciona, pero el resto del estado (tab de Stats/Admin, filtros de Expedientes, comparador) vive en `useState` y se pierde al recargar/compartir. Llevarlo a search params tipados lo hace deep-linkable y persistente, reutilizando `validateSearch`/`getRouteApi`.

**Files:**
- Modify: `src/router.tsx` (extender `validateSearch` de las rutas afectadas con un esquema compartido)
- Modify: `src/pages/Stats.tsx` (tab `general|compare`, ids del comparador), `src/pages/Admin.tsx` (tab), `src/pages/Plantilla.tsx`/`Expedientes.tsx` (filtros/orden)

- [ ] **Step 1: Stats** — `tab` (+ opcional `playerA`/`playerB` del comparador) como search params (`z.enum(...).default().catch()`), leídos con `getRouteApi("/stats").useSearch()`, navegación con updater funcional `search: (prev) => ({...prev, tab})` (sin perder `season`).
- [ ] **Step 2: Admin** — `tab` (`matches|roster|seasons|admins`) como search param igual. (Mantén el guard de rol existente.)
- [ ] **Step 3 (opcional): Expedientes** — filtros/orden como search params si aporta (deep-link a "plantilla filtrada").
- [ ] **Step 4: Verificar y commit.** `pnpm build`. En `?preview`: cambiar tab/filtro actualiza la URL; recargar conserva; valores inválidos caen al default (`.catch`); no se pierden otros params. Commit: `feat(router): persist tab/filter UI state in typed search params`.

**Aceptación:** al menos Stats y Admin tabs en la URL, deep-linkables y persistentes a recarga; sin perder `season`/`mode`; sin regresión.

---

## Fase 4 — Estados de carga/error por ruta (`pendingComponent`/`errorComponent` + Suspense)

**Por qué:** solo las rutas de detalle tienen loader. Añadir `pendingComponent` (skeletons) y `errorComponent` (boundary) por ruta da percepción de instantaneidad y captura fallos sin pantalla en blanco. Las listas realtime no usan loader pero sí se benefician de un error boundary + skeleton sobrio.

**Files:**
- Modify: `src/router.tsx` (`pendingComponent`/`errorComponent` por ruta y/o `defaultPendingComponent`/`defaultErrorComponent` en `createRouter`)
- Create (opcional): componentes de skeleton/erroro sobrios reutilizables
- Modify (opcional): `src/lib/detailQueries.ts` (incluir `playersNameMapQuery` en el loader de match para calentar también los nombres en deep-link)

- [ ] **Step 1: Defaults globales** — `defaultErrorComponent` + `defaultPendingComponent` en `createRouter` (skeleton sobrio coherente con el sistema visual). Verifica el API con context7.
- [ ] **Step 2: Detalle** — `pendingComponent` propio en `/matches/$matchId` y `/jugadores/$playerId` (skeleton de ficha); y añade `playersNameMapQuery` al loader de match para que el deep-link llegue con los nombres calientes (hoy se fetchea en mount).
- [ ] **Step 3 (opcional): listas** — error boundary por ruta para MatchCenter/Stats/Plantilla; skeleton mientras `isPending` del puente (si ya migraron en Fase 1).
- [ ] **Step 4: Verificar y commit.** `pnpm build`. En `?preview`: deep-link directo muestra skeleton→contenido; un error de carga muestra el boundary, no pantalla en blanco. Commit: `feat(router): per-route pending and error boundaries`.

**Aceptación:** skeleton/boundary por ruta funcionando; deep-link sin doble fetch; sin pantallas en blanco ante error; build OK.

---

## Fase 5 — Mutaciones optimistas + soporte de escritura offline

**Por qué:** las mutaciones de Admin (F5 de #4) no tienen optimismo ni invalidación. Con `persistentLocalCache` (ya activo) + `useMutation` optimista, las altas/ediciones/borrados se reflejan al instante (rollback en error) y, combinado con la cola offline de Firestore, **el app funciona offline también para escrituras** (hoy solo lecturas offline).

**Files:**
- Modify: `src/pages/admin/useAdminMutations.ts` (optimistic `onMutate`/`onError` rollback/`onSettled`)
- Modify (si hace falta): `src/pages/Admin.tsx`

- [ ] **Step 1 (TDD donde aplique): optimismo en borrado** — `onMutate` quita la fila de la caché al instante, `onError` hace rollback. Como el `onSnapshot` realtime reconcilia, el optimismo solo cubre la latencia; cuida que no choque con la reconciliación. Verifica el patrón optimista de `useMutation` v5 con context7.
- [ ] **Step 2: optimismo en alta/edición** (si aporta y no añade riesgo) — temporal en caché con rollback. Si la complejidad supera el valor, limita a borrado y documenta.
- [ ] **Step 3: offline** — verifica/documenta que con red caída las escrituras se encolan (Firestore) y la UI optimista responde; al volver la red, reconcilia. Indica límites conocidos (sin red, no hay confirmación del servidor).
- [ ] **Step 4: Verificación y commit.** `pnpm build`. **Verificación manual del usuario** (Admin necesita sesión real; probar offline con DevTools). Commit: `feat(admin): optimistic mutations with offline write support`.

**Aceptación:** mutaciones con feedback instantáneo y rollback en error; sin regresión con el realtime; escritura offline encolada; guardas de rol intactas.

---

## Fase 6 — Validación async de unicidad (dorsal / nickname) con RHF + Query

**Por qué:** los chequeos data-dependientes están imperativos en `onSubmit` (dorsal duplicado por temporada; nickname con `getDocs`). Llevarlos a validación async de RHF (+ Query para cachear la consulta) da feedback inline antes de enviar y menos boilerplate.

**Files:**
- Modify: `src/pages/Admin.tsx` (validación async del dorsal en el form de jugador)
- Modify: `src/pages/NicknameSetup.tsx` y/o `src/context/AuthContext.tsx` (unicidad de nickname inline)
- Modify (si hace falta): `src/lib/schemas.ts` / un helper de validación

- [ ] **Step 1: Dorsal** — validación async a nivel de campo (RHF `mode` adecuado / `trigger`) que compruebe el roster vivo (ya en caché si se hizo Fase 1) y muestre el error inline en el campo `number` en vez de en `onSubmit`. Conserva el mensaje y la semántica por-temporada.
- [ ] **Step 2: Nickname** — unicidad inline en `NicknameSetup` (debounced) reutilizando/cacheando la consulta de disponibilidad; conserva la normalización de `nicknameSchema`.
- [ ] **Step 3: Verificación y commit.** `pnpm build`. **Verificación manual del usuario** (sesión real). Commit: `feat(forms): inline async uniqueness validation for dorsal and nickname`.

**Aceptación:** unicidad validada inline (no solo en submit), con la misma semántica; sin regresión de guardado; build OK.

---

## Fase 7 — Endurecer esquemas Zod + visibilidad de datos corruptos

**Por qué:** `seasonMatchSchema`/`lineupSchema` son `z.looseObject` permisivos; `parseDocs` descarta inválidos solo con `console.error` (sin visibilidad). Ajustar el rigor donde el dato sea fiable y dar una superficie a los descartes mejora robustez y detecta corrupción.

**Files:**
- Modify: `src/lib/schemas.ts` (estrechar campos seguros; modelar `events`/`date` del match si no rompe Admin)
- Modify (si aplica): un punto central de logging/monitorización

- [ ] **Step 1: Estrechar con cuidado** — donde el dato esté garantizado (p. ej. campos siempre escritos por los forms RHF), sustituir `looseObject`/`unknown` por tipos concretos, SIN descartar docs que hoy renderizan (mantén la permisividad de F1-de-#4 donde el código tolera ausencia/`null`). TDD de los esquemas.
- [ ] **Step 2: Visibilidad** — que los descartes de `parseDocs` no se pierdan en consola: contador/aviso en DEV y/o gancho de monitorización (p. ej. Sentry si se adopta) para detectar corrupción en prod. Sin romper la resiliencia (seguir descartando, no lanzar).
- [ ] **Step 3: Verificación y commit.** `pnpm test && pnpm build`. Commit: `feat(validation): tighten safe schemas and surface dropped-doc telemetry`.

**Aceptación:** esquemas más estrictos donde es seguro sin nuevas regresiones de descarte; descartes visibles (no solo `console.error`); tests verdes.

---

## Fase 8 — Pulido de Motion (número de Stats + shared-layout Pizarra + coste)

**Por qué:** quedaron deferidos la micro-interacción del número destacado de Stats y el shared-layout de la Pizarra; y conviene confirmar que el micro-motion perpetuo (canvas de focos) no penaliza CPU/batería en móvil.

**Files:**
- Modify: `src/pages/Stats.tsx` (número destacado con `useCountUp` + Motion de entrada)
- Modify (ambicioso, opcional): `src/pages/pizarra/Pizarra.tsx` (shared-layout)
- Modify (si aplica): `src/components/FloodlightCanvas.tsx` (gate por `prefers-reduced-motion`/visibilidad)

- [ ] **Step 1: Número de Stats** — envuelve el número destacado en `motion.span` (entrada escala/opacity) coordinado con `useCountUp` (no dupliques el conteo). `reduced-motion` lo neutraliza vía el `MotionConfig` global.
- [ ] **Step 2 (ambicioso, opcional): shared-layout Pizarra** — `layout` para que las fichas animen su recolocación, SOLO si no pelea con `@dnd-kit` (el drag activo no debe competir con `layout`). Si choca, limita a entrada/salida y documenta.
- [ ] **Step 3: Coste del canvas** — gate el frameloop del canvas de focos por `prefers-reduced-motion` y/o `document.visibilityState`/IntersectionObserver para no quemar CPU/batería cuando está oculto o el usuario pide menos movimiento.
- [ ] **Step 4: Verificación y commit.** `pnpm build`. **En pestaña real** (el preview headless congela Motion): animaciones suaves; con "reduce motion" se neutralizan; el drag de la Pizarra sigue funcionando; el conteo intacto. Commit: `feat(motion): featured-number micro-interaction, board shared-layout, and motion-cost guards`.

**Aceptación:** número animado en Stats; shared-layout o su omisión documentada; canvas respeta reduced-motion/visibilidad; sin romper dnd-kit ni `useCountUp`.

---

## Fase 9 — Tests de componente/integración de los flujos críticos

**Por qué:** hoy solo hay tests puros (esquemas + helper). Toda la UI está sin testear, y los flujos de Admin no se pueden verificar en navegador por el agente. La arquitectura Router+Query es muy testeable (render con `QueryClient` + memory router) → blinda la inversión.

**Files:**
- Create: `src/**/*.test.tsx` para los flujos críticos
- Modify: `package.json`/config de vitest (jsdom + testing-library); añadir `@testing-library/react` (+ `jsdom`) como devDeps (esta fase SÍ añade deps de test)

- [ ] **Step 1: Infra de test de componentes** — instala `@testing-library/react`/`@testing-library/user-event` + `jsdom`; configura vitest (environment jsdom, setup). Helper para render con `QueryClientProvider` + memory `RouterProvider` + providers mock.
- [ ] **Step 2: Cubrir lo crítico (no verificable en navegador):** validación de los forms de Admin (partido/jugador: required, mensajes amigables, dorsal duplicado, goles-vs-eventos), el camino `onError`/`isPending` de `useAdminMutations` (mock de Firestore), el puente `SeasonUrlSync` (deep-link/back/reset-a-all), y los queryOptions de detalle (null→no-encontrado).
- [ ] **Step 3: Verificación y commit.** `pnpm test` con los nuevos tests verdes. Commit: `test(ui): cover Admin forms, season URL sync, mutations and detail queries`.

**Aceptación:** tests de integración de los flujos críticos pasando; cubren lo que el agente no puede verificar en navegador; sin flakiness.

---

## Fase 10 — E2E (Playwright) de flujos con auth + CI

**Por qué:** las escrituras de Admin (sesión real) son el hueco de verificación permanente. Un E2E (con emuladores de Firebase o mock de auth) los cubre de forma reproducible; CI corre lint/test/build en cada push.

**Files:**
- Create: config de Playwright + specs E2E (`e2e/**`)
- Create: workflow de CI (`.github/workflows/ci.yml`)
- Modify: `package.json` (scripts e2e; devDep Playwright — fase que SÍ añade dep)

- [ ] **Step 1: Playwright** — instala y configura; arranca el dev server (:3000) en el runner. Decide estrategia de auth para E2E (emulador de Firebase Auth/Firestore, o un bypass DEV de sesión real distinto del mock `?preview` con `permission-denied`).
- [ ] **Step 2: Specs críticos** — login→navegación, deep-links de detalle, season en URL, y (con auth/emulador) un alta/edición/borrado real de partido y jugador que **persista** (lo que el agente no pudo verificar).
- [ ] **Step 3: CI** — workflow que corre `pnpm lint && pnpm test && pnpm build` (y opcional E2E) en push/PR. Arregla el warning preexistente `Stats.tsx:195` para dejar lint impecable.
- [ ] **Step 4: Verificación y commit.** E2E verde local; CI verde. Commit: `test(e2e): Playwright auth flows + CI pipeline`.

**Aceptación:** E2E cubre los flujos con auth (incl. escritura persistente); CI corre el stack de verificación; lint sin warnings.

---

## Fase 11 — Auditoría de Firestore security rules + objetivo de despliegue

**Por qué:** el gate de admin en cliente es solo UX; la seguridad real son las `firestore.rules`. La memoria marca las reglas de `lineups` como pendientes. Hay que auditar role-based writes y confirmar el target de despliegue (el rewrite SPA de `firebase.json` asume Firebase Hosting).

**Files:**
- Modify: `firestore.rules` (y `firestore.indexes.json` si faltan índices para las queries)
- Modify (si aplica): `firebase.json` (confirmar hosting/rewrite)
- Create (recomendado): tests de reglas con el emulador

- [ ] **Step 1: Auditar reglas** — revisar que `seasons`/`players`/`matches`/`users`/`lineups` exijan rol (admin/superadmin) en escritura y la lectura adecuada; cerrar las de `lineups` (pendientes). Verifica la sintaxis con context7/docs de Firebase.
- [ ] **Step 2: Índices** — añade los índices compuestos que pidan las queries (`matches` por `seasonId`+`date`, `lineups` por `seasonId`+`isOfficial`, etc.) si Firestore los reclama.
- [ ] **Step 3 (recomendado): tests de reglas** con el emulador (`@firebase/rules-unit-testing`) — admin puede escribir, user no.
- [ ] **Step 4: Despliegue** — confirma el target (Firebase Hosting u otro) y que el rewrite SPA es correcto; documenta.
- [ ] **Step 5: Verificación y commit.** Reglas desplegables (emulador verde si se añaden tests). **Verificación del usuario** del despliegue. Commit: `chore(security): audit Firestore rules, indexes and deploy target`.

**Aceptación:** reglas role-based auditadas y cerradas (incl. `lineups`); índices presentes; target de despliegue confirmado; (opcional) tests de reglas verdes.

---

## Self-review / cobertura

- **Las 11 mejoras** → F1 (dedup realtime) · F2 (bundle/lucide + React Compiler opcional) · F3 (UI-state en URL) · F4 (pending/error por ruta + prefetch name-map) · F5 (optimismo + offline) · F6 (validación async unicidad) · F7 (esquemas estrictos + visibilidad de descartes) · F8 (Motion: número Stats + Pizarra + coste canvas) · F9 (tests componente/integración) · F10 (E2E + CI) · F11 (reglas + índices + deploy). Considerado y ubicado: `@tanstack-query-firebase/react` (F1), React Compiler (F2), prefetch del name-map (F4), `firebase.json` hosting (F11).
- **Reutilización:** el puente y los esquemas/`parseDocs` de #4 alimentan F1/F7; `useAdminMutations` (F5); `validateSearch`/`SeasonUrlSync` (F3); `useCountUp`/`MotionConfig` (F8); `detailQueries` (F4).
- **Riesgos marcados:** F1 (preservar derivación por-temporada y semántica realtime), F5 (no pelear con la reconciliación realtime), F8 (no pelear con `@dnd-kit`), F2 (no romper el code-split por ruta). Admin/NicknameSetup requieren verificación manual del usuario (sesión real); Motion se verifica en pestaña real; las fases 9–11 añaden deps de test/E2E (permitido, son su propósito).
- **Disciplina:** TDD donde hay lógica pura (esquemas, helpers, validadores); 1 merge por fase; sin `any`; sin deps sin usar (salvo las de test en F9/F10); ejecutar lint/test/build y leer salida antes de cerrar cada fase.

## Notas de verificación

- Dev server en **:3000 strictPort**; hatches `?preview` (marco autenticado mock; escrituras dan `permission-denied`) y `?login` (login real, popup de Google bloqueado en navegador automatizado).
- `Admin`/`NicknameSetup`: el agente NO puede verificar escrituras reales (sesión real) → fases 5/6 y el E2E con auth (F10) cubren ese hueco; deja la confirmación manual al usuario.
- Motion (F8): el preview headless congela el frameloop → verifica en pestaña real.
- React Query/Router Devtools (DEV) ayudan a comprobar la deduplicación de queries (F1) y los loaders/pending (F4).
