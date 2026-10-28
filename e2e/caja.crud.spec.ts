// ── /admin/caja (r12 «Caja»): every write against the real rules — the settings, a cuota, a pago with the id made
// in the browser (shown at once, written after «Deshacer»), «Anular», a payment notice confirmed (its pago in the
// same batch) and one rejected with its reason (M-20), and the cost of a match split among who played ──
import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";

const DB = "http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents";
const OWNER = { authorization: "Bearer owner", "content-type": "application/json" };
/** The franja's «Deshacer» window (5.2 s) and the write after it. */
const UNDO = 6500;

/** A member's «Ya la he pagado», put straight in the emulator (the member's own write is the vestuario's spec). */
async function putClaim(id: string, playerId: string, concept: string, amount: number) {
  const fields = {
    uid: { stringValue: `uid-${playerId}` },
    playerId: { stringValue: playerId },
    seasonId: { stringValue: "preview-season" },
    concept: { stringValue: concept },
    amount: { integerValue: String(amount) },
    at: { timestampValue: new Date(Date.now() - 3_600_000).toISOString() },
    status: { stringValue: "pendiente" },
  };
  const r = await fetch(`${DB}/cajaClaims/${id}`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`No se ha podido crear el aviso: HTTP ${r.status}`);
}
async function readDoc(path: string): Promise<Record<string, { stringValue?: string; integerValue?: string; booleanValue?: boolean }>> {
  const r = await fetch(`${DB}/${path}`, { headers: OWNER });
  const body = (await r.json()) as { fields?: Record<string, { stringValue?: string; integerValue?: string; booleanValue?: boolean }> };
  return body.fields ?? {};
}

async function openCaja(page: Page, path = "/admin/caja") {
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}season=preview-season`);
  await expect(page.getByRole("heading", { level: 1, name: path.includes("coste") ? "Coste del partido" : "Caja" })).toBeAttached();
}
const shots = process.env.CAJA_SHOTS;
async function shoot(page: Page, name: string) {
  if (!shots) return;
  for (const theme of ["dark", "light"]) {
    await page.evaluate((t) => localStorage.setItem("mp_theme", t), theme);
    await page.reload();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${shots}/${name}-${page.viewportSize()?.width}-${theme}.png` });
  }
}

test("la caja apunta al momento, deshace, anula y responde a los avisos con las reglas de verdad", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterVestuario(page);
  await openCaja(page);

  // Ajustes: la cuota y «Cómo pagar», guardados tras su «Deshacer»
  await page.getByRole("button", { name: "Ajustes" }).click();
  const ajustes = page.getByRole("dialog", { name: /^Ajustes de la caja/ });
  await ajustes.getByLabel("Cuota por jugador").fill("25");
  await ajustes.getByLabel("Cómo pagar").fill("Bizum al 600 000 000 (capitán)");
  await ajustes.getByRole("button", { name: "Guardar los ajustes" }).click();
  const bote = page.getByRole("region", { name: /^El bote/ });
  await expect(bote).toContainText("25 € por temporada");
  await page.waitForTimeout(UNDO);
  await openCaja(page);
  await expect(bote).toContainText("Cómo pagar: Bizum al 600 000 000 (capitán)");

  // Cobrar la cuota: un cargo por jugador (una vez: un reintento la encuentra cobrada)
  await page.getByRole("button", { name: "Cobrar cuota" }).first().click();
  const cuota = page.getByRole("dialog", { name: "Cobrar la cuota" });
  if (await cuota.getByText("Ya cobrada").isVisible()) await cuota.getByRole("button", { name: "Cancelar" }).click();
  else {
    await cuota.getByRole("button", { name: /^Cobrar a \d+ jugadores$/ }).click();
    await page.waitForTimeout(UNDO);
  }
  await openCaja(page);
  const saldos = page.getByRole("list", { name: "Saldos" });
  await expect(saldos.getByRole("listitem").filter({ hasText: "Dani" })).toContainText(/Debe 25.€|Al día|A favor/);

  // Un pago desde su «+», con su deuda puesta
  await page.getByRole("button", { name: "Apuntar un pago de Marcos" }).click();
  const pago = page.getByRole("dialog", { name: "Apuntar un pago" });
  await expect(pago.getByLabel("Jugador")).toHaveValue("preview-player-2");
  if (!(await pago.getByLabel("Importe").inputValue())) await pago.getByLabel("Importe").fill("25");
  await pago.getByRole("button", { name: "Apuntar el pago" }).click();
  await expect(saldos.getByRole("listitem").filter({ hasText: "Marcos" })).toContainText(/Al día|A favor/);
  await page.waitForTimeout(UNDO);
  await openCaja(page);
  await expect(saldos.getByRole("listitem").filter({ hasText: "Marcos" })).toContainText(/Al día|A favor/);

  // Anular: pregunta, y el movimiento queda tachado con quién
  await page.getByRole("button", { name: /^Anular Bizum, pago de Marcos/ }).first().click();
  await page.getByRole("alertdialog", { name: "¿Anular «Bizum»?" }).getByRole("button", { name: "Anular" }).click();
  await expect(page.getByRole("list", { name: "Movimientos" })).toContainText("Anulado por capi_prueba");

  // Los avisos de pago: uno confirmado (su pago en el mismo lote), otro rechazado con su motivo
  await putClaim("e2e-ok", "preview-player-3", "Cuota de prueba", 2500);
  await putClaim("e2e-no", "preview-player-4", "Cuota de prueba", 2500);
  await openCaja(page);
  const queue = page.getByRole("list", { name: "Pagos avisados por confirmar" });
  await queue.getByRole("button", { name: /^Confirmar: Pablo/ }).click();
  await queue.getByRole("button", { name: /^Rechazar: Sergio/ }).click();
  const no = page.getByRole("alertdialog", { name: "¿Rechazar el pago avisado de Sergio?" });
  await no.getByLabel("Motivo · opcional").fill("No me ha llegado el Bizum");
  await no.getByRole("button", { name: "Rechazar el aviso" }).click();
  await page.waitForTimeout(UNDO);
  const ok = await readDoc("cajaClaims/e2e-ok");
  expect(ok.status?.stringValue).toBe("confirmado");
  const mov = await readDoc(`cajaMovs/${ok.movId?.stringValue}`);
  expect(mov.kind?.stringValue).toBe("pago");
  expect(mov.playerId?.stringValue).toBe("preview-player-3");
  const rejected = await readDoc("cajaClaims/e2e-no");
  expect(rejected.status?.stringValue).toBe("rechazado");
  expect(rejected.reason?.stringValue).toBe("No me ha llegado el Bizum");
  await openCaja(page);
  await expect(page.getByRole("list", { name: "Pagos avisados resueltos" })).toContainText("«No me ha llegado el Bizum»");
  await shoot(page, "caja");

  // El coste del partido: a partes iguales entre los que jugaron
  await openCaja(page, "/admin/caja/coste/preview-finished");
  const charged = page.getByText(/^Ya está cargado/);
  if (!(await charged.isVisible())) {
    await page.getByLabel("Campo y árbitro (total)").fill("70");
    await page.getByRole("button", { name: /^Cargar a \d+ jugadores$/ }).first().click();
    await page.waitForTimeout(UNDO);
  }
  await openCaja(page, "/admin/caja/coste/preview-finished");
  await expect(page.getByText(/Ya está cargado: \d+ cargos/)).toBeVisible();
  await shoot(page, "coste");
  await page.setViewportSize({ width: 390, height: 844 });
  await openCaja(page);
  await shoot(page, "caja");
});
