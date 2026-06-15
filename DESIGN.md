---
name: Manchester Piti
description: Amateur Sunday-league football given an elite editorial-broadcast treatment. Real Manchester City sky-blue, light + dark.
colors:
  sky: "#6CABDD"
  sky-deep: "#3f86bd"
  navy: "#1C2C5B"
  navy-deep: "#0c1733"
  gold: "#FFC659"
  gold-deep: "#D4A12A"
  red: "#C42F23"
  page-light: "#e9ebf0"
  surface-light: "#ffffff"
  ink-light: "#0f1830"
  ink-light-muted: "#56607a"
  page-night: "#060d20"
  surface-night: "#101c3c"
  ink-night: "#e9eefa"
  ink-night-muted: "#93a4c6"
typography:
  display:
    fontFamily: "Anton, 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(3.2rem, 13vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.84
    letterSpacing: "0.005em"
  heading:
    fontFamily: "Anton, 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "0.01em"
  body:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.18em"
  score:
    fontFamily: "Anton, 'Archivo', sans-serif"
    fontSize: "clamp(3rem, 10vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 0.8
    letterSpacing: "0.01em"
rounded:
  control: "4px"
  card: "6px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.navy-deep}"
    rounded: "{rounded.control}"
    padding: "11px 21px"
  button-ghost:
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "11px 21px"
  card:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.card}"
    padding: "24px"
  feature-band:
    backgroundColor: "{colors.navy}"
    textColor: "#ffffff"
    rounded: "{rounded.card}"
    padding: "26px"
---

# Design System: Manchester Piti

## 1. Overview

**Creative North Star: "The Floodlit Clubhouse"**

It is a night match under the lights, and the names glowing on the board are your mates'. Manchester Piti takes amateur Sunday-league football and gives it the full elite-broadcast treatment: a floodlit-dark stadium, sky-blue stat overlays, scorelines set like a printed matchday programme. The spectacle is played completely straight, because the joke is already built into the brand. This is an affectionate parody of Manchester City (the same sky-blue colours, the borrowed "Manchester," undercut by "Piti," Spanish slang for a cigarette). The design never explains the wink; it treats a pub team's hat-trick with the reverence of a final, and the contrast does the laughing.

The system is **editorial sports-press**, not dark-mode-SaaS. Type does the heavy lifting: a heavy condensed display (Anton) for wordmarks, headlines, and big numbers; a clean grotesque (Archivo) for everything else. Surfaces are flat and printed, ruled with hairlines, drenched in the brand navy for hero moments, and lit by exactly one cinematic touch (a stadium-floodlight canvas in the hero). It ships in **two themes** — a cool-paper light and a floodlit-night dark — switchable with a persistent toggle.

This system explicitly rejects, and replaces, the project's previous identity: dark-mode with cyan glow, glassmorphism cards, gradient text, and the Outfit typeface. That look read as generic AI SaaS slop. It also rejects the **generic SaaS dashboard** and anything **corporate or sterile** (PRODUCT.md anti-references). It is a fan product with a printed soul, not a CRM.

**Key Characteristics:**
- Real Manchester City palette: sky-blue (`#6CABDD`), navy (`#1C2C5B`), gold (`#FFC659`).
- Heavy condensed display (Anton) + grotesque body (Archivo); scoreboard numerals.
- Flat, printed surfaces with hairline rules and halftone texture; no glass, no ambient glow.
- Light (cool paper) and dark (floodlit night) themes, toggle-switched.
- Stats staged as silverware; numbers count up; one floodlight moment in the hero.

## 2. Colors

A two-theme palette anchored on the verified Manchester City sky-blue, navy, and gold. Sky is the single light source; navy carries the drama; gold is reserved for achievement.

### Primary
- **Sky Blue** (`#6CABDD`, Pantone 292 C): the club signature and the system's accent. Links, primary CTAs, active states, focus, the floodlight, the heading rule bars, the "win" marker. Used as an accent and a light source, never as wallpaper.
- **Navy** (`#1C2C5B`, Pantone 281 C) and **Navy Deep** (`#0c1733`): the drama. Drenches the hero, feature blocks, and CTA bands in both themes; in dark mode, deepened tones become the page itself.

