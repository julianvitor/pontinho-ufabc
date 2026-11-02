# Pontinho UFABC

> Aplicativo mobile-first para conexões, matches e eventos da comunidade acadêmica da UFABC.

---

## 🚀 Tecnologias

- **Backend**: Python 3.13, [FastAPI](https://fastapi.tiangolo.com/), Uvicorn, Pydantic, Argon2id.
- **Banco de Dados**: SQLite3 com migrações automáticas e suporte a volume persistente.
- **Frontend**: [Preact](https://preactjs.com/) + [Vite](https://vitejs.dev/), Tailwind CSS, `gifenc`.
- **Mídia & Moderação**: Compressão client-side (WebP e GIF animado), desfoque destrutivo de teasers no servidor (Pillow) e moderação de conteúdo com [NudeNet](https://github.com/notAI-tech/NudeNet).
- **Segurança**: Sessões assinadas com HMAC-SHA256, restrição de e-mail institucional e verificação biométrica facial on-device.
- **DevOps**: Docker, Docker Compose e CI/CD via GitHub Actions.

---

## 📋 Funcionalidades

- **Autenticação Institucional**: Acesso restrito a e-mails `@aluno.ufabc.edu.br` e `@ufabc.edu.br`.
- **Feed & Swipes**: Descoberta com filtros de interesse, cards de fotos e detecção bilateral de matches.
- **Álbum Secreto**: Fotos privadas com entrega de teaser irreversivelmente borrado pelo servidor (`destructive blur`); liberação sob consentimento mútuo no chat.
- **Mural de Festas & Eventos (`/events`)**: Divulgação pública de eventos universitários com confirmação de presença (RSVP) restrita a alunos autenticados.
- **Música no Perfil**: Integração com YouTube IFrame Player em segundo plano.
- **Chat & Moderação**: Mensagens diretas entre matches, bloqueio mútuo, denúncias e ouvidoria anônima.
- **Temas**: Suporte a temas dark com persistência local (`ufabc`, `pride`, `halloween`).
- **Painel Administrativo**: Métricas da plataforma, aprovação/remoção de eventos, anúncios, denúncias e usuários.

---

## 📁 Estrutura do Repositório

```text
pontinho-ufabc/
├── backend/                  # API REST FastAPI
│   ├── routers/              # Endpoints modulares (auth, feed, events, matches, etc.)
│   ├── tests/                # Testes automatizados com Pytest
│   ├── auth.py               # Sessões HMAC, hash Argon2 e validações
│   ├── database.py           # Conexão SQLite e esquema
│   ├── moderation.py         # Moderação de imagens (NudeNet)
│   ├── seed.py               # População inicial de dados
│   └── teaser.py             # Processamento de blur seguro para fotos privadas
├── frontend/                 # SPA em Preact + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis (Navbars, Modais, Toasts)
│   │   ├── pages/            # Páginas (Feed, Events, Matches, Profile, Admin, Login)
│   │   └── services/         # Clientes de API, conversão WebP/GIF e temas
│   └── package.json
├── docs/                     # Documentação técnica
│   ├── API.md                # Especificação detalhada dos endpoints
│   └── SECURITY_AUDIT.md     # Relatório de auditoria de segurança
├── scripts/                  # Scripts operacionais (deploy, seed, promote_admin)
├── docker-compose.yml        # Orquestração para desenvolvimento local
├── Dockerfile                # Imagem Docker do backend
└── pyproject.toml            # Dependências Python gerenciadas pelo Poetry
```

---

## 💻 Como Executar

### 1. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo na raiz do projeto:

```bash
cp .env.example .env
```

---

### 🐳 Via Docker Compose (Recomendado)

Sobe o Backend (`:8000`) e o Frontend com Live Reload (`:3000`) em um único comando:

```bash
# Iniciar os serviços
docker compose up --build

# Parar os serviços
docker compose down
```

---

### 🐍 Execução Local (Sem Docker)

#### Pré-requisitos
- Python 3.11+ e [Poetry](https://python-poetry.org/)
- Node.js 18+ e npm

#### 1. Backend
```bash
# Instalar dependências
poetry install

# Popular banco inicial
poetry run python -m backend.seed

# Iniciar servidor
poetry run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 URLs de Acesso

| Serviço | URL | Descrição |
|---|---|---|
| **Frontend** | [http://localhost:3000](http://localhost:3000) | Aplicação web principal |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | Endpoint raiz da API |
| **Swagger UI** | [http://localhost:8000/docs](http://localhost:8000/docs) | Documentação interativa da API |

> **Rotas Rápidas da SPA:**  
> - `/` — Feed & Swipes  
> - `/events` — Mural de Festas & Eventos  
> - `/matches` — Conversas & Álbum Secreto  
> - `/profile` — Edição de Perfil  
> - `/admin` — Painel Administrativo  

---

## 📡 Visão Geral dos Endpoints

A documentação interativa e completa com modelos de payload pode ser testada em `/docs` ou consultada em [docs/API.md](docs/API.md).

| Módulo | Prefixo | Descrição |
|---|---|---|
| **Auth** | `/api/auth` | Registro, login, logout, sessão e contas de demonstração |
| **Feed** | `/api/feed` & `/api/swipe` | Carregamento de cards, swipes, reset e busca de trilha sonora |
| **Eventos** | `/api/events` | Listagem, detalhes, RSVP e gestão de festas |
| **Matches** | `/api/matches` | Lista de matches, histórico de chat e acesso ao álbum secreto |
| **Usuários** | `/api/users` | Perfil próprio, verificação facial, denúncias e bloqueios |
| **Upload** | `/api/upload` | Envio de mídias (WebP/GIF) com filtro anti-bomb e moderação |
| **Admin** | `/api/admin` | Estatísticas, anúncios, denúncias, cursos e entidades |
| **Ajuda** | `/api/help` | Ouvidoria anônima e suporte |

---

## 🧪 Testes Automatizados

```bash
# Testes do Backend (Pytest)
poetry run pytest backend/tests/test_api.py -v

# Testes do Frontend (Vitest)
npm --prefix frontend test
```

---

## 🛠️ Utilitários

### Promover Administrador via CLI
```bash
# Local
python3 scripts/promote_admin.py usuario@aluno.ufabc.edu.br

# Via Docker
docker compose exec backend python3 scripts/promote_admin.py usuario@aluno.ufabc.edu.br
```

---

## 📄 Licença

Distribuído sob a licença **Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 Internacional (CC BY-NC-SA 4.0)**. Consulte [LICENSE.md](LICENSE.md) para detalhes.
