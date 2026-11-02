import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";
import { adminUid, clearAdminBoards, fsDelete, fsGet, fsPatch, fsSet, fsWhere, NEXT, PLAYERS, pizarraUrl, SEASON } from "./pizarraKit";

// r14 «La pizarra» end to end: the flows of Plan, Jugadas, Partido and Tableros on boards of their own. Each test
// starts by deleting the admin's boards of the season and seeding the ones it needs through the emulator's owner
// REST (the shape lineupDoc.ts lineupToData writes and firestore.rules' boardOk accepts), opens them with
// ?tablero=<id>, and deletes them again at the end: a retry or a second run starts from the same place.

const NICK = "capi_prueba"; // the seeded admin's nickname (functions/test/seed-preview.mjs)
type Spot = [code: string, zone: string, x: number, y: number];
// The systems' spots as functions/src/formations.ts stores them (the keeper first).
const SPOTS: Record<"2-3-1" | "3-2-1", Spot[]> = {
  "2-3-1": [["POR", "POR", 50, 95], ["DFC", "DEF", 30, 74], ["DFC", "DEF", 70, 74], ["MI", "MED", 17, 49], ["MC", "MED", 50, 50], ["MD", "MED", 83, 49], ["DC", "DEL", 50, 22]],
  "3-2-1": [["POR", "POR", 50, 95], ["LI", "DEF", 18, 72], ["DFC", "DEF", 50, 74], ["LD", "DEF", 82, 72], ["MC", "MED", 25, 46], ["MC", "MED", 75, 46], ["DC", "DEL", 50, 22]],
};

