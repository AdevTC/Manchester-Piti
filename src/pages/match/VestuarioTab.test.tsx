import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";

// The match page's Vestuario tab as host of the shared member controls (pages/vestuario/shared): it only has
// to render each one, in its window. What each does and writes is pinned once, in the components' own tests;
// the MVP race (the tab's own block) is in MvpRace.test.tsx.
const NOW = Date.UTC(2026, 8, 10, 12);
type Answer = { uid: string; response: "yes" | "no" | "maybe"; name: string; playerId: string | null; absenceId?: string };
const MINE: Answer = { uid: "u1", response: "maybe", name: "YO", playerId: null };
const state = vi.hoisted(() => ({ member: true, answers: [] as Answer[], absences: [] as unknown[], absencesRead: [] as boolean[] }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children?: ReactNode; to: string; className?: string }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("../../context/TeamContext", () => ({ useTeam: () => ({ member: state.member }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
vi.mock("../../hooks/useClock", () => ({ useClock: () => NOW }));
vi.mock("../../hooks/useDocumentTheme", () => ({ useDocumentTheme: () => "dark" }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: () => null }));
vi.mock("../vestuario/live", () => ({
  useAvailability: () => ({ data: state.member ? state.answers : [] }),
  useAbsences: (_today: string, enabled?: boolean) => (state.absencesRead.push(!!enabled), { data: enabled ? state.absences : [] }),
  useMatchPredictions: () => ({ data: [] }),
  useMeetingNote: () => ({ data: "" }),
  useMvpResults: () => new Map([["j5", { id: "j5", counts: { erik: 2 }, total: 2 }]]),
  useMvpResultsSync: () => ({ confirmed: true, stale: false }),
  useMvpReveal: () => false,
  useMyMvpVote: () => ({ data: "" }),
  useMyPrediction: () => ({ data: null }),
}));
vi.mock("../vestuario/writes", () => ({ useMe: () => (state.member ? { uid: "u1", name: "YO", playerId: null } : null), predictScore: vi.fn(), setAvailability: vi.fn(), voteMvp: vi.fn() }));
const SQUAD = ["erik", "pablo"].map((id) => ({ id, shirtName: id.toUpperCase(), seasons: ["t1"], seasonDetails: { t1: { shirtName: `${id.toUpperCase()}7` } } }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: SQUAD, loading: false, error: null }) }));

const { VestuarioTab } = await import("./Tabs");


const upcoming = (date: number, status = "scheduled") => ({ id: "j6", seasonId: "t1", rival: "MAD SKY", date, duration: 50, status }) as unknown as ClubMatch;
const finished = { id: "j5", seasonId: "t1", rival: "Rival", date: NOW - 86_400_000, duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 1, events: [], voteClosesAt: NOW + 3_600_000, ledger: { erik: { played: true }, pablo: { played: true } } } as unknown as ClubMatch;

beforeEach(() => {
  state.member = true;
  state.answers = [MINE];
  state.absences = [];
  state.absencesRead = [];
});

it("the convocatoria lists who is away: «Ausente · hasta …» on a «No puedo» an absence wrote or covers (never colour alone)", () => {
  // the match: 11 Sep 2026; erik's «No puedo» is his absence's, pablo's is by hand on a day his absence covers
  state.answers = [
    MINE,
    { uid: "u-erik", response: "no", name: "erik", playerId: "erik", absenceId: "a1" },
    { uid: "u-pablo", response: "no", name: "pablo", playerId: "pablo" },
    { uid: "u-raul", response: "no", name: "raul", playerId: null },
  ];
  state.absences = [
    { id: "a1", uid: "u-erik", playerId: "erik", name: "erik", from: "2026-09-10", to: "2026-09-19", note: "", createdAt: 1 },
    { id: "a2", uid: "u-pablo", playerId: "pablo", name: "pablo", from: "2026-09-11", to: "2026-10-02", note: "", createdAt: 1 },
  ];
  render(<VestuarioTab match={upcoming(NOW + 86_400_000)} players={SQUAD} phase="scheduled" />);
  const away = screen.getByRole("list", { name: "Ausentes" });
  const rows = Array.from(away.querySelectorAll("li"));
  expect(rows.map((r) => r.textContent)).toEqual(["ERIK7Ausente · hasta 19 sept", "PABLO7Ausente · hasta 2 oct"]);
  expect(rows.every((r) => r.querySelector(".aus-badge svg"))).toBe(true);
  expect(state.absencesRead.at(-1)).toBe(true);
});

it("before the match: the shared convocatoria and porra, with my answer and the porra's rule", () => {
  render(<VestuarioTab match={upcoming(NOW + 86_400_000)} players={SQUAD} phase="scheduled" />);
  expect(screen.getByRole("radiogroup", { name: "Tu respuesta a la convocatoria" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Duda" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("group", { name: "Tu porra: Piti contra MAD SKY" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Cómo se puntúa/ })).toBeInTheDocument();
  // (the kicker says the same as the card: it closes at the match's time)
  expect(screen.getByText("Tu porra · hasta el pitido inicial")).toBeInTheDocument();
});

it("the scheduled date has passed: the porra remains editable until actual kickoff", () => {
  render(<VestuarioTab match={upcoming(NOW - 60_000)} players={SQUAD} phase="scheduled" />);
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getByText("La convocatoria se cerró a la hora del partido.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar mi porra" })).toBeEnabled();
});

it("a legacy future match without status: closed, without claiming it closed at any time", () => {
  render(<VestuarioTab match={{ ...upcoming(NOW + 86_400_000), status: undefined }} players={SQUAD} phase="scheduled" />);
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getByText("Este partido no admite convocatoria.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Guardar mi porra" })).toBeNull();
  expect(screen.queryByText(/se cerró/)).toBeNull();
});

