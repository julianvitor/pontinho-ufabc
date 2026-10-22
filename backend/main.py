import json
import sqlite3
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from database import get_db, init_db, hash_password, verify_password
except ImportError:
    from backend.database import get_db, init_db, hash_password, verify_password

app = FastAPI(title="Pontinho UFABC API", version="1.0.0")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
FRONTEND_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# Inicializa o banco de dados caso não exista
init_db()

# --- MODELOS PYDANTIC ---

class RegisterRequest(BaseModel):
    email: str = Field(..., description="E-mail acadêmico da UFABC (@aluno.ufabc.edu.br)")
    name: str = Field(..., min_length=2, description="Nome completo")
    password: str = Field(..., min_length=4, description="Senha de acesso")
    ra: Optional[str] = Field(default="", description="RA (Registro Acadêmico) opcional")

class LoginRequest(BaseModel):
    email: str = Field(..., description="E-mail acadêmico da UFABC (ex: aluno@aluno.ufabc.edu.br)")
    password: str = Field(..., description="Senha do estudante")

class SwipeRequest(BaseModel):
    target_user_id: int
    action: str  # 'like' ou 'pass'

class MessageCreate(BaseModel):
    text: str

class UserCreateOrUpdate(BaseModel):
    email: Optional[str] = ""
    name: str
    age: int = 20
    campus: str  # 'Santo André' ou 'São Bernardo do Campo'
    course: str
    specific_course: str
    entity: str
    looking_for: str  # 'Algo sério', 'Algo casual', 'Amizade'
    bio: Optional[str] = ""
    interests: List[str] = Field(default_factory=list)
    photos: List[str] = Field(..., min_length=2, description="Pelo menos duas fotos obrigatórias")
    prompt1_q: Optional[str] = ""
    prompt1_a: Optional[str] = ""
    prompt2_q: Optional[str] = ""
    prompt2_a: Optional[str] = ""
    prompt3_q: Optional[str] = ""
    prompt3_a: Optional[str] = ""
    gender: Optional[str] = "Não informado"  # 'Mulher', 'Homem', 'Não-binário', 'Outro'
    target_gender: Optional[str] = "Todos"   # 'Mulheres', 'Homens', 'Não-binário', 'Todos'

class CourseCreate(BaseModel):
    name: str
    category: str  # 'base' ou 'especifico'

class EntityCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class PromptCreate(BaseModel):
    question: str

class AdCreateOrUpdate(BaseModel):
    title: str
    description: Optional[str] = ""
    image_url: str
    button_text: Optional[str] = "Conferir"
    link_url: str
    is_active: Optional[int] = 1
    frequency: Optional[int] = 4

# --- FUNÇÃO AUXILIAR DE IDENTIFICAÇÃO DO USUÁRIO ---

def get_current_user_id(request: Request) -> int:
    """
    Obtém o id do usuário atual a partir do cabeçalho 'X-User-Id'
    ou cookie 'pontinho_user_id'.
    """
    header_val = request.headers.get("x-user-id")
    if header_val and header_val.isdigit():
        return int(header_val)
    cookie_val = request.cookies.get("pontinho_user_id")
    if cookie_val and cookie_val.isdigit():
        return int(cookie_val)
    # Se não tiver cookie nem header, levanta 401 para exigir login
    raise HTTPException(status_code=401, detail="Você precisa estar autenticado com seu e-mail acadêmico.")

def sanitize_and_validate_ufabc_email(email_raw: str) -> str:
    """
    Sanitiza e valida e-mails acadêmicos da UFABC.
    Aceita exclusivamente domínios @aluno.ufabc.edu.br ou @ufabc.edu.br.
    Se o aluno digitar apenas seu login/nome de usuário (ex: 'mariana.silva'),
    adiciona automaticamente o domínio @aluno.ufabc.edu.br.
    """
    email = email_raw.strip().lower()
    if "@" not in email:
        email = f"{email}@aluno.ufabc.edu.br"

    valid_domains = ("@aluno.ufabc.edu.br", "@ufabc.edu.br")
    if not any(email.endswith(domain) for domain in valid_domains):
        raise HTTPException(
            status_code=400,
            detail="Apenas e-mails acadêmicos da UFABC (@aluno.ufabc.edu.br ou @ufabc.edu.br) são permitidos no cadastro."
        )

    username = email.split("@")[0].strip()
    if len(username) < 2:
        raise HTTPException(
            status_code=400,
            detail="Por favor, digite um e-mail acadêmico válido."
        )

    return email

