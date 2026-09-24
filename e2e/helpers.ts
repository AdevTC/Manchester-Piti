import fs from "node:fs";
import { expect, type Page } from "@playwright/test";
export async function enterVestuario(page: Page) {
  await page.goto("/vestuario");
  await page
    .getByRole("button", { name: "Google de prueba · Solo emulador" })
    .click();
  const secret = fs
    .readFileSync("functions/.secret.local", "utf8")
    .match(/^TEAM_PASSWORD=(.+)$/m)?.[1]
    ?.trim();
  if (!secret)
    throw new Error(
      "Falta TEAM_PASSWORD en functions/.secret.local para el emulador.",
    );
  await page.getByLabel("Clave del vestuario").fill(secret);
  await page.getByRole("button", { name: "Entrar al vestuario" }).click();
  await expect(
    page.getByRole("link", { name: /Administrar el club/ }),
  ).toBeVisible();
}
