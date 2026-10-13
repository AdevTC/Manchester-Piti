// La pizarra — the board's versions of the seven for its match: «Titular» (the board itself) and up to two
// variants, «2ª parte» and «Plan B» (named by the captain), each with its own system, spots and plan. The
// galones, the strokes and the jugadas stay the board's. The board edits the variant on screen through a
// lens: the variant is shown as a whole lineup, and every change to it is written back into its variant.
// Publishing the official publishes them all (they live in the board). Pure (no React).
import type { Lineup, LineupVariant, RoleKey, Roles, VariantId } from "../formations";
import { systemDef } from "../../../lib/formations";
import { VARIANT_IDS, VARIANT_LIMITS } from "../../../lib/schemas";
import { normalize } from "./ops";
import { changes } from "./compare";

/** The version on screen: the board itself («titular») or one of its variants. */
export type VariantKey = "titular" | VariantId;

export const VARIANT_ORDER: readonly VariantId[] = VARIANT_IDS;
export const VARIANT_DEFAULT: Record<VariantId, string> = { v2: "2ª parte", vb: "Plan B" };
export const TITULAR = "Titular";

const ROLE_KEYS: RoleKey[] = ["captainId", "penaltiesId", "freekicksId", "cornersId"];
const cloneSlots = (s: Lineup["slots"]) => s.map((x) => ({ ...x }));
const onPitch = (L: Pick<Lineup, "slots">): Set<string> => new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));

export const variantsOf = (L: Lineup): LineupVariant[] => L.variants ?? [];
export const variantOf = (L: Lineup, id: VariantId): LineupVariant | undefined => variantsOf(L).find((v) => v.id === id);

/** The name a version goes by: «Titular», or the variant's own. */
export function variantName(L: Lineup, key: VariantKey): string {
  if (key === "titular") return TITULAR;
  return variantOf(L, key)?.name ?? VARIANT_DEFAULT[key];
}

/** The version `key` as a whole lineup the board can show and edit (the titular when it doesn't exist). */
export function variantView(L: Lineup, key: VariantKey, squadIds: string[]): Lineup {
  const v = key === "titular" ? undefined : variantOf(L, key);
  if (!v) return L;
  return normalize({ ...L, formation: v.formation, freeMode: v.freeMode, slots: cloneSlots(v.slots), tactics: { ...v.tactics } }, squadIds);
}

/**
 * The galones after a change made on a variant: they are the board's, so a galón the variant gave or took
 * from someone still on its pitch counts; a galón that only «fell» because its player is not in this
 * variant's seven stays where it was.
 */
export function mergeRoles(board: Roles, shown: Roles, next: Roles, nextPitch: ReadonlySet<string>): Roles {
  const out: Roles = { ...board };
  ROLE_KEYS.forEach((k) => {
    if (next[k] === shown[k]) return;
    const n = next[k];
    if (n) out[k] = n;
    else if (shown[k] && nextPitch.has(shown[k] as string)) delete out[k];
  });
  return out;
}

/**
 * Writes a change made on version `key` (the board showed `shown`, it became `next`) back into the board
 * `L`: on the titular it is the change itself; on a variant, the system, the spots and the plan go into
 * the variant, the rest (galones, strokes, jugadas, positions…) into the board.
 */
export function writeVariant(L: Lineup, key: VariantKey, shown: Lineup, next: Lineup): Lineup {
  if (key === "titular" || !variantOf(L, key)) return next;
  return {
    ...next,
    formation: L.formation,
    freeMode: L.freeMode,
    slots: L.slots,
    tactics: L.tactics,
    bench: L.bench,
    roles: mergeRoles(L.roles, shown.roles, next.roles, onPitch(next)),
    variants: variantsOf(L).map((v) => (v.id === key ? { ...v, formation: next.formation, freeMode: next.freeMode, slots: cloneSlots(next.slots), tactics: { ...next.tactics } } : v)),
  };
}

/** A new variant: a copy of the titular's seven (null when it already exists or there is no room). */
export function addVariant(L: Lineup, id: VariantId): Lineup | null {
  const vs = variantsOf(L);
  if (vs.some((v) => v.id === id) || vs.length >= VARIANT_LIMITS.variants) return null;
  const v: LineupVariant = { id, name: VARIANT_DEFAULT[id], formation: L.formation, freeMode: L.freeMode, slots: cloneSlots(L.slots), tactics: { ...L.tactics } };
  // (kept in the fixed order: 2ª parte, Plan B)
  const next = [...vs, v].sort((a, b) => VARIANT_ORDER.indexOf(a.id) - VARIANT_ORDER.indexOf(b.id));
  return { ...L, variants: next };
}

