// Shared helpers for the E2E suite.
//
// Design: every spec registers its own fresh backend user directly via the
// API (fast, isolated, no UI dependency) and then seeds the SPA's
// localStorage token via addInitScript before the first navigation. This
// keeps chat/profile/emergency specs independent of the login UI, which is
// exercised on its own in auth.spec.js.

export const BACKEND_URL = "http://127.0.0.1:8000";

let counter = 0;

export function uniqueEmail(prefix = "e2e") {
  counter += 1;
  return `${prefix}${Date.now()}${counter}@test.com`;
}

/**
 * Registers a brand new user against the live backend.
 * Returns { email, password, token, name }.
 */
export async function registerUser(request, overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || "TestPass123!";
  const name = overrides.name || "Test Patient";

  const payload = {
    name,
    email,
    password,
    patient_id: overrides.patient_id ?? null,
    date_of_birth: overrides.date_of_birth ?? null,
    gender: overrides.gender ?? null,
    blood_type: overrides.blood_type ?? null,
    chronic_conditions: overrides.chronic_conditions ?? [],
    emergency_name: overrides.emergency_name ?? "Emergency Contact",
    emergency_phone: overrides.emergency_phone ?? "01000000000",
    emergency_email: overrides.emergency_email ?? null,
  };

  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: payload,
  });

  if (res.status() !== 201) {
    const body = await res.text();
    throw new Error(
      `registerUser failed: ${res.status()} ${res.statusText()} — ${body}`
    );
  }

  const body = await res.json();

  return {
    email,
    password,
    name,
    token: body.access_token,
  };
}

/**
 * Seeds the SPA's localStorage accessToken before any app script runs, so
 * the app boots already-authenticated. Must be called before page.goto().
 */
export async function seedAuth(page, token) {
  await page.addInitScript((t) => {
    window.localStorage.setItem("accessToken", t);
  }, token);
}

/**
 * Convenience: create a user and land the page on it, pre-authenticated.
 */
export async function loginViaApi(page, request, overrides = {}) {
  const user = await registerUser(request, overrides);
  await seedAuth(page, user.token);
  return user;
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Creates a chat session via the API for a given token.
 */
export async function createSession(request, token, chatType = "normal") {
  const res = await request.post(`${BACKEND_URL}/chat/sessions`, {
    headers: authHeaders(token),
    data: { chat_type: chatType },
  });
  if (!res.ok()) {
    throw new Error(`createSession failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Sends a message via the API for a given session/token.
 */
export async function sendMessageApi(request, token, sessionId, content) {
  const res = await request.post(
    `${BACKEND_URL}/chat/sessions/${sessionId}/messages`,
    {
      headers: authHeaders(token),
      data: { content },
    }
  );
  if (!res.ok()) {
    throw new Error(`sendMessage failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}
