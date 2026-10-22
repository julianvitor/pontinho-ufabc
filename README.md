# Pontinho
> Aplicativo mobile-first para conexões, conversas e encontros, com fotos secretas, trilha sonora e swipes interativos.

---

## 🚀 Tecnologias Utilizadas

- **Backend**: Python 3 com **FastAPI** e **Uvicorn** estruturado em roteadores modulares.
- **Banco de Dados**: **SQLite3** nativo com migrações automáticas e suporte a persistência em volume Docker.
- **Frontend**: HTML5 semântico, JavaScript moderno (ES6+) e estilização com **Tailwind CSS**.
- **Player de Áudio**: Integração com YouTube IFrame API para reprodução de música de fundo com player oculto.
- **Validação de Dados**: **Pydantic** para integridade de tipos e validação de regras de negócio.
- **Containers**: **Docker** e **Docker Compose** para orquestração e deploy simplificado.

---

## 📋 Funcionalidades Principais

### 1. Autenticação & Demonstração Rápida
- **Cadastro e Login**: Criação de conta com validação de e-mail e senha com hash seguro.
- **Sessão Persistente**: Gerenciada via cookies HTTP e cabeçalhos de autenticação.
- **Atalhos Demo (1-Clique)**: Acesso instantâneo a 8 perfis de demonstração e à conta de Administrador na tela de login.
- **Modo Estático / Offline**: O frontend possui suporte autônomo com mock local (`localStorage`), permitindo demonstrações estáticas em serviços como GitHub Pages ou Vercel.

### 2. Feed & Swipes
- **Deck de Cards Mobile-First**: Visualização de fotos em tela cheia com toque intuitivo (estilo Stories/Tinder).
- **Informações do Perfil**: Nome, idade, campus, curso, o que procura, interesses e perguntinhas quebra-gelo.
- **Filtro de Gênero**: Filtragem dinâmica conforme a orientação de quem busca (*Mulheres*, *Homens*, *Todos*).
- **Publicidade Intercalada (Ads)**: Anúncios e eventos exibidos entre os cards do feed com frequência configurável.
- **Detecção de Match**: Notificação comemorativa ao ocorrer like bilateral com atalho direto para a conversa.

### 3. Música de Fundo (YouTube Background Player)
- Cada usuário pode configurar até 3 músicas preferidas no perfil.
- Ao abrir os detalhes do perfil de outro usuário, a trilha sonora toca automaticamente em segundo plano.
- O vídeo do YouTube permanece oculto, mantendo a experiência focada apenas no áudio.

### 4. Fotos Públicas vs. Fotos e Bio Privadas (Álbum Secreto)
- **Fotos Públicas**: Mínimo de 2 fotos obrigatórias visíveis no feed para todos os usuários.
- **Fotos e Bio Privadas**: Conteúdo reservado com tom mais ousado e exclusivo.
- **Fluxo de Autorização**:
  1. Apenas usuários com **match mútuo** podem solicitar acesso às fotos privadas.
  2. O proprietário do perfil visualiza a solicitação no chat e pode **autorizar** ou **recusar**.
  3. Uma vez autorizado, o álbum secreto e a bio privada ficam desbloqueados para o parceiro.

### 5. Conversas & Chat em Tempo Real
- Aba **Conversas** com lista de matches ativos.
- Chat em tempo real com mensagens de texto e status das solicitações de acesso privado.

### 6. Painel Administrativo (`/admin.html`)
- **Moderação de Usuários**: Consulta e remoção de contas com exclusão em cascata.
- **Gestão de Cursos e Entidades**: Cadastro e controle de cursos e associações.
- **Perguntas de Quebra-Gelo**: Customização das perguntas exibidas nos perfis.
- **Campanhas de Publicidade**: Criação de anúncios com imagem, descrição, link e frequência de exibição.

---

## 👥 Perfis de Exemplo Disponíveis

A base já vem pré-configurada com 8 perfis completos de demonstração (fotos públicas e privadas, trilha sonora e bio personalizada):

