"""
Rotas de Matches e Chat em Tempo Real do Pontinho UFABC
"""
import json
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import MessageCreate
from backend.auth import get_current_user_id

router = APIRouter(prefix="/api", tags=["matches"])

@router.get("/matches")
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

@router.get("/matches/{match_id}/messages")
@router.get("/messages/{match_id}")
def get_match_messages(match_id: int, request: Request):
    """Busca o histórico de mensagens de texto de um match."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

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

@router.post("/matches/{match_id}/messages")
@router.post("/messages/{match_id}")
def send_match_message(match_id: int, msg: MessageCreate, request: Request):
    """Envia uma mensagem de texto no chat."""
    current_id = get_current_user_id(request)
    cleaned_text = msg.text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail="A mensagem não pode ser vazia.")

    conn = get_db()
    cursor = conn.cursor()

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
