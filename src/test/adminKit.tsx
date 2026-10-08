// Test kit for the admin (no Firebase, no real router tree): an AdminData fixture built with the real
// domain logic, and mountAdmin() — the real AdminLayout on a memory router with the admin's routes.
// In a test file:
//   vi.mock("<…>/pages/admin/data/useAdminData", async () => ({ useAdminData: (await import("<…>/test/adminMocks")).currentAdminData }));
//   vi.mock("<…>/context/AuthContext", async () => ({ useAuth: (await import("<…>/test/adminMocks")).fakeAuth }));
// (the mocks import adminMocks, never this file: it imports AdminLayout, which imports the mocked modules)
//   vi.mock("../../../lib/clubApi", () => ({ apiError: String, resolvePlayerClaim: vi.fn(() => Promise.resolve({ data: {} })) }));
//   setAdminData(adminFixture()); const router = mountAdmin("/admin");
import { render } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { MatchEvent } from "../../functions/src/matchEngine";
import type { ClubMatch } from "../lib/clubData";
import type { PlayerDoc, SeasonDoc } from "../lib/schemas";
import { buildOverview, contentGaps, convocatoriaState, lastActaMatch, matchState, mergeMatches, mvpNote, nextMatch, reviewActa, type AdminMatch } from "../pages/admin/data/adminLogic";
import type { AdminData, RosterPlayer } from "../pages/admin/data/useAdminData";
import { AdminLayout } from "../pages/admin/shell/AdminLayout";

/** Monday 2 Nov 2026, 10:00 in Madrid. */
export const NOW = Date.UTC(2026, 10, 2, 9, 0);
const at = (d: number, h: number) => Date.UTC(2026, 10, d, h - 1, 0);
const PLAYERS: [string, number, string, string][] = [
  ["evans", 1, "EVANS", "POR"],
  ["illescas", 4, "ILLESCAS", "DEF"],
  ["tello", 20, "TELLO", "DEF"],
  ["brawan", 33, "BRAWAN", "DEF"],
  ["eguzquiza", 8, "EGUZQUIZA", "MED"],
  ["huberoski", 14, "HUBEROSKI", "MED"],
  ["almachi", 21, "ALMACHI", "MED"],
  ["andia", 19, "ANDIA", "MED"],
  ["erik", 9, "ERIK", "DEL"],
  ["adrian", 10, "ADRIÁN T.C.", "DEL"],
  ["kevin", 11, "KEVIN", "DEL"],
  ["fer", 12, "FER", "POR"],
];
export const fixturePlayers: PlayerDoc[] = PLAYERS.map(([id, number, shirtName, naturalPosition]) => ({ id, number, shirtName, naturalPosition, seasons: ["t1"], firstName: "Nombre", lastName: "Apellidos", injured: id === "brawan", bio: ["kevin", "fer", "andia", "brawan"].includes(id) ? undefined : "Historia" }));
const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
const goal = (id: string, minute: number, playerId: string, assistPlayerId?: string): MatchEvent => ({ id, type: "goal", minute, playerId, ...(assistPlayerId ? { assistPlayerId } : {}) });
export const fixturePublished: ClubMatch[] = [
  { id: "m8", seasonId: "t1", rival: "MAD SKY", rivalInitials: "MSK", date: at(8, 12), status: "scheduled", home: false, kit: "away", starters: SEVEN.slice(0, 6), bench: ["kevin", "huberoski", "almachi"], notCalled: ["brawan"] },
  { id: "m7", seasonId: "t1", rival: "FUSION 7", rivalInitials: "FU7", date: at(1, 10), status: "scheduled", home: true },
  { id: "m6", seasonId: "t1", rival: "Emirates", date: at(-6, 10), status: "finished", goalsFor: 4, goalsAgainst: 1, voteClosesAt: at(-4, 10) },
];
export const fixtureDrafts: (ClubMatch & { updatedAt?: unknown })[] = [
  {
    id: "m7",
    seasonId: "t1",
    rival: "FUSION 7",
    rivalInitials: "FU7",
    date: at(1, 10),
    status: "finished",
    duration: 50,
    home: true,
    goalsFor: 3,
    goalsAgainst: 1,
    starters: SEVEN,
    bench: ["kevin", "almachi", "andia", "fer", "brawan"],
    notCalled: [],
    events: [goal("g1", 9, "adrian", "huberoski"), goal("g2", 31, "adrian", "erik"), { id: "r1", type: "opponent_goal", minute: 18 }],
    updatedAt: at(1, 13) + 4 * 60_000,
  },
];
const seasons: SeasonDoc[] = [
  { id: "t1", name: "Temporada 1", captainPlayerId: "adrian" },
  { id: "t0", name: "Temporada 0 · pre-Piti", archived: true },
];

