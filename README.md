# Pontinho
> Aplicativo mobile-first para conexões, conversas, encontros e festas universitárias da UFABC, com fotos secretas, trilha sonora e swipes interativos.

---

## 🚀 Tecnologias Utilizadas

- **Backend**: Python 3.13 com **FastAPI** e **Uvicorn** estruturado em roteadores modulares assíncronos.
- **Banco de Dados**: **SQLite3** nativo com migrações automáticas e suporte a persistência em volume Docker.
- **Frontend**: Single Page Application (SPA) em **Preact** com **Vite**, componentes reativos, ícones **Lucide** e estilização via **Tailwind CSS**.
- **Processamento de Mídia Client-Side**: Otimização e compressão para **WebP** via HTML5 Canvas (limpeza total de EXIF/GPS) e conversão de vídeos curtos em **GIF animado** via `gifenc` diretamente no navegador do usuário, poupando CPU/RAM do servidor.
- **Processamento de Imagem & Segurança no Servidor**: **Pillow** com desfoque Gaussiano destrutivo no servidor para teasers do Álbum Secreto e validação estrita anti-Image Bomb (suporte exclusivo a `WEBP` e `GIF`).
- **Player de Áudio**: Integração com YouTube IFrame API para reprodução de música de fundo em player oculto.
- **Moderação Inteligente**: **NudeNet** integrado para detecção e bloqueio de conteúdo inadequado.
- **Validação Facial & Biometria**: Detecção e verificação contínua de descritores faciais via `@vladmandic/face-api` no frontend com validação euclidiana estrita no backend.
- **Validação de Dados**: **Pydantic** para integridade de tipos e validação de regras de negócio.
- **Containers**: **Docker** e **Docker Compose** (`docker-compose.yml` para desenvolvimento e `docker-compose.prod.yml` para produção).
- **CI/CD & Deploy**: Pipeline automatizado no **GitHub Actions** com testes unitários em **Pytest** (Python 3.13) e **Vitest** (Preact), deploy contínuo via SSH nativo em VPS Oracle Linux e distribuição estática via **Cloudflare**.
- **Licenciamento**: Código aberto sob a licença **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.

---

## 📋 Funcionalidades Principais

### 1. Autenticação & Validação Institucional UFABC
- **Restrição de Domínio**: Cadastro exclusivo para e-mails acadêmicos `@aluno.ufabc.edu.br` e `@ufabc.edu.br`.
- **Sessão Criptográfica Assinada**: Tokens e cookies assinados com **HMAC-SHA256** prevenindo qualquer forjamento de identidade.
- **Validação Biométrica ECA Digital**: Validação facial on-device com prova de vida anti-fraude e estimativa de idade $\ge 18$ anos (`@vladmandic/face-api`).
- **Atalhos Demo (1-Clique)**: Acesso instantâneo a perfis de teste e à conta de Administrador na tela de login (disponível em modo de desenvolvimento).

### 2. Feed & Swipes
- **Deck de Cards Mobile-First**: Visualização de fotos em carrossel de tela cheia com toque intuitivo (estilo Stories/Tinder).
- **Barra Superior Otimizada**: Altura reduzida em 20% para maximizar a área útil dos cards de swipe em telas móveis.
- **Filtro de Gênero**: Filtragem dinâmica conforme a orientação de quem busca (*Mulheres*, *Homens*, *Todos*).
- **Publicidade Intercalada (Ads)**: Campanhas e anúncios cadastrados pelo Admin exibidos na frequência configurada.
- **Detecção de Match**: Notificação comemorativa ao ocorrer like bilateral com atalho direto para a conversa.

### 3. Festas & Eventos Universitários (`/events`)
- **Acesso Público**: As festas universitárias são abertas para qualquer pessoa visualizar na landing page e na aba de festas, aumentando a atratividade do app.
- **Proteção da Lista de Presença**: A lista de estudantes confirmados e a amostra de participantes são exibidas **exclusivamente para estudantes autenticados**, garantindo total privacidade e segurança contra raspagem de dados.
- **Confirmação de Presença (RSVP)**: Os estudantes autenticados marcam presença com um clique e veem quem vai à festa antes de ir.
- **Regra de Nomes**: Nomes de festas com limite estrito de **no máximo 25 caracteres** para perfeita legibilidade.
- **Gestão Facilitada e Banners em WebP/GIF**: Criação de eventos com upload direto pré-processado no front-end tanto na página de Eventos quanto no Painel Admin.

