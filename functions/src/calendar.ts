// Subscribable iCalendar feed of the club's matches (webcal://…/calendario.ics).
// Phones refresh it on their own, so a new fixture shows up in everyone's calendar.
import { onRequest } from "firebase-functions/v2/https";
import { db } from "./common.js";
import { dateMillis } from "./matchEngine.js";
import { siteUrl } from "./social.js";

const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");
/** RFC 5545 lines are folded at 75 octets. */
const fold = (line: string) => line.match(/.{1,73}/gu)?.join("\r\n ") ?? line;

export const clubCalendar = onRequest(async (_req, res) => {
  const [matches, seasons] = await Promise.all([db.collection("matches").get(), db.collection("seasons").get()]);
  const archived = new Set(seasons.docs.filter((s) => s.get("archived") === true).map((s) => s.id));
  const site = siteUrl.value().replace(/\/$/, "");
  const events = matches.docs
    .filter((m) => m.get("archived") !== true && !archived.has(m.get("seasonId")) && m.get("status") !== "cancelled")
    .map((m) => ({ id: m.id, data: m.data(), start: dateMillis(m.get("date")) }))
    .filter((m) => Number.isFinite(m.start))
    .sort((a, b) => a.start - b.start)
    .map(({ id, data, start }) => {
      const finished = data.status === "finished" && typeof data.goalsFor === "number";
      const end = start + ((data.duration as number | undefined) ?? 60) * 60_000 + 30 * 60_000;
      return [
        "BEGIN:VEVENT",
        `UID:${id}@manchester-piti`,
        `DTSTAMP:${fmt(Date.now())}`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        fold(`SUMMARY:${esc(finished ? `Piti ${data.goalsFor}–${data.goalsAgainst} ${data.rival ?? "rival"}` : `Manchester Piti vs ${data.rival ?? "rival"}`)}`),
        data.venue ? fold(`LOCATION:${esc(String(data.venue))}`) : "",
        data.status === "postponed" ? "STATUS:TENTATIVE" : "STATUS:CONFIRMED",
        fold(`URL:${site}/matches/${id}`),
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    });
  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Cache-Control", "public, max-age=900");
  res.send(
    ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Manchester Piti//Calendario//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Manchester Piti", "X-WR-TIMEZONE:Europe/Madrid", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", ...events, "END:VCALENDAR"].join("\r\n"),
  );
});
