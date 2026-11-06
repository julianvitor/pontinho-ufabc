"""
Suíte de testes automatizados do Backend (FastAPI) - Pontinho UFABC
Valida rotas, autenticação, ECA Digital, tokens HMAC e integridade do banco de dados.
"""
import os
import pytest
from fastapi.testclient import TestClient

# Configuração de variáveis de ambiente seguras para o ambiente de testes
os.environ["PONTINHO_SECRET_KEY"] = "super_secret_test_key_for_ci_pipeline_32chars"
os.environ["DEV_MODE"] = "true"
os.environ["DATABASE_PATH"] = "/tmp/test_pontinho_ci.db"

from backend.main import app
from backend.database import init_db
from backend.auth import create_session_token, verify_session_token

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Garante que o banco de dados de teste seja inicializado e limpo."""
    init_db()
    yield
    if os.path.exists("/tmp/test_pontinho_ci.db"):
        try:
            os.remove("/tmp/test_pontinho_ci.db")
        except Exception:
            pass

@pytest.fixture
def client():
    """Cliente HTTP de teste para o FastAPI."""
    with TestClient(app) as c:
        yield c


def test_root_endpoint(client):
    """Verifica se o endpoint raiz da API REST pura responde com status online."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "Pontinho API"
    assert data["status"] == "online"


