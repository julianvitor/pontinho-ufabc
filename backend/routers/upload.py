"""
Rota de Upload Seguro e Sanitização de Imagens e GIFs do Pontinho
Inclui:
- Aceita estritamente imagens (JPEG, PNG, WEBP) e GIFs animados
- Vídeos devem ser convertidos em GIF pelo cliente (frontend) antes do envio
- Proteção contra Image Bomb / Decompression Bomb
- Remoção total de metadados EXIF para privacidade
- Correção de rotação (exif_transpose) para fotos de smartphones
- Redimensionamento proporcional seguro
- Compressão de alta eficiência em WebP e GIF otimizado
- Anti-flood / Rate limiting em memória por usuário/IP
- Moderação automatizada de conteúdo (NudeNet)
"""
import io
import os
import time
import uuid
from pathlib import Path
from collections import defaultdict
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from PIL import Image, ImageOps, ImageSequence
from backend.auth import get_current_user_id
from backend.moderation import check_image_safety

router = APIRouter(prefix="/api/upload", tags=["upload"])

# Configurações de diretórios e limites de segurança
DATA_DIR = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PRIVATE_UPLOAD_DIR = DATA_DIR / "private_uploads"
PRIVATE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 40 * 1024 * 1024       # 40 MB máximo para stream de imagem/GIF
CHUNK_SIZE = 64 * 1024                 # Leitura segura de 64 KB por chunk para evitar pico de RAM
MAX_DIMENSION = 1900                   # Redimensiona fotos mantendo proporção para no máximo 1900x1900
WEBP_QUALITY = 95                     # Qualidade de compressão WebP
ALLOWED_IMAGE_FORMATS = {"WEBP", "GIF"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v", ".3gp", ".ogv"}

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
            detail="Limite de envio de mídias excedido. Por favor, aguarde um minuto para enviar novos arquivos."
        )
    recent.append(now)
    _UPLOAD_TRACKER[client_id] = recent

def _is_video(filename: str, content_type: str, peek_bytes: bytes) -> bool:
    """Identifica se o arquivo enviado se trata de um vídeo via MIME, extensão ou magic numbers."""
    ct = (content_type or "").lower()
    fn = (filename or "").lower()
    ext = Path(fn).suffix.lower()

    if ct.startswith("video/"):
        return True
    if ext in VIDEO_EXTENSIONS:
        return True

    if len(peek_bytes) >= 12:
        # Assinaturas ISO base media (MP4, MOV, etc): ftyp, moov, mdat, wide, free
        if peek_bytes[4:8] in (b"ftyp", b"moov", b"mdat", b"wide", b"free"):
            return True
        # WebM / Matroska EBML
        if peek_bytes[:4] == b"\x1a\x45\xdf\xa3":
            return True
        # AVI
        if peek_bytes[:4] == b"RIFF" and peek_bytes[8:12] == b"AVI ":
            return True

    return False

