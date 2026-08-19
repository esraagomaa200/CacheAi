import { API_BASE_URL, setAccessToken } from "../lib/api";

async function handleLogin(email, password, navigate, setError ) {
  try {
    setError("");

    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg).join(", ")
        : data.detail;
      throw new Error(detail || "Login failed");
    }

    setAccessToken(data.access_token);
    navigate("/profile");
  } catch (error) {
    setError(error.message || "Unable to sign in");
  }
}
