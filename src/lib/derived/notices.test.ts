import { describe, expect, it } from "vitest";
import { bellLabel, groupNotices, isUnread, mergeNotices, noticeIcon, relativeTime, toMillis, unreadCount, type Notice } from "./notices";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// 16 oct 2026, 12:00 in Madrid (CEST, UTC+2)
const NOW = Date.UTC(2026, 9, 16, 10);
const n = (id: string, at: number, extra: Partial<Notice> = {}): Notice => ({ id, topic: "lineup", title: id, body: "", url: "/", at, audience: "team", ...extra });

describe("mergeNotices", () => {
  it("joins the three reads newest first, each notice once", () => {
    const team = [n("a", NOW - HOUR), n("c", NOW - 3 * HOUR)];
    const captains = [n("b", NOW - 2 * HOUR, { audience: "captains" })];
    const mine = [n("d", NOW - MIN, { audience: "personal", uid: "u1" }), n("a", NOW - HOUR)];
    expect(mergeNotices(team, captains, mine).map((x) => x.id)).toEqual(["d", "a", "b", "c"]);
    expect(mergeNotices([], [], [])).toEqual([]);
  });
});

describe("groupNotices", () => {
  it("splits by Madrid day: Hoy, Esta semana (six days before), Antes; empty groups left out", () => {
    const list = mergeNotices([
      n("today", NOW - HOUR),
      // 00:30 Madrid today = 22:30 UTC yesterday: still «Hoy»
      n("late-utc", Date.UTC(2026, 9, 15, 22, 30)),
      n("yesterday", NOW - DAY),
      n("six", NOW - 6 * DAY),
      n("seven", NOW - 7 * DAY),
    ]);
    const groups = groupNotices(list, NOW);
    expect(groups.map((g) => [g.label, g.items.map((x) => x.id)])).toEqual([
      ["Hoy", ["today", "late-utc"]],
      ["Esta semana", ["yesterday", "six"]],
      ["Antes", ["seven"]],
    ]);
    expect(groupNotices([n("x", NOW - 10 * DAY)], NOW).map((g) => g.key)).toEqual(["antes"]);
    expect(groupNotices([], NOW)).toEqual([]);
  });
});

describe("relativeTime", () => {
  it("says it in words up to six days, then the date", () => {
    expect(relativeTime(NOW - 20_000, NOW)).toBe("ahora");
    expect(relativeTime(NOW + 5_000, NOW)).toBe("ahora");
    expect(relativeTime(NOW - 5 * MIN, NOW)).toBe("hace 5 min");
    expect(relativeTime(NOW - 2 * HOUR, NOW)).toBe("hace 2 h");
    expect(relativeTime(NOW - DAY, NOW)).toBe("ayer");
    // 23:00 Madrid yesterday, 13 h ago: already «ayer»
    expect(relativeTime(Date.UTC(2026, 9, 15, 21), NOW)).toBe("ayer");
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe("hace 3 días");
    expect(relativeTime(NOW - 6 * DAY, NOW)).toBe("10 oct");
    expect(relativeTime(Date.UTC(2025, 11, 20, 10), NOW)).toBe("20 dic 2025");
  });
});

describe("unread", () => {
  const list = [n("a", NOW - MIN), n("b", NOW - HOUR), n("c", NOW - DAY)];
  it("counts what is newer than the last look; with no look everything is", () => {
    expect(unreadCount(list, null)).toBe(3);
    expect(unreadCount(list, NOW - 2 * HOUR)).toBe(2);
    expect(unreadCount(list, NOW)).toBe(0);
    expect(isUnread(list[1], NOW - HOUR)).toBe(false);
  });
  it("names the bell in words", () => {
    expect(bellLabel(0)).toBe("Avisos");
    expect(bellLabel(3)).toBe("Avisos, 3 sin leer");
  });
});

describe("toMillis", () => {
  it("reads a Timestamp, a Date, ms and { seconds }; null for anything else", () => {
    expect(toMillis({ toMillis: () => 42 })).toBe(42);
    expect(toMillis(new Date(7))).toBe(7);
    expect(toMillis(9)).toBe(9);
    expect(toMillis({ seconds: 2 })).toBe(2000);
    expect(toMillis(null)).toBeNull();
    expect(toMillis("2026-10-16")).toBeNull();
  });
});

describe("noticeIcon", () => {
  it("gives each topic its icon and the bell to an unknown one", () => {
    expect(noticeIcon("lineup")).toBe("shirt");
    expect(noticeIcon("convocatoria")).toBe("team");
    expect(noticeIcon("dates")).toBe("cal");
    expect(noticeIcon("final")).toBe("flag");
    expect(noticeIcon("mvp")).toBe("star");
    expect(noticeIcon("personal")).toBe("user");
    expect(noticeIcon("door")).toBe("padlock");
    expect(noticeIcon("¿?")).toBe("bell");
  });
});
