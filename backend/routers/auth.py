"""
Rotas de autenticação (Login, Cadastro e Sessão) do Pontinho
"""
import os
import json
import time
import secrets
import logging
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Request, Response
from backend.database import get_db, hash_password, verify_password, needs_rehash
from backend.models import (
    RegisterRequest,
    LoginRequest,
    SendVerificationCodeRequest,
    VerifyCodeRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest
)
from backend.auth import (
    get_current_user_id,
    sanitize_and_validate_ufabc_email,
    set_auth_session,
    clear_auth_session
)
from backend.email_service import send_verification_email, send_password_reset_email

logger = logging.getLogger("pontinho.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register")
def register_user(data: RegisterRequest, response: Response, request: Request = None):
    """
    Cadastro de estudante com E-mail, Nome e Senha.
    """
    sanitized_email = sanitize_and_validate_ufabc_email(data.email)
    cleaned_name = data.name.strip()
    cleaned_pw = data.password.strip()

    if not data.terms_accepted:
        raise HTTPException(
            status_code=400,
            detail="É obrigatório aceitar os Termos de Uso e a Política de Privacidade (LGPD) para se cadastrar."
        )

    if not cleaned_name or not cleaned_pw:
        raise HTTPException(status_code=400, detail="Nome e Senha são obrigatórios.")

    if len(cleaned_pw) < 8:
        raise HTTPException(
            status_code=400,
            detail="A senha deve conter no mínimo 8 caracteres para sua segurança."
        )

    # Validação do ECA Digital (Lei 14.811/2024 e Proteção à Criança e Adolescente)
    if not data.age_verified or not data.liveness_passed:
        raise HTTPException(
            status_code=403,
            detail="O cadastro exige verificação biométrica facial de maioridade (+18) e prova de vida conforme o ECA Digital."
        )

    if data.estimated_age is not None and data.estimated_age < 18:
        raise HTTPException(
            status_code=403,
            detail="Acesso bloqueado: Idade estimada inferior a 18 anos. O aplicativo é restrito a maiores de idade segundo a legislação vigente."
        )

    verified_age_val = data.estimated_age if data.estimated_age and data.estimated_age >= 18 else 20

    # Processa snapshot da selfie de verificação se fornecida
    verification_photo_path = ""
    if data.face_snapshot and "base64," in data.face_snapshot:
        try:
            import base64
            from pathlib import Path
            import uuid
            header, encoded = data.face_snapshot.split("base64,", 1)
            img_bytes = base64.b64decode(encoded)
            data_dir = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
            uploads_dir = data_dir / "uploads"
            uploads_dir.mkdir(parents=True, exist_ok=True)
            filename = f"verify_{uuid.uuid4().hex[:16]}.webp"
            file_dest = uploads_dir / filename
            with open(file_dest, "wb") as f:
                f.write(img_bytes)
            verification_photo_path = f"/uploads/{filename}"
        except Exception:
            verification_photo_path = ""

    conn = get_db()
    cursor = conn.cursor()

    # Verifica se já existe estudante com este e-mail
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (sanitized_email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado no Pontinho.")

    # Validação do código de 4 dígitos enviado ao e-mail institucional
    code_input = (data.verification_code or "").strip()
    is_dev = _is_dev_mode()

    if is_dev and (not code_input or code_input in ("0000", "TEST")):
        # Permite bypass em modo de desenvolvimento ou testes unitários
        pass
    else:
        if not code_input:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="O código de verificação de 4 dígitos enviado ao seu e-mail acadêmico é obrigatório para concluir o cadastro."
            )

        cursor.execute("""
            SELECT id, expires_at, used_at
            FROM email_verification_codes
            WHERE LOWER(email) = ? AND code = ?
            ORDER BY id DESC LIMIT 1
        """, (sanitized_email, code_input))
        code_row = cursor.fetchone()

        if not code_row or code_row["used_at"] is not None:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Código de verificação de 4 dígitos inválido ou já utilizado. Solicite um novo código."
            )

        cursor.execute("SELECT CASE WHEN datetime('now') > ? THEN 1 ELSE 0 END AS is_expired", (code_row["expires_at"],))
        exp_check = cursor.fetchone()
        if exp_check and exp_check["is_expired"] == 1:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Código de verificação expirado. Por favor, solicite um novo código de 4 dígitos."
            )

        # Invalida o código marcando-o como utilizado
        cursor.execute("UPDATE email_verification_codes SET used_at = datetime('now') WHERE id = ?", (code_row["id"],))

    internal_id = sanitized_email.split("@")[0]
    pw_hash = hash_password(cleaned_pw)

    # Fotos iniciais para a nova conta: apenas a selfie de verificação (se capturada na prova de vida)
    default_photos = [verification_photo_path] if verification_photo_path else []

    is_verified_val = 1 if (data.face_descriptor and len(data.face_descriptor) > 0) else 0
    face_desc_json = json.dumps(data.face_descriptor) if data.face_descriptor else ""

    cursor.execute("""
        INSERT INTO users (
            ra, password_hash, email, name, age, campus, course, specific_course,
            entity, looking_for, bio, interests, photos,
            prompt1_q, prompt1_a, prompt2_q, prompt2_a, prompt3_q, prompt3_a,
            gender, target_gender, terms_accepted_at,
            age_verified, verified_age, liveness_verified, verification_photo, age_verified_at,
            is_verified, verified_face_descriptor
        ) VALUES (?, ?, ?, ?, ?, 'Santo André', 'Ciência e Tecnologia', 'Ciência da Computação',
                  'Geral', 'Amizade', 'Olá, estou no Pontinho!', '["Música", "Tecnologia"]', ?,
                  'O melhor lugar para relaxar é...', 'Ouvindo música boa',
                  'Minha opinião impopular...', 'Conversa olho no olho supera qualquer mensagem',
                  'No intervalo você me encontra...', 'Tomando um café',
                  'Não informado', 'Todos', datetime('now'),
                  1, ?, 1, ?, datetime('now'),
                  ?, ?)
    """, (internal_id, pw_hash, sanitized_email, cleaned_name, verified_age_val, json.dumps(default_photos), verified_age_val, verification_photo_path, is_verified_val, face_desc_json))

    conn.commit()
    new_user_id = cursor.lastrowid
    conn.close()

    # Define a sessão criptograficamente assinada
    session_token = set_auth_session(response, new_user_id, request)

    return {
        "success": True,
        "user_id": new_user_id,
        "token": session_token,
        "name": cleaned_name,
        "email": sanitized_email,
        "is_verified": bool(is_verified_val),
        "message": "Cadastro realizado com sucesso!"
    }

