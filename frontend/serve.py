"""
Módulo executável para rodar o servidor frontend via: python -m frontend.serve
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from serve_frontend import main

if __name__ == '__main__':
    main()
