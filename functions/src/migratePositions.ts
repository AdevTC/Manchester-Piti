// Decisiones puras de functions/scripts/migrate-positions.mjs (a qué proyecto apunta, cómo se cuenta),
// separadas para poder probarlas sin Firestore. Solo sintaxis borrable: Node 24 importa este .ts tal cual.

export const PROD_PROJECT = "futbolmanagement-dc6cb";
export const DEMO_PROJECT = "demo-manchester-piti";
export const DEFAULT_EMULATOR = "127.0.0.1:8080";

export type MigrationTarget =
  | { ok: true; prod: boolean; write: boolean; projectId: string; emulatorHost: string | null; label: string }
  | { ok: false; error: string };

const KNOWN_ARGS = new Set(["--write", "--prod"]);

/** Argumentos + entorno → destino efectivo, o un error que impide tocar nada. */
export function resolveMigrationTarget(argv: readonly string[], env: { FIRESTORE_EMULATOR_HOST?: string }): MigrationTarget {
  const unknown = argv.filter((a) => !KNOWN_ARGS.has(a));
  if (unknown.length > 0) {
    return { ok: false, error: `Argumento desconocido: ${unknown.join(" ")}. Solo se admiten --write y --prod.` };
  }
  const write = argv.includes("--write");
  const prod = argv.includes("--prod");
  if (prod) {
    if (env.FIRESTORE_EMULATOR_HOST !== undefined) {
      return {
        ok: false,
        error: `Has pedido --prod pero FIRESTORE_EMULATOR_HOST está definida («${env.FIRESTORE_EMULATOR_HOST}»): no sé si irías a producción o al emulador. Quítala y vuelve a lanzarla.`,
      };
    }
    return { ok: true, prod, write, projectId: PROD_PROJECT, emulatorHost: null, label: `Destino: PRODUCCIÓN · ${PROD_PROJECT}` };
  }
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST || DEFAULT_EMULATOR;
  return { ok: true, prod, write, projectId: DEMO_PROJECT, emulatorHost, label: `Destino: emulador ${emulatorHost} · ${DEMO_PROJECT}` };
}

export type WriteOutcome = "escrita" | "cambiada" | "sin confirmar" | "error";

/** Códigos gRPC que se reintentan: RESOURCE_EXHAUSTED (8) y UNAVAILABLE (14). DEADLINE_EXCEEDED (4) y ABORTED (10)
 *  no: con la precondición `lastUpdateTime`, una escritura que sí llegó fallaría al reintentarla como «cambiada». */
export const RETRY_CODES: ReadonlySet<number> = new Set([8, 14]);

/** Código gRPC de un fallo de escritura: FAILED_PRECONDITION (9) o NOT_FOUND (5) = alguien la tocó mientras tanto;
 *  DEADLINE_EXCEEDED (4) o ABORTED (10) = no se sabe si llegó (no se reintenta: hay que volver a lanzarla). */
export function classifyWriteError(code: unknown): Exclude<WriteOutcome, "escrita"> {
  if (code === 9 || code === 5) return "cambiada";
  if (code === 4 || code === 10) return "sin confirmar";
  return "error";
}

/** Una línea con los recuentos por resultado. */
export function migrationSummary(r: { total: number; planned: number; write: boolean; outcomes?: readonly WriteOutcome[] }): string {
  const count = (o: WriteOutcome) => (r.outcomes ?? []).filter((x) => x === o).length;
  const parts = [
    `a escribir ${r.planned}`,
    `escritas ${count("escrita")}`,
    `saltadas (ya tenían) ${r.total - r.planned}`,
    `cambiadas mientras tanto ${count("cambiada")}`,
    `no confirmadas ${count("sin confirmar")}`,
    `errores ${count("error")}`,
  ];
  return `${r.write ? "Resumen" : "Resumen (en seco)"}: ${parts.join(" · ")}`;
}

/** Cómo acaba una escritura: 0 solo si todas se escribieron; si alguna cambió entretanto o no se confirmó, 1 y
 *  «vuelve a lanzarla» (es idempotente: solo toca fichas que siguen sin `positions`). */
export function migrationExit(outcomes: readonly WriteOutcome[]): { code: 0 | 1; advice: string | null } {
  if (outcomes.every((o) => o === "escrita")) return { code: 0, advice: null };
  if (outcomes.includes("error")) return { code: 1, advice: "Hubo errores: revisa los mensajes de arriba y vuelve a lanzarla." };
  return { code: 1, advice: "Quedan fichas sin migrar (cambiadas mientras tanto o no confirmadas): vuelve a lanzarla." };
}