### Secondary
- **Gold** (`#FFC659`) / **Gold Deep** (`#D4A12A` for legible text on light): achievement only. The Pichichi, records, the "draw" marker, highlight tags. Rarity is the point.

### Tertiary
- **Defeat Red** (`#C42F23`, lightened to `#f0584b` on dark): losses, red cards, own goals, destructive actions, errors. The only "bad" colour.

### Neutral
- **Light theme:** Page `#e9ebf0` (a true cool off-white, chroma ~0, deliberately NOT cream), Surface `#ffffff`, Ink `#0f1830`, Muted `#56607a`.
- **Dark theme:** Page `#060d20`, Surface `#101c3c`, Ink `#e9eefa`, Muted `#93a4c6`.
- Hairlines: `rgba(28,44,91,0.14)` (light) / `rgba(130,160,210,0.18)` (dark).

### Named Rules
**The Results-Language Rule.** Sky = win/positive, gold = draw/record/caution, red = loss/danger. Fixed everywhere (badges, markers, scorelines), always paired with a non-colour cue (letter, label, glyph). Never recolour a result for decoration.

**The Earn-the-Light Rule.** Sky-blue is an accent and the hero's one floodlight, not ambient glow. No element glows at rest. If everything is lit, nothing is.

**The Cool-Paper Rule.** The light theme's background is a true cool off-white (`#e9ebf0`), never a warm cream/sand/paper tint. Warmth, if any, comes from the navy and gold, not the canvas.

## 3. Typography

**Display Font:** Anton (with `Archivo, system-ui, sans-serif` fallback)
**Body / UI Font:** Archivo (with `system-ui, -apple-system, 'Segoe UI', sans-serif`)

**Character:** A heavy, condensed grotesque display (Anton) carries the spectacle — wordmarks, headlines, and big numbers read like a stadium scoreboard and a poster at once. A clean, neutral grotesque (Archivo, weights 400–900) carries every readable surface. The pairing is a proportion + weight contrast, not two competing voices. Both are deliberately off the over-used editorial-serif default (no Fraunces, no Outfit).

### Hierarchy
- **Display** (Anton, `clamp(3.2rem, 13vw, 6rem)`, line-height 0.84, UPPERCASE): the wordmark and hero. Stacked, the accent word in sky.
- **Heading** (Anton, `clamp(2rem, 6vw, 3.6rem)`, UPPERCASE): section titles, each underlined by a short sky rule bar.
- **Body** (Archivo 400, `1rem`–`1.05rem`, line-height 1.6): copy. Cap measure at 46–75ch.
- **Label** (Archivo 700, `0.78rem`, `+0.18em`, UPPERCASE): metadata, table headers, small markers. Short strings only.
- **Score** (Anton, `clamp(3rem, 10vw, 5.5rem)`, tabular): scorelines and big stat figures, broadcast-scoreboard style; numbers count up on reveal.

### Named Rules
**The Two-Family Rule.** Anton for display, Archivo for everything else. Never introduce a third family or a serif. Hierarchy comes from Anton-vs-Archivo and Archivo's weight ladder.

**The Rule-Bar Cadence.** Section headings are marked by a short sky-blue rule bar beneath them, never by a tiny uppercase tracked eyebrow above them. The eyebrow-on-every-section is a banned AI tell.

## 4. Elevation

This is a **flat, printed** system. Depth does not come from drop shadows, glass, or glow. It comes from four printed devices: (1) **drenched navy bands** that sit forward of the page, (2) **hairline rules** and 1px gap-gridlines that separate without boxing, (3) a subtle **halftone dot texture** on navy surfaces (printed-programme feel), and (4) exactly one **cinematic floodlight** (an animated canvas of soft sky-blue light cones + drifting motes) in the hero. Everywhere else is flat.

### Shadow Vocabulary
- Essentially none. Cards and panels are defined by fill + hairline, not shadow. The hero floodlight is the single luminous moment, and it degrades to a static CSS glow under reduced-motion.

