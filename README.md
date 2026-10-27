# Pontinho
> Aplicativo mobile-first para conexões, conversas, encontros e festas universitárias da UFABC, com fotos secretas, trilha sonora e swipes interativos.

---

## 🚀 Tecnologias Utilizadas

- **Backend**: Python 3.11+ com **FastAPI** e **Uvicorn** estruturado em roteadores modulares.
- **Banco de Dados**: **SQLite3** nativo com migrações automáticas e suporte a persistência em volume Docker.
- **Frontend**: HTML5 semântico, JavaScript moderno (ES6+) desacoplado e estilização com **Tailwind CSS**.
- **Player de Áudio**: Integração com YouTube IFrame API para reprodução de música de fundo em player oculto.
- **Processamento de Imagem & Segurança**: **Pillow** com desfoque Gaussiano destrutivo no servidor para o Álbum Secreto, otimização WebP e suporte a GIFs animados.
- **Moderação Inteligente**: **NudeNet** integrado para detecção e bloqueio de conteúdo inadequado.
- **Validação de Dados**: **Pydantic** para integridade de tipos e validação de regras de negócio.
- **Containers**: **Docker** e **Docker Compose** para orquestração e deploy simplificado.

---

## 📋 Funcionalidades Principais

### 1. Autenticação & Validação Institucional UFABC
- **Restrição de Domínio**: Cadastro exclusivo para e-mails acadêmicos `@aluno.ufabc.edu.br` e `@ufabc.edu.br`.
- **Sessão Criptográfica Assinada**: Tokens e cookies assinados com **HMAC-SHA256** prevenindo qualquer forjamento de identidade.
- **Atalhos Demo (1-Clique)**: Acesso instantâneo a perfis de teste e à conta de Administrador na tela de login.

### 2. Feed & Swipes
- **Deck de Cards Mobile-First**: Visualização de fotos em carrossel de tela cheia com toque intuitivo (estilo Stories/Tinder).
- **Barra Superior Otimizada**: Altura reduzida em 20% para maximizar a área útil dos cards de swipe em telas móveis.
- **Filtro de Gênero**: Filtragem dinâmica conforme a orientação de quem busca (*Mulheres*, *Homens*, *Todos*).
- **Publicidade Intercalada (Ads)**: Campanhas e anúncios cadastrados pelo Admin exibidos na frequência configurada.
- **Detecção de Match**: Notificação comemorativa ao ocorrer like bilateral com atalho direto para a conversa.

### 3. Festas & Eventos Universitários (`/events.html`)
- **Acesso Público**: As festas universitárias são abertas para qualquer pessoa visualizar na landing page e na aba de festas, aumentando a atratividade do app.
- **Proteção da Lista de Presença**: A lista de estudantes confirmados e a amostra de participantes são exibidas **exclusivamente para estudantes autenticados**, garantindo total privacidade e segurança contra raspagem de dados.
- **Confirmação de Presença (RSVP)**: Os estudantes autenticados marcam presença com um clique e veem quem vai à festa antes de ir.
- **Regra de Nomes**: Nomes de festas com limite estrito de **no máximo 25 caracteres** para perfeita legibilidade.
- **Gestão no Painel Admin**: Aba dedicada para cadastro, edição e exclusão de eventos com contador de caracteres.

### 4. Álbum Secreto & Teaser com Desfoque no Servidor
- **Fotos Públicas**: Mínimo de 2 fotos obrigatórias exibidas abertamente no feed.
- **Fotos e Bio Privadas**: Conteúdo reservado para quem você autorizar após o match.
- **Proteção Server-Side Destructive Blur**: A primeira foto privada é entregue como teaser no carrossel, porém **irreversivelmente borrada no servidor** (`backend/teaser.py`) antes de sair para o cliente. Hackers não conseguem extrair a foto original inspecionando o DOM ou requisições de rede.
- **Carrossel no Modal de Detalhes**: Ao abrir os detalhes do perfil, as imagens são exibidas em um carrossel de alto destaque em vez de grade compacta, com visualização completa e controles posicionados fora da imagem.

### 5. Música de Fundo (YouTube Background Player)
- Cada estudante pode cadastrar até 3 músicas preferidas no perfil.
- Ao abrir os detalhes do perfil, a trilha sonora toca automaticamente em segundo plano com player oculto.

### 6. Conversas, Chat & Moderação de Segurança
- Aba **Conversas** com lista de matches e indicador visual de mensagens não lidas.
- **Desfazer Match (Unmatch)**: Opção para desfazer matches a qualquer momento.
- **Denunciar e Bloquear**: Botão para bloquear usuários (com exclusão mútua do feed e conversas) e enviar denúncias com justificativa.
- **Central de Ajuda & Ouvidoria Pública**: Botão de Ajuda na barra superior com descrição institucional do app e formulário de denúncia aberto a qualquer pessoa (mesmo sem conta ou login) para casos de perfis fakes, stalking (perseguição), assédio ou uso indevido de fotos.
- **Painel de Moderação**: Área dedicada no Admin exibindo relatórios de usuários denunciados e ocorrências públicas da ouvidoria.

