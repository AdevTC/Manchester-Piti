import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";
import { adminUid, clearAdminBoards, fsDelete, fsGet, fsList, fsPatch, fsSet, NEXT, PLAYERS, pizarraUrl, SEASON } from "./pizarraKit";

// r14 «La pizarra» end to end: la pachanga (from a confirmed training: Mezclar, «Guardar quién vino»), la charla (from
// the first step to «¡Vamos, Piti!» and out with Esc) and la vista de la afición (the public, read-only link: on, opened
// without a session, off → «ya no funciona»). Each test writes what it needs with the emulator's owner REST and takes it
// away at the end, so a retry or a second run starts from the same place.

/** Signs in as the seeded captain and opens a pizarra address. (The kit's enterPizarra waits on a strict `.pz`, which
 * also matches the frame's floating layer `.pz.pz-float`: the page itself is `.pz-s`.) */
async function enterPizarra(page: Page, path: string, query: Record<string, string> = {}): Promise<void> {
  await enterVestuario(page);
  await page.goto(pizarraUrl(path, query));
  await expect(page.locator(".pz.pz-s")).toBeVisible();
}

// the 2-3-1 (functions/src/formations.ts), keeper first: the seven seeded players placed on it
const SPOTS: [string, "POR" | "DEF" | "MED" | "DEL", number, number][] = [
  ["POR", "POR", 50, 95],
  ["DFC", "DEF", 30, 74],
  ["DFC", "DEF", 70, 74],
  ["MI", "MED", 17, 49],
  ["MC", "MED", 50, 50],
  ["MD", "MED", 83, 49],
  ["DC", "DEL", 50, 22],
];

/** A board of the seeded captain for the next match (not official), its seven placed: lineupToData's shape. */
async function seedBoard(id: string, name: string): Promise<void> {
  const now = new Date();
  await fsSet(`lineups/${id}`, {
    formation: "2-3-1",
    freeMode: false,
    slots: SPOTS.map(([position, zone, x, y], i) => ({ slotId: `pz-slot-${i}`, playerId: PLAYERS[i], position, zone, x, y })),
    roles: { captainId: PLAYERS[3] },
    tactics: {},
    playerPositions: {},
    drawings: [],
    plays: [],
    ownerUid: await adminUid(),
    ownerNickname: "capi_prueba",
    seasonId: SEASON,
    name,
    isOfficial: false,
    matchId: NEXT,
    createdAt: now,
    updatedAt: now,
  });
}
/** Deletes a board and, if it still has a fan link, the fan view the server built for it. */
async function dropBoard(id: string): Promise<void> {
  const b = await fsGet(`lineups/${id}`);
  if (typeof b?.fanToken === "string") await fsDelete(`fanBoards/${b.fanToken}`);
  for (const sub of ["reactions", "history", "voz"]) for (const d of await fsList(`lineups/${id}/${sub}`)) await fsDelete(`lineups/${id}/${sub}/${d}`);
  await fsDelete(`lineups/${id}`);
}

// ── la pachanga: a confirmed training with its «voy» ──
const TRAINING = "e2e-pachanga-entreno";
const VOTERS = PLAYERS.slice(0, 8);
// (the callable, its trigger and a cold dev server: three times the usual time)
test.beforeEach(() => test.slow());
async function seedTraining(): Promise<void> {
  const at = new Date(Date.now() + 60 * 60_000);
  const end = new Date(at.getTime() + 90 * 60_000);
  await fsSet(`trainings/${TRAINING}`, {
    slots: [{ id: "s1", at, end, place: "Campo de pruebas" }],
    note: "Pachanga de prueba",
    proposedBy: "preview-admin",
    proposedByName: "Capitán",
    lastSlotAt: at,
    createdAt: new Date(),
    confirmed: { slotId: "s1", at, end, place: "Campo de pruebas", byName: "Capitán", by: "preview-admin" },
  });
  for (const [i, pid] of VOTERS.entries()) await fsSet(`trainings/${TRAINING}/votes/e2e-voter-${i}`, { slotIds: ["s1"], name: "Jugador " + i, playerId: pid });
}
async function dropTraining(): Promise<void> {
  await fsDelete(`trainingAttendance/${TRAINING}`);
  for (const id of await fsList(`trainings/${TRAINING}/votes`)) await fsDelete(`trainings/${TRAINING}/votes/${id}`);
  await fsDelete(`trainings/${TRAINING}`);
}
/** The teams as they are on screen: each team's names, sorted, so only who is with whom counts. */
async function teams(page: Page): Promise<string[]> {
  return page.locator(".pg-team").evaluateAll((els) => els.map((e) => [...e.querySelectorAll(".pg-p__t b")].map((b) => b.textContent ?? "").sort().join(",")).sort());
}

