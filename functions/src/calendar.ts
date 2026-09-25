// Subscribable iCalendar feed of the club's matches (webcal://…/calendario.ics).
// Phones refresh it on their own, so a new fixture shows up in everyone's calendar.
import { onRequest } from "firebase-functions/v2/https";
import { db, siteUrl } from "./common.js";
import { dateMillis } from "./matchEngine.js";

const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");
/** RFC 5545 lines are folded at 75 octets. */
const fold = (line: string) => line.match(/.{1,73}/gu)?.join("\r\n ") ?? line;

export const clubCalendar = onRequest(async (_req, res) => {
  const [matches, seasons, trainings] = await Promise.all([
    db.collection("matches").get(),
    db.collection("seasons").get(),
    db.collection("trainings").where("confirmed.slotId", "!=", null).get(),
  ]);
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
  // Confirmed trainings (team-only data: only when, where and that it is a training).
  const practice = trainings.docs.map((t) => {
    const c = t.get("confirmed") as { at: FirebaseFirestore.Timestamp; end?: FirebaseFirestore.Timestamp; place?: string };
    const start = c.at.toMillis();
    return [
      "BEGIN:VEVENT",
      `UID:training-${t.id}@manchester-piti`,
      `DTSTAMP:${fmt(Date.now())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(c.end ? c.end.toMillis() : start + 90 * 60_000)}`,
      "SUMMARY:Entreno Manchester Piti",
      c.place ? fold(`LOCATION:${esc(c.place)}`) : "",
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });
  events.push(...practice);
  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Cache-Control", "public, max-age=900");
  res.send(
    ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Manchester Piti//Calendario//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Manchester Piti", "X-WR-TIMEZONE:Europe/Madrid", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", ...events, "END:VCALENDAR"].join("\r\n"),
  );
});