### 4. Álbum Secreto & Teaser com Desfoque no Servidor
- **Fotos Públicas**: Mínimo de 2 fotos obrigatórias exibidas abertamente no feed.
- **Fotos e Bio Privadas**: Conteúdo reservado para quem você autorizar após o match.
- **Proteção Server-Side Destructive Blur**: A primeira foto privada é entregue como teaser no carrossel, porém **irreversivelmente borrada no servidor** (`backend/teaser.py`) antes de sair para o cliente. Hackers não conseguem extrair a foto original inspecionando o DOM ou requisições de rede.
- **Carrossel no Modal de Detalhes**: Ao abrir os detalhes do perfil, as imagens são exibidas em um carrossel de alto destaque em vez de grade compacta, com visualização completa e controles posicionados fora da imagem.

### 5. Processamento Client-Side Universal de Mídias
- **Conversão Automática para WebP**: Todas as fotos de perfil, fotos da bio secreta, banners de eventos e propagandas são redimensionadas e convertidas para WebP no navegador, removendo dados sensíveis de localização GPS/EXIF.
- **Vídeos Curtos para GIF**: Vídeos de até 10 segundos e 40MB são convertidos em GIF animado otimizado direto no navegador através do `gifenc`, sem sobrecarregar a CPU do servidor.
- **Backend Enxuto**: A API aceita estritamente imagens já em `WEBP` ou `GIF`, blindando o servidor contra Image Bombs e ataques de exaustão de recursos.

### 6. Sistema Multi-Tema Dark
- **Verde UFABC (`ufabc`)**: Identidade visual institucional clássica com tons esmeralda e estética dark premium.
- **Pride Dark (`pride`)**: Cores vibrantes do orgulho LGBTQIA+ com gradientes elegantes e alto contraste.
- **Noite de Halloween (`halloween`)**: Tema com tons de laranja abóbora, roxo místico e destaques fantasmagóricos mantendo o modo escuro.
- **Persistência**: Escolha de tema salva no navegador e aplicada instantaneamente a todos os modais, botões e barras de navegação.

### 7. Proteção contra Perda de Edição no Perfil
- **Detecção de Alterações Pendentes**: Modal personalizado adaptado ao tema atual alerta o estudante caso tente navegar para outra página sem salvar fotos, bio, prompts ou músicas alteradas, permitindo salvar ou descartar com um clique.

### 8. Música de Fundo (YouTube Background Player)
- Cada estudante pode cadastrar até 3 músicas preferidas no perfil.
- Ao abrir os detalhes do perfil, a trilha sonora toca automaticamente em segundo plano com player oculto.

### 9. Conversas, Chat & Moderação de Segurança
- Aba **Conversas** com lista de matches e indicador visual de mensagens não lidas.
- **Desfazer Match (Unmatch)**: Opção para desfazer matches a qualquer momento.
- **Denunciar e Bloquear**: Botão para bloquear usuários (com exclusão mútua do feed e conversas) e enviar denúncias com justificativa.
- **Central de Ajuda & Ouvidoria Pública**: Botão de Ajuda na barra superior com descrição institucional do app e formulário de denúncia aberto a qualquer pessoa (mesmo sem conta ou login) para casos de perfis fakes, stalking (perseguição), assédio ou uso indevido de fotos.
- **Painel de Moderação**: Área dedicada no Admin com abas organizadas para Denúncias, Gestão de Anúncios (Propagandas) e Festas Universitárias.

---

## 📁 Estrutura de Pastas do Projeto

