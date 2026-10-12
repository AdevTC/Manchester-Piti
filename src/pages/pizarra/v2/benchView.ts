// How the bench is shown in the Convocatoria (desktop): FUT list rows or cromos. A per-device
// convenience, remembered in localStorage (never required: private windows and blocked storage just get
// the default).
export type BenchView = "lista" | "cromos";

export const BENCH_VIEW_KEY = "mp_pizarra_v2_bench";

export function readBenchView(): BenchView {
  try {
    return localStorage.getItem(BENCH_VIEW_KEY) === "cromos" ? "cromos" : "lista";
  } catch {
    return "lista";
  }
}

export function writeBenchView(v: BenchView): void {
  try {
    localStorage.setItem(BENCH_VIEW_KEY, v);
  } catch {
    // storage unavailable: the choice lasts this visit only
  }
}