it("while the vote is open: the shared MVP ballot", () => {
  render(<VestuarioTab match={finished} players={SQUAD} phase="finished" />);
  expect(screen.getByRole("group", { name: "Tu voto" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "PABLO7" })).toBeInTheDocument();
});

it("fans get none of them, only the invitation to the vestuario", () => {
  state.absencesRead = [];
  state.member = false;
  render(<VestuarioTab match={upcoming(NOW + 86_400_000)} players={SQUAD} phase="scheduled" />);
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.queryByRole("group", { name: /Tu porra/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Entrar al vestuario" })).toBeInTheDocument();
  // (a fan never opens the absences reader)
  expect(state.absencesRead.every((on) => !on)).toBe(true);
});

it("tras el partido: the member's 1–5 nota while it is open, frozen after 7 days; a fan gets no control", () => {
  const ratings = [{ uid: "u1", name: "YO", playerId: null, score: 4 }];
  const { unmount } = render(<VestuarioTab match={finished} players={SQUAD} phase="finished" ratings={ratings} />);
  expect(screen.getByRole("radiogroup", { name: "¿Qué nota le pones al partido?" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "4 de 5" })).toBeChecked();
  unmount();
  // published 8 days ago (voteClosesAt = publication + 48 h)
  const old = { ...finished, voteClosesAt: NOW - 6 * 86_400_000 } as ClubMatch;
  const frozen = render(<VestuarioTab match={old} players={SQUAD} phase="finished" ratings={ratings} />);
  expect(screen.getByRole("heading", { name: "La nota quedó en 4,0" })).toBeInTheDocument();
  expect(screen.queryByRole("radiogroup", { name: /nota/ })).toBeNull();
  frozen.unmount();
  state.member = false;
  render(<VestuarioTab match={finished} players={SQUAD} phase="finished" ratings={ratings} />);
  expect(screen.queryByRole("radiogroup", { name: /nota/ })).toBeNull();
});
