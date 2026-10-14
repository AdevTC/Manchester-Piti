// Decisiones puras de functions/scripts/migrate-positions.mjs (a qué proyecto apunta, cómo se cuenta),
// separadas para poder probarlas sin Firestore. Solo sintaxis borrable: Node 24 importa este .ts tal cual.

export const PROD_PROJECT = "futbolmanagement-dc6cb";
export const DEMO_PROJECT = "demo-manchester-piti";
export const DEFAULT_EMULATOR = "127.0.0.1:8080";

export type MigrationTarget =
  | { ok: true; prod: boolean; write: boolean; projectId: string; emulatorHost: string | null; label: string; expect: number | null }
  | { ok: false; error: string };

/**
 * Argumentos + entorno → destino efectivo, o un error que impide tocar nada. Producción con escritura
 * pide confirmarlo todo: `--prod --write --project=<id del destino> --expect=<N a escribir>` (N se saca
 * de una pasada en seco; si no coincide con el plan, checkExpected no deja escribir).
 */
export function resolveMigrationTarget(argv: readonly string[], env: { FIRESTORE_EMULATOR_HOST?: string }): MigrationTarget {
  let write = false;
  let prod = false;
  let project: string | null = null;
  let expect: number | null = null;
  const unknown: string[] = [];
  for (const a of argv) {
    if (a === "--write") write = true;
    else if (a === "--prod") prod = true;
    else if (a.startsWith("--project=")) project = a.slice("--project=".length);
    else if (a.startsWith("--expect=")) {
      const v = a.slice("--expect=".length);
      if (!/^\d{1,6}$/.test(v)) return { ok: false, error: `--expect necesita un número entero ≥ 0 (has puesto «${v}»).` };
      expect = Number(v);
    } else unknown.push(a);
  }
  if (unknown.length > 0) {
    return { ok: false, error: `Argumento desconocido: ${unknown.join(" ")}. Solo se admiten --write, --prod, --project=<id> y --expect=<N>.` };
  }
  if (prod && env.FIRESTORE_EMULATOR_HOST !== undefined) {
    return {
      ok: false,
      error: `Has pedido --prod pero FIRESTORE_EMULATOR_HOST está definida («${env.FIRESTORE_EMULATOR_HOST}»): no sé si irías a producción o al emulador. Quítala y vuelve a lanzarla.`,
    };
  }
  const projectId = prod ? PROD_PROJECT : DEMO_PROJECT;
  if (project !== null && project !== projectId) {
    return { ok: false, error: `--project=${project} no coincide con el destino (${projectId}): no se toca nada.` };
  }
  if (prod && write) {
    if (project === null) return { ok: false, error: `--prod --write necesita --project=${PROD_PROJECT} para confirmar el destino.` };
    if (expect === null) return { ok: false, error: "--prod --write necesita --expect=<N> con cuántos documentos va a escribir: lánzala antes en seco (sin --write) y copia «a escribir»." };
  }
  if (prod) return { ok: true, prod, write, projectId, emulatorHost: null, label: `Destino: PRODUCCIÓN · ${PROD_PROJECT}`, expect };
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST || DEFAULT_EMULATOR;
  return { ok: true, prod, write, projectId, emulatorHost, label: `Destino: emulador ${emulatorHost} · ${DEMO_PROJECT}`, expect };
}

/** `--expect=N` frente al plan: null si se puede escribir (sin --expect, o coincide), o el porqué de no hacerlo. */
export function checkExpected(expect: number | null, planned: number): string | null {
  if (expect === null || expect === planned) return null;
  return `--expect=${expect} pero el plan tiene ${planned} a escribir: no se escribe nada. Revisa el plan de arriba y vuelve a lanzarla.`;
}

/**
 * El proyecto de la credencial que usaría el admin SDK fuera del emulador, si se sabe sin red: la variable
 * GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT, o el project_id / quota_project_id del fichero de credenciales
 * (GOOGLE_APPLICATION_CREDENTIALS o el ADC por defecto de gcloud). `read` devuelve el texto o null.
 */
export function credentialProject(
  env: { GOOGLE_CLOUD_PROJECT?: string; GCLOUD_PROJECT?: string; GOOGLE_APPLICATION_CREDENTIALS?: string; APPDATA?: string; HOME?: string; USERPROFILE?: string },
  read: (path: string) => string | null,
): string | null {
  const fromEnv = env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT;
  if (fromEnv) return fromEnv;
  const home = env.HOME || env.USERPROFILE;
  const file =
    env.GOOGLE_APPLICATION_CREDENTIALS ||
    (env.APPDATA ? `${env.APPDATA}/gcloud/application_default_credentials.json` : home ? `${home}/.config/gcloud/application_default_credentials.json` : null);
  const text = file ? read(file) : null;
  if (!text) return null;
  try {
    const json: unknown = JSON.parse(text);
    if (!json || typeof json !== "object") return null;
    const o = json as { project_id?: unknown; quota_project_id?: unknown };
    const id = typeof o.project_id === "string" ? o.project_id : typeof o.quota_project_id === "string" ? o.quota_project_id : null;
    return id || null;
  } catch {
    return null;
  }
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
