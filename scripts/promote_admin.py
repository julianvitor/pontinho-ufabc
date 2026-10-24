#!/usr/bin/env python3
"""
Script utilitário para promover ou rebaixar administradores no Pontinho.
Uso:
    python3 scripts/promote_admin.py <email_ou_ra> [--revoke]
Exemplo:
    python3 scripts/promote_admin.py mariana.silva@pontinho.app
    docker compose exec backend python3 scripts/promote_admin.py meu.email@aluno.ufabc.edu.br
"""
import sys
import os

# Adiciona o diretório raiz ao PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import get_db

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 scripts/promote_admin.py <email_institucional_ou_id> [--revoke]")
        sys.exit(1)

    identifier = sys.argv[1].strip().lower()
    revoke = "--revoke" in sys.argv

    conn = get_db()
    cursor = conn.cursor()

    # Busca usuário por e-mail institucional ou ID
    cursor.execute("""
        SELECT id, name, email, is_admin 
        FROM users 
        WHERE LOWER(email) = ? OR id = ?
    """, (identifier, identifier if identifier.isdigit() else -1))
    
    user = cursor.fetchone()
    if not user:
        print(f"❌ Erro: Usuário com e-mail ou ID '{identifier}' não foi encontrado no banco de dados.")
        conn.close()
        sys.exit(1)

    user_dict = dict(user)
    new_admin_val = 0 if revoke else 1

    cursor.execute("UPDATE users SET is_admin = ? WHERE id = ?", (new_admin_val, user_dict["id"]))
    conn.commit()
    conn.close()

    action_label = "revogado de Administrador" if revoke else "promovido a Administrador"
    emoji = "🛡️" if not revoke else "👤"

    print(f"{emoji} Sucesso! Usuário '{user_dict['name']}' ({user_dict['email']}) foi {action_label}.")
    print(f"   ID: {user_dict['id']} | Email: {user_dict['email']} | is_admin: {new_admin_val}")

if __name__ == "__main__":
    main()
