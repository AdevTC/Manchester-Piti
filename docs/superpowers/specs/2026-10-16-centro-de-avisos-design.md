# Centro de avisos: design

Date: 2026-10-16. This is idea 5 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3).

## Decided by the user (2026-10-16)
- **Where:** a bell with an unread dot, in the header and in the phone dock, on every page, for linked members only. It opens a panel with the list. Fans never see it.
- **What it keeps:**
  - team notices: convocatoria and changes, el siete, new match or time change, final, the MVP vote, the MVP winner, RSVP reminders;
  - your personal notices: «Tu ficha ya es tuya», «El capitán revisó tus posiciones»;
  - for captains, also their own notices: answers and «Baja», absences, door requests.
  
  Live goals, half-time and the second half are **not** kept: the island already tells them.

## Why
Push is opt-in, per device, and easy to miss or dismiss. The centre is the same news, kept, readable on any device, and it serves members who never turned push on.

## Data
**Writing:**
- `functions/src/push.ts` `sendTo(notice, uid?)` is the single point every notice goes through. Right after it decides the audience, it writes one doc to `notices/{key}`. It writes the doc even when no device is subscribed.
- `key` is the notice's `log` or `tag` plus a time bucket, so a retried trigger never writes a second copy (`create`, failing silently if it exists).

**Doc fields:** `{ topic, title, body, url, at, audience, uid?, expireAt }`
- `audience` is one of:
  - `"team"`: members;
  - `"captains"`: admins;
  - `"personal"`: only `uid`.
- `expireAt` is `at` + 60 days, with a Firestore TTL policy on `notices.expireAt`. The controller sets the policy at deploy, so old notices disappear without a job.

**Topics kept:** `lineup`, `convocatoria`, `dates`, `final`, `mvp`, `personal`, `access`/`door`/captain topics. `goals` and `start` are skipped; the filter is a pure function in `pushLogic.ts`, with tests.

**Rules:**
- Members read `audience == "team"`.
- Admins also read `"captains"`.
- A member reads `"personal"` only where `uid == request.auth.uid`.
- Nobody writes from the client.
- Every read query must filter by audience so the rules can prove it, which takes three small listeners merged on the client.

**Unread:**
- `users/{uid}.noticesSeenAt` (timestamp) is written by the member when they open the panel. The rule allows the owner to update only that field.
- The dot shows when the newest visible notice is newer than it. That syncs across the member's devices.

## UI
**The bell:** `NoticesBell` in `CelesteHeader` actions and in the phone dock, members only.
- It is a button with an accessible name: «Avisos» or «Avisos, 3 sin leer».
- The dot is backed by text for screen readers; never colour alone.

**The panel:**
- A popover on desktop, a bottom sheet on phone.
- Focus is trapped while open, Esc closes it, and focus returns to the bell.
- **Each row:**
  - an icon by topic;
  - the title;
  - the body (two lines);
  - a relative time («hace 2 h»; absolute after 6 days);
  - a link to `url`.
- Unread rows are marked with a «Nuevo» word and a left rule.
- Grouped «Hoy», «Esta semana», «Antes».
- The empty state: «Aquí verás los avisos del equipo: convocatorias, el siete, el MVP…».

**Cost:** three `limit(30)` listeners, ordered by `at`, opened only once the member is known.

**Reduced motion** respected. Copy in Spanish. 44 px targets. Phone 390 first.

## Out of scope
Marking single notices read, deleting notices, notices for fans, and back-filling past pushes (the centre starts empty at deploy).

## Success criteria
- A notice that went by push appears in the panel of every member it was for, on any device, within seconds.
- Personal and captain notices never reach anyone else; rules tests prove it.
- The dot clears on all of a member's devices once they open the panel.
- Retries never duplicate a row.
