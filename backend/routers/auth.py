"""
Rotas de autenticação (Login, Cadastro e Sessão) do Pontinho UFABC
"""
import json
from fastapi import APIRouter, HTTPException, Request, Response
from backend.database import get_db, hash_password, verify_password
from backend.models import RegisterRequest, LoginRequest
from backend.auth import get_current_user_id, sanitize_and_validate_ufabc_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register")
def register_user(data: RegisterRequest, response: Response):
    """
    Cadastro de estudante com E-mail Acadêmico UFABC, Nome e Senha.
    Sanitiza e restringe para e-mails institucionais (@aluno.ufabc.edu.br).
    """
    sanitized_email = sanitize_and_validate_ufabc_email(data.email)
    cleaned_name = data.name.strip()
    cleaned_pw = data.password.strip()
    cleaned_ra = (data.ra or "").strip()

    if not cleaned_name or not cleaned_pw:
        raise HTTPException(status_code=400, detail="Nome e Senha são obrigatórios.")

    conn = get_db()
    cursor = conn.cursor()

    # Verifica se já existe estudante com este e-mail
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (sanitized_email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Este e-mail acadêmico já está cadastrado no Pontinho UFABC.")

    # Se informou RA, verifica se não está duplicado
    if cleaned_ra:
        cursor.execute("SELECT id FROM users WHERE ra = ?", (cleaned_ra,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Este RA já está cadastrado no Pontinho UFABC.")
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
            gender, target_gender
        ) VALUES (?, ?, ?, ?, 20, 'Santo André', 'BC&T - Bacharelado em Ciência e Tecnologia', 'Ciência da Computação',
                  'Nenhuma / Foco no CR', 'Amizade', 'Estudante da UFABC!', '["UFABC"]', ?,
                  'O melhor lugar para descansar na UFABC é...', 'Biblioteca',
                  'Minha opinião impopular sobre o RU...', 'Gosto da comida',
                  'No intervalo entre as aulas você me encontra...', 'Bloco A',
                  'Não informado', 'Todos')
    """, (cleaned_ra, pw_hash, sanitized_email, cleaned_name, json.dumps(default_photos)))

    conn.commit()
    new_user_id = cursor.lastrowid
    conn.close()

    # Define o cookie de sessão para autenticação imediata
    response.set_cookie(
        key="pontinho_user_id",
        value=str(new_user_id),
        max_age=30 * 24 * 3600,
        path="/",
        httponly=False,
        samesite="lax"
    )

    return {
        "success": True,
        "user_id": new_user_id,
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

    response.set_cookie(
        key="pontinho_user_id",
        value=str(user["id"]),
        max_age=30 * 24 * 3600,
        path="/",
        httponly=False,
        samesite="lax"
    )

    return {
        "success": True,
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
    """Encerra a sessão removendo o cookie pontinho_user_id."""
    response.delete_cookie(key="pontinho_user_id", path="/")
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
    cursor.execute("SELECT id, ra, name, email, age, campus, course, specific_course, entity, looking_for, bio, photos, is_admin FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"authenticated": False, "user": None}

    d = dict(row)
    d["photos"] = json.loads(d["photos"]) if d["photos"] else []
    return {"authenticated": True, "user": d}
