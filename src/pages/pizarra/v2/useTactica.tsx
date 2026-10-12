// La pizarra · Bloque 4 — the tactical depth, wired for the board: the phase on screen (con / sin balón,
// transición, the «Fases» scrubber), the style being previewed, the spot a carried cromo would land on, and
// the pieces the board shows (the Plan tab's sections, the live card's suggestion, the pitch's view of the
// lineup and its arrows, the diamonds on the cromos, «+2 química aquí»). Every change goes through the
// board's commit (its undo, its autosave); every word through its one announcer.
import { useState, type ReactNode } from "react";
import type { FormationName, Lineup } from "../formations";
import type { StyleId } from "../../../lib/tacticaSchemas";
import { newId } from "../drawings";
import { CAMS, proj, slotPos, type CamName } from "./geometry";
import type { Squad } from "./model";
import { chemOf } from "./quimica";
import { resolveDrop, type DragSource, type DropTarget } from "./ops";
import type { LiveNow } from "./live";
import type { CalMatch } from "./boards";
import type { CardView } from "./view";
import type { PlanArrow } from "./plan";
import { clearShapeOff, FASES, phaseArrows, phaseAt, phaseView, runners, runnerTxt, setOffFormation, shapeOffOf, shapeOffTxt, shiftOffBlock, widenOff, type FaseId, type ShapeView } from "./phases";
import { applyStyle, styleById, styleDiff, styleLabel, stylePreview } from "./tacStyles";
import { addRule, applyRule, liveSuggestion, patchRule, removeRule, ruleTxt, rulesOf, type RulePatch } from "./condPlan";
import { allDiamonds, diamondMarks, diamondsAria, dropPreview, teamDiamonds } from "./chemPlayer";
import { plannedVsPlayed, pvpTxt, recordTxt, recordWith } from "./record";
import { CondPanel, DropBadge, LiveSuggestion, PhasePanel, PlanRecord, StylePanel, type LiveSuggestionView } from "./TacticaPanel";

export interface TacticaCtx {
  /** The board on screen (a new one starts afresh). */
  key: string;
  L: Lineup;
  sq: Squad;
  canEdit: boolean;
  commit: (next: Lineup) => void;
  say: (msg: string) => void;
  announce: (msg: string) => void;
  /** The cromos glide from where they are drawn to the new view (nothing with reduced motion). */
  glide: () => void;
  nm: (id: string) => string;
}

interface PvState {
  key: string;
  shape: ShapeView;
  fase: FaseId;
  style: StyleId | null;
}

