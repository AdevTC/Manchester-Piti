# La Pizarra — Persistencia & alineación oficial (Sub-proyecto 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. All UI work uses the `/impeccable` skill and the "Floodlit Clubhouse" design system.

**Goal:** Make a Pizarra board survive reloads — save/load/rename/delete personal boards, autosave the active board, and let admins publish an **official** lineup (per season and per match) that everyone else loads read-only.

**Architecture:** A `lineups` Firestore collection mirrors the in-memory `Lineup` 1:1 plus metadata (owner, season, name, official flag, matchId, timestamps). A single hook `useLineups(seasonId)` is the only thing that touches the store; it has two interchangeable backends — **Firestore** in real (authenticated) sessions and **localStorage** under `?preview` (where there is no real Firebase auth token, so Firestore rules would reject writes). The `Pizarra` board gains a board identity (`activeBoardId`, `readOnly`, `saveState`); every mutation already flows through `commit()`, so autosave hooks in there. A new `LineupsPanel` ("Tableros") renders the official + personal lists with load/save/rename/delete/mark-official actions.

**Tech Stack:** React 19 + TypeScript (strict, no `any`) + Firebase 12 Firestore (`onSnapshot`, `serverTimestamp`, `writeBatch`) + `@dnd-kit/react` 0.5.0 + `lucide-react`. No new dependencies.

**Spec of record:** GitHub issue #2 → "Sub-proyecto 1 — Persistencia & alineación oficial". Decisions locked: panel "Tableros" UI · híbrido (autosave + "Guardar como") · oficial por temporada **y** por partido · solo-lectura + "Duplicar para editar".

**Notable deviation from the issue (with rationale):** the issue lists "Firestore siempre, borrar el tablero de prueba" as primary and "backend localStorage en preview" as the alternative. This plan adopts the **localStorage-in-preview** alternative as primary, because `?preview` does not establish a real Firebase auth session (`AuthContext` short-circuits `onAuthStateChanged` and injects a mock user), so the `lineups` rules (`request.auth != null`) would reject every preview read/write. The dual backend is what makes the DoD's "verify in browser" achievable without a logged-in session and without polluting prod.

---

## File Structure

**New files (all under `src/pages/pizarra/`):**
- `lineupDoc.ts` — the `LineupDoc` type + **pure** serialization helpers (`lineupToData`, `dataToLineupDoc`, `extractLineup`, `pruneUndefined`). No React, no Firestore calls → unit-testable later (sub-project 4).
- `useSeasonMatches.ts` — small realtime hook returning the active season's matches (`{id, rival, date, goalsFor, goalsAgainst}`) for the per-match official picker. Mirrors the matches query in `MatchCenter.tsx`.
- `useLineups.ts` — the data layer: realtime subscription + `create/save/rename/remove/markOfficial`, with a Firestore backend and a localStorage backend selected by the preview flag. Only file that talks to the `lineups` store.
- `LineupsPanel.tsx` — the "Tableros" UI: official list + personal list + actions (Nuevo, Guardar como, cargar, renombrar, borrar, marcar/quitar oficial) + save indicator. Contains two small local dialog components (name prompt, official-scope picker).

**Modified files:**
- `Pizarra.tsx` — board identity state, board handlers, autosave effect, read-only gating, render `<LineupsPanel>` + read-only banner.
- `PizarraControls.tsx` — accept `readOnly` to disable formation/tactics/free/auto/reset (undo/redo stay; settings/present stay).
- `PlayerToken.tsx` — accept `disabled` to turn off drag + tap when read-only.
- `PitchSlot.tsx` — accept `disabled` to turn off drop + activate when read-only.
- `Pizarra.css` — styles: panel, lists, save indicator, gold official seal, read-only banner + dimming, dialogs; two themes, mobile (collapsible), reduced-motion.

**Not in this slice (later sub-projects):** chemistry/rating (2), poster/share/presentation (3), unit tests + bajas drawer + drag overlay (4). No vitest is configured; do **not** add it here.

---

## Conventions for every task

- Work on branch `feat/pizarra-persistencia` (created in Task 0). Never edit on `main` directly.
- `git add <specific files>` only — never `git add -A`. Commit after each task with a clear message. Never `--no-verify`.
- TypeScript strict: never `any`; use `unknown` + narrowing. Spanish-first copy. `lucide-react` icons.
- Verification each task: `npm run build` (runs `tsc -b && vite build`) **and** `npm run lint`, reading the real output. Browser checks via preview tools at `?preview` on `#plantilla` → Pizarra.

---

### Task 0: Branch + pre-flight

**Files:** none (setup only).

- [ ] **Step 1: Create the working branch**

```bash
git switch -c feat/pizarra-persistencia
git status
```
Expected: `On branch feat/pizarra-persistencia`, clean tree.

- [ ] **Step 2: Baseline build + lint are green**

Run: `npm run build`
Expected: `tsc -b` and `vite build` succeed, no errors.
Run: `npm run lint`
Expected: 0 errors (the repo currently has 0 errors; 2 intentional exhaustive-deps warnings are allowed).

- [ ] **Step 3: Confirm `@dnd-kit/react` `useDraggable` accepts `disabled`**

Read `node_modules/@dnd-kit/react/dist/*.d.ts` (or the package types) for the `useDraggable` options type. Confirm a `disabled?: boolean` option exists; do the same for `useDroppable`.
Expected: `disabled` is part of both option types.
If `disabled` is **not** supported: fall back to the no-render-as-draggable strategy noted in Task 7 (render a plain non-draggable element when read-only) instead of passing `disabled`. Record which path you took.

- [ ] **Step 4: Confirm `serverTimestamp` and `writeBatch` exports**

Confirm `firebase/firestore` exports `serverTimestamp`, `writeBatch`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `getDocs`, `query`, `where`, `collection`, `doc`, `onSnapshot`, `Timestamp` (firebase ^12). These are standard; just confirm before relying on them.

---

### Task 1: `lineupDoc.ts` — type + pure serialization

**Files:**
- Create: `src/pages/pizarra/lineupDoc.ts`

The `Lineup` (from `formations.ts`) maps 1:1 to top-level board fields; the doc adds metadata. Firestore rejects `undefined`, so `roles` (optional keys) and `matchId` must be sanitized. Timestamps are written via `serverTimestamp()` and read as `Timestamp` → converted to millis.

