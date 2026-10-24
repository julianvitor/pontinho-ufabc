"""
Rotas de Feed e Swipes do Pontinho
"""
import json
import re
import urllib.request
import urllib.parse
import time
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Request
from backend.database import get_db
from backend.models import SwipeRequest
from backend.auth import get_current_user_id
from backend.teaser import get_or_create_server_blurred_teaser

router = APIRouter(prefix="/api", tags=["feed"])

# Anti-flood / Rate limiting em memória para busca de músicas (15 requisições por minuto por usuário autenticado)
RATE_LIMIT_YT_WINDOW = 60
MAX_YT_REQUESTS_PER_WINDOW = 15
_YOUTUBE_TRACKER = defaultdict(list)

def _check_youtube_rate_limit(user_id: int):
    now = time.time()
    recent = [t for t in _YOUTUBE_TRACKER[user_id] if now - t < RATE_LIMIT_YT_WINDOW]
    if len(recent) >= MAX_YT_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail="Limite de buscas de músicas excedido. Por favor, aguarde um minuto."
        )
    recent.append(now)
    _YOUTUBE_TRACKER[user_id] = recent

YOUTUBE_CACHE = {
    "chico buarque - construção": "suia_i5dEZc",
    "arctic monkeys - 505": "CKI8iQTgZKU",
    "duda beat - bixinho": "gFUuxGOsMow",
    "tim maia - não quero dinheiro": "FM2tZnIPZUk",
    "tame impala - the less i know the better": "2SUwOgmvzK4",
    "daft punk - harder better faster stronger": "gAjR4_CbPpQ",
    "taylor swift - cruel summer": "ic8j13piAhQ",
    "gilsons - várias queixas": "bBHPq3UQFsw",
    "the strokes - someday": "knU9gRUWCno",
    "daft punk - instant crush": "a5uQMwRMHcs",
    "coldplay - yellow": "yKNxeF4KMsY",
    "criolo - não existe amor em sp": "0PfevkndCPU",
    "kendrick lamar - all the stars": "JQbjS0_ZfJ0",
    "jorge ben jor - taj mahal": "rfrpOhC6858",
    "liniker - baby 95": "9nbYJm9FYa0",
    "silva - a cor é rosa": "KnJwCg-zh4w",
    "caetano veloso - sozinho": "j9UbE1slI-Q",
    "kraftwerk - the robots": "-wop47G2qeY",
    "the weeknd - blinding lights": "4NRXx6U8ABQ",
    "the weeknd": "4NRXx6U8ABQ",
    "vintage culture - in the dark": "8p2p5cR_jHY",
    "vintage culture": "8p2p5cR_jHY",
    "alok - hear me now": "yFvLcxX3Y80",
    "alok": "yFvLcxX3Y80",
    "dua lipa - levitating": "TUVcZfQe-Kw",
    "dua lipa": "TUVcZfQe-Kw",
    "doja cat - kiss me more": "0EVVKs6D654",
    "doja cat": "0EVVKs6D654",
    "marina sena - por supuesto": "_i_b8wFqT74",
    "marina sena": "_i_b8wFqT74",
    "baco exu do blues - me desculpa jay z": "wz4YFq8kSjA",
    "baco exu do blues": "wz4YFq8kSjA",
    "djonga - leal": "4e7lWfQWw-o",
    "djonga": "4e7lWfQWw-o",
    "matuê - anos luz": "K3O_wBf_o0s",
    "matuê": "K3O_wBf_o0s",
}