export function useTactica(c: TacticaCtx) {
  const { L, sq, nm } = c;
  const [pv0, setPv] = useState<PvState>({ key: c.key, shape: "con", fase: "plan", style: null });
  const [drop, setDrop] = useState<{ src: DragSource; t: DropTarget; host: HTMLElement | null } | null>(null);
  const pv: PvState = pv0.key === c.key ? pv0 : { key: c.key, shape: "con", fase: "plan", style: null };
  const set = (p: Partial<PvState>) => setPv({ ...pv, ...p, key: c.key });

  const change = (next: Lineup, msg: string, sayIt = false) => {
    if (!c.canEdit || next === L) return false;
    c.commit(next);
    if (sayIt) c.say(msg);
    else c.announce(msg);
    return true;
  };

  // ── the phases ──
  const onShape = (s: ShapeView) => {
    if (s === pv.shape && pv.fase === "plan") return;
    set({ shape: s, fase: "plan", style: null });
    c.glide();
    const rs = s === "con" ? [] : runners(L).map((r) => runnerTxt(nm(r.id), r));
    c.announce((s === "con" ? "Con balón: el plan" : s === "sin" ? "Sin balón: " + shapeOffTxt(L) : "Transición: a medio camino entre con y sin balón") + (rs.length ? ". " + rs.join(". ") : ""));
  };
  const onFase = (f: FaseId) => {
    if (f === pv.fase && pv.shape === "con") return;
    set({ shape: "con", fase: f, style: null });
    c.glide();
    const d = FASES.find((x) => x.id === f);
    c.announce(f === "plan" ? "El plan: cada uno en su sitio" : "Fase: " + (d?.l ?? "") + ". " + (d?.d ?? ""));
  };
  const offEdit = (next: Lineup) => change(next, "Sin balón: " + shapeOffTxt(next));

  // ── the styles ──
  const onStylePick = (id: StyleId | null) => {
    set({ style: id, shape: "con", fase: "plan" });
    c.glide();
    const s = styleById(id);
    if (!s) c.announce("Vista previa cerrada");
    else {
      const d = styleDiff(L, s.id);
      c.announce("Vista previa: " + s.name + ". " + (d.rows.length ? d.rows.map((r) => r.label + " " + r.to).join(", ") : "ya juegas así") + (d.shape ? ". " + d.shape : ""));
    }
  };
  const onStyleApply = () => {
    const s = styleById(pv.style);
    if (!s) return;
    if (change(applyStyle(L, s.id), "Estilo «" + s.name + "» aplicado", true)) set({ style: null });
  };

  // ── the conditional plan ──
  const onPatch = (id: string, p: RulePatch) => {
    // (choosing who leaves first proposes who comes in: the first of the bench)
    let q = p;
    if (p.sub && p.sub.out && !p.sub.in) {
      const on = new Set(L.slots.map((s) => s.playerId));
      const inn = sq.list.find((x) => !on.has(x.id) && x.id !== p.sub?.out && !x.baja)?.id ?? sq.list.find((x) => x.id !== p.sub?.out)?.id;
      q = { ...p, sub: inn ? { out: p.sub.out, in: inn } : null };
    }
    const next = patchRule(L, id, q);
    const r = rulesOf(next).find((x) => x.id === id);
    if (r) change(next, ruleTxt(r, nm));
  };
  const suggestion = (live: LiveNow | null): LiveSuggestionView | null => {
    const s = live ? liveSuggestion(L, live, nm) : null;
    if (!s || !live) return null;
    return {
      txt: s.txt,
      canApply: c.canEdit,
      onApply: () => {
        const next = applyRule(L, s.rule, live.minute, s.subOk, () => newId("s"));
        change(next, "Plan aplicado: " + ruleTxt(s.rule, nm).replace(/^Si [^→]*→ /, "") + (s.subOk ? " · el cambio, en el plan de cambios" : ""), true);
      },
    };
  };

  /** The live card's suggestion (Siete → Cambios, «En directo»). */
  const liveExtra = (live: LiveNow): ReactNode => {
    const v = suggestion(live);
    return v ? <LiveSuggestion v={v} /> : null;
  };

  /** What the pitch shows: the lineup (a phase, a style's preview, or the plan itself) and the plan's arrows. */
  const pitch = (base: Lineup, planOpen: boolean, cam: CamName): { L: Lineup; on: boolean; arrows: PlanArrow[] | null; planL: Lineup | null } => {
    if (!planOpen) return { L: base, on: false, arrows: null, planL: null };
    if (pv.style) {
      const p = stylePreview(base, pv.style);
      return { L: p, on: true, arrows: null, planL: p };
    }
    const at = phaseAt(base, pv.shape, pv.fase);
    if (!at) return { L: base, on: false, arrows: null, planL: null };
    return { L: phaseView(base, at), on: true, arrows: phaseArrows(base, at, cam, pv.shape !== "con"), planL: null };
  };

  /** The Plan tab, before the consignas: the record, the phases and the styles. */
  const planTop = (calendar: readonly CalMatch[], linked: CalMatch | null, ro: boolean): ReactNode => {
    const off = shapeOffOf(L);
    const pvp = plannedVsPlayed(L, linked);
    return (
      <>
        <PlanRecord rec={recordTxt(recordWith(L, calendar))} pvp={pvp ? pvpTxt(pvp, nm) : null} />
        <PhasePanel
          ro={ro}
          shape={pv.shape}
          fase={pv.fase}
          onShape={onShape}
          onFase={onFase}
          off={{ formation: off.formation, txt: shapeOffTxt(L), own: !!L.shapeOff }}
          runners={runners(L).map((r) => runnerTxt(nm(r.id), r))}
          onOffSystem={(f: FormationName) => offEdit(setOffFormation(L, f))}
          onOffBlock={(d) => offEdit(shiftOffBlock(L, d))}
          onOffWiden={(d) => offEdit(widenOff(L, d))}
          onOffClear={() => change(clearShapeOff(L), "Sin balón: vuelve la propuesta", true)}
        />
        <StylePanel ro={ro} current={styleLabel(L)} pick={pv.style} diff={pv.style ? styleDiff(L, pv.style) : null} onPick={onStylePick} onApply={onStyleApply} />
      </>
    );
  };

  /** The Plan tab, after the consignas: the conditional plan (and what it says now, live). */
  const planAfter = (live: LiveNow | null, ro: boolean): ReactNode => {
    const people = sq.list.map((x) => ({ id: x.id, label: x.num + " · " + x.name }));
    return (
      <CondPanel
        ro={ro}
        rules={rulesOf(L)}
        people={people}
        name={nm}
        live={suggestion(live)}
        onAdd={() => change(addRule(L, newId("r")), "Regla añadida: elige cuándo y qué cambia", true)}
        onDel={(id) => change(removeRule(L, id), "Regla quitada", true)}
        onPatch={onPatch}
      />
    );
  };

  // ── la química por jugador ──
  /** The cromos with their own diamonds (from the lineup the pitch is built on, by slot). */
  const withDiamonds = (cards: CardView[], base: Lineup): CardView[] => {
    const dms = allDiamonds(base, sq, chemOf(base, sq));
    return cards.map((card) => {
      const d = dms[card.i] ?? 0;
      if (card.aria.startsWith("Cromo boca abajo")) return { ...card, q: diamondMarks(d) };
      const k = card.aria.indexOf(". Toca");
      const a = ", " + diamondsAria(d);
      return { ...card, q: diamondMarks(d), aria: k >= 0 ? card.aria.slice(0, k) + a + card.aria.slice(k) : card.aria + a };
    });
  };

  /** What dropping `src` on `t` would do («+2 química aquí»), and where it would land; null = nothing to say. */
  const preview = (src: DragSource, t: DropTarget, grid: boolean, cam: CamName): { txt: string; down: boolean; at: { x: number; y: number } } | null => {
    const r = resolveDrop(L, sq, src, t, grid);
    if (!r || !("lineup" in r)) return null;
    const p = dropPreview(L, r.lineup, sq, src.id);
    const k = r.lineup.slots.findIndex((s) => s.playerId === src.id);
    if (k < 0) return null;
    const pos = slotPos(r.lineup, k);
    const q = proj(CAMS[cam], pos.u, pos.v);
    return { txt: p.txt, down: p.delta < 0, at: { x: q.x, y: q.y } };
  };

  /** The badge while a cromo is carried (into the pitch frame). */
  const dropBadge = (on: boolean, grid: boolean, cam: CamName): ReactNode => {
    if (!on || !drop) return null;
    const p = preview(drop.src, drop.t, grid, cam);
    return p ? <DropBadge host={drop.host} at={p.at} txt={p.txt} down={p.down} /> : null;
  };

  return {
    shape: pv.shape,
    fase: pv.fase,
    liveExtra,
    pitch,
    planTop,
    planAfter,
    withDiamonds,
    dm: teamDiamonds(L, sq),
    /** The drag's landing spot changed (`host` = the pitch frame the badge goes in). */
    onTarget: (src: DragSource, t: DropTarget | null, host: HTMLElement | null) => setDrop(t ? { src, t, host } : null),
    dropBadge,
    /** For the keyboard's hand: « · +1 química aquí» for a change to `next` (empty when the sum doesn't move). */
    chemTxt: (next: Lineup, id: string): string => {
      const p = dropPreview(L, next, sq, id);
      return p.delta ? " · " + p.txt : "";
    },
  };
}
