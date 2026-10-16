// Plantilla's «Sancionado», pure (tested in sanctionLogic.test.ts): who is suspended in the season (the acta's
// red cards and the sanctions set by hand, chemistry.suspensions), the matches a sanction can run until, the
// inline form checked into the players/{id}.sanction write, and its words (the toast, the ficha's status line,
// the list's marker). Router-, React- and Firebase-free.
import { dateMillis } from "../../../../functions/src/matchEngine";
import { SANCTION_LIMITS, type PlayerDoc } from "../../../lib/schemas";
import { suspensions, type Suspension } from "../../pizarra/chemistry";
import { jLabel, shortDate, type AdminMatch } from "../data/adminLogic";
import { plural } from "../../../lib/derived/words";


/** The season's suspensions as the pizarra reads them (published matches, newest first). */
export function seasonSuspensions(matches: readonly AdminMatch[], seasonId: string | undefined, players: readonly PlayerDoc[]): Map<string, Suspension> {
  const season = matches.filter((m) => m.published && (!seasonId || m.seasonId === seasonId)).sort((a, b) => (dateMillis(b.date) || 0) - (dateMillis(a.date) || 0));
  return suspensions(season, players);
}

/** «Hasta la J…»: the season's published matches still to play (scheduled, ahead), the next ten. */
export function upcomingFor(matches: readonly AdminMatch[], seasonId: string | undefined, now: number): AdminMatch[] {
  return matches
    .filter((m) => m.published && (!seasonId || m.seasonId === seasonId) && m.status === "scheduled" && dateMillis(m.date) > now)
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))
    .slice(0, SANCTION_LIMITS.games);
}
/** «J8 · MAD SKY · dom 8 nov». */
export const untilLabel = (m: AdminMatch): string => `${jLabel(m)} · ${m.rival || "Rival"} · ${shortDate(dateMillis(m.date))}`;

/** The inline form: a number of matches or «hasta la J…», and a reason. */
export interface SanctionForm {
  mode: "games" | "until";
  /** As typed. */
  games: string;
  untilId: string;
  reason: string;
}
export const sanctionForm = (upcoming: readonly AdminMatch[]): SanctionForm => ({ mode: "games", games: "1", untilId: upcoming[0]?.id ?? "", reason: "" });

/** A checked form: what the write carries (null = not set; a merge write keeps old keys otherwise). */
export interface SanctionChoice {
  games: number;
  untilMatchId: string | null;
  reason: string | null;
}
/** The form checked: the choice, or what is wrong in words. «Hasta la J…» counts the matches up to it. */
export function checkSanction(form: SanctionForm, upcoming: readonly AdminMatch[]): { ok: true; choice: SanctionChoice } | { ok: false; error: string } {
  const reason = form.reason.trim();
  if (reason.length > SANCTION_LIMITS.reason) return { ok: false, error: `El motivo, como mucho ${SANCTION_LIMITS.reason} letras.` };
  if (form.mode === "until") {
    const at = upcoming.findIndex((m) => m.id === form.untilId);
    if (at < 0) return { ok: false, error: "Elige hasta qué partido." };
    return { ok: true, choice: { games: at + 1, untilMatchId: upcoming[at].id, reason: reason || null } };
  }
  const n = Number(form.games.trim());
  if (!form.games.trim() || !Number.isInteger(n) || n < 1 || n > SANCTION_LIMITS.games) return { ok: false, error: `Entre 1 y ${SANCTION_LIMITS.games} partidos.` };
  return { ok: true, choice: { games: n, untilMatchId: null, reason: reason || null } };
}

/** players/{id}.sanction as written (firestore.rules: by == the admin, games 1–10, reason ≤ 80, id ≤ 128). */
export interface SanctionWrite extends SanctionChoice {
  from: number;
  by: string;
}
export const sanctionWrite = (choice: SanctionChoice, now: number, uid: string): SanctionWrite => ({ ...choice, from: now, by: uid });
/** The doc as the list shows it while the write waits behind «Deshacer» (the nulls left out, as a read leaves them). */
export function sanctionedDoc(doc: PlayerDoc, s: SanctionWrite): PlayerDoc {
  return { ...doc, sanction: { games: s.games, from: s.from, by: s.by, ...(s.untilMatchId ? { untilMatchId: s.untilMatchId } : {}), ...(s.reason ? { reason: s.reason } : {}) } };
}
/** «Levantar la sanción»: no manual sanction, and the acta's red cards up to now no longer count. */
export const liftWrite = (now: number): { sanction: null; sanctionClearedAt: number } => ({ sanction: null, sanctionClearedAt: now });
export const liftedDoc = (doc: PlayerDoc, now: number): PlayerDoc => ({ ...doc, sanction: undefined, sanctionClearedAt: now });

/** «ERIK, sancionado 2 partidos» / «ERIK, sancionado hasta la J8 · Federación». */
export function sanctionToast(name: string, choice: SanctionChoice, matches: readonly AdminMatch[]): string {
  const until = choice.untilMatchId ? matches.find((m) => m.id === choice.untilMatchId) : undefined;
  const what = until ? `hasta la ${jLabel(until)}` : plural(choice.games, "partido", "partidos");
  return `${name}, sancionado ${what}${choice.reason ? ` · ${choice.reason}` : ""}`;
}

/** The ficha's line: «Sancionado · quedan 2 partidos (hasta la J8) · Federación» / «… · por expulsión». */
export function sanctionStatus(s: Suspension, matches: readonly AdminMatch[]): string {
  const until = s.untilMatchId ? matches.find((m) => m.id === s.untilMatchId) : undefined;
  const left = s.left === 1 ? "queda 1 partido" : `quedan ${s.left} partidos`;
  const why = s.reason ?? (s.source === "acta" ? "por expulsión" : "");
  return `Sancionado · ${left}${until ? ` (hasta la ${jLabel(until)})` : ""}${why ? ` · ${why}` : ""}`;
}
