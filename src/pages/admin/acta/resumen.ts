// «Preparar resumen con los datos del acta» (pure): two lines for the crónica from the acta — the result
// and where, the competition and day, who scored (minutes, penalties, free kicks, rival own goals) and
// who assisted. Before the match is played it writes the previa instead.
import { clockTime, shortDate } from "../data/adminLogic";
import { goalRows, score, type MatchSheet } from "./sheetModel";

const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const min = (m: number | undefined) => (m === undefined ? "" : `${m}′`);

export function buildResumen(sheet: MatchSheet, nameOf: (id: string) => string): string {
  const rival = sheet.rival.trim() || "el rival";
  const day = Number.isFinite(sheet.date) ? shortDate(sheet.date) : "";
  const comp = sheet.competition.trim();
  if (sheet.status !== "finished") {
    const when = day ? ` el ${day} a las ${clockTime(sheet.date)}` : "";
    return `Previa: el Piti ${sheet.home ? `recibe a ${rival}` : `visita a ${rival}`}${when}${comp ? ` (${comp})` : ""}.`;
  }
  const { gf, ga } = score(sheet);
  const verb = gf > ga ? `ganó ${gf}–${ga} a` : gf === ga ? `empató ${gf}–${ga} con` : `perdió ${gf}–${ga} contra`;
  const head = `El Piti ${verb} ${rival} ${sheet.home ? "en casa" : "fuera"}${comp || day ? ` (${[comp, day].filter(Boolean).join(", ")})` : ""}.`;
  // Goals by scorer, in the order written down.
  const by = new Map<string, string[]>();
  const own: string[] = [];
  for (const g of goalRows(sheet)) {
    const tag = [min(g.minute), g.kind === "goal_penalty" ? "de penalti" : g.kind === "goal_freekick" ? "de falta" : ""].filter(Boolean).join(", ");
    if (g.kind === "og") own.push(tag);
    else if (g.scorer) by.set(g.scorer, [...(by.get(g.scorer) ?? []), tag]);
  }
  const parts = [...by.entries()].map(([id, tags]) => {
    const t = tags.filter(Boolean);
    if (tags.length > 1) return `${nameOf(id)} marcó ${tags.length}${t.length ? ` (${andList(t)})` : ""}`;
    return `${nameOf(id)} marcó${t[0] ? ` en el ${t[0]}` : ""}`;
  });
  if (own.length) parts.push(own.length > 1 ? `${rival} se marcó ${own.length} en propia` : `${rival} se marcó uno en propia${own[0] ? ` (${own[0]})` : ""}`);
  const assists = [...new Set(goalRows(sheet).flatMap((g) => (g.assist ? [nameOf(g.assist)] : [])))];
  return [head, parts.length ? `${parts.join("; ")}.` : "", assists.length ? `Asistencias de ${andList(assists)}.` : ""].filter(Boolean).join(" ");
}
