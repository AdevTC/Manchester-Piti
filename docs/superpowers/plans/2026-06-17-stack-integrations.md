# Integraciones de stack (Router · Query · Zod · RHF · Motion · Firestore cache)

> **Para el agente ejecutor:** SUB-SKILL REQUERIDA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan fase a fase. Los pasos usan checkboxes (`- [ ]`) para el seguimiento. **Cada fase es independiente y desplegable por separado (1 PR por fase).** Respeta `CLAUDE.md`: pnpm, sin `any`, sin refactors fuera de alcance, ejecuta type-check/lint/test/build y lee la salida antes de decir "hecho".

**Goal:** Integrar 6 tecnologías sobre la web actual (React 19 / Vite 8 / TS 6 / Firebase) sin reescribir el núcleo, atacando deuda real: routing artesanal, datos de Firestore sin tipar en runtime, validación de formularios manual, ausencia de caché de cliente y de capa de animación.

**Architecture:** App SPA cliente sobre Firebase Auth + Firestore. El routing pasa de un hash-router casero a TanStack Router (rutas tipadas + code-splitting) **montado solo dentro del marco autenticado** (Landing/Login/NicknameSetup quedan fuera del router, como ahora). Zod valida los documentos de Firestore en el borde y centraliza los esquemas, que se reutilizan en React Hook Form y en los search params del router. TanStack Query se adopta como capa de caché para lecturas one-shot; las suscripciones realtime (`onSnapshot`) existentes se conservan y, opcionalmente, se puentean al cache. Motion añade la capa de animación respetando `prefers-reduced-motion`.

**Tech Stack:** `@tanstack/react-router`, `@tanstack/react-query` + `@tanstack-query-firebase/react`, `zod` (v4), `react-hook-form` + `@hookform/resolvers`, `motion`, y `persistentLocalCache` de `firebase/firestore` (sin dependencia nueva).

---

## Estado actual (contexto para quien no conoce el repo)

- **Router:** hecho a mano en `src/App.tsx` (`useState` + `hashchange`, `validPages = ["matches","stats","plantilla","profile","admin"]`). El `Navbar` (`src/components/Navbar.tsx`) navega con `window.location.hash = page` + `setCurrentPage`. La guarda de admin está en `App.tsx`.
- **Auth gating:** en `App.tsx` → `loading` → (no user) `Landing`/`Login` → (no profile) `NicknameSetup` → marco principal con `Navbar` + página activa.
- **Pizarra:** NO es ruta top-level. Es un sub-modo dentro de `src/pages/Plantilla.tsx` (`mode: "expedientes" | "pizarra"`, persistido en `localStorage` con clave `mp_plantilla_mode`).
- **Datos Firestore:** mayormente **realtime** vía `onSnapshot` — `useLineups`, `useSeasonMatches`, `usePizarraPlayers`, `SeasonContext`. El perfil de usuario (`AuthContext`) usa `getDoc` (one-shot). Los documentos se castean con `as` (sin validación runtime): `userDoc.data() as UserProfile`, `d.data() as RawMatch`, etc.
- **Firestore init:** `src/firebase.ts` usa `getFirestore(app)` (caché por defecto en memoria, sin persistencia).
- **Formularios:** validación manual con `useState` + regex. Ej: `src/pages/NicknameSetup.tsx` (3–15 chars, `^[a-zA-Z0-9_]+$`). `src/pages/Admin.tsx` gestiona resultados/eventos de partido y roles.
- **Animación:** CSS a mano + hooks `src/hooks/useReveal.ts` y `src/hooks/useCountUp.ts`. `PRODUCT.md` exige honrar `prefers-reduced-motion`.
- **Tests:** Vitest. Ejemplos existentes: `src/pages/pizarra/chemistry.test.ts`, `lineupOps.test.ts`. Comandos: `pnpm test`, `pnpm lint`, `pnpm build` (`tsc -b && vite build`).

> **Nota de versiones:** instala siempre la última estable (`pnpm add <pkg>@latest`). Las APIs de abajo están verificadas contra la doc oficial vigente (mediados de 2026).

---

## Fase 0 — Caché persistente de Firestore (fundación, sin dependencias nuevas)

**Por qué primero:** cambio de configuración aislado, riesgo casi nulo, beneficio inmediato (carga instantánea desde caché en visitas repetidas y **menos lecturas** → cuida la cuota del plan gratis). El resto de fases se benefician.

