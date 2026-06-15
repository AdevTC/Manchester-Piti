# La Pizarra — Química / valoración del once (Sub-proyecto 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, chosen by the user) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. All UI work uses `/impeccable` + the "Floodlit Clubhouse" design system.

**Goal:** A deterministic 0–100 rating of the current XI (with count-up + radar + rationale), per-line stats, a "suggest XI by recent form" action, and availability (suspended-from-cards + admin injured flag) with placement warnings — all from real club data, never fabricated.

**Architecture:** Extract the shared stat computation into `src/lib/playerStats.ts` (Expedientes imports it). A pure `chemistry.ts` computes rating/line-stats/recent-form/suspension. A thin `usePizarraStats` hook subscribes to the season's matches-with-events and derives season-level maps (statsById, norms, recentForm, suspended); the lineup-level Rating/lineStats are computed in `Pizarra` via `useMemo` and rendered by `ChemistryPanel`.

**Tech Stack:** React 19 + TS strict + Firebase 12 + `lucide-react` + existing `useCountUp`. No new deps. No Firestore rule/index changes (injured uses the existing admin `players` update).

**Spec:** `docs/superpowers/specs/2026-06-15-pizarra-quimica-design.md`. Decisions: all 4 pieces; extract stats to a shared lib.

**Branch:** `feat/pizarra-quimica` (already created). `git add <specific files>`, commit per task, never `git add -A`, never `--no-verify`, never force-push. Verify each task with `npm run build` + `npm run lint` (read real output). No vitest configured — pure modules are structured for the sub-project-4 test pass; not added here.

---

## File Structure

**New:**
- `src/lib/playerStats.ts` — `StatEvent`, `MatchLike`, `PlayerStats`, `computeStats` (verbatim from Expedientes). Pure.
- `src/pages/pizarra/chemistry.ts` — `squadNorms`, `teamRating`, `lineStats`, `recentForm`, `suspendedSet` + their types. Pure.
- `src/pages/pizarra/usePizarraStats.ts` — realtime matches+events for the season → `{ statsById, norms, recentForm, suspended, loading }`.
- `src/pages/pizarra/ChemistryPanel.tsx` — rating number (count-up) + 4-axis radar + per-line band + rationale + availability warning.

**Modified:**
- `src/pages/Expedientes.tsx` — import the 4 symbols from `../lib/playerStats`, delete the local copies. No behavior change.
- `src/pages/pizarra/usePizarraPlayers.ts` — add `seasonsCount` and `injured` to `PizarraPlayer`; export `setInjured(playerId, value)` (admin).
- `src/pages/pizarra/Pizarra.tsx` — wire `usePizarraStats`, compute rating/lineStats/availability via `useMemo`, render `ChemistryPanel`, add suggest-by-form handler + control, injured toggle (admin) + availability badges.
- `src/pages/pizarra/PlayerToken.tsx` — availability badge (suspended / injured), non-chromatic.
- `src/pages/pizarra/PizarraControls.tsx` — "Sugerir por forma" button (disabled when read-only).
- `src/pages/pizarra/Pizarra.css` — chemistry panel, radar, line band, availability badges.

---

### Task 0: Baseline

- [ ] **Step 1:** `npm run build` → exit 0. `npm run lint` → 0 errors (2 known warnings ok). Confirm branch is `feat/pizarra-quimica`.

---

### Task 1: Extract `src/lib/playerStats.ts`; refactor Expedientes

**Files:** Create `src/lib/playerStats.ts`; Modify `src/pages/Expedientes.tsx`.

- [ ] **Step 1: Create `src/lib/playerStats.ts`** (verbatim move of the types + computeStats)

