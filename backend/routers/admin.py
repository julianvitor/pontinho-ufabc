"""
Rotas Administrativas e Metadados do Pontinho UFABC
"""
import json
import sqlite3
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import CourseCreate, EntityCreate, PromptCreate, AdCreateOrUpdate
from backend.auth import get_current_user_id

router = APIRouter(tags=["admin"])

# --- ROTAS DE METADADOS (Cursos, Entidades, Perguntas) ---

@router.get("/api/metadata")
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

# --- ROTAS DO PAINEL ADMIN ---

@router.get("/api/admin/overview")
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

@router.get("/api/admin/users")
def get_admin_users():
    """Lista todos os usuários para o painel administrativo."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ra, name, email, age, campus, course, specific_course, entity, photos, songs, is_admin, created_at FROM users ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
        d["songs"] = json.loads(d["songs"]) if d.get("songs") else []
        result.append(d)
    return result

@router.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int):
    """Apaga um usuário do sistema (com exclusão em cascata de matches e mensagens)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Usuário {user_id} excluído com sucesso."}

@router.get("/api/admin/courses")
def get_admin_courses():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses ORDER BY category, name")
    courses = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return courses

@router.post("/api/admin/courses")
def add_admin_course(course: CourseCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO courses (name, category) VALUES (?, ?)", (course.name.strip(), course.category.strip()))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"success": True, "id": new_id, "name": course.name}

@router.delete("/api/admin/courses/{course_id}")
def delete_admin_course(course_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM courses WHERE id = ?", (course_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/api/admin/entities")
def get_admin_entities():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM entities ORDER BY name")
    entities = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return entities

@router.post("/api/admin/entities")
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

@router.delete("/api/admin/entities/{entity_id}")
def delete_admin_entity(entity_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM entities WHERE id = ?", (entity_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/api/admin/prompts")
def get_admin_prompts():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prompts ORDER BY id ASC")
    prompts = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return prompts

@router.post("/api/admin/prompts")
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

@router.delete("/api/admin/prompts/{prompt_id}")
def delete_admin_prompt(prompt_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/api/admin/ads")
def get_admin_ads():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ads ORDER BY id DESC")
    ads = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return ads

@router.post("/api/admin/ads")
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

@router.put("/api/admin/ads/{ad_id}")
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

@router.delete("/api/admin/ads/{ad_id}")
def delete_admin_ad(ad_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ads WHERE id = ?", (ad_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.post("/api/admin/reset-swipes")
def reset_swipes(request: Request):
    """Auxiliar para testes: reseta os swipes do usuário logado para que ele possa rever todos os cards."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM swipes WHERE from_user_id = ?", (current_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Histórico de swipes resetado! Agora você pode ver todos os perfis novamente."}
