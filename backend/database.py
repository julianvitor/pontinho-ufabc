import os
import sqlite3
import json
from pathlib import Path

# Permite configurar o caminho do banco via variável de ambiente (essencial para volumes Docker)
DB_PATH_ENV = os.getenv("DATABASE_PATH")
if DB_PATH_ENV:
    DB_FILE = Path(DB_PATH_ENV)
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
else:
    # Salva na pasta data/ na raiz do projeto
    DB_FILE = Path(__file__).resolve().parent.parent / "data" / "pontinho.db"
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)

def get_db():
    """Retorna uma conexão com o banco SQLite com suporte a dicionários."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

import hashlib
import hmac
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64 MB
    parallelism=1,
    hash_len=32,
    salt_len=16
)

def hash_password(password: str) -> str:
    """Gera hash seguro com Argon2id (padrão de ouro OWASP, com salt individual aleatório)."""
    return _hasher.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    """
    Verifica se a senha fornecida confere com o hash salvo.
    Suporta Argon2id nativamente e provê retrocompatibilidade transparente
    com os hashes legados SHA-256.
    """
    if not hashed:
        return False

    # 1. Validação Argon2id
    if hashed.startswith("$argon2"):
        try:
            return _hasher.verify(hashed, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    # 2. Retrocompatibilidade para hashes legados SHA-256
    legacy_salt = "ufabc_pontinho_2026"
    legacy_hash = hashlib.sha256((legacy_salt + password).encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy_hash, hashed)

def needs_rehash(hashed: str) -> bool:
    """Indica se o hash salvo precisa ser migrado para Argon2id."""
    if not hashed or not hashed.startswith("$argon2"):
        return True
    try:
        return _hasher.check_needs_rehash(hashed)
    except Exception:
        return True

def init_db():
    """Cria todas as tabelas necessárias no banco de dados SQLite."""
    conn = get_db()
    cursor = conn.cursor()

    # Tabela de Usuários com E-mail Institucional e Senha
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ra TEXT UNIQUE,
        password_hash TEXT,
        email TEXT UNIQUE,
        name TEXT NOT NULL,
        age INTEGER NOT NULL DEFAULT 20,
        campus TEXT NOT NULL DEFAULT 'Santo André',
        course TEXT NOT NULL DEFAULT 'BC&T - Bacharelado em Ciência e Tecnologia',
        specific_course TEXT NOT NULL DEFAULT 'Ciência da Computação',
        entity TEXT NOT NULL DEFAULT 'Nenhuma / Foco no CR',
        looking_for TEXT NOT NULL DEFAULT 'Algo sério',
        bio TEXT DEFAULT '',
        interests TEXT NOT NULL DEFAULT '[]',
        photos TEXT NOT NULL DEFAULT '[]', -- Mínimo de 2 fotos
        prompt1_q TEXT,
        prompt1_a TEXT,
        prompt2_q TEXT,
        prompt2_a TEXT,
        prompt3_q TEXT,
        prompt3_a TEXT,
        gender TEXT NOT NULL DEFAULT 'Não informado', -- 'Mulher', 'Homem', 'Não-binário', 'Outro'
        target_gender TEXT NOT NULL DEFAULT 'Todos', -- 'Mulheres', 'Homens', 'Não-binário', 'Todos'
        songs TEXT NOT NULL DEFAULT '[]', -- Músicas favoritas / trilha do perfil
        terms_accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_admin INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        verified_face_descriptor TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Migração automática de compatibilidade caso o banco já existisse sem password_hash, gender, target_gender, songs ou terms_accepted_at
    cursor.execute("PRAGMA table_info(users)")
    existing_cols = [row["name"] for row in cursor.fetchall()]
    if "ra" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN ra TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ra ON users(ra)")
    if "password_hash" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "gender" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'Não informado'")
    if "target_gender" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN target_gender TEXT DEFAULT 'Todos'")
    if "songs" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN songs TEXT DEFAULT '[]'")
    if "private_photos" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN private_photos TEXT DEFAULT '[]'")
    if "private_bio" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN private_bio TEXT DEFAULT ''")
    if "terms_accepted_at" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP")
        cursor.execute("UPDATE users SET terms_accepted_at = datetime('now') WHERE terms_accepted_at IS NULL")
    if "age_verified" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN age_verified INTEGER DEFAULT 0")
    if "verified_age" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN verified_age INTEGER DEFAULT 0")
    if "liveness_verified" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN liveness_verified INTEGER DEFAULT 0")
    if "verification_photo" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN verification_photo TEXT DEFAULT ''")
    if "age_verified_at" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN age_verified_at TIMESTAMP")
    if "is_verified" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
    if "verified_face_descriptor" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN verified_face_descriptor TEXT DEFAULT ''")

    # Tabela de Solicitações de Acesso a Conteúdo Privado (Fotos & Bio Secreta)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS private_access_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        requester_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(requester_id, target_id),
        FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Tabela de Cursos (Base e Específico) gerenciáveis pelo admin
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL -- 'base' ou 'especifico'
    );
    """)

    # Tabela de Entidades gerenciáveis pelo admin
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );
    """)

    # Tabela de Perguntinhas de perfil gerenciáveis pelo admin
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL UNIQUE
    );
    """)

    # Tabela de Publicidade (Ads) que aparecem entre os swipes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        image_url TEXT NOT NULL,
        button_text TEXT DEFAULT 'Conferir',
        link_url TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        frequency INTEGER DEFAULT 4 -- Exibe a cada N cards de perfil
    );
    """)

    # Tabela de Swipes (Likes e Passes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS swipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        action TEXT NOT NULL, -- 'like' ou 'pass'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user_id, to_user_id),
        FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Tabela de Matches
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1_id, user2_id),
        FOREIGN KEY(user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(user2_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Tabela de Mensagens de Chat (texto apenas)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        read_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Migração para coluna read_at em messages
    cursor.execute("PRAGMA table_info(messages)")
    msg_cols = [row["name"] for row in cursor.fetchall()]
    if "read_at" not in msg_cols:
        cursor.execute("ALTER TABLE messages ADD COLUMN read_at TIMESTAMP DEFAULT NULL")

    # Tabela de Denúncias (Reports)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        reported_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        details TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(reported_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Tabela de Bloqueios Mútuos (Blocks)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blocker_id INTEGER NOT NULL,
        blocked_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id),
        FOREIGN KEY(blocker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(blocked_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Tabela de Eventos e Festas Universitárias
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        event_date TEXT NOT NULL,
        location TEXT NOT NULL,
        image_url TEXT DEFAULT '',
        ticket_url TEXT DEFAULT '',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # Tabela de Presenças Confirmadas em Eventos (RSVP)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS event_attendees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'going',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id),
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Tabela de Reclamações Públicas e Ouvidoria de Segurança (Fakes, Assédio, Perseguição, etc.)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER DEFAULT NULL,
        reporter_name TEXT DEFAULT '',
        reporter_contact TEXT NOT NULL,
        complaint_type TEXT NOT NULL,
        target_description TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        ip_address TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Banco de dados SQLite inicializado com sucesso!")
