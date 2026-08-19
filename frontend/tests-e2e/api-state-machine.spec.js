import { test, expect } from "@playwright/test";
import { BACKEND_URL, authHeaders, createSession, registerUser } from "./helpers.js";

// Pure API spec: exercises the EmergencyEvent state machine directly against
// the backend, independent of live-AI risk scoring (which the UI spec can't
// deterministically trigger). Every emergency chat session's event starts in
// "monitoring" as soon as the session is created — see
// backend/routers/chat.py create_chat_session.

test.describe("emergency event state machine (API)", () => {
  test("respond from monitoring resolves the event", async ({ request }) => {
    const user = await registerUser(request);
    const session = await createSession(request, user.token, "emergency");
    const eventId = session.emergency_event.id;
    expect(session.emergency_event.escalation_status).toBe("monitoring");

    const respondRes = await request.post(
      `${BACKEND_URL}/emergency/events/${eventId}/respond`,
      { headers: authHeaders(user.token) }
    );
    expect(respondRes.status()).toBe(200);
    const resolved = await respondRes.json();
    expect(resolved.escalation_status).toBe("resolved");
    expect(resolved.resolved_at).toBeTruthy();
  });

  test("a second respond call on an already-resolved event returns 409", async ({
    request,
  }) => {
    const user = await registerUser(request);
    const session = await createSession(request, user.token, "emergency");
    const eventId = session.emergency_event.id;

    const first = await request.post(
      `${BACKEND_URL}/emergency/events/${eventId}/respond`,
      { headers: authHeaders(user.token) }
    );
    expect(first.status()).toBe(200);

    const second = await request.post(
      `${BACKEND_URL}/emergency/events/${eventId}/respond`,
      { headers: authHeaders(user.token) }
    );
    expect(second.status()).toBe(409);
  });

  test("escalate from monitoring (skipping alert_pending) returns 409", async ({
    request,
  }) => {
    const user = await registerUser(request);
    const session = await createSession(request, user.token, "emergency");
    const eventId = session.emergency_event.id;
    expect(session.emergency_event.escalation_status).toBe("monitoring");

    const escalateRes = await request.post(
      `${BACKEND_URL}/emergency/events/${eventId}/escalate`,
      { headers: authHeaders(user.token) }
    );
    expect(escalateRes.status()).toBe(409);
  });

  test("a user cannot respond, escalate, or read another user's event (404)", async ({
    request,
  }) => {
    const owner = await registerUser(request);
    const intruder = await registerUser(request);

    const session = await createSession(request, owner.token, "emergency");
    const eventId = session.emergency_event.id;

    const respondRes = await request.post(
      `${BACKEND_URL}/emergency/events/${eventId}/respond`,
      { headers: authHeaders(intruder.token) }
    );
    expect(respondRes.status()).toBe(404);

    const escalateRes = await request.post(
      `${BACKEND_URL}/emergency/events/${eventId}/escalate`,
      { headers: authHeaders(intruder.token) }
    );
    expect(escalateRes.status()).toBe(404);

    // The intruder's own event list must not include the owner's event.
    const listRes = await request.get(`${BACKEND_URL}/emergency/events`, {
      headers: authHeaders(intruder.token),
    });
    expect(listRes.status()).toBe(200);
    const { events } = await listRes.json();
    expect(events.find((e) => e.id === eventId)).toBeUndefined();

    // The owner, meanwhile, can see and act on their own event.
    const ownerRespond = await request.post(
      `${BACKEND_URL}/emergency/events/${eventId}/respond`,
      { headers: authHeaders(owner.token) }
    );
    expect(ownerRespond.status()).toBe(200);
  });

  test("cross-user 404 also applies to a chat session (404 not leaked data)", async ({
    request,
  }) => {
    const owner = await registerUser(request);
    const intruder = await registerUser(request);

    const session = await createSession(request, owner.token, "normal");
    const sessionId = session.session.id;

    const res = await request.get(
      `${BACKEND_URL}/chat/sessions/${sessionId}/messages`,
      { headers: authHeaders(intruder.token) }
    );
    expect(res.status()).toBe(404);
  });
});