/** A full AdminData as useAdminData would return it for the fixture club (override any part). */
export function adminFixture({ claimsCount, ...over }: Partial<AdminData> & { claimsCount?: number } = {}): AdminData {
  const now = over.now ?? NOW;
  const matches: AdminMatch[] = mergeMatches(fixturePublished, fixtureDrafts);
  const roster: RosterPlayer[] = fixturePlayers
    .map((p) => ({ id: p.id, name: p.shirtName!, number: p.number ?? null, position: p.naturalPosition ?? "", injured: !!p.injured, doc: p }))
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const ids = roster.map((p) => p.id);
  const next = nextMatch(matches, now)!;
  const last = lastActaMatch(matches, now)!;
  const lastView = { match: last, review: reviewActa(last, ids, now, last.published && !last.draft), publishedClean: last.published && !last.draft };
  const nextView = { match: next, conv: convocatoriaState(next, ids, next.published && !next.draft), rsvp: { yes: 9, maybe: 2, no: 1, none: 0 }, note: "Quedada 11:15" };
  const claims = [
    { uid: "u1", playerId: "kevin", playerName: "KEVIN", nickname: "nuevo.socio", email: "nuevo.socio@gmail.com", status: "pending" as const },
    { uid: "u2", playerId: "fer", playerName: "FER", nickname: "fer.portero12", email: "fernando.portero.doce.piti@gmail.com", status: "pending" as const },
  ]
    .slice(0, claimsCount ?? 2)
    .map((c) => {
      const r = roster.find((x) => x.id === c.playerId) ?? null;
      return { ...c, player: r, playerLabel: r?.name ?? c.playerName };
    });
  const people = [
    { uid: "a1", nickname: "adrian_tc", displayName: "", email: "capitan.adrian.tc@gmail.com", role: "superadmin", playerId: "adrian", removed: false },
    { uid: "a2", nickname: "erik9", displayName: "", email: "segundo.capitan@gmail.com", role: "admin", playerId: "erik", removed: false },
    { uid: "a3", nickname: "kevin11", displayName: "", email: "kevin@hotmail.com", role: "user", playerId: null, removed: false },
  ];
  const gaps = contentGaps({ crestStory: "", email: "club@piti.es", instagram: "", photoUrl: "https://x/equipo.jpg" }, roster.map((p) => ({ name: p.name, bio: p.doc.bio })));
  const overview = buildOverview({
    last: { ...lastView, mvpOpen: false },
    next: nextView,
    claims: claims.map((c) => ({ uid: c.uid, nickname: c.nickname, playerName: c.playerLabel })),
    contentGaps: gaps,
    actasPending: matches.filter((m) => ["draft", "acta"].includes(matchState(m, now, next.id))).length,
    roster: roster.length,
    seasons: seasons.length,
    admins: 2,
    doorRequests: 2,
  });
  return {
    loading: false,
    error: false,
    now,
    seasons,
    season: seasons[0],
    players: fixturePlayers,
    roster,
    matches,
    stateOf: (m) => matchState(m, now, next.id),
    reviewOf: (m) => reviewActa(m, ids, now, m.published && !m.draft),
    last: lastView,
    next: nextView,
    claims,
    people,
    admins: 2,
    doorRequests: 2,
    content: { gaps },
    mvp: mvpNote({ openUntil: null, actaPending: true, previous: { jornada: 1, names: ["ERIK"], votes: 9 } }),
    overview,
    ...over,
  };
}

export { currentAdminData, fakeAuth, setAdminData } from "./adminMocks";

type View = () => ReactElement;
const Marker = (name: string): View => {
  const C = () => <p data-testid="view">{name}</p>;
  return C;
};
/**
 * The real AdminLayout on a memory router at `path`. Views are markers («vista partidos»…) unless
 * given (`views.inicio`, `views.partidos`…).
 */
export function mountAdmin(path: string, views: Partial<Record<"inicio" | "partidos" | "convocatorias" | "fichas" | "plantilla" | "temporadas" | "capitanes" | "contenido", View>> = {}) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const admin = createRoute({ getParentRoute: () => root, path: "/admin", component: AdminLayout });
  const child = (p: string, key: keyof typeof views) => createRoute({ getParentRoute: () => admin, path: p, component: views[key] ?? Marker(`vista ${key}`) });
  const partidos = child("partidos", "partidos");
  const detail = createRoute({ getParentRoute: () => partidos, path: "$matchId", component: Marker("detalle") });
  const tree = root.addChildren([
    admin.addChildren([
      child("/", "inicio"),
      partidos.addChildren([detail]),
      child("convocatorias", "convocatorias"),
      child("fichas", "fichas"),
      child("plantilla", "plantilla"),
      child("temporadas", "temporadas"),
      child("capitanes", "capitanes"),
      child("contenido", "contenido"),
    ]),
    createRoute({ getParentRoute: () => root, path: "/", component: Marker("la web") }),
  ]);
  const router = createRouter({ routeTree: tree, history: createMemoryHistory({ initialEntries: [path] }) });
  render(<RouterProvider router={router} />);
  return router;
}
