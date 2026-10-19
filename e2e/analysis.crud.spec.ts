import { expect, test } from "@playwright/test";
import { enterVestuario } from "./helpers";

test("la narración se revisa antes de publicar y la cifra abre sus jugadas", async ({ page }) => {
  await enterVestuario(page);
  await page.goto("/admin/partidos/preview-finished?tab=acta");
  const editor = page.getByRole("region", { name: "Análisis detallado del acta" });
  await expect(editor).toBeVisible();
  await editor.getByText("Importar análisis de una narración", { exact: true }).click();
  await editor.getByRole("button", { name: "Copiar prompt y contexto" }).click();
  const context = JSON.parse(await editor.getByLabel("Contexto del partido (solo lectura)").inputValue());
  const source = "Marcos se la pasa a Dani";
  const goal = context.existingEvents.find((e: { id: string }) => e.id === "goal1");
  const actions = {
    format: "piti-actions/v1", matchId: context.matchId, baseRevision: context.baseRevision, coverage: "partial",
    events: [{ ...goal, assistPlayerId: "preview-player-2" }, { id: "review-pass", type: "pass", playerId: "preview-player-2", receiverId: "preview-player-1", minute: 5, outcome: "complete", sourceRef: source }],
    unresolved: [{ question: "¿El receptor era Dani o Pablo?", playerIds: ["preview-player-1", "preview-player-3"], eventIds: ["review-pass"], sourceRef: source }],
  };
  await editor.getByLabel("Análisis estructurado").fill(JSON.stringify(actions));
  await editor.getByRole("button", { name: "Revisar importación" }).click();
  const review = editor.getByRole("region", { name: "Revisión de la importación" });
  await expect(review.getByText("1 nuevas", { exact: true })).toBeVisible();
  await expect(review.getByText("1 correcciones", { exact: true })).toBeVisible();
  await expect(review.locator(".ae-review-diff")).toContainText("AntesPablo");
  await expect(review.locator(".ae-review-diff")).toContainText("AhoraMarcos");
  await expect(review.getByRole("button", { name: "Incorporar al borrador" })).toBeDisabled();
  await review.getByRole("button", { name: "Revisar Pase · 5′" }).click();
  const form = editor.getByRole("group", { name: "Editar acción detallada" });
  await form.getByRole("combobox", { name: "Receptor", exact: true }).selectOption("preview-player-3");
  await form.getByLabel("Fragmento o referencia de origen").fill("Marcos se la pasa a Pablo");
  await expect(review.getByRole("button", { name: "Incorporar al borrador" })).toBeDisabled();
  await form.getByRole("button", { name: "Guardar acción" }).click();
  await review.getByLabel("Resolución de la duda 1").fill("Era Pablo; jugada y fragmento corregidos.");
  await review.getByRole("button", { name: "Guardar resolución" }).click();
  await review.getByRole("button", { name: "Incorporar al borrador" }).click();
  await expect(editor.getByText("Análisis incorporado al borrador. Revisa y publica el acta para actualizar la web.")).toBeVisible();
  await page.locator(".det .df").getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Acta .* corregida · web al día/)).toBeVisible();
  await page.goto("/matches/preview-finished?tab=estadisticas");
  const stats = page.getByRole("region", { name: "Estadísticas detalladas" });
  await stats.getByRole("button", { name: "Ver 1 pases de Marcos a Pablo" }).click();
  const evidence = stats.getByRole("region", { name: "Pases completados · Marcos" });
  await expect(evidence.getByRole("listitem")).toHaveCount(1);
  await expect(evidence).toContainText("Marcos → Pablo");
  // Literal narration is kept with private admin sources, never in the public acta or evidence.
  await expect(evidence).not.toContainText("Marcos se la pasa a Pablo");
  await expect(evidence.getByRole("link", { name: /Ver acta/ })).toHaveAttribute("href", "/matches/preview-finished?tab=estadisticas");
});