**Files:**
- Modify: `src/firebase.ts`

- [ ] **Step 1: Sustituir `getFirestore` por `initializeFirestore` con caché persistente**

`initializeFirestore` debe llamarse **antes** de cualquier otro uso de Firestore y reemplaza a `getFirestore`.

```ts
// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Persistent IndexedDB cache: instant warm loads + fewer reads (free-tier friendly).
// Multi-tab manager keeps several open tabs consistent.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

googleProvider.setCustomParameters({ prompt: "select_account" });
```

- [ ] **Step 2: Type-check y build**

Run: `pnpm build`
Expected: PASS. No quedan referencias a `getFirestore` (búscalas: `grep -rn "getFirestore" src`). Si alguna aparece importándolo desde `firebase/firestore` solo para el `db`, no es necesaria; los consumidores siguen importando `db` desde `src/firebase.ts`.

- [ ] **Step 3: Verificación manual (preview workflow)**

Arranca el dev server, abre la app, recarga: el contenido debe pintar al instante desde caché antes de que lleguen los snapshots. En DevTools → Application → IndexedDB debe existir la base `firestore/...`. En una segunda pestaña, los datos deben mantenerse consistentes (multi-tab).

- [ ] **Step 4: Commit**

```bash
git add src/firebase.ts
git commit -m "perf(firestore): enable persistent IndexedDB cache (multi-tab)"
```

**Criterios de aceptación:** build OK; IndexedDB poblado; recargas calientes pintan sin parpadeo; sin regresiones en los listeners realtime.

---

## Fase 1 — Zod: validación en el borde de Firestore + esquemas compartidos

**Por qué:** los documentos de Firestore llegan sin tipar (`as UserProfile`, `as RawMatch`...). Un doc malformado revienta en runtime en sitios impredecibles. Zod valida en el borde y los esquemas se **reutilizan** en RHF (Fase 4) y en los search params del router (Fase 2).

**Files:**
- Create: `src/lib/schemas.ts`
- Create: `src/lib/schemas.test.ts`
- Modify: `src/context/AuthContext.tsx` (parsear el perfil)

- [ ] **Step 1: Instalar Zod**

```bash
pnpm add zod@latest
```

- [ ] **Step 2: Escribir los tests de los esquemas (fallan primero)**

```ts
// src/lib/schemas.test.ts
import { describe, it, expect } from "vitest";
import { userProfileSchema, nicknameSchema, matchResultSchema } from "./schemas";

describe("nicknameSchema", () => {
  it("normaliza a minúsculas y recorta", () => {
    expect(nicknameSchema.parse("  Piti_Goleador ")).toBe("piti_goleador");
  });
  it("rechaza < 3 y > 15 y caracteres inválidos", () => {
    expect(nicknameSchema.safeParse("ab").success).toBe(false);
    expect(nicknameSchema.safeParse("a".repeat(16)).success).toBe(false);
    expect(nicknameSchema.safeParse("piti goleador").success).toBe(false);
  });
});

describe("userProfileSchema", () => {
  it("acepta un perfil válido", () => {
    const p = userProfileSchema.parse({
      email: "a@b.com", nickname: "piti", role: "user", createdAt: new Date(),
    });
    expect(p.role).toBe("user");
  });
  it("rechaza un rol desconocido", () => {
    expect(userProfileSchema.safeParse({ email: "a@b.com", nickname: "piti", role: "root" }).success).toBe(false);
  });
});

describe("matchResultSchema", () => {
  it("rechaza goles negativos", () => {
    expect(matchResultSchema.safeParse({ rival: "X", goalsFor: -1, goalsAgainst: 0, seasonId: "s1" }).success).toBe(false);
  });
});
```

Run: `pnpm test src/lib/schemas.test.ts` → Expected: FAIL ("Cannot find module './schemas'").

- [ ] **Step 3: Implementar los esquemas**

`createdAt` puede ser `Date` o `Timestamp` de Firestore; modelamos eso con un esquema laxo. Mantén los nombres de campo idénticos a las interfaces actuales (`UserProfile` en `AuthContext`, `RawMatch` en `useSeasonMatches`).