# Proteção anti-brute force / Rate Limiting para login (máximo 5 tentativas por minuto por IP)
LOGIN_RATE_LIMIT_WINDOW = 60
MAX_LOGIN_ATTEMPTS = 5
_LOGIN_TRACKER = defaultdict(list)

def _check_login_rate_limit(client_ip: str):
    now = time.time()
    recent = [t for t in _LOGIN_TRACKER[client_ip] if now - t < LOGIN_RATE_LIMIT_WINDOW]
    if len(recent) >= MAX_LOGIN_ATTEMPTS:
        remaining = int(LOGIN_RATE_LIMIT_WINDOW - (now - recent[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Muitas tentativas de login consecutivas. Por segurança, aguarde {max(1, remaining)} segundos para tentar novamente."
        )
    recent.append(now)
    _LOGIN_TRACKER[client_ip] = recent

@router.post("/login")
def login_user(data: LoginRequest, request: Request, response: Response):
    """
    Login de estudante por E-mail Institucional e Senha.
    Protegido por rate limiting e resposta genérica anti-enumeração de usuários.
    """
    client_ip = request.client.host if request.client else "unknown"
    _check_login_rate_limit(client_ip)

    login_input = data.email.strip().lower()
    cleaned_pw = data.password.strip()

    conn = get_db()
    cursor = conn.cursor()

    # Aceita e-mail completo ou prefixo sem @aluno.ufabc.edu.br
    alt_email = f"{login_input}@aluno.ufabc.edu.br" if "@" not in login_input else login_input

    cursor.execute("""
        SELECT * FROM users
        WHERE LOWER(email) = ? OR LOWER(email) = ?
    """, (login_input, alt_email))
    user = cursor.fetchone()
    conn.close()

    GENERIC_LOGIN_ERROR = "E-mail institucional ou senha incorretos."

    if not user:
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    stored_hash = user["password_hash"]
    # Se o usuário não tiver senha cadastrada ainda (ex: seeds antigos), permite senha padrão '123456'
    if not stored_hash:
        valid = (cleaned_pw == "123456" or (user["is_admin"] and cleaned_pw == "admin123"))
    else:
        valid = verify_password(cleaned_pw, stored_hash)

    if not valid:
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    # Login bem-sucedido: limpa o histórico de tentativas do IP
    _LOGIN_TRACKER.pop(client_ip, None)

    # Migração automática transparente para Argon2id se o hash for legado (SHA-256)
    if needs_rehash(stored_hash):
        try:
            new_argon_hash = hash_password(cleaned_pw)
            rehash_conn = get_db()
            rehash_cursor = rehash_conn.cursor()
            rehash_cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_argon_hash, user["id"]))
            rehash_conn.commit()
            rehash_conn.close()
        except Exception as e:
            print(f"[Auth] Erro ao migrar hash para Argon2id: {e}")

    # Define a sessão criptograficamente assinada
    session_token = set_auth_session(response, user["id"], request)

    return {
        "success": True,
        "token": session_token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "is_admin": user["is_admin"],
            "is_verified": dict(user).get("is_verified", 0)
        }
    }

