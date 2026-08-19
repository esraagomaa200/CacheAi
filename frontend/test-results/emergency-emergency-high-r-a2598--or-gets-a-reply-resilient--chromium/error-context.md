# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: emergency.spec.js >> emergency >> high-risk message either triggers the safety countdown or gets a reply (resilient)
- Location: tests-e2e\emergency.spec.js:42:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('main p[dir="auto"]')
Expected: 2
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('main p[dir="auto"]')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - img "CacheAI" [ref=e6]
      - generic [ref=e7]: NajdaAI
    - button "New Chat" [ref=e8]
    - navigation [ref=e11]:
      - generic [ref=e12]: Chat History
      - button "محادثة طوارئ 🚨" [ref=e14]
      - button "Profile" [ref=e20]
    - generic [ref=e26]:
      - button "Logout" [ref=e27]
      - generic [ref=e32]:
        - heading "Need urgent help?" [level=3] [ref=e33]
        - paragraph [ref=e34]: If you are experiencing a medical emergency, please call your local emergency number.
  - main [ref=e35]:
    - generic [ref=e36]:
      - generic [ref=e37]: 🚨 وضع الطوارئ
      - generic [ref=e38]: منخفض
    - generic [ref=e39]:
      - heading "محادثة الطوارئ" [level=1] [ref=e40]
      - button [ref=e41]
    - paragraph [ref=e48]: ابدأ المحادثة الآن — اسأل عن أي أعراض أو استفسار طبي.
    - generic [ref=e51]:
      - textbox "اكتب رسالتك..." [active] [ref=e52]: صدري بيوجعني جامد والألم بيمتد لدراعي الشمال وعرقان عرق بارد ومش قادر اتنفس
      - button "التحدث بالصوت" [ref=e53]
      - button [ref=e57]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { loginViaApi, BACKEND_URL, authHeaders } from "./helpers.js";
  3   | 
  4   | const AI_REPLY_TIMEOUT = 60000;
  5   | const COUNTDOWN_POLL_BUDGET_MS = 90000;
  6   | 
  7   | const bubbleLocator = (page) => page.locator('main p[dir="auto"]');
  8   | 
  9   | test.describe("emergency", () => {
  10  |   test("mode=emergency shows the emergency header and creates an event", async ({
  11  |     page,
  12  |     request,
  13  |   }) => {
  14  |     await loginViaApi(page, request);
  15  | 
  16  |     await page.goto("/chat?mode=emergency");
  17  | 
  18  |     await expect(page.getByText("وضع الطوارئ")).toBeVisible({
  19  |       timeout: 15000,
  20  |     });
  21  | 
  22  |     // The event must exist server-side too, tied to the session in the URL —
  23  |     // not just a UI label.
  24  |     await expect(page).toHaveURL(/[?&]session=(\d+)/);
  25  |     const sessionId = Number(
  26  |       new URL(page.url()).searchParams.get("session")
  27  |     );
  28  | 
  29  |     const token = await page.evaluate(() =>
  30  |       window.localStorage.getItem("accessToken")
  31  |     );
  32  |     const eventsRes = await request.get(`${BACKEND_URL}/emergency/events`, {
  33  |       headers: authHeaders(token),
  34  |     });
  35  |     expect(eventsRes.ok()).toBeTruthy();
  36  |     const { events } = await eventsRes.json();
  37  |     const match = events.find((e) => e.chat_session_id === sessionId);
  38  |     expect(match).toBeTruthy();
  39  |     expect(match.escalation_status).toBe("monitoring");
  40  |   });
  41  | 
  42  |   test("high-risk message either triggers the safety countdown or gets a reply (resilient)", async ({
  43  |     page,
  44  |     request,
  45  |   }) => {
  46  |     await loginViaApi(page, request);
  47  | 
  48  |     await page.goto("/chat?mode=emergency");
  49  | 
  50  |     const input = page.getByPlaceholder("اكتب رسالتك...");
  51  |     await expect(input).toBeVisible({ timeout: 15000 });
  52  | 
  53  |     const redFlagMessage =
  54  |       "صدري بيوجعني جامد والألم بيمتد لدراعي الشمال وعرقان عرق بارد ومش قادر اتنفس";
  55  |     await input.fill(redFlagMessage);
  56  |     await input.press("Enter");
  57  | 
  58  |     const imOkButton = page.getByRole("button", { name: "أنا بخير ✅" });
  59  | 
  60  |     // The emergency_event (if the AI scored the message high/emergency risk)
  61  |     // is applied in the very same state update as the assistant reply, so
  62  |     // once the reply lands we only need one more check, not extra waiting.
  63  |     const deadline = Date.now() + COUNTDOWN_POLL_BUDGET_MS;
  64  |     let sawCountdown = false;
  65  |     let sawReply = false;
  66  | 
  67  |     while (Date.now() < deadline) {
  68  |       if (await imOkButton.isVisible().catch(() => false)) {
  69  |         sawCountdown = true;
  70  |         break;
  71  |       }
  72  |       if ((await bubbleLocator(page).count()) >= 2) {
  73  |         sawReply = true;
  74  |         if (await imOkButton.isVisible().catch(() => false)) {
  75  |           sawCountdown = true;
  76  |         }
  77  |         break;
  78  |       }
  79  |       await page.waitForTimeout(1000);
  80  |     }
  81  | 
  82  |     if (!sawCountdown && !sawReply) {
  83  |       // Neither happened within the 90s budget — fail with a clear signal
  84  |       // about what never arrived, instead of silently passing.
> 85  |       await expect(bubbleLocator(page)).toHaveCount(2, { timeout: 5000 });
      |                                         ^ Error: expect(locator).toHaveCount(expected) failed
  86  |     }
  87  | 
  88  |     if (sawCountdown) {
  89  |       await expect(imOkButton).toBeVisible();
  90  |       await imOkButton.click();
  91  | 
  92  |       // Resolved state: the "I'm OK" card (and its button) must disappear.
  93  |       await expect(imOkButton).not.toBeVisible({ timeout: 15000 });
  94  |     } else {
  95  |       // The live AI did not score this as high/emergency risk this run.
  96  |       // Deterministic coverage of the alert_pending -> resolved/escalated
  97  |       // state machine lives in api-state-machine.spec.js instead.
  98  |       await expect(bubbleLocator(page)).toHaveCount(2, {
  99  |         timeout: AI_REPLY_TIMEOUT,
  100 |       });
  101 |       test.info().annotations.push({
  102 |         type: "skip-note",
  103 |         description:
  104 |           "Live AI did not score this message as high/emergency risk in this run; countdown UI was not exercised. See api-state-machine.spec.js for deterministic state-machine coverage.",
  105 |       });
  106 |     }
  107 |   });
  108 | 
  109 |   test("emergency history lists the created event with an Arabic status", async ({
  110 |     page,
  111 |     request,
  112 |   }) => {
  113 |     await loginViaApi(page, request);
  114 | 
  115 |     // Create at least one emergency event server-side via the UI flow.
  116 |     await page.goto("/chat?mode=emergency");
  117 |     await expect(page.getByText("وضع الطوارئ")).toBeVisible({
  118 |       timeout: 15000,
  119 |     });
  120 | 
  121 |     await page.goto("/emergency-history");
  122 | 
  123 |     const knownStatusLabels = [
  124 |       "تحت المراقبة",
  125 |       "في انتظار الرد",
  126 |       "تم الاطمئنان",
  127 |       "تم إبلاغ جهة الاتصال",
  128 |     ];
  129 | 
  130 |     const statusRegex = new RegExp(knownStatusLabels.join("|"));
  131 |     await expect(page.getByText(statusRegex).first()).toBeVisible({
  132 |       timeout: 15000,
  133 |     });
  134 |   });
  135 | });
  136 | 
```