@router.get("/youtube/search")
def search_youtube(q: str, request: Request):
    """
    Resolve uma busca de música para um ID de vídeo do YouTube.
    Exige autenticação de sessão e rate limiting para evitar abuso como open proxy.
    Possui cache em memória para respostas instantâneas.
    """
    user_id = get_current_user_id(request)
    _check_youtube_rate_limit(user_id)

    query = (q or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Termo de busca vazio.")

    # Se já for URL do YouTube ou ID direto de 11 caracteres
    yt_match = re.search(r'(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})', query)
    if yt_match:
        return {"videoId": yt_match.group(1), "query": query}
    if re.fullmatch(r'[a-zA-Z0-9_-]{11}', query):
        return {"videoId": query, "query": query}

    cache_key = query.lower()
    if cache_key in YOUTUBE_CACHE:
        return {"videoId": YOUTUBE_CACHE[cache_key], "query": query}

    # Busca em tempo real no YouTube scraping
    try:
        url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
            }
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        matches = re.findall(r'\"videoId\":\"([a-zA-Z0-9_-]{11})\"', html)
        if matches:
            vid = matches[0]
            YOUTUBE_CACHE[cache_key] = vid
            return {"videoId": vid, "query": query}
    except Exception:
        pass

    # Fallback
    return {"videoId": "suia_i5dEZc", "query": query, "fallback": True}


@router.post("/feed/reset")
@router.post("/admin/reset-swipes")
def reset_feed_swipes(request: Request):
    """
    Reseta o histórico de swipes do próprio usuário autenticado para que ele possa rever os perfis no feed.
    """
    current_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM swipes WHERE from_user_id = ?", (current_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Histórico de swipes resetado! Agora você pode ver todos os perfis novamente."}


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

    # Buscar perfis ainda não avaliados respeitando o filtro de gênero e exclusão de bloqueios mútuos
    # Projeção com Allowlist Estrita: NUNCA seleciona dados sensíveis como 'email', 'password_hash' ou 'is_admin'
    cursor.execute(f"""
        SELECT id, name, age, campus, course, specific_course, entity, looking_for,
               bio, interests, photos, songs, prompt1_q, prompt1_a, prompt2_q, prompt2_a,
               prompt3_q, prompt3_a, gender, private_photos, private_bio, is_verified
        FROM users
        WHERE id != ?
          AND id NOT IN (
              SELECT to_user_id FROM swipes WHERE from_user_id = ?
          )
          AND id NOT IN (
              SELECT blocked_id FROM blocks WHERE blocker_id = ?
              UNION
              SELECT blocker_id FROM blocks WHERE blocked_id = ?
          )
          {gender_filter_sql}
        ORDER BY id ASC
    """, (current_id, current_id, current_id, current_id))

    rows = cursor.fetchall()
    conn.close()

    profiles = []
    for r in rows:
        d = dict(r)
        # Conteúdo Privado: gera apenas o teaser irreversivelmente borrado no servidor
        private_photos = json.loads(d["private_photos"]) if d.get("private_photos") else []
        has_private = bool(private_photos or d.get("private_bio"))
        teaser_photo = (
            get_or_create_server_blurred_teaser(private_photos[0], d["id"])
            if private_photos else None
        )

        clean_profile = {
            "id": d["id"],
            "name": d["name"],
            "age": d["age"],
            "campus": d["campus"],
            "course": d["course"],
            "specific_course": d["specific_course"],
            "entity": d["entity"],
            "looking_for": d["looking_for"],
            "bio": d["bio"] or "",
            "interests": json.loads(d["interests"]) if d.get("interests") else [],
            "photos": json.loads(d["photos"]) if d.get("photos") else [],
            "songs": json.loads(d["songs"]) if d.get("songs") else [],
            "prompt1_q": d.get("prompt1_q") or "",
            "prompt1_a": d.get("prompt1_a") or "",
            "prompt2_q": d.get("prompt2_q") or "",
            "prompt2_a": d.get("prompt2_a") or "",
            "prompt3_q": d.get("prompt3_q") or "",
            "prompt3_a": d.get("prompt3_a") or "",
            "gender": d.get("gender") or "Não informado",
            "is_verified": bool(d.get("is_verified", 0)),
            "has_private_content": has_private,
            "private_photos_count": len(private_photos),
            "secret_teaser_photo": teaser_photo,
            "is_ad": False
        }
        profiles.append(clean_profile)

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
