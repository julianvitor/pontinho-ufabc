"""
Pontinho - Ponto de Entrada Principal da Aplicação FastAPI
"""
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Configuração de paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import init_db
from backend.routers import auth_router, feed_router, matches_router, users_router, admin_router

app = FastAPI(
    title="Pontinho API",
    description="Backend modularizado do aplicativo de conexões Pontinho",
    version="2.0.0"
)

# Inicializa banco de dados SQLite e migrações automáticas
init_db()

# Diretório do Frontend
FRONTEND_DIR = PROJECT_ROOT / "frontend"
FRONTEND_DIR.mkdir(exist_ok=True)

# Monta diretórios estáticos
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
if (FRONTEND_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
if (FRONTEND_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")

# Inclusão dos Roteadores Modulares
app.include_router(auth_router)
app.include_router(feed_router)
app.include_router(matches_router)
app.include_router(users_router)
app.include_router(admin_router)

# Rotas de páginas HTML para navegação direta
@app.get("/", response_class=FileResponse)
def serve_home():
    return FileResponse(FRONTEND_DIR / "index.html")

@app.get("/index.html", response_class=FileResponse)
def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")

@app.get("/login.html", response_class=FileResponse)
def serve_login():
    return FileResponse(FRONTEND_DIR / "login.html")

@app.get("/profile.html", response_class=FileResponse)
def serve_profile():
    return FileResponse(FRONTEND_DIR / "profile.html")

@app.get("/matches.html", response_class=FileResponse)
def serve_matches():
    return FileResponse(FRONTEND_DIR / "matches.html")

@app.get("/admin.html", response_class=FileResponse)
def serve_admin():
    return FileResponse(FRONTEND_DIR / "admin.html")

# Aliases de compatibilidade para arquivos estáticos
@app.get("/static/style.css", response_class=FileResponse)
def serve_css_alias():
    return FileResponse(FRONTEND_DIR / "css" / "style.css")

@app.get("/static/app.js", response_class=FileResponse)
def serve_js_alias():
    return FileResponse(FRONTEND_DIR / "js" / "app.js")
