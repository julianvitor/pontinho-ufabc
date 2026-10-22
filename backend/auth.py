"""
Utilitários de autenticação e validação de e-mail do Pontinho
"""
from fastapi import Request, HTTPException
from backend.database import get_db

def get_current_user_id(request: Request) -> int:
    """
    Obtém o id do usuário atual a partir do cabeçalho 'X-User-Id'
    ou cookie 'pontinho_user_id'.
    """
    header_val = request.headers.get("x-user-id")
    if header_val and header_val.isdigit():
        return int(header_val)
    cookie_val = request.cookies.get("pontinho_user_id")
    if cookie_val and cookie_val.isdigit():
        return int(cookie_val)
    raise HTTPException(status_code=401, detail="Você precisa estar autenticado.")

def get_current_user(request: Request) -> dict:
    """
    Recupera os dados completos do usuário autenticado no banco.
    Lança 401 caso não esteja autenticado ou o usuário não exista mais.
    """
    user_id = get_current_user_id(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Sessão inválida ou usuário inexistente.")
    return dict(row)

def require_admin(request: Request) -> dict:
    """
    Garante que a requisição partiu de um usuário com privilégios de administrador.
    Lança 401 se não estiver autenticado e 403 se não for admin.
    """
    user = get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(
            status_code=403,
            detail="Acesso negado: privilégios de administrador necessários."
        )
    return user

def sanitize_and_validate_ufabc_email(email_raw: str) -> str:
    """
    Sanitiza e valida e-mails do usuário no Pontinho.
    Se digitar apenas o login (sem @), adiciona domínio padrão.
    """
    email = email_raw.strip().lower()
    if "@" not in email:
        email = f"{email}@aluno.ufabc.edu.br"

    parts = email.split("@")
    if len(parts) != 2 or len(parts[0].strip()) < 2 or "." not in parts[1]:
        raise HTTPException(
            status_code=400,
            detail="Por favor, digite um e-mail válido."
        )

    return email

