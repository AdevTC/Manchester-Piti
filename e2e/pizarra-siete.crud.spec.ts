import { test, expect, type Page } from "@playwright/test";
import { enterVestuario } from "./helpers";
import { adminUid, clearAdminBoards, fsDelete, fsGet, fsPatch, fsSet, NEXT, PLAYERS, pizarraUrl, SEASON } from "./pizarraKit";

// r14 «La pizarra» end to end: el Siete. Placing players (tap-tap and «Mover a…»), the system, publishing with its
// confirmation, la ficha, «Adivina el siete» (a player bets, the captain publishes, the player sees his hits) and the
// Ajustes' camera that follows you. Each test seeds its own boards with the Firestore emulator's owner REST and
// leaves the pizarra as it found it (no admin boards, no official for preview-next, the guesses open again).

// ── fixtures ──
/** The 2-3-1's spots (functions/src/formations.ts), keeper first: [code, zone, x, y]. */
const SPOTS_231: [string, string, number, number][] = [
  ["POR", "POR", 50, 95],
  ["DFC", "DEF", 30, 74],
  ["DFC", "DEF", 70, 74],
  ["MI", "MED", 17, 49],
  ["MC", "MED", 50, 50],
  ["MD", "MED", 83, 49],
  ["DC", "DEL", 50, 22],
];
/** A board as lineupToData writes it (src/pages/pizarra/lineupDoc.ts), in the 2-3-1, for preview-next. */
function board(o: { owner: string; nick: string; name: string; seven: (string | null)[] }): Record<string, unknown> {
  const now = new Date();
  return {
    formation: "2-3-1",
    freeMode: false,
    slots: SPOTS_231.map(([position, zone, x, y], i) => ({ slotId: "pz-slot-" + i, playerId: o.seven[i] ?? null, position, zone, x, y })),
    roles: {},
    tactics: {},
    playerPositions: {},
    subs: [],
    drawings: [],
    plays: [],
    variants: [],
    ownerUid: o.owner,
    ownerNickname: o.nick,
    seasonId: SEASON,
    name: o.name,
    isOfficial: false,
    matchId: NEXT,
    createdAt: now,
    updatedAt: now,
  };
}
async function adminBoard(id: string, name: string, seven: (string | null)[]): Promise<void> {
  const uid = await adminUid();
  const nick = String((await fsGet(`users/${uid}`))?.nickname ?? "capi_prueba");
  await fsSet(`lineups/${id}`, board({ owner: uid, nick, name, seven }));
}

/** «Adivina el siete» open again for preview-next: the server's one-way flag goes (API.txt «Revisión»). A publish
 * just made sets it a moment later (onLineupR14): wait for it first, so it can't land after the reset. */
async function reopenGuesses(afterPublish: boolean): Promise<void> {
  if (afterPublish) {
    const t0 = Date.now();
    while (Date.now() - t0 < 15_000 && (await fsGet(`matchPrivate/${NEXT}`))?.sieteOutAt == null) await new Promise((r) => setTimeout(r, 300));
  }
  const priv = await fsGet(`matchPrivate/${NEXT}`);
  if (priv && "sieteOutAt" in priv) await fsPatch(`matchPrivate/${NEXT}`, { sieteOutAt: undefined });
}

