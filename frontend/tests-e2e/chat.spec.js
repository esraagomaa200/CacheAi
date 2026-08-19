import { test, expect } from "@playwright/test";
import { loginViaApi, waitForChatReady } from "./helpers.js";

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

    const input = page.getByPlaceholder("Type your message...");
    await expect(input).toBeVisible({ timeout: 15000 });
    await waitForChatReady(page);

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

    const input = page.getByPlaceholder("Type your message...");
    await expect(input).toBeVisible({ timeout: 15000 });
    await waitForChatReady(page);

    // The "New Chat" button (create a new chat) is rendered before the
    // <nav> that holds Chat History + Profile, so it is always first in
    // DOM/accessibility order — .first() disambiguates it defensively in
    // case a session title ever collides with this label.
    const newChatButton = page.getByRole("button", { name: "New Chat" }).first();

    const messageText = "Sidebar history regression check";
    await input.fill(messageText);
    await input.press("Enter");

    await expect(bubbleLocator(page)).toHaveCount(2, {
      timeout: AI_REPLY_TIMEOUT,
    });

    // The session should now be reflected in the URL and in the sidebar.
    await expect(page).toHaveURL(/[?&]session=\d+/);

    // Chat.jsx dispatches "najda:sessions-refresh" right after the server
    // auto-titles the session from this first message, and SideBar.jsx
    // listens for it — so the sidebar entry shows the real title (not a
    // stale "New Chat" placeholder from the pre-refresh fetch).
    const sessionLink = page.getByRole("button", { name: messageText });
    await expect(sessionLink).toBeVisible({ timeout: 15000 });

    const currentUrl = page.url();

    // Navigate away to a fresh chat, then click back into the session from
    // the sidebar and confirm the same 2 messages reload — not an empty
    // thread (Chat.jsx's resetToFreshChat() must release
    // selfCreatedSession.current, or this hits the "already own this
    // session" guard and never re-fetches).
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

    const input = page.getByPlaceholder("Type your message...");
    await expect(input).toBeVisible({ timeout: 15000 });
    await waitForChatReady(page);

    await input.fill("رسالة قبل مسح المحادثة");
    await input.press("Enter");

    await expect(bubbleLocator(page)).toHaveCount(2, {
      timeout: AI_REPLY_TIMEOUT,
    });

    // .first(): defensive disambiguation from the top nav button in case a
    // session's own title ever happens to read "New Chat" too (DOM order
    // puts the real "create new chat" button first regardless).
    await page.getByRole("button", { name: "New Chat" }).first().click();

    await expect(bubbleLocator(page)).toHaveCount(0, { timeout: 10000 });
    await expect(page).toHaveURL(/\/chat$/);
  });

  test("sidebar shows a safe error instead of empty history when sessions fail", async ({
    page,
    request,
  }) => {
    await loginViaApi(page, request);
    const backendDetail = "database host leaked";

    await page.route("**/chat/sessions", async (route) => {
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

    await page.goto("/chat");

    await expect(
      page.getByText("Something went wrong. Please try again.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("No chats yet", { exact: true })
    ).toHaveCount(0);
    await expect(page.getByText(backendDetail, { exact: true })).toHaveCount(0);
  });
});
