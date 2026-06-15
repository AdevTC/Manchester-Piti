# La Pizarra — Pulido (Sub-proyecto 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkbox steps. UI via `/impeccable`.

**Goal:** Polish the board — mobile tactics accordion + real drag overlay, whole-squad natural positions + bajas drawer, free-mode snap/reset + captain armband + galones legend, a11y (aria-live, focus trap, reduced-motion), and vitest over the extracted pure logic.

**Architecture:** Extract the board's pure ops into `lineupOps.ts` (one source of truth, testable). `useFocusTrap` hook for dialogs. vitest (node env) over the pure modules. Everything else is incremental UI on the existing Pizarra.

**Tech Stack:** React 19 + TS strict + `@dnd-kit/react` (DragOverlay) + vitest. No Firestore changes.

**Spec:** `docs/superpowers/specs/2026-06-16-pizarra-pulido-design.md`. Scope: all 4 themes.

**Branch:** `feat/pizarra-pulido`. Commit per task, `git add <files>`, no `-A`/`--no-verify`/force-push. Verify each: `npm run build` + `npm run lint`.

---

### Task 0: Baseline
- [ ] `npm run build` exit 0; `npm run lint` 0 errors. Branch `feat/pizarra-pulido`.

---

### Task 1: Extract `lineupOps.ts` + refactor Pizarra

**Files:** Create `src/pages/pizarra/lineupOps.ts`; Modify `src/pages/pizarra/Pizarra.tsx`.

- [ ] **Step 1: Create `lineupOps.ts`** — move the pure helpers from Pizarra verbatim, change `seedLineup` to take `playerIds`, add `fillLineup` + `XI`.

```ts
// Pure board operations — the single source of truth for placement logic.
// No React. Unit-tested in lineupOps.test.ts.
import { applyFormation, emptySlots, type FormationName, type Lineup, type SlotState, type Zone } from "./formations";
import { defaultTactics } from "./tactics";

export const XI = 7;

export type Location = { type: "slot"; index: number } | { type: "bench" } | null;

export function locationOf(lineup: Lineup, id: string): Location {
  const slotIndex = lineup.slots.findIndex((s) => s.playerId === id);
  if (slotIndex >= 0) return { type: "slot", index: slotIndex };
  if (lineup.bench.includes(id)) return { type: "bench" };
  return null;
}

/** Seed a lineup from an ordered id list: first XI to the slots, rest to bench. */
export function seedLineup(formation: FormationName, playerIds: string[]): Lineup {
  const slots = emptySlots(formation);
  playerIds.slice(0, XI).forEach((id, i) => {
    slots[i].playerId = id;
  });
  return {
    formation,
    freeMode: false,
    slots,
    bench: playerIds.slice(XI),
    roles: {},
    tactics: defaultTactics(),
    playerPositions: {},
    pinned: [],
  };
}

export function placeIntoSlot(lineup: Lineup, id: string, index: number): Lineup {
  const from = locationOf(lineup, id);
  const slots = lineup.slots.map((s) => ({ ...s }));
  let bench = [...lineup.bench];
  const displaced = slots[index].playerId;
  if (from?.type === "slot") {
    slots[from.index].playerId = displaced;
  } else {
    bench = bench.filter((b) => b !== id);
    if (displaced) bench.push(displaced);
  }
  slots[index].playerId = id;
  return { ...lineup, slots, bench };
}

export function sendToBench(lineup: Lineup, id: string): Lineup {
  const from = locationOf(lineup, id);
  if (from?.type !== "slot") return lineup;
  const slots = lineup.slots.map((s) => ({ ...s }));
  slots[from.index].playerId = null;
  const bench = lineup.bench.includes(id) ? lineup.bench : [...lineup.bench, id];
  return { ...lineup, slots, bench };
}

export function swapPlayers(lineup: Lineup, a: string, b: string): Lineup {
  const la = locationOf(lineup, a);
  const lb = locationOf(lineup, b);
  if (!la || !lb) return lineup;
  const slots = lineup.slots.map((s) => ({ ...s }));
  let bench = [...lineup.bench];
  const setAt = (loc: Location, id: string) => {
    if (loc?.type === "slot") slots[loc.index].playerId = id;
  };
  setAt(la, b);
  setAt(lb, a);
  if (la?.type === "bench" || lb?.type === "bench") {
    bench = bench.map((x) => (x === a ? b : x === b ? a : x));
  }
  return { ...lineup, slots, bench };
}

/** Fill a formation: keep pinned slots, then place from `pool` by zone match,
 *  then fill remaining slots in order. Returns slots + leftover bench. Shared
 *  by Auto-XI (pool ordered by squad) and Suggest-by-form (pool ordered by form). */
export function fillLineup(
  formation: FormationName,
  pinnedInSlot: Map<number, string>,
  pool: string[],
  zoneOf: (id: string) => Zone | undefined,
): { slots: SlotState[]; bench: string[] } {
  const slots = emptySlots(formation);
  pinnedInSlot.forEach((id, i) => {
    slots[i].playerId = id;
  });
  const rest = [...pool];
  slots.forEach((s) => {
    if (s.playerId) return;
    const idx = rest.findIndex((id) => zoneOf(id) === s.zone);
    if (idx >= 0) s.playerId = rest.splice(idx, 1)[0];
  });
  slots.forEach((s) => {
    if (!s.playerId && rest.length) s.playerId = rest.shift() as string;
  });
  return { slots, bench: rest };
}

/** Reset free-mode positions back to the formation's slot coordinates. */
export function resetPositions(lineup: Lineup): Lineup {
  return { ...lineup, freeMode: false, slots: applyFormation(lineup.slots, lineup.formation) };
}

/** Snap a percentage coordinate to a grid step (e.g. 5%). */
export function snapToGrid(v: number, step = 5): number {
  return Math.round(v / step) * step;
}
```

