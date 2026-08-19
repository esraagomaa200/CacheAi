import { test, expect } from "@playwright/test";
import { registerUser, seedAuth } from "./helpers.js";

test.describe("profile", () => {
  test("profile page shows the data captured at registration", async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, {
      name: "Profile Data Check",
      patient_id: "PID-12345",
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
    await expect(page.getByText("PID-12345").first()).toBeVisible();
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
});
