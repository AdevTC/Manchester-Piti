import { expect, type Page } from "@playwright/test";
export async function enterVestuario(page: Page) {
  await page.goto("/vestuario");
  // No team key any more: the seeded admin is already a member, so Google alone lets them in.
  await page
    .getByRole("button", { name: "Google de prueba · Solo emulador" })
    .click();
  await expect(
    page.getByRole("link", { name: /Administrar el club/ }),
  ).toBeVisible();
}
