# «Vidrio» kit (P1)

The shared material, light, controls and live pieces of the «Vidrio» redesign. Design source: the boards
`V-Sistema.dc.html` / `v-kit.css` (KIT 4.1) and PLAN-V. Import from `src/components/vidrio` (the barrel) or the
single module. Every component imports its own CSS (`src/styles/vidrio/*.css`); class names are `vd-*`, tokens
`--vd-*` (on `:root`, flipped by `html[data-theme="light"]`).

Rules the kit already enforces: glass only on things you touch or that move; reading content sits on the light
field. Gold only for our goal and the MVP. Mona Sans (`--vd-sans`) for headings and UI, Geist Mono (`--vd-mono`,
`.vd-clock`) only for the clock. Targets ≥ 44 px. Reduced motion and reduced transparency handled in CSS/hooks.

## Styles

| File | What |
|---|---|
| `tokens.css` | colours, ink, glass tints, radii (`--vd-r-capsule/lens/lens-phone/orn/sheet/ctl`), type scale (`--vd-t-xs…7xl`), springs (`--vd-spring`, `--vd-spring-pop`, `--vd-ease`), durations (`--vd-d-exit/enter/stagger/calm/morph/grow/flood/goal`) |
| `glass.css` | `.vd-glass` (+ `--deep`, `--clear`, `--lens`, `--frost`), `.vd-press`, `.vd-rim-gold`, `.vd-livedot`, `.vd-vh` (visually hidden) |
| `sky.css` | the light field (`VidrioSky`) |
| `components.css` | type helpers (`.vd-score`, `.vd-h1…h4`, `.vd-lede`, `.vd-body`, `.vd-small`, `.vd-clock`), lens, shelf/seg, ribbon, «Ver todo»/grow (`.vd-more`, `.vd-grow`, `.vd-stepback`, `.vd-fade`), floating score, PiP window, goal-moment classes |
| `reading.css` | the ONE source of the shared reading and control pieces (see «Reading pieces and small controls» below); import it where you use them. Pages and the live sheet tune them under their own root class, never by redefining a kit class |
| `transitions.css` | the swap choreography (`.vd-reg-1…6`, `.vd-morph`, `::view-transition-*`) |
| `chrome.css` | the shared chrome restyle (glass capsule nav + glass tab bar), loaded by `celeste/Chrome.tsx` |

## Light field

```ts
<VidrioSky light: LightKey | "noon" floodlit?: boolean weather?: "despejado"|"nubes"|"lluvia"
           reduced?: boolean gold?: boolean cold?: boolean height?: number className?: string />
skyLightOf(light, floodlit?) → "golden"|"flood"|"late"|"noon"|"day"
skyAt(ms, live?) → { light: LightKey; floodlit: boolean }   // sun over Palomeras
```
Absolutely positioned (`inset:0`): put it first inside a `position:relative` stage. Server-safe gradients; the bokeh
canvas is drawn once in the browser. `«día»` theme always paints the day field. `height` = first screen (px).

## Glass, lens, light

```ts
<Lens as?: "div"|"section"|"article" refract?: boolean | LensOptions goal?: string morphName?: string …HTMLAttributes>
useRefraction(ref, { bezel?=22, strength?=1.3, blur?=10 }, enabled?=true)   // Chromium only, else blur glass
useLightPointer(ref)   // --vd-lx/--vd-ly follow pointer/tilt (put it on the stage root)
<VidrioDefs />          // optional shared gradients (#vd-grad-us, #vd-grad-gold)
```
Any element can be glass: `className="vd-glass"` (+ `style={{"--vd-r": "28px"}}` for the radius). Lens has the
`.vd-glint` layer the goal sweeps.

## Shelf (places) and segmented control

```ts
<Shelf places: {id,label,hint?,short?,badge?}[] value onChange(id) label idBase variant?: "shelf"|"seg" className? />   // short: the hint under 700 px
shelfTabId(idBase, id) / shelfPanelId(idBase, id)   // put on your panel: role="tabpanel" id aria-labelledby
nextIndex(key, at, n)  travel(fromIndex, toIndex) → "left"|"right"
```
Tabs semantics, roving tab stop, arrows/Home/End select (automatic activation). Pair with `swap(travel(a,b), …)`.