test("pachanga: del entreno confirmado salen los equipos, Mezclar los cambia y el capitán guarda quién vino", async ({ page }) => {
  await dropTraining();
  await seedTraining();
  try {
    await enterPizarra(page, "/pizarra/pachanga");
    // the eight who said «voy» make two teams
    await expect(page.locator(".pg-team")).toHaveCount(2);
    await expect(page.locator(".pg-team .pg-p")).toHaveCount(VOTERS.length);
    const before = await teams(page);

    // Mezclar: the teams change (the draw can repeat itself: a few goes at most)
    const mezclar = page.getByRole("button", { name: "Mezclar", exact: true }).first();
    let after = before;
    for (let k = 0; k < 6 && after.join("|") === before.join("|"); k++) {
      await mezclar.click();
      await expect.poll(async () => (await teams(page)).length).toBe(2);
      after = await teams(page);
    }
    expect(after.join("|")).not.toBe(before.join("|"));
    await expect(page.locator(".pg-team .pg-p")).toHaveCount(VOTERS.length);

    // the captain saves who came: it is the training's attendance
    await page.getByRole("button", { name: "Guardar quién vino" }).click();
    await expect.poll(async () => (await fsGet(`trainingAttendance/${TRAINING}`))?.slotId ?? null).toBe("s1");
    const saved = await fsGet(`trainingAttendance/${TRAINING}`);
    expect([...((saved?.present as string[]) ?? [])].sort()).toEqual([...VOTERS].sort());
    expect(saved?.by).toBe(await adminUid());
    await expect(page.getByRole("heading", { name: "Asistencia" }).locator("xpath=following-sibling::p")).toHaveText("Guardada");
  } finally {
    await dropTraining();
  }
});

