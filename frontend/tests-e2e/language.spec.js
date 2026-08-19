import { test, expect } from "@playwright/test";

test.describe("Arabic browser language", () => {
  test.use({ locale: "ar-EG" });

  test("starts in Arabic without persisting automatic detection", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "رعاية صحية ذكية، في أي وقت وأي مكان" })
    ).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("najda-language"))).toBeNull();
  });
});

test("persists a manually selected language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to Arabic" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "رعاية صحية ذكية، في أي وقت وأي مكان" })
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("najda-language"))).toBe("ar");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});
