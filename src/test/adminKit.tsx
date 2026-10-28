// Test kit for the admin (no Firebase): an AdminData fixture built with the real domain logic, and mountAdmin() —
// the real Sala de control (its frame, the match's layout) on a memory router with the sala's addresses.
// In a test file:
//   vi.mock("<…>/pages/admin/data/useAdminData", async () => ({ useAdminData: (await import("<…>/test/adminMocks")).currentAdminData }));
//   vi.mock("<…>/context/AuthContext", async () => ({ useAuth: (await import("<…>/test/adminMocks")).fakeAuth }));
// (the mocks import adminMocks, never this file: it imports AdminLayout, which imports the mocked modules)
//   vi.mock("../../../lib/clubApi", () => ({ apiError: String, resolvePlayerClaim: vi.fn(() => Promise.resolve({ data: {} })) }));
//   setAdminData(adminFixture()); const router = mountAdmin("/admin");
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeTestQueryClient } from "./renderWithProviders";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, redirect, RouterProvider, type AnyRoute } from "@tanstack/react-router";
import { legacyHref } from "../lib/legacyUrls";
import { PartidoLayout } from "../pages/admin/partido/PartidoLayout";
import { NotFoundScreen } from "../pages/admin/shell/Screen";
import * as HP from "../pages/admin/areas/hoy-partidos/screens";
import * as AC from "../pages/admin/areas/acta/screens";
import * as PL from "../pages/admin/areas/plantilla/screens";
import * as CJ from "../pages/admin/areas/caja/Caja";
import * as CL from "../pages/admin/areas/club/screens";
import type { ReactElement } from "react";
import type { MatchEvent } from "../../functions/src/matchEngine";
import type { ClubMatch } from "../lib/clubData";
import type { PlayerDoc, SeasonDoc } from "../lib/schemas";
import { buildOverview, contentGaps, convocatoriaState, doneLines, lastActaMatch, matchState, mergeMatches, mvpNote, nextMatch, pendingProposals, reviewActa, rsvpCounts, type AdminMatch } from "../pages/admin/data/adminLogic";
import { hoyHero, matchMoment } from "../pages/admin/data/moments";
import { seasonSquad } from "../pages/perfil/card";
import { ratingMatches, seasonRatings } from "../lib/seasonRating";
import { seasonPlayers } from "../pages/perfil/profileData";
import type { Availability } from "../pages/vestuario/live";
import type { AdminData, RosterPlayer } from "../pages/admin/data/useAdminData";
import { AdminLayout } from "../pages/admin/shell/AdminLayout";
import { boardFromLocks } from "../pages/pizarra/officialBoard";
import { toBePlayed } from "../lib/derived/kickoff";

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
const answer = (playerId: string, response: Availability["response"]): Availability => ({ uid: `u-${playerId}`, response, name: playerId, playerId });
/** The J8's RSVP (as in the design): 8 come, ALMACHI and ANDIA doubt, BRAWAN can't, FER hasn't answered. */
export const fixtureAnswers: Availability[] = [
  ...["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian", "kevin"].map((id) => answer(id, "yes")),
  answer("almachi", "maybe"),
  answer("andia", "maybe"),
  answer("brawan", "no"),
];

/** A full AdminData as useAdminData would return it for the fixture club (override any part). `published`
 *  replaces the published matches (e.g. the J8 with live events), `answers` the next match's RSVP. */
