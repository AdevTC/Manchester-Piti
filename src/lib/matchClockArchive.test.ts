import { describe, expect, it } from "vitest";
import { archiveClock, clockReading, readyClock, restoreArchivedClock, transitionClock, type MatchClock } from "../../functions/src/matchClock";
import { matchSnapshot } from "./ficha";

const DAY = 86_400_000;

describe("archiving any match without inventing playing time", () => {
  it("freezes and resumes both halves and the break while keeping their real timestamps", () => {
    let c = transitionClock(undefined, "start", 1000);
    c = archiveClock(c, 601_000)!;
    expect(clockReading(c, 601_000 + DAY)).toMatchObject({ elapsedSeconds: 600, playing: false });
    c = restoreArchivedClock(c, 601_000 + DAY)!;
    expect(c.firstStartedAt).toBe(1000);
    expect(clockReading(c, 602_000 + DAY)).toMatchObject({ elapsedSeconds: 601, playing: true });
    c = transitionClock(c, "halftime", 1_501_000 + DAY);
    c = archiveClock(c, 1_621_000 + DAY)!;
    expect(clockReading(c, 1_621_000 + 3 * DAY)).toMatchObject({ elapsedSeconds: 1500, breakSeconds: 120 });
    c = restoreArchivedClock(c, 1_621_000 + 3 * DAY)!;
    c = transitionClock(c, "second", 1_801_000 + 3 * DAY);
    c = archiveClock(c, 2_401_000 + 3 * DAY)!;
    expect(clockReading(c, 2_401_000 + 7 * DAY)).toMatchObject({ elapsedSeconds: 2100, secondSeconds: 600, breakSeconds: 300, playing: false });
    c = restoreArchivedClock(c, 2_401_000 + 7 * DAY)!;
    c = transitionClock(c, "finish", 3_301_000 + 7 * DAY);
    expect(c).toMatchObject({ firstStartedAt: 1000, firstEndedAt: 1_501_000 + DAY, secondStartedAt: 1_801_000 + 3 * DAY, endedAt: 3_301_000 + 7 * DAY });
    expect(clockReading(c, 12 * DAY)).toMatchObject({ firstSeconds: 1500, secondSeconds: 1500, elapsedSeconds: 3000, breakSeconds: 300, playing: false });
    const players = ["a", "b", "c", "d", "e", "f", "g"];
    const snapshot = matchSnapshot({ starters: players, bench: [], events: [], clock: c }, 12 * DAY);
    for (const id of players) expect(snapshot.players[id].secondsPlayed).toBe(3000);
  });

  it("does not count a repeated archive/restore twice or permit clock changes while archived", () => {
    const started = transitionClock(undefined, "start", 0);
    const paused = archiveClock(started, 1500)!;
    expect(archiveClock(paused, 2500)).toBe(paused);
    expect(() => transitionClock(paused, "halftime", 2500)).toThrow(/Reactiva/);
    const restored = restoreArchivedClock(paused, 5000)!;
    expect(restoreArchivedClock(restored, 6000)).toBe(restored);
    expect(restored.revision).toBe(started.revision + 2);
    const twice = restoreArchivedClock(archiveClock(restored, 5500), 9000)!;
    expect(clockReading(twice, 9500).elapsedSeconds).toBe(2);
    expect(twice.firstStartedAt).toBe(0);
  });

  it("preserves exclusions when an operator undoes a period transition", () => {
    let c = transitionClock(undefined, "start", 0);
    c = transitionClock(c, "halftime", 100_000);
    c = restoreArchivedClock(archiveClock(c, 110_000), 210_000)!;
    c = transitionClock(c, "resume_first", 220_000);
    // (the 1ª ran 0–100 s and carries on from 100 s: the break, archived or not, never counts as play)
    expect(clockReading(c, 230_000).elapsedSeconds).toBe(110);
    c = transitionClock(c, "halftime", 240_000);
    c = transitionClock(c, "second", 250_000);
    c = restoreArchivedClock(archiveClock(c, 260_000), 360_000)!;
    c = transitionClock(c, "undo_second", 370_000);
    expect(clockReading(c, 380_000)).toMatchObject({ firstSeconds: 120, secondSeconds: 0, breakSeconds: 40 });
  });

  it("B-MESA-01: reopening a finished match carries on from the final whistle (the minutes in Final never count)", () => {
    let c = transitionClock(undefined, "start", 0);
    c = transitionClock(c, "halftime", 1_500_000);
    c = transitionClock(c, "second", 1_800_000);
    c = transitionClock(c, "finish", 3_300_000);
    expect(clockReading(c, 3_300_000).elapsedSeconds).toBe(3000);
    // five minutes in Final, then «Reabrir el partido»
    c = transitionClock(c, "reopen", 3_600_000);
    expect(c.phase).toBe("second");
    expect(clockReading(c, 3_600_000).elapsedSeconds).toBe(3000);
    expect(clockReading(c, 3_660_000)).toMatchObject({ elapsedSeconds: 3060, secondSeconds: 1560, playing: true });
    // reopened twice: still only the time actually played
    c = transitionClock(c, "finish", 3_660_000);
    c = transitionClock(c, "reopen", 4_000_000);
    expect(clockReading(c, 4_000_000).elapsedSeconds).toBe(3060);
    const players = ["a", "b", "c", "d", "e", "f", "g"];
    const snapshot = matchSnapshot({ starters: players, bench: [], events: [], clock: transitionClock(c, "finish", 4_000_000) }, 5_000_000);
    for (const id of players) expect(snapshot.players[id].secondsPlayed).toBe(3060);
  });

  it("B-MESA-01: «Volver a la 1ª» from the break carries on from the half-time whistle", () => {
    let c = transitionClock(undefined, "start", 0);
    c = transitionClock(c, "halftime", 600_000);
    c = transitionClock(c, "resume_first", 900_000);
    expect(clockReading(c, 900_000)).toMatchObject({ phase: "first", elapsedSeconds: 600, playing: true });
    expect(clockReading(c, 960_000).elapsedSeconds).toBe(660);
  });

  it("leaves a missing, unstarted or finished clock intact", () => {
    const ended: MatchClock = { phase: "ended", revision: 5, firstStartedAt: 0, endedAt: 300_000 };
    for (const clock of [undefined, readyClock(), ended]) {
      expect(archiveClock(clock, DAY)).toBe(clock);
      expect(restoreArchivedClock(clock, 2 * DAY)).toBe(clock);
    }
  });
});
