import { describe, expect, it } from "vitest";
import { googleEventUrl, googleSubscribeUrl, outlookEventUrl, preferredCalendar, webcalUrl } from "./calendarLinks";

const e = { uid: "m1", title: "Manchester Piti vs Rival", start: Date.UTC(2026, 9, 18, 9), end: Date.UTC(2026, 9, 18, 10, 30), location: "Campo municipal", url: "https://x.test/matches/m1" };

describe("calendar links", () => {
  it("Google opens the event template, dates in UTC", () => {
    const u = new URL(googleEventUrl(e));
    expect(u.hostname).toBe("calendar.google.com");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261018T090000Z/20261018T103000Z");
    expect(u.searchParams.get("text")).toBe("Manchester Piti vs Rival");
    expect(u.searchParams.get("location")).toBe("Campo municipal");
    expect(u.searchParams.get("details")).toContain("https://x.test/matches/m1");
  });
  it("Outlook composes the event", () => {
    const u = new URL(outlookEventUrl(e));
    expect(u.searchParams.get("subject")).toBe("Manchester Piti vs Rival");
    expect(u.searchParams.get("startdt")).toBe("2026-10-18T09:00:00.000Z");
  });
  it("subscriptions use webcal", () => {
    expect(webcalUrl("https://club.test/calendario.ics")).toBe("webcal://club.test/calendario.ics");
    expect(googleSubscribeUrl("https://club.test/calendario.ics")).toBe("https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fclub.test%2Fcalendario.ics");
  });
  it("offers Apple first on Apple devices", () => {
    expect(preferredCalendar("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("apple");
    expect(preferredCalendar("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("google");
    expect(preferredCalendar("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("google");
  });
});
