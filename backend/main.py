from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.auth import router as auth_router
from routers.chat import router as chat_router
from routers.profile import router as profile_router

app = FastAPI()

# Allow the frontend dev server(s) to call this API.
# Add/replace with whatever origin your frontend actually runs on
# (check the URL in your browser's address bar while developing).
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(profile_router)


@app.get("/")
def root():
    return {
        "message": "CacheAI Backend is running!"
    }