```ts
// src/lib/schemas.ts
import { z } from "zod";

/** Firestore Timestamp-ish (tiene toMillis) o Date o número epoch. */
const firestoreDate = z.union([
  z.date(),
  z.number(),
  z.object({ toMillis: z.function() }).passthrough(),
  z.object({ seconds: z.number() }).passthrough(),
]);

export const roleSchema = z.enum(["superadmin", "admin", "user"]);

/** Reutilizable en NicknameSetup (RHF). Normaliza igual que registerNickname. */
export const nicknameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El nickname debe tener entre 3 y 15 caracteres.")
  .max(15, "El nickname debe tener entre 3 y 15 caracteres.")
  .regex(/^[a-z0-9_]+$/, "Solo letras, números y guiones bajos (_).");

export const userProfileSchema = z.object({
  email: z.string(),
  nickname: z.string(),
  role: roleSchema,
  createdAt: firestoreDate.optional(),
});
export type UserProfileParsed = z.infer<typeof userProfileSchema>;

/** Forma de un resultado de partido editado en Admin. */
export const matchResultSchema = z.object({
  rival: z.string().trim().min(1, "El rival es obligatorio."),
  goalsFor: z.number().int().min(0, "No puede ser negativo."),
  goalsAgainst: z.number().int().min(0, "No puede ser negativo."),
  seasonId: z.string().min(1),
});
export type MatchResult = z.infer<typeof matchResultSchema>;

/**
 * Valida `data` y, si falla, loguea y devuelve `fallback` (no rompe la UI).
 * Úsalo en el borde de lecturas Firestore en vez de `as`.
 */
export function safeParseDoc<T>(schema: z.ZodType<T>, data: unknown, fallback: T, ctx: string): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  console.error(`[schema] documento inválido en ${ctx}:`, r.error.issues);
  return fallback;
}
```

Run: `pnpm test src/lib/schemas.test.ts` → Expected: PASS.

- [ ] **Step 4: Usar el esquema en `AuthContext` (borde de lectura del perfil)**

En `src/context/AuthContext.tsx`, dentro de `onAuthStateChanged`, reemplaza el cast:

```ts
// antes:  const data = userDoc.data() as UserProfile;
// después:
import { userProfileSchema } from "../lib/schemas";
// ...
const parsed = userProfileSchema.safeParse(userDoc.data());
if (!parsed.success) {
  console.error("Perfil de usuario inválido:", parsed.error.issues);
  setProfile(null);
  setLoading(false);
  return;
}
const data = { ...parsed.data } as UserProfile;
```

Mantén intacta la lógica posterior (forzado de superadmin por email, override local). No cambies la interfaz pública de `AuthContext`.

- [ ] **Step 5: Verificación y commit**

Run: `pnpm test && pnpm build` → Expected: PASS. Login real: el perfil carga igual; un doc con rol inválido cae a `null` sin crashear.

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts src/context/AuthContext.tsx
git commit -m "feat(validation): add Zod schemas and validate user profile at the Firestore edge"
```

**Criterios de aceptación:** tests verdes; login sin regresión; esquemas exportados listos para Fases 2 y 4.

---

## Fase 2 — TanStack Router (rutas tipadas + code-splitting)

**Por qué:** sustituye el hash-router casero; habilita URLs limpias y deep-link (incluido el modo de la Plantilla como search param), preload "intent" para transiciones instantáneas y code-splitting por ruta (hoy todas las páginas entran en el bundle inicial). **Alcance v1:** el router cubre solo el marco autenticado (`matches/stats/plantilla/profile/admin`). El flujo Landing/Login/NicknameSetup queda fuera, igual que ahora.

**Files:**
- Create: `src/router.tsx`
- Create: `src/RootLayout.tsx`
- Modify: `src/App.tsx` (montar `RouterProvider` en la rama autenticada; quitar el hash-router)
- Modify: `src/components/Navbar.tsx` (navegar con el router en vez de `hash`)
- Modify: `src/pages/Plantilla.tsx` (leer el modo del search param)
- Modify: `firebase.json` (rewrite SPA — solo si se despliega en Firebase Hosting)

- [ ] **Step 1: Instalar router (+ devtools)**

```bash
pnpm add @tanstack/react-router@latest
pnpm add -D @tanstack/router-devtools@latest
```

Usamos **routing por código** (sin plugin de Vite ni codegen de ficheros): más contenido para una migración de 5 rutas y sin sorpresas de generación. El code-splitting se hace explícito con `lazyRouteComponent`.

- [ ] **Step 2: Crear el layout raíz** (`Navbar` + `<Outlet/>` + guarda de admin en React)

Las páginas son **exports con nombre** (`export const MatchCenter`), por eso `lazyRouteComponent` lleva el nombre del export como 2º argumento.

```tsx
// src/RootLayout.tsx
import React from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { useAuth } from "./context/AuthContext";

