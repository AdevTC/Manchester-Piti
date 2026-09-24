// "Añadir al calendario": deep links that open each calendar with the event already filled,
// plus one-tap subscriptions to the club feed. Pure, so it is unit-tested.
export interface CalendarEvent {
  uid: string;
  title: string;
  start: number;
  end: number;
  location?: string;
  details?: string;
  url?: string;
}

const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const describe = (e: CalendarEvent) => [e.details, e.url].filter(Boolean).join("\n");

export function googleEventUrl(e: CalendarEvent) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${utc(e.start)}/${utc(e.end)}`, details: describe(e), location: e.location ?? "", ctz: "Europe/Madrid" });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookEventUrl(e: CalendarEvent) {
  const q = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: e.title, startdt: new Date(e.start).toISOString(), enddt: new Date(e.end).toISOString(), location: e.location ?? "", body: describe(e) });
  return `https://outlook.live.com/calendar/0/action/compose?${q}`;
}

/** Google Calendar subscribes to a webcal:// feed in one tap (it refreshes it every few hours). */
export function googleSubscribeUrl(feedHttps: string) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedHttps.replace(/^https?:/, "webcal:"))}`;
}
export const webcalUrl = (feedHttps: string) => feedHttps.replace(/^https?:/, "webcal:");

/** Which calendar to offer first: Apple on iPhone/iPad/Mac, Google elsewhere. */
export function preferredCalendar(userAgent: string): "apple" | "google" {
  return /iPhone|iPad|iPod|Macintosh/.test(userAgent) && !/Android/.test(userAgent) ? "apple" : "google";
}
