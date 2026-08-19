import { test, expect } from "@playwright/test";
import { loginViaApi } from "./helpers.js";

// AI replies can take 5-45s (external LLM engines) — chat expects need
// generous timeouts.
const AI_REPLY_TIMEOUT = 60000;

// Bubbles are counted via `p[dir="auto"]` inside the message list: both the
// user bubble and the assistant bubble render exactly one such paragraph for
// their content, regardless of styling/markup changes elsewhere on the page.
const bubbleLocator = (page) => page.locator('main p[dir="auto"]');

test.describe("chat", () => {
  test("sending one message renders exactly 2 bubbles (no duplicates)", async ({
    page,
    request,
  }) => {
    await loginViaApi(page, request);

    await page.goto("/chat");

    const input = page.getByPlaceholder("اكتب رسالتك...");
    await expect(input).toBeVisible({ timeout: 15000 });

    await input.fill("عندي صداع بسيط من الصبح");
    await input.press("Enter");

    // 1 user bubble appears immediately (optimistic render).
    await expect(bubbleLocator(page)).toHaveCount(1, { timeout: 10000 });

    // Then exactly 2 once the assistant reply lands — this is the exact
    // regression this test guards: no duplicate bubbles from the
    // optimistic-message / server-message reconciliation in Chat.jsx.
    await expect(bubbleLocator(page)).toHaveCount(2, {
      timeout: AI_REPLY_TIMEOUT,
    });

    // Give the UI a moment to settle, then assert the count is stable (not
    // still growing, not flickering back down).
    await page.waitForTimeout(1000);
    await expect(bubbleLocator(page)).toHaveCount(2);
  });

  test("new session appears in sidebar history and reloads the same thread", async ({
    page,
    request,
  }) => {
    await loginViaApi(page, request);

    await page.goto("/chat");

    const input = page.getByPlaceholder("اكتب رسالتك...");
    await expect(input).toBeVisible({ timeout: 15000 });

    // The "New Chat" button (create a new chat) is rendered before the
    // <nav> that holds Chat History + Profile, so it is always first in
    // DOM/accessibility order — use .first() to disambiguate it from a
    // same-named session entry (see note below).
    const newChatButton = page.getByRole("button", { name: "New Chat" }).first();
    const navButtons = page.getByRole("navigation").getByRole("button");

    // Fresh user, no chats yet: only the "Profile" entry lives in the nav.
    await expect(navButtons).toHaveCount(1, { timeout: 15000 });

    const messageText = "اختبار سجل الجلسة الجانبي";
    await input.fill(messageText);
    await input.press("Enter");

    await expect(bubbleLocator(page)).toHaveCount(2, {
      timeout: AI_REPLY_TIMEOUT,
    });

    // The session should now be reflected in the URL and in the sidebar.
    await expect(page).toHaveURL(/[?&]session=\d+/);

    // A new entry appears in Chat History (session button + Profile = 2).
    // NOTE: not asserting on the entry's label text here — SideBar.jsx
    // fetches the session list on the location.search change fired right
    // after session creation, which happens BEFORE sendMessage() sets the
    // session's auto-title server-side, and there is no later refetch. So
    // the sidebar entry is stuck showing the literal string "New Chat"
    // instead of the real title, even though the thread underneath is
    // correct. This is a genuine app bug (stale sidebar title), reported
    // separately — this test instead verifies the real mechanic: a session
    // entry exists and clicking it reloads the right thread.
    await expect(navButtons).toHaveCount(2, { timeout: 15000 });
    const sessionLink = navButtons.first();

    const currentUrl = page.url();

    // Navigate away to a fresh chat, then click back into the session from
    // the sidebar and confirm the same 2 messages reload.
    await newChatButton.click();
    await expect(page).not.toHaveURL(currentUrl);

    await sessionLink.click();
    await expect(page).toHaveURL(currentUrl);

    await expect(bubbleLocator(page)).toHaveCount(2, { timeout: 15000 });
    await expect(bubbleLocator(page).first()).toHaveText(messageText);
  });

  test("New Chat clears the current thread", async ({ page, request }) => {
    await loginViaApi(page, request);

    await page.goto("/chat");

    const input = page.getByPlaceholder("اكتب رسالتك...");
    await expect(input).toBeVisible({ timeout: 15000 });

    await input.fill("رسالة قبل مسح المحادثة");
    await input.press("Enter");

    await expect(bubbleLocator(page)).toHaveCount(2, {
      timeout: AI_REPLY_TIMEOUT,
    });

    // .first(): once this session exists, its stale sidebar entry also
    // reads "New Chat" (see bug note in the previous test) — .first() picks
    // the real "create new chat" button, which is first in DOM order.
    await page.getByRole("button", { name: "New Chat" }).first().click();

    await expect(bubbleLocator(page)).toHaveCount(0, { timeout: 10000 });
    await expect(page).toHaveURL(/\/chat$/);
  });
});
