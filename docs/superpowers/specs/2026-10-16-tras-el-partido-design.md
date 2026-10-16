# Tras el partido: reacciones y nota del partido

Date: 2026-10-16. This is idea 6 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3), without photos: there's no Firebase Storage. The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
After the acta is published, the team keeps talking about the match on the web: members react to the crónica's key moments and give the match a quick rating («¿Qué nota le pones al partido?»). It's the post-match chat, kept with the match.

## What
- **Reactions to moments.** Each crónica chapter (goal, card, the final whistle) gets a small reaction bar with 4 reactions: «🔥 Golazo», «👏 Bien», «😂», «😬» (emoji with a text label for screen readers; the visible label is a short word under the emoji at ≥ 700 px).
  - A member has one reaction per moment, changeable or removable.
  - Counts are public; who reacted shows on hover or tap («Hugo, Mario y 3 más»).
  - Fans see the counts but can't react.
- **Match rating.** In the match page's Vestuario tab, once the acta is published and for 7 days, members rate the match 1–5 («¿Qué nota le pones al partido?»).
  - The average and the count show publicly on the crónica: «Nota del vestuario: 4,2 · 11 votos».
  - After 7 days the rating freezes.
- **Notices:** none.

## Data
- `matches/{id}/reactions/{uid}`: `{ moments: { [eventId]: "fuego" | "aplauso" | "risa" | "uy" }, name, at }`. That's one doc per member per match, so writes are cheap. Keys are event ids of that match.
- `matches/{id}/ratings/{uid}`: `{ score: 1..5, name, at }`.
- **Rules:**
  - Public read on both.
  - A member writes only their own doc (`signedAsMe`).
  - Reactions are allowed only once the match has a published acta.
  - Ratings are allowed only within 7 days of publication; the field and when the acta was published need checking.
  - Values are validated; there are at most 30 moments per doc.
  - A member can delete their own doc.
- **Rules tests** cover all of these.
- No functions. Aggregation happens client-side from one subcollection listener per open match page (bounded by the squad size).

## UI
- **Crónica chapters:** the reaction bar sits under each chapter, compact, with ≥ 44 px targets on touch.
- **Crónica header:** «Nota del vestuario».
- **Vestuario tab:** the 1–5 rating control, as a radio group with stars and numbers (never colour or shape alone).
- Reduced motion respected. Phone 390 first.

## Out of scope
Photos (they need Storage), comments or threads, push notices, and the rating feeding any stat.

## Success criteria
- Members react and rate.
- Counts and the average update live for everyone.
- Fans read but can't write.
- Rules tests prove the windows and ownership.
