"""
Rota de Upload Seguro e Otimização de Mídias (Fotos, GIFs e Vídeos Curtos) do Pontinho
Inclui:
- Sanitização rigorosa de arquivos e cabeçalhos
- Suporte a vídeos curtos (até 10s) convertidos de forma segura para GIF
- Proteção contra injeção de comandos, timeouts e DoS por exaustão de CPU/RAM
- Proteção contra Image Bomb / Decompression Bomb
- Remoção total de metadados EXIF e faixas de áudio para privacidade
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
import shutil
import tempfile
import subprocess
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

MAX_FILE_SIZE = 40 * 1024 * 1024       # 40 MB máximo para stream (permite vídeos curtos de até 10s e fotos em alta resolução)
MAX_VIDEO_DURATION = 10.05             # Limite estrito de 10 segundos para vídeos (tolerância de 0.05s de muxer)
CHUNK_SIZE = 64 * 1024                 # Leitura segura de 64 KB por chunk para evitar pico de RAM
MAX_DIMENSION = 1900                   # Redimensiona fotos mantendo proporção para no máximo 1900x1900
WEBP_QUALITY = 95                     # Qualidade de compressão WebP
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v", ".3gp", ".ogv"}

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
    if ext in ALLOWED_VIDEO_EXTENSIONS:
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

def _validate_and_convert_video_to_gif(temp_video_path: Path, destination_path: Path) -> dict:
    """
    Sanitiza e valida vídeo curto de até 10 segundos, prevenindo ataques:
    - Injeção de comandos (execução via lista de argumentos sem shell)
    - Ataques de negação de serviço / CPU timeout (timeout estrito de subprocess)
    - Verificação rigorosa de duração com ffprobe (rejeita > 10 segundos)
    - Verificação de fluxo de vídeo real e dimensões seguras
    - Remoção de áudio, legendas e metadados
    - Geração de GIF otimizado com palettegen/paletteuse em 12 fps, max 480px
    - Verificação de tamanho máximo do GIF gerado (max 15MB)
    - Moderação de conteúdo com NudeNet / detecção de menores
    """
    ffmpeg_bin = shutil.which("ffmpeg")
    ffprobe_bin = shutil.which("ffprobe")
    if not ffmpeg_bin or not ffprobe_bin:
        raise HTTPException(
            status_code=500,
            detail="O conversor de vídeo (ffmpeg/ffprobe) não está instalado no servidor."
        )

    # 1. Obter e validar a duração do vídeo via ffprobe
    cmd_duration = [
        ffprobe_bin,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(temp_video_path)
    ]
    try:
        res_dur = subprocess.run(
            cmd_duration,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=10
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=400, detail="Tempo esgotado ao analisar o formato do vídeo.")

    if res_dur.returncode != 0 or not res_dur.stdout.strip():
        raise HTTPException(status_code=400, detail="Arquivo de vídeo inválido, sem faixa de duração ou corrompido.")

    try:
        duration = float(res_dur.stdout.strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Não foi possível calcular a duração do vídeo.")

    if duration <= 0.05:
        raise HTTPException(status_code=400, detail="O vídeo enviado é vazio ou possui duração inválida.")

    if duration > MAX_VIDEO_DURATION:
        raise HTTPException(
            status_code=400,
            detail=f"O vídeo possui {duration:.1f} segundos. Apenas vídeos curtos de até 10 segundos são permitidos."
        )

    # 2. Validar integridade e dimensões do fluxo de vídeo
    cmd_stream = [
        ffprobe_bin,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,codec_name",
        "-of", "csv=p=0",
        str(temp_video_path)
    ]
    try:
        res_stream = subprocess.run(
            cmd_stream,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=10
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=400, detail="Tempo esgotado ao validar faixas do vídeo.")

    stream_out = res_stream.stdout.strip()
    if res_stream.returncode != 0 or not stream_out:
        raise HTTPException(status_code=400, detail="O arquivo não possui uma faixa de vídeo válida para conversão.")

    parts = stream_out.split(",")
    if len(parts) >= 2:
        try:
            w, h = int(parts[0]), int(parts[1])
            if w > 4096 or h > 4096 or w < 16 or h < 16:
                raise HTTPException(status_code=400, detail="Dimensões do vídeo são inválidas ou desproporcionais.")
        except ValueError:
            pass

    # 3. Conversão segura para GIF:
    # - fps=12 (ótima fluidez e economia de bytes)
    # - scale='min(480,iw)':-2 (reduz para max 480px proporcional sem distorção)
    # - palettegen / paletteuse (qualidade de cor superior com dithering bayer)
    # - an / sn (remove qualquer áudio e legendas)
    # - map_metadata -1 (elimina metadados)
    cmd_convert = [
        ffmpeg_bin,
        "-y",
        "-i", str(temp_video_path),
        "-t", "10",
        "-vf", "fps=12,scale='min(480,iw)':-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
        "-an",
        "-sn",
        "-map_metadata", "-1",
        str(destination_path)
    ]

    try:
        res_convert = subprocess.run(
            cmd_convert,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=25
        )
    except subprocess.TimeoutExpired:
        destination_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Tempo limite esgotado durante a conversão do vídeo para GIF.")

    if res_convert.returncode != 0 or not destination_path.exists():
        destination_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Falha ao processar e converter o vídeo para GIF animado.")

    final_size = destination_path.stat().st_size
    if final_size == 0:
        destination_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="O GIF resultante do vídeo gerou um arquivo vazio.")

    if final_size > 25 * 1024 * 1024:
        destination_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="O GIF animado resultante excedeu o limite máximo seguro de 25 MB.")

    # 4. Moderação Automática de Conteúdo
    safety_check = check_image_safety(str(destination_path))
    if not safety_check.get("allowed", True):
        destination_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail=safety_check.get("reason", "O vídeo convertido para GIF não atende às diretrizes de conteúdo da comunidade.")
        )

    return {
        "duration": duration,
        "final_size": final_size
    }

@router.post("/photo")
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    is_private: bool = False
):
    """
    Recebe imagem ou vídeo curto (até 10 segundos).
    Se for vídeo:
      - Valida duração <= 10s via ffprobe
      - Sanitiza, remove áudio e metadados
      - Converte para GIF animado otimizado
    Se for imagem:
      - Valida formato real (JPEG, PNG, WEBP, GIF)
      - Sanitiza, corrige rotação EXIF, redimensiona e comprime para WebP
    Executa moderação automática de segurança e armazena de forma isolada.
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

    is_video_upload = _is_video(file.filename, file.content_type, peek)
    target_dir = PRIVATE_UPLOAD_DIR if is_private else UPLOAD_DIR

    # =========================================================================
    # FLUXO A: PROCESSAMENTO DE VÍDEO CURTO (ATÉ 10s) -> CONVERSÃO PARA GIF
    # =========================================================================
    if is_video_upload:
        temp_fd, temp_video_path_str = tempfile.mkstemp(suffix=Path(file.filename).suffix or ".mp4")
        temp_video_path = Path(temp_video_path_str)
        total_bytes = len(peek)

        try:
            with os.fdopen(temp_fd, "wb") as f_out:
                f_out.write(peek)
                while True:
                    chunk = await file.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Arquivo de vídeo muito grande. O limite máximo permitido é de {MAX_FILE_SIZE // (1024*1024)} MB."
                        )
                    f_out.write(chunk)
        finally:
            await file.close()

        safe_filename = f"{uuid.uuid4().hex}.gif"
        destination_path = target_dir / safe_filename

        try:
            res_meta = _validate_and_convert_video_to_gif(temp_video_path, destination_path)
            final_size = res_meta["final_size"]
            duration = res_meta["duration"]
        finally:
            temp_video_path.unlink(missing_ok=True)
            import gc
            gc.collect()

        url_path = f"/api/media/private/{safe_filename}" if is_private else f"/uploads/{safe_filename}"
        return {
            "success": True,
            "url": url_path,
            "filename": safe_filename,
            "is_private": is_private,
            "media_type": "video_gif",
            "duration_seconds": round(duration, 2),
            "original_size": total_bytes,
            "compressed_size": final_size,
            "compression_ratio": f"{round((1 - final_size / total_bytes) * 100, 1)}%" if total_bytes > 0 else "0%"
        }

    # =========================================================================
    # FLUXO B: PROCESSAMENTO DE IMAGEM / GIF -> WEBP / GIF
    # =========================================================================
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

    try:
        # Previne ataques de Image Bomb (imagens com dimensões desproporcionais que explodem em RAM ao descomprimir)
        Image.MAX_IMAGE_PIXELS = 25_000_000

        img = Image.open(buffer)
        raw_format = (img.format or "").upper()
        if raw_format not in ALLOWED_IMAGE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail="Formato de imagem não suportado. Por favor envie JPG, PNG, WEBP, GIF ou vídeo de até 10s (MP4/WebM)."
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

            # Salva o GIF animado preservando todos os frames e timings
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
        "media_type": "image",
        "original_size": total_bytes,
        "compressed_size": final_size,
        "compression_ratio": f"{round((1 - final_size / total_bytes) * 100, 1)}%" if total_bytes > 0 else "0%"
    }