## Momentum ribbon

```ts
<MomentumRibbon items: RibbonItem[] duration: number now?: number goldId?: string|null label? peakClassName? />
type RibbonItem = { id; x /* % of match, like pulseTrack */; side: "us"|"them"; goal: boolean;
                    h?: number /* weight, pulseTrack's TICK */; kind?: "gol"|"tarjeta"|"roja"|"palo"|"parada"|"ocasion"|"cambio"|"otro";
                    label?: string /* a mark's words */ }
ribbonModel(items, duration, now?, goldId?)   // pure geometry
```
Map from `pulseTrack(feedOf(match, nameOf), duration).ticks` + each FeedItem's `meta.type` → `kind`.

## «Ver todo» that grows in place

```ts
const g = useGrow("plays");     // unique view-transition-name
<section {...g.summaryProps /* className + VT name while closed */}> … <SeeAll summary={<><b>31 jugadas más</b> desde el minuto 1</>}
     count={31} label="Ver todo el partido" onOpen={g.grow} /></section>
<GrowWindow open={g.open} title="Jugada a jugada" sub? filters={<Shelf variant="seg" …/>} onClose={g.close}
            {...g.windowProps} className/style /* place it: the stage's main window */>…</GrowWindow>
```
Merge `summaryProps.className` with yours. Siblings that step back: `.vd-stepback`. Scroll zones: `.vd-fade`.

## Transitions (exit → morph → enter)

```ts
swap(direction: "left"|"right"|"up", update: () => void): { finished: Promise<void>; animated: boolean }
region(n: 1..6) → "vd-reg-n"            // one element per number per page (unique view-transition-name)
morph(name) → { className: "vd-morph", style: { viewTransitionName: name } }   // shared objects
```
`update` runs inside `flushSync` (plain setState is fine). No View Transitions / shots: instant. Reduced motion:
120 ms crossfade. Direction of travel: shelf moves right → `swap("right")` (content comes from the right).

## Live: floating score, docking, PiP, goal

```ts
<FloatingScore match: FloatMatch now: number onOpen onPip? storageKey placement?: "right"|"centre"
               barHeight?=88 dockHeight?=96 goal?: string rim?: boolean scoreClass?: string sheetOpen?: boolean />  // client only
type FloatMatch = { state: "previa"|"rsvp"|"anotador"|"pitido"|"directo"|"descanso"|"final"|"acta"|"mvp"|"pendiente"|"offline"; us; them; rival;
                    clock?: "23′"; kickoff?: ms; event?: {title, sub?} | null /* unfolded ~4 s */; staleAt?: "26′"; crest? }
useDraggable(ref, { storageKey?, home?(box), handle?, zone?: "viewport"|"parent", enabled?, anchors?: "nine"|"corners",
                    axis?: "both"|"x", margin?, top?, bottom?, onSettle? }) → { home() }
anchors.ts: anchorPoints, nearestAnchor, stepAnchor, clampPos, dragTo, parsePos   // pure
liveDock.setLive(bool) · liveDock.get() · useLiveDockState() → { live, mode: "float"|"lens"|"anchor", anchor, hidden }
liveDock.setHidden({score, said} | null, onReveal) · liveDock.reveal()   // «Ocultar hasta el próximo gol»: the capsule's chip
liveDock.setPipOpener(fn | null) · liveDock.openPip()                    // «Sacar el marcador» from the search's «Ahora»
LIVE_MORPH = "vd-live-marcador"   // the score's view-transition-name across pages (float ↔ lens ↔ match scoreboard)
<VIcon name size? className? />   // the boards' glyphs (home, fixtures, shirt, chart, shield, bell, search, pip, post, glove…)
useLiveNow() → boolean        // the chrome's live dot reads this
useLiveDock(ref, "lens" | "anchor")   // page: «my lens shows the match» / «dock the float here»
openScorePip({width?, height?, title?}) → Promise<ScorePip>   // call from the click (user gesture)
<PipWindow pip: ScorePip|null title onClose bottom?>{score}</PipWindow>   // Document PiP or in-page glass window (330 × 150, bottom-right)
useGoalMoment(moment: {key, side: "us"|"them"} | null, {reduced?}) → GoalClasses
  { stage, active, root, lens, sky: {gold, cold}, glint, digit, name, peak, rim }
```
Goal wiring: `<div className={g.root}>` around the glass, `<Lens goal={`${g.lens} ${g.glint}`} className={g.rim ? "vd-rim-gold" : ""}>`,
`<VidrioSky gold={g.sky.gold} cold={g.sky.cold}>`, the changed digit `className={g.digit}` (switch the number at
`stage === "roll"` or later), scorer `className={g.name}`, `<MomentumRibbon peakClassName={g.peak}>`. Pass `null`
when the next play arrives (the rim goes). A goal present on mount does not replay.

