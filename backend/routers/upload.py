"""
Rota de Upload Seguro e Otimização de Imagens do Pontinho
Inclui:
- Sanitização rigorosa de arquivos
- Proteção contra estouro de memória (leitura em chunks limitados a 10MB)
- Proteção contra Image Bomb / Decompression Bomb
- Remoção total de metadados EXIF para privacidade
- Correção de rotação (exif_transpose) para fotos de smartphones
- Redimensionamento proporcional (max 1200x1200px)
- Compressão de alta eficiência em WebP
- Anti-flood / Rate limiting em memória por usuário/IP
"""
import io
import os
import time
import uuid
from pathlib import Path
from collections import defaultdict
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from PIL import Image, ImageOps

router = APIRouter(prefix="/api/upload", tags=["upload"])

# Configurações de diretórios e limites de segurança
DATA_DIR = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024     # 10 MB máximo de stream na requisição
CHUNK_SIZE = 64 * 1024               # Leitura segura de 64 KB por chunk para evitar pico de RAM
MAX_DIMENSION = 1200                 # Redimensiona mantendo proporção para no máximo 1200x1200px
WEBP_QUALITY = 82                    # Qualidade de compressão WebP (redução típica de 80% a 90% do tamanho)
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}

# Anti-flood em memória: máximo de 15 uploads por minuto por identificador (usuário ou IP)
RATE_LIMIT_WINDOW = 60
MAX_UPLOADS_PER_WINDOW = 15
_UPLOAD_TRACKER = defaultdict(list)

def _check_rate_limit(client_id: str):
    now = time.time()
    recent = [t for t in _UPLOAD_TRACKER[client_id] if now - t < RATE_LIMIT_WINDOW]
    if len(recent) >= MAX_UPLOADS_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail="Limite de envio de fotos excedido. Por favor, aguarde um minuto para enviar mais imagens."
        )
    recent.append(now)
    _UPLOAD_TRACKER[client_id] = recent

@router.post("/photo")
async def upload_photo(request: Request, file: UploadFile = File(...)):
    """
    Recebe uma imagem, valida o cabeçalho real, sanitiza, redimensiona,
    remove metadados EXIF e comprime para WebP.
    """
    # Identificador para rate-limiting (ID do usuário no cabeçalho/cookie ou IP)
    user_id = request.headers.get("X-User-Id")
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_id = f"user_{user_id}" if user_id else f"ip_{client_ip}"
    _check_rate_limit(rate_limit_id)

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

    # 1. Leitura segura em chunks para impedir estouro de memória (Streaming Buffer)
    buffer = io.BytesIO()
    total_bytes = 0
    try:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Arquivo muito grande. O limite máximo permitido é de {MAX_FILE_SIZE // (1024*1024)} MB."
                )
            buffer.write(chunk)
    finally:
        await file.close()

    if total_bytes == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    buffer.seek(0)

    # 2. Processamento, Sanitização e Compressão com Pillow
    try:
        # Previne ataques de Image Bomb (imagens com dimensões desproporcionais que explodem em RAM ao descomprimir)
        Image.MAX_IMAGE_PIXELS = 25_000_000

        img = Image.open(buffer)
        raw_format = (img.format or "").upper()
        if raw_format not in ALLOWED_FORMATS:
            raise HTTPException(
                status_code=400,
                detail="Formato de imagem não suportado. Por favor envie JPG, PNG, WEBP ou GIF."
            )

        # Corrige orientação física de fotos tiradas em celulares verticais
        img = ImageOps.exif_transpose(img)

        # Redimensionamento proporcional (Downscale seguro com filtro Lanczos de alta nitidez)
        if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

        # Normalização de canais de cor
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            # Mantém canal alfa em WebP se a imagem possuir transparência
            processed_img = img.convert("RGBA")
        elif img.mode != "RGB":
            processed_img = img.convert("RGB")
        else:
            processed_img = img

        # Gera nome único com UUID criptográfico (descarta totalmente o nome original para segurança)
        safe_filename = f"{uuid.uuid4().hex}.webp"
        destination_path = UPLOAD_DIR / safe_filename

        # Salva em WebP comprimido e otimizado (sem EXIF / metadados por padrão)
        processed_img.save(
            destination_path,
            format="WEBP",
            quality=WEBP_QUALITY,
            optimize=True,
            method=4
        )

        final_size = destination_path.stat().st_size

    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=400,
            detail="A imagem possui dimensões excessivas e foi rejeitada por segurança."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Falha ao processar e comprimir a imagem: {str(e)}"
        )

    return {
        "success": True,
        "url": f"/uploads/{safe_filename}",
        "filename": safe_filename,
        "original_size": total_bytes,
        "compressed_size": final_size,
        "compression_ratio": f"{round((1 - final_size / total_bytes) * 100, 1)}%" if total_bytes > 0 else "0%"
    }
