"""
Rotas de Festas e Eventos Universitários do Pontinho
"""
import json
import sqlite3
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import EventCreateOrUpdate, EventRsvpRequest
from backend.auth import get_current_user_id, require_admin

router = APIRouter(tags=["events"])

@router.get("/api/events")
def list_events(request: Request):
    """
    Retorna a lista de todas as festas e eventos ordenados por data.
    Inclui contador de confirmados, status de presença do usuário logado e amostra de participantes.
    """
    user_id = None
    try:
        user_id = get_current_user_id(request)
    except Exception:
        user_id = None
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT e.id, e.title, e.description, e.event_date, e.location, e.image_url, e.ticket_url, e.created_by, e.created_at,
               (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going') AS attendees_count
        FROM events e
        ORDER BY e.event_date ASC
    """)
    rows = cursor.fetchall()
    events = []

    for r in rows:
        evt = dict(r)
        event_id = evt["id"]

        # Verifica se o usuário atual já confirmou presença
        is_attending = False
        if user_id:
            cursor.execute("""
                SELECT 1 FROM event_attendees 
                WHERE event_id = ? AND user_id = ? AND status = 'going'
            """, (event_id, user_id))
            is_attending = cursor.fetchone() is not None
        evt["is_attending"] = is_attending

        # Amostra de participantes (até 6): EXIBIDA APENAS PARA USUÁRIOS LOGADOS
        sample = []
        if user_id:
            cursor.execute("""
                SELECT u.id, u.name, u.photos, u.course, u.specific_course, u.campus
                FROM event_attendees ea
                JOIN users u ON u.id = ea.user_id
                WHERE ea.event_id = ? AND ea.status = 'going'
                ORDER BY ea.created_at DESC
                LIMIT 6
            """, (event_id,))
            sample_rows = cursor.fetchall()
            for s in sample_rows:
                photos = []
                try:
                    photos = json.loads(s["photos"]) if s["photos"] else []
                except Exception:
                    photos = []
                sample.append({
                    "id": s["id"],
                    "name": s["name"],
                    "avatar": photos[0] if photos else None,
                    "course": s["specific_course"] or s["course"]
                })
        evt["attendees_sample"] = sample
        evt["attendees_locked"] = not bool(user_id)
        events.append(evt)

    conn.close()
    return events


@router.get("/api/events/{event_id}")
def get_event_details(event_id: int, request: Request):
    """
    Retorna detalhes completos de uma festa.
    A lista de estudantes confirmados é exibida EXCLUSIVAMENTE para usuários autenticados.
    """
    user_id = None
    try:
        user_id = get_current_user_id(request)
    except Exception:
        user_id = None
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT e.id, e.title, e.description, e.event_date, e.location, e.image_url, e.ticket_url, e.created_by, e.created_at,
               (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id AND ea.status = 'going') AS attendees_count
        FROM events e
        WHERE e.id = ?
    """, (event_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Festa ou evento não encontrado.")

    evt = dict(row)

    # Verifica se o usuário logado está confirmado
    is_attending = False
    if user_id:
        cursor.execute("""
            SELECT 1 FROM event_attendees 
            WHERE event_id = ? AND user_id = ? AND status = 'going'
        """, (event_id, user_id))
        is_attending = cursor.fetchone() is not None
    evt["is_attending"] = is_attending

    # Lista completa de participantes confirmados: APENAS PARA USUÁRIOS LOGADOS
    attendees = []
    if user_id:
        cursor.execute("""
            SELECT u.id, u.name, u.age, u.course, u.specific_course, u.campus, u.photos, u.bio, u.gender
            FROM event_attendees ea
            JOIN users u ON u.id = ea.user_id
            WHERE ea.event_id = ? AND ea.status = 'going'
            ORDER BY ea.created_at ASC
        """, (event_id,))
        attendees_rows = cursor.fetchall()
        for a in attendees_rows:
            photos = []
            try:
                photos = json.loads(a["photos"]) if a["photos"] else []
            except Exception:
                photos = []
            attendees.append({
                "id": a["id"],
                "name": a["name"],
                "age": a["age"],
                "campus": a["campus"],
                "course": a["specific_course"] or a["course"],
                "avatar": photos[0] if photos else None,
                "photos": photos,
                "bio": a["bio"],
                "gender": a["gender"]
            })
    evt["attendees"] = attendees
    evt["attendees_locked"] = not bool(user_id)
    if not user_id:
        evt["attendees_message"] = "Faça login com seu e-mail institucional para ver os estudantes confirmados nesta festa."

    conn.close()
    return evt


@router.post("/api/events/{event_id}/rsvp")
def toggle_event_rsvp(event_id: int, request: Request, payload: Optional[EventRsvpRequest] = None):
    """
    Alterna ou define a presença do estudante na festa especificada.
    """
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Faça login para marcar presença nos eventos.")

    conn = get_db()
    cursor = conn.cursor()

    # Verifica se o evento existe
    cursor.execute("SELECT id FROM events WHERE id = ?", (event_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Evento não encontrado.")

    # Verifica se já está confirmado
    cursor.execute("""
        SELECT id, status FROM event_attendees 
        WHERE event_id = ? AND user_id = ?
    """, (event_id, user_id))
    existing = cursor.fetchone()

    desired_status = payload.status if payload and payload.status else None

    is_now_attending = False
    if existing:
        if desired_status == "going":
            # Já está going
            is_now_attending = True
        elif desired_status == "not_going":
            cursor.execute("DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?", (event_id, user_id))
            is_now_attending = False
        else:
            # Modo toggle: se já existia, desmarca
            cursor.execute("DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?", (event_id, user_id))
            is_now_attending = False
    else:
        if desired_status == "not_going":
            is_now_attending = False
        else:
            # Marca presença
            cursor.execute("""
                INSERT INTO event_attendees (event_id, user_id, status)
                VALUES (?, ?, 'going')
            """, (event_id, user_id))
            is_now_attending = True

    conn.commit()

    # Retorna o total atualizado
    cursor.execute("SELECT COUNT(*) AS total FROM event_attendees WHERE event_id = ? AND status = 'going'", (event_id,))
    total_attendees = cursor.fetchone()["total"]
    conn.close()

    return {
        "success": True,
        "is_attending": is_now_attending,
        "attendees_count": total_attendees,
        "message": "Presença confirmada! Nos vemos lá! 🎉" if is_now_attending else "Presença desmarcada."
    }


# --- ROTAS DE GERENCIAMENTO (EXCLUSIVAS DE ADMIN) ---

@router.post("/api/events")
def create_event(payload: EventCreateOrUpdate, request: Request):
    """
    Cria uma nova festa/evento no sistema (apenas Admin).
    """
    require_admin(request)
    admin_id = get_current_user_id(request)

    title = payload.title.strip()
    if len(title) > 25:
        raise HTTPException(status_code=400, detail="O nome da festa deve ter no máximo 25 caracteres.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO events (title, description, event_date, location, image_url, ticket_url, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        title,
        payload.description.strip() if payload.description else "",
        payload.event_date.strip(),
        payload.location.strip(),
        payload.image_url.strip() if payload.image_url else "",
        payload.ticket_url.strip() if payload.ticket_url else "",
        admin_id
    ))
    event_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "success": True,
        "id": event_id,
        "message": f"Festa '{payload.title}' cadastrada com sucesso!"
    }


@router.put("/api/events/{event_id}")
def update_event(event_id: int, payload: EventCreateOrUpdate, request: Request):
    """
    Atualiza dados de uma festa/evento existente (apenas Admin).
    """
    require_admin(request)
    title = payload.title.strip()
    if len(title) > 25:
        raise HTTPException(status_code=400, detail="O nome da festa deve ter no máximo 25 caracteres.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM events WHERE id = ?", (event_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Evento não encontrado.")

    cursor.execute("""
        UPDATE events
        SET title = ?, description = ?, event_date = ?, location = ?, image_url = ?, ticket_url = ?
        WHERE id = ?
    """, (
        title,
        payload.description.strip() if payload.description else "",
        payload.event_date.strip(),
        payload.location.strip(),
        payload.image_url.strip() if payload.image_url else "",
        payload.ticket_url.strip() if payload.ticket_url else "",
        event_id
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "id": event_id,
        "message": "Festa atualizada com sucesso!"
    }


@router.delete("/api/events/{event_id}")
def delete_event(event_id: int, request: Request):
    """
    Exclui uma festa/evento do sistema (apenas Admin).
    """
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, title FROM events WHERE id = ?", (event_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Evento não encontrado.")

    title = row["title"]
    cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Festa '{title}' removida com sucesso!"
    }