```text
pontinho-ufabc/
├── README.md                 # Documentação oficial do projeto
├── LICENSE.md                # Licença de código aberto CC BY-NC-SA 4.0
├── pyproject.toml            # Configuração de dependências e metadados do Poetry
├── poetry.lock               # Lockfile determinístico de dependências do Poetry
├── docker-compose.yml        # Configuração de containers Docker (desenvolvimento)
├── docker-compose.prod.yml   # Configuração de containers Docker (produção VPS)
├── Dockerfile                # Imagem Docker otimizada com Poetry (Python 3.13 slim)
├── docs/                     # 📁 Documentação técnica e auditorias
│   ├── API.md                # Manual completo e detalhado da API REST
│   └── SECURITY_AUDIT.md     # Relatório completo de auditoria de segurança e pentest
├── scripts/                  # 📁 Scripts de automação e inicialização
│   ├── deploy.sh             # Script de deploy e atualização contínua em produção
│   ├── entrypoint.sh         # Script de inicialização do container backend
│   └── promote_admin.py      # Utilitário CLI para promoção de administradores
├── backend/                  # 📁 Aplicação Python / FastAPI modular
│   ├── __init__.py
│   ├── auth.py               # Utilitários de sessão HMAC-SHA256 e validação de e-mail UFABC
│   ├── database.py           # Conexão SQLite3, esquemas e migrações automáticas
│   ├── main.py               # Configuração do FastAPI, CORS dinâmico e roteadores
│   ├── models.py             # Modelos de validação de dados Pydantic
│   ├── moderation.py         # Moderação automática de imagens via NudeNet
│   ├── seed.py               # Semente com perfis de exemplo, festas, ads e entidades
│   ├── teaser.py             # Geração de teaser de foto secreta borrada no servidor
│   ├── tests/                # Testes automatizados da API com Pytest
│   └── routers/              # Roteadores modulares da API REST
│       ├── admin.py          # Gestão de métricas, denúncias, anúncios, cursos e eventos
│       ├── auth.py           # Rotas de login, registro, logout e sessão
│       ├── events.py         # Mural de festas, RSVP e gerenciamento de eventos
│       ├── feed.py           # Feed de descoberta, swipes e teaser do álbum secreto
│       ├── matches.py        # Matches, mensagens e fluxo de autorização do álbum secreto
│       ├── media.py          # Entrega protegida e autenticada de fotos do Álbum Secreto
│       ├── upload.py         # Upload seguro aceitando WebP e GIF (limite 40MB)
│       ├── users.py          # Perfil próprio, verificação facial contínua, denúncias e bloqueios
│       └── help.py           # Central de ajuda, segurança e ouvidoria pública
└── frontend/                 # 📁 Single Page Application (Preact + Vite + Tailwind CSS)
    ├── package.json          # Dependências do frontend (Preact, Vitest, gifenc, Lucide)
    ├── vite.config.js        # Configuração do Vite (porta 3000, proxies e aliases)
    ├── index.html            # Ponto de entrada HTML da aplicação
    └── src/
        ├── main.jsx          # Bootstrap da aplicação Preact
        ├── app.jsx           # Roteamento SPA e contexto global de autenticação
        ├── style.css         # Estilização visual, animações e paletas de temas dark
        ├── pages/            # Páginas da SPA (Feed, Eventos, Matches, Perfil, Login, Admin, Termos)
        ├── components/       # Componentes reativos (Navbar, AmbientBackground, Modais, Toasts)
        ├── services/         # Utilitários (API client, conversão WebP/GIF, temas)
        └── test/             # Testes automatizados de componentes e serviços (Vitest)
```

---

## 📡 Documentação dos Endpoints da API Backend (REST)