@router.post("/logout")
def logout_user(response: Response, request: Request = None):
    """Encerra a sessão removendo os cookies criptografados."""
    clear_auth_session(response, request)
    return {"success": True, "message": "Desconectado com sucesso."}

@router.get("/me")
def get_auth_me(request: Request):
    """Retorna os dados do usuário autenticado no momento."""
    try:
        user_id = get_current_user_id(request)
    except HTTPException:
        return {"authenticated": False, "user": None}

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, age, campus, course, specific_course, entity, looking_for, bio, photos, is_admin, is_verified FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"authenticated": False, "user": None}

    d = dict(row)
    d["photos"] = json.loads(d["photos"]) if d["photos"] else []
    return {"authenticated": True, "user": d}

def _is_dev_mode() -> bool:
    return os.getenv("DEV_MODE", "false").strip().lower() in ("true", "1", "yes") or \
           os.getenv("DEBUG", "false").strip().lower() in ("true", "1", "yes")

@router.get("/demo-accounts")
def get_demo_accounts():
    """
    Retorna contas de demonstração exclusivamente em ambiente de desenvolvimento (DEV_MODE=true).
    Oculta contas de administradores e nunca expõe senhas no payload.
    """
    if not _is_dev_mode():
        return []

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, age, specific_course, course, campus, photos
        FROM users
        WHERE is_admin = 0
        ORDER BY id ASC
        LIMIT 10
    """)
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["photos"] = json.loads(d["photos"]) if d["photos"] else []
        d["is_admin"] = 0
        result.append(d)
    return result


# Rate limiting para envio de código de 4 dígitos (1 envio a cada 60s por email e IP)
VERIFY_CODE_RATE_LIMIT_WINDOW = 60
_CODE_RATE_TRACKER = defaultdict(float)

@router.post("/send-verification-code")
def send_verification_code(data: SendVerificationCodeRequest, request: Request = None):
    """
    Gera e envia um código de segurança de 4 dígitos para o e-mail institucional do estudante.
    """
    sanitized_email = sanitize_and_validate_ufabc_email(data.email)
    client_ip = request.client.host if request and request.client else "unknown"
    rate_key = f"{sanitized_email}_{client_ip}"
    now = time.time()

    last_sent = _CODE_RATE_TRACKER.get(rate_key, 0)
    if now - last_sent < VERIFY_CODE_RATE_LIMIT_WINDOW:
        remaining = int(VERIFY_CODE_RATE_LIMIT_WINDOW - (now - last_sent))
        raise HTTPException(
            status_code=429,
            detail=f"Aguarde {remaining} segundos antes de solicitar um novo código."
        )

    conn = get_db()
    cursor = conn.cursor()

    # Verifica se já existe conta cadastrada com este e-mail
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (sanitized_email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Este e-mail institucional já possui uma conta no Pontinho. Tente fazer login ou recuperar sua senha."
        )

    # Gera código aleatório criptograficamente seguro de 4 dígitos (1000 a 9999)
    code = f"{secrets.randbelow(9000) + 1000}"

    cursor.execute("""
        INSERT INTO email_verification_codes (email, code, expires_at)
        VALUES (?, ?, datetime('now', '+15 minutes'))
    """, (sanitized_email, code))
    conn.commit()
    conn.close()

    _CODE_RATE_TRACKER[rate_key] = now

    # Envia o e-mail transacional via Resend
    try:
        send_verification_email(sanitized_email, code, data.name)
    except Exception as e:
        logger.error(f"Erro ao disparar e-mail de verificação para {sanitized_email}: {e}")
        if not _is_dev_mode():
            raise HTTPException(
                status_code=500,
                detail="Não foi possível enviar o e-mail de confirmação no momento. Tente novamente mais tarde."
            )

    return {
        "success": True,
        "message": "Código de verificação de 4 dígitos enviado com sucesso para o seu e-mail institucional!"
    }


@router.post("/verify-code")
def verify_code(data: VerifyCodeRequest):
    """
    Verifica se o código de 4 dígitos informado é válido e ainda não expirou.
    """
    sanitized_email = sanitize_and_validate_ufabc_email(data.email)
    code_input = data.code.strip()

    if _is_dev_mode() and code_input in ("0000", "TEST"):
        return {"success": True, "valid": True, "message": "Código validado com sucesso (modo de testes)."}

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, expires_at, used_at
        FROM email_verification_codes
        WHERE LOWER(email) = ? AND code = ?
        ORDER BY id DESC LIMIT 1
    """, (sanitized_email, code_input))
    row = cursor.fetchone()

    if not row or row["used_at"] is not None:
        conn.close()
        raise HTTPException(status_code=400, detail="Código de verificação inválido ou já utilizado.")

    cursor.execute("SELECT CASE WHEN datetime('now') > ? THEN 1 ELSE 0 END AS is_expired", (row["expires_at"],))
    exp_check = cursor.fetchone()
    conn.close()

    if exp_check and exp_check["is_expired"] == 1:
        raise HTTPException(status_code=400, detail="Código de verificação expirado. Solicite um novo código de 4 dígitos.")

    return {"success": True, "valid": True, "message": "Código validado com sucesso!"}


