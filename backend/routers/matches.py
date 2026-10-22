"""
Rotas de Matches e Chat em Tempo Real do Pontinho UFABC
"""
import json
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import MessageCreate, PrivateAccessAction
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
            SELECT text, sender_id, read_at, created_at
            FROM messages
            WHERE match_id = ?
            ORDER BY id DESC LIMIT 1
        """, (m["match_id"],))
        last_msg_row = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS unread_count
            FROM messages
            WHERE match_id = ? AND sender_id != ? AND read_at IS NULL
        """, (m["match_id"], current_id))
        unread_row = cursor.fetchone()
        unread_count = unread_row["unread_count"] if unread_row else 0

        result.append({
            "match_id": m["match_id"],
            "match_date": m["match_date"],
            "partner": partner_dict,
            "last_message": dict(last_msg_row) if last_msg_row else None,
            "unread_count": unread_count,
            "is_new": last_msg_row is None
        })

    conn.close()
    return result

@router.get("/matches/unread-count")
def get_unread_count(request: Request):
    """Retorna o número de mensagens não lidas e novos matches para badges visuais na UI."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    # Contagem de mensagens não lidas recebidas
    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM messages msg
        JOIN matches m ON m.id = msg.match_id
        WHERE (m.user1_id = ? OR m.user2_id = ?)
          AND msg.sender_id != ?
          AND msg.read_at IS NULL
    """, (current_id, current_id, current_id))
    row_msgs = cursor.fetchone()
    unread_messages = row_msgs["count"] if row_msgs else 0

    # Novos matches onde ainda não houve mensagem trocada
    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM matches m
        WHERE (m.user1_id = ? OR m.user2_id = ?)
          AND NOT EXISTS (
              SELECT 1 FROM messages msg WHERE msg.match_id = m.id
          )
    """, (current_id, current_id))
    row_matches = cursor.fetchone()
    unread_matches = row_matches["count"] if row_matches else 0

    conn.close()
    return {
        "unread_messages": unread_messages,
        "unread_matches": unread_matches,
        "total": unread_messages + unread_matches
    }

@router.delete("/matches/{match_id}")
def unmatch(match_id: int, request: Request):
    """Desfaz o match permanentemente, removendo o histórico de conversa."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)", (match_id, current_id, current_id))
    match_row = cursor.fetchone()
    if not match_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Match não encontrado ou você não pertence a ele.")

    cursor.execute("DELETE FROM matches WHERE id = ?", (match_id,))
    conn.commit()
    conn.close()

    return {"success": True, "message": "Match desfeito com sucesso."}

