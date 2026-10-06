# Optimizaciones de stack: explotar Router · Query · Zod · RHF · Motion al máximo

> **Para el agente ejecutor:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para implementar este plan fase a fase. Los pasos usan checkboxes (`- [ ]`). **Cada fase es independiente y se integra por separado: 1 merge `--no-ff` por fase a `main` (sin PR, salvo que el usuario diga lo contrario).** Respeta `CLAUDE.md`: pnpm; nada de `any` (usa `unknown` y estrecha); sin refactors fuera de alcance ni "de paso"; ejecuta `pnpm lint && pnpm test && pnpm build` y LEE la salida antes de decir "hecho"; sin `--no-verify`; sin dependencias sin usar. Verifica las APIs de librería con context7 antes de confiar en un snippet.

**Goal:** Exprimir el stack ya integrado (issue #3) atacando deuda y oportunidades reales: tipar en runtime TODAS las lecturas de Firestore, deep-linkear el estado de temporada, activar la capa de animación (Motion/Reveal) que quedó como primitiva, unificar lecturas/escrituras bajo TanStack Query, terminar la migración de formularios y abrir rutas profundas con prefetch.

**Architecture:** SPA cliente React 19 / Vite / TS sobre Firebase Auth + Firestore. El marco autenticado se renderiza dentro de `RouterProvider` (TanStack Router); `AuthProvider`/`SeasonProvider` y los providers globales (`QueryClientProvider`, `MotionConfig`) envuelven la app por encima del router. Las colecciones son mayormente realtime (`onSnapshot`). Las mejoras son aditivas: ninguna reescribe el núcleo y ninguna debe romper suscripciones realtime que funcionan.

**Tech Stack (YA instalado, no reinstalar):** `firebase@^12` (`persistentLocalCache`), `zod@^4`, `@tanstack/react-router@^1.170`, `@tanstack/react-query@^5.101`, `react-hook-form@^7` + `@hookform/resolvers@^5`, `motion@^12` (`motion/react`). Devtools de router y query ya cableadas en modo DEV.

---

## Estado actual (tras issue #3 — lee esto antes de empezar)

Lo que YA existe en `main` (no rehacer):

- **`src/firebase.ts`** — exporta `db` (`initializeFirestore` + `persistentLocalCache` multi-tab), `auth`, `googleProvider`. No queda `getFirestore`.
- **`src/lib/schemas.ts`** — exporta `roleSchema`, `nicknameSchema`, `userProfileSchema` (+ `UserProfileParsed`), `matchResultSchema` (+ `MatchResult`), `seasonFormSchema` (+ `SeasonFormValues`), y el helper `safeParseDoc<T>(schema, data, fallback, ctx): T` (valida; si falla, loguea `r.error.issues` y devuelve `fallback`). `createdAt` se modela con un union laxo (Date | number | Timestamp-like).
- **`src/lib/queryClient.ts`** — `queryClient` (`staleTime: 60_000`, `gcTime: 5*60_000`, `retry: 2`, `refetchOnWindowFocus: false`).
- **`src/lib/useFirestoreCollection.ts`** — primitiva reutilizable **aún sin consumir**: `mapSnapshotDocs<T>(snap, map): T[]` y `useFirestoreCollection<T>(key, q, map)` (suscribe `onSnapshot` → `qc.setQueryData(key, …)`; devuelve `useQuery` con `staleTime: Infinity`). Errores solo se loguean (los callers que la usen en UI deben añadir estado de error). Tiene test (`mapSnapshotDocs`).
- **`src/router.tsx`** — routing por código. `rootRoute` (component `RootLayout`, `notFoundComponent: () => <Navigate to="/" replace />`). 5 rutas: `/` (MatchCenter), `/stats` (Stats), `/plantilla` (Plantilla, con `validateSearch` = `plantillaSearchSchema` exportado: `{ mode: enum["expedientes","pizarra"].default.catch }`), `/profile` (Profile), `/admin` (Admin). Todas con `lazyRouteComponent(() => import(...), "<NamedExport>")`. `createRouter({ defaultPreload: "intent", scrollRestoration: true })`. Augmentación `Register`.
- **`src/RootLayout.tsx`** — `useAuth`, `useNavigate`, `useRouterState` (pathname). Guard admin síncrono (`blockedFromAdmin` → `return null`) + `useEffect` redirect a `/profile`. Render: `<div.app-container><Navbar/><main.main-content><Suspense fallback={null}><AnimatePresence mode="wait"><motion.div key={pathname} opacity 0→1, exit 0, dur 0.2><Outlet/>…` + bloque DEV de router-devtools en su propio Suspense.
- **`src/App.tsx`** — `App = <AuthProvider><SeasonProvider><MainAppContent/>`. `MainAppContent`: hatch DEV `?login`, pantalla de carga, `!user` → `Landing`/`Login`, `user && !profile` → `NicknameSetup`, autenticado → `<RouterProvider router={router}/>`. **`RouterProvider` se monta DENTRO de `AuthProvider`/`SeasonProvider`** (importante: SeasonContext/AuthContext están POR ENCIMA del router; un componente del router puede consumirlos, pero el provider en sí no puede usar hooks del router).
- **`src/main.tsx`** — `<StrictMode><QueryClientProvider><MotionConfig reducedMotion="user"><App/>{DEV && <ReactQueryDevtools/>}…`.
- **`src/components/Navbar.tsx`** — sin props. `PATHS` (matches→`/`, stats→`/stats`, …). `currentPage` derivado de `useRouterState` pathname. `handleNavClick(page)` con guarda (`if (path) navigate({to})`). Incluye el **selector de temporada** (usa `useSeason`), theme toggle, cluster de usuario, rail móvil, indicador deslizante.
- **`src/components/Reveal.tsx`** — primitiva **sin consumir**: `<Reveal delay?>` = `motion.div` con `initial={{opacity:0,y:16}}`, `whileInView={{opacity:1,y:0}}`, `viewport={{once:true,amount:0.3}}`, `transition dur 0.5 ease easeOut`.
- **`src/context/AuthContext.tsx`** — `UserProfile { email; nickname; role; createdAt }`. En `onAuthStateChanged` valida el doc con `userProfileSchema.safeParse` (early-return a `null` si falla). `registerNickname(nickname)` comprueba disponibilidad con `getDocs(query(usersRef, where("nickname","==",...)))` (one-shot imperativo). `updateUserRole`, `setLocalAdminRole`, hatch `?preview`.
- **`src/context/SeasonContext.tsx`** — `seasons` vía `onSnapshot(query(collection(db,"seasons"), orderBy("name","asc")))`; `selectedSeasonId` (localStorage `"selected_season_id"`, default `"all"`); `setSelectedSeasonId`; `loadingSeasons`. Resetea a `"all"` si la temporada seleccionada desaparece; en error pone `loadingSeasons=false`. Interfaz pública: `{ seasons, selectedSeasonId, setSelectedSeasonId, loadingSeasons }`.
- **`src/pages/Plantilla.tsx`** — lee `mode` con `getRouteApi("/plantilla").useSearch()`; `choose` navega con updater `search: (prev) => ({...prev, mode})`. Conmuta `<Expedientes/>` / `<Pizarra/>`.
- **`src/pages/Admin.tsx`** (~1530 líneas) — tabs `matches|roster|seasons|admins`. Carga `seasons/players/users/matches` con 4 `onSnapshot`. `handleAddMatch` (campos escalares + workspace de eventos en estado aparte `matchEvents` + chequeo cruzado goles-evento≤goalsFor + modo edición + `Timestamp.fromDate`). `handleAddPlayer` (validación imperativa: dorsal duplicado por temporada contra el roster vivo). **Formulario de Temporada YA migrado a RHF** (`seasonFormSchema`, vars aliased `registerSeason`/`handleSeasonSubmit`/`resetSeason`/`seasonErrors`/`seasonSubmitting`). Tabla de roles con `<select>` inline → `updateUserRole`.
- **`src/pages/NicknameSetup.tsx`** — RHF + `zodResolver(z.object({ nickname: nicknameSchema }))`, errores con ARIA.
- **Hooks de datos realtime** (lee sus shapes antes de tocarlos):
  - `src/pages/pizarra/useSeasonMatches.ts` → `useSeasonMatches(seasonId): { matches: SeasonMatch[]; loading }` (onSnapshot de `matches`).
  - `src/pages/pizarra/usePizarraPlayers.ts` → `usePizarraPlayers(): { players: PizarraPlayer[]; loading }`.
  - `src/pages/pizarra/useLineups.ts` → `useLineups(seasonId): UseLineups`.
- **Animación legacy:** `src/hooks/useReveal.ts` (IntersectionObserver sobre `[data-reveal]`, respeta reduced-motion) usado en `Landing.tsx`, `Expedientes.tsx`, `MatchCenter.tsx`. `src/hooks/useCountUp.ts` (count-up de números). NO romper estos hasta migrarlos del todo.

**Hatches DEV de verificación** (`import.meta.env.DEV`): `?preview` (monta el marco autenticado con sesión admin mock — útil para router/rutas/Motion), `?login` (muestra la pantalla de login). Dev server en **:3000 (strictPort)**. Aviso: **Admin y NicknameSetup no se pueden verificar a fondo sin sesión real** (la mock da `permission-denied`); y el preview headless pausa Motion (documento oculto → wrapper en `opacity:0`), así que las animaciones se verifican estructuralmente + en pestaña real.

**Versionado:** todo el stack ya está instalado; NO añadas dependencias nuevas salvo que una fase lo pida explícitamente, y nunca dejes una dependencia sin consumir.

---

## Orden recomendado de ejecución

`Fase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9` (de mayor ratio valor/riesgo a más ambicioso). Cada fase compila, pasa tests y es un merge independiente. Las fases 1–3 son las de mayor retorno y menor riesgo. Tras cada fase: `pnpm lint && pnpm test && pnpm build` y leer la salida.

---

## Fase 1 — Zod en TODAS las lecturas de Firestore (blindaje runtime)

**Por qué:** hoy solo se valida el perfil de usuario. El resto de lecturas (`matches`, `players`, `seasons`, `lineups`, pizarra) se castean con `as`. Un documento malformado revienta en runtime en sitios impredecibles. Reutilizamos `safeParseDoc` y centralizamos esquemas → una sola fuente de verdad y cero crashes por datos corruptos.

**Files:**
- Modify: `src/lib/schemas.ts` (añadir esquemas de colección + helper de colección)
- Modify: `src/lib/schemas.test.ts` (TDD)
- Modify: `src/context/SeasonContext.tsx`, `src/pages/pizarra/useSeasonMatches.ts`, `src/pages/pizarra/usePizarraPlayers.ts`, `src/pages/pizarra/useLineups.ts` (validar en el borde de cada `onSnapshot`)
- Modify (si aplica): los `onSnapshot` de `src/pages/Admin.tsx` que mapean `seasons/players/matches`

- [ ] **Step 1: Leer los 4 hooks + SeasonContext y anotar la shape EXACTA** de `SeasonMatch`, `PizarraPlayer`, el tipo de lineup, `Season` y `Player`. Los esquemas deben reflejar esas interfaces (mismos nombres de campo, opcionales donde el código ya tolera ausencia).

- [ ] **Step 2: TDD — tests de los nuevos esquemas + helper de colección** en `src/lib/schemas.test.ts`. Ejemplo del helper a añadir y testear:

```ts
// en schemas.ts
/** Valida una colección Firestore: descarta (y loguea) los docs inválidos en vez de romper. */
export function parseDocs<T>(
  schema: z.ZodType<T>,
  docs: { id: string; data: () => unknown }[],
  ctx: string,
): T[] {
  const out: T[] = [];
  for (const d of docs) {
    const r = schema.safeParse({ id: d.id, ...(d.data() as object) });
    if (r.success) out.push(r.data);
    else console.error(`[schema] doc inválido en ${ctx}/${d.id}:`, r.error.issues);
  }
  return out;
}
```

```ts
// schemas.test.ts (ejemplo)
import { parseDocs, seasonMatchSchema } from "./schemas";
describe("parseDocs", () => {
  it("descarta docs inválidos y conserva los válidos", () => {
    const docs = [
      { id: "ok", data: () => ({ rival: "X", goalsFor: 1, goalsAgainst: 0, seasonId: "s1" }) },
      { id: "bad", data: () => ({ rival: "Y", goalsFor: -3 }) },
    ];
    const out = parseDocs(seasonMatchSchema, docs, "matches");
    expect(out.map((m) => m.id)).toEqual(["ok"]);
  });
});
```
Run: `pnpm test src/lib/schemas.test.ts` → FAIL (esquemas no existen aún).

- [ ] **Step 3: Implementar los esquemas de colección** en `schemas.ts` reflejando las shapes reales (incluye `id: z.string()`; usa `.optional()`/`.catch()` para campos que el código ya trata como opcionales; reutiliza `roleSchema`/el `firestoreDate` existente para fechas). Define al menos: `seasonSchema`, `seasonMatchSchema`, `playerSchema`, `pizarraPlayerSchema`, `lineupSchema`. Run: `pnpm test src/lib/schemas.test.ts` → PASS.

- [ ] **Step 4: Validar en el borde de cada `onSnapshot`.** Sustituye los `snapshot.docs.map(d => ({...}) as X)` por `parseDocs(xSchema, snapshot.docs, "<coleccion>")`. Conserva EXACTA la lógica posterior (orden, defaults, el reset-a-"all" de SeasonContext, los `loading`). No cambies las interfaces públicas de los hooks ni del contexto.

- [ ] **Step 5: Verificar y commit.** `pnpm test && pnpm lint && pnpm build` → PASS. Verifica en `?preview` que las páginas siguen pintando datos (los `permission-denied` del mock son esperados). Commit: `feat(validation): validate all Firestore reads at the edge with shared Zod schemas`.

**Aceptación:** ningún `as` en los mapeos de `onSnapshot` de las colecciones cubiertas; un doc corrupto se descarta y loguea sin romper la UI; tests verdes; sin regresión realtime.

---

## Fase 2 — `selectedSeasonId` como search param deep-linkable

**Por qué:** la temporada seleccionada vive en `localStorage`+Context; no es compartible por URL. Como search param global se vuelve deep-linkable ("enlace a las stats de la Temporada 2") y consistente con el patrón `?mode` de Plantilla.

**Restricción clave:** `SeasonProvider` está POR ENCIMA de `RouterProvider` (en `App.tsx`), así que **el provider no puede usar hooks del router**. El selector de temporada vive en `Navbar`, que SÍ está dentro del router (en `RootLayout`). Diseño recomendado: el parámetro `season` vive en el `validateSearch` del **root route**; un componente puente dentro del router sincroniza el search param ↔ `SeasonContext` (o los consumidores leen el search param directamente).

**Files:**
- Modify: `src/router.tsx` (añadir `season` al `validateSearch` del root route)
- Modify: `src/RootLayout.tsx` o nuevo `src/components/SeasonUrlSync.tsx` (puente search↔context)
- Modify: `src/context/SeasonContext.tsx` (aceptar valor inicial/externo sin romper su interfaz)
- Modify: `src/components/Navbar.tsx` (el selector navega con `search: (prev) => ({...prev, season})`)

- [ ] **Step 1: Añadir `season` al root route** con `validateSearch` (zod): `season: z.string().default("all").catch("all")`. Como el root está en `createRootRoute`, su search es heredado por todas las rutas. Verifica con context7 que el search del root route se hereda en hijas en la versión instalada; si no, define `season` en cada ruta reutilizando un esquema compartido.

- [ ] **Step 2: Sincronizar.** Implementa el puente dentro del router (en `RootLayout` o un `SeasonUrlSync`): lee `season` del search (`useSearch({ strict: false })`) y mantén `SeasonContext.selectedSeasonId` en sync; al cambiar el selector del Navbar, navega actualizando `season` (updater funcional para no perder `mode` u otros params). Mantén `localStorage` como respaldo de arranque (valor inicial) o elimínalo — documenta la decisión. NO rompas la interfaz pública de `SeasonContext`.

- [ ] **Step 3: Verificación y commit.** `pnpm build` PASS. En `?preview`: cambiar de temporada actualiza la URL (`?season=<id>`); recargar mantiene la selección; un `season` inválido cae a `"all"` (`.catch`). Commit: `feat(router): deep-linkable season selection via search param`.

**Aceptación:** `/stats?season=<id>` deep-linkable; selector y URL sincronizados en ambos sentidos; recarga conserva selección; sin perder otros search params; sin regresión en consumidores de `useSeason`.

---

## Fase 3 — Activar Motion: `<Reveal>` + micro-interacción en números

**Por qué:** `<Reveal>` y la capa Motion existen pero apenas se usan. Encaja con la marca ("broadcast energy / every number is a trophy"). Migramos los usos de `useReveal` a `<Reveal>` y añadimos una micro-interacción de entrada a los números destacados.

**Files:**
- Modify: `src/pages/Landing.tsx`, `src/pages/Expedientes.tsx`, `src/pages/MatchCenter.tsx` (sustituir `useReveal`/`[data-reveal]` por `<Reveal>`)
- Delete: `src/hooks/useReveal.ts` (SOLO cuando no queden usos — `grep -rn "useReveal" src` debe dar 0)
- Modify (opcional): el componente de número destacado de `src/pages/Stats.tsx` (Motion + `useCountUp`)

- [ ] **Step 1: Migrar Landing** (el más simple) como worked example: quita `useReveal(...)`, envuelve los bloques que tenían `data-reveal` en `<Reveal>` (usa `delay` escalonado donde antes había stagger). Verifica en dev (Landing es accesible sin sesión).

- [ ] **Step 2: Migrar Expedientes y MatchCenter** con el mismo patrón. Quita los `[data-reveal]` ya migrados. Cuando `grep -rn "useReveal\|data-reveal" src` dé 0, borra `src/hooks/useReveal.ts`.

- [ ] **Step 3 (opcional): micro-interacción de número.** Envuelve el número destacado de Stats en un `motion.span` con `initial/animate` (escala/opacity) coordinado con `useCountUp`. NO dupliques la animación de conteo; solo añade la entrada. Reduced-motion lo neutraliza vía el `MotionConfig` global.

- [ ] **Step 4: Verificación y commit.** `pnpm build` PASS. En navegador real: los reveals aparecen al hacer scroll; activa "reduce motion" en el SO → sin desplazamientos. `grep` confirma 0 restos de `useReveal`. Commit: `feat(motion): adopt Reveal across pages and retire the legacy useReveal hook`.

**Aceptación:** reveals con Motion en las 3 páginas; `prefers-reduced-motion` respetado; `useReveal` eliminado sin restos; `useCountUp` intacto.

---

## Fase 4 — Puente realtime→cache en colecciones (empezando por SeasonContext)

**Por qué:** la primitiva `useFirestoreCollection` está testeada pero sin consumir. Adoptarla da dedupe entre montajes, estados load/error homogéneos y menos suscripciones duplicadas. Empezamos por la candidata de menor riesgo (`SeasonContext`) preservando su semántica especial.

**Files:**
- Modify: `src/lib/useFirestoreCollection.ts` (exponer error/loading de forma utilizable; añadir test del nuevo contrato)
- Modify: `src/lib/useFirestoreCollection.test.ts`
- Modify: `src/context/SeasonContext.tsx` (consumir el puente conservando reset-a-"all", `loadingSeasons` y error)

- [ ] **Step 1: Reforzar el puente (TDD).** El puente actual solo loguea errores. Para SeasonContext necesitamos `loading` y poder reaccionar a error sin romper la UI. Añade que el callback de error de `onSnapshot` haga `qc.setQueryData(key, [])` (o exponga estado) para que `loading` termine, y devuelve algo con `isPending`/`error` aprovechables. Escribe el test del nuevo comportamiento primero. Verifica el API de React Query v5 con context7. Run test → FAIL → implementa → PASS.

- [ ] **Step 2: Migrar SeasonContext** para que `seasons` venga de `useFirestoreCollection(["seasons"], query(collection(db,"seasons"), orderBy("name","asc")), (id, d) => ({ id, name: (d as {name?:string}).name ?? "", captainPlayerId: (d as {captainPlayerId?:string}).captainPlayerId || undefined }))`. Deriva `loadingSeasons` del `isPending`/loading del puente. Conserva EXACTO: el reset a `"all"` cuando la temporada seleccionada ya no existe (effect que observe `seasons`), `selectedSeasonId` (+ lo de Fase 2 si ya está), y la interfaz pública `{ seasons, selectedSeasonId, setSelectedSeasonId, loadingSeasons }`.

- [ ] **Step 3 (opcional, si sobra tiempo): migrar `useSeasonMatches`** al puente con `key=["matches", seasonId]`. NO migres `useLineups`/`usePizarraPlayers` salvo que sobre tiempo; documenta en el commit qué quedó migrado y qué no (sin caps silenciosos).

- [ ] **Step 4: Verificación y commit.** `pnpm test && pnpm build` PASS. En `?preview` el selector de temporada del Navbar sigue funcionando igual. Commit: `feat(data): back SeasonContext (and matches) with the realtime→cache bridge`.

**Aceptación:** `SeasonContext` lee del puente sin regresión (carga, reset, selector); puente con error/loading testeado; alcance migrado documentado.

---

## Fase 5 — Mutaciones con TanStack Query (`useMutation`) + estados unificados en Admin

**Por qué:** las escrituras de Admin usan `setLoading` manual + toasts. `useMutation` unifica pending/error, permite invalidación/optimistic y reduce boilerplate y bugs de estado. Como Admin lee en realtime, el snapshot ya refresca la UI; el valor está en feedback consistente y manejo de error robusto.

**Files:**
- Create: `src/pages/admin/useAdminMutations.ts` (hooks `useMutation` para season/player/match: add/update/delete)
- Modify: `src/pages/Admin.tsx` (consumir los hooks; quitar el `loading` manual donde aplique)

- [ ] **Step 1: Crear los hooks de mutación** con `useMutation({ mutationFn, onError, onSuccess })` envolviendo los `addDoc/setDoc/deleteDoc` existentes (extrae la lógica de escritura actual sin cambiar la forma del documento ni `Timestamp.fromDate`). Usa `mutation.isPending` para deshabilitar botones y `onError` para el `notifyError` existente. Verifica el API `useMutation` v5 con context7.

- [ ] **Step 2: Cablear en Admin** una mutación a la vez (empieza por temporada/eliminar, que es lo más simple), reemplazando el `setLoading`/try-catch manual por la mutación. Mantén las guardas de rol y los `window.confirm` de borrado. Para escrituras one-shot añade `onSuccess` con `notifySuccess`.

- [ ] **Step 3 (opcional): optimistic update** en el borrado (quita la fila del cache al instante, rollback en `onError`) si NO interfiere con el `onSnapshot` realtime (que de todas formas reconciliará). Si añade complejidad/riesgo, omítelo y documenta.

- [ ] **Step 4: Verificación y commit.** `pnpm build` PASS. **Verificación manual del usuario** (Admin necesita sesión real). Commit: `feat(admin): unify Firestore writes with TanStack Query mutations`.

**Aceptación:** escrituras de Admin vía `useMutation` con pending/error unificados; sin regresión en guardado/borrado; guardas de rol intactas.

---

## Fase 6 — Terminar RHF + Zod en los formularios complejos de Admin

**Por qué:** quedan el form de **partido** y el de **jugador** con validación manual. Migrarlos da validación inline, menos boilerplate y reutiliza esquemas (`matchResultSchema` ya existe). Es la fase de mayor riesgo (flujo crítico de Admin, no verificable en navegador por el agente).

**Files:**
- Modify: `src/lib/schemas.ts` (extender para el form de partido: `matchFormSchema` = campos de `matchResultSchema` + `competition` + `date`; crear `playerFormSchema`)
- Modify: `src/lib/schemas.test.ts`
- Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: Esquemas (TDD).** `matchFormSchema` (seasonId, rival, competition, date string, goalsFor/goalsAgainst enteros ≥0 — reutiliza la forma de `matchResultSchema`). `playerFormSchema` para los campos escalares simples (nombre, dorsal, etc.). Lo que NO sea expresable como esquema estático (duplicado de dorsal por temporada contra el roster vivo, chequeo goles-evento≤goalsFor) se queda como validación imperativa en `onSubmit` vía `setError`. Tests → FAIL → implementa → PASS.

- [ ] **Step 2: Migrar el form de partido** a `useForm`+`zodResolver(matchFormSchema)` con vars aliased (sin colisión con el form de temporada ya migrado). El workspace de eventos (`matchEvents` + `currentEvent*`) sigue en estado aparte. Modo edición vía `reset(...)`. Conserva `Timestamp.fromDate`, la lista de partidos, editar/borrar, el chequeo cruzado de goles (en `onSubmit`).

- [ ] **Step 3: Migrar el form de jugador** igual, con las validaciones data-dependientes en `onSubmit`. Conserva el sub-estado de temporadas/dorsales y la escritura Firestore.

- [ ] **Step 4: Verificación y commit.** `pnpm build` PASS. **Verificación manual del usuario** (registrar/editar partido y jugador). Commit: `feat(forms): migrate Admin match and player forms to RHF + Zod`.

**Aceptación:** los 2 forms con validación inline vía esquemas compartidos; validaciones imperativas preservadas; sin regresión en guardado; build OK.

---

## Fase 7 — Loaders de ruta + prefetch con Query (páginas instantáneas)

**Por qué:** combinar `defaultPreload: "intent"` (ya activo) con prefetch de datos en los `loader` de ruta → al pasar el ratón sobre un enlace se baja el chunk Y se calientan los datos. Aplica a lecturas one-shot/históricas (no a las realtime que ya están vivas).

**Files:**
- Modify: `src/router.tsx` (añadir `loader` a rutas con datos one-shot)
- Modify (si hace falta): el hook/lectura de la página objetivo para exponer una `queryOptions` reutilizable

- [ ] **Step 1: Identificar una lectura one-shot/histórica** apta (p. ej. un dato no-realtime de Stats o un detalle). Define `queryOptions` reutilizable (`queryKey` + `queryFn`).

- [ ] **Step 2: Añadir `loader`** a esa ruta: `loader: () => queryClient.ensureQueryData(opts)` (importa `queryClient` de `src/lib/queryClient.ts`). El componente lee con `useQuery(opts)` y obtiene cache caliente. Verifica el API de loaders + integración con Query en la versión instalada (context7). Documenta que las colecciones realtime NO pasan por loader.

- [ ] **Step 3: Verificación y commit.** `pnpm build` PASS (chunks por ruta intactos). En `?preview`: al hacer hover sobre el enlace se precarga; navegación sin spinner perceptible. Commit: `perf(router): prefetch route data via loaders + Query`.

**Aceptación:** al menos una ruta con loader+prefetch funcionando; sin doble fetch; realtime sin tocar; build OK.

---

## Fase 8 — Rutas profundas (detalle de partido, ficha de jugador, Pizarra)

**Por qué:** abrir vistas deep-linkables con su propio code-split: detalle de partido, ficha de jugador, y opcionalmente Pizarra como ruta. Aprovecha el router tipado y `lazyRouteComponent`.

**Files:**
- Create: páginas nuevas (p. ej. `src/pages/MatchDetail.tsx`, `src/pages/PlayerProfile.tsx`) como named exports
- Modify: `src/router.tsx` (rutas con params: `/matches/$matchId`, `/plantilla/$playerId` o `/jugadores/$playerId`)
- Modify: las listas (MatchCenter / Expedientes) para enlazar con `<Link to=... params=...>`

- [ ] **Step 1: Definir las rutas con params** en `router.tsx` (`createRoute({ path: "/matches/$matchId", … })`) con `lazyRouteComponent` y, si encaja, `validateSearch`/`loader` (Fase 7). Lee el param con `getRouteApi("/matches/$matchId").useParams()`.

- [ ] **Step 2: Crear las páginas** (named export), leyendo el doc por id (reutiliza `safeParseDoc`/esquemas de Fase 1). Maneja "no encontrado" (redirect o estado vacío). Diseño sobrio y coherente con el resto (no rediseñes el sistema visual).

- [ ] **Step 3: Enlazar** desde las listas con `<Link>` tipado (preload "intent" gratis). Verifica en `?preview` que la navegación y el deep-link directo funcionan, y el back del navegador.

- [ ] **Step 4: Verificación y commit.** `pnpm build` PASS (nuevos chunks por ruta). Commit: `feat(router): add deep-linkable match detail and player profile routes`.

**Aceptación:** rutas con param navegables y deep-linkables; recarga directa OK; code-split por ruta; sin restos rotos en las listas.

---

## Fase 9 — Transiciones avanzadas de Motion (layout / listas)

**Por qué:** subir el listón visual ("técnicamente extraordinario") con animaciones `layout`/shared-layout en el drag de la Pizarra y en listas/tarjetas, respetando reduced-motion.

**Files:**
- Modify: componentes de listas/tarjetas (p. ej. tarjetas de Stats, lista de eventos/partidos) y/o el tablero de `src/pages/pizarra/Pizarra.tsx`

- [ ] **Step 1: `AnimatePresence` + `layout` en una lista** (p. ej. la lista de eventos del partido en Admin o las tarjetas de Stats): envuelve los items en `motion.div layout` dentro de `AnimatePresence` para entradas/salidas/reordenamientos suaves. Verifica el API `layout`/`LayoutGroup` con context7.

- [ ] **Step 2 (ambicioso, opcional): shared-layout en la Pizarra** para que las fichas animen su posición al recolocarse. Hazlo SOLO si no interfiere con `@dnd-kit` (el drag activo no debe pelearse con `layout`); si choca, limita Motion a entrada/salida y documenta.

- [ ] **Step 3: Verificación y commit.** `pnpm build` PASS. En navegador real: animaciones suaves; con "reduce motion" se neutralizan; el drag de la Pizarra sigue funcionando. Commit: `feat(motion): layout/list transitions with reduced-motion safety`.

**Aceptación:** transiciones de layout/lista con Motion; `prefers-reduced-motion` respetado; sin romper dnd-kit ni el conteo de números.

---

## Self-review / cobertura

- **Las 9 mejoras** → Fase 1 (Zod en lecturas) · 2 (season en URL) · 3 (Reveal + número) · 4 (puente en colecciones) · 5 (mutaciones Query) · 6 (RHF en Admin) · 7 (loaders+prefetch) · 8 (rutas profundas) · 9 (Motion avanzado).
- **Reutilización:** `safeParseDoc`/`parseDocs` y esquemas centralizados (F1) alimentan F6 y F8; `useFirestoreCollection` (F4) y `queryClient` (F5/F7) ya existen; `<Reveal>`/`MotionConfig` (F3/F9) ya existen.
- **Riesgos marcados:** F2 (SeasonProvider por encima del router — usar puente), F4 (preservar reset/loading/error de SeasonContext), F6 (forms críticos de Admin, verificación manual), F9 (no pelear con dnd-kit). Admin/NicknameSetup requieren verificación manual del usuario; Motion se verifica en pestaña real (el preview headless lo pausa).
- **Disciplina:** TDD donde hay lógica pura (esquemas, helpers, puente); 1 merge por fase; sin `any`; sin deps sin usar; ejecutar lint/test/build y leer salida antes de cerrar cada fase.

## Notas de verificación

- Dev server en **:3000 strictPort**; hatches `?preview` (marco autenticado mock) y `?login`.
- `Admin`/`NicknameSetup`: el agente NO puede verificarlos a fondo (sesión real). Deja para verificación manual del usuario las fases 5 y 6.
- Motion: el preview headless pausa el frameloop (documento oculto) → captura en blanco aunque el DOM esté correcto; verifica visualmente en pestaña real.
