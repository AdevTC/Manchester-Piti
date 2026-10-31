import { expect, test } from "@playwright/test";
import { enterVestuario } from "./helpers";

test("la narración se revisa antes de publicar y la cifra abre sus jugadas", async ({ page }) => {
  await enterVestuario(page);
  await page.goto("/admin/partidos/preview-finished/acta/narracion");
  // (r12: the narrated analysis is its own screen, /acta/narracion)
  const editor = page.getByRole("region", { name: "El análisis narrado", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Copiar prompt y contexto" }).click();
  const context = JSON.parse(await editor.getByLabel("Contexto del partido (solo lectura)").inputValue());
  const source = "Marcos se la pasa a Dani";
  const goal = context.existingEvents.find((e: { id: string }) => e.id === "goal1");
  const actions = {
    format: "piti-actions/v1", matchId: context.matchId, baseRevision: context.baseRevision, coverage: "partial",
    events: [{ ...goal, assistPlayerId: "preview-player-2" }, { id: "review-pass", type: "pass", playerId: "preview-player-2", receiverId: "preview-player-1", minute: 5, outcome: "complete", sourceRef: source }],
    unresolved: [{ question: "¿El receptor era Dani o Pablo?", playerIds: ["preview-player-1", "preview-player-3"], eventIds: ["review-pass"], sourceRef: source }],
  };
  await editor.getByLabel("O pega el análisis estructurado").fill(JSON.stringify(actions));
  await editor.getByRole("button", { name: "Revisar importación" }).click();
  const review = editor.getByRole("region", { name: "Revisión de la importación" });
  await expect(review.getByText("1 nuevas", { exact: true })).toBeVisible();
  await expect(review.getByText("1 correcciones", { exact: true })).toBeVisible();
  await expect(review.locator(".ae-review-diff")).toContainText("AntesPablo");
  await expect(review.locator(".ae-review-diff")).toContainText("AhoraMarcos");
  await expect(review.getByRole("button", { name: "Incorporar al acta" })).toBeDisabled();
  await review.getByRole("button", { name: "Revisar Pase · 5′" }).click();
  const form = editor.getByRole("group", { name: "Editar acción detallada" });
  await form.getByRole("combobox", { name: "Receptor", exact: true }).selectOption("preview-player-3");
  await form.getByText("Más detalle: envío, contacto, posesión, coordenadas y origen", { exact: true }).click();
  await form.getByLabel("Fragmento o referencia de origen").fill("Marcos se la pasa a Pablo");
  await expect(review.getByRole("button", { name: "Incorporar al acta" })).toBeDisabled();
  await form.getByRole("button", { name: "Guardar acción" }).click();
  await review.getByLabel("Resolución de la duda 1").fill("Era Pablo; jugada y fragmento corregidos.");
  await review.getByRole("button", { name: "Guardar resolución" }).click();
  await review.getByRole("button", { name: "Incorporar al acta" }).click();
  await expect(page.getByText("Ya está en el acta · falta «Guardar borrador»")).toBeVisible();
  // (Narración carries the acta's foot: the same acta)
  await page.locator(".sac-foot").getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Acta .* corregida · web al día/)).toBeVisible();
  // The full analysis lives in Números now: the match's Números screen opens El juego for this match.
  await page.goto("/partidos/preview-finished/numeros");
  await page.getByRole("link", { name: "Abrir el análisis en Estadísticas" }).click();
  await expect(page).toHaveURL(/\/estadisticas\/juego\?/);
  expect(new URL(page.url()).searchParams.get("partidos")).toBe("preview-finished");
  // «Quién conecta con quién»: the corrected pass, Marcos → Pablo
  const pairs = page.locator(".nx-conn");
  await expect(pairs.getByRole("listitem").filter({ hasText: "Marcos → Pablo" })).toContainText("1");
  // a narrated figure opens its card, with who did it in that match
  await page.getByRole("list", { name: "Indicadores de la selección" }).getByRole("button", { name: /Pases intentados/ }).click();
  const card = page.getByRole("dialog", { name: /Pases intentados/ });
  await expect(card.getByRole("list", { name: "Por jugador" }).getByRole("listitem").filter({ hasText: "Marcos" })).toBeVisible();
  await expect(card.getByRole("list", { name: "Jugadas y registros" }).getByRole("listitem").filter({ hasText: "Marcos" })).toBeVisible();
  // Literal narration is kept with private admin sources, never in the public numbers.
  await expect(page.locator("body")).not.toContainText("Marcos se la pasa a Pablo");
});
