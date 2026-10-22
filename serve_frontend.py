"""
Servidor de Desenvolvimento Frontend com Live Refresh - Pontinho
Executa um servidor local em Python que monitora alterações em arquivos
HTML, CSS e JavaScript e atualiza o navegador automaticamente.
"""
import sys
import argparse
from pathlib import Path

# Configuração de paths
ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"

def main():
    parser = argparse.ArgumentParser(description="Servidor Frontend com Live Refresh - Pontinho")
    parser.add_argument("--port", type=int, default=3000, help="Porta do servidor frontend (padrão: 3000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host do servidor frontend (padrão: 127.0.0.1)")
    parser.add_argument("--open", action="store_true", help="Abrir o navegador automaticamente")
    args = parser.parse_args()

    if not FRONTEND_DIR.exists():
        print(f"[ERRO] Diretório do frontend não encontrado em: {FRONTEND_DIR}")
        sys.exit(1)

    try:
        from livereload import Server
    except ImportError:
        print("[ERRO] O pacote 'livereload' não está instalado no ambiente Python.")
        print("Instale executando:")
        print("   pip install livereload")
        sys.exit(1)

    server = Server()

    # Monitora alterações em todos os arquivos de frontend (HTML, CSS, JS)
    server.watch(str(FRONTEND_DIR))
    server.watch(str(FRONTEND_DIR / "*.html"))
    server.watch(str(FRONTEND_DIR / "css" / "*.css"))
    server.watch(str(FRONTEND_DIR / "js" / "*.js"))

    print("=" * 62)
    print("🔥 Pontinho - Servidor Frontend com Live Refresh Ativo!")
    print(f"🌐 Frontend URL:      http://{args.host}:{args.port}")
    print(f"📡 Backend API:       http://127.0.0.1:8000")
    print(f"👀 Pasta monitorada:  {FRONTEND_DIR}")
    print("⚡ Qualquer edição em HTML/CSS/JS recarregará o navegador automaticamente.")
    print("=" * 62)

    try:
        server.serve(
            root=str(FRONTEND_DIR),
            host=args.host,
            port=args.port,
            default_filename="index.html",
            open_url_delay=1 if args.open else None
        )
    except KeyboardInterrupt:
        print("
[INFO] Servidor frontend finalizado.")

if __name__ == "__main__":
    main()
