import { test, expect } from "@playwright/test";
import { registerUser, seedAuth } from "./helpers.js";

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

test("starts and toggles language when acquiring localStorage throws", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage access blocked");
      },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Smart Healthcare, Anytime, Anywhere" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { name: "رعاية صحية ذكية، في أي وقت وأي مكان" })).toBeVisible();
});

test("translates authenticated page families while preserving dynamic content", async ({
  page,
  request,
}) => {
  const user = await registerUser(request, { name: "Mixed Demo User" });
  await seedAuth(page, user.token);
  await page.addInitScript(() =>
    localStorage.setItem("najda-language", "ar")
  );

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "ملفي الشخصي" })
  ).toBeVisible();
  await expect(page.getByText("Mixed Demo User").first()).toBeVisible();

  await page.goto("/chat");
  await expect(page.getByPlaceholder("اكتب رسالتك...")).toBeVisible();

  await page.goto("/emergency");
  await expect(
    page.getByRole("heading", { name: "مساعدة الطوارئ" })
  ).toBeVisible();
});

test("moves navigation and keeps its border on the content edge", async ({
  page,
  request,
}) => {
  const user = await registerUser(request, { name: "RTL Geometry User" });
  await seedAuth(page, user.token);
  await page.addInitScript(() => localStorage.setItem("najda-language", "ar"));
  await page.goto("/profile");

  const viewport = page.viewportSize();
  const arabicBox = await page.locator("aside").boundingBox();
  expect(arabicBox.x).toBeGreaterThan(viewport.width / 2);
  const arabicBorders = await page.locator("aside").evaluate((aside) => {
    const style = getComputedStyle(aside);
    return { left: style.borderLeftWidth, right: style.borderRightWidth };
  });
  expect(arabicBorders.left).not.toBe("0px");
  expect(arabicBorders.right).toBe("0px");

  await page.getByRole("button", { name: "التبديل إلى الوضع الداكن" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByRole("button", { name: "التبديل إلى الإنجليزية" }).click();
  const englishBox = await page.locator("aside").boundingBox();
  expect(englishBox.x).toBeLessThan(viewport.width / 4);
  const englishBorders = await page.locator("aside").evaluate((aside) => {
    const style = getComputedStyle(aside);
    return { left: style.borderLeftWidth, right: style.borderRightWidth };
  });
  expect(englishBorders.left).toBe("0px");
  expect(englishBorders.right).not.toBe("0px");
});

test("keeps the header account email LTR in Arabic", async ({ page, request }) => {
  const user = await registerUser(request, { name: "RTL Header User" });
  await seedAuth(page, user.token);
  await page.addInitScript(() => localStorage.setItem("najda-language", "ar"));
  await page.goto("/");

  await page.getByRole("button", { name: "فتح قائمة المستخدم" }).click();
  await expect(page.getByText(user.email, { exact: true })).toHaveAttribute(
    "dir",
    "ltr"
  );
});

test("localizes the header logo and does not force the localized account fallback LTR", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("najda-language", "ar"));
  await page.goto("/");

  await expect(page.getByAltText("شعار نجدة AI")).toBeVisible();
  await page.getByRole("button", { name: "فتح قائمة المستخدم" }).click();
  await expect(
    page.getByRole("paragraph").filter({
      hasText: "يرجى التسجيل أو تسجيل الدخول لعرض ملفك الشخصي.",
    })
  ).not.toHaveAttribute("dir", "ltr");
});

test("keeps the rendered emergency contact phone LTR in Arabic", async ({
  page,
}) => {
  await seedAuth(page, "rtl-contact-token");
  await page.addInitScript(() => localStorage.setItem("najda-language", "ar"));
  await page.route("**/chat/sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          session: { id: 741, title: "Emergency", chat_type: "emergency" },
          emergency_event: {
            id: 742,
            escalation_status: "alert_pending",
            timer_seconds: 2,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ sessions: [] }),
    });
  });
  await page.route("**/emergency/events/742/escalate", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        event: { id: 742, escalation_status: "escalated" },
        emergency_contact: { name: "Emergency Contact", phone: "01012345678" },
      }),
    });
  });

  await page.goto("/chat?mode=emergency");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel(/متبقي [٠-٩]+ ثانية/)).toHaveText(/^[٠-٩]+$/);
  await expect(page.getByText("01012345678", { exact: true })).toHaveAttribute(
    "dir",
    "ltr"
  );
});
