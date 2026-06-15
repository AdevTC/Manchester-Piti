import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { DragDropProvider, useDroppable, type DragEndEvent } from "@dnd-kit/react";
import { Users, Search, X, Copy } from "lucide-react";
import { FloodlightCanvas } from "../../components/FloodlightCanvas";
import { useSeason } from "../../context/SeasonContext";
import { useAuth } from "../../context/AuthContext";
import { usePizarraPlayers, setNaturalPosition, setInjured, type PizarraPlayer } from "./usePizarraPlayers";
import { usePizarraSettings } from "./usePizarraSettings";
import { PlayerToken } from "./PlayerToken";
import { PitchSlot, type SlotData } from "./PitchSlot";
import { PizarraControls } from "./PizarraControls";
import { PizarraSettingsPanel } from "./PizarraSettings";
import {
  applyFormation,
  emptySlots,
  ROLE_META,
  ZONE_LABEL,
  ZONES,
  type FormationName,
  type Lineup,
  type RoleKey,
  type RoleMeta,
  type SlotState,
  type Zone,
} from "./formations";
import { defaultTactics, type TacticKey } from "./tactics";
import { useLineups, type OfficialScope } from "./useLineups";
import { useSeasonMatches } from "./useSeasonMatches";
import { LineupsPanel, type SaveState } from "./LineupsPanel";
import { extractLineup } from "./lineupDoc";
import { usePizarraStats } from "./usePizarraStats";
import { teamRating, lineStats, type PlacedPlayer } from "./chemistry";
import { ChemistryPanel } from "./ChemistryPanel";
import { EMPTY_STATS } from "../../lib/playerStats";
import "./Pizarra.css";

const DEFAULT_FORMATION: FormationName = "2-3-1";
const XI = 7;

const prefersReduced = (): boolean =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

type Location = { type: "slot"; index: number } | { type: "bench" } | null;

function locationOf(lineup: Lineup, id: string): Location {
  const slotIndex = lineup.slots.findIndex((s) => s.playerId === id);
  if (slotIndex >= 0) return { type: "slot", index: slotIndex };
  if (lineup.bench.includes(id)) return { type: "bench" };
  return null;
}

// Seed a fresh lineup from the squad: first XI by dorsal go to the slots in
// order, the rest to the bench. Tactics/positions/pins reset.
function seedLineup(formation: FormationName, players: PizarraPlayer[]): Lineup {
  const slots = emptySlots(formation);
  players.slice(0, XI).forEach((p, i) => {
    slots[i].playerId = p.id;
  });
  return {
    formation,
    freeMode: false,
    slots,
    bench: players.slice(XI).map((p) => p.id),
    roles: {},
    tactics: defaultTactics(),
    playerPositions: {},
    pinned: [],
  };
}