# Rate limiting para solicitação de recuperação de senha (anti-spam)
_FORGOT_PW_TRACKER = defaultdict(float)

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, request: Request = None):
    """
    Inicia o fluxo de recuperação de senha gerando um link seguro e enviando por e-mail.
    Retorna resposta genérica anti-enumeração de usuários conforme as boas práticas OWASP.
    """
    raw_email = data.email.strip().lower()
    if "@" not in raw_email:
        raw_email += "@aluno.ufabc.edu.br"

    GENERIC_SUCCESS_MSG = "Se este e-mail estiver cadastrado no Pontinho, enviamos um link de recuperação com validade de 1 hora."

    try:
        sanitized_email = sanitize_and_validate_ufabc_email(raw_email)
    except HTTPException:
        return {"success": True, "message": GENERIC_SUCCESS_MSG}

    client_ip = request.client.host if request and request.client else "unknown"
    rate_key = f"{sanitized_email}_{client_ip}"
    now = time.time()

    last_sent = _FORGOT_PW_TRACKER.get(rate_key, 0)
    if now - last_sent < 60:
        return {"success": True, "message": GENERIC_SUCCESS_MSG}
    _FORGOT_PW_TRACKER[rate_key] = now

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email FROM users WHERE LOWER(email) = ?", (sanitized_email,))
    user = cursor.fetchone()

    if user:
        token = secrets.token_urlsafe(32)
        cursor.execute("""
            INSERT INTO password_resets (user_id, email, token, expires_at)
            VALUES (?, ?, ?, datetime('now', '+1 hour'))
        """, (user["id"], sanitized_email, token))
        conn.commit()

        # Determina a URL base do frontend dinamicamente
        base_url = ""
        if request:
            origin = request.headers.get("origin") or request.headers.get("referer")
            if origin:
                from urllib.parse import urlparse
                parsed = urlparse(origin)
                base_url = f"{parsed.scheme}://{parsed.netloc}"
        if not base_url:
            base_url = os.getenv("FRONTEND_URL", "https://pontinho.julianvitor.com.br").rstrip("/")

        reset_link = f"{base_url}/login?tab=reset&token={token}"

        try:
            send_password_reset_email(sanitized_email, reset_link, user["name"])
        except Exception as e:
            logger.error(f"Erro ao enviar e-mail de recuperação para {sanitized_email}: {e}")

    conn.close()
    return {"success": True, "message": GENERIC_SUCCESS_MSG}