- [ ] **Step 2: Refactor `Pizarra.tsx`** — delete the now-moved helpers (`Location`, `locationOf`, `seedLineup`, `placeIntoSlot`, `sendToBench`, `swapPlayers`) and the local `const XI = 7;`. Import from lineupOps:
```ts
import { XI, locationOf, seedLineup, placeIntoSlot, sendToBench, swapPlayers, fillLineup, resetPositions, snapToGrid, type Location } from "./lineupOps";
```
Update every `seedLineup(...)` call to pass ids. Add (near `playersById`):
```ts
  const activePlayers = useMemo(() => players.filter((p) => p.active), [players]);
  const bajas = useMemo(() => players.filter((p) => !p.active), [players]);
  const orderedIds = useMemo(() => [...activePlayers, ...bajas].map((p) => p.id), [activePlayers, bajas]);
```
- Initial `useState`: `seedLineup(DEFAULT_FORMATION, [])` (unchanged — empty array).
- Re-seed effect: `setLineup((prev) => seedLineup(prev.formation, orderedIds));` and add `orderedIds` to that effect's deps (rosterSig already gates it; keep `orderedIds` in deps honestly — it changes with players). Replace `players` in deps with `orderedIds`.
- `resetBoard`: `commit(seedLineup(lineup.formation, orderedIds))`.
- `newBoard`: `setLineup(seedLineup(lineup.formation, orderedIds))`.
- `autoXI`: rebuild on `fillLineup` with an active-only pool, appending bajas to the bench:
```ts
  const zoneOf = (id: string): Zone | undefined => lineup.playerPositions[id] ?? playersById.get(id)?.naturalPosition;
  const autoXI = (): void => {
    if (readOnly) return;
    const pinnedInSlot = new Map<number, string>();
    lineup.slots.forEach((s, i) => { if (s.playerId && lineup.pinned.includes(s.playerId)) pinnedInSlot.set(i, s.playerId); });
    const taken = new Set(pinnedInSlot.values());
    const pool = activePlayers.map((p) => p.id).filter((id) => !taken.has(id));
    const { slots, bench } = fillLineup(lineup.formation, pinnedInSlot, pool, zoneOf);
    withMorph(() => commit({ ...lineup, slots, bench: [...bench, ...bajas.map((b) => b.id)] }));
  };
```
(Move the existing inline `zoneOf` out so both autoXI and suggestByForm use it.)
- `suggestByForm`: same shape, pool = active sorted by form:
```ts
    const pool = activePlayers.filter((p) => !taken.has(p.id)).sort((a, b) => (form.get(b.id) ?? 0) - (form.get(a.id) ?? 0)).map((p) => p.id);
    const { slots, bench } = fillLineup(lineup.formation, pinnedInSlot, pool, zoneOf);
    withMorph(() => commit({ ...lineup, slots, bench: [...bench, ...bajas.map((b) => b.id)] }));
```

