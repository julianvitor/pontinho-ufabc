"""
Rotas de Gerenciamento de Usuário e Perfil do Pontinho UFABC
"""
import json
import sqlite3
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import UserCreateOrUpdate
from backend.auth import get_current_user_id

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/list")
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

@router.get("/me")
def get_my_profile(request: Request):
    """Retorna o perfil completo do usuário atualmente conectado."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (current_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    d = dict(row)
    d["interests"] = json.loads(d["interests"]) if d.get("interests") else []
    d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
    d["songs"] = json.loads(d["songs"]) if d.get("songs") else []
    d["private_photos"] = json.loads(d["private_photos"]) if d.get("private_photos") else []
    d["private_bio"] = d.get("private_bio") or ""
    return d

@router.put("/me")
def update_my_profile(data: UserCreateOrUpdate, request: Request):
    """Atualiza o perfil próprio. Valida obrigatoriedade de ao menos 2 fotos públicas."""
    current_id = get_current_user_id(request)
    if len(data.photos) < 2:
        raise HTTPException(status_code=400, detail="O perfil deve ter obrigatoriamente ao menos duas fotos públicas.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users SET
            email = ?, name = ?, age = ?, campus = ?, course = ?, specific_course = ?,
            entity = ?, looking_for = ?, bio = ?, interests = ?, photos = ?,
            prompt1_q = ?, prompt1_a = ?, prompt2_q = ?, prompt2_a = ?,
            prompt3_q = ?, prompt3_a = ?,
            gender = ?, target_gender = ?, songs = ?,
            private_photos = ?, private_bio = ?
        WHERE id = ?
    """, (
        data.email, data.name, data.age, data.campus, data.course, data.specific_course,
        data.entity, data.looking_for, data.bio, json.dumps(data.interests), json.dumps(data.photos),
        data.prompt1_q, data.prompt1_a, data.prompt2_q, data.prompt2_a,
        data.prompt3_q, data.prompt3_a,
        data.gender or "Não informado", data.target_gender or "Todos",
        json.dumps(data.songs or []),
        json.dumps(data.private_photos or []),
        data.private_bio or "",
        current_id
    ))

    conn.commit()
    conn.close()
    return {"success": True, "message": "Perfil atualizado com sucesso!"}

@router.post("")
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
                gender, target_gender, songs, private_photos, private_bio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.email, data.name, data.age, data.campus, data.course, data.specific_course,
            data.entity, data.looking_for, data.bio, json.dumps(data.interests), json.dumps(data.photos),
            data.prompt1_q, data.prompt1_a, data.prompt2_q, data.prompt2_a, data.prompt3_q, data.prompt3_a,
            data.gender or "Não informado", data.target_gender or "Todos",
            json.dumps(data.songs or []),
            json.dumps(data.private_photos or []),
            data.private_bio or ""
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"success": True, "user_id": new_id}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado.")
