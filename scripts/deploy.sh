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

MAX_ATTEMPTS=20
ATTEMPT=1
until curl -fsS http://127.0.0.1:8000/ > /dev/null; do
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "API indisponivel apos ${MAX_ATTEMPTS} tentativas."
    sudo docker compose -f docker-compose.prod.yml logs --tail=100 backend
    exit 1
  fi

  echo "API ainda indisponivel (tentativa ${ATTEMPT}/${MAX_ATTEMPTS}); aguardando..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep 3
done

echo "Deploy concluido com sucesso!"