- [ ] **Step 3:** `npm run build` exit 0; `npm run lint` 0. Browser: drag, tap-to-place, Auto, Forma still work (no regression).
- [ ] **Step 4: Commit**
```bash
git add src/pages/pizarra/lineupOps.ts src/pages/pizarra/Pizarra.tsx
git commit -m "refactor(pizarra): extract pure lineup ops to a testable module"
```

---

### Task 2: `active` flag + Bajas drawer

**Files:** Modify `src/pages/pizarra/usePizarraPlayers.ts`, `Pizarra.tsx`.

- [ ] **Step 1:** `usePizarraPlayers` — add `active: boolean;` to `PizarraPlayer`; in the mapper add `active: p.active !== false,` (default true).
- [ ] **Step 2:** `Pizarra.tsx` — split the rendered bench. The existing `benchPlayers`/`filteredBench` derive from `lineup.bench`. Add:
```ts
  const benchActive = filteredBench.filter((p) => p.active);
  const benchBajas = benchPlayers.filter((p) => !p.active);
```
Render the active ones in the current `.pz-bench-rail`; add a collapsible "Bajas" drawer below the bench listing `benchBajas` (same `PlayerToken`, `from="bench"`), gated behind a `bajasOpen` state, shown only when `benchBajas.length > 0`. Bajas tokens stay draggable/tappable (you can still field a returning player).
- [ ] **Step 3:** build + lint; browser: an inactive player appears under "Bajas", not the main rail; Auto/seed keep them benched. Commit:
```bash
git add src/pages/pizarra/usePizarraPlayers.ts src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): bajas drawer (inactive players separated from the bench)"
```

---

### Task 3: Whole-squad natural-position panel

**Files:** Modify `src/pages/pizarra/Pizarra.tsx`.

- [ ] **Step 1:** Add a collapsible panel "Plantilla" (state `squadOpen`, default closed) listing **all** `players` (active + bajas) with: dorsal + name + a position chip (effective natural) always visible, and — for admins — a natural-position `<select>` (reuse `saveNatural`). Non-admins see the chip only. Place it after the existing `pz-panels` block (galones/posiciones). Use existing `pz-pos-*`/`pz-boards-*` styling patterns; bajas rows get an `is-baja` class (muted).
- [ ] **Step 2:** build + lint; browser: every squad player listed with chip; admin can set natural for a benched/baja player and it persists (optimistic in preview). Commit:
```bash
git add src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): whole-squad natural-position panel"
```

---

### Task 4: Mobile tactics accordion

**Files:** Modify `src/pages/pizarra/PizarraControls.tsx`.

- [ ] **Step 1:** Add internal `tacticsOpen` state (default false). Wrap the 7 tactic `.pz-ctrl` blocks in `<div className={`pz-tactics${tacticsOpen ? " is-open" : ""}`}>`. Before it, render a `<button className="pz-tactics-toggle" aria-expanded={tacticsOpen} onClick={() => setTacticsOpen(o=>!o)}>Táctica</button>` (CSS shows this toggle + collapse only at `max-width: 899px`; desktop always shows the tactics, hides the toggle). System select + actions stay outside the collapse.
- [ ] **Step 2:** build + lint; browser at mobile width: tactics collapsed behind "Táctica", expand works; desktop unchanged. Commit:
```bash
git add src/pages/pizarra/PizarraControls.tsx
git commit -m "feat(pizarra): collapsible tactics on mobile"
```

---

### Task 5: Real DragOverlay + clearer drop

**Files:** Modify `src/pages/pizarra/Pizarra.tsx`, `src/pages/pizarra/Pizarra.css` (overlay styles in Task 11).

