import { test, expect } from "@playwright/test";
import { registerUser, seedAuth, uniqueId } from "./helpers.js";

test.describe("profile", () => {
  test("profile page shows the data captured at registration", async ({
    page,
    request,
  }) => {
    // patient_id has a unique constraint in the backend — it must be
    // distinct per run, not a fixed literal (a fixed value collides with
    // whatever a previous run of this same spec already committed).
    const patientId = uniqueId("PID-");
    const user = await registerUser(request, {
      name: "Profile Data Check",
      patient_id: patientId,
      gender: "Male",
      blood_type: "O+",
      chronic_conditions: ["Asthma"],
      emergency_name: "Sara Contact",
      emergency_phone: "01098765432",
    });
    await seedAuth(page, user.token);

    await page.goto("/profile");

    await expect(page.getByText("Profile Data Check").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(user.email).first()).toBeVisible();
    await expect(page.getByText(patientId).first()).toBeVisible();
    await expect(page.getByText("O+").first()).toBeVisible();
    await expect(page.getByText("Sara Contact").first()).toBeVisible();
    await expect(page.getByText("01098765432").first()).toBeVisible();
    await expect(page.getByText("Asthma").first()).toBeVisible();
  });

  test("editing blood type persists after save", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, { blood_type: "A+" });
    await seedAuth(page, user.token);

    await page.goto("/edit-profile");

    // Wait for the form to be populated from GET /profile/me before touching it.
    await expect(page.locator('input[type="date"]').first()).toBeVisible({
      timeout: 15000,
    });

    // DOM order on this page is: [0] Gender select, [1] Blood Type select.
    const bloodTypeSelect = page.locator("select").nth(1);
    await expect(bloodTypeSelect).toHaveValue("A+");
    await bloodTypeSelect.selectOption("AB-");

    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(/\/profile$/, { timeout: 20000 });

    // Reload to prove it was actually persisted server-side, not just local state.
    await page.reload();
    await expect(page.getByText("AB-").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("edit profile keeps authenticated load failures on-page with a safe error", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await seedAuth(page, user.token);
    const backendDetail = "operator-only profile detail";

    await page.route("**/profile/me", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: backendDetail }),
      });
    });

    await page.goto("/edit-profile");

    await expect(page).toHaveURL(/\/edit-profile$/);
    await expect(
      page.getByText("Something went wrong. Please try again.", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(backendDetail, { exact: true })).toHaveCount(0);
  });
});
