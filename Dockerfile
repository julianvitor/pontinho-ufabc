# Imagem base Python slim oficial (versão mais recente estável: 3.13)
FROM python:3.13-slim

# Evita arquivos .pyc, garante logs imediatos e otimiza alocação de RAM
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DATABASE_PATH=/app/data/pontinho.db \
    MALLOC_TRIM_THRESHOLD_=100000 \
    PYTHONMALLOC=malloc \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

# Diretório de trabalho dentro do container
WORKDIR /app

# Instala ffmpeg para processamento e conversão segura de vídeos curtos em GIF
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Instala o Poetry e configura para não criar virtualenv isolado dentro do container
RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false

# Instala dependências Python via Poetry
COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-root --no-interaction --no-ansi

# Copia pastas do backend e scripts
COPY backend/ ./backend/
COPY scripts/ ./scripts/

# Cria o diretório para persistência do SQLite via volume e dá permissão ao entrypoint
RUN mkdir -p /app/data && chmod +x /app/scripts/entrypoint.sh

# Porta exposta pelo FastAPI
EXPOSE 8000

# Healthcheck nativo em Python (sem precisar instalar curl)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/metadata')" || exit 1

# Ponto de entrada que inicializa o banco e sobe o servidor
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
