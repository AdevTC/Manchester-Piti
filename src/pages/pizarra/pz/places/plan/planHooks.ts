// r14 «La pizarra» · Plan: the hooks the place's pieces share (its UI slice, the part on screen, the plays a set
// piece can link, the rival's row in the league table, the text drafts).
import { useState } from "react";
import type { PzApi } from "../../store/api";
import { libraryPlays } from "../../../playLibrary";
import type { Play } from "../../../plays";
import { boardSeasonPlays, useSeasonPlays } from "../../../data/seasonPlays";
import { useStandings } from "../../../../../lib/useStandings";
import { isPlanPart, type PlanPart } from "./planView";
import { PLAN_UI0, type PlanUi } from "./planPlace";
import type { PlanTable } from "./planWords";

export const usePlanUi = (P: PzApi) => {
  const s = P.slice<PlanUi>("planUi", PLAN_UI0);
  return { u: s.get() ?? PLAN_UI0, setU: (o: Partial<PlanUi>) => s.set(o, { undoable: false }) };
};
export const partOf = (P: PzApi): PlanPart => {
  const s = P.state.route.sub;
  return isPlanPart(s) ? s : "rival";
};

/** Every play a set piece can link: the board's own, the season's it uses, the built-in library. */
export function usePlanPlays(P: PzApi): Play[] {
  const b = P.sel.board();
  const sp = useSeasonPlays(P.state.W.season.id, !!b);
  if (!b) return [];
  const season = boardSeasonPlays(b.lineup.seasonPlays, sp.plays).plays.map((x) => x.play);
  return [...b.lineup.plays, ...season, ...libraryPlays(b.lineup)];
}
/** The library's ids (to say «Del equipo»). */
export const isLibraryPlay = (id: string) => id.startsWith("lib-");

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** The rival's row in the league table (null: no table, or they are not in it). */
export function usePlanTable(P: PzApi): PlanTable | null {
  const { standings } = useStandings(P.state.W.season.id);
  const M = P.sel.match();
  if (!standings || !M) return null;
  const want = norm(M.rival);
  const i = standings.rows.findIndex((r) => !r.isUs && norm(r.team) === want);
  if (i < 0) return null;
  const r = standings.rows[i];
  return { pos: i + 1, pts: r.pts, pj: r.pj, form: r.form ?? [] };
}

/** Text drafts that save on Enter / blur and forget on Escape (the prototype's `dr`). */
export function useDrafts() {
  const [dr, setDr] = useState<Record<string, string>>({});
  return {
    get: (k: string, base: string) => (dr[k] != null ? dr[k] : base),
    raw: (k: string): string | undefined => dr[k],
    set: (k: string, v: string) => setDr((d) => ({ ...d, [k]: v })),
    drop: (k: string) =>
      setDr((d) => {
        const n = { ...d };
        delete n[k];
        return n;
      }),
  };
}
