"""
Utilitários de autenticação, assinatura de sessão criptográfica e validação de e-mail do Pontinho UFABC
"""
import os
import sys
import time
import hmac
import hashlib
from pathlib import Path
from fastapi import Request, HTTPException, Response
from backend.database import get_db

# Carregamento defensivo de arquivo .env caso as variáveis ainda não estejam no ambiente
def _load_dotenv_fallback():
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

_load_dotenv_fallback()

SECRET_KEY = os.getenv("PONTINHO_SECRET_KEY")
INSECURE_DEFAULT_KEY = "ufabc_pontinho_super_secret_session_key_2026"

if not SECRET_KEY or len(SECRET_KEY.strip()) < 16 or SECRET_KEY == INSECURE_DEFAULT_KEY:
    raise RuntimeError(
        "FALHA CRÍTICA DE SEGURANÇA (VULN-02): A variável de ambiente 'PONTINHO_SECRET_KEY' "
        "não está definida ou possui valor fraco/padrão. "
        "Configure uma chave secreta criptográfica forte (mínimo de 32 caracteres) no arquivo .env."
    )

SESSION_COOKIE_NAME = "pontinho_session"
SESSION_MAX_AGE = 30 * 24 * 3600  # 30 dias

def create_session_token(user_id: int) -> str:
    """
    Gera um token de sessão assinado criptograficamente com HMAC-SHA256:
    formato: {user_id}.{timestamp}.{signature}
    """
    ts = int(time.time())
    payload = f"{user_id}.{ts}"
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"

def verify_session_token(token: str) -> int:
    """
    Verifica a autenticidade e validade temporal do token de sessão.
    Retorna o user_id autenticado ou None se inválido/forjado/expirado.
    """
    if not token or not isinstance(token, str):
        return None
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        user_id_str, ts_str, sig = parts
        payload = f"{user_id_str}.{ts_str}"
        expected_sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()

        # Comparação em tempo constante contra timing attacks
        if not hmac.compare_digest(sig, expected_sig):
            return None

        ts = int(ts_str)
        if time.time() - ts > SESSION_MAX_AGE:
            return None

        return int(user_id_str)
    except Exception:
        return None

def set_auth_session(response: Response, user_id: int) -> str:
    """Gera o token assinado e injeta no cookie da resposta."""
    token = create_session_token(user_id)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE,
        path="/",
        httponly=False,
        samesite="lax"
    )
    # Mantém pontinho_user_id compatível
    response.set_cookie(
        key="pontinho_user_id",
        value=str(user_id),
        max_age=SESSION_MAX_AGE,
        path="/",
        httponly=False,
        samesite="lax"
    )
    return token

def clear_auth_session(response: Response):
    """Limpa os cookies de sessão autenticada."""
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key="pontinho_user_id", path="/")

def get_current_user_id(request: Request) -> int:
    """
    Obtém e valida o ID do usuário através do token assinado ou headers de autorização.
    Protege contra forjamento manual de identidade em ambiente real.
    """
    # 1. Bearer Token no cabeçalho Authorization
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        uid = verify_session_token(token)
        if uid:
            return uid

    # 2. Token no cabeçalho X-Session-Token
    token_header = request.headers.get("x-session-token")
    if token_header:
        uid = verify_session_token(token_header.strip())
        if uid:
            return uid

    # 3. Cookie de sessão assinado pontinho_session
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        uid = verify_session_token(cookie_token.strip())
        if uid:
            return uid

    # 4. Token em parâmetro de query (para carregamento de mídias e imagens autenticadas)
    query_token = request.query_params.get("token")
    if query_token:
        uid = verify_session_token(query_token.strip())
        if uid:
            return uid

    # Rejeita qualquer outro formato ou identificador não assinado
    raise HTTPException(status_code=401, detail="Você precisa estar autenticado com uma sessão válida.")

def get_current_user(request: Request) -> dict:
    """
    Recupera os dados completos do usuário autenticado no banco.
    Lança 401 caso não esteja autenticado ou o usuário não exista mais.
    """
    user_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Sessão inválida ou usuário inexistente.")
    return dict(row)

def require_admin(request: Request) -> dict:
    """
    Garante que a requisição partiu de um usuário com privilégios de administrador.
    Lança 401 se não estiver autenticado e 403 se não for admin.
    """
    user = get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(
            status_code=403,
            detail="Acesso negado: privilégios de administrador necessários."
        )
    return user

def sanitize_and_validate_ufabc_email(email_raw: str, allow_any_domain: bool = False) -> str:
    """
    Sanitiza e valida e-mails no Pontinho.
    Exige obrigatoriamente que o domínio seja institucional da UFABC:
    @aluno.ufabc.edu.br ou @ufabc.edu.br
    """
    email = email_raw.strip().lower()
    if "@" not in email:
        email = f"{email}@aluno.ufabc.edu.br"

    parts = email.split("@")
    if len(parts) != 2 or len(parts[0].strip()) < 2:
        raise HTTPException(
            status_code=400,
            detail="Por favor, digite um e-mail válido."
        )

    domain = parts[1].strip()
    valid_domains = {"aluno.ufabc.edu.br", "ufabc.edu.br"}

    # Permite apenas e-mails de teste institucionais ou admin pré-configurados
    if not allow_any_domain and domain not in valid_domains and not email.endswith("@pontinho.app"):
        raise HTTPException(
            status_code=400,
            detail="Cadastro permitido exclusivamente com e-mail institucional da UFABC (@aluno.ufabc.edu.br ou @ufabc.edu.br)."
        )

    return email

