"""
Rotas de Gerenciamento de Usuário e Perfil do Pontinho UFABC
"""
import json
import sqlite3
from fastapi import APIRouter, HTTPException, Request, Response
from backend.database import get_db
from backend.models import UserCreateOrUpdate, ReportCreate
from backend.auth import get_current_user_id, clear_auth_session
from backend.teaser import get_or_create_server_blurred_teaser

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/list")
def list_users_for_switch(request: Request):
    """Lista usuários para facilitar a troca no cabeçalho. Exige autenticação."""
    get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ra, name, email, age, campus, course, specific_course, photos, is_admin FROM users ORDER BY id ASC")
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

    # Validação de segurança: fotos de perfil devem ser uploads locais na plataforma
    for p in (data.photos or []) + (data.private_photos or []):
        if not p or not isinstance(p, str):
            continue
        p_clean = p.strip().lower()
        if p_clean.startswith(("http://", "https://", "ftp://", "//")) and not p.startswith("https://images.unsplash.com"):
            raise HTTPException(
                status_code=400,
                detail="Fotos de perfil devem ser enviadas exclusivamente através do upload de arquivos do Pontinho."
            )
        if ".." in p:
            raise HTTPException(status_code=400, detail="Caminho de imagem inválido.")

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

    # Gera/atualiza teaser borrado da 1ª foto privada se houver
    if data.private_photos and len(data.private_photos) > 0:
        try:
            get_or_create_server_blurred_teaser(data.private_photos[0], current_id)
        except Exception:
            pass

    return {"success": True, "message": "Perfil atualizado com sucesso!"}


@router.get("/me/export")
def export_my_data_lgpd(request: Request):
    """
    LGPD - Art. 18, II e V (Direito de Acesso e Portabilidade dos Dados).
    Retorna todo o histórico e dados pessoais armazenados sobre o usuário no formato JSON.
    """
    user_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    # 1. Dados cadastrais e perfil
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    user_dict = dict(user_row)
    # Por segurança, removemos o hash da senha da exportação
    user_dict.pop("password_hash", None)
    user_dict["interests"] = json.loads(user_dict["interests"]) if user_dict.get("interests") else []
    user_dict["photos"] = json.loads(user_dict["photos"]) if user_dict.get("photos") else []
    user_dict["songs"] = json.loads(user_dict["songs"]) if user_dict.get("songs") else []
    user_dict["private_photos"] = json.loads(user_dict["private_photos"]) if user_dict.get("private_photos") else []

    # 2. Histórico de Swipes efetuados
    cursor.execute("""
        SELECT s.to_user_id, u.name as target_name, s.action, s.created_at
        FROM swipes s
        LEFT JOIN users u ON u.id = s.to_user_id
        WHERE s.from_user_id = ?
        ORDER BY s.created_at DESC
    """, (user_id,))
    swipes = [dict(r) for r in cursor.fetchall()]

    # 3. Matches ativos
    cursor.execute("""
        SELECT m.id as match_id, m.created_at,
               u.id as matched_user_id, u.name as matched_user_name
        FROM matches m
        JOIN users u ON (u.id = CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END)
        WHERE m.user1_id = ? OR m.user2_id = ?
        ORDER BY m.created_at DESC
    """, (user_id, user_id, user_id))
    matches = [dict(r) for r in cursor.fetchall()]

    # 4. Mensagens enviadas e recebidas
    cursor.execute("""
        SELECT msg.id, msg.match_id, msg.sender_id, msg.text, msg.created_at,
               (msg.sender_id = ?) as sent_by_me
        FROM messages msg
        JOIN matches m ON m.id = msg.match_id
        WHERE m.user1_id = ? OR m.user2_id = ?
        ORDER BY msg.created_at ASC
    """, (user_id, user_id, user_id))
    messages = [dict(r) for r in cursor.fetchall()]

    # 5. Solicitações de fotos privadas
    cursor.execute("""
        SELECT par.id, par.match_id, par.requester_id, par.target_id, par.status, par.created_at
        FROM private_access_requests par
        WHERE par.requester_id = ? OR par.target_id = ?
    """, (user_id, user_id))
    private_requests = [dict(r) for r in cursor.fetchall()]

    conn.close()

    from datetime import datetime, timezone
    return {
        "lgpd_compliance": {
            "law": "Lei Geral de Proteção de Dados (Lei nº 13.709/2018)",
            "article": "Artigo 18 - Direitos do Titular (Acesso e Portabilidade de Dados)",
            "platform": "Pontinho UFABC",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "contact_dpo": "privacidade@pontinho.app"
        },
        "titular": user_dict,
        "swipes_historico": swipes,
        "matches": matches,
        "mensagens": messages,
        "solicitacoes_privadas": private_requests
    }

