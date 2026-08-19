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

  test("translates public forms and persists a manual English choice", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "مرحبًا بعودتك" })
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("أدخل بريدك الإلكتروني")
    ).toBeVisible();

    await page
      .getByRole("button", { name: "التبديل إلى الإنجليزية" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Welcome Back" })
    ).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("najda-language"))).toBe(
      "en"
    );

    await page.reload();
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create Your Account" })
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("re-renders visible signup validation errors after switching languages", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "إنشاء حساب" }).click();

    await expect(page.getByText("أدخل اسمك الكامل", { exact: true })).toBeVisible();

    await page
      .getByRole("button", { name: "التبديل إلى الإنجليزية" })
      .click();

    await expect(page.getByText("Enter your full name", { exact: true })).toBeVisible();
  });

  test("submits stable disease values after selecting an Arabic disease label", async ({ page }) => {
    await page.route("**/auth/register", async (route) => {
      const payload = route.request().postDataJSON();
      expect(payload.chronic_conditions).toEqual(["Diabetes"]);
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Unexpected service failure" }),
      });
    });

    await page.goto("/signup");
    await page.getByRole("button", { name: "السكري" }).click();
    await page.getByPlaceholder("أدخل اسمك الكامل").fill("Test User");
    await page.getByPlaceholder("أدخل بريدك الإلكتروني").fill("test@example.com");
    await page.getByPlaceholder("أنشئ كلمة مرور").fill("correct-horse-battery-staple");
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "إنشاء حساب" }).click();

    await expect(
      page.getByText("حدث خطأ أثناء إنشاء حسابك.", { exact: true })
    ).toBeVisible();
  });
});

async function fillRequiredSignupFields(page) {
  await page.getByPlaceholder("Enter your full name").fill("Test User");
  await page.getByPlaceholder("Enter your email").fill("test@example.com");
  await page.getByPlaceholder("Create a password").fill("correct-horse-battery-staple");
  await page.locator('input[type="checkbox"]').check();
}

test("maps email conflicts to localized email errors", async ({ page }) => {
  await page.route("**/auth/register", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Email already exists" }),
    })
  );

  await page.goto("/signup");
  await fillRequiredSignupFields(page);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(
    page.getByText("An account with this email already exists.", { exact: true })
  ).toBeVisible();
});

test("maps ambiguous and unknown registration failures without exposing backend details", async ({ page }) => {
  const backendDetails = [
    "Email or patient ID already exists",
    "operator-only detail: token=secret-value",
  ];
  let requestCount = 0;

  await page.route("**/auth/register", (route) => {
    const detail = backendDetails[requestCount++];
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ detail }),
    });
  });

  await page.goto("/signup");
  await fillRequiredSignupFields(page);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(
    page.getByText(
      "An account with this email or patient ID already exists.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByText(backendDetails[0], { exact: true })).toHaveCount(0);

  await page.getByPlaceholder("Enter your email").fill("other@example.com");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(
    page.getByText("Something went wrong while creating your account.", {
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText(backendDetails[1], { exact: true })).toHaveCount(0);
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
