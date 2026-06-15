# Product

## Register

product

## Users

Manchester Piti's players plus the friends and family around the club. They arrive on mobile as often as desktop (the app ships a dedicated mobile bottom-nav), usually right after a match or during the week to relive it. Players want to see their own goals, assists, cards, and where they rank; the wider circle follows the team's season and its history. A small, role-gated set of admins enters match results and events. The audience is Spanish-first.

## Product Purpose

A web home for an amateur football club that is three things at once:

- a **bragging-rights stat board** (top scorers / pichichi, assist kings, records, streaks, partnership chemistry, head-to-head rivals),
- a **living archival record** of every match and player across seasons, and
- a **quick match-day tool** to log and check the latest result.

Success is a player opening it after a game and feeling the match mattered: their numbers are there, the rankings shifted, and the club's history grew by one more entry.

## Brand Personality

Three registers held in tension:

- **Broadcast hype** — the high-contrast, glowing stat-screen energy of a TV sports-graphics package.
- **Premium club identity** — the crafted, confident feel of a real club's official app.
- **Playful social warmth** — this is mates' football, not a corporation.

Voice is Spanish, energetic, and fan-fluent ("Centro de Partidos", "Pichichi", "Festival del Gol", "Histórico Total"). Confident and celebratory without ever turning cold.

**The parody is the soul.** Manchester Piti is an affectionate parody/tribute of Manchester City: it borrows the sky-blue club colours and the "Manchester" name, then undercuts the grandeur with "Piti" (Spanish slang for a cigarette). The whole product runs on this tension — it presents amateur Sunday-league football with the full pomp of an elite club broadcast, and it knows it's funny. The design should play the spectacle completely straight (real broadcast polish, real trophy weight) while the copy and naming carry the wink. Never explain the joke; let the contrast tell it.

## Anti-references

- **Generic SaaS dashboard.** The interchangeable B2B admin-panel look: neutral grays, equal-weight card grids, no point of view. This is a fan product, not a CRM.
- **Corporate / sterile.** Cold, faceless, zero fan culture. No stock-photo professionalism, no soulless enterprise polish.
- Do not let the data density of the Stats page collapse into a spreadsheet. Numbers here are trophies, not rows.

## Design Principles

1. **Every number is a trophy.** Stats are the emotional payload; present them with the weight and drama of an achievement, not the flatness of a table cell.
2. **Broadcast energy, club soul.** Borrow the contrast and motion of sports TV, but keep the warmth and identity of a real club. Hype and craft, not hype alone.
3. **Mobile is match-day.** Players reach for this on a phone right after the whistle. The phone layout is a primary canvas, not an afterthought.
4. **Earn the glow.** The dark, luminous aesthetic is the brand, but light and color are rewards for the moments that matter (a leader, a record, a win), not ambient decoration spread evenly across everything.
5. **Fan-fluent, never corporate.** Copy and chrome speak the language of the terraces. When the choice is between "clean and neutral" and "specific and spirited," choose spirited.

## Accessibility & Inclusion

Target WCAG 2.1 AA. The dark theme must keep body text, and especially muted/secondary text, at >=4.5:1 against its surface (the current `--text-muted` on the darkest backgrounds is a known risk worth verifying). Honor `prefers-reduced-motion` for the glow pulses, hover lifts, and jersey spring animations with a crossfade or static fallback. Spanish-first. Provide non-color status cues so win/loss/card state never depends on cyan/emerald/gold/red alone.
