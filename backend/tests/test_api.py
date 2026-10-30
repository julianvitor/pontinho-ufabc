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


