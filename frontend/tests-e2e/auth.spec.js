import { test, expect } from "@playwright/test";
import { registerUser, seedAuth, uniqueEmail } from "./helpers.js";

test.describe("auth", () => {
  test("signup via UI creates an account and lands on /profile", async ({
    page,
  }) => {
    const email = uniqueEmail("signup");
    const password = "TestPass123!";

    await page.goto("/signup");

    await page.getByPlaceholder("Enter your full name").fill("Signup Test User");
    await page.getByPlaceholder("Enter your email").fill(email);
    await page.getByPlaceholder("Create a password").fill(password);
    await page.getByRole("checkbox").check();

    await page.getByRole("button", { name: "Create Account" }).click();

    await page.waitForURL(/\/profile$/, { timeout: 20000 });
    expect(page.url()).toMatch(/\/profile$/);
  });

  test("login with wrong password shows an error", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);

    await page.goto("/login");

    await page.getByPlaceholder("Enter your email").fill(user.email);
    await page.getByPlaceholder("Enter your password").fill("WrongPassword999!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(
      page.getByText("Incorrect email or password")
    ).toBeVisible({ timeout: 15000 });

    // Must not have navigated away from /login.
    expect(page.url()).toMatch(/\/login$/);
  });

  test("login with correct password redirects to /profile", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);

    await page.goto("/login");

    await page.getByPlaceholder("Enter your email").fill(user.email);
    await page.getByPlaceholder("Enter your password").fill(user.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.waitForURL(/\/profile$/, { timeout: 20000 });
    expect(page.url()).toMatch(/\/profile$/);
  });

  test("logout via chat sidebar returns to /login", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await seedAuth(page, user.token);

    await page.goto("/chat");
    await expect(
      page.getByPlaceholder("Type your message...")
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Logout" }).click();

    await page.waitForURL(/\/login$/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/login$/);

    // The token must actually be cleared, not just a route change.
    const token = await page.evaluate(() =>
      window.localStorage.getItem("accessToken")
    );
    expect(token).toBeNull();
  });

  test("unauthenticated visit to /chat redirects to /login", async ({
    page,
  }) => {
    await page.goto("/chat");
    await page.waitForURL(/\/login$/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/login$/);
  });
});
