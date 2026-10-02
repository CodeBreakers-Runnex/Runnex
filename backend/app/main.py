from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import activities, chatbot, events, groups, pet, products, users

app = FastAPI(title="Veloxy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://veloxy-run.web.app",
        "https://veloxy-run.firebaseapp.com",
        "http://localhost:5173",
        # App Android (Capacitor 8 serve o app em https://localhost) e iOS.
        # Sem estas origens o WebView bloqueia toda chamada autenticada no
        # preflight de CORS - o APK logava (Firebase direto), mas nao
        # conseguia salvar corrida nem carregar nada do backend.
        "https://localhost",
        "capacitor://localhost",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(activities.router)
app.include_router(pet.router)
app.include_router(groups.router)
app.include_router(events.router)
app.include_router(products.router)
app.include_router(chatbot.router)


@app.get("/health")
def health():
    return {"status": "ok"}
