#!/bin/sh
set -e

echo "==> Inicializando e verificando banco de dados SQLite..."
python seed.py

echo "==> Iniciando Pontinho UFABC na porta 8000..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 "$@"
