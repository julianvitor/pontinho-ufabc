"""
Utilitários de autenticação e validação de e-mail acadêmico da UFABC
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
    raise HTTPException(status_code=401, detail="Você precisa estar autenticado com seu e-mail acadêmico.")

def sanitize_and_validate_ufabc_email(email_raw: str) -> str:
    """
    Sanitiza e valida e-mails acadêmicos da UFABC.
    Aceita exclusivamente domínios @aluno.ufabc.edu.br ou @ufabc.edu.br.
    Se o aluno digitar apenas seu login/nome de usuário (ex: 'mariana.silva'),
    adiciona automaticamente o domínio @aluno.ufabc.edu.br.
    """
    email = email_raw.strip().lower()
    if "@" not in email:
        email = f"{email}@aluno.ufabc.edu.br"

    valid_domains = ("@aluno.ufabc.edu.br", "@ufabc.edu.br")
    if not any(email.endswith(domain) for domain in valid_domains):
        raise HTTPException(
            status_code=400,
            detail="Apenas e-mails acadêmicos da UFABC (@aluno.ufabc.edu.br ou @ufabc.edu.br) são permitidos no cadastro."
        )

    username = email.split("@")[0].strip()
    if len(username) < 2:
        raise HTTPException(
            status_code=400,
            detail="Por favor, digite um e-mail acadêmico válido."
        )

    return email