export function removeVariant(L: Lineup, id: VariantId): Lineup {
  return { ...L, variants: variantsOf(L).filter((v) => v.id !== id) };
}

/** Why a variant can't take that name (null = it can). */
export function variantNameError(L: Lineup, id: VariantId, raw: string): string | null {
  const nm = raw.trim().replace(/\s+/g, " ");
  if (!nm) return "Ponle un nombre.";
  if (nm.length > VARIANT_LIMITS.name) return "Como mucho " + VARIANT_LIMITS.name + " caracteres.";
  const taken = [TITULAR, ...variantsOf(L).filter((v) => v.id !== id).map((v) => v.name)].map((x) => x.toLocaleLowerCase("es"));
  if (taken.includes(nm.toLocaleLowerCase("es"))) return "Ya hay una versión con ese nombre.";
  return null;
}

export function renameVariant(L: Lineup, id: VariantId, raw: string): Lineup {
  const nm = raw.trim().replace(/\s+/g, " ");
  return { ...L, variants: variantsOf(L).map((v) => (v.id === id ? { ...v, name: nm } : v)) };
}

/** «3-2-1 · entra ERIK por KEVIN» — what a variant changes from the titular, in words. */
export function variantSummary(titular: Lineup, v: Lineup, name: (id: string) => string): string {
  const sys = v.freeMode ? "Libre" : systemDef(v.formation).label;
  const sameSys = v.freeMode ? titular.freeMode : !titular.freeMode && v.formation === titular.formation;
  const c = changes(titular, v);
  if (!c.ins.length && !c.outs.length) return sys + (sameSys ? " · los mismos siete" : " · los mismos siete, otro dibujo");
  const and = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
  const ins = c.ins.map(name);
  const outs = c.outs.map(name);
  const verbIn = ins.length > 1 ? "entran " : "entra ";
  const txt = ins.length && outs.length ? verbIn + and(ins) + " por " + and(outs) : ins.length ? verbIn + and(ins) : (outs.length > 1 ? "salen " : "sale ") + and(outs);
  return sys + " · " + txt;
}

export interface VariantPill {
  key: VariantKey;
  label: string;
  /** Not made yet: tapping it makes it (editable boards only). */
  add: boolean;
  on: boolean;
  aria: string;
}

/** The pills over the pitch: Titular, the variants there are, and (to edit) the ones still to make. */
export function variantPills(L: Lineup, active: VariantKey, canEdit: boolean): VariantPill[] {
  const out: VariantPill[] = [{ key: "titular", label: TITULAR, add: false, on: active === "titular", aria: "Ver el siete titular" }];
  VARIANT_ORDER.forEach((id) => {
    const v = variantOf(L, id);
    if (v) out.push({ key: id, label: v.name, add: false, on: active === id, aria: "Ver la versión «" + v.name + "»" });
    else if (canEdit) out.push({ key: id, label: VARIANT_DEFAULT[id], add: true, on: false, aria: "Crear la versión «" + VARIANT_DEFAULT[id] + "» (una copia del titular)" });
  });
  return out;
}

/** Comparar's options for the versions not on screen («Versión · Plan B»), id «v:<key>». */
export const VARIANT_CMP = "v:";
export function variantCmpOptions(L: Lineup, active: VariantKey): { id: string; name: string }[] {
  const keys: VariantKey[] = ["titular", ...variantsOf(L).map((v) => v.id)];
  if (keys.length < 2) return [];
  return keys.filter((k) => k !== active).map((k) => ({ id: VARIANT_CMP + k, name: "Versión · " + variantName(L, k) }));
}
export function cmpVariantKey(id: string | null): VariantKey | null {
  if (!id?.startsWith(VARIANT_CMP)) return null;
  const k = id.slice(VARIANT_CMP.length);
  return k === "titular" || (VARIANT_IDS as readonly string[]).includes(k) ? (k as VariantKey) : null;
}

/** La charla's «Plan B» card on the plan step (null without one, or when it changes nothing). */
export function charlaPlanB(L: Lineup, squadIds: string[], name: (id: string) => string): { t: string; d: string } | null {
  const v = variantOf(L, "vb");
  if (!v) return null;
  const view = variantView(L, "vb", squadIds);
  const same = changes(L, view);
  if (!same.ins.length && !same.outs.length && view.formation === L.formation && view.freeMode === L.freeMode && JSON.stringify(view.tactics) === JSON.stringify(L.tactics)) return null;
  return { t: v.name, d: "Si hace falta: " + variantSummary(L, view, name) + "." };
}
