import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch, Participation } from "../../../../lib/clubData";
import type { PlayerDoc } from "../../../../lib/schemas";
import { MODEL_VERSION } from "../../../../lib/rating/constants";
import type { ProfileData } from "../../useProfileData";
import { buildMe, tierInfo, type Answer } from "../me";
import type { CardModel } from "../TuCard";
import { Cromos } from "../Cromos";
import { Vitrina } from "./Vitrina";
import type { PlaceProps } from "./types";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => <a href={to} className={className}>{children}</a> }));

// production-shaped: the J1 played (40′ at right back, nota 4,7), twenty to come; 60 Bronce, provisional
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 11, 12);
const NOW = T0 + 14 * DAY;
const PLAYERS = [
  { id: "jordi", number: 28, shirtName: "JORDI", firstName: "Jordi", lastName: "", seasons: ["t1"], active: true },
  { id: "alcides", number: 7, shirtName: "ALCIDES", firstName: "Alcides", lastName: "", seasons: ["t1"], active: true },
] as unknown as PlayerDoc[];
const row = (o: Partial<Participation>): Participation => ({ minutes: 0, started: false, notCalled: false, played: false, stints: [], goals: 0, assists: 0, ...o }) as Participation;
const J1 = { id: "j1", seasonId: "t1", rival: "Orduña fc", home: true, status: "finished", date: T0, duration: 50, goalsFor: 1, goalsAgainst: 8, events: [], ledger: { jordi: row({ played: true, started: true, minutes: 40, stints: [{ from: 0, to: 40 }], positionsPlayed: { LD: 40 } }), alcides: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }] }) }, notas: { model: MODEL_VERSION, rival: 1, players: { jordi: { nota: 4.7, minutes: 40, weight: 0.8, narrated: false } } } } as unknown as ClubMatch;
const UP = Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, seasonId: "t1", rival: `Rival ${i}`, home: true, status: "scheduled", date: T0 + (7 + i * 7) * DAY, events: [] }) as unknown as ClubMatch);
const raw = { matches: [J1, ...UP], players: PLAYERS, seasons: [{ id: "t1", name: "Temporada 1" }], mvpResults: new Map(), standings: [] };
const back = { name: "JORDI", since: "sep 2026", howIn: "Por invitación", whoOpened: "@capi", path: "/jugadores/jordi", url: "https://x/jugadores/jordi", nick: "@jordi" };
const FACE: CardModel = { kind: "face", tier: "bronce", rating: "60", pos: "LD", name: "JORDI", num: "28", club: "Manchester Piti", attrs: [], typed: null, racha: false, back };

function props(kind: "jugador" | "socio", go = vi.fn()): PlaceProps {
  const playerId = kind === "jugador" ? "jordi" : null;
  const data = {
    uid: "u1",
    nickname: "jordi",
    seasonId: "t1",
    seasonName: "Temporada 1",
    ficha: { state: kind === "jugador" ? "vinculada" : "sin-ficha", playerId, rejectedPlayerId: null, claim: null },
    raw,
    recap: null,
    stuff: { porra: kind === "socio" ? { predictions: 5, exact: 1, points: 7, rank: 3, of: 12 } : null },
    card: { tierWhy: "", number: "28", name: "JORDI", posLong: "Lateral derecho" },
    access: { sinceText: "sep 2026" },
    shirt: { current: "JORDI" },
  } as unknown as ProfileData;
  const me = { ...buildMe({ playerId, seasonId: "t1", ...raw, now: NOW, answers: new Map<string, Answer>(), card: null }), tier: tierInfo({ rating: 60, tier: "bronce", tierName: "Bronce", global: { status: "provisional" } as never, racha: false }) };
  return { data, me, who: { kind, captain: false }, go, say: vi.fn(), now: NOW, card: { model: kind === "jugador" ? FACE : { kind: "carne", back }, origin: "https://x" }, screen: { page: "perfil", sec: "vitrina", aj: null, open: null } } as unknown as PlaceProps;
}

describe("Tu vitrina (a player, one match played)", () => {
  it("draws the head, the road, the wall and the cromos; a tile opens the viewer", () => {
    const go = vi.fn();
    render(<Vitrina {...props("jugador", go)} />);
    expect(screen.getByRole("heading", { level: 2, name: "Bronce, camino de Plata" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Tu valoración, 60, en la franja Bronce/ })).toBeTruthy();
    const road = screen.getByRole("list", { name: "Las paradas de tu camino" });
    expect(within(road).getByText("Hoy · 60 Bronce")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Por qué eres Bronce" })).toBeTruthy();
    expect(screen.getByText(/Ninguno suma puntos a tu valoración/)).toBeTruthy();
    expect(screen.getByText(/Tu álbum: 2 de 2 cromos/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir el álbum" }).getAttribute("href")).toBe("/plantilla/album");
    fireEvent.click(screen.getByRole("button", { name: "Compartir mi carta" }));
    expect(go).toHaveBeenLastCalledWith({ page: "perfil", sec: "vitrina", aj: null, open: "compartir" });
    const tiles = within(screen.getByRole("list", { name: "Tus cromos" })).getAllByRole("button");
    expect(tiles.length).toBeGreaterThan(2);
    fireEvent.click(tiles[1]);
    expect(go).toHaveBeenLastCalledWith({ page: "perfil", sec: "vitrina", aj: null, open: "cromos" });
  });
  it("the cromos viewer opens on the tapped cromo, steps with the buttons and closes with Esc", () => {
    const p = props("jugador");
    const onClose = vi.fn();
    render(<Vitrina {...p} />);
    fireEvent.click(within(screen.getByRole("list", { name: "Tus cromos" })).getAllByRole("button")[1]);
    render(<Cromos data={p.data} who={p.who} go={p.go} actions={p.actions} now={NOW} maq={null} say={vi.fn()} flip={false} setFlip={vi.fn()} replay={vi.fn()} run={0} typed={null} setTyped={vi.fn()} origin="https://x" onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Temporada 1, hasta ahora" });
    expect(within(dialog).getByRole("group").getAttribute("aria-label")).toMatch(/^Cromo 2 de \d+: Partidos y minutos/);
    expect(within(dialog).getByRole("button", { name: "Descargar todos en una imagen" })).toBeTruthy();
    const prevBtn = within(dialog).getByRole("button", { name: /Cromo anterior/ });
    prevBtn.focus();
    fireEvent.click(prevBtn);
    expect(within(dialog).getByRole("group").getAttribute("aria-label")).toMatch(/^Cromo 1 de/);
    // (on the first cromo «Cromo anterior» is disabled: the focus moves on to «Siguiente cromo», not to the page)
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: /Siguiente cromo/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Tu vitrina (a socio)", () => {
  it("is his carné and his porra, and the way to a ficha", () => {
    render(<Vitrina {...props("socio")} />);
    expect(screen.getByRole("heading", { level: 2, name: "Tu carné y lo tuyo" })).toBeTruthy();
    expect(screen.getByText(/Socio desde septiembre de 2026/)).toBeTruthy();
    expect(screen.getByText("5 pronósticos · 1 exacto · vas 3.º de 12 · 7 puntos.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Elegir mi ficha" }).getAttribute("href")).toBe("/vestuario/ficha");
    expect(screen.queryByRole("button", { name: "Ver tus cromos" })).toBeNull();
    expect(screen.getByRole("button", { name: "Compartir mi póster" })).toBeTruthy();
  });
});
