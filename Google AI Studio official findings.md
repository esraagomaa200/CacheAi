# Google AI Studio official findings

Source: https://ai.google.dev/gemini-api/docs/ai-studio-quickstart

Google AI Studio is a playground for trying Gemini models and experimenting with prompts. When ready to build, the user can select Get code and choose a programming language for the Gemini API.

The Chat prompt interface supports multiple input/response turns. The Run settings panel supports model parameters, safety settings, structured output, function calling, code execution, and grounding tools. The official guide presents System Instructions and example user/model interactions as the basic way to shape behavior.

This makes the supplied link useful for prototyping Najda's Arabic clinical assistant prompt, testing Arabic paraphrases, refining the refusal behavior, and comparing Gemini output quality. It does not automatically modify the local Najda RAG code or its Qdrant/BM25 indexes. To integrate it, the user would need to export/copy the prompt and optionally use Get code with a Gemini API key, then adapt the model call in app/agent.py. The existing retrieval and safety gates should remain the source-of-truth for evidence and scope.
