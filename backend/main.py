"""
Pontinho - Ponto de Entrada Principal da Aplicação FastAPI (API REST Pura)
"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Configuração de paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import init_db
from backend.teaser import pregenerate_all_teasers
from backend.routers import (
    auth_router,
    feed_router,
    matches_router,
    users_router,
    admin_router,
    upload_router,
    events_router,
    help_router
)

app = FastAPI(
    title="Pontinho API",
    description="Backend modularizado e API REST pura do aplicativo Pontinho",
    version="2.0.0"
)

# Habilita CORS para permitir que o frontend desacoplado acesse a API
# (ex: servidor com live reload na porta 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa banco de dados SQLite e migrações automáticas
init_db()
pregenerate_all_teasers()

# Cria e monta o diretório de uploads estáticos
DATA_DIR = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Inclusão dos Roteadores Modulares da API
app.include_router(auth_router)
app.include_router(feed_router)
app.include_router(matches_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(upload_router)
app.include_router(events_router)
app.include_router(help_router)

@app.get("/")
def api_root():
    """
    Endpoint raiz da API REST pura.
    O frontend é servido de forma desacoplada na porta 3000 com Live Reload.
    """
    return {
        "status": "online",
        "app": "Pontinho API",
        "version": "2.0.0",
        "docs": "/docs",
        "frontend": "http://127.0.0.1:3000"
    }