@router.get("/verify-reset-token")
def verify_reset_token(token: str):
    """
    Verifica se um token de recuperação de senha é válido e ainda não expirou.
    """
    clean_token = token.strip()
    if not clean_token:
        return {"valid": False, "message": "Token não fornecido."}

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, user_id, email, expires_at, used_at,
               CASE WHEN datetime('now') > expires_at THEN 1 ELSE 0 END AS is_expired
        FROM password_resets
        WHERE token = ?
        ORDER BY id DESC LIMIT 1
    """, (clean_token,))
    row = cursor.fetchone()
    conn.close()

    if not row or row["used_at"] is not None:
        return {"valid": False, "message": "Link de recuperação inválido ou já utilizado."}

    if row["is_expired"] == 1:
        return {"valid": False, "message": "Link de recuperação expirado (validade de 1 hora). Solicite um novo link."}

    return {"valid": True, "email": row["email"], "message": "Token válido."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    """
    Redefine a senha do usuário utilizando o token seguro recebido por e-mail.
    """
    clean_token = data.token.strip()
    clean_pw = data.new_password.strip()

    if len(clean_pw) < 8:
        raise HTTPException(status_code=400, detail="A nova senha deve ter no mínimo 8 caracteres.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, user_id, email, expires_at, used_at,
               CASE WHEN datetime('now') > expires_at THEN 1 ELSE 0 END AS is_expired
        FROM password_resets
        WHERE token = ?
        ORDER BY id DESC LIMIT 1
    """, (clean_token,))
    row = cursor.fetchone()

    if not row or row["used_at"] is not None:
        conn.close()
        raise HTTPException(status_code=400, detail="Link de recuperação inválido ou já utilizado.")

    if row["is_expired"] == 1:
        conn.close()
        raise HTTPException(status_code=400, detail="Link de recuperação expirado. Por favor, solicite um novo link.")

    new_hash = hash_password(clean_pw)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, row["user_id"]))
    cursor.execute("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?", (row["id"],))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Senha redefinida com sucesso! Você já pode entrar com sua nova senha."
    }

