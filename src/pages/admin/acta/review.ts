// The review («¿Cuadra?») of the acta being edited: reviewActa (data/adminLogic — the save and backend
// rules) over the sheet as reviewSheet() shows it, plus what only an acta being written can lack: a
// minute. An event written without its minute is named as such («Falta el minuto del gol 3») instead of
// counting as a missing scorer or a generic ledger error.
import { EVENT_LABELS } from "../../../../functions/src/matchEngine";
import { reviewActa, type ActaReview, type CheckItem } from "../data/adminLogic";
import { goalRows, isOurGoal, isRivalGoal, okMinute, reviewSheet, type MatchSheet, type NameOf } from "./sheetModel";

export function reviewMatch(sheet: MatchSheet, roster: readonly string[], now: number, publishedClean: boolean, nameOf: NameOf): ActaReview {
  const shown = reviewSheet(sheet);
  const noMinute = shown.events.filter((e) => !okMinute(e.minute));
  if (!noMinute.length) return reviewActa(shown, roster, now, publishedClean);
  // Review the rest (the score without those goals), then name what lacks its minute.
  const rest: MatchSheet = {
    ...shown,
    events: shown.events.filter((e) => okMinute(e.minute)),
    goalsFor: (shown.goalsFor ?? 0) - noMinute.filter(isOurGoal).length,
    goalsAgainst: (shown.goalsAgainst ?? 0) - noMinute.filter(isRivalGoal).length,
  };
  const r = reviewActa(rest, roster, now, publishedClean);
  const rows = goalRows(sheet);
  const what = (id: string) => {
    const e = noMinute.find((x) => x.id === id)!;
    const g = rows.find((x) => x.id === id);
    if (g) return `del gol ${g.n}`;
    if (e.type === "own_goal") return `del gol en propia de ${nameOf(e.playerId)}`;
    return `de «${EVENT_LABELS[e.type] ?? e.type}${e.playerId ? ` · ${nameOf(e.playerId)}` : ""}»`;
  };
  const title = noMinute.length === 1 ? `Falta el minuto ${what(noMinute[0].id)}` : `Faltan ${noMinute.length} minutos por apuntar`;
  const item: CheckItem = { key: "eventos", tone: "warn", title, detail: "Ponlo en su fila: sin minuto no se puede publicar." };
  const items = [...r.items];
  const at = items.findIndex((i) => i.key === "asistencias" || i.key === "minutos");
  items.splice(at < 0 ? items.length : at, 0, item);
  const minutos = items.findIndex((i) => i.key === "minutos");
  if (minutos >= 0) items.splice(minutos, 1);
  const reasons = [title.charAt(0).toLowerCase() + title.slice(1), ...r.reasons];
  return {
    ...r,
    items,
    cuadra: false,
    reasons,
    why: `Para publicar: ${reasons.join(" · ")}.`,
    goalsFor: shown.goalsFor ?? 0,
    goalsAgainst: shown.goalsAgainst ?? 0,
    named: r.named + noMinute.filter((e) => isOurGoal(e)).length,
    steps: r.steps.map((s) => (s.key === "acta" ? { ...s, tone: "warn", mark: "!", summary: "falta minuto" } : s.key === "publicar" ? { ...s, summary: "pendiente" } : s)),
  };
}