- [ ] **Step 1: Write the file**

```ts
// The `lineups` Firestore document and the pure (de)serialization between it
// and the in-memory Lineup. No React / no Firestore calls here so this stays
// unit-testable (sub-project 4). Firestore rejects `undefined`, so writes are
// pruned and `matchId` is normalized to `null`.
import type { Lineup } from "./formations";

/** Metadata stored alongside the board fields in the `lineups` collection. */
export interface LineupMeta {
  ownerUid: string;
  ownerNickname: string;
  seasonId: string; // "all" or a season id
  name: string;
  isOfficial: boolean;
  matchId: string | null; // null = season-scoped official (or not official)
}

/** A full board as held in memory after loading from the store. */
export interface LineupDoc extends Lineup, LineupMeta {
  id: string;
  createdAt: number | null; // ms epoch; null while a local write is pending
  updatedAt: number | null;
}

/** A Firestore Timestamp-ish value (avoids importing the class for a type). */
interface TimestampLike {
  toMillis: () => number;
}
function isTimestampLike(v: unknown): v is TimestampLike {
  return typeof v === "object" && v !== null && typeof (v as { toMillis?: unknown }).toMillis === "function";
}
function toMillis(v: unknown): number | null {
  if (isTimestampLike(v)) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

/** Drop keys whose value is `undefined` (Firestore rejects them). */
export function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as (keyof T)[]).forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

/** The board fields (the Lineup) extracted from a doc, for loading the board. */
export function extractLineup(doc: LineupDoc): Lineup {
  return {
    formation: doc.formation,
    freeMode: doc.freeMode,
    slots: doc.slots.map((s) => ({ ...s })),
    bench: [...doc.bench],
    roles: { ...doc.roles },
    tactics: { ...doc.tactics },
    playerPositions: { ...doc.playerPositions },
    pinned: [...doc.pinned],
  };
}

/** Plain board+meta payload for a write (timestamps added by the caller). */
export function lineupToData(lineup: Lineup, meta: LineupMeta): Record<string, unknown> {
  return {
    formation: lineup.formation,
    freeMode: lineup.freeMode,
    slots: lineup.slots.map((s) => ({ ...s })),
    bench: [...lineup.bench],
    roles: pruneUndefined(lineup.roles as Record<string, unknown>),
    tactics: { ...lineup.tactics },
    playerPositions: { ...lineup.playerPositions },
    pinned: [...lineup.pinned],
    ownerUid: meta.ownerUid,
    ownerNickname: meta.ownerNickname,
    seasonId: meta.seasonId,
    name: meta.name,
    isOfficial: meta.isOfficial,
    matchId: meta.matchId ?? null,
  };
}

/** Build a LineupDoc from a raw store record (Firestore data or local JSON). */
export function dataToLineupDoc(id: string, data: Record<string, unknown>): LineupDoc {
  const d = data as Partial<LineupDoc> & { createdAt?: unknown; updatedAt?: unknown };
  return {
    id,
    formation: d.formation as LineupDoc["formation"],
    freeMode: !!d.freeMode,
    slots: (d.slots as LineupDoc["slots"]) ?? [],
    bench: (d.bench as string[]) ?? [],
    roles: (d.roles as LineupDoc["roles"]) ?? {},
    tactics: (d.tactics as LineupDoc["tactics"]) ?? ({} as LineupDoc["tactics"]),
    playerPositions: (d.playerPositions as LineupDoc["playerPositions"]) ?? {},
    pinned: (d.pinned as string[]) ?? [],
    ownerUid: (d.ownerUid as string) ?? "",
    ownerNickname: (d.ownerNickname as string) ?? "",
    seasonId: (d.seasonId as string) ?? "all",
    name: (d.name as string) ?? "Sin nombre",
    isOfficial: !!d.isOfficial,
    matchId: (d.matchId as string | null) ?? null,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build` → Expected: pass (file compiles, no unused exports error).
Run: `npm run lint` → Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/pizarra/lineupDoc.ts
git commit -m "feat(pizarra): lineup doc type + pure (de)serialization"
```

---

### Task 2: `useSeasonMatches.ts` — matches for the official-per-match picker

**Files:**
- Create: `src/pages/pizarra/useSeasonMatches.ts`

Only used by admins when choosing the per-match official scope. Mirrors the `MatchCenter.tsx` query (filter by `seasonId`, order by `date desc`). Loading-flag is derived from a stored season key (no setState-in-effect-body — matches the repo's lint pattern).

- [ ] **Step 1: Write the file**

```ts
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";

/** A match, reduced to what the official-scope picker needs to label it. */
export interface SeasonMatch {
  id: string;
  rival: string;
  goalsFor: number | null;
  goalsAgainst: number | null;
  dateMs: number | null;
}

interface RawMatch {
  rival?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  date?: { seconds: number } | string | number | null;
}

function dateToMs(v: RawMatch["date"]): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "object" && "seconds" in v) return v.seconds * 1000;
  return null;
}

/** Realtime matches for the active season (admins only consume this). */
export function useSeasonMatches(seasonId: string): { matches: SeasonMatch[]; loading: boolean } {
  const [feed, setFeed] = useState<{ seasonId: string; matches: SeasonMatch[] }>({ seasonId: "", matches: [] });
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
        const matches: SeasonMatch[] = snap.docs.map((dd) => {
          const m = dd.data() as RawMatch;
          return {
            id: dd.id,
            rival: m.rival || "Rival",
            goalsFor: typeof m.goalsFor === "number" ? m.goalsFor : null,
            goalsAgainst: typeof m.goalsAgainst === "number" ? m.goalsAgainst : null,
            dateMs: dateToMs(m.date),
          };
        });
        setFeed({ seasonId, matches });
      },
      (err) => {
        console.error("Error cargando partidos:", err);
        setFeed({ seasonId, matches: [] });
      },
    );
    return () => unsub();
  }, [seasonId]);

  const matches = useMemo(() => (loaded ? feed.matches : []), [loaded, feed.matches]);
  return { matches, loading: !loaded };
}

