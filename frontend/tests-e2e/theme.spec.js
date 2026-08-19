import { test, expect } from "@playwright/test";
import { registerUser, seedAuth } from "./helpers.js";

const THEME_KEY = "najda-theme";
const themeButton = (page) =>
  page.getByRole("button", { name: /Switch to (?:dark|light) mode/ });

async function pageBrightness(page) {
  return page.locator("body").evaluate((body) => {
    const color = getComputedStyle(body).backgroundColor;
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);

    if (!channels || channels.length !== 3) {
      throw new Error(`Unable to parse body background color: ${color}`);
    }

    return channels.reduce((sum, channel) => sum + channel, 0) / 3;
  });
}

test.describe("color theme", () => {
  test("follows the system theme until the user saves a preference", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("button", { name: "Switch to light mode" })
    ).toBeVisible();
    await expect.poll(() => pageBrightness(page)).toBeLessThan(80);

    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), THEME_KEY)
    ).toBeNull();
  });

  test("stores a manual choice and keeps it across reloads and routes", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await page.getByRole("button", { name: "Switch to light mode" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => pageBrightness(page)).toBeGreaterThan(200);
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), THEME_KEY)
    ).toBe("light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
      page.getByRole("button", { name: "Switch to dark mode" })
    ).toBeVisible();
  });

  test("offers a theme switch in every layout family", async ({
    page,
    request,
  }) => {
    for (const route of ["/", "/login", "/signup", "/emergency-auth"]) {
      await page.goto(route);
      await expect(themeButton(page), `theme switch on ${route}`).toBeVisible();
    }

    const user = await registerUser(request, { name: "Theme Test User" });
    await seedAuth(page, user.token);

    for (const route of ["/chat", "/profile", "/emergency"]) {
      await page.goto(route);
      await expect(themeButton(page), `theme switch on ${route}`).toBeVisible();
    }
  });
});