- [ ] **Step 1:** Import `DragOverlay` from `@dnd-kit/react`. Inside `<DragDropProvider>`, render once (sibling of the `.pz` div):
```tsx
        <DragOverlay>
          {(source) => {
            const p = source ? playersById.get(String(source.id)) : null;
            return p ? (
              <span className="pz-drag-overlay" aria-hidden="true">
                <Jersey name={p.shirtName} number={p.number} size="sm" style={{ filter: "none", width: 56, height: 56 }} />
              </span>
            ) : null;
          }}
        </DragOverlay>
```
Import `Jersey` from `../../components/Jersey`. (Drop animation is dnd-kit's default.)
- [ ] **Step 2:** build + lint; browser: dragging shows a lifted jersey preview following the cursor; drop indicators (`.is-over`) read clearly. Commit:
```bash
git add src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): real drag overlay preview"
```

---

### Task 6: Free-mode snap-to-grid + reset positions

**Files:** Modify `src/pages/pizarra/Pizarra.tsx`, `PizarraControls.tsx`.

- [ ] **Step 1:** Add `snap` state (default false). In `repositioned` (free-mode drop), when `snap`, snap the new x/y: `s.x = clamp(snapToGrid(s.x + dx), 6, 94)` etc. Add a `resetPositionsHandler`:
```ts
  const doResetPositions = (): void => { if (readOnly) return; withMorph(() => commit(resetPositions(lineup))); };
```
- [ ] **Step 2:** In `PizarraControls`, when `freeMode`, show two extra controls: a snap toggle (`aria-pressed={snap}` → `onToggleSnap`) and a "Reset posiciones" button (`onResetPositions`). Add props `freeMode` (already present), `snap`, `onToggleSnap`, `onResetPositions`. Pass from Pizarra. Add a grid overlay element in the pitch shown when `freeMode && snap` (a CSS background grid, styled in Task 11).
- [ ] **Step 3:** build + lint; browser: in free mode, toggle snap → dropped tokens snap to grid + grid shows; reset returns them to the formation. Commit:
```bash
git add src/pages/pizarra/Pizarra.tsx src/pages/pizarra/PizarraControls.tsx
git commit -m "feat(pizarra): free-mode snap-to-grid + reset positions"
```

---

### Task 7: Captain armband + galones legend

**Files:** Modify `src/pages/pizarra/PlayerToken.tsx`, `Pizarra.tsx`, `Pizarra.css` (Task 11).

- [ ] **Step 1:** `PlayerToken` — add `captain?: boolean`. When true, render an armband overlay over the jersey: `{captain && <span className="pz-token-armband" aria-hidden="true" title="Capitán" />}` (a small band; the © seal already conveys it non-chromatically, the armband is the drawn flourish).
- [ ] **Step 2:** `Pizarra.tsx` — pass `captain={lineup.roles.captainId === player.id}` to the pitch `PlayerToken` (and bench if desired). In the galones panel, add a legend listing `ROLE_META` glyph→label:
```tsx
            <ul className="pz-roles-legend" aria-hidden="true">
              {ROLE_META.map((r) => (<li key={r.key}><span className="pz-role-seal">{r.glyph}</span>{r.label}</li>))}
            </ul>
```
- [ ] **Step 3:** build + lint; browser: captain shows an armband; legend explains the seals. Commit:
```bash
git add src/pages/pizarra/PlayerToken.tsx src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): captain armband + galones legend"
```

---

### Task 8: ARIA-live placement announcements

**Files:** Modify `src/pages/pizarra/Pizarra.tsx`.

- [ ] **Step 1:** Add `const [liveMsg, setLiveMsg] = useState("");` and a helper `announce(msg: string)`. Render a visually-hidden live region near the root: `<p className="pz-sr-only" aria-live="polite" role="status">{liveMsg}</p>`. A `nameOf(id)` helper (number + shirt/first name). Call `announce(...)` from the placement paths:
  - `handleDragEnd` / `activateSlot`: `announce(`${nameOf(id)} a ${ZONE_LABEL[slot.zone]}`)`.
  - `sendToBench`/`activateBench`: `announce(`${nameOf(id)} al banquillo`)`.
  - `swapPlayers` via `activateToken`: `announce(`Cambio: ${nameOf(a)} por ${nameOf(b)}`)`.
  Keep messages short; only on user actions (not on load).
- [ ] **Step 2:** build + lint; browser: confirm the live region updates (inspect text) on place/bench/swap. Commit:
```bash
git add src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): aria-live announcements for placement"
```

---

### Task 9: `useFocusTrap` + apply to dialogs

**Files:** Create `src/pages/pizarra/useFocusTrap.ts`; Modify `LineupsPanel.tsx`, `PizarraSettings.tsx`, `SharePanel.tsx`, `CompareView.tsx`.

- [ ] **Step 1: Create the hook**
```ts
import { useEffect, useRef } from "react";

/** Trap Tab focus within `ref`, close on Escape, restore focus on unmount.
 *  Pass the dialog's container ref and an onClose handler. */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prev = document.activeElement as HTMLElement | null;
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = (): HTMLElement[] => Array.from(node.querySelectorAll<HTMLElement>(sel)).filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [ref, onClose]);
}
```
- [ ] **Step 2:** Apply in each dialog: add a `ref` on the dialog container element (the `.pz-dialog`/`.pz-settings`/`.pz-share`/`.pz-cmp`), call `useFocusTrap(ref, onClose)`. In `LineupsPanel` the two local dialogs (`NameDialog`, `OfficialDialog`) each get a ref + the hook (onClose = their cancel). `PizarraSettings` already has an onClose. Remove now-redundant inline Esc handlers if any (NameDialog's input onKeyDown Escape can stay or defer to the trap — keep both, harmless).
- [ ] **Step 3:** build + lint; browser: open each dialog, Tab cycles within, Esc closes, focus returns to the opener. Commit:
```bash
git add src/pages/pizarra/useFocusTrap.ts src/pages/pizarra/LineupsPanel.tsx src/pages/pizarra/PizarraSettings.tsx src/pages/pizarra/SharePanel.tsx src/pages/pizarra/CompareView.tsx
git commit -m "feat(pizarra): focus trap + Esc + focus restore in dialogs"
```

---

### Task 10: vitest + pure-logic tests

**Files:** Modify `package.json`; Create `vitest.config.ts`, `src/pages/pizarra/lineupOps.test.ts`, `src/pages/pizarra/chemistry.test.ts`.

- [ ] **Step 1: Install vitest** (check Vite 8 compat). Run:
```bash
npm install -D vitest
```
Read the output. If npm reports a peer-dependency conflict with `vite@8`, retry with the newest line that supports it (e.g. `npm install -D vitest@latest`), and if still incompatible, record the blocker, skip Steps 2–4's runtime, but keep `lineupOps.ts` extracted (Task 1) — note in the review that tests are authored but not runnable until vitest supports Vite 8. Otherwise continue.
- [ ] **Step 2: `vitest.config.ts`**
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```
Add to `package.json` scripts: `"test": "vitest run"`.
- [ ] **Step 3: `lineupOps.test.ts`** — cover placement invariants:
```ts
import { describe, it, expect } from "vitest";
import { seedLineup, placeIntoSlot, sendToBench, swapPlayers, fillLineup, locationOf, XI } from "./lineupOps";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

describe("seedLineup", () => {
  it("places the first XI and benches the rest", () => {
    const l = seedLineup("2-3-1", ids);
    expect(l.slots.filter((s) => s.playerId).length).toBe(XI);
    expect(l.bench).toEqual(ids.slice(XI));
  });
});

describe("placeIntoSlot", () => {
  it("swaps with the occupant when placing into a taken slot", () => {
    const l = seedLineup("2-3-1", ids);
    const benchId = l.bench[0];
    const occupant = l.slots[0].playerId as string;
    const next = placeIntoSlot(l, benchId, 0);
    expect(next.slots[0].playerId).toBe(benchId);
    expect(next.bench).toContain(occupant);
    expect(next.bench).not.toContain(benchId);
  });
});

describe("sendToBench", () => {
  it("empties the slot and benches the player", () => {
    const l = seedLineup("2-3-1", ids);
    const id = l.slots[2].playerId as string;
    const next = sendToBench(l, id);
    expect(next.slots[2].playerId).toBeNull();
    expect(next.bench).toContain(id);
  });
});

describe("swapPlayers", () => {
  it("swaps two on-pitch players' slots", () => {
    const l = seedLineup("2-3-1", ids);
    const a = l.slots[0].playerId as string;
    const b = l.slots[1].playerId as string;
    const next = swapPlayers(l, a, b);
    expect(next.slots[0].playerId).toBe(b);
    expect(next.slots[1].playerId).toBe(a);
  });
});

describe("fillLineup", () => {
  it("keeps pinned slots and fills the rest", () => {
    const pinned = new Map<number, string>([[0, "a"]]);
    const { slots, bench } = fillLineup("2-3-1", pinned, ["b", "c", "d", "e", "f", "g", "h"], () => undefined);
    expect(slots[0].playerId).toBe("a");
    expect(slots.filter((s) => s.playerId).length).toBe(XI);
    expect(bench).toContain("h");
  });
  it("matches zone before falling back to order", () => {
    const zoneOf = (id: string) => (id === "z" ? ("DEL" as const) : undefined);
    const { slots } = fillLineup("2-3-1", new Map(), ["x", "z"], zoneOf);
    const del = slots.find((s) => s.zone === "DEL");
    expect(del?.playerId).toBe("z");
  });
});

describe("locationOf", () => {
  it("finds slot and bench locations", () => {
    const l = seedLineup("2-3-1", ids);
    expect(locationOf(l, l.slots[0].playerId as string)).toEqual({ type: "slot", index: 0 });
    expect(locationOf(l, l.bench[0])).toEqual({ type: "bench" });
    expect(locationOf(l, "zzz")).toBeNull();
  });
});
```
- [ ] **Step 4: `chemistry.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { squadNorms, teamRating, lineStats, recentForm, suspendedSet } from "./chemistry";
import { EMPTY_STATS, type PlayerStats } from "../../lib/playerStats";

const mk = (o: Partial<PlayerStats>): PlayerStats => ({ ...EMPTY_STATS, ...o });

describe("teamRating", () => {
  it("is 0 for an empty XI", () => {
    const r = teamRating([], 7, { maxGA: 0, maxPJ: 0, maxSeasons: 0, maxCards: 0 });
    expect(r.score).toBe(0);
    expect(r.tier).toBe("Sin once");
  });
  it("flags out-of-position and missing history", () => {
    const norms = { maxGA: 10, maxPJ: 10, maxSeasons: 4, maxCards: 4 };
    const r = teamRating(
      [{ id: "a", s: mk({ goals: 5, assists: 5, matchesPlayed: 10 }), seasons: 4, zone: "DEL", outOfPosition: true },
       { id: "b", s: EMPTY_STATS, seasons: 0, zone: "DEF", outOfPosition: false }],
      5,
      norms,
    );
    expect(r.oop).toBe(1);
    expect(r.missing).toBe(1);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("squadNorms", () => {
  it("takes the maxima across the squad", () => {
    const n = squadNorms([{ s: mk({ goals: 3, assists: 1, matchesPlayed: 8, yellowCards: 2 }), seasons: 2 }, { s: mk({ goals: 0, matchesPlayed: 2 }), seasons: 5 }]);
    expect(n.maxGA).toBe(4);
    expect(n.maxPJ).toBe(8);
    expect(n.maxSeasons).toBe(5);
    expect(n.maxCards).toBe(2);
  });
});

describe("lineStats", () => {
  it("aggregates G+A per zone", () => {
    const lines = lineStats([
      { id: "a", s: mk({ goals: 2, assists: 1 }), seasons: 0, zone: "DEL", outOfPosition: false },
      { id: "b", s: mk({ goals: 1 }), seasons: 0, zone: "DEF", outOfPosition: false },
    ]);
    expect(lines.find((l) => l.zone === "DEL")?.goals).toBe(2);
    expect(lines.find((l) => l.zone === "DEF")?.goals).toBe(1);
  });
});

describe("recentForm + suspendedSet", () => {
  it("scores recent goals and detects a suspension", () => {
    const matches = [
      { events: [{ type: "goal", playerId: "a" }, { type: "red_card", playerId: "b" }] },
      { events: [{ type: "assist", playerId: "a" }] },
    ];
    const form = recentForm(matches);
    expect(form.get("a")).toBe(3); // 2 (goal) + 1 (assist)
    const susp = suspendedSet(matches);
    expect(susp.has("b")).toBe(true);
    expect(susp.has("a")).toBe(false);
  });
});
```
- [ ] **Step 5:** Run `npm test` → all pass. Run `npm run build` + `npm run lint` (ensure test files don't break the app build — `tsconfig.app.json` includes `src`, so `.test.ts` are type-checked too; if vitest globals/types cause tsc errors, add `"types": ["vitest/globals"]` is NOT needed since we import from "vitest" explicitly — but ensure `vitest` types resolve. If `tsc -b` complains about test files, exclude them in `tsconfig.app.json` via `"exclude": ["src/**/*.test.ts"]` and let vitest typecheck them). Commit:
```bash
git add package.json package-lock.json vitest.config.ts src/pages/pizarra/lineupOps.test.ts src/pages/pizarra/chemistry.test.ts tsconfig.app.json
git commit -m "test(pizarra): vitest over lineupOps + chemistry pure logic"
```

---

### Task 11: CSS for all polish

**Files:** Modify `src/pages/pizarra/Pizarra.css`.

- [ ] **Step 1:** Add styles: `.pz-sr-only` (visually-hidden live region); `.pz-tactics` + `.pz-tactics-toggle` (toggle hidden on desktop; on `max-width: 899px` collapse `.pz-tactics` unless `.is-open`); bajas drawer (`.pz-bajas`, `.pz-bajas-head` toggle, muted); `.pz-squad` whole-squad panel (rows, chips, `.is-baja` muted); `.pz-token-armband` (a small sky/white band on the upper-left of the jersey token; non-chromatic — it's a drawn flourish atop the existing © seal); `.pz-roles-legend` (inline glyph→label key); `.pz-drag-overlay` (lifted jersey, scale + shadow, `cursor: grabbing`); free-mode `.pz-grid` overlay (a faint `repeating-linear-gradient` grid shown when free+snap); clearer `.pz-slot.is-over` emphasis. Two themes via tokens. Add new focusables to the focus-visible group (`.pz-tactics-toggle`, `.pz-bajas-head`, etc.). **Reduced motion:** drag overlay no transition; grid static.
- [ ] **Step 2:** build + lint. Commit:
```bash
git add src/pages/pizarra/Pizarra.css
git commit -m "style(pizarra): accordion, bajas, squad panel, armband, legend, overlay, grid"
```

---

### Task 12: Verify + review pause

- [ ] **Step 1:** `npm run build` exit 0 + `npm run lint` 0 (2 known warnings) + `npm test` (if vitest ran). Paste output.
- [ ] **Step 2: Browser matrix** (`?preview`): tactics collapse on mobile + expand; DragOverlay preview follows cursor; whole-squad panel chips + admin natural set; bajas drawer separates inactive players (seed/Auto keep them benched); free-mode snap + grid + reset; captain armband + legend; aria-live text updates on place/bench/swap; focus trap + Esc + restore in each dialog; reduced-motion (no new animations); light/dark, mobile/desktop. Screenshots: mobile collapsed tactics, drag overlay, squad panel, bajas drawer, free-mode grid, armband+legend.
- [ ] **Step 3:** Update memory `pizarra-feature.md` (Sub-proyecto 4 built → #2 roadmap complete; vitest added or blocked-note; lineupOps extraction).
- [ ] **Step 4: Pause for review.** Summarize, paste build/lint/test + screenshots; ask before merging to `main`.

---

## Self-Review

**Spec coverage:** mobile accordion (T4) ✓; drag overlay (T5) ✓; whole-squad natural (T3) ✓; bajas (T2) ✓; free-mode snap/reset+grid (T6) ✓; armband+legend (T7) ✓; aria-live (T8) ✓; focus trap (T9) ✓; reduced-motion (T11) ✓; vitest+tests over pure logic incl. extraction (T1,T10) ✓; no Firestore ✓.

**Placeholder scan:** lineupOps/useFocusTrap/vitest config/tests shown as full code; UI steps cite exact files + snippets; CSS by class+requirement (impeccable at build). vitest-Vite8 risk has an explicit fallback. No TODO/TBD.

**Type consistency:** `seedLineup(formation, playerIds)` new signature applied at every call site (T1 lists them); `fillLineup`/`resetPositions`/`snapToGrid`/`XI`/`Location` exported once from lineupOps, imported in Pizarra. `active` added to `PizarraPlayer` (T2) consumed by `activePlayers`/`bajas`/`orderedIds`. `captain` prop on PlayerToken (T7). `useFocusTrap(ref, onClose)` signature consistent across dialogs. Test imports match exported names (`squadNorms`/`teamRating`/`lineStats`/`recentForm`/`suspendedSet`, `EMPTY_STATS`).
