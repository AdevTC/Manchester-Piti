import { expect, test } from "@playwright/test";
import { enterVestuario } from "./helpers";

/** Only loopback demo emulators: the UI fixture never writes production or shared preview matches. */
async function emulatorAdminToken() {
  const b64 = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");
  const fake = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "preview-admin", email: "admin@piti.test", email_verified: true, name: "Administrador de pruebas", aud: "demo", iss: "https://accounts.google.com" })}.`;
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postBody: new URLSearchParams({ id_token: fake, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }),
  });
  const user = await response.json();
  if (!user.idToken) throw new Error("La cuenta del emulador no está disponible.");
  return user.idToken as string;
}
async function call(token: string, name: string, data: unknown) {
  const response = await fetch(`http://127.0.0.1:5001/demo-manchester-piti/europe-southwest1/${name}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ data }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${name}: ${JSON.stringify(body.error)}`);
  return body.result;
}

for (const mobile of [false, true]) test(`un partido terminado se archiva, consulta, reactiva y elimina ${mobile ? "en móvil" : "en escritorio"}`, async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
  const token = await emulatorAdminToken();
  await call(token, "requestAccess", { name: "Capitán" });
  const id = `lifecycle-ui-${Date.now()}-${mobile ? "m" : "d"}`;
  const rival = `Archivo E2E ${mobile ? "móvil" : "desktop"} ${Date.now()}`;
  const players = Array.from({ length: 10 }, (_, i) => `preview-player-${i}`);
  await call(token, "saveMatchSheet", { id, draft: false, sheet: {
    version: 2, revision: 0, seasonId: "preview-season", rival, competition: "Amistoso", date: Date.now() - 7 * 86400000, duration: 50, venue: "Campo de archivo", home: true, status: "finished",
    starters: players.slice(0, 7), bench: players.slice(7), notCalled: [], events: [{ id: "goal", type: "goal", playerId: players[6], assistPlayerId: players[3], assistReviewed: true, minute: 20 }], goalsFor: 1, goalsAgainst: 0, report: "Crónica conservada al archivar.",
  } });
  try {
    await enterVestuario(page);
    // A finished, published match opens on «Después» (r12); managing it is the match head's «Gestionar», on every
    // station (no need to find Datos first).
    await page.goto(`/admin/partidos/${id}`);
    // (its address stays the match's: the station of its moment draws under it)
    await expect(page.getByRole("region", { name: "Después del partido", exact: true })).toBeVisible();
    const manage = page.getByRole("button", { name: "Gestionar el partido" });
    await expect(manage).toBeInViewport();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.locator("body").evaluate((el) => el.clientWidth));
    await page.screenshot({ path: `.emulator-data/management-acta-${mobile ? "mobile" : "desktop"}.png`, fullPage: true, animations: "disabled" });
    await manage.click();
    await page.getByRole("menuitem", { name: "Archivar…" }).click();
    const archive = page.getByRole("dialog", { name: `¿Archivar el partido contra ${rival}?` });
    await expect(archive).toContainText("Conserva el acta");
    await archive.getByRole("button", { name: "Archivar partido", exact: true }).click();
    await expect(page.getByText(new RegExp(`${rival} · fuera del calendario`))).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin/partidos/archivados/${id}$`));
    await page.goto("/admin/partidos/archivados");
    await page.getByRole("searchbox", { name: "Buscar partido archivado" }).fill(rival);
    // (r12: Archivados is its own screen; the archived match, in read only, beside the list or on its own)
    await page.getByRole("link", { name: new RegExp(`^Archivado: Manchester Piti 1–0 ${rival}`) }).click();
    const pane = page.getByRole("region", { name: "El partido archivado", exact: true });
    await expect(pane.getByText("Solo lectura", { exact: true })).toBeVisible();
    await expect(pane).toContainText("Pase de Pablo");
    await expect(pane).toContainText("Mario");
    await expect(pane.getByRole("textbox")).toHaveCount(0);
    await expect(pane.getByText("Crónica conservada al archivar.", { exact: true })).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.locator("body").evaluate((el) => el.clientWidth));
    await page.screenshot({ path: `.emulator-data/archive-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    await pane.getByRole("button", { name: "Reactivar", exact: true }).click();
    await page.getByRole("dialog", { name: `¿Reactivar el partido contra ${rival}?` }).getByRole("button", { name: "Reactivar partido" }).click();
    await expect(page.getByText(`${rival} · vuelve al calendario y a las estadísticas`, { exact: true })).toBeVisible();
    // (reactivated, it opens in the calendar: the match itself)
    await expect(page).toHaveURL(new RegExp(`/admin/partidos/${id}(/|$)`));
    await page.goto(`/admin/partidos/${id}/acta`);
    await expect(page.getByRole("region", { name: "El acta del partido" })).toBeVisible();
    await page.screenshot({ path: `.emulator-data/management-published-${mobile ? "mobile" : "desktop"}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Gestionar el partido" }).click();
    await page.getByRole("menuitem", { name: "Borrar…" }).click();
    const remove = page.getByRole("alertdialog", { name: `¿Borrar el partido contra ${rival}?` });
    await expect(remove).toContainText("No se puede deshacer");
    await expect(remove).toContainText("votos, porras");
    await remove.getByRole("button", { name: "Borrar partido", exact: true }).click();
    const toast = page.getByRole("status").filter({ hasText: `${rival} · partido eliminado definitivamente` });
    await expect(page.getByText(`${rival} · partido eliminado definitivamente`, { exact: true })).toBeVisible();
    await expect(toast.getByRole("button", { name: "Deshacer" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: new RegExp(`^J\\d+, ${rival}`) })).toHaveCount(0);
  } finally {
    await call(token, "deleteMatch", { id });
  }
});
