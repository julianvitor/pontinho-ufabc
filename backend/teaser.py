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
import urllib.request
from pathlib import Path
from PIL import Image, ImageFilter

logger = logging.getLogger("pontinho.teaser")

DATA_DIR = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
UPLOAD_DIR = DATA_DIR / "uploads"
TEASERS_DIR = UPLOAD_DIR / "teasers"
TEASERS_DIR.mkdir(parents=True, exist_ok=True)

BLUR_RADIUS = 35
MAX_TEASER_DIMENSION = 600

def get_or_create_server_blurred_teaser(photo_source: str, user_id: int) -> str | None:
    """
    Recebe o caminho ou URL da primeira foto privada do usuário.
    Gera de forma permanente e irreversível uma versão borrada em WebP.
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

    try:
        img = None
        # Caso 1: Imagem externa (ex: Unsplash nos dados de seed)
        if source_clean.startswith("http://") or source_clean.startswith("https://"):
            req = urllib.request.Request(
                source_clean,
                headers={"User-Agent": "PontinhoSecurityBot/1.0 (UFABC Student Network)"}
            )
            with urllib.request.urlopen(req, timeout=6) as response:
                img_bytes = response.read()
            img = Image.open(io.BytesIO(img_bytes))

        # Caso 2: Arquivo local em /uploads
        else:
            local_rel = source_clean
            if local_rel.startswith("/uploads/"):
                local_rel = local_rel[len("/uploads/"):]
            elif local_rel.startswith("uploads/"):
                local_rel = local_rel[len("uploads/"):]
            elif local_rel.startswith("/"):
                local_rel = local_rel.lstrip("/")

            local_file = UPLOAD_DIR / local_rel
            if not local_file.exists():
                logger.warning(f"Arquivo local não encontrado para teaser: {local_file}")
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