# --- ROTAS DE AUTENTICAÇÃO (LOGIN & CADASTRO COM E-MAIL ACADÊMICO E SENHA) ---

@app.post("/api/auth/register")
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

@app.post("/api/auth/login")
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

@app.post("/api/auth/logout")
def logout_user(response: Response):
    """Encerra a sessão removendo o cookie pontinho_user_id."""
    response.delete_cookie(key="pontinho_user_id", path="/")
    return {"success": True, "message": "Desconectado com sucesso."}

@app.get("/api/auth/me")
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

# --- ROTAS DE PÁGINAS ESTÁTICAS HTML ---

@app.get("/", response_class=FileResponse)
def get_home_page():
    return FileResponse(FRONTEND_DIR / "index.html")

@app.get("/login.html", response_class=FileResponse)
def get_login_page():
    return FileResponse(FRONTEND_DIR / "login.html")

@app.get("/profile.html", response_class=FileResponse)
def get_profile_page():
    return FileResponse(FRONTEND_DIR / "profile.html")

@app.get("/matches.html", response_class=FileResponse)
def get_matches_page():
    return FileResponse(FRONTEND_DIR / "matches.html")

@app.get("/admin.html", response_class=FileResponse)
def get_admin_page():
    return FileResponse(FRONTEND_DIR / "admin.html")

# Compatibilidade retroativa para rotas legadas de CSS e JS
@app.get("/static/style.css", response_class=FileResponse)
def get_legacy_style():
    return FileResponse(FRONTEND_DIR / "css" / "style.css")

@app.get("/static/app.js", response_class=FileResponse)
def get_legacy_script():
    return FileResponse(FRONTEND_DIR / "js" / "app.js")

# --- ROTAS DE METADADOS (Cursos, Entidades, Perguntas) ---

@app.get("/api/metadata")
def get_metadata():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name FROM courses WHERE category = 'base' ORDER BY name")
    base_courses = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT id, name FROM courses WHERE category = 'especifico' ORDER BY name")
    specific_courses = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT id, name, description FROM entities ORDER BY name")
    entities = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT id, question FROM prompts ORDER BY id")
    prompts = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "base_courses": base_courses,
        "specific_courses": specific_courses,
        "entities": entities,
        "prompts": prompts,
        "campuses": ["Santo André", "São Bernardo do Campo"],
        "looking_for_options": ["Algo sério", "Algo casual", "Amizade"]
    }

# --- ROTAS DE FEED & SWIPE ---

@app.get("/api/feed")
def get_feed(request: Request):
    """
    Retorna os perfis disponíveis para swipe intercalados com cards de publicidade!
    Exclui o próprio usuário e perfis que já receberam swipe (like ou pass).
    """
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    # Buscar preferências do usuário atual
    cursor.execute("SELECT target_gender FROM users WHERE id = ?", (current_id,))
    curr_user = cursor.fetchone()
    target_gender = curr_user["target_gender"] if curr_user and curr_user["target_gender"] else "Todos"

    # Buscar anúncios ativos
    cursor.execute("SELECT * FROM ads WHERE is_active = 1 ORDER BY id DESC")
    ads = [dict(r) for r in cursor.fetchall()]

    # Filtrar por target_gender caso não seja 'Todos'
    gender_filter_sql = ""
    if target_gender == "Mulheres":
        gender_filter_sql = " AND (LOWER(gender) = 'mulher' OR LOWER(gender) = 'mulheres')"
    elif target_gender == "Homens":
        gender_filter_sql = " AND (LOWER(gender) = 'homem' OR LOWER(gender) = 'homens')"
    elif target_gender in ("Não-binário", "Nao-binario", "nao binario"):
        gender_filter_sql = " AND LOWER(gender) IN ('não-binário', 'nao-binario', 'não binário', 'nao binario')"

    # Buscar perfis ainda não avaliados respeitando o filtro de gênero
    cursor.execute(f"""
        SELECT * FROM users
        WHERE id != ? AND id NOT IN (
            SELECT to_user_id FROM swipes WHERE from_user_id = ?
        ) {gender_filter_sql}
        ORDER BY id ASC
    """, (current_id, current_id))

    rows = cursor.fetchall()
    conn.close()

    profiles = []
    for r in rows:
        d = dict(r)
        d["interests"] = json.loads(d["interests"]) if d["interests"] else []
        d["photos"] = json.loads(d["photos"]) if d["photos"] else []
        d["is_ad"] = False
        profiles.append(d)

    # Intercalar anúncios conforme a frequência definida
    feed_cards = []
    ad_index = 0
    card_counter = 0

    freq = 3
    if ads and ads[0].get("frequency"):
        freq = ads[0]["frequency"]

    for profile in profiles:
        feed_cards.append(profile)
        card_counter += 1
        if ads and (card_counter % freq == 0):
            ad_card = dict(ads[ad_index % len(ads)])
            ad_card["is_ad"] = True
            feed_cards.append(ad_card)
            ad_index += 1

    return {"cards": feed_cards, "total_profiles": len(profiles)}