@router.delete("/me")
def delete_my_account_lgpd(request: Request, response: Response):
    """
    LGPD - Art. 18, VI (Direito à Eliminação dos Dados Pessoais / Direito ao Esquecimento).
    Exclui permanentemente a conta do usuário e todos os registros vinculados
    (swipes, matches, mensagens e solicitações privadas em cascata).
    """
    user_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()

    # Confirma existência
    cursor.execute("SELECT id, name FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Exclui o usuário (Foreign keys em ON DELETE CASCADE limpam swipes, matches, messages, private_access_requests)
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    # Remove o cookie de sessão e limpa autenticação assinada
    response.delete_cookie(key="pontinho_user_id", path="/")
    clear_auth_session(response)

    return {
        "success": True,
        "message": "Sua conta e todos os seus dados pessoais foram eliminados permanentemente do Pontinho conforme a LGPD."
    }

@router.post("/{target_user_id}/block")
def block_user(target_user_id: int, request: Request):
    """Bloqueia um usuário, removendo qualquer match ativo entre ambos."""
    current_id = get_current_user_id(request)
    if current_id == target_user_id:
        raise HTTPException(status_code=400, detail="Você não pode bloquear a si mesmo.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name FROM users WHERE id = ?", (target_user_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Insere bloqueio mútuo
    cursor.execute("""
        INSERT INTO blocks (blocker_id, blocked_id)
        VALUES (?, ?)
        ON CONFLICT(blocker_id, blocked_id) DO NOTHING
    """, (current_id, target_user_id))

    # Remove qualquer match ativo entre ambos (e mensagens em cascata)
    cursor.execute("""
        DELETE FROM matches
        WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    """, (current_id, target_user_id, target_user_id, current_id))

    conn.commit()
    conn.close()
    return {"success": True, "message": f"{target['name']} foi bloqueado com sucesso."}

@router.post("/{target_user_id}/report")
def report_user(target_user_id: int, data: ReportCreate, request: Request):
    """Envia uma denúncia sobre um usuário para a moderação e opcionalmente o bloqueia."""
    current_id = get_current_user_id(request)
    if current_id == target_user_id:
        raise HTTPException(status_code=400, detail="Você não pode denunciar a si mesmo.")

    reason_clean = (data.reason or "").strip()
    if not reason_clean:
        raise HTTPException(status_code=400, detail="Motivo da denúncia é obrigatório.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name FROM users WHERE id = ?", (target_user_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Insere denúncia
    cursor.execute("""
        INSERT INTO reports (reporter_id, reported_id, reason, details, status)
        VALUES (?, ?, ?, ?, 'pending')
    """, (current_id, target_user_id, reason_clean, (data.details or "").strip()))

    # Se selecionado para também bloquear
    if data.block_user:
        cursor.execute("""
            INSERT INTO blocks (blocker_id, blocked_id)
            VALUES (?, ?)
            ON CONFLICT(blocker_id, blocked_id) DO NOTHING
        """, (current_id, target_user_id))

        cursor.execute("""
            DELETE FROM matches
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        """, (current_id, target_user_id, target_user_id, current_id))

    conn.commit()
    conn.close()
    return {
        "success": True,
        "message": "Denúncia enviada à moderação com sucesso. Agradecemos por ajudar a manter o Pontinho seguro!"
    }

@router.post("/{target_user_id}/unblock")
def unblock_user(target_user_id: int, request: Request):
    """Desbloqueia um usuário previamente bloqueado."""
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?", (current_id, target_user_id))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Usuário desbloqueado com sucesso."}
