"""
Rotas de Central de Ajuda, Segurança e Ouvidoria Pública do Pontinho
Permite que qualquer pessoa (mesmo sem cadastro ou login) registre denúncias de perfis fakes,
perseguição, assédio, difamação ou violação de imagem.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import ComplaintCreate
from backend.auth import get_current_user_id, require_admin

router = APIRouter(tags=["help"])

@router.post("/api/help/complaint")
def create_complaint(data: ComplaintCreate, request: Request):
    """
    Registra uma reclamação ou denúncia de segurança pública.
    Aberto a qualquer pessoa (mesmo sem login ou conta no app).
    """
    user_id = None
    try:
        user_id = get_current_user_id(request)
    except Exception:
        user_id = None

    client_ip = request.client.host if request.client else ""

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO complaints (
            reporter_id, reporter_name, reporter_contact, complaint_type,
            target_description, details, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        data.reporter_name.strip() if data.reporter_name else "",
        data.reporter_contact.strip(),
        data.complaint_type.strip(),
        data.target_description.strip(),
        data.details.strip(),
        client_ip
    ))

    conn.commit()
    complaint_id = cursor.lastrowid
    conn.close()

    return {
        "status": "success",
        "id": complaint_id,
        "message": "Sua reclamação foi registrada com sucesso sob protocolo confidencial. Nossa equipe de moderação e segurança apurará com prioridade."
    }


@router.get("/api/admin/complaints")
def list_admin_complaints(request: Request, status: Optional[str] = None):
    """
    Lista reclamações e denúncias públicas recebidas pela Ouvidoria.
    Acesso restrito a administradores.
    """
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT c.id, c.reporter_id, c.reporter_name, c.reporter_contact,
               c.complaint_type, c.target_description, c.details, c.status,
               c.ip_address, c.created_at,
               u.name AS reporter_user_name, u.ra AS reporter_user_ra
        FROM complaints c
        LEFT JOIN users u ON u.id = c.reporter_id
    """
    params = []
    if status:
        query += " WHERE c.status = ?"
        params.append(status)

    query += " ORDER BY c.id DESC"

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    complaints = [dict(r) for r in rows]

    cursor.execute("SELECT COUNT(*) AS count FROM complaints WHERE status = 'pending'")
    pending_count = cursor.fetchone()["count"]

    conn.close()
    return {
        "complaints": complaints,
        "total": len(complaints),
        "total_pending": pending_count
    }


@router.put("/api/admin/complaints/{complaint_id}/status")
def update_complaint_status(complaint_id: int, payload: dict, request: Request):
    """
    Atualiza o status de uma reclamação da ouvidoria (pending, under_review, resolved, dismissed).
    """
    require_admin(request)
    new_status = payload.get("status")
    if not new_status or new_status not in ["pending", "under_review", "resolved", "dismissed"]:
        raise HTTPException(status_code=400, detail="Status inválido.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE complaints SET status = ? WHERE id = ?", (new_status, complaint_id))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Reclamação não encontrada.")

    conn.commit()
    conn.close()
    return {"message": f"Status atualizado para '{new_status}' com sucesso."}


@router.delete("/api/admin/complaints/{complaint_id}")
def delete_complaint(complaint_id: int, request: Request):
    """Exclui um registro de reclamação da ouvidoria."""
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM complaints WHERE id = ?", (complaint_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Reclamação não encontrada.")

    conn.commit()
    conn.close()
    return {"message": "Reclamação excluída com sucesso."}