```ts
// Shared, pure per-player stat computation from match events. Extracted from
// Expedientes so La Pizarra's chemistry can reuse the exact same logic (one
// source of truth). No React, no Firestore — unit-testable.

export interface StatEvent {
  type: string;
  playerId?: string;
  assistPlayerId?: string;
}
export interface MatchLike {
  events?: StatEvent[];
}
export interface PlayerStats {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  doubleYellows: number;
  woodwork: number;
  penaltySaved: number;
  goalPenalty: number;
  goalFreekick: number;
  penaltyMissed: number;
  ownGoals: number;
  matchesPlayed: number;
}

export function computeStats(playerId: string, matches: MatchLike[]): PlayerStats {
  const s: PlayerStats = {
    goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 0,
    penaltySaved: 0, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0, matchesPlayed: 0,
  };
  matches.forEach((match) => {
    let played = false;
    (match.events || []).forEach((ev) => {
      const { type, playerId: epId, assistPlayerId } = ev;
      if (epId === playerId) {
        played = true;
        if (type === "goal") s.goals += 1;
        else if (type === "goal_penalty") { s.goals += 1; s.goalPenalty += 1; }
        else if (type === "goal_freekick") { s.goals += 1; s.goalFreekick += 1; }
        else if (type === "own_goal") s.ownGoals += 1;
        else if (type === "assist") s.assists += 1;
        else if (type === "yellow_card") s.yellowCards += 1;
        else if (type === "red_card") s.redCards += 1;
        else if (type === "double_yellow") { s.doubleYellows += 1; s.yellowCards += 2; s.redCards += 1; }
        else if (type === "penalty_saved") s.penaltySaved += 1;
        else if (type === "penalty_missed") s.penaltyMissed += 1;
        else if (type === "woodwork") s.woodwork += 1;
      }
      if (type === "goal" && assistPlayerId === playerId) { played = true; s.assists += 1; }
    });
    if (played) s.matchesPlayed += 1;
  });
  return s;
}
```

- [ ] **Step 2: Refactor `Expedientes.tsx`** — add import, delete the moved declarations.

Add after the existing imports (near line 8):
```ts
import { computeStats, type PlayerStats, type MatchLike, type StatEvent } from "../lib/playerStats";
```
Then **delete** these now-duplicated declarations from Expedientes (currently lines ~25–31 and the `computeStats` function ~47–75):
- `interface StatEvent { ... }`
- `interface MatchLike { ... }`
- `interface PlayerStats { ... }`
- `function computeStats(...) { ... }`

Leave `derivePerfil`, `huellaFor`, `Norms`, `calculateAge`, `Perfil` in Expedientes (view-specific). They reference `PlayerStats`, now imported. If `StatEvent` ends up unused in Expedientes after the move, drop it from the import (watch `noUnusedLocals`).

- [ ] **Step 3: Build + lint + behavior check**

Run: `npm run build` → exit 0. `npm run lint` → 0 errors.
Browser: at `?preview` open Expedientes mode, confirm a player dossier still shows the same goles/asistencias/PJ (no behavior change).

- [ ] **Step 4: Commit**
```bash
git add src/lib/playerStats.ts src/pages/Expedientes.tsx
git commit -m "refactor(stats): extract computeStats into shared lib for Pizarra reuse"
```

---

### Task 2: `chemistry.ts` — pure rating / lines / form / suspension

**Files:** Create `src/pages/pizarra/chemistry.ts`.

- [ ] **Step 1: Write the file**