def test_metadata_endpoint(client):
    """Verifica se o endpoint de metadados acadêmicos responde 200 OK com cursos e campi."""
    response = client.get("/api/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "campuses" in data
    assert "Santo André" in data["campuses"]
    assert "looking_for_options" in data


def test_demo_accounts_endpoint(client):
    """Verifica se o endpoint de contas de teste responde com sucesso em modo de desenvolvimento."""
    response = client.get("/api/auth/demo-accounts")
    assert response.status_code == 200
    accounts = response.json()
    assert isinstance(accounts, list)


def test_events_list(client):
    """Verifica se o feed de festas e eventos responde com lista de eventos."""
    response = client.get("/api/events")
    assert response.status_code == 200
    events = response.json()
    assert isinstance(events, list)
    if len(events) > 0:
        assert "title" in events[0]
        assert "attendees_count" in events[0]


def test_session_token_security():
    """Valida assinatura criptográfica e integridade dos tokens HMAC-SHA256."""
    user_id = 42
    token = create_session_token(user_id)
    assert isinstance(token, str)
    assert token.startswith(f"{user_id}.")

    # Verificação de token legítimo
    verified_id = verify_session_token(token)
    assert verified_id == user_id

    # Verificação de token adulterado/falsificado
    tampered_token = token + "forged"
    assert verify_session_token(tampered_token) is None
    assert verify_session_token("") is None
    assert verify_session_token("invalid.token.payload") is None


def test_register_validation_short_password(client):
    """Valida rejeição de senha com menos de 8 caracteres."""
    payload = {
        "email": "estudante.teste@aluno.ufabc.edu.br",
        "name": "Estudante Teste",
        "password": "123",
        "terms_accepted": True,
        "age_verified": True,
        "liveness_passed": True,
        "estimated_age": 20
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code in [400, 422]


def test_register_validation_non_ufabc_email(client):
    """Valida rejeição de e-mail não institucional (@gmail, @hotmail, etc)."""
    payload = {
        "email": "invasor@gmail.com",
        "name": "Invasor Externo",
        "password": "senhaValida1234",
        "terms_accepted": True,
        "age_verified": True,
        "liveness_passed": True,
        "estimated_age": 20
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 400
    assert "institucional" in response.json().get("detail", "").lower()


def test_register_validation_underage_blocked(client):
    """Valida bloqueio automático de menores de 18 anos conforme o ECA Digital."""
    payload = {
        "email": "menor.idade@aluno.ufabc.edu.br",
        "name": "Menor de Idade",
        "password": "senhaValida1234",
        "terms_accepted": True,
        "age_verified": True,
        "liveness_passed": True,
        "estimated_age": 16
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 403
    assert "18 anos" in response.json().get("detail", "").lower()


def test_protected_routes_require_authentication(client):
    """Garante que rotas privadas rejeitem acessos anônimos com 401 Unauthorized."""
    endpoints = [
        "/api/feed",
        "/api/matches",
        "/api/users/me"
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 401


def test_successful_user_registration_and_login(client):
    """Testa o fluxo completo de cadastro legítimo com prova de vida e login subsequente."""
    unique_email = f"aluno.ci_{os.getpid()}@aluno.ufabc.edu.br"
    password = "senhaSeguraDeTeste2026"
    
    register_payload = {
        "email": unique_email,
        "name": "Aluno CI Teste",
        "password": password,
        "terms_accepted": True,
        "age_verified": True,
        "liveness_passed": True,
        "estimated_age": 21,
        "face_descriptor": [0.01, 0.02, 0.03]
    }
    reg_response = client.post("/api/auth/register", json=register_payload)
    assert reg_response.status_code == 200
    reg_data = reg_response.json()
    assert reg_data["success"] is True
    assert "user_id" in reg_data
    assert "token" in reg_data

    # Teste de login subsequente
    login_payload = {
        "email": unique_email,
        "password": password
    }
    login_response = client.post("/api/auth/login", json=login_payload)
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "token" in login_data
    assert login_data["user"]["email"] == unique_email
    # Garante que novas contas não tenham fotos mockadas do Unsplash inseridas automaticamente
    user_photos = login_data["user"].get("photos", [])
    assert not any("unsplash.com" in p for p in user_photos)


def test_upload_webp_image_accepted(client):
    """Verifica se o upload de imagem já convertida em WebP é aceito e processado."""
    import io
    from PIL import Image

    img = Image.new("RGB", (120, 120), color=(16, 185, 129))
    webp_buf = io.BytesIO()
    img.save(webp_buf, format="WEBP", quality=90)
    webp_bytes = webp_buf.getvalue()

    token = create_session_token(user_id=1)
    response = client.post(
        "/api/upload/photo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("foto.webp", webp_bytes, "image/webp")}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["media_type"] == "image"
    assert data["filename"].endswith(".webp")


def test_upload_raw_jpeg_rejected(client):
    """Verifica se imagens não-WebP (como JPEG cru) são rejeitadas pelo backend."""
    import io
    from PIL import Image

    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    jpeg_buf = io.BytesIO()
    img.save(jpeg_buf, format="JPEG")
    jpeg_bytes = jpeg_buf.getvalue()

    token = create_session_token(user_id=1)
    response = client.post(
        "/api/upload/photo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("foto.jpg", jpeg_bytes, "image/jpeg")}
    )

    assert response.status_code == 400
    assert "WebP (.webp) ou GIFs" in response.json()["detail"]


def test_upload_animated_gif_accepted(client):
    """Verifica se o upload de GIF animado é aceito, sanitizado e gravado como .gif."""
    import io
    from PIL import Image

    # Cria um GIF animado sintético com 2 frames
    frames = [
        Image.new("RGB", (120, 120), color=(255, 120, 0)),
        Image.new("RGB", (120, 120), color=(140, 0, 255))
    ]
    gif_buf = io.BytesIO()
    frames[0].save(
        gif_buf,
        save_all=True,
        append_images=frames[1:],
        format="GIF",
        duration=[150, 150],
        loop=0
    )
    gif_bytes = gif_buf.getvalue()

    token = create_session_token(user_id=1)
    response = client.post(
        "/api/upload/photo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("animacao.gif", gif_bytes, "image/gif")}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["media_type"] == "gif"
    assert data["filename"].endswith(".gif")


def test_upload_direct_video_rejected(client):
    """Verifica se o upload de vídeo direto para a API é estritamente rejeitado com HTTP 400."""
    token = create_session_token(user_id=1)
    fake_mp4_bytes = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41"

    response = client.post(
        "/api/upload/photo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("video.mp4", fake_mp4_bytes, "video/mp4")}
    )

    assert response.status_code == 400
    assert "apenas imagens e GIFs" in response.json()["detail"]


def test_upload_corrupted_video_rejected(client):
    """Verifica se arquivos com extensão de vídeo são rejeitados pelo backend."""
    token = create_session_token(user_id=1)
    fake_bytes = b"Este nao e um arquivo de video real, mas sim bytes forjados."

    response = client.post(
        "/api/upload/photo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("corrupt.mp4", fake_bytes, "video/mp4")}
    )

    assert response.status_code == 400


def test_cors_preflight_dev_subdomain():
    """Verifica se origens de subdomínios aninhados são aceitas no CORS."""
    import re
    os.environ["CORS_ORIGINS"] = "https://*.workers.dev,https://*.pages.dev,https://*.exemplo.com.br,https://exemplo.com.br"
    from backend.main import build_cors_regex

    regex_pattern = build_cors_regex()
    compiled = re.compile(regex_pattern)
    assert compiled.match("https://dev.pontinho.exemplo.com.br") is not None
    assert compiled.match("https://pontinho.exemplo.com.br") is not None
    assert compiled.match("https://pontinho-ufabc.subdomain.workers.dev") is not None
    assert compiled.match("https://attacker-fake.com") is None


def test_send_and_verify_email_code(client):
    """Verifica geração e validação de código de 4 dígitos via e-mail."""
    test_email = "novo.estudante@aluno.ufabc.edu.br"

    # 1. Enviar código de 4 dígitos
    res = client.post("/api/auth/send-verification-code", json={"email": test_email, "name": "Estudante Teste"})
    assert res.status_code == 200
    assert res.json()["success"] is True

    # 2. Consultar código gerado no banco de testes
    from backend.database import get_db
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT code FROM email_verification_codes WHERE email = ? ORDER BY id DESC LIMIT 1", (test_email,))
    row = cursor.fetchone()
    conn.close()

    assert row is not None
    code = row["code"]
    assert len(code) == 4
    assert code.isdigit()

    # 3. Validar código incorreto
    res_err = client.post("/api/auth/verify-code", json={"email": test_email, "code": "0001"})
    assert res_err.status_code == 400

    # 4. Validar código correto
    res_ok = client.post("/api/auth/verify-code", json={"email": test_email, "code": code})
    assert res_ok.status_code == 200
    assert res_ok.json()["valid"] is True


def test_forgot_password_and_reset_flow(client):
    """Verifica fluxo completo de recuperação de senha com token único."""
    from backend.database import get_db
    from backend.auth import sanitize_and_validate_ufabc_email

    email = "recuperar.senha@aluno.ufabc.edu.br"

    # Cria o usuário para teste
    client.post("/api/auth/register", json={
        "email": email,
        "name": "Aluno Recuperacao",
        "password": "senhaAntiga123",
        "terms_accepted": True,
        "age_verified": True,
        "liveness_passed": True,
        "estimated_age": 22,
        "verification_code": "0000"
    })

    # 1. Solicitar recuperação de senha
    res_forgot = client.post("/api/auth/forgot-password", json={"email": email})
    assert res_forgot.status_code == 200
    assert res_forgot.json()["success"] is True

    # 2. Obter token gerado no banco de testes
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT token FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1", (email,))
    row = cursor.fetchone()
    conn.close()

    assert row is not None
    token = row["token"]

    # 3. Checar validade do token
    res_check = client.get(f"/api/auth/verify-reset-token?token={token}")
    assert res_check.status_code == 200
    assert res_check.json()["valid"] is True

    # 4. Redefinir com senha curta deve falhar
    res_short = client.post("/api/auth/reset-password", json={"token": token, "new_password": "123"})
    assert res_short.status_code in (400, 422)

    # 5. Redefinir com senha válida
    res_reset = client.post("/api/auth/reset-password", json={"token": token, "new_password": "NovaSenhaSegura2026!"})
    assert res_reset.status_code == 200
    assert res_reset.json()["success"] is True

    # 6. Reutilizar o mesmo token deve ser rejeitado
    res_reuse = client.post("/api/auth/reset-password", json={"token": token, "new_password": "OutraSenha123"})
    assert res_reuse.status_code == 400

    # 7. Login com a nova senha deve ter sucesso
    res_login = client.post("/api/auth/login", json={"email": email, "password": "NovaSenhaSegura2026!"})
    assert res_login.status_code == 200
    assert res_login.json()["success"] is True


def test_delete_all_admin_ads(client):
    """Testa remoção em lote de todas as propagandas pela API de administrador."""
    from backend.database import get_db, hash_password
    from backend.auth import create_session_token

    # Garante que um usuário admin existe no banco de teste
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO users (id, name, email, password_hash, is_admin) VALUES (999, 'Admin Teste', 'admin.teste@aluno.ufabc.edu.br', ?, 1)", (hash_password("admin123"),))
    conn.commit()
    conn.close()

    token = create_session_token(999)
    headers = {"Authorization": f"Bearer {token}"}
    client.cookies.set("pontinho_session", token)

    # Insere um anúncio
    res_add = client.post("/api/admin/ads", json={
        "title": "Anúncio Teste",
        "description": "Desc Teste",
        "image_url": "/uploads/teste.webp",
        "button_text": "Ver",
        "link_url": "https://ufabc.edu.br",
        "is_active": 1,
        "frequency": 4
    }, headers=headers)
    assert res_add.status_code == 200

    # Verifica que existe
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM ads")
    assert c.fetchone()[0] > 0
    conn.close()

    # Deleta todas as propagandas
    del_res = client.delete("/api/admin/ads", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verifica que a tabela está vazia
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM ads")
    assert c.fetchone()[0] == 0
    conn.close()




