"""
Utilitários de autenticação e validação de e-mail do Pontinho
"""
from fastapi import Request, HTTPException

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