```ts
// Deterministic team chemistry/rating from real player stats. Pure (no React).
// Normalized against the season squad so the number is relative to the club's
// own scale and nothing is fabricated; missing data counts as zero, never up.
import type { MatchLike, PlayerStats, StatEvent } from "../../lib/playerStats";
import type { Zone } from "./formations";

export interface SquadNorms {
  maxGA: number;
  maxPJ: number;
  maxSeasons: number;
  maxCards: number;
}

export function squadNorms(squad: { s: PlayerStats; seasons: number }[]): SquadNorms {
  let maxGA = 0, maxPJ = 0, maxSeasons = 0, maxCards = 0;
  squad.forEach(({ s, seasons }) => {
    maxGA = Math.max(maxGA, s.goals + s.assists);
    maxPJ = Math.max(maxPJ, s.matchesPlayed);
    maxSeasons = Math.max(maxSeasons, seasons);
    maxCards = Math.max(maxCards, s.yellowCards + 2 * s.redCards);
  });
  return { maxGA, maxPJ, maxSeasons, maxCards };
}

export interface PlacedPlayer {
  id: string;
  s: PlayerStats;
  seasons: number;
  zone: Zone; // the slot's zone (for line stats)
  outOfPosition: boolean;
}

export interface Rating {
  score: number; // 0..100
  tier: string;
  prod: number; // 0..1 axes (for the radar)
  exp: number;
  disc: number;
  fit: number;
  oop: number;
  empty: number;
  missing: number;
  rationale: string;
}

const ratio = (v: number, m: number): number => (m > 0 ? v / m : 0);

export function teamRating(placed: PlacedPlayer[], emptySlots: number, norms: SquadNorms): Rating {
  const n = placed.length;
  if (n === 0) {
    return { score: 0, tier: "Sin once", prod: 0, exp: 0, disc: 0, fit: 0, oop: 0, empty: emptySlots, missing: 0, rationale: "Coloca jugadores para valorar el once." };
  }
  let P = 0, E = 0, D = 0, oop = 0, missing = 0;
  placed.forEach(({ s, seasons, outOfPosition }) => {
    P += ratio(s.goals + s.assists, norms.maxGA);
    E += 0.5 * ratio(seasons, norms.maxSeasons) + 0.5 * ratio(s.matchesPlayed, norms.maxPJ);
    D += 1 - ratio(s.yellowCards + 2 * s.redCards, norms.maxCards);
    if (outOfPosition) oop += 1;
    if (s.matchesPlayed === 0) missing += 1;
  });
  P /= n; E /= n; D /= n;
  const base = 0.5 * P + 0.25 * E + 0.25 * D;
  const fit = Math.max(0.4, Math.min(1, 1 - 0.05 * oop - 0.12 * emptySlots));
  const score = Math.round(100 * base * fit);
  const tier = score >= 80 ? "Élite" : score >= 65 ? "Sólido" : score >= 50 ? "Competitivo" : "En construcción";
  const driver = P >= E && P >= D ? "Producción alta" : E >= D ? "Bloque con experiencia" : "Disciplina sólida";
  const flags: string[] = [];
  if (oop) flags.push(`${oop} fuera de posición`);
  if (emptySlots) flags.push(`${emptySlots} hueco${emptySlots > 1 ? "s" : ""}`);
  if (missing) flags.push(`${missing} sin historial`);
  return { score, tier, prod: P, exp: E, disc: D, fit, oop, empty: emptySlots, missing, rationale: [driver, ...flags].join(" · ") };
}

export interface LineStat {
  zone: Zone;
  count: number;
  goals: number;
  assists: number;
  pj: number;
  cards: number;
}

export function lineStats(placed: PlacedPlayer[]): LineStat[] {
  const zones: Zone[] = ["DEF", "MED", "DEL"];
  return zones.map((zone) => {
    const inZone = placed.filter((p) => p.zone === zone);
    return {
      zone,
      count: inZone.length,
      goals: inZone.reduce((a, p) => a + p.s.goals, 0),
      assists: inZone.reduce((a, p) => a + p.s.assists, 0),
      pj: inZone.reduce((a, p) => a + p.s.matchesPlayed, 0),
      cards: inZone.reduce((a, p) => a + p.s.yellowCards + 2 * p.s.redCards, 0),
    };
  });
}

// Recent-form score per player over the last `n` matches (already date-desc).
export function recentForm(matchesByDateDesc: MatchLike[], n = 5): Map<string, number> {
  const form = new Map<string, number>();
  const add = (id: string, v: number) => form.set(id, (form.get(id) ?? 0) + v);
  matchesByDateDesc.slice(0, n).forEach((m) => {
    (m.events ?? []).forEach((ev: StatEvent) => {
      const { type, playerId, assistPlayerId } = ev;
      if (playerId) {
        if (type === "goal" || type === "goal_penalty" || type === "goal_freekick") add(playerId, 2);
        else if (type === "assist") add(playerId, 1);
        else if (type === "yellow_card") add(playerId, -0.5);
        else if (type === "red_card" || type === "double_yellow") add(playerId, -2);
      }
      if (type === "goal" && assistPlayerId) add(assistPlayerId, 1);
    });
  });
  return form;
}

// A player is suspended if, in the most recent match they appeared in, they got
// a red card or a double yellow. Matches must be ordered most-recent-first.
export function suspendedSet(matchesByDateDesc: MatchLike[]): Set<string> {
  const seen = new Set<string>();
  const suspended = new Set<string>();
  matchesByDateDesc.forEach((m) => {
    const appeared = new Set<string>();
    const flagged = new Set<string>();
    (m.events ?? []).forEach((ev) => {
      if (!ev.playerId) return;
      appeared.add(ev.playerId);
      if (ev.type === "red_card" || ev.type === "double_yellow") flagged.add(ev.playerId);
    });
    appeared.forEach((id) => {
      if (seen.has(id)) return; // a more recent match already decided this player
      seen.add(id);
      if (flagged.has(id)) suspended.add(id);
    });
  });
  return suspended;
}
```

