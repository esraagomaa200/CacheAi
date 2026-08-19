import { test, expect } from "@playwright/test";
import { loginViaApi, BACKEND_URL, authHeaders } from "./helpers.js";

const AI_REPLY_TIMEOUT = 60000;
const COUNTDOWN_POLL_BUDGET_MS = 90000;

const bubbleLocator = (page) => page.locator('main p[dir="auto"]');

test.describe("emergency", () => {
  test("mode=emergency shows the emergency header and creates an event", async ({
    page,
    request,
  }) => {
    await loginViaApi(page, request);

    await page.goto("/chat?mode=emergency");

    await expect(page.getByText("وضع الطوارئ")).toBeVisible({
      timeout: 15000,
    });

    // The event must exist server-side too, tied to the session in the URL —
    // not just a UI label.
    await expect(page).toHaveURL(/[?&]session=(\d+)/);
    const sessionId = Number(
      new URL(page.url()).searchParams.get("session")
    );

    const token = await page.evaluate(() =>
      window.localStorage.getItem("accessToken")
    );
    const eventsRes = await request.get(`${BACKEND_URL}/emergency/events`, {
      headers: authHeaders(token),
    });
    expect(eventsRes.ok()).toBeTruthy();
    const { events } = await eventsRes.json();
    const match = events.find((e) => e.chat_session_id === sessionId);
    expect(match).toBeTruthy();
    expect(match.escalation_status).toBe("monitoring");
  });

  test("high-risk message either triggers the safety countdown or gets a reply (resilient)", async ({
    page,
    request,
  }) => {
    await loginViaApi(page, request);

    await page.goto("/chat?mode=emergency");

    const input = page.getByPlaceholder("اكتب رسالتك...");
    await expect(input).toBeVisible({ timeout: 15000 });

    const redFlagMessage =
      "صدري بيوجعني جامد والألم بيمتد لدراعي الشمال وعرقان عرق بارد ومش قادر اتنفس";
    await input.fill(redFlagMessage);
    await input.press("Enter");

    const imOkButton = page.getByRole("button", { name: "أنا بخير ✅" });

    // The emergency_event (if the AI scored the message high/emergency risk)
    // is applied in the very same state update as the assistant reply, so
    // once the reply lands we only need one more check, not extra waiting.
    const deadline = Date.now() + COUNTDOWN_POLL_BUDGET_MS;
    let sawCountdown = false;
    let sawReply = false;

    while (Date.now() < deadline) {
      if (await imOkButton.isVisible().catch(() => false)) {
        sawCountdown = true;
        break;
      }
      if ((await bubbleLocator(page).count()) >= 2) {
        sawReply = true;
        if (await imOkButton.isVisible().catch(() => false)) {
          sawCountdown = true;
        }
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!sawCountdown && !sawReply) {
      // Neither happened within the 90s budget — fail with a clear signal
      // about what never arrived, instead of silently passing.
      await expect(bubbleLocator(page)).toHaveCount(2, { timeout: 5000 });
    }

    if (sawCountdown) {
      await expect(imOkButton).toBeVisible();
      await imOkButton.click();

      // Resolved state: the "I'm OK" card (and its button) must disappear.
      await expect(imOkButton).not.toBeVisible({ timeout: 15000 });
    } else {
      // The live AI did not score this as high/emergency risk this run.
      // Deterministic coverage of the alert_pending -> resolved/escalated
      // state machine lives in api-state-machine.spec.js instead.
      await expect(bubbleLocator(page)).toHaveCount(2, {
        timeout: AI_REPLY_TIMEOUT,
      });
      test.info().annotations.push({
        type: "skip-note",
        description:
          "Live AI did not score this message as high/emergency risk in this run; countdown UI was not exercised. See api-state-machine.spec.js for deterministic state-machine coverage.",
      });
    }
  });

  test("emergency history lists the created event with an Arabic status", async ({
    page,
    request,
  }) => {
    await loginViaApi(page, request);

    // Create at least one emergency event server-side via the UI flow.
    await page.goto("/chat?mode=emergency");
    await expect(page.getByText("وضع الطوارئ")).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/emergency-history");

    const knownStatusLabels = [
      "تحت المراقبة",
      "في انتظار الرد",
      "تم الاطمئنان",
      "تم إبلاغ جهة الاتصال",
    ];

    const statusRegex = new RegExp(knownStatusLabels.join("|"));
    await expect(page.getByText(statusRegex).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