### Named Rules
**The Flat-Print Rule.** Surfaces are flat. Forbidden: glassmorphism (`backdrop-filter` blur cards), decorative drop shadows, the 1px-border-plus-soft-shadow "ghost card," and ambient glow. Depth is navy, rules, texture, and the one floodlight.

## 5. Components

### Buttons
- **Shape:** sharp, `4px` radius. (Pills only for true tags.)
- **Primary:** solid sky-blue fill (`#6CABDD`), navy-deep text (`#0c1733`), weight 700, padding ~`11px 21px`. Hover lifts `translateY(-2px)` and brightens; gold focus ring.
- **Ghost:** transparent with a translucent white/sky 2px border on navy surfaces; fills sky on hover.
- No gradient fills, no glow.

### Cards / Surfaces
- **Corner Style:** `6px` (cards/panels), never the old 16px+.
- **Background:** flat — `surface` in light, `surface-night` in dark. Feature/result blocks are drenched **navy**.
- **Border:** 1px hairline. No shadow.
- **Internal Padding:** `24px` default.

### Feature Band / Scoreline
A drenched-navy block (both themes) for the hero result and the latest match: competition label (sky), team names (Archivo 800), the scoreline set huge in Anton with a muted separator, and a meta row separated by a hairline. Outcome shown as a coloured square + word (sky/gold/red).

### Stat Band (gap-gridlines)
A row of figures (PJ / W / D / L / GF / GC / Pts) as a CSS grid with **1px gaps over a hairline-coloured background** so gridlines render cleanly at any column count (7 → 4 → 2 across breakpoints). Values in Anton, count up on reveal; key figures in sky.

### Inputs / Fields (to migrate)
- Flat surface fill, 1px hairline, `4px` radius, uppercase Archivo label above. Focus: sky border + a 2px sky ring. (Legacy inputs still use the old glass style; migrate to this.)

### Navigation
- Editorial masthead: crest + Anton wordmark, button-style links (active = solid sky, inactive = ghost), the season selector, and the theme toggle. Mobile keeps a bottom tab bar. (App-shell Navbar migration pending.)

### Marquee Ticker
A full-bleed broadcast strip of live stats (season, record, Pichichi, latest result) in Anton uppercase, scrolling on an infinite CSS transform; static under reduced-motion. Decorative, `aria-hidden`.

### Signature — The Jersey
The existing hand-built SVG kit (sky-blue gradient body, white sleeves, navy outline, dorsal + name). Keep it; it is the warmest object and the clearest expression of the City parody. Retune its blue toward the verified sky if it drifts.

## 6. Do's and Don'ts

### Do:
- **Do** anchor on the real Man City palette: sky `#6CABDD`, navy `#1C2C5B`, gold `#FFC659`.
- **Do** use Anton for display/numbers and Archivo for everything else; nothing else.
- **Do** keep surfaces flat and printed: hairlines, gap-gridlines, halftone, drenched navy bands.
- **Do** support both themes via the `--mp-*` tokens and `[data-theme]`; ship the persistent toggle.
- **Do** hold the results language fixed (sky win / gold draw / red loss) with a non-colour cue.
- **Do** stage stats as silverware: Anton numerals, count-up, a podium, a scoreline.
- **Do** mark section headings with a short sky rule bar.

### Don't:
- **Don't** reuse the superseded identity: cyan `#06b6d4` glow, glassmorphism (`backdrop-filter` blur cards), gradient text (`background-clip: text`), or the Outfit font. All deprecated.
- **Don't** drift toward a **generic SaaS dashboard** or anything **corporate / sterile** (PRODUCT.md). This is a fan product, not a CRM.
- **Don't** put a tiny uppercase tracked eyebrow above every section; use the rule-bar cadence.
- **Don't** round cards past `6px`, add decorative drop shadows, or pair a 1px border with a soft wide shadow.
- **Don't** let the light theme become warm cream/sand; keep it a true cool off-white.
- **Don't** add ambient glow; the only luminous moment is the hero floodlight.
- **Don't** explain the parody. Play the spectacle straight; let the "Piti" naming carry the wink.