- [ ] **Step 2:** `npm run build` → exit 0. `npm run lint` → 0 errors.
- [ ] **Step 3: Commit**
```bash
git add src/pages/pizarra/chemistry.ts
git commit -m "feat(pizarra): pure chemistry/rating/form/suspension logic"
```

---

### Task 3: `usePizarraStats.ts` — season matches+events → derived maps

**Files:** Create `src/pages/pizarra/usePizarraStats.ts`.

- [ ] **Step 1: Write the file**

```ts
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { computeStats, type MatchLike, type PlayerStats, type StatEvent } from "../../lib/playerStats";
import { recentForm, squadNorms, suspendedSet, type SquadNorms } from "./chemistry";

interface RawMatch extends MatchLike {
  date?: { seconds: number } | string | number | null;
}

export interface PizarraStats {
  statsById: Map<string, PlayerStats>;
  norms: SquadNorms;
  form: Map<string, number>;
  suspended: Set<string>;
  loading: boolean;
}

/** Realtime per-season match stats for the board's chemistry layer. */
export function usePizarraStats(seasonId: string, players: { id: string; seasonsCount: number }[]): PizarraStats {
  const [feed, setFeed] = useState<{ seasonId: string; matches: MatchLike[] }>({ seasonId: "", matches: [] });
  const loaded = feed.seasonId === seasonId;

  useEffect(() => {
    const ref = collection(db, "matches");
    const q =
      seasonId === "all"
        ? query(ref, orderBy("date", "desc"))
        : query(ref, where("seasonId", "==", seasonId), orderBy("date", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const matches: MatchLike[] = snap.docs.map((d) => {
          const m = d.data() as RawMatch;
          return { events: (m.events as StatEvent[]) ?? [] };
        });
        setFeed({ seasonId, matches });
      },
      (err) => {
        console.error("Error cargando stats de partidos:", err);
        setFeed({ seasonId, matches: [] });
      },
    );
    return () => unsub();
  }, [seasonId]);

  const matches = useMemo(() => (loaded ? feed.matches : []), [loaded, feed.matches]);

  return useMemo(() => {
    const statsById = new Map<string, PlayerStats>();
    players.forEach((p) => statsById.set(p.id, computeStats(p.id, matches)));
    const norms = squadNorms(players.map((p) => ({ s: statsById.get(p.id)!, seasons: p.seasonsCount })));
    return { statsById, norms, form: recentForm(matches), suspended: suspendedSet(matches), loading: !loaded };
  }, [matches, players, loaded]);
}
```

Note: this is a second `matches` subscription alongside `useSeasonMatches` (kept for the official picker). Both are tiny for an amateur club; acceptable and cleanly separated.

- [ ] **Step 2:** `npm run build` → exit 0 (`statsById.get(p.id)!` is safe — set in the line above). `npm run lint` → 0 errors.
- [ ] **Step 3: Commit**
```bash
git add src/pages/pizarra/usePizarraStats.ts
git commit -m "feat(pizarra): season stats hook (statsById, norms, form, suspended)"
```

---

### Task 4: `usePizarraPlayers.ts` — seasonsCount + injured flag

**Files:** Modify `src/pages/pizarra/usePizarraPlayers.ts`.

- [ ] **Step 1: Extend the doc + player types**

