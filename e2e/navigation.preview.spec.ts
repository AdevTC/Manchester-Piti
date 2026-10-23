import { test, expect } from "@playwright/test";
test("web pública, navegación y detalle sin iniciar sesión", async ({
  page,
}) => {
  // (it walks several pages, the first of them compiled cold by the dev server: triple time)
  test.slow();
  await page.goto("/");
  // the headline follows the match day (the seed's date decides the phase): it is there, with the lens of the match
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  await expect(page.getByRole("region", { name: "El partido" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "Partidos", exact: true }).click();
  await expect(page).toHaveURL(/\/partidos/);
  await expect(page.getByRole("heading", { level: 1, name: "Partidos" })).toBeAttached();
  // the season is a menu: it names the season shown, and choosing one marks it
  const season = page.getByRole("button", { name: /Temporada 2026\/27 · Prueba/ });
  await expect(season).toHaveAttribute("aria-haspopup", "menu");
  await season.click();
  const seasons = page.getByRole("menu", { name: "Temporadas" });
  await expect(seasons.getByRole("menuitemradio", { name: /Temporada 2026\/27 · Prueba/ })).toHaveAttribute("aria-checked", "true");
  await seasons.getByRole("menuitemradio", { name: /Temporada 2026\/27 · Prueba/ }).click();
  await expect(page).toHaveURL(/\/partidos$/);
  await expect(page.getByRole("searchbox", { name: "Buscar rival" })).toBeVisible();
  // the season as a ribbon of light, and the three screens of looking at it (each its own address)
  await expect(page.getByRole("slider", { name: /^La temporada entera/ })).toBeVisible();
  const screens = page.getByRole("tablist", { name: "Pantallas de Partidos" });
  await expect(screens.getByRole("tab")).toHaveCount(3);
  await screens.getByRole("tab", { name: /Tabla/ }).click();
  await expect(page).toHaveURL(/\/partidos\/tabla$/);
  await page.goto("/partidos/preview-finished");
  // the detail: the score in the lens, and the cartel to share it (square or story)
  const lens = page.getByRole("region", { name: "El partido", exact: true });
  await expect(lens.getByRole("img", { name: /^Manchester Piti 2, Atlético Demo 1/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "El cartel", exact: true }).first().click();
  await expect(page.getByRole("dialog").getByRole("radio", { name: "Cuadrado" })).toBeVisible();
});

test("las direcciones viejas llegan a las nuevas", async ({ page }) => {
  // (permanent redirects, ROUTES.md: the parameters move with them)
  for (const [from, to] of [
    ["/partidos?view=tabla", /\/partidos\/tabla$/],
    ["/partidos?view=numeros", /\/partidos\/balance$/],
    ["/matches/preview-finished", /\/partidos\/preview-finished$/],
    ["/matches/preview-finished?tab=campo", /\/partidos\/preview-finished\/siete$/],
    ["/matches", /\/partidos$/],
    ["/#club", /\/club$/],
    ["/#temporada", /\/numeros$/],
  ] as const) {
    await page.goto("/plantilla");
    await page.goto(from);
    await expect(page).toHaveURL(to);
  }
});

test("cabecera sin accesos duplicados ni etiquetas partidas en escritorio compacto y ambas paletas", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1100, 1220, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const header = page.locator(".vx-top");
      await expect(header.getByRole("link", { name: "Entrar al vestuario" })).toHaveCount(1);
      const nav = header.getByRole("navigation", { name: "Navegación principal" });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link", { name: "Club", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Números", exact: true })).toBeVisible();
      expect(await header.evaluate((element) => {
        const children = [...element.children].map((child) => child.getBoundingClientRect());
        const links = [...element.querySelectorAll(".vx-nav a")];
        return children.every((box) => box.left >= 0 && box.right <= innerWidth) && children.every((box, i) => !i || box.left >= children[i - 1].right) && links.every((link) => getComputedStyle(link).whiteSpace === "nowrap");
      })).toBe(true);
    }
  }
});
test("jugador, datos de temporada y reparto real de minutos", async ({
  page,
}) => {
  // (the season's minutes are the player's Temporada section: the four big figures and «Sus números»)
  await page.goto("/jugadores/preview-player-7/temporada?season=preview-season");
  await expect(
    page.getByRole("heading", { name: "Hugo", exact: true }),
  ).toBeVisible();
  const four = page.locator(".pl-four li").filter({ hasText: "Minutos" });
  await expect(four.locator("b")).toHaveText("40′");
  await expect(page.locator(".pl-nums").getByText("40′", { exact: true })).toBeVisible();
  // Números: each player's minutes of the season, in Jugadores › «Todos los jugadores», columns «Minutos»
  await page.goto("/numeros/jugadores?temporada=preview-season&ranking=minutos&ver=todo");
  const all = page.getByRole("region", { name: "Todos los jugadores" });
  await all.getByRole("radiogroup", { name: "Qué columnas ver" }).getByRole("radio", { name: "Minutos" }).click();
  const table = all.getByRole("table", { name: "Todos los jugadores" });
  await expect(table.getByRole("columnheader").nth(2)).toHaveText("Minutos");
  const row = table.getByRole("row").filter({ hasText: "Hugo" });
  // (cells: the player, Partidos, Minutos…)
  await expect(row.getByRole("cell").nth(2)).toHaveText("40");
});
test("el club, con su vitrina, sus cuatro salas y el contacto", async ({ page }) => {
  await page.goto("/club");
  await expect(page.getByRole("heading", { level: 1, name: "El club" })).toBeVisible();
  // the vitrina (CL- boards): the shelves with every piece, the crest first
  await expect(page.getByRole("list", { name: /Las baldas/ }).getByRole("button", { name: /^El escudo:/ })).toBeVisible();
  const doors = page.getByRole("navigation", { name: "Las salas del club" });
  await expect(doors.getByRole("button")).toHaveCount(4);
  await doors.getByRole("button", { name: /^La gente\./ }).click();
  await expect(page).toHaveURL(/\/club\/gente$/);
  await expect(page.getByRole("heading", { name: "Clasificados" })).toBeVisible();
});
test("la puerta no pide clave y admin está protegido", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Entrar con Google" }),
  ).toBeVisible();
  await expect(page.getByLabel("Clave del vestuario")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nuevo partido" })).toHaveCount(
    0,
  );
});
test("navegación móvil sin desbordamiento", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(nav).toBeVisible();
    await expect(page.locator(".vx-top").getByRole("link", { name: "Entrar al vestuario" })).toBeVisible();
    // the boards' tab bar: five pages, each with its label
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: "Números" })).toBeVisible();
    await nav.getByRole("link", { name: "Plantilla" }).click();
    await expect(page.getByLabel("Buscar jugador")).toBeVisible();
    expect(await page.locator(".vx-top").evaluate((element) => [...element.children].every((child) => child.getBoundingClientRect().right <= innerWidth))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