export const RootLayout: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  // Guarda de admin (la lógica de rol vive en React/Context, no en el router).
  React.useEffect(() => {
    if (pathname.startsWith("/admin") && !isAdmin) {
      void navigate({ to: "/profile", replace: true });
    }
  }, [pathname, isAdmin, navigate]);

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
```

- [ ] **Step 3: Definir el árbol de rutas y el router**

```tsx
// src/router.tsx
import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { RootLayout } from "./RootLayout";

const rootRoute = createRootRoute({ component: RootLayout });

const matchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./pages/MatchCenter"), "MatchCenter"),
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: lazyRouteComponent(() => import("./pages/Stats"), "Stats"),
});

// El modo de la Plantilla pasa de localStorage a search param deep-linkable.
const plantillaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plantilla",
  validateSearch: z.object({
    mode: z.enum(["expedientes", "pizarra"]).default("expedientes").catch("expedientes"),
  }),
  component: lazyRouteComponent(() => import("./pages/Plantilla"), "Plantilla"),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: lazyRouteComponent(() => import("./pages/Profile"), "Profile"),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: lazyRouteComponent(() => import("./pages/Admin"), "Admin"),
});

const routeTree = rootRoute.addChildren([
  matchesRoute, statsRoute, plantillaRoute, profileRoute, adminRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 4: Montar el router solo en la rama autenticada de `App.tsx`**

En `src/App.tsx`, **elimina** el estado del hash-router (`currentPage`, `useEffect` de `hashchange`, `validPages`, la guarda de admin local) y reemplaza el `return` del "Main Application Frame" por el `RouterProvider`. Conserva intactas las ramas previas (loading, Landing/Login, NicknameSetup).

```tsx
// src/App.tsx (extracto del marco principal)
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
// ...
  // 4. Marco principal (autenticado)
  return <RouterProvider router={router} />;
```

`RootLayout` ya renderiza `Navbar` + `Outlet`, así que el `<div className="app-container">` se traslada allí.

- [ ] **Step 5: Migrar el `Navbar` a navegación por router**

En `src/components/Navbar.tsx`: elimina las props `currentPage`/`setCurrentPage`. Mapea ids → paths y deriva el activo de la URL.

```tsx
import { useNavigate, useRouterState } from "@tanstack/react-router";

const PATHS: Record<string, string> = {
  matches: "/", stats: "/stats", plantilla: "/plantilla", profile: "/profile", admin: "/admin",
};

// dentro del componente:
const navigate = useNavigate();
const pathname = useRouterState({ select: (s) => s.location.pathname });
const currentPage =
  pathname === "/" ? "matches" : (Object.keys(PATHS).find((k) => PATHS[k] === pathname) ?? "matches");

const handleNavClick = (page: string) => void navigate({ to: PATHS[page] });
```

El resto del `Navbar` (indicador deslizante, selector de temporada, etc.) se mantiene; solo cambian la fuente de `currentPage` y `handleNavClick`. El botón del brand llama `navigate({ to: "/" })`.

- [ ] **Step 6: Plantilla lee el modo del search param**

En `src/pages/Plantilla.tsx`, reemplaza el estado `mode` + `localStorage` por el search param (deep-linkable). Mantén el `localStorage` solo como respaldo opcional o elimínalo.

```tsx
import { getRouteApi, useNavigate } from "@tanstack/react-router";
const route = getRouteApi("/plantilla");

// dentro del componente:
const { mode } = route.useSearch();
const navigate = useNavigate();
const choose = (next: "expedientes" | "pizarra") =>
  void navigate({ to: "/plantilla", search: { mode: next } });
// ...
{mode === "expedientes" ? <Expedientes /> : <Pizarra />}
```

- [ ] **Step 7: SPA fallback en producción**

Vite dev ya hace fallback a `index.html`. En producción, si despliegas en **Firebase Hosting**, añade el bloque hosting con rewrite a `firebase.json` (hoy solo tiene `firestore`):

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

Si despliegas en otra plataforma (Vercel/Netlify), configura el fallback SPA equivalente. **No** asumas Firebase Hosting sin confirmarlo.

- [ ] **Step 8: Devtools en dev, type-check, build y verificación**

Añade `<TanStackRouterDevtools />` (import perezoso, solo dev) si lo deseas. Luego:

Run: `pnpm build` → Expected: PASS y **chunks separados** por página en la salida de Vite (evidencia del code-splitting).
Verificación (preview): navega a `/`, `/stats`, `/plantilla?mode=pizarra`, `/profile`. Recarga directa en `/stats` debe funcionar (fallback). `/admin` siendo no-admin redirige a `/profile`. El indicador del Navbar sigue al cambio de ruta.

- [ ] **Step 9: Commit**

```bash
git add src/router.tsx src/RootLayout.tsx src/App.tsx src/components/Navbar.tsx src/pages/Plantilla.tsx firebase.json
git commit -m "feat(router): adopt TanStack Router with typed routes and per-route code-splitting"
```

**Criterios de aceptación:** las 5 rutas funcionan con URLs limpias; `/plantilla?mode=pizarra` deep-linkable; recarga directa OK; guarda de admin OK; build muestra chunks por ruta; sin restos del hash-router.

---

## Fase 3 — TanStack Query (caché de lecturas one-shot + puente realtime opcional)

**Por qué y alcance honesto:** la mayoría de tus colecciones ya son **realtime** (`onSnapshot`), y TanStack Query/el adaptador están pensados para lecturas one-shot con caché. **No** arranques las suscripciones realtime que funcionan. Adopta Query para: (a) lecturas one-shot (perfil, comprobación de nickname, lecturas históricas no-realtime), y (b) opcionalmente, un **puente** que vuelca los snapshots al cache para que toda la app lea de forma uniforme y se deduplique entre montajes.

**Files:**
- Modify: `src/main.tsx` (proveer `QueryClient`)
- Create: `src/lib/queryClient.ts`
- Create: `src/lib/useFirestoreCollection.ts` (puente realtime→cache, opcional)
- Create: `src/lib/useFirestoreCollection.test.ts`

- [ ] **Step 1: Instalar Query + adaptador Firebase + devtools**

```bash
pnpm add @tanstack/react-query@latest @tanstack-query-firebase/react@latest
pnpm add -D @tanstack/react-query-devtools@latest
```

- [ ] **Step 2: Crear el `QueryClient` y proveerlo en `main.tsx`**

```ts
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 min: menos refetch = menos lecturas Firestore
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

En `src/main.tsx`, envuelve `<App/>`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
// ...
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

(En dev opcional: `<ReactQueryDevtools initialIsOpen={false} />`.)

- [ ] **Step 3: Puente realtime→cache reutilizable (test primero)**

```ts
// src/lib/useFirestoreCollection.test.ts
import { describe, it, expect, vi } from "vitest";
import { mapSnapshotDocs } from "./useFirestoreCollection";

describe("mapSnapshotDocs", () => {
  it("aplica el mapper a cada doc con su id", () => {
    const snap = { docs: [{ id: "a", data: () => ({ n: 1 }) }, { id: "b", data: () => ({ n: 2 }) }] };
    const out = mapSnapshotDocs(snap as never, (id, data) => ({ id, n: (data as { n: number }).n }));
    expect(out).toEqual([{ id: "a", n: 1 }, { id: "b", n: 2 }]);
  });
});
```

Run: `pnpm test src/lib/useFirestoreCollection.test.ts` → FAIL.

- [ ] **Step 4: Implementar el puente**

```ts
// src/lib/useFirestoreCollection.ts
import { useEffect } from "react";
import { onSnapshot, type Query, type QuerySnapshot } from "firebase/firestore";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function mapSnapshotDocs<T>(snap: QuerySnapshot, map: (id: string, data: unknown) => T): T[] {
  return snap.docs.map((d) => map(d.id, d.data()));
}

/**
 * Suscribe `q` con onSnapshot y vuelca el resultado al cache de React Query
 * bajo `key`. Los componentes leen siempre vía useQuery → dedupe entre montajes,
 * estados load/error homogéneos, y datos realtime conservados.
 */
export function useFirestoreCollection<T>(
  key: readonly unknown[],
  q: Query,
  map: (id: string, data: unknown) => T,
) {
  const qc = useQueryClient();
  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => qc.setQueryData(key, mapSnapshotDocs(snap, map)),
      (err) => console.error("Firestore subscription error:", err),
    );
    return unsub;
    // key se serializa estable por el caller (array literal con strings).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(key)]);

  return useQuery<T[]>({
    queryKey: key,
    queryFn: () => new Promise<T[]>(() => {}), // resuelto por setQueryData del snapshot
    staleTime: Infinity,
  });
}
```

Run: `pnpm test src/lib/useFirestoreCollection.test.ts` → PASS.

- [ ] **Step 5 (opcional, incremental): migrar UNA colección al puente como referencia**

Candidata de bajo riesgo: la lista de temporadas (`SeasonContext`). En vez de gestionar `useState`+`onSnapshot`, internamente usa `useFirestoreCollection(["seasons"], query(collection(db,"seasons"), orderBy("name","asc")), (id, d) => ({ id, name: (d as any).name, captainPlayerId: (d as any).captainPlayerId || undefined }))` y expón `data ?? []` por el contexto. **No** migres `useLineups`/`usePizarraPlayers` en esta fase salvo que sobre tiempo; funcionan y el riesgo no compensa. Documenta en el PR qué quedó migrado y qué no (sin "caps silenciosos").

- [ ] **Step 6: type-check, build, verificación, commit**

Run: `pnpm test && pnpm build` → PASS. Verifica que los datos realtime siguen actualizándose y que (si migraste temporadas) el selector del Navbar funciona igual.

```bash
git add src/main.tsx src/lib/queryClient.ts src/lib/useFirestoreCollection.ts src/lib/useFirestoreCollection.test.ts
git commit -m "feat(data): add TanStack Query cache layer and realtime→cache bridge"
```

**Criterios de aceptación:** `QueryClientProvider` activo; puente testeado; cero regresiones realtime; alcance migrado documentado en el PR.

---

## Fase 4 — React Hook Form + Zod resolver

**Por qué:** sustituye la validación manual (`useState` + regex) por RHF con `zodResolver`, reutilizando los esquemas de la Fase 1. Worked example completo: `NicknameSetup`. Luego se aplica el mismo patrón a los formularios de `Admin`.

**Files:**
- Modify: `src/pages/NicknameSetup.tsx`
- (Después) Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: Instalar RHF + resolvers**

```bash
pnpm add react-hook-form@latest @hookform/resolvers@latest
```

- [ ] **Step 2: Refactor de `NicknameSetup` con RHF + `zodResolver`**

Reutiliza `nicknameSchema` (Fase 1). El submit conserva la llamada a `registerNickname` y el caso "nickname en uso" (que es server-side) se mapea a un error de campo.

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { nicknameSchema } from "../lib/schemas";

const formSchema = z.object({ nickname: nicknameSchema });
type FormValues = z.infer<typeof formSchema>;

// dentro del componente:
const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
  useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { nickname: "" } });

const onSubmit = handleSubmit(async ({ nickname }) => {
  try {
    const ok = await registerNickname(nickname);
    if (!ok) setError("nickname", { message: "Este nickname ya está en uso. Elige otro." });
  } catch (err) {
    setError("nickname", { message: err instanceof Error ? err.message : "Error al registrar." });
  }
});
```

En el JSX: sustituye `value/onChange/disabled` manuales por `{...register("nickname")}` y `disabled={isSubmitting}`; muestra `errors.nickname?.message`; el botón usa `isSubmitting` para el texto "Registrando...". Conserva el markup/estilos existentes (no rediseñes).

- [ ] **Step 3: Verificación de `NicknameSetup`**

Run: `pnpm build` → PASS. Manual: nickname corto/largo/ inválido → error inline sin enviar; nickname en uso → error mapeado; nickname válido → registra y redirige.

- [ ] **Step 4: Aplicar el patrón a `Admin`**

En `src/pages/Admin.tsx`, identifica los formularios (resultado de partido, eventos, gestión de roles). Para el resultado de partido reutiliza `matchResultSchema` (Fase 1) con el mismo patrón `useForm`+`zodResolver`. Define en `schemas.ts` cualquier esquema adicional que falte (eventos), siguiendo el estilo de `matchResultSchema`. Mantén la lógica de escritura Firestore y las guardas de rol existentes.

- [ ] **Step 5: Commit**

```bash
git add src/pages/NicknameSetup.tsx src/pages/Admin.tsx src/lib/schemas.ts
git commit -m "feat(forms): migrate forms to React Hook Form + Zod resolver"
```

**Criterios de aceptación:** validación inline en NicknameSetup y Admin vía esquemas Zod compartidos; sin regresión en el guardado; build OK.

---

## Fase 5 — Motion (capa de animación, respetando reduced-motion)

**Por qué:** marca "broadcast energy / every number is a trophy". Motion da micro-interacciones y transiciones de página de calidad. **Obligatorio** honrar `prefers-reduced-motion` (`PRODUCT.md`).

**Files:**
- Modify: `src/main.tsx` (o `RootLayout`) — `MotionConfig reducedMotion="user"`
- Create: `src/components/Reveal.tsx` (worked example, reemplaza `useReveal`)
- Modify: `src/RootLayout.tsx` (transición entre rutas)

- [ ] **Step 1: Instalar Motion**

```bash
pnpm add motion@latest
```

- [ ] **Step 2: `MotionConfig` global respetando reduced-motion**

Envuelve la app (en `main.tsx`, dentro de `QueryClientProvider`):

```tsx
import { MotionConfig } from "motion/react";
// ...
<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

- [ ] **Step 3: Componente `Reveal` (sustituye el hook `useReveal`)**

```tsx
// src/components/Reveal.tsx
import React from "react";
import { motion } from "motion/react";

export const Reveal: React.FC<React.PropsWithChildren<{ delay?: number }>> = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
```

Reemplaza usos puntuales de `useReveal` por `<Reveal>`. Con `reducedMotion="user"`, Motion neutraliza los desplazamientos automáticamente. No elimines `useReveal` hasta migrar todos sus usos (búscalos: `grep -rn "useReveal" src`).

- [ ] **Step 4: Transición entre rutas en `RootLayout`**

```tsx
import { AnimatePresence, motion } from "motion/react";
// envuelve el Outlet:
const pathname = useRouterState({ select: (s) => s.location.pathname });
// ...
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    <Outlet />
  </motion.div>
</AnimatePresence>
```

- [ ] **Step 5: Verificación y commit**

Run: `pnpm build` → PASS. Manual: transiciones suaves entre rutas; activa "reduce motion" en el SO → las animaciones se neutralizan (crossfade/estático). Verifica que no rompe el `useCountUp` ni las animaciones CSS existentes.

```bash
git add src/main.tsx src/components/Reveal.tsx src/RootLayout.tsx
git commit -m "feat(motion): add Motion layer with reduced-motion support and route transitions"
```

**Criterios de aceptación:** transiciones de ruta y reveals con Motion; `prefers-reduced-motion` respetado; sin regresiones de animación.

---

## Self-review / cobertura

- **Caché Firestore** → Fase 0. **Zod** → Fase 1 (+ reutilizado en 2 y 4). **TanStack Router + code-splitting (`React.lazy` equivalente vía `lazyRouteComponent`)** → Fase 2. **TanStack Query** → Fase 3. **React Hook Form** → Fase 4. **Motion** → Fase 5. (Sentry y GitHub Actions quedan **fuera** por decisión del producto.)
- **Consistencia de tipos:** `nicknameSchema`/`userProfileSchema`/`matchResultSchema` definidos en Fase 1 y consumidos por nombre idéntico en Fases 2/4. `db` exportado desde `src/firebase.ts` sin cambiar su firma. `router` registrado vía `declare module`.
- **Riesgos marcados:** no migrar suscripciones realtime que funcionan (Fase 3); SPA rewrite condicionado a la plataforma de hosting real (Fase 2, Step 7); no borrar `useReveal` hasta migrar todos sus usos (Fase 5).

## Orden recomendado de ejecución

`Fase 0 → 1 → 2 → 3 → 4 → 5`. Cada fase compila, pasa tests y es un PR independiente. Tras cada fase: `pnpm lint && pnpm test && pnpm build` y leer la salida antes de continuar.
