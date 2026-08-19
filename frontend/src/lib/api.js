// Copy this file to: src/lib/api.js

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export function getAccessToken() {
  return localStorage.getItem("accessToken");
}

export function setAccessToken(token) {
  localStorage.setItem("accessToken", token);
}

export function clearAccessToken() {
  localStorage.removeItem("accessToken");
}

export function formatApiError(data, status) {
  const detail = data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.detail || String(item))
      .join(", ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return `Request failed with status ${status}`;
}

export async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = formatApiError(data, response.status);

    if (response.status === 401) {
      clearAccessToken();
    }

    throw new Error(detail);
  }

  return data;
}

export function createSession(chatType = "normal") {
  return apiFetch("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ title: null, chat_type: chatType }),
  });
}

export function listSessions() {
  return apiFetch("/chat/sessions");
}

export function getMessages(sessionId) {
  return apiFetch(`/chat/sessions/${sessionId}/messages`);
}

export function sendMessage(sessionId, content) {
  return apiFetch(`/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function respondEvent(eventId) {
  return apiFetch(`/emergency/events/${eventId}/respond`, {
    method: "POST",
  });
}

export function escalateEvent(eventId) {
  return apiFetch(`/emergency/events/${eventId}/escalate`, {
    method: "POST",
  });
}

export function listEmergencyEvents() {
  return apiFetch("/emergency/events");
}

export function mapBackendProfileToForm(data) {
  return {
    fullName: data.user?.name || "",
    email: data.user?.email || "",
    patientId: data.patient_profile?.patient_id || "",
    dateOfBirth: data.patient_profile?.date_of_birth || "",
    gender: data.patient_profile?.gender || "",
    bloodType: data.patient_profile?.blood_type || "",
    chronicDiseases: Array.isArray(data.patient_profile?.chronic_conditions)
      ? data.patient_profile.chronic_conditions
      : data.patient_profile?.chronic_conditions
        ? [data.patient_profile.chronic_conditions]
        : [],
    emergencyName: data.emergency_contact?.name || "",
    emergencyPhone: data.emergency_contact?.phone || "",
    emergencyEmail: data.emergency_contact?.email || "",
  };
}

export function profileFormToBackendPayload(formData, chronicDiseases) {
  return {
    name: formData.fullName?.trim() || null,
    email: formData.email?.trim() || null,
    patient_id: formData.patientId?.trim() || null,
    date_of_birth: formData.dateOfBirth || null,
    gender: formData.gender || null,
    blood_type: formData.bloodType || null,
    chronic_conditions: chronicDiseases || [],
    emergency_name: formData.emergencyName?.trim() || null,
    emergency_phone: formData.emergencyPhone?.trim() || null,
    emergency_email: formData.emergencyEmail?.trim() || null,
  };
}

// Voice-conversation TTS: returns a playable audio Blob (WAV) for the given
// text, or null when synthesis is unavailable — callers stay silent then.
export async function fetchTtsBlob(text) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      return null;
    }
    return await response.blob();
  } catch {
    return null;
  }
}
