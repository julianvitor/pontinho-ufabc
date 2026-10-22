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
    DB_FILE = Path(__file__).parent / "pontinho.db"

def get_db():
    """Retorna uma conexão com o banco SQLite com suporte a dicionários."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

import hashlib

def hash_password(password: str) -> str:
    """Gera hash SHA-256 com salt fixo para entendimento humano."""
    salt = "ufabc_pontinho_2026"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verifica se a senha fornecida confere com o hash salvo."""
    return hash_password(password) == hashed

def init_db():
    """Cria todas as tabelas necessárias no banco de dados SQLite."""
    conn = get_db()
    cursor = conn.cursor()

    # Tabela de Usuários com RA e Senha
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ra TEXT UNIQUE, -- Registro Acadêmico UFABC (ex: 11202021001)
        password_hash TEXT, -- Hash da senha do estudante
        email TEXT,
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
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Migração automática caso o banco já existisse sem ra, password_hash, gender ou target_gender
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Banco de dados SQLite inicializado com sucesso!")
