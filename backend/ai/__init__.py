"""AI package: RAG-backed Gemini triage agent for CacheAi.

Everything in here that touches Gemini or Qdrant is imported lazily inside
functions (see rag.py / agent.py) so the FastAPI app can still start up even
when GEMINI_API_KEY is absent or the optional deps aren't installed yet.
"""
