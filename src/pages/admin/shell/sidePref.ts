// The side menu's fold, per user (localStorage `mp_admin_side:<uid>`): "auto" folds to icons between
// 1000 and 1199 px and opens from 1200 px; the «Plegar menú» button pins it ("col" / "exp").
import { useCallback, useState } from "react";

export type SidePref = "auto" | "col" | "exp";
const key = (uid: string | undefined) => `mp_admin_side:${uid ?? "anon"}`;

export function readSidePref(uid: string | undefined): SidePref {
  try {
    const v = window.localStorage.getItem(key(uid));
    return v === "col" || v === "exp" ? v : "auto";
  } catch {
    return "auto";
  }
}
/** Whether the menu shows icons only at this frame width. */
export const sideCollapsed = (pref: SidePref, width: number) => pref === "col" || (pref === "auto" && width < 1200);
/** The root class the CSS folds the menu with: explicit `sdc`, automatic `sda`, open "". */
export const sideClass = (pref: SidePref) => (pref === "col" ? "sdc" : pref === "auto" ? "sda" : "");

export function useSidePref(uid: string | undefined, width: number) {
  const [pref, setPref] = useState<SidePref>(() => readSidePref(uid));
  const collapsed = sideCollapsed(pref, width);
  const toggle = useCallback(() => {
    const next: SidePref = collapsed ? "exp" : "col";
    setPref(next);
    try {
      window.localStorage.setItem(key(uid), next);
    } catch {
      /* this visit only */
    }
  }, [collapsed, uid]);
  return { pref, collapsed, toggle, className: sideClass(pref) };
}