@router.post("/photo")
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    is_private: bool = False
):
    """
    Recebe imagem já comprimida em WebP ou GIF animado.
    Toda conversão de fotos (JPEG/PNG) ou vídeos (MP4/WebM) é realizada previamente pelo frontend no navegador.
    - Valida formato estrito (WEBP ou GIF)
    - Sanitiza, remove metadados EXIF e valida integridade
    - Executa moderação automática de segurança e armazena em diretório isolado.
    """
    user_id = get_current_user_id(request)
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_id = f"user_{user_id}"
    _check_rate_limit(rate_limit_id)

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

    # 1. Leitura do cabeçalho inicial para detecção do tipo de mídia
    peek = await file.read(512)
    if not peek:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    # Rejeita arquivos de vídeo enviados diretamente: a conversão para GIF agora é feita no front-end
    if _is_video(file.filename, file.content_type, peek):
        raise HTTPException(
            status_code=400,
            detail="O servidor aceita apenas imagens e GIFs animados. Para vídeos curtos, use a conversão para GIF do aplicativo."
        )

    target_dir = PRIVATE_UPLOAD_DIR if is_private else UPLOAD_DIR

    # 2. Leitura segura do fluxo em chunks limitados
    buffer = io.BytesIO()
    buffer.write(peek)
    total_bytes = len(peek)

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

    buffer.seek(0)
    is_animated = False

    try:
        # Previne ataques de Image Bomb (imagens desproporcionais que explodem em RAM)
        Image.MAX_IMAGE_PIXELS = 25_000_000

        img = Image.open(buffer)
        raw_format = (img.format or "").upper()
        if raw_format not in ALLOWED_IMAGE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail="Formato não suportado. O servidor aceita exclusivamente imagens já convertidas em WebP (.webp) ou GIFs animados (.gif)."
            )

        is_animated = (raw_format == "GIF" or getattr(img, "is_animated", False)) and getattr(img, "n_frames", 1) > 1

        if is_animated:
            # Limite máximo de segurança de frames para evitar DoS por exaustão de memória
            max_frames = 120
            frames = []
            durations = []
            loop = img.info.get("loop", 0)

            for i, frame in enumerate(ImageSequence.Iterator(img)):
                if i >= max_frames:
                    break
                f = frame.copy()
                if f.width > MAX_DIMENSION or f.height > MAX_DIMENSION:
                    f.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
                durations.append(frame.info.get("duration", 100))
                frames.append(f)

            if not frames:
                raise HTTPException(status_code=400, detail="Arquivo GIF inválido.")

            safe_filename = f"{uuid.uuid4().hex}.gif"
            destination_path = target_dir / safe_filename

            # Salva o GIF animado preservando frames, timing e loop
            frames[0].save(
                destination_path,
                save_all=True,
                append_images=frames[1:],
                format="GIF",
                duration=durations,
                loop=loop,
                optimize=True
            )
        else:
            # Corrige orientação física de fotos tiradas em celulares verticais
            img = ImageOps.exif_transpose(img)

            # Redimensionamento proporcional (Downscale seguro com filtro Lanczos de alta nitidez)
            if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
                img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

            # Normalização de canais de cor
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                processed_img = img.convert("RGBA")
            elif img.mode != "RGB":
                processed_img = img.convert("RGB")
            else:
                processed_img = img

            safe_filename = f"{uuid.uuid4().hex}.webp"
            destination_path = target_dir / safe_filename

            # Salva em WebP comprimido e otimizado (sem EXIF / metadados por padrão)
            processed_img.save(
                destination_path,
                format="WEBP",
                quality=WEBP_QUALITY,
                optimize=True,
                method=4
            )

        final_size = destination_path.stat().st_size

        # Moderação Automática de Conteúdo
        safety_check = check_image_safety(str(destination_path))
        if not safety_check.get("allowed", True):
            destination_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail=safety_check.get("reason", "A imagem ou GIF enviado não atende às diretrizes de conteúdo da comunidade.")
            )

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
    finally:
        # Liberação imediata de buffers e memória do processo
        try:
            buffer.close()
        except Exception:
            pass
        if "img" in locals() and hasattr(img, "close"):
            try:
                img.close()
            except Exception:
                pass
        if "processed_img" in locals() and hasattr(processed_img, "close"):
            try:
                processed_img.close()
            except Exception:
                pass
        if "frames" in locals() and isinstance(frames, list):
            for f in frames:
                try:
                    f.close()
                except Exception:
                    pass
            frames.clear()
        import gc
        gc.collect()
        try:
            import ctypes
            libc = ctypes.CDLL("libc.so.6")
            libc.malloc_trim(0)
        except Exception:
            pass

    url_path = f"/api/media/private/{safe_filename}" if is_private else f"/uploads/{safe_filename}"
    return {
        "success": True,
        "url": url_path,
        "filename": safe_filename,
        "is_private": is_private,
        "media_type": "gif" if is_animated else "image",
        "original_size": total_bytes,
        "compressed_size": final_size,
        "compression_ratio": f"{round((1 - final_size / total_bytes) * 100, 1)}%" if total_bytes > 0 else "0%"
    }
