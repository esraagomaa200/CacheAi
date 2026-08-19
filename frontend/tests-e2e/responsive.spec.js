import { test, expect } from "@playwright/test";

import { pinLanguage, registerUser, seedAuth } from "./helpers.js";

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("responsive layout", () => {
  test.use({ viewport: { width: 320, height: 800 } });

  test("public home and emergency pages fit a 320px viewport", async ({ page }) => {
    await pinLanguage(page);

    await page.goto("/");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("button", { name: "Start Chatting" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Emergency" })).toBeVisible();

    await page.goto("/emergency");
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole("heading", { name: "Emergency Assistance" })
    ).toBeVisible();
  });

  test("signup stacks fields into readable mobile-width controls", async ({ page }) => {
    await pinLanguage(page);
    await page.goto("/signup");

    const fullName = page.getByPlaceholder("Enter your full name");
    const patientId = page.getByPlaceholder("Enter your ID number");
    await expect(fullName).toBeVisible();
    await expect(patientId).toBeVisible();

    const [fullNameBox, patientIdBox] = await Promise.all([
      fullName.boundingBox(),
      patientId.boundingBox(),
    ]);

    expect(fullNameBox.width).toBeGreaterThan(220);
    expect(patientIdBox.width).toBeGreaterThan(220);
    expect(patientIdBox.y).toBeGreaterThan(fullNameBox.y + fullNameBox.height);
    await expectNoHorizontalOverflow(page);
  });

  test("signup keeps appearance controls clear of the mobile heading", async ({
    page,
  }) => {
    await pinLanguage(page);
    await page.goto("/signup");

    const heading = page.getByRole("heading", { name: "Create Your Account" });
    const languageButton = page.getByRole("button", { name: "Switch to Arabic" });
    const themeButton = page.getByRole("button", {
      name: /^Switch to (dark|light) mode$/,
    });
    await expect(heading).toBeVisible();
    await expect(languageButton).toBeVisible();
    await expect(themeButton).toBeVisible();

    const [headingBox, languageBox, themeBox] = await Promise.all([
      heading.boundingBox(),
      languageButton.boundingBox(),
      themeButton.boundingBox(),
    ]);
    const controlsBottom = Math.max(
      languageBox.y + languageBox.height,
      themeBox.y + themeBox.height
    );

    expect(controlsBottom).toBeLessThanOrEqual(headingBox.y);
  });

  test("authenticated pages use an accessible mobile navigation drawer", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, { name: "Responsive User" });
    await seedAuth(page, user.token);

    await page.goto("/profile");
    await expect(page.getByText("Responsive User").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const openNavigation = page.getByRole("button", { name: "Open navigation" });
    await expect(openNavigation).toBeVisible();
    await expect(page.locator("aside")).toBeHidden();

    await openNavigation.click();
    await expect(page.locator("aside")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close navigation" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(page.locator("aside")).toBeHidden();

    await page.goto("/edit-profile");
    await expect(page.getByRole("heading", { name: "Edit Profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/emergency-history");
    await expect(
      page.getByRole("heading", { name: "Emergency Event History" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/complete-profile");
    await expect(
      page.getByRole("heading", { name: "Complete Your Profile" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/chat");
    await expect(page.getByPlaceholder("Type your message...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Arabic mobile navigation opens from the RTL side", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, { name: "RTL Responsive User" });
    await seedAuth(page, user.token);
    await page.addInitScript(() => {
      window.localStorage.setItem("najda-language", "ar");
    });

    await page.goto("/profile");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "فتح قائمة التنقل" }).click();
    const drawer = page.locator("aside");
    await expect(drawer).toBeVisible();

    const viewportWidth = page.viewportSize().width;
    await expect
      .poll(async () => {
        const box = await drawer.boundingBox();
        return box.x + box.width;
      }, { timeout: 2000 })
      .toBeLessThanOrEqual(viewportWidth + 1);

    const drawerBox = await drawer.boundingBox();
    expect(drawerBox.x).toBeGreaterThanOrEqual(0);
    await expect(
      page.getByRole("button", { name: "إغلاق قائمة التنقل" })
    ).toBeVisible();
  });
});