/** A human label for a match, e.g. "vs Rival · 12 may · 3-1". */
export function matchLabel(m: SeasonMatch): string {
  const date = m.dateMs != null ? new Date(m.dateMs).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : null;
  const score = m.goalsFor != null && m.goalsAgainst != null ? `${m.goalsFor}-${m.goalsAgainst}` : null;
  return ["vs " + m.rival, date, score].filter(Boolean).join(" · ");
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build` → pass. Run: `npm run lint` → 0 errors.
Note: the matches query requires a `seasonId`+`date` composite index in prod; the Firestore console surfaces a one-click link on first run. Record this in the rules/handoff (Task 9). In preview this hook still hits Firestore reads — if `matches` reads are gated by auth in prod and fail under preview, the picker simply shows "Sin partidos"; acceptable (admins mark official in real sessions).

- [ ] **Step 3: Commit**

```bash
git add src/pages/pizarra/useSeasonMatches.ts
git commit -m "feat(pizarra): season matches hook for official-per-match picker"
```

---

### Task 3: `useLineups.ts` — realtime data layer (Firestore + preview backend)

**Files:**
- Create: `src/pages/pizarra/useLineups.ts`

Single source of truth for the `lineups` store. One realtime subscription per season (`where("seasonId","==",seasonId)` — single equality filter, no composite index needed), split client-side into `official` and `mine`. CRUD + `markOfficial` with scope uniqueness (a `writeBatch` unmarks the previous official of the same scope). Backend chosen by the preview flag.

The **preview flag** matches `AuthContext`: `import.meta.env.DEV && new URLSearchParams(location.search).has("preview")`.

- [ ] **Step 1: Write the preview (localStorage) backend section**

Top of file — imports + types + the local store. The local store keeps an in-memory array synced to `localStorage["mp_pizarra_lineups"]`, with a subscriber callback for "realtime".

```ts
import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query,
  serverTimestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import type { Lineup } from "./formations";
import { dataToLineupDoc, lineupToData, type LineupDoc, type LineupMeta } from "./lineupDoc";

const PREVIEW =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");

const LOCAL_KEY = "mp_pizarra_lineups";

/** Scope for marking a board official: a match, or the whole season (null). */
export interface OfficialScope {
  matchId: string | null;
}

export interface UseLineups {
  official: LineupDoc[];
  mine: LineupDoc[];
  loading: boolean;
  /** Create a new owned board from the current lineup; returns the new id. */
  create: (lineup: Lineup, name: string) => Promise<string>;
  /** Overwrite an existing owned board (autosave / explicit). */
  save: (id: string, lineup: Lineup) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Admin: mark `id` official for `scope`, or pass null to unmark. */
  markOfficial: (id: string, scope: OfficialScope | null) => Promise<void>;
}

// ── Preview backend (localStorage; no real auth token under ?preview) ──
type LocalRecord = Record<string, unknown> & { id: string };

function localRead(): LocalRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalRecord[]) : [];
  } catch {
    return [];
  }
}
function localWrite(records: LocalRecord[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("mp-lineups-changed"));
}
function localId(): string {
  // Date.now()-free, collision-safe enough for a single preview tab.
  return "local-" + localRead().length + "-" + Math.floor(performance.now());
}
```

- [ ] **Step 2: Add the local CRUD + the hook's preview branch**

```ts
function makeLocalApi(ownerUid: string, ownerNickname: string, seasonId: string): UseLineups {
  const records = localRead();
  const docs = records.map((r) => dataToLineupDoc(r.id, r)).filter((d) => d.seasonId === seasonId);
  const now = Math.floor(performance.now());

  const create: UseLineups["create"] = async (lineup, name) => {
    const id = localId();
    const meta: LineupMeta = { ownerUid, ownerNickname, seasonId, name, isOfficial: false, matchId: null };
    const rec: LocalRecord = { id, ...lineupToData(lineup, meta), createdAt: now, updatedAt: now };
    localWrite([...localRead(), rec]);
    return id;
  };
  const save: UseLineups["save"] = async (id, lineup) => {
    const all = localRead();
    const i = all.findIndex((r) => r.id === id);
    if (i < 0) return;
    const prev = dataToLineupDoc(id, all[i]);
    const meta: LineupMeta = {
      ownerUid: prev.ownerUid, ownerNickname: prev.ownerNickname, seasonId: prev.seasonId,
      name: prev.name, isOfficial: prev.isOfficial, matchId: prev.matchId,
    };
    all[i] = { id, ...lineupToData(lineup, meta), createdAt: prev.createdAt ?? now, updatedAt: Math.floor(performance.now()) };
    localWrite(all);
  };
  const rename: UseLineups["rename"] = async (id, name) => {
    const all = localRead();
    const i = all.findIndex((r) => r.id === id);
    if (i >= 0) { all[i] = { ...all[i], name, updatedAt: Math.floor(performance.now()) }; localWrite(all); }
  };
  const remove: UseLineups["remove"] = async (id) => {
    localWrite(localRead().filter((r) => r.id !== id));
  };
  const markOfficial: UseLineups["markOfficial"] = async (id, scope) => {
    const all = localRead();
    if (scope) {
      all.forEach((r, i) => {
        const dd = dataToLineupDoc(r.id, r);
        if (dd.seasonId === seasonId && dd.isOfficial && dd.matchId === scope.matchId && r.id !== id) {
          all[i] = { ...r, isOfficial: false };
        }
      });
    }
    const i = all.findIndex((r) => r.id === id);
    if (i >= 0) all[i] = { ...all[i], isOfficial: !!scope, matchId: scope?.matchId ?? null, updatedAt: Math.floor(performance.now()) };
    localWrite(all);
  };

  return {
    official: docs.filter((d) => d.isOfficial),
    mine: docs.filter((d) => d.ownerUid === ownerUid),
    loading: false,
    create, save, rename, remove, markOfficial,
  };
}
```

- [ ] **Step 3: Add the Firestore backend + the exported hook**

```ts
export function useLineups(seasonId: string): UseLineups {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? "preview";
  const nickname = profile?.nickname ?? "preview";

  // Preview: localStorage backend, re-rendered on the custom change event.
  const [localTick, setLocalTick] = useState(0);
  useEffect(() => {
    if (!PREVIEW) return;
    const onChange = () => setLocalTick((t) => t + 1);
    window.addEventListener("mp-lineups-changed", onChange);
    return () => window.removeEventListener("mp-lineups-changed", onChange);
  }, []);

  // Firestore: one realtime subscription per season.
  const [docs, setDocs] = useState<{ seasonId: string; items: LineupDoc[] }>({ seasonId: "", items: [] });
  useEffect(() => {
    if (PREVIEW) return;
    const q = query(collection(db, "lineups"), where("seasonId", "==", seasonId));
    const unsub = onSnapshot(
      q,
      (snap) => setDocs({ seasonId, items: snap.docs.map((d) => dataToLineupDoc(d.id, d.data())) }),
      (err) => { console.error("Error cargando tableros:", err); setDocs({ seasonId, items: [] }); },
    );
    return () => unsub();
  }, [seasonId]);

  const localApi = useMemo(
    () => (PREVIEW ? makeLocalApi(uid, nickname, seasonId) : null),
    // localTick re-derives the snapshot after each local mutation.
    [uid, nickname, seasonId, localTick],
  );

  const firestoreApi = useMemo<UseLineups>(() => {
    const loaded = docs.seasonId === seasonId;
    const items = loaded ? docs.items : [];
    const create: UseLineups["create"] = async (lineup, name) => {
      const meta: LineupMeta = { ownerUid: uid, ownerNickname: nickname, seasonId, name, isOfficial: false, matchId: null };
      const ref = await addDoc(collection(db, "lineups"), {
        ...lineupToData(lineup, meta), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      return ref.id;
    };
    const save: UseLineups["save"] = async (id, lineup) => {
      const cur = items.find((d) => d.id === id);
      const meta: LineupMeta = {
        ownerUid: cur?.ownerUid ?? uid, ownerNickname: cur?.ownerNickname ?? nickname, seasonId,
        name: cur?.name ?? "Sin nombre", isOfficial: cur?.isOfficial ?? false, matchId: cur?.matchId ?? null,
      };
      await updateDoc(doc(db, "lineups", id), { ...lineupToData(lineup, meta), updatedAt: serverTimestamp() });
    };
    const rename: UseLineups["rename"] = async (id, name) =>
      void (await updateDoc(doc(db, "lineups", id), { name, updatedAt: serverTimestamp() }));
    const remove: UseLineups["remove"] = async (id) => void (await deleteDoc(doc(db, "lineups", id)));
    const markOfficial: UseLineups["markOfficial"] = async (id, scope) => {
      const batch = writeBatch(db);
      if (scope) {
        // Unmark the current official of the same scope (uniqueness).
        const prevSnap = await getDocs(query(
          collection(db, "lineups"),
          where("seasonId", "==", seasonId),
          where("isOfficial", "==", true),
        ));
        prevSnap.forEach((p) => {
          const m = (p.data().matchId as string | null) ?? null;
          if (p.id !== id && m === scope.matchId) batch.update(p.ref, { isOfficial: false, updatedAt: serverTimestamp() });
        });
        batch.update(doc(db, "lineups", id), { isOfficial: true, matchId: scope.matchId, updatedAt: serverTimestamp() });
      } else {
        batch.update(doc(db, "lineups", id), { isOfficial: false, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    };
    return { official: items.filter((d) => d.isOfficial), mine: items.filter((d) => d.ownerUid === uid), loading: !loaded, create, save, rename, remove, markOfficial };
  }, [docs, seasonId, uid, nickname]);

  return localApi ?? firestoreApi;
}
```

Note: the `markOfficial` Firestore read combines two equality filters (`seasonId` + `isOfficial`), which **does** need a composite index in prod (console gives a one-click link). Capture it in Task 9's rules/handoff. The preview backend needs no index.

- [ ] **Step 4: Build + lint**

Run: `npm run build` → pass. Run: `npm run lint` → 0 errors (watch the `localApi` dep array: `localTick` is intentionally included to re-derive; if the lint rule complains, keep it and add a one-line comment — it is correct, not a mistake).

- [ ] **Step 5: Commit**

```bash
git add src/pages/pizarra/useLineups.ts
git commit -m "feat(pizarra): useLineups data layer (Firestore + preview backend)"
```

---

### Task 4: `LineupsPanel.tsx` — the "Tableros" panel

**Files:**
- Create: `src/pages/pizarra/LineupsPanel.tsx`

Presentational + small local dialogs. All board state lives in `Pizarra`; the panel only renders lists and fires callbacks. Built with the Floodlit Clubhouse system (Anton title, flat-print, navy/sky surfaces, gold official seal, non-chromatic cues). Collapsible on mobile via a `open`/`onToggle` pair (controlled `<details>`-style header button).

- [ ] **Step 1: Define the props + save indicator**

```ts
import React, { useState } from "react";
import { ClipboardList, Crown, Plus, Save, Pencil, Trash2, Copy, ChevronDown } from "lucide-react";
import type { LineupDoc } from "./lineupDoc";
import { matchLabel, type SeasonMatch } from "./useSeasonMatches";

export type SaveState = "none" | "dirty" | "saving" | "saved";

interface LineupsPanelProps {
  official: LineupDoc[];
  mine: LineupDoc[];
  loading: boolean;
  activeBoardId: string | null;
  saveState: SaveState;
  isAdmin: boolean;
  seasonName: string;
  matches: SeasonMatch[];
  /** Load an owned board (editable). */
  onLoadMine: (id: string) => void;
  /** Load an official board (read-only). */
  onLoadOfficial: (id: string) => void;
  onNew: () => void;
  onSaveAs: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  /** Mark active board official for a scope, or null to unmark a given id. */
  onMarkOfficial: (id: string, scope: { matchId: string | null } | null) => void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  none: "Sin guardar",
  dirty: "Sin guardar",
  saving: "Guardando…",
  saved: "Guardado ✓",
};
```

- [ ] **Step 2: Implement the two dialogs (local components)**

A name prompt (for Guardar como / renombrar) and an official-scope picker (Temporada vs a match). Both branded modals, focus-trappable, Esc to close. Keep them in this file (cohesive with the panel).

```tsx
const NameDialog: React.FC<{ title: string; initial?: string; cta: string; onCancel: () => void; onSubmit: (name: string) => void }> = ({ title, initial = "", cta, onCancel, onSubmit }) => {
  const [value, setValue] = useState(initial);
  return (
    <div className="pz-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="pz-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3 className="pz-dialog-title">{title}</h3>
        <input
          className="pz-dialog-input" autoFocus value={value} maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); if (e.key === "Escape") onCancel(); }}
          placeholder="Nombre del tablero" aria-label="Nombre del tablero"
        />
        <div className="pz-dialog-actions">
          <button type="button" className="pz-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" className="pz-btn-solid" disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>{cta}</button>
        </div>
      </div>
    </div>
  );
};

const OfficialDialog: React.FC<{ seasonName: string; matches: SeasonMatch[]; onCancel: () => void; onConfirm: (scope: { matchId: string | null }) => void }> = ({ seasonName, matches, onCancel, onConfirm }) => {
  const [matchId, setMatchId] = useState<string>(""); // "" = whole season
  return (
    <div className="pz-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="pz-dialog" role="dialog" aria-modal="true" aria-label="Marcar como oficial" onClick={(e) => e.stopPropagation()}>
        <h3 className="pz-dialog-title">Marcar como oficial</h3>
        <p className="pz-dialog-sub">Elige el alcance de esta alineación oficial.</p>
        <label className="pz-dialog-field">
          <span>Alcance</span>
          <select className="pz-dialog-input" value={matchId} onChange={(e) => setMatchId(e.target.value)} aria-label="Alcance de la alineación oficial">
            <option value="">Toda la temporada · {seasonName}</option>
            {matches.map((m) => <option key={m.id} value={m.id}>{matchLabel(m)}</option>)}
          </select>
        </label>
        <div className="pz-dialog-actions">
          <button type="button" className="pz-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" className="pz-btn-solid" onClick={() => onConfirm({ matchId: matchId || null })}>Marcar oficial</button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Implement the panel body**

Header (title + collapse toggle + save indicator + Nuevo/Guardar como). "Oficial" subsection (gold-seal rows with scope label; admin gets a "Marcar oficial" button operating on the active board, plus "Quitar" per official row). "Mis tableros" subsection (rows with active highlight, date, cargar/renombrar/borrar). Use `Crown` for the official seal (non-chromatic glyph + gold). Date via `new Date(updatedAt).toLocaleDateString("es-ES", {day:"numeric",month:"short"})` guarded for `null`.

```tsx
export const LineupsPanel: React.FC<LineupsPanelProps> = (props) => {
  const { official, mine, loading, activeBoardId, saveState, isAdmin, seasonName, matches } = props;
  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState<null | { kind: "saveAs" } | { kind: "rename"; id: string; name: string } | { kind: "official" }>(null);

  const dateOf = (ms: number | null): string => (ms != null ? new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—");
  const scopeOf = (d: LineupDoc): string => {
    if (!d.matchId) return "Temporada";
    const m = matches.find((x) => x.id === d.matchId);
    return m ? matchLabel(m) : "Partido";
  };

  return (
    <section className="pz-boards" aria-label="Tableros guardados">
      <header className="pz-boards-head">
        <button type="button" className="pz-boards-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ClipboardList size={15} aria-hidden="true" />
          <span className="pz-boards-title">Tableros</span>
          <ChevronDown size={15} aria-hidden="true" className={`pz-boards-chev${open ? " is-open" : ""}`} />
        </button>
        <span className={`pz-save pz-save--${saveState}`} role="status">{SAVE_LABEL[saveState]}</span>
        <span className="pz-boards-actions">
          <button type="button" className="pz-btn-ghost" onClick={props.onNew}><Plus size={14} aria-hidden="true" />Nuevo</button>
          <button type="button" className="pz-btn-solid" onClick={() => setDialog({ kind: "saveAs" })}><Save size={14} aria-hidden="true" />Guardar como</button>
        </span>
      </header>

      {open && (
        <div className="pz-boards-body">
          {/* Oficial */}
          <div className="pz-boards-group">
            <div className="pz-boards-grouphead">
              <Crown size={13} aria-hidden="true" /><span>Oficial</span>
              {isAdmin && activeBoardId && (
                <button type="button" className="pz-btn-mini" onClick={() => setDialog({ kind: "official" })}>Marcar oficial</button>
              )}
            </div>
            {official.length === 0 ? (
              <p className="pz-boards-empty">Sin alineación oficial todavía.</p>
            ) : (
              <ul className="pz-boards-list">
                {official.map((d) => (
                  <li key={d.id} className={`pz-board-row is-official${d.id === activeBoardId ? " is-active" : ""}`}>
                    <button type="button" className="pz-board-load" onClick={() => props.onLoadOfficial(d.id)}>
                      <span className="pz-board-seal" aria-hidden="true"><Crown size={12} /></span>
                      <span className="pz-board-name">{d.name}</span>
                      <span className="pz-board-scope">{scopeOf(d)}</span>
                    </button>
                    {isAdmin && (
                      <button type="button" className="pz-board-act" aria-label={`Quitar oficial: ${d.name}`} onClick={() => props.onMarkOfficial(d.id, null)}>Quitar</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mis tableros */}
          <div className="pz-boards-group">
            <div className="pz-boards-grouphead"><span>Mis tableros</span><span className="pz-boards-season">{seasonName}</span></div>
            {loading ? (
              <p className="pz-boards-empty">Cargando tableros…</p>
            ) : mine.length === 0 ? (
              <p className="pz-boards-empty">Aún no has guardado tableros. Usa “Guardar como”.</p>
            ) : (
              <ul className="pz-boards-list">
                {mine.map((d) => (
                  <li key={d.id} className={`pz-board-row${d.id === activeBoardId ? " is-active" : ""}`}>
                    <button type="button" className="pz-board-load" onClick={() => props.onLoadMine(d.id)}>
                      <span className="pz-board-name">{d.name}</span>
                      {d.isOfficial && <span className="pz-board-tag" aria-label="Oficial"><Crown size={11} aria-hidden="true" /></span>}
                      <span className="pz-board-date">{dateOf(d.updatedAt)}</span>
                    </button>
                    <span className="pz-board-rowacts">
                      <button type="button" className="pz-board-act" aria-label={`Renombrar ${d.name}`} onClick={() => setDialog({ kind: "rename", id: d.id, name: d.name })}><Pencil size={13} /></button>
                      <button type="button" className="pz-board-act" aria-label={`Duplicar ${d.name}`} onClick={() => props.onSaveAs(`Copia de ${d.name}`)}><Copy size={13} /></button>
                      <button type="button" className="pz-board-act pz-board-act--danger" aria-label={`Borrar ${d.name}`} onClick={() => props.onRemove(d.id)}><Trash2 size={13} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {dialog?.kind === "saveAs" && (
        <NameDialog title="Guardar tablero" cta="Guardar" onCancel={() => setDialog(null)} onSubmit={(name) => { setDialog(null); props.onSaveAs(name); }} />
      )}
      {dialog?.kind === "rename" && (
        <NameDialog title="Renombrar tablero" initial={dialog.name} cta="Renombrar" onCancel={() => setDialog(null)} onSubmit={(name) => { setDialog(null); props.onRename(dialog.id, name); }} />
      )}
      {dialog?.kind === "official" && activeBoardId && (
        <OfficialDialog seasonName={seasonName} matches={matches} onCancel={() => setDialog(null)} onConfirm={(scope) => { setDialog(null); props.onMarkOfficial(activeBoardId, scope); }} />
      )}
    </section>
  );
};
```

- [ ] **Step 4: Build + lint**

Run: `npm run build` → pass. Run: `npm run lint` → 0 errors. (Styles come in Task 8; the panel may look unstyled until then — that's expected.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/pizarra/LineupsPanel.tsx
git commit -m "feat(pizarra): Tableros panel (official + personal lists, dialogs)"
```

---

### Task 5: Wire board identity + autosave into `Pizarra.tsx`

**Files:**
- Modify: `src/pages/pizarra/Pizarra.tsx`

Add board identity state and handlers, integrate `useLineups`, mark dirty in `commit`/`undo`/`redo`, autosave with a 1s debounce, gate mutations when read-only, and render the panel + read-only banner.

- [ ] **Step 1: Imports + hook wiring (top of component)**

Add imports near the existing ones:
```ts
import { useLineups, type OfficialScope } from "./useLineups";
import { useSeasonMatches } from "./useSeasonMatches";
import { LineupsPanel, type SaveState } from "./LineupsPanel";
import { extractLineup } from "./lineupDoc";
```
Inside the component, after `const { players, loading } = usePizarraPlayers();`:
```ts
  const lineups = useLineups(selectedSeasonId);
  const { matches } = useSeasonMatches(selectedSeasonId);
```

- [ ] **Step 2: Board identity state**

Add alongside the other `useState` calls:
```ts
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [readOnlyInfo, setReadOnlyInfo] = useState<{ official: boolean; nickname: string; scope: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("none");
```

- [ ] **Step 3: Mark dirty on every board mutation**

Change `commit`, `undo`, `redo` so a persisted, editable, owned board becomes dirty. Add a helper:
```ts
  const markDirty = (): void => {
    if (activeBoardId && !readOnly) setSaveState("dirty");
  };
```
In `commit(next)` add `markDirty();` after `setLineup(next);`.
In `undo()` and `redo()` add `markDirty();` after their `setLineup(...)` calls.

- [ ] **Step 4: Autosave effect (1s debounce)**

Add after the keyboard effects:
```ts
  // Autosave the active owned board ~1s after the last edit. The debounce timer
  // resets on every lineup change, so rapid edits coalesce into one write.
  useEffect(() => {
    if (saveState !== "dirty" || !activeBoardId || readOnly) return;
    const t = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await lineups.save(activeBoardId, lineup);
        setSaveState("saved");
      } catch (err) {
        console.error("No se pudo guardar el tablero", err);
        setSaveState("dirty");
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [saveState, lineup, activeBoardId, readOnly, lineups]);
```

- [ ] **Step 5: Reset board identity on season change**

Extend the season reset. Add an effect keyed on `selectedSeasonId`:
```ts
  // A board belongs to one season; leaving the season detaches the active board.
  useEffect(() => {
    setActiveBoardId(null);
    setReadOnly(false);
    setReadOnlyInfo(null);
    setSaveState("none");
  }, [selectedSeasonId]);
```

- [ ] **Step 6: Board handlers**

Add these handlers (place them near the other mutating handlers):
```ts
  const loadDoc = (id: string, asReadOnly: boolean): void => {
    const all = asReadOnly ? lineups.official : lineups.mine;
    const d = all.find((x) => x.id === id) ?? lineups.mine.find((x) => x.id === id) ?? lineups.official.find((x) => x.id === id);
    if (!d) return;
    setLineup(extractLineup(d));
    setPast([]); setFuture([]); setPicked(null);
    setActiveBoardId(id);
    setReadOnly(asReadOnly);
    setReadOnlyInfo(asReadOnly ? { official: d.isOfficial, nickname: d.ownerNickname, scope: d.matchId ? "partido" : "temporada" } : null);
    setSaveState(asReadOnly ? "none" : "saved");
  };
  const newBoard = (): void => {
    withMorph(() => setLineup(seedLineup(lineup.formation, players)));
    setPast([]); setFuture([]); setPicked(null);
    setActiveBoardId(null); setReadOnly(false); setReadOnlyInfo(null); setSaveState("none");
  };
  const saveAs = async (name: string): Promise<void> => {
    try {
      const id = await lineups.create(lineup, name);
      setActiveBoardId(id); setReadOnly(false); setReadOnlyInfo(null); setSaveState("saved");
    } catch (err) { console.error("No se pudo crear el tablero", err); }
  };
  const renameBoard = async (id: string, name: string): Promise<void> => {
    try { await lineups.rename(id, name); } catch (err) { console.error("No se pudo renombrar", err); }
  };
  const removeBoard = async (id: string): Promise<void> => {
    try {
      await lineups.remove(id);
      if (id === activeBoardId) { setActiveBoardId(null); setSaveState("none"); }
    } catch (err) { console.error("No se pudo borrar", err); }
  };
  const markOfficial = async (id: string, scope: OfficialScope | null): Promise<void> => {
    if (!isAdmin) return;
    try { await lineups.markOfficial(id, scope); } catch (err) { console.error("No se pudo marcar oficial", err); }
  };
  const duplicateForEdit = (): void => {
    const base = readOnlyInfo?.official ? "Oficial" : "Tablero";
    void saveAs(`Copia de ${base}`);
  };
```

- [ ] **Step 7: Build + lint (handlers compile before UI wiring)**

Run: `npm run build` → pass (some handlers may be reported unused until Step 8 wires them — if `tsc`/eslint flags unused, proceed directly to Step 8 in the same commit so they become used).

---

### Task 6: Read-only gating + render panel & banner in `Pizarra.tsx`

**Files:**
- Modify: `src/pages/pizarra/Pizarra.tsx`

- [ ] **Step 1: Gate the mutating handlers when read-only**

Add an early return guard to the user-driven mutators so a read-only board can't be changed. At the top of each of `changeFormation`, `toggleFreeMode`, `setTactic`, `resetBoard`, `setOverride`, `togglePin`, `autoXI`, `setRole`, and the tap handlers `activateToken`, `activateSlot`, `activateBench`, add:
```ts
    if (readOnly) return;
```
(Undo/redo/settings/present remain available; they don't mutate a read-only board because `commit` won't be reached.)

- [ ] **Step 2: Disable drag end when read-only**

At the top of `handleDragEnd`, add `if (readOnly) return;`.

- [ ] **Step 3: Render the panel above the board**

Immediately after the `<PizarraControls .../>` element (and before `<div className="pz-status">`), insert:
```tsx
        <LineupsPanel
          official={lineups.official}
          mine={lineups.mine}
          loading={lineups.loading}
          activeBoardId={activeBoardId}
          saveState={saveState}
          isAdmin={isAdmin}
          seasonName={seasonName}
          matches={matches}
          onLoadMine={(id) => loadDoc(id, false)}
          onLoadOfficial={(id) => loadDoc(id, true)}
          onNew={newBoard}
          onSaveAs={(name) => void saveAs(name)}
          onRename={(id, name) => void renameBoard(id, name)}
          onRemove={(id) => void removeBoard(id)}
          onMarkOfficial={(id, scope) => void markOfficial(id, scope)}
        />
```

- [ ] **Step 4: Read-only banner**

Right after the panel (before `pz-status`), insert:
```tsx
        {readOnly && readOnlyInfo && (
          <div className="pz-readonly" role="status">
            <span className="pz-readonly-text">
              Solo lectura · {readOnlyInfo.official ? `Oficial (${readOnlyInfo.scope})` : `Tablero de @${readOnlyInfo.nickname}`}
            </span>
            <button type="button" className="pz-btn-solid" onClick={duplicateForEdit}>
              <Copy size={14} aria-hidden="true" /> Duplicar para editar
            </button>
          </div>
        )}
```
Add `Copy` to the existing `lucide-react` import in `Pizarra.tsx`.

- [ ] **Step 5: Pass `readOnly`/`disabled` down**

- `<PizarraControls ... readOnly={readOnly} />` (prop added in Task 7).
- Each `<PlayerToken ... disabled={readOnly} />` (both the pitch and bench instances).
- Each `<PitchSlot ... disabled={readOnly} />`.
- Disable the bench search/zone controls and "Sentar aquí" while read-only (wrap the `picked && (...)` bench-drop in `!readOnly && picked && (...)`), and disable the galones/positions `<select>`/buttons with `disabled={readOnly}`.
- Add `${readOnly ? " pz--readonly" : ""}` to the root `pz` className for dimming.

- [ ] **Step 6: Build + lint**

Run: `npm run build` → pass. Run: `npm run lint` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): board identity, autosave, official + read-only wiring"
```

---

### Task 7: Thread `readOnly`/`disabled` through controls, token, slot

**Files:**
- Modify: `src/pages/pizarra/PizarraControls.tsx`
- Modify: `src/pages/pizarra/PlayerToken.tsx`
- Modify: `src/pages/pizarra/PitchSlot.tsx`

- [ ] **Step 1: `PizarraControls` — add `readOnly`**

Add `readOnly?: boolean` to its props interface. When `readOnly`, set `disabled` on the formation `<select>`, the tactics `<select>`s, and the free/auto/reset buttons. Leave undo/redo, settings, and present enabled. (Read the file first; apply `disabled={readOnly}` to the relevant controls only.)

- [ ] **Step 2: `PlayerToken` — add `disabled`**

Add `disabled?: boolean` to `PlayerTokenProps`. Change the draggable call to:
```ts
  const { ref, isDragging } = useDraggable({ id: player.id, data, disabled });
```
(If Task 0 found `disabled` unsupported by `useDraggable`, instead skip wiring `ref` when `disabled` — `const drag = useDraggable({ id: player.id, data }); const ref = disabled ? undefined : drag.ref;` — and rely on the button guard below.)
On the `<button>`: set `onClick={disabled ? undefined : onActivate}` and `aria-disabled={disabled || undefined}` and add `disabled ? "is-readonly" : ""` to the className list. Do **not** set the native `disabled` attribute (keep it focusable for screen-reader inspection); the no-op onClick is enough.

- [ ] **Step 3: `PitchSlot` — add `disabled`**

Add `disabled?: boolean` to `PitchSlotProps`. Change the droppable call to `useDroppable({ id: slot.slotId, data, disabled })` (or the unsupported-fallback as above). For the empty-slot `<button>`, set `onClick={disabled ? undefined : onActivate}` and `aria-disabled`.

- [ ] **Step 4: Build + lint**

Run: `npm run build` → pass. Run: `npm run lint` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/pizarra/PizarraControls.tsx src/pages/pizarra/PlayerToken.tsx src/pages/pizarra/PitchSlot.tsx
git commit -m "feat(pizarra): read-only disable for controls, tokens, slots"
```

---

### Task 8: Styles — `Pizarra.css`

**Files:**
- Modify: `src/pages/pizarra/Pizarra.css`

Add styles for: `pz-boards` panel + header/toggle + collapse, `pz-save` indicator (3 states with non-chromatic cue, not color-only), `pz-boards-list`/`pz-board-row` (active highlight, official seal, scope/date), `pz-btn-solid`/`pz-btn-ghost`/`pz-btn-mini`/`pz-board-act`, `pz-dialog*` (backdrop + modal, centered, max-width, focus ring), `pz-readonly` banner, and `pz--readonly` dimming of the board. Two themes via existing `--mp-*` tokens. Mobile (`max-width: 899px`): panel body collapsible, lists single-column, dialogs full-width sheet. Reduced-motion: no transitions on collapse/dialog.

- [ ] **Step 1: Read the current `Pizarra.css`**

Read the file to reuse existing tokens, the gold seal pattern (`pz-role-seal`), button patterns, and the mobile breakpoint, so new styles match. Follow `/impeccable` (flat-print, no glassmorphism/gradient-text, gold focus rings, WCAG AA contrast).

- [ ] **Step 2: Append the new style blocks**

Author the CSS for every class introduced in Tasks 4–6, matching the existing visual language. Key requirements:
- `pz-save--saved` uses a check glyph + sky/gold, `--dirty`/`--none` a muted dot, `--saving` an animated ellipsis — never color as the only signal (glyph + text label already present).
- Official seal: gold disc with `Crown`, same flat treatment as `pz-role-seal`.
- `pz-readonly` banner: navy band, gold left accent **avoided** (no side-stripe ban) — use a full border + gold seal chip instead.
- Dialog: `position: fixed` backdrop (escapes overflow), centered card, ≤ 420px, gold focus rings, body scroll lock not required.
- Active board row: solid sky left indicator is banned (side-stripe) — use a sky background tint + bold name instead.

- [ ] **Step 3: Build + lint**

Run: `npm run build` → pass. Run: `npm run lint` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/pizarra/Pizarra.css
git commit -m "style(pizarra): Tableros panel, save indicator, read-only banner, dialogs"
```

---

### Task 9: Verify, deliver rules, review pause

**Files:** none (verification + handoff).

- [ ] **Step 1: Build + lint, read the real output**

Run: `npm run build` → must pass. Run: `npm run lint` → 0 errors (2 known exhaustive-deps warnings allowed). Paste the real output.

- [ ] **Step 2: Browser verification matrix (preview backend)**

Start the dev server, open `?preview` on `#plantilla`, switch to Pizarra. Using preview tools, verify:
- **Guardar como** → board appears in "Mis tableros", becomes active, indicator → "Guardado ✓".
- Edit (drag/tap/formation) → indicator → "Sin guardar" → after ~1s "Guardando…" → "Guardado ✓".
- **Reload the page** → reopen the board from "Mis tableros" → state restored.
- **Renombrar**, **Duplicar** (Copia de…), **Borrar** (active board borrado → returns to unsaved seed).
- **Nuevo** → fresh seeded board, indicator "Sin guardar".
- Admin (preview mocks admin): **Marcar oficial** → choose "Toda la temporada" → board shows gold seal in "Oficial"; choose a match (if any) → per-match official; marking a second official of the same scope unmarks the first.
- **Cargar oficial** → board enters read-only: drag/tap/controls/roles/positions disabled, banner shows "Solo lectura · Oficial (temporada/partido)", **Duplicar para editar** clones to an editable owned board.
- **Claro/oscuro**, **móvil/escritorio** (panel collapses on mobile), **reduced-motion**.
- Console clean (no errors/warnings beyond known ones).

Fix any issue by editing source and re-checking. Capture screenshots: panel with boards, official read-only banner, marking dialog, mobile collapsed.

- [ ] **Step 3: Deliver the Firestore rules text**

Output (for the user to paste in Firebase console → Firestore → Rules, **merging** without deleting existing rules), including the helper and both the players rule (still pending from #1) and the new `lineups` rule:
```
function isAdmin() {
  return request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','superadmin'];
}

match /players/{playerId} {
  allow read: if request.auth != null;
  allow update: if isAdmin();
}

match /lineups/{id} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.ownerUid == request.auth.uid
    && (request.resource.data.isOfficial == false || isAdmin());
  allow update: if request.auth != null && (
       (resource.data.ownerUid == request.auth.uid
         && (request.resource.data.isOfficial == resource.data.isOfficial || isAdmin()))
       || isAdmin());
  allow delete: if request.auth != null
    && (resource.data.ownerUid == request.auth.uid || isAdmin());
}
```
Also note: the `markOfficial` query (`seasonId == … AND isOfficial == true`) and the `useSeasonMatches` query (`seasonId == … ORDER BY date desc`) each need a **composite index** in prod — the console shows a one-click creation link on first run. There is no `firestore.rules`/`firestore.indexes.json` in the repo (rules live in the console), so these are delivered as text, not committed.

- [ ] **Step 4: Update the memory file**

Update `pizarra-feature.md` (and `MEMORY.md` if the hook line changes): mark Sub-proyecto 1 as built (files, dual backend, pending console rules + indexes), so a future session knows persistence shipped.

- [ ] **Step 5: Pause for review**

Do **not** merge to `main`. Summarize what shipped, paste build/lint output + screenshots, hand over the Firestore rules + index note, and ask the user to review before merging (mirrors the per-phase review pause).

---

## Self-Review

**Spec coverage (issue #2 → Sub-proyecto 1):**
- `lineups` model 1:1 + metadata → Task 1 (`LineupDoc extends Lineup, LineupMeta`). ✓
- `useLineups(seasonId)` realtime, split official/mine, `save/create/rename/remove/markOfficial` → Task 3. ✓
- Hybrid save (autosave debounce + indicator, Guardar como, Nuevo, undo/redo in memory) → Tasks 4–5 (`saveState`, autosave effect, `saveAs`, `newBoard`). ✓
- "Tableros" panel (official + mine, collapsible mobile, actions) → Task 4 + Task 8 mobile. ✓
- Official per season AND per match, uniqueness via batch → Task 3 `markOfficial` + Task 4 `OfficialDialog`. ✓
- Read-only (disable drag/tap/controls/roles/positions, banner, Duplicar para editar) → Tasks 5–8. ✓
- Firestore rules text delivered (no repo rules file) → Task 9 Step 3. ✓
- DoD: build+lint read, browser matrix (light/dark, mobile/desktop, reduced-motion), screenshots, rules text, review pause → Task 9. ✓

**Placeholder scan:** No "TODO"/"TBD"; each code step shows real code; UI craft for CSS (Task 8) is specified by class + requirement + design rules rather than every line, because `/impeccable` governs final pixels against live screenshots — acceptable, not a placeholder.

**Type consistency:** `LineupDoc`, `LineupMeta`, `OfficialScope`, `SaveState`, `SeasonMatch` are defined once and reused with the same names/shapes across tasks. `lineupToData`/`dataToLineupDoc`/`extractLineup` signatures match their call sites. `markOfficial(id, scope|null)` and `loadDoc(id, asReadOnly)` are consistent panel↔board. `useDraggable({…, disabled})` has a documented fallback (Task 0 / Task 7) if the option is absent.

**Deviation flagged:** preview uses a localStorage backend (issue's sanctioned alternative) because `?preview` has no real Firebase auth token — stated in the header and Task 3.
