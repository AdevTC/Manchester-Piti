// «Al calendario» on the Previa (PA- boards: one tap, no menu): the viewer's own calendar — Google's page with the
// event filled in on Android and desktops, the .ics everywhere else (iPhone, Mac). Loaded only when tapped.
import { googleEventUrl, preferredCalendar, type CalendarEvent } from "../../../lib/calendarLinks";
import { downloadIcs as save, eventIcs } from "../../../lib/ics";
import type { PMatch } from "./season";

export function matchEvent(m: PMatch, seasonName: string, origin: string): CalendarEvent {
  return {
    uid: `piti-${m.id}`,
    title: `Manchester Piti ${m.home ? "contra" : "en casa de"} ${m.rival} (J${m.j})`,
    start: m.at,
    end: m.at + m.dur * 60_000,
    location: m.venue,
    details: `${seasonName}, jornada ${m.j}.`,
    url: `${origin}/partidos/${m.id}`,
  };
}

export function downloadIcs(m: PMatch, seasonName: string): void {
  const e = matchEvent(m, seasonName, window.location.origin);
  if (preferredCalendar(navigator.userAgent) === "google") {
    window.open(googleEventUrl(e), "_blank", "noopener");
    return;
  }
  save(`${e.uid}.ics`, eventIcs({ uid: e.uid, start: e.start, end: e.end, summary: e.title, location: e.location, url: e.url }));
}