test.only("charla: empieza, pasa por todos los pasos hasta «¡Vamos, Piti!» y Esc vuelve al siete", async ({ page }) => {
  const board = "e2e-charla-tablero";
  await clearAdminBoards();
  await seedBoard(board, "E2E · La charla");
  page.on("console", (m) => console.log("[DBG console]", m.type(), m.text().slice(0, 300)));
  page.on("pageerror", (e) => console.log("[DBG pageerror]", e.message.slice(0, 500)));
  page.on("framenavigated", (f) => f === page.mainFrame() && console.log("[DBG nav]", f.url()));
  await enterVestuario(page);
  await page.goto(pizarraUrl("/pizarra/siete", { tablero: board }));
  for (let k = 0; k < 6; k++) {
    await page.waitForTimeout(2500);
    const r = await Promise.race([page.evaluate(() => document.querySelector(".pz-s")?.className + " | " + document.body.innerText.slice(0, 300)), new Promise((res) => setTimeout(() => res("HUNG"), 4000))]);
    console.log("[DBG probe siete]", k, r);
  }
  await page.goto(pizarraUrl("/pizarra/charla", { tablero: board }));
  for (let k = 0; k < 6; k++) {
    await page.waitForTimeout(2500);
    const r = await Promise.race([page.evaluate(() => document.querySelector(".pz-s")?.className + " | " + document.body.innerText.slice(0, 300)), new Promise((res) => setTimeout(() => res("HUNG"), 4000))]);
    console.log("[DBG probe charla]", k, r);
  }
  try {
    await enterPizarra(page, "/pizarra/charla", { tablero: board });
    await expect(page.getByRole("region", { name: "La charla: así va, antes de empezar" })).toBeVisible();
    await page.getByRole("button", { name: "Empezar la charla" }).click();

    // the presentation: step 1 of N, then every step with ›
    const talk = page.getByRole("region", { name: /^La charla · paso \d+ de \d+$/ });
    await expect(talk).toHaveAccessibleName(/^La charla · paso 1 de \d+$/);
    const total = Number((await talk.getAttribute("aria-label"))?.match(/de (\d+)$/)?.[1]);
    expect(total).toBeGreaterThan(7);
    const controls = page.getByRole("toolbar", { name: "Controles de la charla" });
    const next = controls.getByRole("button", { name: "Paso siguiente" });
    for (let k = 0; k < total && (await next.isEnabled()); k++) await next.click();
    await expect(next).toBeDisabled();
    await expect(talk).toHaveAccessibleName(`La charla · paso ${total} de ${total}`);
    await expect(page.getByRole("heading", { level: 1, name: "¡Vamos, Piti!" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Momento de la charla" })).toHaveAttribute("aria-valuenow", String(total));

    // Esc leaves to the Siete (the same board, the same season)
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/pizarra\/siete\?/);
    expect(new URL(page.url()).searchParams.get("season")).toBe(SEASON);
    await expect(talk).toHaveCount(0);
  } finally {
    await dropBoard(board);
  }
});

test("vista de la afición: se enciende en Compartir, se abre sin cuenta (solo lectura) y al apagarla ya no funciona", async ({ page, browser }) => {
  const board = "e2e-aficion-tablero";
  await clearAdminBoards();
  await seedBoard(board, "E2E · Para la afición");
  // a surname the fan view must never show
  await fsPatch(`players/${PLAYERS[0]}`, { lastName: "Apellidodeprueba" });
  const fan = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    await enterPizarra(page, "/pizarra/siete", { tablero: board, hoja: "compartir" });
    const sheet = page.getByRole("dialog", { name: "Compartir" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("tab", { name: "Enlace y QR" }).click();
    const toggle = sheet.getByRole("button", { name: "Vista para la afición, de solo lectura" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toBeEnabled();

    // on: the callable stamps a token on the board and the server writes its public snapshot
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
    await expect(sheet.getByRole("button", { name: "Copiar el enlace de la afición" })).toBeVisible();
    let token = "";
    await expect.poll(async () => (token = String((await fsGet(`lineups/${board}`))?.fanToken ?? "")), { timeout: 20_000 }).toMatch(/^[A-Za-z0-9_-]{24}$/);
    await expect.poll(async () => (await fsGet(`fanBoards/${token}`)) !== null, { timeout: 20_000 }).toBe(true);

    // opened without a session: the seven on a pitch, read-only, no surnames, no owner
    const anon = await fan.newPage();
    await anon.goto(`/aficion/${token}`);
    await expect(anon.getByRole("heading", { level: 1, name: "Los siete" })).toBeVisible({ timeout: 20_000 });
    await expect(anon.getByText("E2E · Para la afición")).toBeVisible();
    const pitch = anon.getByRole("img", { name: /^El siete en el campo, 2-3-1: / });
    await expect(pitch).toBeVisible();
    await expect(pitch).toHaveAccessibleName(/1 Álex, POR/);
    await expect(pitch).toHaveAccessibleName(/Pablo, MI, capitán/);
    await expect(anon.locator("body")).not.toContainText("Apellidodeprueba");
    await expect(anon.locator("body")).not.toContainText("capi_prueba");
    await expect(anon.getByRole("button", { name: /Guardar|Publicar|Compartir/ })).toHaveCount(0);
    await expect(anon.getByRole("link", { name: "El partido" })).toBeVisible();

    // off: the token goes, and the same link no longer works
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false", { timeout: 20_000 });
    await expect.poll(async () => (await fsGet(`lineups/${board}`))?.fanToken ?? null, { timeout: 20_000 }).toBeNull();
    await expect.poll(async () => (await fsGet(`fanBoards/${token}`)) === null, { timeout: 20_000 }).toBe(true);
    await anon.goto(`/aficion/${token}`);
    await expect(anon.getByRole("heading", { level: 1, name: "Este enlace ya no funciona" })).toBeVisible({ timeout: 20_000 });
    await expect(anon.getByRole("img", { name: /^El siete en el campo/ })).toHaveCount(0);
  } finally {
    await fan.close();
    await fsPatch(`players/${PLAYERS[0]}`, { lastName: undefined });
    await dropBoard(board);
  }
});