---

## 📁 Estrutura de Pastas do Projeto

```text
pontinho-ufabc/
├── README.md                 # Documentação oficial do projeto
├── pyproject.toml            # Configuração de dependências e metadados do Poetry
├── poetry.lock               # Lockfile determinístico de dependências do Poetry
├── docker-compose.yml        # Configuração de containers Docker
├── Dockerfile                # Imagem Docker otimizada com Poetry (Python slim)
├── docs/                     # 📁 Documentação técnica e auditorias
│   ├── API.md                # Manual completo e detalhado da API REST
│   └── SECURITY_AUDIT.md     # Relatório completo de auditoria de segurança e pentest
├── scripts/                  # 📁 Scripts de automação e inicialização
│   ├── entrypoint.sh         # Script de inicialização do container
│   └── serve_frontend.py     # Servidor frontend desacoplado com Live Reload (porta 3000)
├── backend/                  # 📁 Aplicação Python / FastAPI modular
│   ├── __init__.py
│   ├── auth.py               # Utilitários de sessão HMAC-SHA256 e validação de e-mail UFABC
│   ├── database.py           # Conexão SQLite3, esquemas e migrações automáticas
│   ├── main.py               # Configuração do FastAPI, CORS e montagem de roteadores
│   ├── models.py             # Modelos de validação de dados Pydantic
│   ├── moderation.py         # Moderação automática de imagens via NudeNet
│   ├── seed.py               # Semente com perfis de exemplo, festas, ads e entidades
│   ├── teaser.py             # Geração de teaser de foto secreta borrada no servidor
│   └── routers/              # Roteadores modulares da API REST
│       ├── __init__.py
│       ├── admin.py          # Gestão de métricas, denúncias, anúncios, cursos e entidades
│       ├── auth.py           # Rotas de login, registro, logout e sessão
│       ├── events.py         # Mural de festas, RSVP e gerenciamento de eventos
│       ├── feed.py           # Feed de descoberta, swipes e teaser do álbum secreto
│       ├── matches.py        # Matches, mensagens e fluxo de autorização do álbum secreto
│       ├── media.py          # Entrega protegida e autenticada de fotos do Álbum Secreto
│       ├── upload.py         # Upload seguro de fotos e GIFs animados com compressão
│       ├── users.py          # Perfil próprio, denúncias e bloqueios
│       └── help.py           # Central de ajuda, segurança e ouvidoria pública
└── frontend/                 # 📁 Interface estática mobile-first com Tailwind CSS
    ├── css/
    │   └── style.css         # Estilização visual, animações e responsividade
    ├── js/
    │   └── app.js            # Cliente da API, sessões, player de áudio e utilitários
    ├── index.html            # Feed principal de swipes e carrossel de fotos
    ├── events.html           # Aba de festas universitárias e confirmação de presença
    ├── matches.html          # Conversas, chat em tempo real e desbloqueio privado
    ├── profile.html          # Edição de perfil, fotos públicas/privadas e músicas
    ├── login.html            # Tela de login e cadastro com atalhos de demonstração
    └── admin.html            # Painel administrativo e moderação de denúncias
```

---

## 📡 Documentação dos Endpoints da API Backend (REST)

