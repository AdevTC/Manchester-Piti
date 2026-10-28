---
name: Manchester Piti
description: Celeste de noche. Sunday-league football staged like a night match, in sky-blue and gold, on the public site and in the admin's «Sala de control», each with a night and a day theme.
colors:
  sky: "#6CABDD"
  sky-ice: "#9fd0f2"
  sky-deep: "#2a73ad"
  gold: "#FFC659"
  gold-ink-night: "#ffd98c"
  gold-day: "#9a6b00"
  gold-ink-day: "#6b4a00"
  navy: "#0c1733"
  night-bg: "#030817"
  night-bg-2: "#08132f"
  night-ink: "#eef4ff"
  night-soft: "#c9d8ef"
  night-muted: "#9fb3d3"
  night-line: "rgba(255,255,255,.1)"
  night-chip: "rgba(255,255,255,.07)"
  day-bg: "#eef4fa"
  day-bg-2: "#e2ecf7"
  day-ink: "#0c1733"
  day-soft: "#2c3a5c"
  day-muted: "#4f5d7d"
  day-line: "rgba(12,23,51,.1)"
  day-chip: "rgba(255,255,255,.85)"
  error-night: "#ff9a8a"
  error-day: "#b3261e"
  adm-sheet-night: "#0a1532"
  adm-sheet-day: "#f4f8fc"
  adm-deep: "#050b1f"
  adm-panel-night: "rgba(255,255,255,.035)"
  adm-panel-day: "rgba(255,255,255,.72)"
  adm-pline-night: "rgba(255,255,255,.09)"
  adm-pline-day: "rgba(12,23,51,.12)"
  adm-amber-night: "#ffb547"
  adm-amber-day: "#8a5600"
  adm-red-night: "#ff6b61"
  adm-red-day: "#c0392b"
  adm-led: "#cfe8ff"
typography:
  display:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "clamp(56px, 24cqi, 150px)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 112"
  numeral:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "76px"
    fontWeight: 900
    lineHeight: 0.85
    fontVariation: "'wdth' 70"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.1
    fontVariation: "'wdth' 105"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  adm-title:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 112"
  adm-body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  adm-column-head:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  lower-third: "4px"
  tag: "6px"
  control: "12px"
  field: "16px"
  panel: "20px"
  modal: "22px"
  card: "28px"
  poster-card: "32px"
  pill: "999px"
spacing:
  gap: "10px"
  stack: "18px"
  gutter-phone: "20px"
  gutter-tablet: "40px"
  gutter-desktop: "64px"
  block: "72px"
  adm-ws-y: "22px"
  adm-ws-x: "28px"
components:
  button-night:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.navy}"
    rounded: "{rounded.pill}"
    height: "46px"
    padding: "0 20px"
  button-day:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "46px"
    padding: "0 20px"
  button-ghost-night:
    backgroundColor: "{colors.night-chip}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    height: "46px"
    padding: "0 18px"
  cta-night:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.navy}"
    rounded: "{rounded.pill}"
    height: "72px"
    padding: "0 10px 0 28px"
  cta-day:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "72px"
    padding: "0 10px 0 28px"
  chip-night:
    backgroundColor: "{colors.night-chip}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 16px"
  field-night:
    backgroundColor: "rgba(255,255,255,.05)"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.field}"
    height: "46px"
    padding: "0 14px"
  card-night:
    backgroundColor: "{colors.night-chip}"
    textColor: "{colors.night-soft}"
    rounded: "{rounded.card}"
    padding: "22px"
  adm-button:
    backgroundColor: "{colors.night-chip}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 18px"
  adm-button-sm:
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 14px"
  adm-panel-night:
    backgroundColor: "{colors.adm-sheet-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.panel}"
  adm-panel-day:
    backgroundColor: "{colors.adm-sheet-day}"
    textColor: "{colors.day-ink}"
    rounded: "{rounded.panel}"
  adm-drawer:
    backgroundColor: "{colors.adm-sheet-night}"
    rounded: "{rounded.panel}"
    width: "420px"
  adm-modal:
    backgroundColor: "{colors.adm-sheet-night}"
    rounded: "{rounded.modal}"
    width: "520px"
    padding: "22px"
  adm-rail-item:
    textColor: "{colors.night-soft}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 12px 0 16px"
  adm-tag:
    rounded: "{rounded.pill}"
    height: "26px"
    padding: "0 10px"
  adm-lower-third:
    backgroundColor: "{colors.adm-deep}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.lower-third}"
    padding: "9px 14px"
