"""
Rotas de autenticação (Login, Cadastro e Sessão) do Pontinho
"""
import json
from fastapi import APIRouter, HTTPException, Request, Response
from backend.database import get_db, hash_password, verify_password, needs_rehash
from backend.models import RegisterRequest, LoginRequest
from backend.auth import (
    get_current_user_id,
    sanitize_and_validate_ufabc_email,
    set_auth_session,
    clear_auth_session
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register")
def register_user(data: RegisterRequest, response: Response):
    """
    Cadastro de estudante com E-mail, Nome e Senha.
    """
    sanitized_email = sanitize_and_validate_ufabc_email(data.email)
    cleaned_name = data.name.strip()
    cleaned_pw = data.password.strip()
    cleaned_ra = (data.ra or "").strip()

    if not data.terms_accepted:
        raise HTTPException(
            status_code=400,
            detail="É obrigatório aceitar os Termos de Uso e a Política de Privacidade (LGPD) para se cadastrar."
        )

    if not cleaned_name or not cleaned_pw:
        raise HTTPException(status_code=400, detail="Nome e Senha são obrigatórios.")

    conn = get_db()
    cursor = conn.cursor()

    # Verifica se já existe estudante com este e-mail
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (sanitized_email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado no Pontinho.")

    # Se informou RA, verifica se não está duplicado
    if cleaned_ra:
        cursor.execute("SELECT id FROM users WHERE ra = ?", (cleaned_ra,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Este identificador já está cadastrado no Pontinho.")
    else:
        # Se não informou RA, usa o prefixo do e-mail
        cleaned_ra = sanitized_email.split("@")[0]

    pw_hash = hash_password(cleaned_pw)

    # Fotos padrão de avatar iniciais para satisfazer a regra de negócio de no mínimo 2 fotos
    default_photos = [
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
    ]

    cursor.execute("""
        INSERT INTO users (
            ra, password_hash, email, name, age, campus, course, specific_course,
            entity, looking_for, bio, interests, photos,
            prompt1_q, prompt1_a, prompt2_q, prompt2_a, prompt3_q, prompt3_a,
            gender, target_gender, terms_accepted_at
        ) VALUES (?, ?, ?, ?, 20, 'Santo André', 'Ciência e Tecnologia', 'Ciência da Computação',
                  'Geral', 'Amizade', 'Olá, estou no Pontinho!', '["Música", "Tecnologia"]', ?,
                  'O melhor lugar para relaxar é...', 'Ouvindo música boa',
                  'Minha opinião impopular...', 'Conversa olho no olho supera qualquer mensagem',
                  'No intervalo você me encontra...', 'Tomando um café',
                  'Não informado', 'Todos', datetime('now'))
    """, (cleaned_ra, pw_hash, sanitized_email, cleaned_name, json.dumps(default_photos)))

    conn.commit()
    new_user_id = cursor.lastrowid
    conn.close()

    # Define a sessão criptograficamente assinada
    session_token = set_auth_session(response, new_user_id)

    return {
        "success": True,
        "user_id": new_user_id,
        "token": session_token,
        "name": cleaned_name,
        "email": sanitized_email,
        "ra": cleaned_ra,
        "message": "Cadastro realizado com sucesso!"
    }

@router.post("/login")
def login_user(data: LoginRequest, response: Response):
    """
    Login de estudante por E-mail Acadêmico e Senha (ou RA).
    """
    login_input = data.email.strip().lower()
    cleaned_pw = data.password.strip()

    conn = get_db()
    cursor = conn.cursor()

    # Aceita e-mail completo, RA ou prefixo sem @aluno.ufabc.edu.br
    alt_email = f"{login_input}@aluno.ufabc.edu.br" if "@" not in login_input else login_input

    cursor.execute("""
        SELECT * FROM users
        WHERE LOWER(email) = ? OR LOWER(email) = ? OR ra = ?
    """, (login_input, alt_email, login_input))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="E-mail acadêmico não encontrado no sistema.")

    stored_hash = user["password_hash"]
    # Se o usuário não tiver senha cadastrada ainda (ex: seeds antigos), permite senha padrão '123456'
    if not stored_hash:
        valid = (cleaned_pw == "123456" or (user["is_admin"] and cleaned_pw == "admin123"))
    else:
        valid = verify_password(cleaned_pw, stored_hash)

    if not valid:
        raise HTTPException(status_code=401, detail="Senha incorreta.")

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
    session_token = set_auth_session(response, user["id"])

    return {
        "success": True,
        "token": session_token,
        "user": {
            "id": user["id"],
            "ra": user["ra"],
            "name": user["name"],
            "email": user["email"],
            "is_admin": user["is_admin"]
        }
    }

@router.post("/logout")
def logout_user(response: Response):
    """Encerra a sessão removendo os cookies criptografados."""
    clear_auth_session(response)
    return {"success": True, "message": "Desconectado com sucesso."}

@router.post("/switch-user/{target_user_id}")
def switch_user(target_user_id: int, request: Request, response: Response):
    """
    Alterna com segurança o usuário ativo autenticado, emitindo novo token HMAC assinado.
    Exige que o solicitante já possua uma sessão autenticada ativa.
    """
    get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, is_admin FROM users WHERE id = ?", (target_user_id,))
    target = cursor.fetchone()
    conn.close()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário alvo não encontrado.")

    token = set_auth_session(response, target["id"])
    return {
        "success": True,
        "token": token,
        "user_id": target["id"],
        "name": target["name"],
        "is_admin": bool(target["is_admin"])
    }

@router.get("/me")
def get_auth_me(request: Request):
    """Retorna os dados do usuário autenticado no momento."""
    try:
        user_id = get_current_user_id(request)
    except HTTPException:
        return {"authenticated": False, "user": None}

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ra, name, email, age, campus, course, specific_course, entity, looking_for, bio, photos, is_admin FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"authenticated": False, "user": None}

    d = dict(row)
    d["photos"] = json.loads(d["photos"]) if d["photos"] else []
    return {"authenticated": True, "user": d}

@router.get("/demo-accounts")
def get_demo_accounts():
    """
    Retorna as contas cadastradas no banco para geração dinâmica
    dos botões de acesso demo na interface (sem nada hardcoded no frontend).
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, age, specific_course, course, campus, photos, is_admin
        FROM users ORDER BY id ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["photos"] = json.loads(d["photos"]) if d["photos"] else []
        d["password"] = "admin123" if d["is_admin"] else "123456"
        result.append(d)
    return result

