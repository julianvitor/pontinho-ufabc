"""
Pontinho - Ponto de Entrada Principal da Aplicação FastAPI (API REST Pura)
"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

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

import re

# Configuração dinâmica de CORS via variável de ambiente (CORS_ORIGINS)
# Suporta origens exatas e curingas '*' de nível único ou aninhado (ex: https://*.julianvitor.com.br, https://*.workers.dev)
def build_cors_regex() -> str:
    # Sempre permite localhost e IPs de redes locais para desenvolvimento
    base_patterns = [
        r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$"
    ]
    env_origins = os.getenv("CORS_ORIGINS", "")
    for origin in env_origins.split(","):
        cleaned = origin.strip()
        if not cleaned:
            continue
        # Suporta múltiplos níveis de subdomínios (ex: dev.pontinho.julianvitor.com.br)
        if cleaned.startswith("https://*."):
            domain = re.escape(cleaned[10:])
            base_patterns.append(f"^https://([a-zA-Z0-9_\\-]+\\.)*{domain}$")
        elif cleaned.startswith("http://*."):
            domain = re.escape(cleaned[9:])
            base_patterns.append(f"^http://([a-zA-Z0-9_\\-]+\\.)*{domain}$")
        else:
            escaped = re.escape(cleaned).replace(r"\*", r"[a-zA-Z0-9_\-.]+")
            base_patterns.append(f"^{escaped}$")
    return "|".join(base_patterns)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=build_cors_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Erro não tratado na rota {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocorreu um erro interno no servidor ao processar a requisição."}
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
