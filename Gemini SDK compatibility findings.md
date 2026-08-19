# Gemini SDK compatibility findings

The user's Windows log showed `AttributeError: 'Client' object has no attribute 'interactions'` while using `google-genai`.

Official Google Gen AI Python SDK docs: https://googleapis.github.io/python-genai/

The official SDK documents `client.models.generate_content(model=..., contents=..., config=...)` and the `google.genai.types.GenerateContentConfig` configuration. It also documents `GEMINI_API_KEY` as an environment variable for the Gemini Developer API.

Official Gemini API reference: https://ai.google.dev/api/generate-content

The API reference documents the `models.generateContent` endpoint. The local implementation should use `client.models.generate_content` rather than `client.interactions.create` for compatibility with the user's installed SDK. JSON output can be requested with `response_mime_type="application/json"` and a response schema, with `system_instruction` and temperature 0.

Official SDK docs also support the `gemini-2.5-flash` model used in the project configuration.

## Model availability update

The user's API returned a 404 stating that `models/gemini-2.5-flash` is unavailable to new users and explicitly instructed migration to `models/gemini-3.6-flash`.

Google's official models page lists `gemini-3.6-flash` as a Stable model with model code `gemini-3.6-flash`: https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash

The project default and README were updated from `gemini-2.5-flash` to `gemini-3.6-flash`.