1. **Mariana Silva** (21 anos, Neurociência) - Vôlei, indie e café; match inicial pré-configurado com Gabriel.
2. **Lucas Mendes** (22 anos, Relações Internacionais) - Cinema cult, carona noturna e papo direto.
3. **Bia Costa** (20 anos, Engenharia Aeroespacial) - Astronomia, sci-fi e Taylor Swift.
4. **Gabriel Santos** (23 anos, Ciência da Computação) - Programador e ritmista de bateria universitária.
5. **Camila Rocha** (21 anos, Ciências Econômicas) - Trilhas, sustentabilidade e yoga.
6. **Rodrigo Alves** (24 anos, Engenharia de Gestão) - Treino pesado, música eletrônica e viagens.
7. **Isabela Martins** (22 anos, Biotecnologia) - Festivais, fotografia e vinho tinto.
8. **Felipe Ramos** (23 anos, Ciências Econômicas) - Hip-hop, basquete de rua e debates.
9. **Administrador** (28 anos, Gestão & Moderação) - Acesso ao painel administrativo.

---

## 📁 Estrutura de Pastas do Projeto

```text
pontinho-ufabc/
├── backend/                  # Aplicação Python / FastAPI modular
│   ├── __init__.py
│   ├── auth.py               # Utilitários de autenticação e validação de e-mail
│   ├── database.py           # Conexão SQLite3, esquemas e migrações automáticas
│   ├── models.py             # Modelos de validação de dados Pydantic
│   ├── main.py               # Configuração do FastAPI e montagem das rotas
│   ├── seed.py               # Semente com os 8 perfis de exemplo, ads e entidades
│   └── routers/              # Rotas modulares da API
│       ├── __init__.py
│       ├── admin.py          # Gestão de cursos, entidades, prompts e publicidades
│       ├── auth.py           # Rotas de login, registro e sessão
│       ├── feed.py           # Swipes, likes, dislikes e feed de descoberta
│       ├── matches.py        # Matches, mensagens e pedidos de fotos privadas
│       └── users.py          # Perfil, músicas e fotos do usuário
├── frontend/                 # Interface estática mobile-first com Tailwind CSS
│   ├── css/
│   │   └── style.css         # Estilização visual, animações e responsividade
│   ├── js/
│   │   └── app.js            # Lógica cliente, player de áudio e modo demo
│   ├── index.html            # Feed principal de swipes
│   ├── login.html            # Tela de login e cadastro com atalhos de demonstração
│   ├── profile.html          # Edição de perfil, seleção de músicas e fotos
│   ├── matches.html          # Conversas e autorizações de conteúdo privado
│   └── admin.html            # Painel administrativo
├── data/                     # Diretório de persistência do SQLite (pontinho.db)
├── docker-compose.yml        # Configuração de containers Docker
├── Dockerfile                # Imagem Docker otimizada (Python slim)
├── entrypoint.sh             # Script de inicialização do container
├── requirements.txt          # Dependências do backend Python
└── README.md                 # Documentação oficial
```

---

## 💻 Como Executar o Projeto

### Opção 1: Via Docker & Docker Compose (Recomendado)

1. **Construir a imagem e subir os serviços**:
   ```bash
   docker compose up --build -d
   ```

2. **Acompanhar os logs do servidor**:
   ```bash
   docker compose logs -f
   ```

3. **Parar os serviços**:
   ```bash
   docker compose down
   ```

---

### Opção 2: Localmente com Python

1. **Instalar dependências**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Inicializar e semear a base de dados**:
   ```bash
   python -m backend.seed
   ```

3. **Executar o servidor**:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

---

## 🌐 URLs de Acesso

- **Feed Principal (Swipes)**: [http://localhost:8000](http://localhost:8000)
- **Login & Cadastro**: [http://localhost:8000/login.html](http://localhost:8000/login.html)
- **Meu Perfil**: [http://localhost:8000/profile.html](http://localhost:8000/profile.html)
- **Conversas & Matches**: [http://localhost:8000/matches.html](http://localhost:8000/matches.html)
- **Painel Administrativo**: [http://localhost:8000/admin.html](http://localhost:8000/admin.html)
- **Documentação da API (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
