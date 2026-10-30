#!/bin/sh
set -e

echo "==> Inicializando e verificando banco de dados SQLite..."
python -m backend.seed

echo "==> Iniciando Pontinho na porta 8000 com 1 worker..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1 "$@"