@app.post("/api/swipe")
def post_swipe(swipe: SwipeRequest, request: Request):
    """Registra like ou pass e detecta match imediato."""
    current_id = get_current_user_id(request)
    target_id = swipe.target_user_id

    if current_id == target_id:
        raise HTTPException(status_code=400, detail="Não é possível dar swipe no próprio perfil.")

    conn = get_db()
    cursor = conn.cursor()

    # Salva ou atualiza o swipe
    cursor.execute("""
        INSERT INTO swipes (from_user_id, to_user_id, action)
        VALUES (?, ?, ?)
        ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET action = excluded.action
    """, (current_id, target_id, swipe.action))

    matched = False
    target_user_info = None

    if swipe.action == "like":
        # Verifica se o outro usuário também deu like
        cursor.execute("SELECT * FROM swipes WHERE from_user_id = ? AND to_user_id = ? AND action = 'like'", (target_id, current_id))
        reciprocal = cursor.fetchone()

        if reciprocal:
            matched = True
            # Cria registro na tabela matches se não existir
            u1, u2 = min(current_id, target_id), max(current_id, target_id)
            cursor.execute("""
                INSERT OR IGNORE INTO matches (user1_id, user2_id)
                VALUES (?, ?)
            """, (u1, u2))

            # Pega informações do perfil alvo
            cursor.execute("SELECT id, name, age, campus, course, specific_course, photos FROM users WHERE id = ?", (target_id,))
            target_row = cursor.fetchone()
            if target_row:
                target_user_info = dict(target_row)
                target_user_info["photos"] = json.loads(target_user_info["photos"]) if target_user_info["photos"] else []

    conn.commit()
    conn.close()

    return {
        "success": True,
        "action": swipe.action,
        "matched": matched,
        "match_user": target_user_info
    }

# --- ROTAS DE MATCHES & CHAT (TEXTO APENAS) ---

@app.get("/api/matches")
def get_user_matches(request: Request):
    """Retorna a lista de matches do usuário atual com a última mensagem trocada."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT m.id AS match_id, m.created_at AS match_date,
               CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END AS partner_id
        FROM matches m
        WHERE m.user1_id = ? OR m.user2_id = ?
        ORDER BY m.id DESC
    """, (current_id, current_id, current_id))

    matches_raw = cursor.fetchall()
    result = []

    for m in matches_raw:
        partner_id = m["partner_id"]
        cursor.execute("SELECT id, name, age, campus, course, specific_course, photos FROM users WHERE id = ?", (partner_id,))
        partner_row = cursor.fetchone()
        if not partner_row:
            continue

        partner_dict = dict(partner_row)
        partner_dict["photos"] = json.loads(partner_dict["photos"]) if partner_dict["photos"] else []

        # Pega a última mensagem
        cursor.execute("""
            SELECT text, sender_id, created_at
            FROM messages
            WHERE match_id = ?
            ORDER BY id DESC LIMIT 1
        """, (m["match_id"],))
        last_msg_row = cursor.fetchone()

        result.append({
            "match_id": m["match_id"],
            "match_date": m["match_date"],
            "partner": partner_dict,
            "last_message": dict(last_msg_row) if last_msg_row else None
        })

    conn.close()
    return result

