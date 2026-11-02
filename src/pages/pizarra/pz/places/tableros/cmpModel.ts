// r14 «La pizarra» · Comparar: the pair on screen and what each pitch shows (pure over the store's selectors).
import type { StageSpec, Token } from "../../store/types";
import type { PzApi } from "../../store/api";
import type { Tb } from "./useTb";
import { cmpHead, cmpLine, compareItems, defaultPair, itemOf, type CmpItem, type Comparison } from "./tablerosView";

export interface CmpModel {
  A: CmpItem;
  B: CmpItem;
  c: Comparison;
  head: string;
  line: string;
}

/** The pair on screen: what was picked (if it still exists), else the default. */
export function cmpModel(tb: Tb): CmpModel | null {
  const { P, U, ctx } = tb;
  const d = defaultPair(P, ctx);
  const a = itemOf(P, U.cmpA, ctx) ? U.cmpA : d[0];
  const b = itemOf(P, U.cmpB, ctx) ? U.cmpB : d[1];
  const A = itemOf(P, a, ctx);
  const B = itemOf(P, b, ctx);
  if (!A || !B) return null;
  const nm = (id: string) => P.sel.name(id);
  const c = compareItems(A, B, nm);
  return { A, B, c, head: cmpHead(c, B, nm), line: cmpLine(c, A, B, nm) };
}

const tokensOf = (P: PzApi, it: CmpItem, ring: (pid: string) => Token["ring"] | undefined): Token[] =>
  it.slots.filter((s) => s.playerId).map((s) => ({ id: "p-" + s.playerId, kind: "us", pid: s.playerId as string, x: s.x, y: s.y, label: P.sel.name(s.playerId), ring: ring(s.playerId as string) }));
const holes = (it: CmpItem) => it.slots.filter((s) => !s.playerId).map((s) => ({ x: s.x, y: s.y }));

export function specA(P: PzApi, M: CmpModel): StageSpec {
  return { source: "tokens", camera: "pizarra", chrome: false, editable: false, tokens: tokensOf(P, M.A, (pid) => (M.c.outs.includes(pid) ? "sale" : undefined)), ghost: holes(M.A) };
}
export function specB(P: PzApi, M: CmpModel): StageSpec {
  return {
    source: "tokens",
    camera: "pizarra",
    chrome: false,
    editable: false,
    tokens: tokensOf(P, M.B, (pid) => (M.c.ins.includes(pid) ? "entra" : M.c.moved.includes(pid) ? "mueve" : undefined)),
    ghost: holes(M.B),
    overlay: { paths: M.c.moved.map((pid) => ({ kind: "carrera" as const, color: "celeste" as const, pts: [[M.c.aP[pid].x, M.c.aP[pid].y] as [number, number], [M.c.bP[pid].x, M.c.bP[pid].y] as [number, number]] })) },
  };
}
/** The phone's one pitch: A, B, or both («Juntos»: B with who leaves A as ghosts and the moves as arrows). */
export function phoneSpec(P: PzApi, M: CmpModel | null, view: "a" | "juntos" | "b"): StageSpec {
  if (!M) return { source: "tokens", tokens: [], caption: "Nada que comparar", camera: "pizarra", chrome: false };
  if (view === "a") return { ...specA(P, M), caption: "A · " + M.A.short + " · " + M.A.formation };
  const s = specB(P, M);
  if (view === "juntos") {
    const extra: Token[] = M.c.outs.filter((pid) => !M.c.paired.includes(pid)).map((pid) => ({ id: "g-" + pid, kind: "ghost", pid, x: M.c.aP[pid].x, y: M.c.aP[pid].y, label: P.sel.name(pid), ring: "sale" }));
    return { ...s, tokens: [...(s.tokens ?? []), ...extra], caption: "Juntos · los cambios, en la lista" };
  }
  return { ...s, caption: "B · " + M.B.short + " · " + M.B.formation };
}