/** Writes a board of the seeded admin in the seeded season: the seven given (the keeper first), nothing else planned. */
async function seedBoard(id: string, name: string, o: { formation?: "2-3-1" | "3-2-1"; ids?: (string | null)[]; matchId?: string | null } = {}): Promise<string> {
  const formation = o.formation ?? "2-3-1";
  const ids = o.ids ?? PLAYERS.slice(0, 7);
  const now = new Date();
  await fsSet(`lineups/${id}`, {
    formation,
    freeMode: false,
    slots: SPOTS[formation].map(([position, zone, x, y], i) => ({ slotId: `pz-slot-${i}`, playerId: ids[i] ?? null, position, zone, x, y })),
    roles: {},
    tactics: {},
    playerPositions: {},
    subs: [],
    takers: { penalties: [], freekicks: [], corners: [] },
    drawings: [],
    plays: [],
    variants: [],
    condPlan: [],
    ownerUid: await adminUid(),
    ownerNickname: NICK,
    seasonId: SEASON,
    name,
    isOfficial: false,
    matchId: o.matchId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** The board bar names the board on screen once the session has opened it. */
const boardOpen = (page: Page, name: string) => expect(page.getByRole("button", { name: new RegExp(`^Tablero ${name.replace(/[()]/g, "\\$&")},`) }).first()).toBeVisible({ timeout: 20_000 });
const toast = (page: Page) => page.locator(".vx-toast");
/** Signs in as the seeded captain and opens a pizarra address (the frame, .pz-s: the floating layer is a .pz too). */
async function open(page: Page, path: string, query: Record<string, string>): Promise<void> {
  await enterVestuario(page);
  await page.goto(pizarraUrl(path, query));
  await expect(page.locator(".pz-s")).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(({ page }) => {
  // (what the page says when it breaks lands in the report)
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console]", m.text());
  });
});

test("plan: una clave nueva se guarda y sigue ahí al recargar", async ({ page }) => {
  test.setTimeout(90_000);
  await clearAdminBoards();
  const id = await seedBoard(`e2e-plan-${stamp()}`, "E2E Plan");
  try {
    await open(page, "/pizarra/plan/claves", { tablero: id });
    await boardOpen(page, "E2E Plan");
    const side = page.locator(".pz-s__side");
    await expect(side.getByRole("heading", { name: "Ninguna clave" })).toBeVisible();
    await side.getByRole("button", { name: "Añadir la primera" }).click();
    // the new one opens to be written
    const text = side.getByRole("textbox", { name: "Texto de la clave" });
    await expect(text).toHaveValue("Nueva clave");
    await text.fill("Presión tras pérdida");
    await text.press("Enter");
    await expect(side.getByRole("heading", { name: "Una clave" })).toBeVisible();
    // (the autosave reaches the server)
    await expect.poll(async () => ((await fsGet(`lineups/${id}`))?.plan as { claves?: string[] } | undefined)?.claves ?? [], { timeout: 15_000 }).toEqual(["Presión tras pérdida"]);

    await page.reload();
    await boardOpen(page, "E2E Plan");
    await expect(side.getByRole("heading", { name: "Una clave" })).toBeVisible();
    await expect(side.getByRole("button", { name: /^Presión tras pérdida\. Toca para encenderla/ })).toBeVisible();
  } finally {
    await clearAdminBoards();
  }
});

test("jugadas: una jugada nueva, un paso más, y se reproduce hasta el final", async ({ page }) => {
  test.setTimeout(90_000);
  await clearAdminBoards();
  const id = await seedBoard(`e2e-jug-${stamp()}`, "E2E Jugadas");
  try {
    await open(page, "/pizarra/jugadas", { tablero: id });
    await boardOpen(page, "E2E Jugadas");
    await page.getByRole("button", { name: "Nueva jugada" }).click();
    // a two-step play from the seven, open in Editar on its second step
    await expect(page).toHaveURL(/\/pizarra\/jugadas\/[^/?]+\?.*modo=editar/);
    const time = page.locator(".pj-time");
    await expect(time).toContainText("Paso 2 de 2");
    await page.getByRole("button", { name: "Paso al final" }).click();
    await expect(time).toContainText("Paso 3 de 3");
    await expect.poll(async () => ((await fsGet(`lineups/${id}`))?.plays as { frames?: unknown[] }[] | undefined)?.map((p) => p.frames?.length ?? 0) ?? [], { timeout: 15_000 }).toEqual([3]);

    // Ver: back to the first step, play it, and it walks the steps and stops at the last one
    await page.getByRole("group", { name: "Ver o editar la jugada" }).getByRole("button", { name: "Ver" }).click();
    await expect(page).not.toHaveURL(/modo=editar/);
    await page.getByRole("button", { name: /^Paso 1 de 3/ }).first().click();
    await expect(time).toContainText("Paso 1 de 3");
    await page.getByRole("button", { name: "Reproducir la jugada" }).click();
    await expect(page.getByRole("button", { name: "Pausar la repetición" })).toBeVisible();
    await expect(time).toContainText("Paso 2 de 3", { timeout: 10_000 });
    await expect(time).toContainText("Paso 3 de 3", { timeout: 10_000 });
    // (stopped at the end: «Otra vez»)
    const play = page.getByRole("button", { name: "Reproducir la jugada" });
    await expect(play).toBeVisible({ timeout: 10_000 });
    await expect(play).toContainText("Otra vez");
    await expect(page.getByRole("button", { name: "Pausar la repetición" })).toHaveCount(0);
  } finally {
    await clearAdminBoards();
  }
});

test("partido: «Antes» del próximo partido, y «Mandar a la mesa» manda el siete del tablero", async ({ page }) => {
  test.setTimeout(120_000);
  await clearAdminBoards();
  // the match's convocatoria and lineup as they were: setMatchLineup changes them, and they are put back at the end
  const keys = ["starters", "bench", "notCalled", "lineup", "revision"] as const;
  const before = await fsGet(`matches/${NEXT}`);
  if (!before) throw new Error("Falta el partido de la semilla: " + NEXT);
  const draftBefore = await fsGet(`matchDrafts/${NEXT}`);
  const restore = async () => {
    await fsPatch(`matches/${NEXT}`, Object.fromEntries(keys.map((k) => [k, before[k] ?? undefined])));
    if (draftBefore) await fsPatch(`matchDrafts/${NEXT}`, Object.fromEntries(["starters", "bench", "notCalled", "revision"].map((k) => [k, draftBefore[k] ?? undefined])));
  };
  const id = await seedBoard(`e2e-par-${stamp()}`, "E2E Partido", { matchId: NEXT });
  try {
    await open(page, "/pizarra/partido", { tablero: id });
    await boardOpen(page, "E2E Partido");
    const lead = page.locator(".pz-s__lead");
    // Antes: the match is tomorrow
    await expect(lead.getByRole("list", { name: "Las cuatro partes del día" }).locator('[aria-current="step"]')).toContainText("Antes");
    await expect(lead.getByRole("heading", { level: 1 })).toHaveText(/^(Mañana a las|Faltan) /);
    await expect(lead.getByRole("heading", { name: "La mesa" })).toBeVisible();

    await lead.getByRole("button", { name: "Mandar a la mesa" }).click();
    const sheet = page.getByRole("dialog", { name: "Mandar a la mesa" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("alert")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Mandar a la mesa", exact: true }).click();
    await expect(toast(page)).toContainText(/Siete en la mesa · 2-3-1|La mesa ya tenía este siete/, { timeout: 30_000 });
    await expect(sheet.getByRole("status")).toContainText("Siete en la mesa");

    // the match has the board's seven (the board itself is now the official one)
    const m = await fsGet(`matches/${NEXT}`);
    const lineup = m?.lineup as { boardId?: string; slots?: { playerId?: string | null }[] } | undefined;
    expect(lineup?.boardId).toBe(id);
    expect((lineup?.slots ?? []).map((s) => s.playerId)).toEqual(PLAYERS.slice(0, 7));
    expect((await fsGet(`lineups/${id}`))?.isOfficial).toBe(true);
    await expect(lead.getByText("Al día")).toBeVisible({ timeout: 15_000 });
  } finally {
    await page.close();
    await clearAdminBoards();
    await restore();
  }
});

test("tableros: duplicar, borrar y «Deshacer», y comparar dos tableros", async ({ page }) => {
  test.setTimeout(120_000);
  await clearAdminBoards();
  const a = await seedBoard(`e2e-tba-${stamp()}`, "E2E Tablero A");
  const b = await seedBoard(`e2e-tbb-${stamp()}`, "E2E Tablero B", { formation: "3-2-1", ids: [PLAYERS[0], PLAYERS[1], PLAYERS[2], PLAYERS[3], PLAYERS[4], PLAYERS[6], PLAYERS[7]] });
  try {
    await open(page, "/pizarra/tableros", { tablero: a });
    await boardOpen(page, "E2E Tablero A");
    const side = page.locator(".pz-s__side");
    const stage = page.locator(".pz-s__stage");

    // duplicate the board on screen: the copy is made and opened
    await side.getByRole("button", { name: "Duplicar «E2E Tablero A»" }).click();
    await expect(toast(page)).toContainText("Copia creada: «E2E Tablero A (copia)»");
    await boardOpen(page, "E2E Tablero A (copia)");
    const copies = (await fsWhere("lineups", "name", "E2E Tablero A (copia)")).filter((d) => d.data.seasonId === SEASON);
    expect(copies).toHaveLength(1);
    const copy = copies[0].id;
    expect(new URL(page.url()).searchParams.get("tablero")).toBe(copy);

    // delete B (not the one on screen) and bring it back
    const cardB = stage.getByRole("button", { name: /^E2E Tablero B\. / });
    await cardB.click();
    await side.getByRole("button", { name: "Borrar «E2E Tablero B»" }).click();
    const pend = stage.locator(".pb-pend");
    await expect(pend).toContainText("«E2E Tablero B» borrado");
    await expect(cardB).toHaveCount(0);
    await pend.getByRole("button", { name: "Deshacer" }).click();
    await expect(pend).toHaveCount(0);
    await expect(cardB).toBeVisible();
    // (past the 12 s to undo, it is still on the server)
    await page.waitForTimeout(13_000);
    expect(await fsGet(`lineups/${b}`)).not.toBeNull();
    await expect(cardB).toBeVisible();

    // Comparar: the copy on screen (A) against B
    await cardB.click();
    await side.getByRole("button", { name: "Comparar «E2E Tablero B» con otro siete" }).click();
    await expect(page).toHaveURL(/\/pizarra\/tableros\/comparar\?/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "A: el de referencia" })).toHaveValue(`b:${copy}:titular`);
    await expect(page.getByRole("combobox", { name: "B: el que miras" })).toHaveValue(`b:${b}:titular`);
    await expect(page.getByRole("figure", { name: /^A: .*2-3-1$/ })).toBeVisible();
    await expect(page.getByRole("figure", { name: /^B: .*3-2-1$/ })).toBeVisible();
  } finally {
    await page.close();
    await clearAdminBoards();
    for (const id of [a, b]) await fsDelete(`lineups/${id}`);
  }
});

test.afterAll(async () => {
  // (whatever a failed attempt left: the admin's boards of the season and the match's official)
  await clearAdminBoards();
});