@app.get("/api/matches/{match_id}/messages")
def get_match_messages(match_id: int, request: Request):
    """Busca o histórico de mensagens de texto de um match."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    # Verifica se o usuário pertence a este match
    cursor.execute("SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)", (match_id, current_id, current_id))
    match_row = cursor.fetchone()
    if not match_row:
        conn.close()
        raise HTTPException(status_code=403, detail="Acesso não autorizado a esta conversa.")

    partner_id = match_row["user2_id"] if match_row["user1_id"] == current_id else match_row["user1_id"]
    cursor.execute("SELECT id, name, photos FROM users WHERE id = ?", (partner_id,))
    partner_row = cursor.fetchone()
    partner_dict = dict(partner_row) if partner_row else {}
    if partner_dict:
        partner_dict["photos"] = json.loads(partner_dict["photos"]) if partner_dict.get("photos") else []

    cursor.execute("""
        SELECT id, match_id, sender_id, text, created_at
        FROM messages
        WHERE match_id = ?
        ORDER BY id ASC
    """, (match_id,))

    messages = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return {
        "match_id": match_id,
        "partner": partner_dict,
        "messages": messages,
        "current_user_id": current_id
    }

@app.post("/api/matches/{match_id}/messages")
def send_match_message(match_id: int, msg: MessageCreate, request: Request):
    """Envia uma mensagem de texto no chat."""
    current_id = get_current_user_id(request)
    cleaned_text = msg.text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail="A mensagem não pode ser vazia.")

    conn = get_db()
    cursor = conn.cursor()

    # Valida participação no match
    cursor.execute("SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)", (match_id, current_id, current_id))
    match_row = cursor.fetchone()
    if not match_row:
        conn.close()
        raise HTTPException(status_code=403, detail="Você não pertence a este match.")

    cursor.execute("""
        INSERT INTO messages (match_id, sender_id, text)
        VALUES (?, ?, ?)
    """, (match_id, current_id, cleaned_text))

    conn.commit()
    new_id = cursor.lastrowid

    cursor.execute("SELECT id, match_id, sender_id, text, created_at FROM messages WHERE id = ?", (new_id,))
    created_msg = dict(cursor.fetchone())
    conn.close()

    return created_msg

# --- ROTAS DE USUÁRIO / PERFIL ---

@app.get("/api/users/list")
def list_users_for_switch():
    """Lista usuários para facilitar a troca no cabeçalho durante testes."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ra, name, email, campus, course, photos, is_admin FROM users ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    users = []
    for r in rows:
        d = dict(r)
        d["photos"] = json.loads(d["photos"]) if d["photos"] else []
        users.append(d)
    return users

@app.get("/api/users/me")
def get_my_profile(request: Request):
    """Retorna o perfil do usuário atualmente conectado."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (current_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    d = dict(row)
    d["interests"] = json.loads(d["interests"]) if d["interests"] else []
    d["photos"] = json.loads(d["photos"]) if d["photos"] else []
    return d

@app.put("/api/users/me")
def update_my_profile(data: UserCreateOrUpdate, request: Request):
    """Atualiza o perfil próprio. Valida obrigatoriedade de ao menos 2 fotos."""
    current_id = get_current_user_id(request)
    if len(data.photos) < 2:
        raise HTTPException(status_code=400, detail="O perfil deve ter obrigatoriamente ao menos duas fotos.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users SET
            email = ?, name = ?, age = ?, campus = ?, course = ?, specific_course = ?,
            entity = ?, looking_for = ?, bio = ?, interests = ?, photos = ?,
            prompt1_q = ?, prompt1_a = ?, prompt2_q = ?, prompt2_a = ?,
            prompt3_q = ?, prompt3_a = ?,
            gender = ?, target_gender = ?
        WHERE id = ?
    """, (
        data.email, data.name, data.age, data.campus, data.course, data.specific_course,
        data.entity, data.looking_for, data.bio, json.dumps(data.interests), json.dumps(data.photos),
        data.prompt1_q, data.prompt1_a, data.prompt2_q, data.prompt2_a,
        data.prompt3_q, data.prompt3_a,
        data.gender or "Não informado", data.target_gender or "Todos",
        current_id
    ))

    conn.commit()
    conn.close()
    return {"success": True, "message": "Perfil atualizado com sucesso!"}

