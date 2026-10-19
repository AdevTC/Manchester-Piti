import type { MetricResult } from "../../functions/src/narrated/types";

const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
/** A missing measurement remains distinct from an observed zero. */
export function metricValue(result: MetricResult): string {
  return result.value == null ? "—" : `${number.format(result.value)}${result.unit === "%" ? "%" : result.unit && result.unit !== "count" ? ` ${result.unit}` : ""}`;
}
