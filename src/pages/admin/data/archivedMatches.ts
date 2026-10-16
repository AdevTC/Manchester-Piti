import { dateMillis, type ClubMatch } from "../../../lib/clubData";
import { mapRawMatch } from "../../../lib/firestoreMappers";
import { mergeMatches, type AdminMatch } from "./adminLogic";
import { isCompleted } from "../../../../functions/src/matchEngine";

export interface ArchivedMatch extends AdminMatch {
  archived: true;
  individuallyArchived?: boolean;
}

/** Private cache only: the canonical match mapper intentionally hides these documents. */
export function mapArchivedMatch(id: string, data: unknown) {
  const row = mapRawMatch(id, data);
  return row?.archived === true && row.deleting !== true ? row : null;
}

export function mergeArchivedMatches(published: readonly ClubMatch[], drafts: readonly (ClubMatch & { updatedAt?: unknown })[]): ArchivedMatch[] {
  // Archived matches have no active jornada: deriving one from this subset would invent a number.
  return mergeMatches(published, drafts).map((m) => ({ ...m, archived: true as const, jornada: null }))
    .sort((a, b) => dateMillis(b.date) - dateMillis(a.date));
}

/** Historical result for the private archive only; never reintroduces the match into metrics. */
export function archivedScore(match: ArchivedMatch): string | null {
  const completed = isCompleted({ ...match, archived: false, individuallyArchived: false, deleting: false });
  return completed && match.goalsFor != null && match.goalsAgainst != null ? `${match.goalsFor}–${match.goalsAgainst}` : null;
}

export function matchIdentity(match: AdminMatch): string {
  const date = dateMillis(match.date);
  const when = Number.isFinite(date)
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Madrid" }).format(date)
    : "Fecha pendiente";
  return `Manchester Piti · ${match.rival || "Rival pendiente"} · ${when} (Madrid)`;
}

export type MatchLifecycleAction = "archive" | "restore" | "delete";
export interface MatchLifecycleRequest {
  action: MatchLifecycleAction;
  match: AdminMatch;
  dirty?: boolean;
  /** Discard local edits only after the backend confirms success, never on cancellation/failure. */
  onDone?: () => void;
}
