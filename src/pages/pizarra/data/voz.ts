// r14 · la voz va con lo que cuenta (PZ-D22F) y se copia al duplicar (PZ-D08). Where voices live does not change:
// lineups/{id}/voz/{v0…v5} (≤ 6 per board, ≤ 30 s, base64 — see v2/voz.ts for why there and not in Storage). What
// changes is the key in `step`: it names WHAT the voice talks about, not the step number, so it follows its
// content when the charla is reordered or a player changes place:
//   «siete:<playerId>» (his walkout; «siete:hueco-<code>» an empty slot) · «jugada:<playId>» (the play) and
//   «jugada:<playId>:<k>» (its step k) · «sistema» · «suplentes» · «galones» · «rival» · «plan» · «quedada» · «vamos».
// The old keys («siete-3», «jugada-2», «banquillo», «balon», «final») still read: they are «orphans» (named, never
// played on someone else). firestore.rules accepts both. Duplicating a board copies its voices (copyVoz).
import { useMemo } from "react";
import { collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { z } from "zod";
import { db } from "../../../firebase";
import { useFirestoreCollection } from "../../../lib/useFirestoreCollection";
import { reportDroppedDoc } from "../../../lib/docTelemetry";

export const VOZ_R14 = { slots: 6, ms: 30_000, chars: 900_000, mime: 60 } as const;
export const VOZ_SLOTS = ["v0", "v1", "v2", "v3", "v4", "v5"] as const;
export type VozSlotId = (typeof VOZ_SLOTS)[number];

/** The keys firestore.rules accepts (the same regex). */
export const VOZ_KEY_RE = /^(sistema|banquillo|balon|plan|quedada|final|suplentes|galones|rival|vamos|siete-[1-7]|jugada-[1-8]|siete:[A-Za-z0-9_-]{1,128}|jugada:[A-Za-z0-9_-]{1,64}(:[0-9]{1,2})?)$/;
const LEGACY_RE = /^(banquillo|balon|final|siete-[1-7]|jugada-[1-8])$/;

export const sieteVoz = (playerId: string): string => "siete:" + playerId;
export const huecoVoz = (code: string): string => "siete:hueco-" + code;
export const jugadaVoz = (playId: string, step?: number): string => "jugada:" + playId + (step ? ":" + step : "");
export const isVozKey = (k: string): boolean => VOZ_KEY_RE.test(k);
/** A key from before r14 (by step number): kept, shown as an orphan, never played. */
export const isLegacyVozKey = (k: string): boolean => LEGACY_RE.test(k);

export interface VozClipR14 {
  slot: VozSlotId;
  key: string;
  mime: string;
  ms: number;
  data: string;
  by: string | null;
  at: number;
}

const schema = z.object({
  step: z.string().regex(VOZ_KEY_RE),
  mime: z.string().max(VOZ_R14.mime).regex(/^audio\/[a-z0-9.+-]+(;[ a-z0-9=.,"+-]*)?$/i),
  ms: z.number().int().min(1).max(VOZ_R14.ms),
  data: z.string().min(4).max(VOZ_R14.chars).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  by: z.string().max(128).optional(),
});
const millis = (v: unknown): number =>
  typeof v === "number" ? v : v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : 0;
const isSlot = (v: string): v is VozSlotId => (VOZ_SLOTS as readonly string[]).includes(v);

/** One stored clip with its content key, or null (reported). */
export function mapVozR14(id: string, data: unknown): VozClipR14 | null {
  if (!isSlot(id)) return null;
  const r = schema.safeParse(data);
  if (!r.success) {
    reportDroppedDoc("lineups.voz", id, r.error.issues);
    return null;
  }
  return { slot: id, key: r.data.step, mime: r.data.mime, ms: r.data.ms, data: r.data.data, by: r.data.by ?? null, at: millis((data as { at?: unknown }).at) };
}

/** The clips by key (two slots for one key: the newest). */
export function vozByKey(list: readonly VozClipR14[]): Map<string, VozClipR14> {
  const m = new Map<string, VozClipR14>();
  list.forEach((c) => {
    const had = m.get(c.key);
    if (!had || c.at > had.at) m.set(c.key, c);
  });
  return m;
}

/** The voices whose content is no longer in the charla (`keysNow` = the keys of the charla's steps now) — the old
 *  step-number keys always are. The charla names them («Voz de ERIK: ya no está en el siete») and never plays them. */
export const vozOrphans = (list: readonly VozClipR14[], keysNow: ReadonlySet<string>): VozClipR14[] => list.filter((c) => isLegacyVozKey(c.key) || !keysNow.has(c.key));

/** The slot to record `key` into: its own, else a free one (null: six voices already). */
export function vozSlotFor(list: readonly VozClipR14[], key: string): VozSlotId | null {
  const own = list.find((c) => c.key === key);
  if (own) return own.slot;
  const used = new Set(list.map((c) => c.slot));
  return VOZ_SLOTS.find((s) => !used.has(s)) ?? null;
}

/** The board's voices (live while `on`: the charla is on screen). Team reads. */
export function useVozR14(lineupId: string | null, on: boolean): { clips: VozClipR14[]; loading: boolean; error: boolean } {
  const live = !!lineupId && on;
  const q = useMemo(() => collection(db, "lineups", lineupId || "-", "voz"), [lineupId]);
  const key = useMemo(() => ["lineupVozR14", lineupId ?? "-"], [lineupId]);
  const { data, isPending, error } = useFirestoreCollection(key, q, mapVozR14, live);
  return { clips: live ? (data ?? []) : [], loading: live && isPending, error: live && !!error };
}

/** Keeps `key`'s voice (re-recording replaces it; a second slot of the same key goes). Whoever may edit the board.
 *  Throws (Spanish) on a bad recording or with six voices already. */
export async function saveVoz(lineupId: string, clips: readonly VozClipR14[], key: string, rec: { mime: string; ms: number; data: string }, uid: string): Promise<void> {
  if (!isVozKey(key)) throw new Error("Esa voz no va con ningún paso de la charla.");
  if (rec.ms > VOZ_R14.ms + 500) throw new Error("La voz dura más de 30 segundos: grábala más corta.");
  if (!rec.data) throw new Error("La grabación ha salido vacía: vuelve a intentarlo.");
  if (rec.data.length > VOZ_R14.chars) throw new Error("La grabación pesa demasiado: grábala más corta.");
  const slot = vozSlotFor(clips, key);
  if (!slot) throw new Error("Ya hay voz en 6 pasos: borra una para grabar otra.");
  const batch = writeBatch(db);
  batch.set(doc(db, "lineups", lineupId, "voz", slot), { step: key, mime: rec.mime, ms: Math.min(VOZ_R14.ms, Math.max(1, Math.round(rec.ms))), data: rec.data, by: uid, at: serverTimestamp() });
  clips.filter((c) => c.key === key && c.slot !== slot).forEach((c) => batch.delete(doc(db, "lineups", lineupId, "voz", c.slot)));
  await batch.commit();
}

/** Deletes `key`'s voice (every slot holding it). */
export async function removeVoz(lineupId: string, clips: readonly VozClipR14[], key: string): Promise<void> {
  const batch = writeBatch(db);
  clips.filter((c) => c.key === key).forEach((c) => batch.delete(doc(db, "lineups", lineupId, "voz", c.slot)));
  await batch.commit();
}

/**
 * Copies every voice of board `from` onto board `to` (duplicating a board, PZ-D08): same slots and keys, signed by
 * whoever duplicates (the rules: he must be able to edit `to` — his new board). Returns how many. A failure leaves
 * the new board without voices (the caller says so): the board itself is already saved.
 */
export async function copyVoz(from: string, to: string, uid: string): Promise<number> {
  const snap = await getDocs(collection(db, "lineups", from, "voz"));
  const clips = snap.docs.map((d) => mapVozR14(d.id, d.data())).filter((c): c is VozClipR14 => c !== null);
  if (!clips.length) return 0;
  // (one clip ≈ up to 900 kB: two per batch keeps each commit under Firestore's 10 MiB request cap comfortably)
  for (let i = 0; i < clips.length; i += 2) {
    const batch = writeBatch(db);
    clips.slice(i, i + 2).forEach((c) => batch.set(doc(db, "lineups", to, "voz", c.slot), { step: c.key, mime: c.mime, ms: c.ms, data: c.data, by: uid, at: serverTimestamp() }));
    await batch.commit();
  }
  return clips.length;
}