A documentação interativa Swagger está disponível em `http://localhost:8000/docs`.  
O manual completo com exemplos de payloads pode ser consultado em [docs/API.md](file:///Users/julian/Dev/pontinho-ufabc/docs/API.md) e o relatório de pentest em [docs/SECURITY_AUDIT.md](file:///Users/julian/Dev/pontinho-ufabc/docs/SECURITY_AUDIT.md).

### 1. Autenticação & Sessão (`/api/auth`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `POST` | `/api/auth/register` | Não | Cadastro de estudante (valida domínio `@aluno.ufabc.edu.br` / `@ufabc.edu.br` e biometria facial ECA) |
| `POST` | `/api/auth/login` | Não | Login e emissão de token/cookie assinado criptograficamente (Argon2id + rate limit) |
| `POST` | `/api/auth/logout` | Não | Encerra a sessão e limpa os cookies |
| `GET` | `/api/auth/me` | Sim | Retorna dados da sessão do usuário autenticado |
| `GET` | `/api/auth/demo-accounts` | Não | Retorna contas disponíveis para login rápido (somente em modo de desenvolvimento) |

### 2. Feed & Swipes (`/api/feed` & `/api/swipe`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/feed` | Sim | Feed de descoberta com filtro de gênero, ads intercalados e teaser de foto secreta borrada no servidor (`secret_teaser_photo`) |
| `POST` | `/api/swipe` | Sim | Registra like ou pass (`{"to_user_id": int, "action": "like"|"pass"}`). Detecta match bilateral |
| `POST` | `/api/feed/reset` | Sim | Reseta o histórico de swipes do próprio estudante autenticado |
| `GET` | `/api/youtube/search` | Sim | Busca segura de faixas de áudio no YouTube com rate limit estrito |

### 3. Festas & Eventos Universitários (`/api/events`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/events` | Opcional | Lista todas as festas ordenadas por data com contagem de confirmados |
| `GET` | `/api/events/{id}` | Opcional | Detalhes da festa e lista completa de estudantes que confirmaram presença |
| `POST` | `/api/events/{id}/rsvp` | Sim | Confirma ou desmarca presença na festa (`{"status": "going"|"not_going"}`) |
| `POST` | `/api/events` | Admin | Cadastra nova festa com banner WebP/GIF (**título limitado a 25 caracteres**) |
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
| `POST` | `/api/users/me/verify-face` | Sim | Confirma identidade via descritores faciais e concede selo de verificado |
| `GET` | `/api/users/{id}` | Sim | Visualiza perfil de outro estudante (oculta álbum secreto se não autorizado) |
| `POST` | `/api/users/report` | Sim | Denuncia perfil por comportamento impróprio (`{"reported_id": int, "reason": str, "details": str}`) |
| `POST` | `/api/users/block` | Sim | Bloqueia usuário permanentemente (exclusão mútua do feed e conversas) |
| `GET` | `/api/users/me/export` | Sim | Exporta dados completos do titular em conformidade com o Art. 18 da LGPD |
| `DELETE` | `/api/users/me` | Sim | Exclui permanentemente a conta e dados associados em cascata (Direito à Eliminação - LGPD) |

### 6. Upload Seguro & Multimídia (`/api/upload`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `POST` | `/api/upload/photo` | Sim | Upload seguro de mídias pré-processadas no frontend (WebP e GIFs animados até 40MB). Aplica validação anti-Image Bomb, remoção de metadados EXIF e moderação NudeNet |

### 7. Painel Administrativo & Moderação (`/api/admin`)
| Método | Endpoint | Autenticado? | Descrição |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Admin | Métricas gerais (usuários, swipes, matches, mensagens, festas, denúncias) |
| `GET` | `/api/admin/reports` | Admin | Lista consolidada de perfis denunciados, número de denúncias e ocorrências públicas |
| `GET` | `/api/admin/users` | Admin | Lista completa de usuários para consulta e moderação |
| `DELETE` | `/api/admin/users/{id}` | Admin | Exclusão de conta em cascata total |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/admin/ads` | Admin | Gerenciamento de campanhas publicitárias com upload de banners WebP/GIF |
| `GET` / `POST` / `DELETE` | `/api/admin/courses` | Admin | Gerenciamento da lista de cursos da UFABC |
| `GET` / `POST` / `DELETE` | `/api/admin/entities` | Admin | Gerenciamento de entidades e atléticas universitárias |
| `GET` / `POST` / `DELETE` | `/api/admin/prompts` | Admin | Gerenciamento de perguntas de quebra-gelo dos perfis |

---

## 💻 Como Executar o Projeto

### 🐳 Via Docker Compose (Recomendado — Comando Único)

Com apenas **um comando**, o Docker inicializa o banco SQLite, executa o seed dos dados e sobe tanto o **Backend (FastAPI)** quanto o **Frontend Preact (Vite Live Reload)**:

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

3. **Frontend (Vite / Preact SPA)**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🧪 Testes Automatizados

O projeto conta com suíte completa de testes automatizados integrada ao CI/CD:

- **Backend (Python / Pytest)**:
  ```bash
  poetry run pytest backend/tests/test_api.py -v
  ```
- **Frontend (Preact / Vitest)**:
  ```bash
  npm --prefix frontend test -- --run
  ```

---

## 🌐 URLs de Acesso

- **Frontend Preact (SPA + Vite HMR)**: [http://localhost:3000](http://localhost:3000)
  - **Feed Principal (Swipes)**: [http://localhost:3000/](http://localhost:3000/)
  - **Festas & Eventos**: [http://localhost:3000/events](http://localhost:3000/events)
  - **Conversas & Matches**: [http://localhost:3000/matches](http://localhost:3000/matches)
  - **Meu Perfil**: [http://localhost:3000/profile](http://localhost:3000/profile)
  - **Login & Cadastro**: [http://localhost:3000/login](http://localhost:3000/login)
  - **Painel Administrativo**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

