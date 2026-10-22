# Pontinho UFABC 🔥
> O aplicativo de paquera e amizades simplificado e desenhado para os membros da Universidade Federal do ABC.

---

## 🚀 Tecnologias Utilizadas

- **Backend**: Python 3 com **FastAPI** e **Uvicorn**.
- **Banco de Dados**: **SQLite3** nativo (sintaxe simples, queries legíveis e de fácil manutenção).
- **Frontend**: Páginas HTML estáticas estruturadas com **Tailwind CSS**, sem complexidade de build.
- **Validação de Dados**: **Pydantic** para integridade de tipos e regras de negócio.

---

## 📋 Funcionalidades Implementadas

### 1. Autenticação (Login & Cadastro com E-mail Acadêmico UFABC)
- **E-mail Institucional Obrigatório**: validação e sanitização estrita para que apenas e-mails acadêmicos da UFABC (`@aluno.ufabc.edu.br` ou `@ufabc.edu.br`) possam se cadastrar.
- **Sanitização Inteligente**: converte para minúsculas, remove espaços e completa automaticamente com `@aluno.ufabc.edu.br` caso o estudante digite apenas o usuário.
- **Login por E-mail e Senha**: autenticação segura por hash com sessão persistida via cookie e localStorage.
- **Página de Login (`/login.html`)**: interface moderna e responsiva com abas para entrar ou se cadastrar, além de atalhos rápidos para contas de teste da UFABC.

### 2. Feed & Swipes
- **Deck de Cards de Estudantes**: fotos em tela cheia com alternância rápida (toque no lado esquerdo ou direito), indicador de progresso no topo (estilo Stories/Tinder).
- **Informações do Aluno**:
  - Nome, idade e bio.
  - Campus: Santo André ou São Bernardo do Campo.
  - Curso Base: BC&T, BC&H, LC&T, LCH.
  - Curso Específico: Ciência da Computação, Engenharia Aeroespacial, Neurociência, Relações Internacionais, Economia, etc.
  - Entidade que participa: Atlética Geral, Bateria UFABC, Caiás, Baja, Centro Acadêmico, etc.
  - O que procura: *Algo sério*, *Algo casual*, *Amizade*.
  - Tags de interesses.
  - **3 Perguntinhas com Respostas**: quebra-gelo temático da UFABC (ex: *"O melhor lugar para matar aula na UFABC é..."*, *"Minha opinião impopular sobre o RU..."*).
- **Publicidade Intercalada (Ads)**: cards patrocinados inseridos a cada N cards de perfil conforme frequência configurada no painel administrativo.
- **Detecção de Match**: ao ocorrer like mútuo, um modal comemorativo é exibido com fotos de ambos os estudantes e atalho para o chat.

### 2. Validação Obrigatória de Fotos
- Regra de negócio estrita: **o perfil do estudante deve ter obrigatoriamente ao menos duas fotos** cadastradas (validado no frontend e no backend via Pydantic).

### 3. Conversas & Chat Básico
- Aba **Conversas** com a lista de todos os matches mútuos.
- **Chat exclusivo de texto**: envio e visualização de mensagens em tempo real entre alunos combinados.

### 4. Meu Perfil
- Edição completa de perfil com dropdowns dinâmicos carregados do banco SQLite.
- Gerenciamento de fotos com pré-visualização e contagem de fotos mínima exigida.
- Seletor de usuário para alternar facilmente entre perfis durante testes.

### 5. Painel Administrativo (`/admin.html`)
- **Moderar Usuários**: visualizar todos os cadastros e **apagar usuários** (com exclusão em cascata de matches e mensagens).
- **Modificar Lista de Cursos**: adicionar e remover cursos base (BI) e específicos (pós-BI).
- **Modificar Lista de Entidades**: cadastrar e gerenciar atléticas, centros acadêmicos e coletivos estudantis.
- **Modificar as Perguntinhas**: adicionar e remover perguntas de perfil temáticas.
- **Publicidade nos Swipes**: criar anúncios com imagem, título, texto promocional, link externo e frequência de exibição.

---

## 💻 Como Rodar o Projeto

### Opção 1: Via Docker & Docker Compose (Recomendado para Deploy)

1. **Subir com Docker Compose**:
   ```bash
   docker compose up --build -d
   ```
   *O container inicializa automaticamente o banco SQLite e popula com os dados iniciais se necessário. O banco fica persistido na pasta `./data/pontinho.db` no seu host.*

2. **Ver logs do container**:
   ```bash
   docker compose logs -f
   ```

3. **Parar a aplicação**:
   ```bash
   docker compose down
   ```

---

### Opção 2: Localmente com Python

1. **Instalar dependências**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Popular o banco com dados de teste da UFABC**:
   ```bash
   python seed.py
   ```

3. **Iniciar o servidor**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

### 🌐 Acessar no Navegador
- Swipes (Feed Principal): [http://localhost:8000](http://localhost:8000)
- Chat & Matches: [http://localhost:8000/matches.html](http://localhost:8000/matches.html)
- Meu Perfil: [http://localhost:8000/profile.html](http://localhost:8000/profile.html)
- Painel Admin: [http://localhost:8000/admin.html](http://localhost:8000/admin.html)

