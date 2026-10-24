"""
Rotas Administrativas e Metadados do Pontinho
"""
import json
import sqlite3
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import CourseCreate, EntityCreate, PromptCreate, AdCreateOrUpdate
from backend.auth import get_current_user_id, require_admin

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

# --- ROTAS DO PAINEL ADMIN (PROTEGIDAS - EXIGE IS_ADMIN) ---

@router.get("/api/admin/overview")
def get_admin_overview(request: Request):
    require_admin(request)
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

    cursor.execute("SELECT COUNT(*) AS count FROM reports WHERE status = 'pending'")
    pending_reports = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) AS count FROM events")
    total_events = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) AS count FROM event_attendees WHERE status = 'going'")
    total_event_rsvps = cursor.fetchone()["count"]

    conn.close()
    return {
        "total_users": total_users,
        "total_matches": total_matches,
        "total_messages": total_messages,
        "total_ads": total_ads,
        "pending_reports": pending_reports,
        "total_events": total_events,
        "total_event_rsvps": total_event_rsvps
    }

@router.get("/api/admin/reports")
def get_admin_reports(request: Request):
    """
    Retorna a lista de denúncias detalhadas e um resumo agrupado por usuário denunciado,
    incluindo quem denunciou, os motivos, detalhes e a contagem total de denúncias.
    """
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()

    # 1. Denúncias individuais detalhadas
    cursor.execute("""
        SELECT
            r.id, r.reporter_id, r.reported_id, r.reason, r.details, r.status, r.created_at,
            u_rep.name AS reporter_name, u_rep.email AS reporter_email,
            u_tar.name AS reported_name, u_tar.email AS reported_email,
            u_tar.photos AS reported_photos
        FROM reports r
        JOIN users u_rep ON u_rep.id = r.reporter_id
        JOIN users u_tar ON u_tar.id = r.reported_id
        ORDER BY r.id DESC
    """)
    raw_reports = cursor.fetchall()
    reports_list = []
    for row in raw_reports:
        d = dict(row)
        photos = json.loads(d["reported_photos"]) if d.get("reported_photos") else []
        d["reported_photo"] = photos[0] if photos else ""
        d.pop("reported_photos", None)
        reports_list.append(d)

    # 2. Resumo consolidado por usuário denunciado
    cursor.execute("""
        SELECT
            r.reported_id AS user_id,
            u.name AS user_name,
            u.email AS user_email,
            u.photos AS user_photos,
            COUNT(r.id) AS total_reports,
            MAX(r.created_at) AS last_report_date
        FROM reports r
        JOIN users u ON u.id = r.reported_id
        GROUP BY r.reported_id
        ORDER BY total_reports DESC, last_report_date DESC
    """)
    raw_summary = cursor.fetchall()
    summary_list = []
    for row in raw_summary:
        d = dict(row)
        photos = json.loads(d["user_photos"]) if d.get("user_photos") else []
        d["user_photo"] = photos[0] if photos else ""
        d.pop("user_photos", None)

        # Buscar detalhes dos denunciantes deste usuário
        cursor.execute("""
            SELECT r.id, r.reporter_id, u_rep.name AS reporter_name, u_rep.email AS reporter_email, r.reason, r.details, r.created_at, r.status
            FROM reports r
            JOIN users u_rep ON u_rep.id = r.reporter_id
            WHERE r.reported_id = ?
            ORDER BY r.id DESC
        """, (d["user_id"],))
        d["complaints"] = [dict(c) for c in cursor.fetchall()]
        summary_list.append(d)

    conn.close()
    return {
        "reports": reports_list,
        "summary": summary_list,
        "total_pending": len([r for r in reports_list if r["status"] == "pending"])
    }

@router.delete("/api/admin/reports/{report_id}")
def delete_report(report_id: int, request: Request):
    """Exclui ou descarta uma denúncia específica."""
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Denúncia descartada com sucesso."}

@router.put("/api/admin/reports/{report_id}/status")
def update_report_status(report_id: int, status_data: dict, request: Request):
    """Atualiza o status de uma denúncia ('resolved' ou 'dismissed')."""
    require_admin(request)
    new_status = status_data.get("status", "resolved")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE reports SET status = ? WHERE id = ?", (new_status, report_id))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Status atualizado para {new_status}."}

@router.get("/api/admin/users")
def get_admin_users(request: Request):
    """Lista todos os usuários para o painel administrativo."""
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, age, campus, course, specific_course, entity, photos, songs, is_admin, created_at FROM users ORDER BY id DESC")
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
def delete_user(user_id: int, request: Request):
    """Apaga um usuário do sistema (com exclusão em cascata de matches e mensagens)."""
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Usuário {user_id} excluído com sucesso."}

@router.patch("/api/admin/users/{user_id}/toggle-admin")
def toggle_user_admin(user_id: int, request: Request):
    """Promove ou remove privilégios de administrador de um usuário."""
    current_admin = require_admin(request)
    if current_admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Você não pode revogar seus próprios privilégios de administrador.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, is_admin FROM users WHERE id = ?", (user_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    new_status = 0 if target["is_admin"] else 1
    cursor.execute("UPDATE users SET is_admin = ? WHERE id = ?", (new_status, user_id))
    conn.commit()
    conn.close()

    status_str = "promovido a Administrador" if new_status == 1 else "rebaixado a Usuário Comum"
    return {
        "success": True,
        "user_id": user_id,
        "is_admin": new_status,
        "message": f"Usuário {target['name']} ({target['email']}) foi {status_str} com sucesso."
    }

@router.get("/api/admin/courses")
def get_admin_courses(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses ORDER BY category, name")
    courses = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return courses

@router.post("/api/admin/courses")
def add_admin_course(course: CourseCreate, request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO courses (name, category) VALUES (?, ?)", (course.name.strip(), course.category.strip()))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"success": True, "id": new_id, "name": course.name}

@router.delete("/api/admin/courses/{course_id}")
def delete_admin_course(course_id: int, request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM courses WHERE id = ?", (course_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/api/admin/entities")
def get_admin_entities(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM entities ORDER BY name")
    entities = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return entities

@router.post("/api/admin/entities")
def add_admin_entity(entity: EntityCreate, request: Request):
    require_admin(request)
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
def delete_admin_entity(entity_id: int, request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM entities WHERE id = ?", (entity_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/api/admin/prompts")
def get_admin_prompts(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prompts ORDER BY id ASC")
    prompts = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return prompts

@router.post("/api/admin/prompts")
def add_admin_prompt(prompt: PromptCreate, request: Request):
    require_admin(request)
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
def delete_admin_prompt(prompt_id: int, request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/api/admin/ads")
def get_admin_ads(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ads ORDER BY id DESC")
    ads = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return ads

@router.post("/api/admin/ads")
def add_admin_ad(ad: AdCreateOrUpdate, request: Request):
    require_admin(request)
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
def update_admin_ad(ad_id: int, ad: AdCreateOrUpdate, request: Request):
    require_admin(request)
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
def delete_admin_ad(ad_id: int, request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ads WHERE id = ?", (ad_id,))
    conn.commit()
    conn.close()
    return {"success": True}
