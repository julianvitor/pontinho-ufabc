#!/usr/bin/env bash
set -e

echo "[1/4] Atualizando repositorio..."
cd /home/ubuntu/pontinho-backend
git fetch origin
git reset --hard origin/dev

echo "[2/4] Atualizando container Docker..."
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "[3/4] Limpando imagens antigas..."
sudo docker image prune -f

echo "[4/4] Verificando saude da API local..."
sleep 3
curl -fsS http://127.0.0.1:8000/ > /dev/null

echo "Deploy concluido com sucesso!"