export function adminFixture({
  claimsCount,
  published = fixturePublished,
  answers = fixtureAnswers,
  whistled = new Set<string>(),
  contentDrafts = [],
  proposing = [],
  officialLocks = {},
  ...over
}: Partial<AdminData> & {
  claimsCount?: number;
  published?: ClubMatch[];
  answers?: Availability[];
  whistled?: ReadonlySet<string>;
  contentDrafts?: { key: string; title: string }[];
  /** Ids of players with a position proposal waiting. */
  proposing?: string[];
  /** The season's lineupOfficials (scope doc id «t1__m8» / «t1__temporada» → the board it names): what
   *  officialBoardOf resolves through, with useAdminData's own rule. */
  officialLocks?: Record<string, string>;
} = {}): AdminData {
  const now = over.now ?? NOW;
  const matches: AdminMatch[] = mergeMatches(published, fixtureDrafts);
  const roster: RosterPlayer[] = fixturePlayers
    .map((p) => (proposing.includes(p.id) ? { ...p, positionsProposal: { main: "MC" as const, also: [], at: now } } : p))
    .map((p) => ({ id: p.id, name: p.shirtName!, number: p.number ?? null, position: p.naturalPosition ?? "", injured: !!p.injured, doc: p }))
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const ids = roster.map((p) => p.id);
  const next = nextMatch(matches, now) ?? null;
  const last = lastActaMatch(matches, now) ?? null;
  const reviewOf = (m: AdminMatch) => reviewActa(m, ids, now, m.published && !m.draft);
  const lastView = last ? { match: last, review: reviewOf(last), publishedClean: last.published && !last.draft } : null;
  const nextView = next ? { match: next, conv: convocatoriaState(next, ids, next.published && !next.draft), rsvp: rsvpCounts(answers, ids), answers, note: "Quedada 11:15" } : null;
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
  const hero = hoyHero(matches, now, whistled);
  const lastPub = matches.filter((m) => m.published && !m.draft && m.status === "finished").at(-1);
  const overview = buildOverview({
    actas: matches.filter((m) => matchMoment(m, now, whistled.has(m.id)) === "final").map((m) => ({ match: m, review: reviewOf(m) })),
    heroId: hero?.match.id ?? null,
    claims: claims.map((c) => ({ playerName: c.playerLabel })),
    proposals: pendingProposals(roster),
    contentGaps: gaps,
    contentDrafts,
    done: doneLines({
      lastPublished: lastPub ? { match: lastPub, goalsFor: lastPub.goalsFor ?? 0, goalsAgainst: lastPub.goalsAgainst ?? 0 } : null,
      mvp: { jornada: 1, names: ["ERIK"] },
      notified: next && typeof next.convocatoriaNotifiedAt === "number" ? next : null,
    }),
  });
  const built = seasonSquad(seasonPlayers(fixturePlayers, "t1", seasons, null), published, "t1", new Map(), now, []);
  return {
    loading: false,
    error: false,
    now,
    seasons,
    season: seasons[0],
    autoSeason: seasons[0],
    players: fixturePlayers,
    roster,
    matches,
    archivedMatches: [],
    archivedPlayers: [],
    archivesLoading: false,
    archivesError: false,
    published,
    ratings: seasonRatings(ratingMatches(published), []),
    stateOf: (m) => matchState(m, now, next?.id),
    reviewOf,
    last: lastView,
    next: nextView,
    hero,
    squad: built.squad,
    games: built.games.length,
    claims,
    people,
    admins: 2,
    doorRequests: 2,
    content: { gaps },
    mvp: mvpNote({ openUntil: null, actaPending: true, previous: { jornada: 1, names: ["ERIK"], votes: 9 } }),
    overview,
    officialBoardOf: (m) => boardFromLocks(new Map(Object.entries(officialLocks)), "t1", m, toBePlayed(m, now)),
    ...over,
  };
}

export { currentAdminData, fakeAuth, setAdminData } from "./adminMocks";

type View = () => ReactElement;
const Marker = (name: string): View => {
  const C = () => <p data-testid="view">{name}</p>;
  return C;
};
/** Which of the sala's areas a test wants real (today's views inside their new screens); the rest are markers
 *  («vista partidos», «estación datos»…). The keys are the old views': passing one turns its screens on. */
type ViewKey = "hoy" | "partidos" | "detalle" | "convocar" | "fichas" | "plantilla" | "temporadas" | "capitanes" | "contenido" | "caja" | "clasificacion" | "turnos";
/**
 * The real Sala de control (AdminLayout, the match's PartidoLayout) on a memory router at `path`, with the new
 * addresses (router.tsx's admin tree) and every old one redirected the way the app does (lib/legacyUrls).
 */
