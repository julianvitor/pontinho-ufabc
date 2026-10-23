"""
Módulo de Geração e Proteção de Teasers do Álbum Secreto (Server-side Destructive Blur).
Garante que a imagem do álbum secreto seja processada e borrada irreversivelmente
no servidor antes de ser entregue ao cliente, prevenindo extração por hackers
mesmo se inspecionarem o DOM ou a aba Network do navegador.
"""
import os
import io
import hashlib
import logging
from pathlib import Path
from PIL import Image, ImageFilter

logger = logging.getLogger("pontinho.teaser")

DATA_DIR = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
UPLOAD_DIR = DATA_DIR / "uploads"
PRIVATE_UPLOAD_DIR = DATA_DIR / "private_uploads"
TEASERS_DIR = UPLOAD_DIR / "teasers"
TEASERS_DIR.mkdir(parents=True, exist_ok=True)
PRIVATE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

BLUR_RADIUS = 35
MAX_TEASER_DIMENSION = 600

def get_or_create_server_blurred_teaser(photo_source: str, user_id: int) -> str | None:
    """
    Recebe o caminho local da primeira foto privada do usuário (confinada a /uploads ou /api/media/private).
    Gera de forma permanente e irreversível uma versão borrada em WebP salva em /uploads/teasers/.
    Retorna a URL pública segura do arquivo (ex: /uploads/teasers/teaser_2_ab12cd34.webp).
    """
    if not photo_source or not isinstance(photo_source, str):
        return None

    # Gera hash estável do identificador da foto para invalidação de cache
    source_clean = photo_source.strip()
    photo_hash = hashlib.sha256(source_clean.encode("utf-8")).hexdigest()[:16]
    safe_filename = f"teaser_{user_id}_{photo_hash}.webp"
    target_path = TEASERS_DIR / safe_filename

    # Retorna do cache se já existir no disco
    if target_path.exists() and target_path.stat().st_size > 0:
        return f"/uploads/teasers/{safe_filename}"

    # Prevenção estrita de SSRF: bloqueia qualquer protocolo externo
    if source_clean.lower().startswith(("http://", "https://", "ftp://", "//")):
        logger.warning(f"[Security SSRF Blocked] Requisição externa para foto de teaser rejeitada: {source_clean}")
        return None

    # Sanitização estrita contra Path Traversal
    local_rel = source_clean
    is_private_route = False
    if local_rel.startswith("/api/media/private/"):
        local_rel = local_rel[len("/api/media/private/"):]
        is_private_route = True
    elif local_rel.startswith("api/media/private/"):
        local_rel = local_rel[len("api/media/private/"):]
        is_private_route = True
    elif local_rel.startswith("/uploads/"):
        local_rel = local_rel[len("/uploads/"):]
    elif local_rel.startswith("uploads/"):
        local_rel = local_rel[len("uploads/"):]
    elif local_rel.startswith("/"):
        local_rel = local_rel.lstrip("/")

    # Remove query params se existirem (ex: ?token=...)
    if "?" in local_rel:
        local_rel = local_rel.split("?", 1)[0]

    try:
        # Se for rota privada, tenta em PRIVATE_UPLOAD_DIR primeiro
        local_file = None
        if is_private_route:
            candidate = (PRIVATE_UPLOAD_DIR / local_rel).resolve()
            if candidate.is_relative_to(PRIVATE_UPLOAD_DIR.resolve()) and candidate.is_file():
                local_file = candidate

        # Se não encontrou ou não for rota privada, busca em UPLOAD_DIR
        if not local_file:
            candidate = (UPLOAD_DIR / local_rel).resolve()
            if candidate.is_relative_to(UPLOAD_DIR.resolve()) and candidate.is_file():
                local_file = candidate

        # Se ainda não encontrou, tenta PRIVATE_UPLOAD_DIR como fallback
        if not local_file:
            candidate = (PRIVATE_UPLOAD_DIR / local_rel).resolve()
            if candidate.is_relative_to(PRIVATE_UPLOAD_DIR.resolve()) and candidate.is_file():
                local_file = candidate

        if not local_file or not local_file.is_file():
            logger.warning(f"[Security Path Traversal or File Missing Blocked] Caminho inválido: {photo_source}")
            return None
        img = Image.open(local_file)

        # Se for animação (GIF animado), extrai apenas o primeiro frame estático
        if getattr(img, "is_animated", False):
            img.seek(0)

        # Converte para RGB para compatibilidade universal e processamento
        processed = img.convert("RGB")

        # Redimensiona proporcionalmente para otimizar transferência e render
        if processed.width > MAX_TEASER_DIMENSION or processed.height > MAX_TEASER_DIMENSION:
            processed.thumbnail((MAX_TEASER_DIMENSION, MAX_TEASER_DIMENSION), Image.Resampling.LANCZOS)

        # Aplica desfoque Gaussiano destrutivo no servidor (irreversível)
        blurred = processed.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))

        # Salva em WebP comprimido de alta performance
        blurred.save(target_path, format="WEBP", quality=75, optimize=True)
        return f"/uploads/teasers/{safe_filename}"

    except Exception as e:
        logger.error(f"Erro ao gerar teaser borrado para usuário {user_id} ({photo_source}): {e}")
        return None

def pregenerate_all_teasers():
    """Varre todos os usuários com álbum secreto e pré-gera os teasers borrados em cache."""
    import sqlite3
    import json

    db_path = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve()
    if not db_path.exists():
        return

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT id, private_photos FROM users WHERE private_photos IS NOT NULL AND private_photos != '[]'")
        rows = cursor.fetchall()
        conn.close()

        for user_id, private_photos_json in rows:
            try:
                photos = json.loads(private_photos_json) if private_photos_json else []
                if photos and isinstance(photos, list) and photos[0]:
                    get_or_create_server_blurred_teaser(photos[0], user_id)
            except Exception:
                continue
    except Exception as e:
        logger.error(f"Erro na pré-geração em lote de teasers: {e}")