@router.get("/matches/{match_id}/messages")
@router.get("/messages/{match_id}")
def get_match_messages(match_id: int, request: Request):
    """Busca o histórico de mensagens de texto de um match e marca as pendentes como lidas."""
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

    # Marca as mensagens recebidas como lidas
    cursor.execute("""
        UPDATE messages
        SET read_at = CURRENT_TIMESTAMP
        WHERE match_id = ? AND sender_id != ? AND read_at IS NULL
    """, (match_id, current_id))
    conn.commit()

    cursor.execute("""
        SELECT id, match_id, sender_id, text, read_at, created_at
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


@router.get("/matches/{match_id}/private-status")
def get_private_access_status(match_id: int, request: Request):
    """Retorna o status de autorização das fotos e bio privadas entre os membros do match."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)", (match_id, current_id, current_id))
    match_row = cursor.fetchone()
    if not match_row:
        conn.close()
        raise HTTPException(status_code=403, detail="Acesso não autorizado a este match.")

    partner_id = match_row["user2_id"] if match_row["user1_id"] == current_id else match_row["user1_id"]

    cursor.execute("SELECT id, name, private_photos, private_bio FROM users WHERE id = ?", (partner_id,))
    partner_row = cursor.fetchone()
    partner_priv_photos = json.loads(partner_row["private_photos"]) if partner_row and partner_row["private_photos"] else []
    partner_priv_bio = partner_row["private_bio"] if partner_row and partner_row["private_bio"] else ""
    partner_has_private = bool(partner_priv_photos or partner_priv_bio)

    # Verifica solicitação feita por mim para o parceiro
    cursor.execute("""
        SELECT status FROM private_access_requests
        WHERE match_id = ? AND requester_id = ? AND target_id = ?
    """, (match_id, current_id, partner_id))
    req_by_me = cursor.fetchone()
    my_request_status = req_by_me["status"] if req_by_me else "none"

    # Verifica solicitação feita pelo parceiro para mim
    cursor.execute("""
        SELECT status FROM private_access_requests
        WHERE match_id = ? AND requester_id = ? AND target_id = ?
    """, (match_id, partner_id, current_id))
    req_by_them = cursor.fetchone()
    their_request_status = req_by_them["status"] if req_by_them else "none"

    # Se aprovado, entrega o conteúdo privado do parceiro
    unlocked_content = None
    if my_request_status == "approved" and partner_has_private:
        unlocked_content = {
            "private_photos": partner_priv_photos,
            "private_bio": partner_priv_bio
        }

    conn.close()

    return {
        "partner_id": partner_id,
        "partner_name": partner_row["name"] if partner_row else "",
        "partner_has_private": partner_has_private,
        "partner_private_count": len(partner_priv_photos),
        "my_request_status": my_request_status,
        "their_request_status": their_request_status,
        "unlocked_content": unlocked_content
    }


@router.post("/matches/{match_id}/request-private")
def request_private_access(match_id: int, request: Request):
    """Solicita autorização para ver as fotos e bio privadas do parceiro."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)", (match_id, current_id, current_id))
    match_row = cursor.fetchone()
    if not match_row:
        conn.close()
        raise HTTPException(status_code=403, detail="Você não pertence a este match.")

    partner_id = match_row["user2_id"] if match_row["user1_id"] == current_id else match_row["user1_id"]

    cursor.execute("""
        INSERT INTO private_access_requests (match_id, requester_id, target_id, status, updated_at)
        VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        ON CONFLICT(requester_id, target_id) DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
    """, (match_id, current_id, partner_id))

    # Notificação no chat
    cursor.execute("""
        INSERT INTO messages (match_id, sender_id, text)
        VALUES (?, ?, ?)
    """, (match_id, current_id, "🔒 Pediu acesso às suas fotos e bio privadas."))

    conn.commit()
    conn.close()

    return {"success": True, "status": "pending", "message": "Solicitação enviada!"}


@router.post("/matches/{match_id}/respond-private")
def respond_private_access(match_id: int, body: PrivateAccessAction, request: Request):
    """Autoriza ('approve') ou recusa ('reject') o pedido de acesso do parceiro."""
    current_id = get_current_user_id(request)
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Ação inválida. Use 'approve' ou 'reject'.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)", (match_id, current_id, current_id))
    match_row = cursor.fetchone()
    if not match_row:
        conn.close()
        raise HTTPException(status_code=403, detail="Você não pertence a este match.")

    partner_id = match_row["user2_id"] if match_row["user1_id"] == current_id else match_row["user1_id"]
    new_status = "approved" if body.action == "approve" else "rejected"

    cursor.execute("""
        UPDATE private_access_requests
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE match_id = ? AND requester_id = ? AND target_id = ?
    """, (new_status, match_id, partner_id, current_id))

    # Notificação no chat
    notice = "🔓 Liberou o acesso às fotos e bio privadas!" if new_status == "approved" else "🚫 Recusou o pedido de acesso privado."
    cursor.execute("""
        INSERT INTO messages (match_id, sender_id, text)
        VALUES (?, ?, ?)
    """, (match_id, current_id, notice))

    conn.commit()
    conn.close()

    return {"success": True, "status": new_status}