In `PlayerDoc` add `injured?: boolean;` (alongside `naturalPosition`). `seasons?: string[]` already exists.
In `PizarraPlayer` add:
```ts
  /** Number of seasons in the club (for the experience axis). */
  seasonsCount: number;
  /** Admin-set unavailability flag. */
  injured: boolean;
```

- [ ] **Step 2: Populate them in the mapper**

In the `players` `useMemo`, change the returned object to include:
```ts
        return {
          id: p.id, firstName: p.firstName || "", lastName: p.lastName || "", shirtName, number,
          naturalPosition: p.naturalPosition,
          seasonsCount: p.seasons?.length ?? 0,
          injured: p.injured === true,
        };
```

- [ ] **Step 3: Add the admin setter** (mirrors `setNaturalPosition`)

```ts
/** Persist a player's injury flag. Caller must gate this to admins (the
 *  Firestore `players` update rule enforces admin role server-side). */
export async function setInjured(playerId: string, injured: boolean): Promise<void> {
  await updateDoc(doc(db, "players", playerId), { injured });
}
```

- [ ] **Step 4:** `npm run build` → exit 0. `npm run lint` → 0 errors. Commit:
```bash
git add src/pages/pizarra/usePizarraPlayers.ts
git commit -m "feat(pizarra): player seasonsCount + admin injured flag"
```

---

### Task 5: `ChemistryPanel.tsx`

**Files:** Create `src/pages/pizarra/ChemistryPanel.tsx`.

Presentational. Receives the computed `Rating`, `LineStat[]`, availability counts, and a `ZONE_LABEL` map. Number uses `useCountUp`. Radar = 4 axes (Producción/Experiencia/Disciplina/Encaje) drawn as a simple SVG polygon; non-chromatic (shape carries meaning). No fabricated data: when `missing>0` show a caveat line.

- [ ] **Step 1: Write the component**

