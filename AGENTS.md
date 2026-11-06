# AGENTS.md — Diretrizes para Agentes de IA (Pontinho UFABC)

Este documento estabelece o contexto de arquitetura, padrões técnicos e regras operacionais obrigatórias para qualquer agente de Inteligência Artificial que atue no repositório **Pontinho UFABC**.

---

## 1. ⚠️ Regras Operacionais Críticas (Guardrails)

1. **Confirmação Prévia de Git:**
   - **NUNCA** execute `git commit` ou `git push` automaticamente sem solicitar e receber confirmação expressa do desenvolvedor.
   - Antes de commitar, sempre apresente:
     1. Lista dos arquivos alterados (`git status`).
     2. Mensagem proposta para o commit (seguindo o padrão *Conventional Commits*).
     3. A branch de destino.

2. **Separação Estrita de Ambientes:**
   - **`main`**: Destinada exclusivamente a código de produção estável e deploys na VPS.
   - **`dev`**: Branch de trabalho para novas funcionalidades, correções e testes locais.
   - **Dados em Produção:** Quando `DEV_MODE=false`, o sistema **NUNCA** deve injetar dados mockados ou fakes (como usuários fictícios, festas ou propagandas geradas pelo `seed.py`).

3. **Integridade de Documentação e Código:**
   - Preserve todos os comentários e docstrings existentes que não estejam diretamente relacionados com a alteração em andamento.
   - Não remova validações de segurança, filtros LGPD ou restrições do ECA Digital sem instrução explícita.
   - Toda alteração funcional deve ser acompanhada ou validada pela suíte de testes automatizados existente.

---

## 2. Visão Geral da Stack & Arquitetura

O **Pontinho UFABC** é uma aplicação web progressiva desenvolvida exclusivamente para a comunidade acadêmica da Universidade Federal do ABC.

- **Frontend:**
  - **Framework:** Preact 10 (via `@testing-library/preact` e `preact-iso`) com empacotamento via **Vite**.
  - **Estilização:** Tailwind CSS (estética Dark Mode nativa, com temas UFABC Verde, Pride Dark e Noite de Halloween).
  - **IA & Biometria Client-Side:** Vladmandic Face-API para prova de vida (liveness test) e estimativa de idade (+18) conforme Lei nº 14.811/2024.
  - **Mídia:** Conversão client-side de imagens para `.webp` e vídeos curtos para `.gif` animado (`gifenc`), reduzindo o consumo de memória do servidor.

- **Backend:**
  - **Framework:** Python 3.13 / FastAPI (API REST pura, sem renderização de templates no servidor).
  - **Banco de Dados:** SQLite otimizado (`pontinho.db` montado em volume `/data`), com WAL mode e índices.
  - **Criptografia & Sessões:** Hash de senhas via **Argon2id** (`argon2-cffi`), cookies de sessão assinados criptograficamente com HMAC SHA-256.
  - **Serviço de E-mail:** Integração transacional via API do **Resend** autenticada no domínio oficial `pontinho.julianvitor.com.br`.

- **Infraestrutura & Deploy:**
  - **VPS:** Instância Oracle Cloud Ubuntu rodando Docker e Docker Compose (`docker-compose.prod.yml`).
  - **CI/CD:** GitHub Actions com testes automatizados em Node/Python e deploy contínuo via SSH nativo na branch `main`.

---

## 3. Comandos Úteis do Projeto

### Frontend (`frontend/`)
```bash
# Instalar dependências
npm --prefix frontend install

# Executar servidor de desenvolvimento (porta 3000)
npm --prefix frontend run dev

# Rodar a suíte de testes unitários (Vitest)
npm --prefix frontend test -- --run

# Compilar build estático de produção
npm --prefix frontend run build
```

### Backend (`backend/`)
```bash
# Executar a suíte de testes automatizados (Pytest)
./venv/bin/pytest backend/tests/test_api.py -v

# Executar a API em modo de desenvolvimento local (porta 8000)
./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 4. Estrutura de Diretórios

```
.
├── backend/                  # Código fonte da API FastAPI
│   ├── main.py               # Ponto de entrada e middlewares CORS
│   ├── database.py           # Conexão SQLite, schemas e migrações
│   ├── auth.py               # Sessões HMAC, Argon2id e validação @ufabc
│   ├── email_service.py      # Envio de e-mails via Resend (código e reset)
│   ├── seed.py               # Carga inicial de metadados e seeds (modo dev)
│   ├── routers/              # Roteadores modulares (auth, users, feed, admin, etc.)
│   └── tests/                # Testes automatizados Pytest
├── frontend/                 # Aplicação SPA Preact + Vite
│   ├── src/                  # Componentes, páginas e serviços
│   ├── public/               # Favicon, manifest e assets estáticos
│   └── src/test/             # Testes unitários Vitest
├── scripts/                  # Scripts de deploy e manutenção (deploy.sh)
├── .github/workflows/        # Pipeline de CI/CD do GitHub Actions
├── docker-compose.prod.yml   # Configuração de containers de produção
└── AGENTS.md                 # Este documento de diretrizes
```

---

## 5. Regras de Domínio & Negócio

1. **E-mails Válidos:** O cadastro e recuperação de senha aceitam estritamente e-mails institucionais da UFABC terminados em `@aluno.ufabc.edu.br` ou `@ufabc.edu.br`.
2. **Verificação de E-mail:** Códigos de 4 dígitos possuem validade de 15 minutos e rate-limiting de 60 segundos por endereço.
3. **Recuperação de Senha:** Links de redefinição utilizam tokens criptográficos de uso único (`secrets.token_urlsafe`) com validade de 1 hora.
4. **Proteção Anti-Enumeração:** Endpoints de recuperação de senha nunca revelam se o e-mail informado existe ou não na base de dados.