export function mountAdmin(path: string, views: Partial<Record<ViewKey, View>> = {}) {
  // (the frame measures window.innerWidth: jsdom's 1024 is a tablet since r12 — the desktop starts at 1100 — so a test
  // that did not choose a width gets the desktop it was written for)
  if (window.innerWidth === 1024) Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  const on = (k: ViewKey) => !!views[k];
  const root = createRootRoute({
    component: () => <Outlet />,
    beforeLoad: ({ location }) => {
      const href = legacyHref(location.pathname + location.searchStr);
      if (href) throw redirect({ href, replace: true });
    },
  });
  const admin = createRoute({ getParentRoute: () => root, path: "/admin", component: AdminLayout });
  const r = (parent: AnyRoute, p: string, component: View) => createRoute({ getParentRoute: () => parent, path: p, component });
  const partidos = createRoute({ getParentRoute: () => admin, path: "partidos" });
  const match = createRoute({ getParentRoute: () => partidos, path: "$matchId", component: PartidoLayout });
  const real = on("partidos") || on("detalle");
  const st = (name: string, Real: View) => (real ? Real : Marker(`estación ${name}`));
  // (the list, the ficha, the alta and the cromos are PlantillaArea's own, as in the app: router.tsx)
  const plantilla = createRoute({ getParentRoute: () => admin, path: "plantilla", component: on("plantilla") ? PL.PlantillaArea : Outlet });
  const own = (name: string) => (on("plantilla") ? () => <></> : Marker(name));
  const caja = createRoute({ getParentRoute: () => admin, path: "caja" });
  const club = createRoute({ getParentRoute: () => admin, path: "club" });
  const tree = root.addChildren([
    admin.addChildren([
      r(admin, "/", on("hoy") ? HP.HoyScreen : Marker("vista hoy")),
      partidos.addChildren([
        r(partidos, "/", on("partidos") ? HP.TemporadaScreen : Marker("vista partidos")),
        r(partidos, "nuevo", on("partidos") ? HP.NuevoScreen : Marker("vista nuevo")),
        r(partidos, "archivados", on("partidos") ? HP.ArchivadosScreen : Marker("vista archivados")),
        r(partidos, "archivados/$matchId", on("partidos") ? HP.ArchivadoScreen : Marker("vista archivado")),
        match.addChildren([
          r(match, "/", real ? HP.StationAuto : Marker("estación de su momento")),
          r(match, "convocatoria", on("convocar") || real ? HP.ConvocatoriaScreen : Marker("estación convocatoria")),
          r(match, "datos", st("datos", HP.DatosScreen)),
          r(match, "en-juego", st("en-juego", HP.EnJuegoScreen)),
          r(match, "acta", st("acta", AC.ActaScreen)),
          r(match, "acta/narracion", st("narración", AC.NarracionScreen)),
          r(match, "acta/historial", st("historial", AC.HistorialScreen)),
          r(match, "publicar", st("publicar", AC.PublicarScreen)),
          r(match, "despues", st("después", AC.DespuesScreen)),
        ]),
      ]),
      plantilla.addChildren([
        r(plantilla, "/", own("vista plantilla")),
        r(plantilla, "alta", own("vista alta")),
        r(plantilla, "cromos", own("vista cromos")),
        r(plantilla, "antiguos", on("plantilla") ? PL.AntiguosScreen : Marker("vista antiguos")),
        r(plantilla, "socios", on("fichas") ? PL.SociosScreen : Marker("vista socios")),
        r(plantilla, "capitanes", on("capitanes") ? PL.CapitanesScreen : Marker("vista capitanes")),
        r(plantilla, "$playerId", own("vista ficha")),
      ]),
      caja.addChildren([r(caja, "/", on("caja") ? CJ.CajaScreen : Marker("vista caja")), r(caja, "coste/$matchId", on("caja") ? CJ.CosteScreen : Marker("vista coste"))]),
      club.addChildren([
        r(club, "/", CL.OficinaScreen),
        r(club, "temporadas", on("temporadas") ? CL.TemporadasScreen : Marker("vista temporadas")),
        r(club, "clasificacion", on("clasificacion") ? CL.ClasificacionScreen : Marker("vista clasificación")),
        r(club, "web", on("contenido") ? CL.WebScreen : Marker("vista web")),
        r(club, "web/$seccion", on("contenido") ? CL.WebSeccionScreen : Marker("vista web sección")),
        r(club, "turnos", on("turnos") ? CL.TurnosScreen : Marker("vista turnos")),
        r(club, "vestuario", CL.VestuarioScreen),
        r(club, "avisos", CL.AvisosScreen),
        r(club, "equipaciones", CL.EquipacionesScreen),
      ]),
      r(admin, "$", NotFoundScreen),
    ]),
    createRoute({ getParentRoute: () => root, path: "/", component: Marker("la web") }),
    createRoute({ getParentRoute: () => root, path: "/vestuario", component: Marker("el vestuario") }),
    createRoute({ getParentRoute: () => root, path: "/perfil", component: Marker("el perfil") }),
    // the ways out of the sala (Ver en la web, Abrir la pizarra, Abrir la mesa)
    createRoute({ getParentRoute: () => root, path: "/pizarra", component: Marker("la pizarra") }),
    createRoute({ getParentRoute: () => root, path: "/partidos/$matchId", component: Marker("la ficha del partido") }),
    createRoute({ getParentRoute: () => root, path: "/partidos/$matchId/mesa", component: Marker("la mesa") }),
    createRoute({ getParentRoute: () => root, path: "/jugadores/$playerId", component: Marker("la página del jugador") }),
  ]);
  const router = createRouter({ routeTree: tree, history: createMemoryHistory({ initialEntries: [path] }) });
  // (the app's QueryClient: the screens read the club content and the weather through it)
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