// ── the raw documents of a shared account, to put them back exactly (types and timestamps included) ──
const DOCS = "http://127.0.0.1:8080/v1/projects/demo-manchester-piti/databases/(default)/documents";
const OWNER = { authorization: "Bearer owner" };
type RawFields = Record<string, unknown> | null;
async function rawGet(path: string): Promise<RawFields> {
  const r = await fetch(`${DOCS}/${path}`, { headers: OWNER });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`rawGet ${path}: HTTP ${r.status}`);
  return ((await r.json()) as { fields?: Record<string, unknown> }).fields ?? {};
}
async function rawPut(path: string, fields: RawFields): Promise<void> {
  if (fields === null) return fsDelete(path);
  const r = await fetch(`${DOCS}/${path}`, { method: "PATCH", headers: { ...OWNER, "content-type": "application/json" }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`rawPut ${path}: HTTP ${r.status} ${await r.text()}`);
}
/** The uid the Auth emulator gives «Socio de prueba» (the same sign-in AccessGate's DevSignIn makes). */
async function socioUid(): Promise<string> {
  const b64 = (d: unknown) => Buffer.from(JSON.stringify(d)).toString("base64url");
  const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "preview-socio", email: "socio@piti.test", email_verified: true, name: "Socio de pruebas", aud: "demo", iss: "https://accounts.google.com" })}.`;
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ postBody: new URLSearchParams({ id_token: token, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }),
  });
  const { localId } = (await r.json()) as { localId?: unknown };
  if (typeof localId !== "string") throw new Error("La cuenta «Socio de prueba» del emulador no está disponible.");
  return localId;
}

// ── the page ──
/** Signs in as the seeded captain and opens a pizarra address (the kit's enterPizarra waits on `.pz`, which the
 * shell's portal — toast, announcer, ghost — also carries: two elements, a strict-mode error). */
async function openPizarra(page: Page, path: string, query: Record<string, string> = {}): Promise<void> {
  await enterVestuario(page);
  await page.goto(pizarraUrl(path, query));
  await expect(page.getByRole("navigation", { name: "La pizarra" })).toBeVisible();
}
const campo = (page: Page) => page.getByRole("group", { name: /^El campo/ });
const bench = (page: Page) => page.locator(".pz-7__drop");
const benchRow = (page: Page, shirt: string) => bench(page).getByRole("button", { name: new RegExp("^" + shirt + ",", "i") });
const sheet = (page: Page) => page.getByRole("dialog");
const ring = (page: Page, n: number) => page.getByRole("img", { name: new RegExp(`^${n} de 7 en el campo`) });

// A cold dev server compiles the pizarra's chunks on the first visit (longer than an expect's 30 s): one visit first.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await browser.newPage();
  try {
    await enterVestuario(page);
    await page.goto(pizarraUrl("/pizarra/siete"));
    await expect(page.getByRole("navigation", { name: "La pizarra" })).toBeVisible({ timeout: 150_000 });
  } finally {
    await page.close();
  }
});
test.beforeEach(async () => {
  await clearAdminBoards();
  await reopenGuesses(false);
});
test.afterEach(async () => {
  await clearAdminBoards();
});

test("el siete: colocar con toque y toque y con «Mover a…», cambiar el sistema y publicarlo", async ({ page }) => {
  test.setTimeout(90_000);
  // Álex, Dani, Marcos, Pablo and Sergio on the pitch; MD and DC empty
  await adminBoard("e2e-siete-colocar", "E2E Colocar", PLAYERS.slice(0, 5));
  await openPizarra(page, "/pizarra/siete", { tablero: "e2e-siete-colocar" });
  await expect(ring(page, 5)).toBeVisible();

  // tap-tap: David from the bench into the hand, then the empty MD
  await benchRow(page, "David").click();
  await campo(page).getByRole("button", { name: /^Hueco MD vacío.*toca para poner a David/i }).click();
  await expect(campo(page).getByRole("button", { name: /^David, 6\. MD/i })).toBeVisible();
  await expect(ring(page, 6)).toBeVisible();
  await expect(benchRow(page, "David")).toHaveCount(0);

  // «Mover a…»: Mario's ficha (a second tap on him), «Mover a…», the DC
  await benchRow(page, "Mario").click();
  await benchRow(page, "Mario").click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole("button", { name: "Mover a…" }).click();
  await expect(sheet(page)).toHaveAccessibleName(/^Mover a Mario/i);
  await sheet(page).getByRole("button", { name: /^DC, / }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(campo(page).getByRole("button", { name: /^Mario, 7\. DC/i })).toBeVisible();
  await expect(page.getByRole("img", { name: "7 de 7 en el campo, completo" })).toBeVisible();

  // the system: «El sistema» sheet → the 3-2-1; the seven keeps its order
  await page.getByRole("button", { name: /^Sistema 2-3-1/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("El sistema");
  const t321 = sheet(page).getByRole("button", { name: /^3-2-1 · / });
  await t321.click();
  await expect(t321).toHaveAttribute("aria-pressed", "true");
  await sheet(page).getByRole("button", { name: "Cerrar" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Sistema 3-2-1/ })).toBeVisible();
  await expect(campo(page)).toHaveAccessibleName(/3-2-1/);
  await expect.poll(async () => (await fsGet("lineups/e2e-siete-colocar"))?.formation, { timeout: 10_000 }).toBe("3-2-1");

  // publish: always confirmed; the convocatoria stays as the seed left it (other specs read it)
  await page.getByRole("button", { name: "Publicar como oficial" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Publicar el siete");
  const conv = sheet(page).getByRole("button", { name: /^La convocatoria de la .+ pasa a ser este siete$/ });
  await expect(conv).toHaveAttribute("aria-pressed", "true");
  await conv.click();
  await expect(sheet(page).getByRole("button", { name: "La convocatoria se queda como está" })).toHaveAttribute("aria-pressed", "false");
  await sheet(page).getByRole("button", { name: /^Publicar( igualmente)?$/ }).click();
  await expect(sheet(page).getByRole("status")).toContainText(/Publicado · el (oficial de la J\d+|siete oficial)/);
  await expect(page.locator(".vx-toast")).toContainText("Publicado: el equipo recibe «Ya está el siete»");
  // the official state: the board is the official of preview-next, with the seven on screen
  await expect.poll(async () => (await fsGet(`lineupOfficials/${SEASON}__${NEXT}`))?.lineupId, { timeout: 10_000 }).toBe("e2e-siete-colocar");
  const doc = await fsGet("lineups/e2e-siete-colocar");
  expect(doc?.isOfficial).toBe(true);
  expect(doc?.matchId).toBe(NEXT);
  expect(((doc?.slots ?? []) as { playerId: string | null }[]).map((s) => s.playerId)).toEqual(PLAYERS.slice(0, 7));
  await sheet(page).getByRole("button", { name: "Volver al siete" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.locator(".pz-7__ro")).toContainText("Oficial · solo lectura");

  await clearAdminBoards();
  await reopenGuesses(true);
});

test("la ficha: tocar dos veces a un jugador abre su ficha; se cierra con Esc y con Cerrar", async ({ page }) => {
  await adminBoard("e2e-siete-ficha", "E2E Ficha", PLAYERS.slice(0, 7));
  await openPizarra(page, "/pizarra/siete", { tablero: "e2e-siete-ficha" });
  await expect(page.getByRole("img", { name: "7 de 7 en el campo, completo" })).toBeVisible();

  // a player on the pitch: the first tap takes him, the second opens his ficha
  const marcos = campo(page).getByRole("button", { name: /^Marcos, 3\. DFC/i });
  await marcos.click();
  await expect(marcos).toHaveAttribute("aria-pressed", "true");
  await marcos.click();
  const ficha = sheet(page);
  await expect(ficha).toHaveAccessibleName(/^Marcos$/i);
  await expect(ficha.getByRole("img", { name: /^La carta de Marcos: / })).toBeVisible();
  await expect(ficha.getByRole("heading", { name: /^Sus últimas notas/ })).toBeVisible();
  await expect(ficha.getByRole("heading", { name: /^Dónde ha jugado/ })).toBeVisible();
  await expect(ficha.getByRole("heading", { name: /^La convocatoria/ })).toBeVisible();
  await expect(ficha.getByText("En el siete · DFC")).toBeVisible();
  await expect(ficha.getByRole("group", { name: "Jugar de" })).toBeVisible();
  await expect(ficha.getByRole("button", { name: "Mover a…" })).toBeVisible();
  await expect(ficha.getByRole("button", { name: "Quitar del siete" })).toBeVisible();
  await expect(ficha.getByRole("button", { name: "Darle el brazalete" })).toBeVisible();
  await expect(ficha.getByRole("link", { name: "Ver su página" })).toHaveAttribute("href", /\/jugadores\/preview-player-2$/);
  // Esc closes it (focus is inside: on its ×)
  await expect(ficha.getByRole("button", { name: "Cerrar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);

  // one of the bench: two taps too; «Cerrar» closes it; he isn't in the seven
  await benchRow(page, "Hugo").click();
  await benchRow(page, "Hugo").click();
  await expect(ficha).toHaveAccessibleName(/^Hugo$/i);
  await expect(ficha.getByText(/^En el siete/)).toHaveCount(0);
  await expect(ficha.getByRole("button", { name: "Quitar del siete" })).toHaveCount(0);
  await ficha.getByRole("button", { name: "Cerrar" }).click();
  await expect(sheet(page)).toHaveCount(0);
  // nothing moved
  await expect(page.getByRole("img", { name: "7 de 7 en el campo, completo" })).toBeVisible();
});

test("adivina el siete: un jugador apuesta, el capitán publica y el jugador ve cuántos acertó", async ({ page, browser }) => {
  test.setTimeout(120_000);
  // «Socio de prueba» becomes a member with a ficha for this test (only), and is put back exactly as he was
  const uid = await socioUid();
  const admin = await adminUid();
  const links = await Promise.all(["preview-player-9", "preview-player-8", "preview-player-7"].map(async (p) => [p, await fsGet(`playerLinks/${p}`)] as const));
  const pid = links.find(([, l]) => l === null)?.[0];
  if (!pid) throw new Error("No queda una ficha libre para el socio de prueba.");
  const saved = {
    [`users/${uid}`]: await rawGet(`users/${uid}`),
    [`teamMembers/${uid}`]: await rawGet(`teamMembers/${uid}`),
    [`accessRequests/${uid}`]: await rawGet(`accessRequests/${uid}`),
    [`playerLinks/${pid}`]: await rawGet(`playerLinks/${pid}`),
  };
  const guessPath = `matchPrivate/${NEXT}/guesses/${uid}`;
  const playerBoard = "e2e-siete-apuesta";
  // his bet: the first six of the seed's seven and Hugo instead of Mario (6 of 7, all six in their place)
  const bet = [...PLAYERS.slice(0, 6), PLAYERS[7]];
  const ctx = await browser.newContext();
  try {
    await fsDelete(guessPath);
    await fsSet(`users/${uid}`, { email: "socio@piti.test", nickname: "socio_prueba", role: "user", playerId: pid, createdAt: new Date() });
    await fsSet(`teamMembers/${uid}`, { expiresAt: new Date(Date.now() + 365 * 86_400_000), joinedAt: new Date(), via: "e2e", by: admin });
    await fsSet(`playerLinks/${pid}`, { uid });
    await fsSet(`lineups/${playerBoard}`, board({ owner: uid, nick: "socio_prueba", name: "E2E Mi apuesta", seven: bet }));

    // the player (a second browser): his own board, full → «Apostar con mi siete»
    const fan = await ctx.newPage();
    await fan.goto("/vestuario");
    await fan.getByRole("button", { name: "Socio de prueba · Solo emulador" }).click();
    await expect(fan.getByRole("button", { name: "Socio de prueba · Solo emulador" })).toHaveCount(0);
    await fan.goto(pizarraUrl("/pizarra/siete", { tablero: playerBoard }));
    await expect(fan.getByRole("img", { name: "7 de 7 en el campo, completo" })).toBeVisible({ timeout: 20_000 });
    await expect(fan.getByRole("heading", { name: "Adivina el siete" })).toBeVisible();
    await fan.getByRole("button", { name: "Apostar con mi siete" }).click();
    await expect(fan.locator(".vx-toast")).toContainText(/^Apuesta guardada: tu siete, a las/);
    await expect(fan.getByText(/^Tu apuesta está guardada/)).toBeVisible();
    await expect.poll(async () => (await fsGet(guessPath))?.slots, { timeout: 10_000 }).toEqual(bet);

    // the captain publishes the seed's seven for preview-next
    await adminBoard("e2e-siete-oficial", "E2E Oficial", PLAYERS.slice(0, 7));
    await page.bringToFront();
    await openPizarra(page, "/pizarra/siete", { tablero: "e2e-siete-oficial" });
    await expect(page.getByRole("img", { name: "7 de 7 en el campo, completo" })).toBeVisible();
    await page.getByRole("button", { name: "Publicar como oficial" }).click();
    await sheet(page).getByRole("button", { name: /^La convocatoria de la .+ pasa a ser este siete$/ }).click();
    await sheet(page).getByRole("button", { name: /^Publicar( igualmente)?$/ }).click();
    await expect(sheet(page).getByRole("status")).toContainText("Publicado");

    // the player sees his hits, live
    await fan.bringToFront();
    await expect(fan.getByText(/^Acertaste 6 de 7 · 6 en su sitio$/)).toBeVisible({ timeout: 20_000 });
    await expect(fan.getByRole("button", { name: /^Apostar con/ })).toHaveCount(0);
    // and the guesses are closed for good: the server's flag
    await expect.poll(async () => (await fsGet(`matchPrivate/${NEXT}`))?.sieteOutAt ?? null, { timeout: 15_000 }).not.toBeNull();
  } finally {
    await ctx.close();
    await fsDelete(`lineups/${playerBoard}`);
    await fsDelete(guessPath);
    for (const [path, fields] of Object.entries(saved)) await rawPut(path, fields);
    await clearAdminBoards();
    await reopenGuesses(true);
  }
});

test("ajustes: la cámara al entrar se queda elegida después de recargar", async ({ page }) => {
  const uid = await adminUid();
  const prefsPath = `users/${uid}/private/pizarra`;
  const saved = await rawGet(prefsPath);
  try {
    await fsDelete(prefsPath);
    await adminBoard("e2e-siete-ajustes", "E2E Ajustes", PLAYERS.slice(0, 7));
    await openPizarra(page, "/pizarra/siete", { tablero: "e2e-siete-ajustes", hoja: "ajustes" });
    await expect(sheet(page)).toHaveAccessibleName("Ajustes de la pizarra");
    const grada = sheet(page).getByRole("button", { name: /^Cámara al entrar: Grada\./ });
    await expect(sheet(page).getByRole("button", { name: /^Cámara al entrar: Según el sitio\./ })).toHaveAttribute("aria-pressed", "true");
    // the Siete opens in Pizarra; choosing Grada moves the pitch on screen at once
    await expect(campo(page).getByRole("group", { name: "Cámara" }).getByRole("button", { name: "Pizarra" })).toHaveAttribute("aria-pressed", "true");
    await grada.click();
    await expect(grada).toHaveAttribute("aria-pressed", "true");
    await expect(campo(page)).toHaveAccessibleName(/cámara grada/);
    // saved where it follows you: the account's doc (and this device's copy)
    await expect.poll(async () => ((await fsGet(prefsPath))?.prefs as { camara?: string } | undefined)?.camara, { timeout: 10_000 }).toBe("grada");

    // a reload without this device's copy: the account's choice comes back
    await page.evaluate(() => localStorage.removeItem("mp_pizarra_r14_prefs"));
    await page.reload();
    await expect(sheet(page)).toHaveAccessibleName("Ajustes de la pizarra");
    await expect(sheet(page).getByRole("button", { name: /^Cámara al entrar: Grada\./ })).toHaveAttribute("aria-pressed", "true");
    await expect(campo(page).getByRole("group", { name: "Cámara" }).getByRole("button", { name: "Grada" })).toHaveAttribute("aria-pressed", "true");
    await expect(campo(page)).toHaveAccessibleName(/cámara grada/);
  } finally {
    await rawPut(prefsPath, saved);
  }
});
