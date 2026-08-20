import { expect, test } from "@playwright/test";

import { loginViaApi, waitForChatReady } from "./helpers";

/*
 * Regression guard for the live-voice engine boot path.
 *
 * A renamed constant once shipped as a runtime ReferenceError that only
 * fired when a real user clicked the mic (lint output had been truncated
 * in the gate, and no test ever pressed the button). This spec presses it:
 * Chromium's fake media stream grants a synthetic mic, so the WHOLE chain
 * runs headlessly — vendored ort wasm, Silero v5 model, WebRTC loopback,
 * WebSocket relay, Gemini Live session.
 */

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test.describe("live voice engine", () => {
  test("mic button boots the engine to a connected live session", async ({
    page,
    request,
  }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(msg.text());
      }
    });

    await loginViaApi(page, request);
    await page.goto("/chat");
    await waitForChatReady(page);

    await page.getByRole("button", { name: "Start voice call" }).click();

    // "Connected 🎙️" proves the full chain: session created, wasm + VAD
    // model loaded, loopback negotiated, WS relay up, Gemini session live.
    await expect(
      page.getByText(/Connected|Connecting|Reconnecting/).first()
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Connected 🎙️")).toBeVisible({
      timeout: 45_000,
    });

    // The class of failure this spec exists for must never ship again.
    const fatal = pageErrors.filter((e) =>
      /ReferenceError|is not defined|Failed to resolve import/.test(e)
    );
    expect(fatal).toEqual([]);

    // Hang up cleanly.
    await page.getByRole("button", { name: "End call" }).click();
    await expect(page.getByText("Connected 🎙️")).toBeHidden({
      timeout: 10_000,
    });
  });
});
