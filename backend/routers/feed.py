"""
Rotas de Feed e Swipes do Pontinho UFABC
"""
import json
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import SwipeRequest
from backend.auth import get_current_user_id

router = APIRouter(prefix="/api", tags=["feed"])

@router.get("/feed")
def get_feed(request: Request):
    """
    Retorna os perfis disponíveis para swipe intercalados com cards de publicidade!
    Exclui o próprio usuário e perfis que já receberam swipe (like ou pass).
    Respeita o filtro de target_gender definido pelo usuário.
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
        d["songs"] = json.loads(d["songs"]) if d.get("songs") else []
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

@router.post("/swipe")
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
