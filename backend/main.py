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
    media_router,
    events_router,
    help_router
)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida da aplicação: inicializa recursos e libera memória excedente."""
    # Inicializa banco de dados SQLite e migrações automáticas
    init_db()
    pregenerate_all_teasers()

    # Executa coleta de lixo e força liberação de heap do glibc para o SO
    import gc
    gc.collect()
    try:
        import ctypes
        libc = ctypes.CDLL("libc.so.6")
        libc.malloc_trim(0)
    except Exception:
        pass

    yield

app = FastAPI(
    title="Pontinho API",
    description="Backend modularizado e API REST pura do aplicativo Pontinho",
    version="2.0.0",
    lifespan=lifespan
)

# Habilita CORS para permitir que o frontend desacoplado acesse a API
# (ex: servidor com live reload na porta 3000)
app.add_middleware(
    CORSMiddleware,
    # Permite localhost, redes locais, Cloudflare Workers (*.workers.dev), Pages (*.pages.dev) e domínios próprios
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$"
        r"|^https://.*\.workers\.dev$"
        r"|^https://.*\.pages\.dev$"
        r"|^https://.*\.julianvitor\.com\.br$"
        r"|^https://julianvitor\.com\.br$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(media_router)
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
