# Imagem base Python slim oficial (leve e segura)
FROM python:3.11-slim

# Evita arquivos .pyc e garante logs em tempo real
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DATABASE_PATH=/app/data/pontinho.db

# Diretório de trabalho dentro do container
WORKDIR /app

# Instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia pastas do backend, frontend e script de inicialização
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY entrypoint.sh .

# Cria o diretório para persistência do SQLite via volume
RUN mkdir -p /app/data && chmod +x /app/entrypoint.sh

# Porta exposta pelo FastAPI
EXPOSE 8000

# Healthcheck nativo em Python (sem precisar instalar curl)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/metadata')" || exit 1

# Ponto de entrada que inicializa o banco e sobe o servidor
ENTRYPOINT ["/app/entrypoint.sh"]
