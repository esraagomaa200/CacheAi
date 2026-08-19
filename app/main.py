"""
Backend API — للربط مع الـ Frontend.
تشغيل: uvicorn app.main:app --reload --port 8000
"""
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from retrieval import Retriever
from agent import MedicalRAGAgent

load_dotenv()

app = FastAPI(title="NAJDA Medical RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ضيّقها لدومين الفرونت اند بتاعك وقت الـ deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading retriever + agent (may take ~30s on first run)...")
retriever = Retriever(data_dir="../data")
agent = MedicalRAGAgent(retriever, groq_api_key=os.environ.get("GROQ_API_KEY"))
print("Ready.")


class ChatRequest(BaseModel):
    question: str
    top_k: int = 5


class ChatResponse(BaseModel):
    answer: str
    sources: list
    grounded: bool


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    result = agent.answer(req.question, top_k=req.top_k)
    return result