---

# Design System: Manchester Piti

## Overview

**Creative North Star: "Celeste de noche"**

A pub team's Sunday is staged as a night match. The page is a stadium after dark: a deep navy-black sky (`night-bg`), a radial floodlight of club sky-blue behind each hero, fine grain over the night, and the people (their number, their kit, their name) set huge in a variable display face that stretches and condenses like a scoreboard. Light is the reward. Sky-blue marks the current thing, gold marks the thing worth celebrating, and everything else stays in calm navy and soft blue-greys. Every surface also has a day theme («de día»): a pale sky-washed paper (`day-bg`) where navy takes over as ink and as the main action, and gold darkens to a legible bronze. Both themes are first-class and switch with `html[data-theme]`.

The world has **two sub-systems of equal standing**, sharing tokens, fonts and the theme switch. **Celeste, the public site** (home «El vestidor», vestuario «Tu cartel», partidos, estadísticas, jugador, plantilla, perfil «La carta», pizarra «Noche de partido», el club, la puerta) is broadcast and souvenir. It has posters, 3D kits, cromos with holo foil, flip digits, floodlights and walkouts, and it reads first on a phone. **The «Sala de control», the admin**, is the same world working a shift. It is a quiet app shell (60px header, a 224px rail, a phone bar) of flat sheets with hairline insets, where the drama is spent on a few broadcast objects: the LED scoreboard, the peg wall of hanging kits, the cromo in the drawer, the lower thirds that announce what just happened.

The parody stays straight-faced. Polish is real and the copy carries the wink. The system rejects the generic SaaS dashboard (equal-weight grey cards, no point of view) and the corporate look, and it replaces the project's previous printed «Floodlit Clubhouse» identity (Anton + Archivo, 4–6px radii, flat paper surfaces), which survives only as a legacy layer (see Do's and Don'ts).

**Key Characteristics:**
- Club sky-blue (`#6CABDD`) and gold (`#FFC659`) on a night navy, mirrored by a day theme where navy leads.
- One variable display family (Anybody, `wdth` 58–120) for names, numbers and titles; Geist for reading; Geist Mono for data and kickers.
- Pill-shaped controls, generously rounded cards (20–32px), and 4px used on purpose for broadcast objects.
- Light is earned: colored glows and tinted shadows only under the on-state, the CTA, the LED and the celebration.
- Container-query layouts that start on the phone; the admin switches shell at a 1000px frame.
- Motion is an ease-out expo glide with spring overshoot for stamps, View Transitions for objects that move between places, and a full reduced-motion fallback.

## Colors

Club sky-blue and gold on a night navy, with a day theme that swaps the roles of navy and light. Every token lives on `.vx` (`src/styles/vestuario.css`) and flips under `[data-theme="light"]`. The Sala de control (`/admin`) is Vidrio like the rest: its root is `.vx.sc` and its shared pieces live in `src/pages/admin/shell/sala.css`.