@app.post("/api/users")
def create_new_user(data: UserCreateOrUpdate):
    """Cria um novo usuário. Exige ao menos duas fotos."""
    if len(data.photos) < 2:
        raise HTTPException(status_code=400, detail="O perfil deve ter obrigatoriamente ao menos duas fotos.")

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO users (
                email, name, age, campus, course, specific_course,
                entity, looking_for, bio, interests, photos,
                prompt1_q, prompt1_a, prompt2_q, prompt2_a, prompt3_q, prompt3_a,
                gender, target_gender
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.email, data.name, data.age, data.campus, data.course, data.specific_course,
            data.entity, data.looking_for, data.bio, json.dumps(data.interests), json.dumps(data.photos),
            data.prompt1_q, data.prompt1_a, data.prompt2_q, data.prompt2_a, data.prompt3_q, data.prompt3_a,
            data.gender or "Não informado", data.target_gender or "Todos"
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"success": True, "user_id": new_id}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado.")

# --- ROTAS DO PAINEL ADMIN ---

@app.get("/api/admin/overview")
def get_admin_overview():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS count FROM users")
    total_users = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) AS count FROM matches")
    total_matches = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) AS count FROM messages")
    total_messages = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) AS count FROM ads")
    total_ads = cursor.fetchone()["count"]

    conn.close()
    return {
        "total_users": total_users,
        "total_matches": total_matches,
        "total_messages": total_messages,
        "total_ads": total_ads
    }

@app.get("/api/admin/users")
def get_admin_users():
    """Lista todos os usuários para o painel administrativo."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ra, name, email, age, campus, course, specific_course, entity, photos, is_admin, created_at FROM users ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["photos"] = json.loads(d["photos"]) if d["photos"] else []
        result.append(d)
    return result

@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int):
    """Apaga um usuário do sistema (com exclusão em cascata de matches e mensagens)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Usuário {user_id} excluído com sucesso."}

@app.get("/api/admin/courses")
def get_admin_courses():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses ORDER BY category, name")
    courses = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return courses

@app.post("/api/admin/courses")
def add_admin_course(course: CourseCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO courses (name, category) VALUES (?, ?)", (course.name.strip(), course.category.strip()))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"success": True, "id": new_id, "name": course.name}

@app.delete("/api/admin/courses/{course_id}")
def delete_admin_course(course_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM courses WHERE id = ?", (course_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/admin/entities")
def get_admin_entities():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM entities ORDER BY name")
    entities = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return entities

@app.post("/api/admin/entities")
def add_admin_entity(entity: EntityCreate):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO entities (name, description) VALUES (?, ?)", (entity.name.strip(), entity.description.strip()))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"success": True, "id": new_id}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Esta entidade já existe.")

@app.delete("/api/admin/entities/{entity_id}")
def delete_admin_entity(entity_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM entities WHERE id = ?", (entity_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/admin/prompts")
def get_admin_prompts():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prompts ORDER BY id ASC")
    prompts = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return prompts

@app.post("/api/admin/prompts")
def add_admin_prompt(prompt: PromptCreate):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO prompts (question) VALUES (?)", (prompt.question.strip(),))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"success": True, "id": new_id}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Esta pergunta já existe.")

@app.delete("/api/admin/prompts/{prompt_id}")
def delete_admin_prompt(prompt_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/admin/ads")
def get_admin_ads():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ads ORDER BY id DESC")
    ads = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return ads

@app.post("/api/admin/ads")
def add_admin_ad(ad: AdCreateOrUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO ads (title, description, image_url, button_text, link_url, is_active, frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (ad.title.strip(), ad.description.strip(), ad.image_url.strip(), ad.button_text.strip(), ad.link_url.strip(), ad.is_active, ad.frequency or 4))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"success": True, "id": new_id}

@app.put("/api/admin/ads/{ad_id}")
def update_admin_ad(ad_id: int, ad: AdCreateOrUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE ads SET
            title = ?, description = ?, image_url = ?, button_text = ?,
            link_url = ?, is_active = ?, frequency = ?
        WHERE id = ?
    """, (ad.title.strip(), ad.description.strip(), ad.image_url.strip(), ad.button_text.strip(), ad.link_url.strip(), ad.is_active, ad.frequency or 4, ad_id))
    conn.commit()
    conn.close()
    return {"success": True}

@app.delete("/api/admin/ads/{ad_id}")
def delete_admin_ad(ad_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ads WHERE id = ?", (ad_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.post("/api/admin/reset-swipes")
def reset_swipes(request: Request):
    """Auxiliar para testes: reseta os swipes do usuário logado para que ele possa rever todos os cards."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM swipes WHERE from_user_id = ?", (current_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Histórico de swipes resetado! Agora você pode ver todos os perfis novamente."}
