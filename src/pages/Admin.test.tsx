import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { makeTestQueryClient } from "../test/renderWithProviders";

// ── Module mocks ────────────────────────────────────────────────────────────
// Admin pulls in the Firestore SDK (cache bridge + a manual users onSnapshot),
// the Firebase app, and AuthContext. We stub all three so mounting the REAL
// Admin component never touches a network/Firebase. The realtime collections it
// reads via useFirestoreCollection are seeded directly into the React Query
// cache below (the bridge's useQuery reads that slot; onSnapshot is a no-op).

vi.mock("../firebase", () => ({ db: {}, auth: {}, googleProvider: {} }));

// onSnapshot: register the callback but never emit (the cache is pre-seeded);
// return an unsubscribe. Other fns are identity-ish stubs. The spy is typed
// with a rest signature so the factory can forward args (the factory is hoisted
// above this const, so it references the spy lazily inside an arrow, never at
// factory-eval time).
const onSnapshot = vi.fn<(...args: unknown[]) => () => void>(() => () => {});
vi.mock("firebase/firestore", () => ({
  collection: (...a: unknown[]) => ({ __coll: a }),
  query: (...a: unknown[]) => ({ __query: a }),
  orderBy: (...a: unknown[]) => ({ __orderBy: a }),
  where: (...a: unknown[]) => ({ __where: a }),
  doc: (...a: unknown[]) => ({ __ref: a }),
  onSnapshot: (...a: unknown[]) => onSnapshot(...a),
  setDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: "new" })),
  deleteDoc: vi.fn(() => Promise.resolve()),
  Timestamp: { fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000) }) },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ updateUserRole: vi.fn(() => Promise.resolve(true)) }),
}));

import { Admin } from "./Admin";

// ── Test router: registers the real `/admin` route (Admin reads its search via
//    getRouteApi("/admin")), seeded at /admin?tab=<tab>. ───────────────────────
const SEASONS_KEY = ["seasons"] as const;
const PLAYERS_KEY = ["players"] as const;
const MATCHES_KEY = ["matches"] as const;

function mountAdmin(tab: "matches" | "roster", qc: QueryClient): void {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin",
    validateSearch: (s: Record<string, unknown>) => ({
      tab: (s.tab as string) ?? "matches",
    }),
    component: Admin,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([adminRoute]),
    history: createMemoryHistory({ initialEntries: [`/admin?tab=${tab}`] }),
  });
  const ui: ReactElement = (
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  render(ui);
}

let qc: QueryClient;
beforeEach(() => {
  onSnapshot.mockClear();
  qc = makeTestQueryClient();
  // Seed the shared-cache slots the bridge reads. The match form only renders
  // when BOTH seasons and players are non-empty; the roster form always renders.
  qc.setQueryData(SEASONS_KEY, [
    { id: "s1", name: "2024/25" },
    { id: "s2", name: "2025/26" },
  ]);
  qc.setQueryData(PLAYERS_KEY, [
    // Existing player holding dorsal #10 in season s1 (for the duplicate check).
    { id: "p1", firstName: "Adri", lastName: "G", shirtName: "ADRI", number: 10, seasons: ["s1"], seasonDetails: { s1: { shirtName: "ADRI", number: 10 } } },
  ]);
  qc.setQueryData(MATCHES_KEY, []);
});

// ── Match form validation ─────────────────────────────────────────────────────
describe("Admin · formulario de partido — mensajes de validación", () => {
  it("muestra los mensajes amigables de required al enviar vacío", async () => {
    const user = userEvent.setup();
    mountAdmin("matches", qc);

    // The friendly goal messages live in the schema; submit the empty form.
    const submit = await screen.findByRole("button", { name: /guardar partido registrado/i });
    await user.click(submit);

    // Friendly required messages for the empty number inputs (the seam the pure
    // schema test asserts on the schema; here we prove RHF surfaces them in DOM).
    expect(await screen.findByText("Introduce los goles a favor.")).toBeInTheDocument();
    expect(await screen.findByText("Introduce los goles en contra.")).toBeInTheDocument();
    // Other required fields also surface their friendly messages.
    expect(await screen.findByText("Debes seleccionar una Temporada.")).toBeInTheDocument();
    expect(await screen.findByText("El rival es obligatorio.")).toBeInTheDocument();
    expect(await screen.findByText("Escribe la fecha y hora del partido.")).toBeInTheDocument();
  });
});