A documentação interativa Swagger está disponível em `http://localhost:8000/docs`.  
O manual completo com exemplos de payloads pode ser consultado em [docs/API.md](file:///Users/julian/Dev/pontinho-ufabc/docs/API.md) e o relatório de pentest em [docs/SECURITY_AUDIT.md](file:///Users/julian/Dev/pontinho-ufabc/docs/SECURITY_AUDIT.md).

### 1. Autenticação & Sessão (`/api/auth`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `POST` | `/api/auth/register` | Não | Cadastro de estudante (valida domínio `@aluno.ufabc.edu.br` / `@ufabc.edu.br`) |
| `POST` | `/api/auth/login` | Não | Login e emissão de token/cookie assinado criptograficamente |
| `POST` | `/api/auth/logout` | Não | Encerra a sessão e limpa os cookies |
| `GET` | `/api/auth/me` | Sim | Retorna dados da sessão do usuário autenticado |
| `GET` | `/api/auth/demo-accounts` | Não | Retorna contas disponíveis para login demonstrativo rápido |

### 2. Feed & Swipes (`/api/feed` & `/api/swipe`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/feed` | Sim | Feed de descoberta com filtro de gênero, ads intercalados e teaser de foto secreta borrada no servidor (`secret_teaser_photo`) |
| `POST` | `/api/swipe` | Sim | Registra like ou pass (`{"to_user_id": int, "action": "like"|"pass"}`). Detecta match bilateral |

### 3. Festas & Eventos Universitários (`/api/events`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/events` | Opcional | Lista todas as festas ordenadas por data com contagem de confirmados |
| `GET` | `/api/events/{id}` | Opcional | Detalhes da festa e lista completa de estudantes que confirmaram presença |
| `POST` | `/api/events/{id}/rsvp` | Sim | Confirma ou desmarca presença na festa (`{"status": "going"|"not_going"}`) |
| `POST` | `/api/events` | Admin | Cadastra nova festa (**título limitado a 25 caracteres**) |
| `PUT` | `/api/events/{id}` | Admin | Atualiza dados da festa (**título limitado a 25 caracteres**) |
| `DELETE` | `/api/events/{id}` | Admin | Exclui festa e registros de presença em cascata |

### 4. Matches, Conversas & Álbum Secreto (`/api/matches`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/matches` | Sim | Lista de conversas ativas com badges de mensagens não lidas |
| `GET` | `/api/matches/{partner_id}/messages` | Sim | Histórico de chat e status de desbloqueio do álbum secreto |
| `POST` | `/api/matches/{partner_id}/messages` | Sim | Envia mensagem no chat (`{"content": str}`) |
| `POST` | `/api/matches/{partner_id}/private-access/request` | Sim | Solicita autorização para ver o álbum secreto do parceiro |
| `POST` | `/api/matches/{partner_id}/private-access/respond` | Sim | Aprova ou recusa acesso ao álbum secreto (`{"action": "approve"|"reject"}`) |
| `POST` | `/api/matches/{partner_id}/unmatch` | Sim | Desfaz match e remove a conversa |

### 5. Usuários, Perfil & Segurança (`/api/users`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/users/me` | Sim | Perfil completo do próprio estudante logado |
| `PUT` | `/api/users/me` | Sim | Atualiza dados cadastrais, fotos e músicas (gera teaser borrado da foto secreta) |
| `GET` | `/api/users/{id}` | Sim | Visualiza perfil de outro estudante (oculta álbum secreto se não autorizado) |
| `POST` | `/api/users/report` | Sim | Denuncia perfil por comportamento impróprio (`{"reported_id": int, "reason": str, "details": str}`) |
| `POST` | `/api/users/block` | Sim | Bloqueia usuário permanentemente (exclusão mútua do feed e conversas) |

### 6. Upload Seguro & Multimídia (`/api/upload`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `POST` | `/api/upload/photo` | Sim | Upload seguro de fotos e **GIFs animados** via multipart/form-data com downscale, remoção de EXIF, compressão WebP e moderação NudeNet |

### 7. Painel Administrativo & Moderação (`/api/admin`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Admin | Métricas gerais (usuários, swipes, matches, mensagens, festas, denúncias) |
| `GET` | `/api/admin/reports` | Admin | Lista consolidada de perfis denunciados, número de denúncias e denunciantes |
| `GET` | `/api/admin/users` | Admin | Lista completa de usuários para consulta e moderação |
| `DELETE` | `/api/admin/users/{id}` | Admin | Exclusão de conta em cascata total |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/admin/ads` | Admin | Gerenciamento de campanhas publicitárias intercaladas no feed |
| `GET` / `POST` / `DELETE` | `/api/admin/courses` | Admin | Gerenciamento da lista de cursos da UFABC |
| `GET` / `POST` / `DELETE` | `/api/admin/entities` | Admin | Gerenciamento de entidades e atléticas universitárias |
| `GET` / `POST` / `DELETE` | `/api/admin/prompts` | Admin | Gerenciamento de perguntas de quebra-gelo dos perfis |

---

## 💻 Como Executar o Projeto

### 🐳 Via Docker Compose (Recomendado — Comando Único)

Com apenas **um comando**, o Docker inicializa o banco SQLite, executa o seed dos dados e sobe tanto o **Backend (FastAPI)** quanto o **Frontend (Live Reload)** com sincronização em tempo real dos seus arquivos locais:

1. **Subir a aplicação completa**:
   ```bash
   docker compose up --build
   ```
   *(Ou adicione `-d` para rodar em segundo plano: `docker compose up --build -d`)*

2. **Acompanhar os logs (se rodando em segundo plano)**:
   ```bash
   docker compose logs -f
   ```

3. **Parar a aplicação**:
   ```bash
   docker compose down
   ```

---

### 🐍 Localmente (Sem Docker)

Se preferir rodar os serviços individualmente na sua máquina:

1. **Configurar variáveis de ambiente**:
   ```bash
   cp .env.example .env
   ```

2. **Backend (API)**:
   ```bash
   poetry install
   poetry run python -m backend.seed
   poetry run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Frontend (Live Reload)**:
   ```bash
   python3 scripts/serve_frontend.py --port 3000
   ```

---

## 🌐 URLs de Acesso

- **Frontend Preact (SPA + Vite HMR)**: [http://localhost:3001](http://localhost:3001)
- **Frontend Clássico (Live Reload)**: [http://localhost:3000](http://localhost:3000)
  - **Feed Principal (Swipes)**: [http://localhost:3000](http://localhost:3000)
  - **Festas & Eventos**: [http://localhost:3000/events.html](http://localhost:3000/events.html)
  - **Conversas & Matches**: [http://localhost:3000/matches.html](http://localhost:3000/matches.html)
  - **Meu Perfil**: [http://localhost:3000/profile.html](http://localhost:3000/profile.html)
  - **Login & Cadastro**: [http://localhost:3000/login.html](http://localhost:3000/login.html)
  - **Painel Administrativo**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