### Primary
- **Club Sky** (`sky`): the signature. Selected and current state (the on-pill, the rail's floodlight edge, a selected chip's 1.5px inset ring, the tablón's selected row tint at 16%), progress bars, the shirt's color, focus rings in the admin. In the night theme it also fills the primary button. In the day theme it is a fill and a ring color, **never body text** (2.2:1 on `day-bg`).
- **Ice Sky** (`sky-ice`, the night `--accent`): sky as text on night. Links, emphasized words in a headline (`em`), stat figures for goals, a message author's name.
- **Deep Sky** (`sky-deep`, the day `--accent`): sky as text on day (4.6:1 on `day-bg`), and the lower stop of the day on-pill gradient.

### Secondary
- **Trophy Gold** (`gold`): achievement and the main action. In the night theme it is the CTA (a `gold → #ffe0a0` gradient with a gold-tinted shadow). Everywhere it marks the MVP, records, the leader's podium step, medals, the captain's armband, the stamp on the poster and the cromo's inner frame.
- **Gold Ink** (`gold-ink-night` / `gold-ink-day`): gold as small text: kickers on a gold chip, links in the captain strip.
- **Day Gold** (`gold-day`): gold's day form for large figures only (4.2:1 on `day-bg`, so never small text; small gold text on day uses `gold-ink-day`, 7.3:1).

### Tertiary
- **Amber** (`adm-amber-night` / `adm-amber-day`): the admin's exception color. Counters on the rail, a duplicated dorsal (with a wavy underline), a player without a line, the «duda» reply, the injured estado, a missing piece of a ficha. It means "needs you", not "bad".
- **Red** (`adm-red-*` in the admin, `error-*` on the public site): errors, destructive buttons (outlined; solid `#d6332b` only on the final confirm), the red card sticker, an error lower third.

### Neutral
- **Night** (`night-bg`, `night-bg-2`): the page and the raised ground under faces and podiums. Heroes paint `--hero-bg`, a radial floodlight `#1d3f84 → #0c1c46 → night-bg`.
- **Night text ladder** (`night-ink` → `night-soft` → `night-muted`): headings and figures, then copy, then metadata (muted is 9.4:1 on `night-bg`).
- **Day** (`day-bg`, `day-bg-2`, `day-ink` → `day-soft` → `day-muted`): the same ladder on sky-washed paper (muted 5.9:1). In the day theme navy (`navy`) is also the solid of the primary button, the CTA, the active nav item and "my" chat bubble.
- **Lines and chips** (`night-line`, `night-chip`, `day-line`, `day-chip`): translucent white on night and near-opaque white on day. Chips and secondary surfaces are tints, not separate greys.
- **Admin sheets** (`adm-sheet-*`, `adm-panel-*`, `adm-pline-*`, `adm-deep`): the opaque sheet behind every panel, drawer and modal; a near-transparent panel for quiet wells; a hairline drawn as an inset shadow; and the deep navy-black of the lower third and the LED housing.
- **LED** (`adm-led`): the lit-ice color of LED digits, used nowhere else.

### Named Rules
**The Earned Light Rule.** Sky marks where you are, gold marks what you won, and nothing glows at rest. Tinted shadows and text-glows belong only to the on-state, the CTA, medals, the vitrina, the LED and celebrations.

**The Role Swap Rule.** The day theme is not an inverted night. Navy becomes the action color and the ink, gold darkens to bronze, sky stays a fill and never becomes text. A component's day form is designed from these roles, never from a color filter.

**The Amber-Is-Work Rule.** In the Sala de control, amber marks something waiting for the admin (a count, a gap, a conflict), sky marks the current item, and gold belongs only to the main action and the capitán general's armband. Red is only for errors and destruction.

**The Never-Color-Alone Rule.** Every status carries a second cue: the result badges use one alphabet everywhere, G·E·P (G victoria · E empate · P derrota; `src/lib/derived/result.ts`), as a filled square, an outlined square and a hatched square, each with its letter; counters are numbers; the injured estado has an icon and a word; an error lower third is tagged «!».

## Typography

**Display Font:** Anybody (variable `wdth` and `wght`, with `system-ui, sans-serif`)
**Body Font:** Geist (variable, with `system-ui, sans-serif`)
**Label/Mono Font:** Geist Mono (variable)

**Character:** A single expressive variable family does all the shouting. Anybody's width axis gives a condensed scoreboard numeral (`wdth` 58–80), a normal title (`wdth` 96–112) and a wide brand mark (`wdth` 118–120) without switching fonts. Geist reads quietly underneath it, and Geist Mono sets kickers, dates, counts and keyboard hints like a broadcast data strap.

### Hierarchy
- **Display** (Anybody 900, `wdth` 112, line-height 0.82, `-0.03em`): the player's name on the poster and page heroes (`El club`), sized to the container (`cqi` units) so a name always fits one line.
- **Numeral** (Anybody 900, `wdth` 58–90, line-height 0.8–0.85, tabular): the giant outlined dorsal behind the poster (`wdth` 96 at 92cqi, gradient fill + 2px stroke), the stat figures (76px), flip-board digits (88px), LED scores (132px), and dorsals in the tablón (22px). Numbers are always Anybody and always tabular where they line up.
- **Headline** (Anybody 800, 32px phone / 36px desktop, `wdth` 112, `-0.02em`): section titles, always preceded by a Geist Mono kicker.
- **Title** (Anybody 700–800, 15–26px, `wdth` 105–110): card titles, cromo names, the CTA label (21px, `wdth` 108), the brand name (`wdth` 118–120).
- **Body** (Geist 400–600, 15px, line-height 1.45–1.6): copy, lists and forms. The club's long-form copy runs at 16px / 1.6 capped at 62ch, and the lead at 17px / 1.5 at 40ch.
- **Label** (Geist Mono 11–12px): kickers above headlines, meta lines, vote counts, dates, `kbd` hints. Sentence case and no tracking on the public site; the vertical poster strap alone tracks at `0.3em`.
- **Admin Title** (Anybody 900, 36px, `wdth` 112, `-0.01em`): the view header in the Sala de control (`.ttl`).
- **Admin Body** (Geist 15px / 1.4): the shell's base. Rail items and buttons are Geist 600 at 15px; the tablón's names are 700.
- **Admin Column Head** (Geist 700, 11px, `0.08em`, UPPERCASE): table headers only. It is the one uppercase-tracked label in the system.

### Named Rules
**The One Display Family Rule.** Anybody carries every name, number and title, and the hierarchy comes from its weight and width axes, not from a second display face. Geist reads and Geist Mono labels. Anton, Archivo and Barlow belong to the legacy layer and to canvas-drawn exports only.

**The Fit-The-Name Rule.** Display names never wrap and never clip. They are sized from their container (`cqi`, or a `--vx-name-k` factor for long names) and kept on one line with `white-space: nowrap`.

## Layout

**Celeste (public).** Every page is a `.vx` container (`container-type: inline-size`) and lays out by **container queries**, not viewport media queries: phone-first below 700px (20px gutters), tablet at **700px** (40px gutters, two-column hero: copy left, poster right), desktop at **1100px** (64px gutters, the centered pill nav appears, the bottom dock disappears, blocks sit on a 12-column grid with 96px × 56px gaps). A small-phone pass at **≤380px** tightens chips, the CTA and the dock. Blocks are separated by a 72px rhythm (`block`), with 22px between a block's header and its content and 10px gaps inside grids. Heroes run full-bleed with the floodlight radial and fade into the page with a 22% gradient at the poster's foot. Content inside grids carries `min-width: 0` so long names ellipsize instead of blowing the layout, and wide tables scroll inside their own box.

**Sala de control (admin).** The frame **is** the viewport (`100dvh`) and the page never scrolls: each list scrolls inside its own panel. The frame width chooses the shell. At **1000px and above** (`.adm.d`) it is a grid of a 60px header over a 224px rail plus the workspace (`22px 28px` padding, 18px stack gap). Below **1200px**, or when folded with `[`, the rail becomes a 76px icon rail with tooltips. Below **720px** of height the rail densifies to 40px items. Below 1000px (`.adm.m`) it is a phone frame with a header, a bottom bar and «Más» as a drag-to-close sheet. Workspaces are master–detail. The tablón takes the flexible width. Beside it, the squad-at-a-glance panel takes 400px (330px under 1600px, 300px under 1200px), and an open ficha takes the room it needs to be worked on (`clamp(420px, 44%, 660px)`, or `clamp(360px, 48%, 480px)` under 1200px) while the tablón folds its columns. Inside panels, named container queries (`tbn`, `ad-db`, `ad-cab`…) step columns out as their own width shrinks, so a column that leaves gives its width back.

**The Container-First Rule.** Components respond to the box they live in, not the window. A component that only works at one viewport width is a bug.

## Elevation & Depth

The two sub-systems handle depth differently, by design.

**Celeste is lit, not stacked.** Depth comes from light: the hero's radial floodlight, an 8% grain overlay (night only), frosted glass (`backdrop-filter: blur(10–18px)`) on the chrome that floats over content (the nav pill, the dock, poster chips), and the real 3D of the kit, the pedestal and the cromo. Shadows are **colored** and go only under lit things.

**The Sala de control is flat sheets.** Panels sit flush. Their edge is a hairline drawn as `box-shadow: inset 0 0 0 1px var(--pline)`, never a border that shifts layout. Only true layers (the ⌘K palette, modals, the lower third) cast a deep shadow. The LED scoreboard is the single object allowed an inner glow.

### Shadow Vocabulary
- **On-pill glow** (`0 22px 40px -16px rgba(108,171,221,.7)`; day `rgba(42,115,173,.7)`): under the selected pill, vote chip or training slot.
- **CTA glow** (`0 26px 50px -18px rgba(255,198,89,.55)`; day `rgba(12,23,51,.5)`): under the one main action.
- **Medal / stamp lift** (`0 14px 30px -12px rgba(255,198,89,.6)` or the sky equivalent, plus `inset 0 -4px 0 rgba(0,0,0,.15)`): earned medals and the poster's stamp.
- **Floating chrome** (`inset 0 1px 0 rgba(255,255,255,.1), 0 20px 40px rgba(0,0,0,.45)`; day `0 20px 40px rgba(28,44,91,.16)`): the nav pill and the dock.
- **Card in hand** (`0 30px 60px -24px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.12)`): the cromo's faces.
- **Admin layer** (`0 40px 80px rgba(0,0,0,.55), inset 0 0 0 1px var(--pline)`): palette and modal. The lower third uses `0 20px 40px rgba(0,0,0,.5)`.
- **LED glow** (`text-shadow: 0 0 18px rgba(159,208,242,.9), 0 0 2px #fff`; gold `0 0 22px rgba(255,198,89,.95)`): LED digits only.

### Named Rules
**The One LED Rule.** The admin's scoreboard is the only LED object: dot-matrix mask, glowing digits, a marquee ticker. Nothing else in the Sala de control glows.

**The Hairline-Inset Rule.** Admin panels, chips and segmented controls draw their edges with inset shadows (1px quiet, 1.5px selected), so selection never changes geometry.

## Shapes

The form language is **soft and pill-led, with a deliberate sharp exception**. Interactive controls are pills (999px): buttons, chips, segmented controls, the RSVP switch, the dock, the nav and tags. Public cards are generously rounded (28–32px for poster cards and steps cards, 22px for wells and menus, 20px for chat bubbles, which cut one corner to 6px toward the speaker). Admin panels, drawers, the tablón and the palette are 20px, modals 22px, sheets on phones `22px 22px 0 0`, rail items and inputs in the chrome 12px, and segmented pills inside tables 9–11px. Avatars, faces, medals and steppers are circles. Training slots are tall stadium pills (170px). The podium steps are `22px 22px 6px 6px`.

The exception is broadcast hardware. The **lower third is 4px**, a TV strap rather than a toast, and the cromo's inner gold frame and the flip-board's 14px tiles keep a manufactured edge.

## Components

### Base Celeste
The classes several public pages share live in one place, `src/styles/celeste/`, under their original names. `base.css` pulls them in and the site chrome (`components/celeste/Chrome.tsx`, part of the entry) imports it once, so every page gets them before its own sheet, and a page's override wins a tie.
- `type.css`: `hm-kick` (the mono kicker), `hm-h2` (the section title, 34/44/54px by container width), `hm-lede`, `hm-sec`, `hm-sr` (screen-reader only).
- `buttons.css`: `hm-btn` (solid pill), `hm-ghostbtn` (ghost pill), `hm-cta-top` (the header's top CTA).
- `chips.css`: `pt-chip` (info chip), `pt-res` (the G·E·P result square), `st-new` (the «nuevo» pill).
- `card.css`: `st-card` with `st-hd`, `st-h2` and `st-h3`. `seg.css`: `st-seg`. `state.css`: `st-empty`.
- `data.css` (not in `base.css`: imported by Estadísticas, El club, the jugador page and the analysis panel, the pages that use it): the stats family's `--st-*` tokens (on `.st` and `.technical-stats`), `st-mono`, `st-field`, `st-legend`, `st-kpis`, `st-tablebox` and `st-table`.

`celeste/page.css` is the content pages' `.vx` shell (night-sky, card and well tokens, `min-height`, reduced motion). Inicio, Partidos, the match ficha, Estadísticas, El club, the jugador page and Plantilla import it themselves, because on the bare `.vx` it must not reach the vestuario, perfil, acceso or admin. Page sheets (`home.css`, `partidos.css`, `stats.css`…) keep only their own layout. Tab bars have no shared class yet: `st-tabs`, `fc-tabs` and `sq-tabs` each belong to one page.

### Buttons
Tactile pills that sit as solids on night and as navy on day.
- **Shape:** full pill (999px), 46px on the public site, 44px in the admin (40px `sm`, 54px `xl`), never under 44px of touch height.
- **Primary (Celeste):** `--btn-on`, sky with navy text at night and navy with white text by day, Geist 600 14px.
- **CTA (the one action):** a 72px pill: a gold gradient with navy text at night, navy with white text by day, an Anybody 800 21px label, and a 52px circular «dot» at the end that holds the arrow. One per view.
- **Ghost:** `--ghost`, a translucent white tint, used for secondary actions next to a primary.
- **Admin variants:** `btn` (ghost), `btn.line` (1.5px inset hairline), `btn.sky` (the on-pill gradient), `btn.gold` (the CTA, which loses its fill when disabled), `btn.red` (outlined) and `btn.redf` (solid, final confirm only).
- **States:** disabled at 55% opacity; press is `scale(.97)` on slots; hover lifts icon buttons by 2px.

### Chips and segmented controls
- **Chips:** 40px pills on `--chip`, Geist 600 13px. Gold chips (`--chip-gold` with `gold-ink`) mark the training reminder and confirmations.
- **Selection pills** (`--pill` → `--pill-on`): unselected is a white tint with a 1px inset line; selected takes the sky gradient (`#d4ecfc → sky` at night, `sky → sky-deep` by day) with the on-pill glow. Vote options are real radios inside the label (`:has(input:checked)`).
- **Admin gap chips:** 34px outlined pills with an amber Geist Mono count; pressed takes `--chip` plus a 1.5px sky inset ring. **Tags** are 26px pills tinted at 14–16% of amber, red or sky.

### Cards / Containers
- **Corner Style:** 28–32px on the public site; 20px admin panels (see Shapes).
- **Background:** tints of the page (`--chip`, `--well`) rather than new greys. Lit cards (the ficha claim, the confirmed training) use a `160deg` sky gradient from 24% to 7% with a 1px ice inset and glass blur. The captain strip is the gold equivalent.
- **Shadow Strategy:** none at rest; see Elevation.
- **Internal Padding:** 18–22px public, 14–16px admin.

### Inputs / Fields
- **Style:** borderless 46px fields on `--input` (white at 5% at night, 92% by day), 16px radius, Geist 15px. The board's composer is a 54px pill with a circular send button.
- **Focus:** a 2px `--accent` outline at 3px offset on the public site (the composer rings its whole pill with `:focus-within`). In the admin every chrome control gets a 2px **sky** ring at 2px offset (`.fr`); the site's gold ring belongs to the main action only.
- **Error:** a Geist line in `error-night` / `error-day` under the field. In admin modals and drawers the error line sits above the buttons in red, with an icon.

### Navigation
- **Public desktop (≥1100px):** a centered frosted pill (`--nav`, 18px blur) of 14px Geist links; the current page is a solid `--nav-on` pill. Brand on the left (crest plus Anybody 800 `wdth` 120), theme toggle and avatar on the right.
- **Public phone and tablet:** a fixed 64px frosted dock at the bottom (`safe-area` aware) of 44px icon targets. The current page expands into a labelled pill, and its label hides at ≤380px. While a match is on, a live «island» shows at the top of every page and heroes leave 58px for it (`--isle`).
- **Sala de control desktop:** a 60px header (brand, section, a 320px ⌘K search and icon buttons) and a 224px rail of 44px items. A single sky **floodlight** element (a soft sky pill with a 3px LED edge on the left) glides between items, a soft spotlight follows the pointer under the rail, labels nudge 2px on hover, and amber counters roll like an odometer when they go up. The rail folds in two beats (labels, then width) to a 76px icon rail with tooltips («name · counter in words · shortcut»). `g`+key jumps between views.
- **Sala de control phone:** a bottom bar whose current tab sits on the floodlight with a lifted icon, and «Más» as a sheet that springs up and drags down to close.

### The poster («Tu cartel»)
The player's hero: a 390:520 poster where the giant outlined dorsal sits behind a draggable 3D kit (1ª/2ª toggle), the name is set in Display across the poster's foot, a gold rotated **stamp** springs in, and Geist Mono straps run up the side. On the first visit the dorsal is a dashed ghost, a dashed gold **hint** pill replaces the stamp, and placeholder figures render as outlined numerals.

### The cromo
A collectable card at 5:7. It deals itself in with a 3D turn, tilts toward the pointer (or gyro), and carries a **holo foil** (`color-dodge` rainbow bands) and a **glare** that follow the tilt. Its front is a radial navy-to-sky field with the kit, a gold dorsal, a gold inner frame (1.5px at 6px inset) and a dark name plate with Geist Mono stat labels over Anybody figures. Its back holds the full stat sheet. The admin's cromo is the same object flattened into the drawer: an 18px card with a radial sky field, a 2px gold inset, the rating in gold at 50px and stats in Geist Mono with Anybody figures. A new player's cromo is a plain wall-colored blank with a hairline frame.

### The tablón (Admin · Plantilla)
The season as a sheet: a table whose rows lay out as CSS grids, grouped by line under line headers that scroll with their rows. Players without a line are grouped in amber, other seasons sit at 60% opacity. Each 62px row holds a checkbox, the player's **real 3D kit** (46×51, which tilts −3° on hover), the dorsal in Anybody (amber with a wavy underline if duplicated), name and alias, a segmented line picker, an estado pill (amber with an icon when injured), the account icon (sky = linked, amber = request pending), GOL·ASI·PJ in tabular columns, and the ficha's missing pieces. Above it, the **collection bar** shows the dashed cells of the squad filling with sky as fichas complete, next to gap chips that isolate who needs what. Selecting rows turns it into a sky-ringed **batch bar**. Columns step out as the tablón narrows, and on phones rows fold to kit · dorsal · name · slots, with the ficha opening as a sheet.

### Drawers, sheets and layers
- **Drawer:** a 420px panel beside the workspace (20px, `--sheet`, inset hairline) that slides in 60px from the right on the expo ease, with a title row, a scrolling body and a footer of actions. The player's ficha scrolls as one (its cromo scrolls away so the fields get the height), keeps its title row and footer pinned, and pairs its fields in two columns once it is 470px wide. On phones it becomes a bottom sheet (`22px 22px 0 0`) under the 56px header.
- **⌘K palette:** 640px, 20px radius, 90px from the top, springs in on `cubic-bezier(.3,1.3,.5,1)`. **Modal:** 520px, 22px radius, never taller than the frame, with an optional lede and an error line above the buttons.
- **Scrim:** `rgba(2,5,14,.62)` at night, `rgba(12,23,51,.35)` by day.

### Lower thirds
The admin's confirmations and errors, styled as broadcast straps. A sky key block carries an Anybody 900 tag (or «!» in red for errors), and a deep navy bar (`adm-deep`) with a 3px sky underline holds the Geist 600 message and an optional ice-blue action such as «Deshacer». They sit bottom-left at most 540px wide on desktop, span the width above the phone bar (or above the pads in «En juego») on phones, and slide in over 0.5s on the expo ease.

### Pegs and the LED board
- **Peg wall:** kits hang from a peg dot on a gradient wall (`--wall`). The kit's name prints across the shoulders and the dorsal in Anybody `wdth` 75. Opening a peg swings its kit (`hang`), hover lifts it by 3px, and stickers (ball, yellow card, red card) stack on its side. An empty slot is a dashed outline.
- **LED scoreboard:** a 22px housing over a 12px black panel with a dot-matrix mask. Team names and scores are set in LED Anybody (132px score), Geist Mono sublines track at `0.14em`, and a gold marquee ticker runs underneath. Changed digits flip.

### Motion and View Transitions
- **Ease:** `cubic-bezier(.16,1,.3,1)` (expo out) is the house curve for entrances, drawers, bars and reveals. Springs with overshoot (`.34,1.56,.64,1`; `.3,1.4,.5,1`) are reserved for things that land: stamps, hints, flip digits, kits on pegs, the RSVP thumb. Signature entrances are long and staged (the name's letter-spacing collapsing from `0.25em`, the dorsal scaling in from 1.25, bars growing from the left). App feedback stays short (0.18–0.35s).
- **View Transitions:** objects that move between places fly instead of cutting. In the tablón the kit flies between its row and the ficha (`view-transition-class: pl-kit`, 0.56s expo), and rows glide to their new line (`pl-row`, 0.46s on `.2,.8,.2,1`, old out in 0.2s, new in 0.3s). On the public plantilla the shirt flies into the ficha (`sq-shirt`, 0.62s) over a 0.32s root crossfade. A helper starts the transition only where `document.startViewTransition` exists and the user has not asked for less motion; otherwise the update simply happens.
- **Changing page (the public site, every size):** the page leaves (160 ms: fade, 8 px toward where it goes, a little blur, region by region where it marks `vd-reg-n`), then the next one comes in from the direction of travel (220 ms), never both at full opacity. Only the page's content, its regions and the shared objects (the live score's morph) travel; a page's own view-transition names (its screens, beads, tiles) are kept out of it, listed in `styles/vidrio/chrome.css`. The leaving page is its own group (`vd-page-out`), so it leaves from where it was scrolled. The top bar and the tab bar stay put above everything (`z-index` on their groups); the tab tapped lights up at once, and the bead travels to it as a drop of liquid glass, stretching the way it goes and settling with a little give (`translate` + `scale`, never `transform`, on `.vd-bead`). The browser's back and forward get the same choreography (back goes left), except when the browser already animated the step (a swipe). A change that has to wait for its code shows a thin celeste line across the top after 160 ms (`navprogress.css`). The sky's bokeh discs are painted after the page is in and come up in 0.9 s.
- **Performance:** motion animates transform and opacity (the rail's width is the one layout transition), each floodlight beam is its own layer, and looping animations pause while their arena is offscreen. While a page changes the screen holds still until the next page is put together, so that render is kept light: the heavy pure computations over the club's data are kept by their arguments (`lib/remember`), Intl formatters are built once (`lib/intlCache`), and in the built site the five sections' code is fetched at idle moments after the first page (`lib/warmSections`).
- **Reduced motion:** `prefers-reduced-motion: reduce` switches off every animation inside `.vx` and every animation **and** transition inside the Sala de control (`.vx.sc`). A change of page is a 120 ms crossfade with both bars still, and the bead jumps without stretching. Motion (`MotionConfig reducedMotion="user"`) renders plain elements, the cromo holds still (its flip still turns it, without animation), View Transitions are skipped, and exits simply disappear. Content never depends on an animation finishing.

## Do's and Don'ts

### Do:
- **Do** build new UI inside the `.vx` token layer and its `[data-theme="light"]` flip, and design the day form from the roles (navy leads, sky as fill, `gold-ink-day` for small gold text).
- **Do** set every name, number and title in Anybody, picking width from the axis (`wdth` 58–90 for numerals, 105–112 for titles, 118–120 for the brand), with tabular figures wherever numbers line up.
- **Do** put a Geist Mono kicker above a headline, and keep labels in sentence case (the admin's 11px table head is the only tracked uppercase).
- **Do** use pills (999px) for controls with a minimum 44px touch target, and 20px sheets with an inset hairline (`inset 0 0 0 1px var(--pline)`) for admin panels.
- **Do** reserve sky for "current", gold for "earned or the main action", amber for "needs the admin", and red for errors, each paired with a letter, icon, number or word.
- **Do** lay out with container queries (700 / 1100 on `.vx`, named containers in the admin) and give grid children `min-width: 0`.
- **Do** use `cubic-bezier(.16,1,.3,1)` by default, a spring only for objects that land, and a View Transition when an object moves between two places.
- **Do** honour `prefers-reduced-motion` with a static end state, and pause loops offscreen.

### Don't:
- **Don't** use Anton, Archivo, Barlow or the `--mp-*` tokens (`src/styles/theme.css`, the shadcn bridge in `src/styles/tailwind.css`) in new work. They are the legacy «Floodlit Clubhouse» layer. Every page is Celeste now; what is left of that layer is the site shell in `src/styles/club.css` (the skip link, the demo banner, and the old navbar and footer, which only show while an invitation link checks the session), the document base in `src/index.css` (reset, body, scrollbar, and the `.btn` base under the admin's and the perfil's buttons), the shadcn pieces still mounted (the route skeleton, the perfil's tabs, tooltips, the toaster) and the canvas-drawn exports (match posters, jersey prints).
- **Don't** set sky as text on the day theme; use `sky-deep` (`--accent`).
- **Don't** let anything glow at rest, or add a second LED object to the Sala de control.
- **Don't** introduce flat grey SaaS cards, equal-weight card grids, or a neutral palette outside the club's navy, sky, gold and their tints.
- **Don't** draw admin edges with layout-shifting borders, or change geometry on selection; use inset rings.
- **Don't** round the lower third or turn it into a toast; it stays a 4px broadcast strap.
- **Don't** style the Sala de control outside Vidrio: its shared pieces are `src/pages/admin/shell/sala.css` (`sc-*`) and each area's rules go in its own file (`src/pages/admin/areas/<área>/*.css`).
- **Don't** wrap or clip a display name; size it to its container.
