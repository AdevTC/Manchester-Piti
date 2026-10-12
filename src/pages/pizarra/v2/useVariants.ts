// The version of the seven on screen («Titular», «2ª parte», «Plan B»: see variants.ts) and the session the
// board edits through it: the variant shown as the board's lineup, every change written back into it.
// Another version is another board for the per-board UI (its own key: selection and undo start afresh).
import { useMemo, useState } from "react";
import type { Lineup, VariantId } from "../formations";
import type { BoardSession } from "./useBoardSession";
import { addVariant, removeVariant, renameVariant, variantName, variantOf, variantPills, variantView, writeVariant, type VariantKey, type VariantPill } from "./variants";

export interface VariantsApi {
  /** The session the board uses: its lineup is the version on screen. */
  session: BoardSession;
  active: VariantKey;
  /** The titular (the board itself), whatever version is on screen. */
  titular: Lineup;
  name: string;
  pills: VariantPill[];
  select: (k: VariantKey) => void;
  /** Makes a variant (a copy of the titular) and shows it; false when it can't. */
  add: (id: VariantId) => boolean;
  rename: (id: VariantId, name: string) => void;
  /** Drops a variant (back to the titular); returns the board as it was, to undo. */
  remove: (id: VariantId) => Lineup | null;
  /** Puts the whole board back (the undo of a removal). */
  restore: (L: Lineup) => void;
}

export function useVariants(raw: BoardSession, squadIds: string[]): VariantsApi {
  const [pick, setPick] = useState<{ key: string; v: VariantKey }>({ key: raw.key, v: "titular" });
  const base = raw.lineup;
  // (a variant deleted elsewhere, or another board: back to the titular)
  const active: VariantKey = pick.key === raw.key && (pick.v === "titular" || variantOf(base, pick.v)) ? pick.v : "titular";
  const shown = useMemo(() => variantView(base, active, squadIds), [base, active, squadIds]);
  const canEdit = raw.ready && !raw.readOnly;

  const session = useMemo<BoardSession>(
    () =>
      active === "titular"
        ? raw
        : {
            ...raw,
            key: raw.key + "#" + active,
            lineup: shown,
            commit: (next: Lineup) => raw.commit(writeVariant(base, active, shown, next)),
          },
    [raw, active, shown, base],
  );

  return {
    session,
    active,
    titular: base,
    name: variantName(base, active),
    pills: variantPills(base, active, canEdit),
    select: (v) => setPick({ key: raw.key, v }),
    add: (id) => {
      if (!canEdit) return false;
      const next = addVariant(base, id);
      if (!next) return false;
      raw.commit(next);
      setPick({ key: raw.key, v: id });
      return true;
    },
    rename: (id, nm) => {
      if (canEdit) raw.commit(renameVariant(base, id, nm));
    },
    remove: (id) => {
      if (!canEdit || !variantOf(base, id)) return null;
      raw.commit(removeVariant(base, id));
      setPick({ key: raw.key, v: "titular" });
      return base;
    },
    restore: (L) => {
      if (canEdit) raw.commit(L);
    },
  };
}