// Move `id` into slot `index`. If the slot is taken, the displaced player goes
// to `id`'s previous location (a clean swap); a bench arrival just frees a seat.
function placeIntoSlot(lineup: Lineup, id: string, index: number): Lineup {
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

function sendToBench(lineup: Lineup, id: string): Lineup {
  const from = locationOf(lineup, id);
  if (from?.type !== "slot") return lineup;
  const slots = lineup.slots.map((s) => ({ ...s }));
  slots[from.index].playerId = null;
  const bench = lineup.bench.includes(id) ? lineup.bench : [...lineup.bench, id];
  return { ...lineup, slots, bench };
}

function swapPlayers(lineup: Lineup, a: string, b: string): Lineup {
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

export const Pizarra: React.FC = () => {
  const { selectedSeasonId, seasons } = useSeason();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const { players, loading } = usePizarraPlayers();
  const { settings, set: setSetting } = usePizarraSettings();
  const lineups = useLineups(selectedSeasonId);
  const { matches } = useSeasonMatches(selectedSeasonId);
  const statsArg = useMemo(() => players.map((p) => ({ id: p.id, seasonsCount: p.seasonsCount })), [players]);
  const { statsById, norms, form, suspended } = usePizarraStats(selectedSeasonId, statsArg);

  const [lineup, setLineup] = useState<Lineup>(() => seedLineup(DEFAULT_FORMATION, []));
  const [picked, setPicked] = useState<string | null>(null);
  const [past, setPast] = useState<Lineup[]>([]);
  const [future, setFuture] = useState<Lineup[]>([]);
  const [presentMode, setPresentMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [benchQuery, setBenchQuery] = useState("");
  const [benchZone, setBenchZone] = useState<Zone | "all">("all");

  // Board identity (persistence). A board can be unsaved (id null), owned
  // (editable, autosaved) or loaded read-only (official / someone else's).
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [readOnlyInfo, setReadOnlyInfo] = useState<{ official: boolean; nickname: string; scope: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("none");

  const pitchElRef = useRef<HTMLDivElement | null>(null);
  const seededSig = useRef<string>("");

  const { ref: setBenchRef, isDropTarget: benchOver } = useDroppable({ id: "pz-bench", data: { kind: "bench" } });
  const { ref: setPitchDropRef, isDropTarget: pitchOver } = useDroppable({ id: "pz-pitch", data: { kind: "pitch" } });

  const playersById = useMemo(() => {
    const m = new Map<string, PizarraPlayer>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  // Re-seed only when the roster composition changes (season switch / first
  // load). A re-seed produces a fresh default board, so it also detaches any
  // active saved board (prevents autosave from overwriting it with the seed).
  const rosterSig = useMemo(() => players.map((p) => p.id).join(","), [players]);
  useEffect(() => {
    if (rosterSig === seededSig.current) return;
    seededSig.current = rosterSig;
    setLineup((prev) => seedLineup(prev.formation, players));
    setPicked(null);
    setPast([]);
    setFuture([]);
    setActiveBoardId(null);
    setReadOnly(false);
    setReadOnlyInfo(null);
    setSaveState("none");
  }, [rosterSig, players]);

  // ── History (undo/redo). Every board mutation goes through commit(). ──
  // A persisted, editable board becomes "dirty" on any change (autosaved).
  const markDirty = (): void => {
    if (activeBoardId && !readOnly) setSaveState("dirty");
  };
  const commit = (next: Lineup): void => {
    setPast((p) => [...p.slice(-29), lineup]);
    setFuture([]);
    setLineup(next);
    markDirty();
  };
  const undo = (): void => {
    if (past.length === 0) return;
    setFuture((f) => [lineup, ...f]);
    setLineup(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setPicked(null);
    markDirty();
  };
  const redo = (): void => {
    if (future.length === 0) return;
    setPast((p) => [...p, lineup]);
    setLineup(future[0]);
    setFuture(future.slice(1));
    setPicked(null);
    markDirty();
  };

  // Keyboard: Ctrl/Cmd+Z undo, +Shift or +Y redo, Esc exits presentation.
  const apiRef = useRef<{ undo: () => void; redo: () => void; exitPresent: () => void }>({
    undo: () => {},
    redo: () => {},
    exitPresent: () => {},
  });
  // Keep the ref pointing at the latest closures (written in an effect, not
  // during render, so it doesn't trip the refs-in-render lint rule).
  useEffect(() => {
    apiRef.current = { undo, redo, exitPresent: () => setPresentMode(false) };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
      if (e.key === "Escape") {
        apiRef.current.exitPresent();
        return;
      }
      if (inField) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) apiRef.current.redo();
        else apiRef.current.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        apiRef.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Autosave the active owned board ~1s after the last edit. The debounce timer
  // resets on every lineup change, so rapid edits coalesce into one write. The
  // functional "saving"→"saved" guard avoids clobbering a fresh edit that
  // arrived while a write was in flight.
  useEffect(() => {
    if (saveState !== "dirty" || !activeBoardId || readOnly) return;
    const t = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await lineups.save(activeBoardId, lineup);
        setSaveState((s) => (s === "saving" ? "saved" : s));
      } catch (err) {
        console.error("No se pudo guardar el tablero", err);
        setSaveState((s) => (s === "saving" ? "dirty" : s));
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [saveState, lineup, activeBoardId, readOnly, lineups]);

  const setPitchRef = (el: HTMLElement | null): void => {
    pitchElRef.current = el as HTMLDivElement | null;
    setPitchDropRef(el);
  };

  const withMorph = (apply: () => void): void => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (doc.startViewTransition && !prefersReduced()) doc.startViewTransition(() => flushSync(apply));
    else apply();
  };

  // ── Effective zone / out-of-position ──
  const effectiveZone = (id: string): Zone | undefined =>
    lineup.playerPositions[id] ?? playersById.get(id)?.naturalPosition;
  const isOutOfPosition = (slot: SlotState): boolean => {
    if (!slot.playerId) return false;
    const z = effectiveZone(slot.playerId);
    return !!z && z !== slot.zone;
  };

  // ── Chemistry / rating (deterministic, from real stats) ──
  const placed = useMemo<PlacedPlayer[]>(
    () =>
      lineup.slots
        .filter((s) => s.playerId)
        .map((s) => {
          const id = s.playerId as string;
          const z = lineup.playerPositions[id] ?? playersById.get(id)?.naturalPosition;
          return {
            id,
            s: statsById.get(id) ?? EMPTY_STATS,
            seasons: playersById.get(id)?.seasonsCount ?? 0,
            zone: s.zone,
            outOfPosition: !!z && z !== s.zone,
          };
        }),
    [lineup, statsById, playersById],
  );
  const rating = useMemo(() => teamRating(placed, XI - placed.length, norms), [placed, norms]);
  const lines = useMemo(() => lineStats(placed), [placed]);
  const isUnavailable = (id: string): boolean => suspended.has(id) || (playersById.get(id)?.injured ?? false);
  const unavailableInXI = placed.filter((p) => isUnavailable(p.id)).length;

  // ── Mutating handlers (all via commit; no-op when read-only) ──
  const changeFormation = (name: FormationName): void => {
    if (readOnly) return;
    withMorph(() => commit({ ...lineup, formation: name, freeMode: false, slots: applyFormation(lineup.slots, name) }));
  };
  const toggleFreeMode = (): void => {
    if (readOnly) return;
    commit({ ...lineup, freeMode: !lineup.freeMode });
  };
  const setTactic = (key: TacticKey, value: string): void => {
    if (readOnly) return;
    commit({ ...lineup, tactics: { ...lineup.tactics, [key]: value } });
  };
  const resetBoard = (): void => {
    if (readOnly) return;
    withMorph(() => commit(seedLineup(lineup.formation, players)));
    setPicked(null);
  };

  const setOverride = (id: string, zone: Zone | null): void => {
    if (readOnly) return;
    const pp = { ...lineup.playerPositions };
    if (zone) pp[id] = zone;
    else delete pp[id];
    commit({ ...lineup, playerPositions: pp });
  };
  const togglePin = (id: string): void => {
    if (readOnly) return;
    const pinned = lineup.pinned.includes(id) ? lineup.pinned.filter((x) => x !== id) : [...lineup.pinned, id];
    commit({ ...lineup, pinned });
  };

  // ── Board persistence handlers ──
  const loadDoc = (id: string, asReadOnly: boolean): void => {
    const d =
      (asReadOnly ? lineups.official.find((x) => x.id === id) : lineups.mine.find((x) => x.id === id)) ??
      lineups.mine.find((x) => x.id === id) ??
      lineups.official.find((x) => x.id === id);
    if (!d) return;
    setLineup(extractLineup(d));
    setPast([]);
    setFuture([]);
    setPicked(null);
    setActiveBoardId(id);
    setReadOnly(asReadOnly);
    setReadOnlyInfo(
      asReadOnly ? { official: d.isOfficial, nickname: d.ownerNickname, scope: d.matchId ? "partido" : "temporada" } : null,
    );
    setSaveState(asReadOnly ? "none" : "saved");
  };
  const newBoard = (): void => {
    withMorph(() => setLineup(seedLineup(lineup.formation, players)));
    setPast([]);
    setFuture([]);
    setPicked(null);
    setActiveBoardId(null);
    setReadOnly(false);
    setReadOnlyInfo(null);
    setSaveState("none");
  };
  const saveAs = async (name: string): Promise<void> => {
    try {
      const id = await lineups.create(lineup, name);
      setActiveBoardId(id);
      setReadOnly(false);
      setReadOnlyInfo(null);
      setSaveState("saved");
    } catch (err) {
      console.error("No se pudo crear el tablero", err);
    }
  };
  const renameBoard = async (id: string, name: string): Promise<void> => {
    try {
      await lineups.rename(id, name);
    } catch (err) {
      console.error("No se pudo renombrar el tablero", err);
    }
  };
  const removeBoard = async (id: string): Promise<void> => {
    try {
      await lineups.remove(id);
      if (id === activeBoardId) {
        setActiveBoardId(null);
        setReadOnly(false);
        setReadOnlyInfo(null);
        setSaveState("none");
      }
    } catch (err) {
      console.error("No se pudo borrar el tablero", err);
    }
  };
  const markOfficial = async (id: string, scope: OfficialScope | null): Promise<void> => {
    if (!isAdmin) return;
    try {
      await lineups.markOfficial(id, scope);
    } catch (err) {
      console.error("No se pudo marcar como oficial", err);
    }
  };
  const duplicateForEdit = (): void => {
    void saveAs(`Copia de ${readOnlyInfo?.official ? "Oficial" : "Tablero"}`);
  };
  const saveNatural = async (id: string, zone: Zone | null): Promise<void> => {
    if (!isAdmin) return;
    try {
      await setNaturalPosition(id, zone);
    } catch (err) {
      console.error("No se pudo guardar la posición natural", err);
    }
  };

  // Auto-XI: fill the current system by matching effective zone to slot zone,
  // keeping pinned players in place; the rest of the squad to the bench.
  const autoXI = (): void => {
    if (readOnly) return;
    const pinnedInSlot = new Map<number, string>();
    lineup.slots.forEach((s, i) => {
      if (s.playerId && lineup.pinned.includes(s.playerId)) pinnedInSlot.set(i, s.playerId);
    });
    const taken = new Set(pinnedInSlot.values());
    const pool = players.map((p) => p.id).filter((id) => !taken.has(id));
    const slots = emptySlots(lineup.formation);
    pinnedInSlot.forEach((id, i) => {
      slots[i].playerId = id;
    });
    const zoneOf = (id: string): Zone | undefined => lineup.playerPositions[id] ?? playersById.get(id)?.naturalPosition;
    slots.forEach((s) => {
      if (s.playerId) return;
      const idx = pool.findIndex((id) => zoneOf(id) === s.zone);
      if (idx >= 0) s.playerId = pool.splice(idx, 1)[0];
    });
    slots.forEach((s) => {
      if (!s.playerId && pool.length) s.playerId = pool.shift() as string;
    });
    withMorph(() => commit({ ...lineup, slots, bench: pool }));
  };

  // Like Auto-XI but ranked by recent form (performance, not just position),
  // keeping pinned players in place.
  const suggestByForm = (): void => {
    if (readOnly) return;
    const pinnedInSlot = new Map<number, string>();
    lineup.slots.forEach((s, i) => {
      if (s.playerId && lineup.pinned.includes(s.playerId)) pinnedInSlot.set(i, s.playerId);
    });
    const taken = new Set(pinnedInSlot.values());
    const pool = [...players]
      .filter((p) => !taken.has(p.id))
      .sort((a, b) => (form.get(b.id) ?? 0) - (form.get(a.id) ?? 0))
      .map((p) => p.id);
    const slots = emptySlots(lineup.formation);
    pinnedInSlot.forEach((id, i) => {
      slots[i].playerId = id;
    });
    const zoneOf = (id: string): Zone | undefined => lineup.playerPositions[id] ?? playersById.get(id)?.naturalPosition;
    slots.forEach((s) => {
      if (s.playerId) return;
      const idx = pool.findIndex((id) => zoneOf(id) === s.zone);
      if (idx >= 0) s.playerId = pool.splice(idx, 1)[0];
    });
    slots.forEach((s) => {
      if (!s.playerId && pool.length) s.playerId = pool.shift() as string;
    });
    withMorph(() => commit({ ...lineup, slots, bench: pool }));
  };

  // Free mode: nudge the player's slot to the drop point via the pixel delta.
  const repositioned = (l: Lineup, slotIndex: number, transform: { x: number; y: number }): Lineup => {
    const rect = pitchElRef.current?.getBoundingClientRect();
    if (!rect) return l;
    const slots = l.slots.map((s) => ({ ...s }));
    const s = slots[slotIndex];
    s.x = clamp(s.x + (transform.x / rect.width) * 100, 6, 94);
    s.y = clamp(s.y + (transform.y / rect.height) * 100, 6, 94);
    return { ...l, slots };
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    if (readOnly) return;
    const { source, target, transform } = event.operation;
    if (event.canceled || !source) return;
    const id = String(source.id);
    const from = locationOf(lineup, id);

    if (target && String(target.id) === "pz-bench") {
      commit(sendToBench(lineup, id));
      return;
    }
    if (lineup.freeMode && from?.type === "slot") {
      commit(repositioned(lineup, from.index, transform));
      return;
    }
    const targetData = target?.data as Partial<SlotData> | undefined;
    if (target && targetData?.kind === "slot" && typeof targetData.index === "number") {
      commit(placeIntoSlot(lineup, id, targetData.index));
      return;
    }
    if (from?.type === "bench") {
      const firstEmpty = lineup.slots.findIndex((s) => s.playerId === null);
      if (firstEmpty >= 0) commit(placeIntoSlot(lineup, id, firstEmpty));
    }
  };

  // Tap-to-place / keyboard.
  const activateToken = (id: string): void => {
    if (readOnly) return;
    if (picked === null) {
      setPicked(id);
      return;
    }
    if (picked === id) {
      setPicked(null);
      return;
    }
    commit(swapPlayers(lineup, picked, id));
    setPicked(null);
  };
  const activateSlot = (index: number): void => {
    if (readOnly || picked === null) return;
    commit(placeIntoSlot(lineup, picked, index));
    setPicked(null);
  };
  const activateBench = (): void => {
    if (readOnly || picked === null) return;
    commit(sendToBench(lineup, picked));
    setPicked(null);
  };

  const rolesForPlayer = (id: string): RoleMeta[] => ROLE_META.filter((r) => lineup.roles[r.key] === id);
  const setRole = (key: RoleKey, id: string): void => {
    if (readOnly) return;
    commit({ ...lineup, roles: { ...lineup.roles, [key]: id || undefined } });
  };

  // ── Derived ──
  const onPitch = lineup.slots.filter((s) => s.playerId);
  const onPitchIds = onPitch.map((s) => s.playerId as string);
  const benchPlayers = lineup.bench.map((id) => playersById.get(id)).filter((p): p is PizarraPlayer => !!p);
  const filteredBench = benchPlayers.filter((p) => {
    const q = benchQuery.trim().toLowerCase();
    const matchesQuery =
      !q || `${p.number}`.includes(q) || `${p.firstName} ${p.lastName} ${p.shirtName}`.toLowerCase().includes(q);
    const matchesZone = benchZone === "all" || effectiveZone(p.id) === benchZone;
    return matchesQuery && matchesZone;
  });
  const seasonName = selectedSeasonId === "all" ? "Histórico Total" : seasons.find((s) => s.id === selectedSeasonId)?.name ?? "Temporada";
  const placedCount = onPitch.length;

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className={`pz${lineup.freeMode ? " is-free-mode" : ""}${presentMode ? " pz--present" : ""}${readOnly ? " pz--readonly" : ""}`}>
        <PizarraControls
          formation={lineup.formation}
          onFormation={changeFormation}
          tactics={lineup.tactics}
          onTactic={setTactic}
          freeMode={lineup.freeMode}
          onToggleFree={toggleFreeMode}
          onReset={resetBoard}
          onAuto={autoXI}
          onSuggestForm={suggestByForm}
          onUndo={undo}
          onRedo={redo}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onOpenSettings={() => setSettingsOpen(true)}
          onPresent={() => setPresentMode(true)}
          readOnly={readOnly}
        />

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

        {readOnly && readOnlyInfo && (
          <div className="pz-readonly" role="status">
            <span className="pz-readonly-seal" aria-hidden="true">
              <Copy size={14} />
            </span>
            <span className="pz-readonly-text">
              Solo lectura ·{" "}
              {readOnlyInfo.official ? `Oficial (${readOnlyInfo.scope})` : `Tablero de @${readOnlyInfo.nickname}`}
            </span>
            <button type="button" className="pz-btn-solid" onClick={duplicateForEdit}>
              <Copy size={14} aria-hidden="true" /> Duplicar para editar
            </button>
          </div>
        )}

        <div className="pz-status" role="status">
          <span className="pz-status-count">{placedCount}/{XI}</span> en el campo
          {placedCount < XI && <span className="pz-status-warn"> · faltan {XI - placedCount}</span>}
          {placedCount === XI && <span className="pz-status-ok"> · once completo</span>}
        </div>

        {picked && (
          <p className="pz-hint" role="status">
            Jugador seleccionado. Toca una posición o un compañero para colocarlo, o el banquillo para sentarlo.
          </p>
        )}

        <div className="pz-board">
          <div ref={setPitchRef} className={`pz-pitch${lineup.freeMode ? " is-free" : ""}${pitchOver ? " is-over" : ""}`}>
            <FloodlightCanvas className="pz-floodlight" />
            <svg className="pz-lines" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
              <rect x="3" y="3" width="94" height="144" rx="1" />
              <line x1="3" y1="75" x2="97" y2="75" />
              <circle cx="50" cy="75" r="11" />
              <circle cx="50" cy="75" r="0.8" className="pz-spot" />
              <rect x="28" y="3" width="44" height="20" />
              <rect x="40" y="3" width="20" height="7" />
              <rect x="28" y="127" width="44" height="20" />
              <rect x="40" y="140" width="20" height="7" />
            </svg>

            {lineup.slots.map((slot, index) => {
              const player = slot.playerId ? playersById.get(slot.playerId) : undefined;
              const ez = player ? effectiveZone(player.id) : undefined;
              return (
                <PitchSlot
                  key={slot.slotId}
                  slot={slot}
                  index={index}
                  pendingPlace={picked !== null}
                  showLabel={settings.showEmptyLabels}
                  disabled={readOnly}
                  onActivate={() => activateSlot(index)}
                >
                  {player && (
                    <PlayerToken
                      player={player}
                      galones={rolesForPlayer(player.id)}
                      from="slot"
                      picked={picked === player.id}
                      pinned={lineup.pinned.includes(player.id)}
                      variant="pitch"
                      jerseySize={52}
                      settings={settings}
                      positionLabel={ez ? ZONE_LABEL[ez] : undefined}
                      outOfPosition={isOutOfPosition(slot)}
                      unavailable={isUnavailable(player.id)}
                      disabled={readOnly}
                      onActivate={() => activateToken(player.id)}
                    />
                  )}
                </PitchSlot>
              );
            })}
          </div>

          <div
            ref={setBenchRef}
            className={`pz-bench${benchOver ? " is-over" : ""}${picked ? " is-target" : ""}`}
            role="group"
            aria-label="Banquillo"
          >
            <div className="pz-bench-head">
              <Users size={14} aria-hidden="true" />
              <span className="pz-bench-title">Banquillo</span>
              <span className="pz-bench-count">{benchPlayers.length}</span>
              {picked && (
                <button type="button" className="pz-bench-drop" onClick={activateBench}>
                  Sentar aquí
                </button>
              )}
            </div>

            <div className="pz-bench-filter">
              <span className="pz-bench-search">
                <Search size={13} aria-hidden="true" />
                <input
                  type="text"
                  value={benchQuery}
                  onChange={(e) => setBenchQuery(e.target.value)}
                  placeholder="Buscar"
                  aria-label="Buscar en el banquillo"
                />
                {benchQuery && (
                  <button type="button" className="pz-bench-clear" aria-label="Limpiar búsqueda" onClick={() => setBenchQuery("")}>
                    <X size={12} />
                  </button>
                )}
              </span>
              <span className="pz-bench-zones">
                {(["all", ...ZONES] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    className="pz-zone-chip"
                    aria-pressed={benchZone === z}
                    onClick={() => setBenchZone(z)}
                  >
                    {z === "all" ? "Todos" : z}
                  </button>
                ))}
              </span>
            </div>

            {loading ? (
              <p className="pz-bench-empty">Cargando plantilla…</p>
            ) : filteredBench.length === 0 ? (
              <p className="pz-bench-empty">
                {benchPlayers.length === 0 ? "Todos los jugadores están en el campo." : "Sin coincidencias en el banquillo."}
              </p>
            ) : (
              <div className="pz-bench-rail">
                {filteredBench.map((p) => {
                  const ez = effectiveZone(p.id);
                  return (
                    <PlayerToken
                      key={p.id}
                      player={p}
                      galones={rolesForPlayer(p.id)}
                      from="bench"
                      picked={picked === p.id}
                      pinned={lineup.pinned.includes(p.id)}
                      variant="bench"
                      jerseySize={44}
                      settings={settings}
                      positionLabel={ez ? ZONE_LABEL[ez] : undefined}
                      outOfPosition={false}
                      unavailable={isUnavailable(p.id)}
                      disabled={readOnly}
                      onActivate={() => activateToken(p.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <ChemistryPanel rating={rating} lines={lines} unavailableInXI={unavailableInXI} />

        {/* Panels: galones + posiciones */}
        <div className="pz-panels">
          <div className="pz-panel" role="group" aria-label="Galones del once">
            <div className="pz-panel-head">
              <span className="pz-panel-title">Galones</span>
              <span className="pz-panel-sub">{seasonName}</span>
            </div>
            <div className="pz-roles-grid">
              {ROLE_META.map((r) => (
                <label key={r.key} className="pz-role">
                  <span className="pz-role-seal pz-role-seal--lg" aria-hidden="true">{r.glyph}</span>
                  <span className="pz-role-text">
                    <span className="pz-role-label">{r.label}</span>
                    <select
                      className="pz-role-select"
                      value={lineup.roles[r.key] ?? ""}
                      onChange={(e) => setRole(r.key, e.target.value)}
                      aria-label={r.aria}
                      disabled={readOnly}
                    >
                      <option value="">Ninguno</option>
                      {onPitchIds.map((id) => {
                        const p = playersById.get(id);
                        if (!p) return null;
                        return (
                          <option key={id} value={id}>
                            {p.number} · {p.shirtName || p.firstName || `Nº${p.number}`}
                          </option>
                        );
                      })}
                    </select>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="pz-panel" role="group" aria-label="Posiciones del once">
            <div className="pz-panel-head">
              <span className="pz-panel-title">Posiciones</span>
              <span className="pz-panel-sub">{isAdmin ? "Natural (guardada) · en este once" : "En este once"}</span>
            </div>
            <ul className="pz-pos-list">
              {onPitch.map((slot) => {
                const p = playersById.get(slot.playerId as string);
                if (!p) return null;
                const override = lineup.playerPositions[p.id];
                const oop = isOutOfPosition(slot);
                const isPinned = lineup.pinned.includes(p.id);
                return (
                  <li key={p.id} className={`pz-pos-row${oop ? " is-oop" : ""}`}>
                    <span className="pz-pos-player">
                      <b>{p.number}</b> {p.shirtName || p.firstName || `Nº${p.number}`}
                      <span className="pz-pos-slot">{slot.position}</span>
                    </span>
                    {isAdmin && (
                      <label className="pz-pos-field">
                        <span className="pz-pos-flabel">Natural</span>
                        <select
                          className="pz-pos-select"
                          value={p.naturalPosition ?? ""}
                          onChange={(e) => saveNatural(p.id, (e.target.value || null) as Zone | null)}
                          aria-label={`Posición natural de ${p.shirtName || p.firstName}`}
                          disabled={readOnly}
                        >
                          <option value="">—</option>
                          {ZONES.map((z) => (
                            <option key={z} value={z}>{ZONE_LABEL[z]}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        className="pz-pos-injury"
                        aria-pressed={p.injured}
                        disabled={readOnly}
                        onClick={() => void setInjured(p.id, !p.injured)}
                        title={p.injured ? "Marcar apto" : "Marcar lesionado"}
                      >
                        {p.injured ? "Lesionado" : "Apto"}
                      </button>
                    )}
                    <label className="pz-pos-field">
                      <span className="pz-pos-flabel">En este 11</span>
                      <select
                        className="pz-pos-select"
                        value={override ?? ""}
                        onChange={(e) => setOverride(p.id, (e.target.value || null) as Zone | null)}
                        aria-label={`Posición de ${p.shirtName || p.firstName} en este once`}
                        disabled={readOnly}
                      >
                        <option value="">Según natural</option>
                        {ZONES.map((z) => (
                          <option key={z} value={z}>{ZONE_LABEL[z]}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="pz-pin-btn"
                      aria-pressed={isPinned}
                      onClick={() => togglePin(p.id)}
                      title={isPinned ? "Soltar" : "Fijar en su posición"}
                      disabled={readOnly}
                    >
                      {isPinned ? "Fijado" : "Fijar"}
                    </button>
                    {oop && <span className="pz-pos-oop" title="Fuera de posición">≠</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {presentMode && (
          <button type="button" className="pz-present-exit" onClick={() => setPresentMode(false)}>
            Salir de presentación
          </button>
        )}
      </div>

      {settingsOpen && (
        <PizarraSettingsPanel settings={settings} onChange={setSetting} onClose={() => setSettingsOpen(false)} />
      )}
    </DragDropProvider>
  );
};
