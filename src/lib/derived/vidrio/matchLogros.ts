// «Vidrio» · the logros a match unlocked (the acta's chips on Partidos: «Debut, para los 9 que jugaron»,
// «Primer gol, Alcides»): the medals of derived/achievements whose threshold was crossed in this very match,
// for the players who were on its acta, grouped by medal, in the catalogue's order. Public data only (the
// acta's players and the closed MVP votes), the same rule as the perfil's vitrina. Pure.
import type { ClubMatch } from "../../clubData";
import { achievements, type AchievementFamily, type AchievementsCtx } from "../achievements";

export interface MatchLogro {
  /** The medal (achievements' id). */
  id: string;
  family: AchievementFamily;
  /** «Debut, para los 9 que jugaron» · «Primer gol, Alcides» · «Hat-trick, Kevin». */
  text: string;
  icon: "trophy" | "ball" | "glove" | "star";
  players: string[];
}

const ICON: Partial<Record<AchievementFamily, MatchLogro["icon"]>> = { goles: "ball", hattrick: "ball", doblete: "ball", racha: "ball", cero: "glove", mvp: "star" };

/** Who was on `match`'s acta: the ledger's players who played, else the convocatoria. */
export function actaPlayers(match: Pick<ClubMatch, "ledger" | "starters" | "bench">): string[] {
  const ledger = match.ledger ? Object.entries(match.ledger).filter(([, row]) => row?.played === true).map(([id]) => id) : [];
  const ids = ledger.length ? ledger : [...(match.starters ?? []), ...(match.bench ?? [])];
  return [...new Set(ids)].filter((id) => !id.startsWith("guest:"));
}

/** The logros `match` unlocked, at most `max`, over every match of the club (`matches`). */
export function matchLogros(match: ClubMatch, matches: ClubMatch[], nameOf: (id: string) => string, ctx: AchievementsCtx, max = 3): MatchLogro[] {
  const who = actaPlayers(match);
  const byMedal = new Map<string, { family: AchievementFamily; label: string; order: number; players: string[] }>();
  for (const pid of who) {
    achievements(pid, matches, ctx).forEach((a, order) => {
      if (!a.earned || a.at?.matchId !== match.id) return;
      const g = byMedal.get(a.id) ?? { family: a.family, label: a.label, order, players: [] };
      g.players.push(pid);
      byMedal.set(a.id, g);
    });
  }
  const list = (ids: string[]) => new Intl.ListFormat("es", { type: "conjunction" }).format(ids.map(nameOf));
  return [...byMedal.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .slice(0, max)
    .map(([id, g]) => ({
      id,
      family: g.family,
      icon: ICON[g.family] ?? "trophy",
      players: g.players,
      text: `${g.label}, ${g.players.length > 3 ? (g.players.length === who.length ? `para los ${who.length} que jugaron` : `para ${g.players.length}`) : list(g.players)}`,
    }));
}
