# Responder desde el aviso: design

Date: 2026-10-16. This is idea 14 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3). The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
The RSVP reminders («¿Vas al partido?», which go only to members who haven't answered) get two buttons; «Ya está la convocatoria» goes on the public topic, so it carries none, «Voy» and «No puedo». One tap answers without hunting for the RSVP.

## How
- **Push payload.** The notices that ask for an answer (the convocatoria published and the RSVP reminders to members who haven't answered) carry an `actions` list `[{ action: "yes", title: "Voy" }, { action: "no", title: "No puedo" }]` and the match id. The pure builders in `functions/src/pushLogic.ts` add them. «Cambios» notices and notices to captains don't carry them.
- **Service worker** (`public/push-sw.js`):
  - `showNotification` passes `actions` where the browser supports them; Android Chrome does, iOS ignores them gracefully.
  - On `notificationclick` with an action, it opens or focuses `/vestuario?rsvp=<yes|no>&m=<matchId>`. A plain click keeps today's url.
  - The service worker never writes data itself: it has no auth, and a write must go through the signed-in app.
- **App.** On `/vestuario`, the `rsvp` and `m` search params are validated in the router (`rsvp ∈ {yes, no}`, `m` an id).
  - Once the member and the match are known and the RSVP window is open (`kickoffWindow`), the app writes the answer through the same `setAvailability` as the RSVP switch.
  - It shows a toast «Apuntado: Voy · J5 vs Rival», and «Deshacer» puts back the previous answer.
  - It then removes the params from the URL with replace, so a reload never answers twice.
  - Window closed: «La convocatoria ya está cerrada», and nothing is written. A fan, or a member of another club, gets nothing.
- **Absences.** If the member has an absence covering that match and taps «Voy», the hand answer wins, as today.

## Tests
- pushLogic payloads: which notices carry the actions;
- the service worker click routing, as a pure function extracted from `push-sw.js` and unit-tested;
- the vestuario param handler: it writes once, undo works, a closed window or a non-member writes nothing, and the params are cleared;
- the router validation.

## Out of scope
Answering «Duda» from the notice (two buttons is the common platform limit), answering without opening the app, and actions on iOS.

## Success criteria
On Android, tapping «No puedo» in an RSVP reminder opens the vestuario with «No puedo» saved, and the captains see it at once.