```tsx
import React from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import type { Rating, LineStat } from "./chemistry";
import { ZONE_LABEL } from "./formations";

interface ChemistryPanelProps {
  rating: Rating;
  lines: LineStat[];
  /** Placed players flagged unavailable (suspended or injured). */
  unavailableInXI: number;
}

const AXES: { key: keyof Pick<Rating, "prod" | "exp" | "disc" | "fit">; label: string }[] = [
  { key: "prod", label: "Producción" },
  { key: "exp", label: "Experiencia" },
  { key: "disc", label: "Disciplina" },
  { key: "fit", label: "Encaje" },
];

// 4-axis radar polygon points on a 100x100 box (top, right, bottom, left).
function radarPoints(vals: number[]): string {
  const cx = 50, cy = 50, r = 42;
  const ang = [-90, 0, 90, 180].map((d) => (d * Math.PI) / 180);
  return vals.map((v, i) => `${cx + Math.cos(ang[i]) * r * v},${cy + Math.sin(ang[i]) * r * v}`).join(" ");
}

export const ChemistryPanel: React.FC<ChemistryPanelProps> = ({ rating, lines, unavailableInXI }) => {
  const { value, ref } = useCountUp(rating.score);
  const vals = AXES.map((a) => rating[a.key]);
  return (
    <section className="pz-chem" aria-label="Química del once">
      <div className="pz-chem-head">
        <span className="pz-chem-eyebrow"><Activity size={13} aria-hidden="true" /> Valoración del once</span>
        <span className="pz-chem-tier">{rating.tier}</span>
      </div>
      <div className="pz-chem-body">
        <div className="pz-chem-score">
          <span className="pz-chem-num" ref={ref}>{value}</span>
          <span className="pz-chem-max">/100</span>
        </div>
        <svg className="pz-chem-radar" viewBox="0 0 100 100" aria-hidden="true">
          <polygon className="pz-chem-radar-grid" points="50,8 92,50 50,92 8,50" />
          <line className="pz-chem-radar-grid" x1="50" y1="8" x2="50" y2="92" />
          <line className="pz-chem-radar-grid" x1="8" y1="50" x2="92" y2="50" />
          <polygon className="pz-chem-radar-fill" points={radarPoints(vals)} />
        </svg>
        <ul className="pz-chem-axes">
          {AXES.map((a, i) => (
            <li key={a.key}><span>{a.label}</span><b>{Math.round(vals[i] * 100)}</b></li>
          ))}
        </ul>
      </div>
      <p className="pz-chem-rationale">{rating.rationale}</p>
      {unavailableInXI > 0 && (
        <p className="pz-chem-warn" role="status">
          <AlertTriangle size={13} aria-hidden="true" /> {unavailableInXI} no disponible{unavailableInXI > 1 ? "s" : ""} alineado{unavailableInXI > 1 ? "s" : ""}
        </p>
      )}
      <div className="pz-chem-lines" role="group" aria-label="Stats por línea">
        {lines.map((l) => (
          <div key={l.zone} className="pz-chem-line">
            <span className="pz-chem-line-zone">{ZONE_LABEL[l.zone]}</span>
            <span className="pz-chem-line-ga"><b>{l.goals + l.assists}</b> G+A</span>
            <span className="pz-chem-line-sub">{l.count} jug · {l.pj} PJ{l.cards ? ` · ${l.cards} tarj.` : ""}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 2:** `npm run build` → exit 0. `npm run lint` → 0 errors (styles come in Task 8). Commit:
```bash
git add src/pages/pizarra/ChemistryPanel.tsx
git commit -m "feat(pizarra): chemistry panel (rating number, radar, line stats)"
```

---

### Task 6: Integrate into `Pizarra.tsx`

**Files:** Modify `src/pages/pizarra/Pizarra.tsx`.

- [ ] **Step 1: Imports**
```ts
import { usePizarraStats } from "./usePizarraStats";
import { teamRating, lineStats, type PlacedPlayer } from "./chemistry";
import { ChemistryPanel } from "./ChemistryPanel";
import { setInjured } from "./usePizarraPlayers"; // add to the existing import if cleaner
```
(Add `setInjured` to the existing `usePizarraPlayers` import; add `AlertTriangle` from lucide if used in token wiring — see Task 7.)

- [ ] **Step 2: Wire the stats hook** (after `usePizarraPlayers`)
```ts
  const playerStatsKey = useMemo(() => players.map((p) => `${p.id}:${p.seasonsCount}`).join(","), [players]);
  const statsArg = useMemo(() => players.map((p) => ({ id: p.id, seasonsCount: p.seasonsCount })), [playerStatsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { statsById, norms, form, suspended } = usePizarraStats(selectedSeasonId, statsArg);
```
(`statsArg` is memoized by a stable string key so the hook doesn't resubscribe-derive every render; the disable is intentional and explained.)

- [ ] **Step 3: Availability helper + derived chemistry** (after `effectiveZone`/`isOutOfPosition`)
```ts
  const isUnavailable = (id: string): boolean => suspended.has(id) || (playersById.get(id)?.injured ?? false);

  const placed: PlacedPlayer[] = lineup.slots
    .filter((s) => s.playerId)
    .map((s) => {
      const id = s.playerId as string;
      return {
        id,
        s: statsById.get(id) ?? { goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, woodwork: 0, penaltySaved: 0, goalPenalty: 0, goalFreekick: 0, penaltyMissed: 0, ownGoals: 0, matchesPlayed: 0 },
        seasons: playersById.get(id)?.seasonsCount ?? 0,
        zone: s.zone,
        outOfPosition: isOutOfPosition(s),
      };
    });
  const rating = useMemo(() => teamRating(placed, XI - placed.length, norms), [placed, norms]);
  const lines = useMemo(() => lineStats(placed), [placed]);
  const unavailableInXI = placed.filter((p) => isUnavailable(p.id)).length;
```
(If eslint flags `placed`/`isUnavailable` deps on the `useMemo`s, wrap `placed` in its own `useMemo` keyed on `lineup.slots`, `statsById`, `playersById` and reference that — keep deps honest.)

- [ ] **Step 4: Suggest-by-form handler** (near `autoXI`)
```ts
  const suggestByForm = (): void => {
    if (readOnly) return;
    const pinnedInSlot = new Map<number, string>();
    lineup.slots.forEach((s, i) => { if (s.playerId && lineup.pinned.includes(s.playerId)) pinnedInSlot.set(i, s.playerId); });
    const taken = new Set(pinnedInSlot.values());
    const byForm = [...players].filter((p) => !taken.has(p.id)).sort((a, b) => (form.get(b.id) ?? 0) - (form.get(a.id) ?? 0));
    const pool = byForm.map((p) => p.id);
    const slots = emptySlots(lineup.formation);
    pinnedInSlot.forEach((id, i) => { slots[i].playerId = id; });
    const zoneOf = (id: string): Zone | undefined => lineup.playerPositions[id] ?? playersById.get(id)?.naturalPosition;
    slots.forEach((s) => { if (s.playerId) return; const idx = pool.findIndex((id) => zoneOf(id) === s.zone); if (idx >= 0) s.playerId = pool.splice(idx, 1)[0]; });
    slots.forEach((s) => { if (!s.playerId && pool.length) s.playerId = pool.shift() as string; });
    withMorph(() => commit({ ...lineup, slots, bench: pool }));
  };
```

- [ ] **Step 5: Admin injured toggle** (in the positions panel `<li>` for each placed player, admin-only — next to the natural-position select)
```tsx
                    {isAdmin && (
                      <button
                        type="button"
                        className="pz-pos-injury"
                        aria-pressed={p.injured}
                        disabled={readOnly}
                        onClick={() => void setInjured(p.id, !p.injured)}
                        title={p.injured ? "Quitar lesión" : "Marcar lesionado"}
                      >
                        {p.injured ? "Lesionado" : "Apto"}
                      </button>
                    )}
```
(`setInjured` is fire-and-forget; the realtime `players` snapshot updates `injured`. Guard errors with `.catch` inline if preferred.)

- [ ] **Step 6: Render `ChemistryPanel`** — directly above the `pz-panels` block:
```tsx
        <ChemistryPanel rating={rating} lines={lines} unavailableInXI={unavailableInXI} />
```

- [ ] **Step 7: Pass availability into the tokens** — add `unavailable={isUnavailable(player.id)}` (pitch) and `unavailable={isUnavailable(p.id)}` (bench) to both `<PlayerToken>` usages (prop added in Task 7).

- [ ] **Step 8: Add the suggest-by-form control** — pass `onSuggestForm={suggestByForm}` to `<PizarraControls>` (prop added in Task 7).

- [ ] **Step 9:** `npm run build` → exit 0. `npm run lint` → 0 errors. Commit:
```bash
git add src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): wire chemistry panel, suggest-by-form, availability"
```

---

### Task 7: Token badge + control button

**Files:** Modify `src/pages/pizarra/PlayerToken.tsx`, `src/pages/pizarra/PizarraControls.tsx`.

- [ ] **Step 1: `PlayerToken` availability badge**

Add `unavailable?: boolean;` to `PlayerTokenProps`. Destructure `unavailable = false`. Add `unavailable ? "is-unavailable" : ""` to the className list. Render a non-chromatic badge when unavailable (a cross/plus glyph + the word in the aria-label), e.g. after the pin badge:
```tsx
      {unavailable && (
        <span className="pz-token-unavail" aria-hidden="true" title="No disponible">✚</span>
      )}
```
Append to the existing `aria-label` string: `${unavailable ? ", no disponible" : ""}`.

- [ ] **Step 2: `PizarraControls` suggest-by-form button**

Add `onSuggestForm: () => void;` to the props. Render a new action button next to "Auto" (disabled when `readOnly`):
```tsx
        <button type="button" className="pz-action" onClick={onSuggestForm} title="Sugerir once por forma reciente" disabled={readOnly}>
          <TrendingUp size={14} aria-hidden="true" /> Forma
        </button>
```
Import `TrendingUp` from `lucide-react`.

- [ ] **Step 3:** `npm run build` → exit 0. `npm run lint` → 0 errors. Commit:
```bash
git add src/pages/pizarra/PlayerToken.tsx src/pages/pizarra/PizarraControls.tsx
git commit -m "feat(pizarra): availability badge on tokens + suggest-by-form control"
```

---

### Task 8: Styles

**Files:** Modify `src/pages/pizarra/Pizarra.css`.

- [ ] **Step 1:** Read the relevant token/section patterns again if needed, then add styles for: `pz-chem` panel (header eyebrow + tier chip), `pz-chem-score`/`pz-chem-num` (Anton, large, `--mp-accent`), `pz-chem-radar` (grid hairlines + sky fill, flat), `pz-chem-axes` (4 rows), `pz-chem-rationale` (muted), `pz-chem-warn` (gold/red with `AlertTriangle` — non-color cue via icon+text), `pz-chem-lines`/`pz-chem-line` (3-column band), `pz-token-unavail` badge (like `pz-token-oop`/`pz-token-pin`, non-chromatic glyph), `pz-token.is-unavailable` dim, `pz-pos-injury` toggle button (`aria-pressed` styling like `pz-pin-btn`). Two themes via `--mp-*`. Add the new buttons/elements to the focus-visible group and reduced-motion block. Add `.pz-chem` to the `.pz--present` hide list. Mobile (`max-width:899px`): radar + score stack; desktop: place `.pz-chem` in the panels grid or above it.

- [ ] **Step 2:** `npm run build` → exit 0. `npm run lint` → 0 errors. Commit:
```bash
git add src/pages/pizarra/Pizarra.css
git commit -m "style(pizarra): chemistry panel, radar, line band, availability badges"
```

---

### Task 9: Verify + review pause

- [ ] **Step 1:** `npm run build` (exit 0) + `npm run lint` (0 errors, 2 known warnings). Paste output.
- [ ] **Step 2: Browser matrix** (`?preview`, Pizarra):
  - The rating number animates (count-up) on load and updates as the XI changes; tier label matches; radar reflects axes; rationale shows drivers + flags.
  - Remove a player → `empty` flag + lower score; place an out-of-position player → `oop` flag + lower fit.
  - "Sin historial" caveat appears when a player without stats is in the XI (no fabricated values).
  - Stats por línea: DEF/MED/DEL aggregates match the placed players.
  - "Forma" button fills by recent form (respects pinned); differs from "Auto" when form ≠ position.
  - Suspended (a player with a red/double-yellow in their latest match) shows the badge + counts toward the warning; admin "Lesionado" toggle flips the badge and warning.
  - Light/dark, mobile/desktop, reduced-motion (count-up + radar honor it). Console clean.
  - Screenshots: panel with number+radar+lines, an out-of-position low score, availability badge + warning, mobile.
- [ ] **Step 3:** Update memory `pizarra-feature.md` (Sub-proyecto 2 built; files; no new Firestore rules; `injured` flag added to players).
- [ ] **Step 4: Pause for review.** Summarize, paste build/lint, screenshots; ask before merging to `main`.

---

## Self-Review

**Spec coverage:** rating (Task 2 `teamRating` + Task 5 panel) ✓; line stats (Task 2 `lineStats` + panel) ✓; suggest-by-form (Task 2 `recentForm` + Task 6 `suggestByForm` + Task 7 button) ✓; availability (Task 2 `suspendedSet` + Task 4 `injured`/`setInjured` + Task 6 toggle + Task 7 badge + panel warning) ✓; stats extraction (Task 1) ✓; never-fabricate (`ratio` zero-guards, `missing` caveat, `matchesPlayed===0` → 0) ✓; no Firestore changes ✓.

**Placeholder scan:** no TODO/TBD; pure logic + integration shown as code; CSS specified by class + requirement (governed by `/impeccable` at build) — not a placeholder.

**Type consistency:** `PlayerStats`/`MatchLike`/`StatEvent` defined once in `playerStats.ts`, imported everywhere. `Rating`/`LineStat`/`PlacedPlayer`/`SquadNorms` defined once in `chemistry.ts`. `teamRating(placed, emptySlots, norms)` and `lineStats(placed)` signatures match call sites in Task 6. `PizarraPlayer.seasonsCount`/`injured` (Task 4) consumed in Tasks 5–7. `useCountUp(target)` returns `{value, ref}` (matches Task 5). `usePizarraStats(seasonId, players)` shape matches Task 3↔6. Token `unavailable` and controls `onSuggestForm` props (Task 7) match the Task 6 usages.
