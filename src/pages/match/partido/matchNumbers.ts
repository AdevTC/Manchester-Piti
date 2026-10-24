import { evaluateNarrated } from "../../../../functions/src/narrated/engine";
import type { AnalysisFilters, MetricResult } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import { buildAnalysisWorkspace, workspaceMetricValue, type WorkspacePerson } from "../../../lib/analysisWorkspace";
import { andList, type Score } from "./model";

const metrics = ["001", "015", "029", "030", "067", "068", "070", "105", "135", "136", "169", "201", "206", "252", "272", "295", "300", "301", "302"];
const figure = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const value = (results: Map<string, MetricResult>, id: string) => workspaceMetricValue(results.get(id));
const text = (n: number | null) => n == null ? "—" : figure.format(n);
const barMetrics = [
  ["029", "remate", "Remates", "bolt"], ["030", "apuerta", "A puerta", "post"],
  ["068", "pase", "Pases completados", "arrow"], ["206", "recup", "Recuperaciones", "swap"],
  ["201", "perdida", "Pérdidas", "close"], ["252", "corner", "Córners ejecutados", "flag"],
  ["295", "falta", "Faltas hechas", "whistle"], ["300", "amarilla", "Amarillas", "card"],
  ["301", "doble", "Expulsiones por doble amarilla", "card"], ["302", "roja", "Rojas directas", "card"],
  ["272", "parada", "Paradas", "glove"],
] as const;

/** Every match figure reads the catalogue over the same moviola scope. Never sum
 * the stored player ledger: it can be old, omit anonymous actions or double ratios. */
export function matchNumbers(match: ClubMatch, people: readonly WorkspacePerson[], filters: AnalysisFilters, score: Score) {
  const workspace = buildAnalysisWorkspace([match], people, { ...filters, team: "us" }, metrics);
  const us = workspace.total;
  const them = new Map(evaluateNarrated([match], { ...filters, playerIds: undefined, team: "opponent" }, metrics).map(r => [r.id, r]));
  const rows = [
    { k: "gol", label: "Goles", icon: "ball", us: score.us, them: score.them },
    ...barMetrics.map(([id, k, label, icon]) => ({ k, label, icon, us: value(us, id), them: value(them, id) })),
  ].map(row => {
    const max = Math.max(row.us ?? 0, row.them ?? 0, 1);
    return { ...row, usText: text(row.us), themText: text(row.them), usW: (row.us ?? 0) / max * 100, themW: (row.them ?? 0) / max * 100 };
  });
  const accuracy = us.get("070");
  const keepers = workspace.rows.filter(row => (value(row.results, "272") ?? 0) > 0).map(row => row.person.name);
  const glanceDefs = [
    { id: "029", t: "remates", d: `${text(value(us, "030"))} a puerta`, unit: "" },
    { id: "067", t: "pases", d: "intentados", unit: "" },
    { id: "070", t: "de pases completados", d: accuracy?.denominator ? `${accuracy.numerator}/${accuracy.denominator} con resultado conocido` : "Sin resultados suficientes para calcular el acierto", unit: " %" },
    { id: "206", t: "recuperaciones", d: "Las interceptaciones se consultan aparte", unit: "" },
    { id: "272", t: "paradas", d: keepers.length ? `de ${andList(keepers)}` : "Según las jugadas registradas", unit: "" },
    { id: "136", t: "regates completados", d: `de ${text(value(us, "135"))} intentados`, unit: "" },
  ];
  const glance = glanceDefs.map(item => ({ ...item, n: value(us, item.id), display: text(value(us, item.id)), status: us.get(item.id)?.status }));
  const leaders: { id: string; what: string; v: number; display: string; t: string }[] = [];
  for (const [metric, label, word, extra] of [
    ["068", "Pases completados", "pases completados", "067"], ["029", "Remates", "remates", "030"],
    ["206", "Recuperaciones", "recuperaciones", ""], ["272", "Paradas", "paradas", ""], ["001", "Minutos", "minutos", ""],
  ]) {
    const max = Math.max(0, ...workspace.rows.map(row => value(row.results, metric) ?? 0));
    if (!max) continue;
    const tied = workspace.rows.filter(row => value(row.results, metric) === max);
    for (const row of tied) {
      const more = extra ? value(row.results, extra) : null;
      leaders.push({ id: row.person.id, what: tied.length > 1 ? `${label} · compartido` : label, v: max, display: text(max), t: word + (more == null ? "" : extra === "067" ? ` de ${text(more)}` : `, ${text(more)} a puerta`) });
    }
  }
  return { rows, glance, leaders, results: us, opponentResults: them,
    partial: [...us.values(), ...them.values()].some(r => r.status !== "complete" && r.status !== "no_sample"),
  };
}
