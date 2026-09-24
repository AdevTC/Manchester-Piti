// Minimal one-event iCalendar files for "Añadir al calendario".
const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

export function eventIcs(e: { uid: string; start: number; end: number; summary: string; location?: string; url?: string }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Manchester Piti//Calendario//ES",
    "BEGIN:VEVENT",
    `UID:${e.uid}@manchester-piti`,
    `DTSTAMP:${fmt(e.start)}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(e.end)}`,
    `SUMMARY:${esc(e.summary)}`,
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.url ? `URL:${e.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/** Saves an .ics file (the phone offers to add it to its calendar). */
export function downloadIcs(filename: string, ics: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
