"""
Servidor de Desenvolvimento Frontend com Live Reload - Pontinho
Executa um servidor local em Python com Live Reload que monitora alterações em arquivos
HTML, CSS e JavaScript e atualiza o navegador automaticamente.
"""
import sys
import argparse
import os
from pathlib import Path

# Configuração de paths
ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"

def main():
    parser = argparse.ArgumentParser(description="Servidor Frontend com Live Reload - Pontinho")
    parser.add_argument("--port", type=int, default=3000, help="Porta do servidor frontend (padrão: 3000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host do servidor frontend (padrão: 127.0.0.1)")
    parser.add_argument("--api", type=str, default="http://127.0.0.1:8000", help="URL base da API backend (padrão: http://127.0.0.1:8000)")
    parser.add_argument("--open", action="store_true", help="Abrir o navegador automaticamente")
    args = parser.parse_args()

    if not FRONTEND_DIR.exists():
        print(f"[ERRO] Diretório do frontend não encontrado em: {FRONTEND_DIR}")
        sys.exit(1)

    try:
        from livereload import Server
    except ImportError:
        # Tenta reexecutar usando o python do virtualenv local ./venv se existir
        venv_python = ROOT_DIR / "venv" / "bin" / "python"
        if venv_python.exists() and sys.executable != str(venv_python):
            import subprocess
            res = subprocess.run([str(venv_python), str(Path(__file__).resolve())] + sys.argv[1:])
            sys.exit(res.returncode)

        print("[ERRO] O pacote 'livereload' não está instalado no ambiente Python atual.")
        print("Instale executando:")
        print("   ./venv/bin/pip install -r requirements.txt")
        sys.exit(1)

    server = Server()

    # Monitora alterações em todos os arquivos estáticos
    server.watch(str(FRONTEND_DIR / "*.html"))
    server.watch(str(FRONTEND_DIR / "css" / "*.css"))
    server.watch(str(FRONTEND_DIR / "js" / "*.js"))

    print("=" * 64)
    print("Pontinho - Servidor Frontend com Live Reload")
    print(f"🌐 Frontend URL:      http://{args.host}:{args.port}")
    print(f"📡 Backend API:       {args.api}")
    print(f"👀 Pasta monitorada:  {FRONTEND_DIR}")
    print("⚡ Alterações em HTML/CSS/JS recarregam o navegador automaticamente.")
    print("=" * 64)

    try:
        server.serve(
            root=str(FRONTEND_DIR),
            host=args.host,
            port=args.port,
            default_filename="index.html",
            open_url_delay=1 if args.open else None
        )
    except KeyboardInterrupt:
        print("\n[INFO] Servidor frontend finalizado.")

if __name__ == "__main__":
    main()