The live system that mounts all this on every page is `live/LiveScore` (RootLayout): the island's states
(lib/derived/island), the sheet, «Todo el partido», the PiP window, the goal moment and the one polite live region.

Float storage keys: `vd-pos-<storageKey>` (desktop) and `vd-pos-<storageKey>-movil` (phone); PiP: `vd-pos-pip`.

## Chrome (all pages)

The boards' chrome (cierre): the capsule «Inicio · Partidos · Plantilla · Números · Club» with one bead that
slides between pages; at the end of the top bar the round search («Buscar (Ctrl K)»), the bell (everyone: a fan
gets «Avisos a medida» only) and the account — a member's avatar pill («J Jordi»: «Tú, Jordi» for a jugador,
«Tu cuenta, Marta» for a socio) opening the account sheet (account/AccountSheet), a fan's «Entrar» link
(«Entrar al vestuario», to /vestuario without JavaScript; with it, the door's sheet). The phone/tablet tab bar has
the same five pages labelled and tightens while scrolling down. The theme switch left the top bar: a
`<ThemeToggle/>` passed in `actions` renders nothing there (chromeSlot); it lives in the account sheet and the
footer. Props unchanged (`sub` is kept but not shown: the bar names the club). `live?: boolean` on both (default:
`useLiveNow()`): «Partidos» gets `.vd-livedot` and «, en directo». Moving between pages from the capsule or the tab
bar runs the choreography (celeste/pageTransition: html[data-vd-dir] + [data-vd-page]); mark your page's regions
with `region(n)` to get them in order, and put `morph(LIVE_MORPH)` on whatever shows tonight's score.

## Reading pieces and small controls

`src/styles/vidrio/reading.css` (import it where you use them; Inicio, Partidos and the live sheet all do): `.vd-btn` (+ `--pri`, `--sm`, `--gold`, `[aria-pressed]`; put `vd-glass vd-press` on it),
`.vd-ibtn`, `.vd-link`, `.vd-live` (red dot + words), `.vd-teams` / `.vd-team` / `.vd-team__crest(--rival)`, `.vd-scoreline` /
`.vd-scoreline__sep` / `.vd-digit`, `.vd-status`, `.vd-plays` / `.vd-play(--them)` / `.vd-ico(--card|--red)`, `.vd-table` (`td.p`, `td.t`,
`td.pts`, `tr.us`, `tr.vd-gap`) and `.vd-move`, `.vd-form` / `.vd-form__l--g|p|prov|empty`, `.vd-count`, `.vd-window`, `.vd-sheet`,
`.vd-sun`, `.vd-orn` / `.vd-orn__head` (a small glass card with a head), `.vd-label` / `.vd-input`, `.vd-pitch` / `.vd-pitch__lines` / `.vd-player` / `.vd-player__name`, `.vd-shirt` (`--s` size; a drawn celeste shirt, or
`.vd-shirt--img` with `--vd-shirt-img: url(…)` for a real still from `useShirtStills`; `--away`; `<b>` the dorsal).
