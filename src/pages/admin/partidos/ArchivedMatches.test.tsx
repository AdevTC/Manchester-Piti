import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { mergeArchivedMatches } from "../data/archivedMatches";
import type { AdminData } from "../data/useAdminData";
import { ArchivedMatchList, ArchivedMatchPane } from "./ArchivedMatches";

it("shows a historical score without status in both archive list and read-only acta", () => {
  const match = mergeArchivedMatches([{ id: "legacy", rival: "Rival histórico", date: 1, goalsFor: 2, goalsAgainst: 0 }], [])[0];
  const data = { seasons: [], players: [], archivedPlayers: [] } as unknown as AdminData;
  render(<>
    <ArchivedMatchList matches={[match]} query="" onQuery={vi.fn()} onOpen={vi.fn()} selectedId={match.id} loading={false} error={false} />
    <ArchivedMatchPane match={match} data={data} onBack={vi.fn()} onLifecycle={vi.fn()} />
  </>);
  expect(within(screen.getByRole("group", { name: "Partidos archivados" })).getByText("2–0")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "PITI 2–0 Rival histórico" })).toBeInTheDocument();
  expect(screen.getByText("Acta archivada · solo lectura")).toBeInTheDocument();
});
