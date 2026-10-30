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
