"""
Módulo de Entrega Segura de Mídia Privada do Pontinho (Álbum Secreto)
Implementa controle estrito de acesso para arquivos do Álbum Secreto (VULN-09):
- Imagens privadas NÃO são servidas por diretório estático público
- Acesso condicionado à autenticação válida (Bearer Token, Cookie ou Query Token assinado)
- Autorização estrita: apenas o proprietário da foto, administrador ou parceiro com
  solicitação aprovada na tabela `private_access_requests` pode visualizar a imagem
- Proteção contra Path Traversal e vazamento de diretório
- Cabeçalhos de resposta que proíbem cache em proxies intermediários ou CDN pública
"""
import os
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse
from backend.auth import get_current_user_id
from backend.database import get_db

router = APIRouter(prefix="/api/media", tags=["media"])

DATA_DIR = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
UPLOAD_DIR = DATA_DIR / "uploads"
PRIVATE_UPLOAD_DIR = DATA_DIR / "private_uploads"
PRIVATE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.get("/private/{filename}")
async def get_private_photo(filename: str, request: Request):
    """
    Entrega controlada de fotos do Álbum Secreto.
    Apenas o dono da foto ou usuários com match aprovado têm permissão de acesso.
    """
    user_id = get_current_user_id(request)

    # 1. Prevenção estrita contra Path Traversal
    safe_filename = Path(filename).name
    if not safe_filename or safe_filename in (".", ".."):
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido.")

    file_path = (PRIVATE_UPLOAD_DIR / safe_filename).resolve()

    # Suporte a fallback retrocompatível caso o arquivo privado legado esteja em UPLOAD_DIR
    if not (file_path.is_relative_to(PRIVATE_UPLOAD_DIR.resolve()) and file_path.is_file()):
        fallback_path = (UPLOAD_DIR / safe_filename).resolve()
        if fallback_path.is_relative_to(UPLOAD_DIR.resolve()) and fallback_path.is_file():
            file_path = fallback_path
        else:
            raise HTTPException(status_code=404, detail="Arquivo privado não encontrado.")

    # 2. Validação de Autorização via Banco de Dados
    conn = get_db()
    cursor = conn.cursor()

    # Obtém dados do usuário atual
    cursor.execute("SELECT id, is_admin FROM users WHERE id = ?", (user_id,))
    current_user_row = cursor.fetchone()
    if not current_user_row:
        conn.close()
        raise HTTPException(status_code=401, detail="Usuário não autenticado.")

    is_admin = bool(current_user_row["is_admin"])

    # Localiza quem é o proprietário desta imagem no banco de dados
    search_pattern = f"%{safe_filename}%"
    cursor.execute("SELECT id FROM users WHERE private_photos LIKE ?", (search_pattern,))
    owners = cursor.fetchall()
    owner_ids = [row["id"] for row in owners]

    authorized = False

    # Caso A: O usuário autenticado é o próprio proprietário da foto
    if user_id in owner_ids:
        authorized = True
    # Caso B: O usuário autenticado é administrador do sistema (auditoria e moderação)
    elif is_admin:
        authorized = True
    else:
        # Caso C: Usuário possui match mútuo com permissão concedida e status 'approved'
        for owner_id in owner_ids:
            cursor.execute("""
                SELECT status FROM private_access_requests
                WHERE requester_id = ? AND target_id = ? AND status = 'approved'
            """, (user_id, owner_id))
            if cursor.fetchone():
                authorized = True
                break

    conn.close()

    if not authorized:
        raise HTTPException(
            status_code=403,
            detail="Acesso não autorizado a esta foto do Álbum Secreto. É necessário ter match e permissão concedida."
        )

    # 3. Retorno do arquivo com headers de segurança e proibição de cache intermediário
    headers = {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff"
    }

    media_type = "image/gif" if safe_filename.lower().endswith(".gif") else "image/webp"
    return FileResponse(file_path, media_type=media_type, headers=headers)