describe("Admin · formulario de partido — consistencia goles vs eventos", () => {
  it("bloquea el guardado si los goles del Piti en eventos superan el marcador", async () => {
    const user = userEvent.setup();
    // Seed a match that ALREADY holds 2 Piti-goal events. Clicking "Editar"
    // loads those events into the form WITHOUT touching the (jsdom-unfriendly)
    // Radix event picker, so we can exercise the goals-vs-events guard
    // deterministically: set goalsFor=1 (< 2 goal events) and submit.
    qc.setQueryData(MATCHES_KEY, [
      {
        id: "m1",
        seasonId: "s1",
        rival: "Barrio FC",
        competition: "Liga",
        date: { seconds: Math.floor(new Date("2025-01-01T12:00").getTime() / 1000) },
        goalsFor: 2,
        goalsAgainst: 0,
        events: [
          { type: "goal", playerId: "p1" },
          { type: "goal_penalty", playerId: "p1" },
        ],
      },
    ]);
    mountAdmin("matches", qc);

    // Enter edit mode for the seeded match (loads its 2 goal events into state).
    await user.click(await screen.findByRole("button", { name: /^editar$/i }));

    // Lower the score to 1 goal-for so it conflicts with the 2 goal events.
    // Goals-for is the first of the two placeholder="0" number inputs.
    const goalsFor = (await screen.findAllByPlaceholderText("0"))[0];
    await user.clear(goalsFor);
    await user.type(goalsFor, "1");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(
      await screen.findByText(/Conflicto de Goles: Has registrado 2 goles/i),
    ).toBeInTheDocument();
  });
});

// ── Player form validation ────────────────────────────────────────────────────
describe("Admin · formulario de jugador — mensajes de validación", () => {
  it("muestra los mensajes de required (nombre, camiseta, dorsal)", async () => {
    const user = userEvent.setup();
    mountAdmin("roster", qc);

    const submit = await screen.findByRole("button", { name: /registrar jugador/i });
    await user.click(submit);

    expect(await screen.findByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(await screen.findByText("El nombre en camiseta es obligatorio.")).toBeInTheDocument();
    // Friendly required for the empty number input (RHF maps empty→undefined).
    expect(await screen.findByText("El dorsal es obligatorio.")).toBeInTheDocument();
  });

  it("surfacea el error inline de dorsal duplicado por temporada (cableado RHF)", async () => {
    const user = userEvent.setup();
    mountAdmin("roster", qc);

    // Type dorsal #10 (already held by p1 in s1) into the default dorsal input.
    const dorsal = await screen.findByPlaceholderText("ej: 10");
    await user.clear(dorsal);
    await user.type(dorsal, "10");

    // Select season s1 via its (plain) checkbox so the per-season dorsal resolves
    // to the scalar 10 and collides with p1. The inline effect drives a manual
    // RHF error on `number` → message rendered.
    const s1Checkbox = within(screen.getByText("2024/25").closest("div")!).getByRole("checkbox");
    await user.click(s1Checkbox);

    expect(
      await screen.findByText(/El dorsal #10 ya está registrado en 2024\/25 por otro jugador\./i),
    ).toBeInTheDocument();
  });

  it("NO marca duplicado si el dorsal está libre en la temporada seleccionada", async () => {
    const user = userEvent.setup();
    mountAdmin("roster", qc);

    // The default dorsal input is the first number input with placeholder "ej: 10".
    const dorsal = (await screen.findAllByPlaceholderText("ej: 10"))[0];
    await user.clear(dorsal);
    await user.type(dorsal, "99"); // free number

    const s1Checkbox = within(screen.getByText("2024/25").closest("div")!).getByRole("checkbox");
    await user.click(s1Checkbox);

    // The per-season detail row appears once the season is checked; wait for it,
    // then assert NO duplicate message is present (99 collides with nothing).
    await waitFor(() => expect(s1Checkbox).toBeChecked());
    expect(screen.queryByText(/ya está registrado/i)).not.toBeInTheDocument();
  });
});
