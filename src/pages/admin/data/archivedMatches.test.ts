import { describe, expect, it } from "vitest";
import { archiveBlockedReason, mapArchivedMatch, matchIdentity, mergeArchivedMatches } from "./archivedMatches";
import { mergeMatches } from "./adminLogic";

describe("private archive data", () => {
  it("accepts only archived documents, keeping the archive flags and draft-only matches", () => {
    const base = { seasonId: "s", rival: "Rival", status: "finished" as const, date: 1, archived: true, individuallyArchived: true };
    expect(mapArchivedMatch("m", base)).toMatchObject({ id: "m", archived: true, individuallyArchived: true });
    expect(mapArchivedMatch("m", { ...base, archived: false })).toBeNull();
    expect(mapArchivedMatch("m", { ...base, deleting: true })).toBeNull();
    expect(mapArchivedMatch("m", { ...base, rival: 123 })).toBeNull();
    const rows = mergeArchivedMatches([{ id: "published", ...base }], [{ id: "draft-only", ...base, date: 2 }, { id: "published", ...base, report: "Corrección guardada" }]);
    expect(rows.map((r) => r.id)).toEqual(["draft-only", "published"]);
    expect(rows[0]).toMatchObject({ draft: true, published: false, archived: true, jornada: null });
    expect(rows[1]).toMatchObject({ draft: true, published: true, report: "Corrección guardada", jornada: null });
  });
  it("only blocks archiving while the server clock is active, including the break", () => {
    const match = mergeMatches([{ id: "m", status: "finished" }], [])[0];
    expect(archiveBlockedReason(match)).toBeNull();
    for (const phase of ["first", "halftime", "second"] as const) expect(archiveBlockedReason({ ...match, clock: { phase, revision: 1 } })).toContain("Finaliza o reinicia");
    expect(archiveBlockedReason({ ...match, clock: { phase: "ended", revision: 1 } })).toBeNull();
  });
  it.each([
    { date: Date.UTC(2026, 10, 8, 11), day: "8 de noviembre de 2026", time: "12:00" },
    { date: Date.UTC(2026, 6, 8, 11), day: "8 de julio de 2026", time: "13:00" },
    { date: Date.UTC(2026, 6, 8, 23, 30), day: "9 de julio de 2026", time: "01:30" },
  ])("identifies the rival and Madrid date $day at $time for irreversible confirmations", ({ date, day, time }) => {
    const identity = matchIdentity(mergeMatches([{ id: "m", rival: "MAD SKY", date }], [])[0]);
    expect(identity).toContain("Manchester Piti · MAD SKY · ");
    // ICU versions differ in date/time separators and hour padding. The local
    // day and kickoff time matter; the locale's punctuation is not our contract.
    expect(identity).toContain(day);
    const clock = identity.match(/(\d{1,2}):(\d{2}) \(Madrid\)$/)?.slice(1).map(Number);
    expect(clock).toEqual(time.split(":").map(Number));
  });
  it("identifies a pending rival and date without inventing match details", () => {
    expect(matchIdentity(mergeMatches([{ id: "m" }], [])[0])).toContain("Rival pendiente · Fecha pendiente");
  });
});
