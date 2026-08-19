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
  }) => {
    await seedAuth(page, "failed-profile-load-token");
    const backendDetail = "operator-only profile detail";

    let putRequests = 0;
    await page.route("**/profile/me", async (route) => {
      if (route.request().method() === "PUT") {
        putRequests += 1;
        await route.fulfill({ status: 204, body: "" });
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
    const saveButton = page.getByRole("button", { name: "Save Changes" });
    await expect(saveButton).toBeDisabled();
    await saveButton.click({ force: true });
    await expect.poll(() => putRequests).toBe(0);
  });

  test("localizes known gender values and preserves unknown values as dynamic content", async ({
    page,
  }) => {
    await seedAuth(page, "profile-gender-token");
    await page.addInitScript(() => localStorage.setItem("najda-language", "ar"));

    let gender = "Male";
    await page.route("**/profile/me", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          user: { name: "Gender Check", email: "gender@example.com" },
          patient_profile: {
            patient_id: "GENDER-1",
            date_of_birth: null,
            gender,
            blood_type: null,
            chronic_conditions: ["Asthma", "Diabetes"],
          },
          emergency_contact: null,
        }),
      })
    );

    await page.goto("/profile");
    await expect(page.getByText("ذكر", { exact: true })).toBeVisible();
    await expect(page.getByText("Male", { exact: true })).toHaveCount(0);
    await expect(page.getByText("٢", { exact: true })).toBeVisible();

    gender = "Nonbinary / غير ثنائي";
    await page.reload();
    await expect(
      page.getByText("Nonbinary / غير ثنائي", { exact: true })
    ).toHaveAttribute("dir", "auto");
  });
});
