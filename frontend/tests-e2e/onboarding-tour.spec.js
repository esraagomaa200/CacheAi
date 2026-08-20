import { test, expect } from "@playwright/test";

import {
  BACKEND_URL,
  authHeaders,
  loginViaApi,
  waitForChatReady,
} from "./helpers";

// The tour suppresses itself under browser automation (navigator.webdriver)
// so its popover can't intercept clicks in the other specs; ?tour=1 lifts
// ONLY that suppression. The backend users.has_seen_tour flag stays
// authoritative, which is exactly what these tests verify.

test.describe("onboarding tour", () => {
  test("first visit walks through every stop, then never shows again", async ({
    page,
    request,
  }) => {
    const user = await loginViaApi(page, request);

    await page.goto("/chat?tour=1");
    await waitForChatReady(page);

    const popover = page.locator(".driver-popover");
    await expect(popover).toBeVisible({ timeout: 15000 });
    await expect(popover).toContainText("Start here");

    // Walk forward by BUTTON LABEL, not by popover visibility: driver.js
    // hides the popover transiently between steps, so "hidden" alone can't
    // distinguish a step transition from the real end of the tour. The next
    // button reads "Let's start" only on the final stop; clicking it there
    // closes the tour. Bounded loop so a broken tour fails fast.
    const nextBtn = page.locator(".driver-popover-next-btn");
    let sawFinalStop = false;
    for (let i = 0; i < 8; i += 1) {
      await expect(nextBtn).toBeVisible({ timeout: 5000 });
      const label = ((await nextBtn.textContent()) || "").trim();
      await nextBtn.click();
      if (label === "Let's start") {
        sawFinalStop = true;
        break;
      }
    }
    expect(sawFinalStop).toBe(true);
    await expect(popover).toBeHidden({ timeout: 5000 });

    // Finishing must persist to the ACCOUNT, not just this browser.
    await expect
      .poll(
        async () => {
          const res = await request.get(`${BACKEND_URL}/profile/me`, {
            headers: authHeaders(user.token),
          });
          const body = await res.json();
          return body?.user?.has_seen_tour;
        },
        { timeout: 10000 }
      )
      .toBe(true);

    // Same forced URL, same account — the backend flag alone must block it.
    await page.goto("/chat?tour=1");
    await waitForChatReady(page);
    await page.waitForTimeout(2500);
    await expect(popover).toBeHidden();
  });

  test("stays suppressed for automation without the ?tour flag", async ({
    page,
    request,
  }) => {
    await loginViaApi(page, request);

    await page.goto("/chat");
    await waitForChatReady(page);
    await page.waitForTimeout(2000);

    await expect(page.locator(".driver-popover")).toBeHidden();
  });
});
