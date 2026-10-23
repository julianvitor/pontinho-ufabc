# 🛡️ Relatório de Auditoria de Segurança & Pentest - Pontinho UFABC

> **Data da Auditoria:** 22 de Outubro de 2026  
> **Tipo de Avaliação:** Análise Estática de Código-Fonte (White-Box Code Audit) & Modelagem de Ameaças  
> **Escopo:** Backend FastAPI, Banco SQLite, Roteadores da API REST, Gerenciamento de Sessão e Uploads  
> **Padrão de Referência:** OWASP Top 10 (2021) & Diretrizes de Privacidade da LGPD (Lei nº 13.709/2018)

---

## 📊 1. Resumo Executivo das Descobertas

Durante o checkup de segurança no backend do **Pontinho**, foram mapeadas **11 vulnerabilidades**, distribuídas nos seguintes níveis de risco:

```text
   CRÍTICAS:  2  [🔴🔴]
   ALTAS:     5  [🟠🟠🟠🟠🟠]
   MÉDIAS:    3  [🟡🟡🟡]
   BAIXAS:    1  [🔵]
```

### Matriz Geral de Risco

| ID | Vulnerabilidade | Severidade | Categoria OWASP | Arquivo Afetado |
|:---|:---|:---:|:---|:---|
| **VULN-01** | Bypass de Autenticação / Account Takeover via Headers & Cookies Legados | 🔴 **CRÍTICA** | A07:2021 – Identification and Auth Failures | `backend/auth.py` |
| **VULN-02** | Chave Secreta de Assinatura de Sessão (HMAC) Hardcoded no Código | 🔴 **CRÍTICA** | A02:2021 – Cryptographic Failures | `backend/auth.py` |
| **VULN-03** | Algoritmo Criptográfico de Hash de Senhas Rápido (SHA-256 com Salt Estático) | 🟠 **ALTA** | A02:2021 – Cryptographic Failures | `backend/database.py` |
| **VULN-04** | Exposição Pública de Contas, Privilégios e Senhas Padrão em `/demo-accounts` | 🟠 **ALTA** | A01:2021 – Broken Access Control | `backend/routers/auth.py` |
| **VULN-05** | Vazamento Massivo de PII (RA e E-mail Institucional) no Feed de Swipes | 🟠 **ALTA** | A01:2021 – Security Misconfiguration / LGPD | `backend/routers/feed.py` |
| **VULN-06** | Blind Server-Side Request Forgery (SSRF) no Gerador de Teasers Borrados | 🟠 **ALTA** | A10:2021 – Server-Side Request Forgery | `backend/teaser.py` |
| **VULN-07** | Endpoint Não Autenticado de Injeção de Contas Arbitrárias (`POST /api/users`) | 🟠 **ALTA** | A04:2021 – Insecure Design | `backend/routers/users.py` |
| **VULN-08** | Ausência de Rate Limiting no Login & Enumeração de E-mails Cadastrados | 🟡 **MÉDIA** | A07:2021 – Identification and Auth Failures | `backend/routers/auth.py` |
| **VULN-09** | Armazenamento Estático de Imagens Privadas Sem Controle de Acesso (`/uploads`) | 🟡 **MÉDIA** | A01:2021 – Broken Access Control (BOLA) | `backend/main.py` |
| **VULN-10** | Cookies de Sessão Autenticada sem Flags de Proteção `HttpOnly` e `Secure` | 🟡 **MÉDIA** | A05:2021 – Security Misconfiguration | `backend/auth.py` |
| **VULN-11** | Política de Senhas com Comprimento Mínimo Muito Curto (4 caracteres) | 🔵 **BAIXA** | A07:2021 – Identification and Auth Failures | `backend/models.py` |

---

## 🔍 2. Detalhamento Técnico das Vulnerabilidades

---

### [VULN-01] Bypass de Autenticação / Account Takeover via Headers & Cookies Legados
- **Severidade:** 🔴 **CRÍTICA** (CVSS: 9.8)
- **Localização:** `backend/auth.py:L106-123`
- **Descrição & Mecanismo:**
  No método `get_current_user_id()`, existe um fallback herdado de desenvolvimento local que aceita identificadores numéricos puros vindos do cabeçalho HTTP `X-User-Id` ou do cookie `pontinho_user_id`:
  ```python
  legacy_header = request.headers.get("x-user-id")
  if legacy_header and legacy_header.isdigit():
      return int(legacy_header)

  legacy_cookie = request.cookies.get("pontinho_user_id")
  if legacy_cookie and legacy_cookie.isdigit():
      return int(legacy_cookie)
  ```
- **Cenário de Ataque:**
  Um atacante pode interceptar ou emitir qualquer requisição HTTP contendo o header `X-User-Id: 1` ou cookie `pontinho_user_id=1`. O backend imediatamente assumirá a sessão do Usuário ID 1 (inclusive com privilégios de Administrador) sem exigir credencial, assinatura criptográfica ou token válido.
- **Impacto:** Comprometimento total da aplicação, sequestro de qualquer conta de estudante e acesso irrestrito ao painel de administração.
- **Remediação Recomendada:**
  Remover a checagem `.isdigit()` de strings puras. Apenas aceitar tokens que passem pela validação `verify_session_token(token)`.

---

### [VULN-02] Chave Secreta de Assinatura de Sessão (HMAC) Hardcoded
- **Severidade:** 🔴 **CRÍTICA** (CVSS: 9.1)
- **Localização:** `backend/auth.py:L11`
- **Descrição & Mecanismo:**
  A chave utilizada para assinar os tokens criptográficos de sessão possui um valor padrão fixo caso a variável de ambiente não esteja declarada:
  ```python
  SECRET_KEY = os.getenv("PONTINHO_SECRET_KEY", "ufabc_pontinho_super_secret_session_key_2026")
  ```
- **Cenário de Ataque:**
  Como o código-fonte está versionado no repositório, qualquer pessoa que inspecione o arquivo pode gerar assinaturas HMAC-SHA256 offline válidas no formato `{user_id}.{timestamp}.{signature}` e autenticar-se como qualquer estudante ou administrador.
- **Impacto:** Forjamento arbitrário de identidades em qualquer ambiente onde `PONTINHO_SECRET_KEY` não for customizada no `.env`.
- **Remediação Recomendada:**
  Obrigar a definição da variável de ambiente `PONTINHO_SECRET_KEY` em produção (gerando erro fatal de inicialização caso ausente), ou gerar um segredo randômico seguro via `secrets.token_hex(32)`.

---

### [VULN-03] Algoritmo Criptográfico Fraco para Senhas (SHA-256 com Salt Estático)
- **Severidade:** 🟠 **ALTA** (CVSS: 7.5)
- **Localização:** `backend/database.py:L25-L32`
- **Descrição & Mecanismo:**
  O armazenamento de senhas utiliza SHA-256 simples com salt fixo universal:
  ```python
  def hash_password(password: str) -> str:
      salt = "ufabc_pontinho_2026"
      return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
  ```
- **Cenário de Ataque:**
  O SHA-256 foi projetado para alta velocidade de throughput e não para armazenamento de senhas. Se o banco SQLite for extraído, placas de vídeo modernas conseguem computar bilhões de tentativas por segundo (ataque por dicionário / rainbow table) e reverter as senhas dos estudantes.
- **Impacto:** Quebra rápida de senhas em caso de vazamento da base de dados.
- **Remediação Recomendada:**
  Migrar para algoritmos com fator de trabalho configurável (Work Factor / Cost) projetados para senhas, como **Argon2id** (recomendado pela OWASP) ou **bcrypt**, utilizando salt aleatório individual por usuário.

---

### [VULN-04] Exposição Pública de Credenciais em `/api/auth/demo-accounts`
- **Severidade:** 🟠 **ALTA** (CVSS: 7.5)
- **Localização:** `backend/routers/auth.py:L170-L191`
- **Descrição & Mecanismo:**
  O endpoint `/api/auth/demo-accounts` é público e responde com todos os dados cadastrais dos estudantes, sinalizando se são administradores e expondo senhas padrão:
  ```python
  d["password"] = "admin123" if d["is_admin"] else "123456"
  ```
- **Cenário de Ataque:**
  Qualquer visitante não logado consegue listar a base inteira de estudantes da plataforma, descobrir os IDs e e-mails de administradores e tentar login com as credenciais expostas.
- **Impacto:** Enumeração massiva de usuários e invasão de contas com senhas fracas ou inalteradas.
- **Remediação Recomendada:**
  Condicionar a rota para retornar dados apenas se uma flag de debug estiver explicitamente ativa (`DEBUG=true`), e em hipótese alguma expor o campo `password` na resposta da API.

---

### [VULN-05] Vazamento Massivo de PII (RA e E-mail Institucional) no Feed
- **Severidade:** 🟠 **ALTA** (CVSS: 7.2)
- **Localização:** `backend/routers/feed.py:L130-L168`
- **Descrição & Mecanismo:**
  O feed executa `SELECT * FROM users`. Apesar de remover `password_hash` e fotos privadas antes do retorno, ele mantém no payload os campos `ra` (Registro Acadêmico) e `email`:
  ```python
  d.pop("private_photos", None)
  d.pop("private_bio", None)
  d.pop("password_hash", None)
  # 'ra' e 'email' continuam dentro de 'd'
  ```
- **Cenário de Ataque:**
  Ao usar a interface de swipes, o usuário pode inspecionar a aba Network e baixar a lista completa de RAs, nomes e e-mails institucionais de todos os outros estudantes.
- **Impacto:** Violação grave das normas da LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018) por desrespeito ao Princípio da Minimização de Dados (Art. 6º, III), viabilizando engenharia social e perseguição (doxxing).
- **Remediação Recomendada:**
  Definir projeção estrita no banco, buscando e serializando apenas dados públicos: `id, name, age, campus, course, specific_course, entity, looking_for, bio, interests, photos, songs, prompts`.

---

### [VULN-06] Blind Server-Side Request Forgery (SSRF) no Processador de Teasers
- **Severidade:** 🟠 **ALTA** (CVSS: 7.4)
- **Localização:** `backend/teaser.py:L47-L54`
- **Descrição & Mecanismo:**
  Ao gerar teasers borrados para o Álbum Secreto, o servidor efetua requisições HTTP para qualquer URL contida em `photo_source`:
  ```python
  if source_clean.startswith("http://") or source_clean.startswith("https://"):
      req = urllib.request.Request(source_clean, ...)
      with urllib.request.urlopen(req, timeout=6) as response:
          img_bytes = response.read()
  ```
- **Cenário de Ataque:**
  Um usuário autenticado pode atualizar seu perfil inserindo em `private_photos` um link para a rede interna (ex: `http://169.254.169.254/latest/meta-data/` na AWS, ou `http://localhost:8000/api/admin/...`). O servidor FastAPI fará a requisição a partir de sua própria interface de rede.
- **Impacto:** Varredura de portas da rede interna corporativa, acesso a metadados de instâncias em nuvem e disparo de requisições internas autenticadas.
- **Remediação Recomendada:**
  Permitir apenas referências a arquivos locais gerenciados pelo Pontinho (`/uploads/...`) ou validar a URL com lista branca rigorosa de domínios públicos externos, bloqueando estritamente endereços de loopback (`127.0.0.1`, `localhost`) e faixas RFC 1918 / link-local (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`).

---

### [VULN-07] Criação Não Autenticada de Usuários Arbitrários (`POST /api/users`)
- **Severidade:** 🟠 **ALTA** (CVSS: 7.3)
- **Localização:** `backend/routers/users.py:L92-L125`
- **Descrição & Mecanismo:**
  O endpoint `POST /api/users` permite criar novos registros na tabela `users` sem exigir autenticação de administrador, sem validar e-mail acadêmico UFABC, sem exigir senha e sem confirmação de aceite dos termos LGPD.
- **Cenário de Ataque:**
  Um atacante pode programar um script em lote para injetar centenas de perfis fraudulentos com links ou textos maliciosos diretamente no banco de dados, corrompendo a integridade da plataforma.
- **Impacto:** Poluição da base de dados, perda de integridade do feed e bypass do fluxo formal de cadastro.
- **Remediação Recomendada:**
  Restringir `POST /api/users` exclusivamente para administradores (`require_admin(request)`), canalizando cadastros normais unicamente através de `POST /api/auth/register`.

---

### [VULN-08] Ausência de Rate Limiting no Login & Enumeração de Usuários
- **Severidade:** 🟡 **MÉDIA** (CVSS: 5.3)
- **Localização:** `backend/routers/auth.py:L94-L127`
- **Descrição & Mecanismo:**
  O endpoint `/api/auth/login` não possui limitação de taxa de requisições (rate limiting) nem proteção contra força bruta (bloqueio temporário). Além disso, retorna mensagens de erro diferenciadas:
  - `"E-mail acadêmico não encontrado no sistema."`
  - `"Senha incorreta."`
- **Cenário de Ataque:**
  Um atacante pode testar listas de e-mails de estudantes da UFABC para descobrir quem possui conta ativa no app e, em seguida, disparar ataques automatizados de adivinhação de senhas com ferramentas como Hydra ou scripts Python.
- **Impacto:** Descoberta de usuários cadastrados e quebra de contas com senhas comuns.
- **Remediação Recomendada:**
  1. Padronizar a mensagem de erro para uma resposta genérica: `"E-mail ou senha inválidos."`
  2. Implementar rate limiting por IP e por conta (ex: máximo de 5 tentativas por minuto).

---

### [VULN-09] Armazenamento de Arquivos Privados Sem Controle de Acesso
- **Severidade:** 🟡 **MÉDIA** (CVSS: 5.3)
- **Localização:** `backend/main.py:L54`
- **Descrição & Mecanismo:**
  O diretório de uploads é servido de forma pública e direta pelo Starlette:
  ```python
  app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
  ```
- **Cenário de Ataque:**
  Se fotos privadas de usuários forem salvas na mesma pasta `/uploads`, qualquer pessoa que consiga o nome do arquivo (ex: interceptando tráfego, por log ou adivinhação de UUID) terá acesso direto ao arquivo original em alta resolução, sem precisar de autorização de match.
- **Impacto:** Quebra do modelo de isolamento do Álbum Secreto.
- **Remediação Recomendada:**
  Separar os diretórios:
  - `/uploads/public/` para capas de festas e avatares públicos.
  - `/uploads/private/` protegido, servido unicamente por um endpoint que valida a aprovação da tabela `private_access_requests`.

---

### [VULN-10] Cookies de Sessão Sem Atributos `HttpOnly` e `Secure`
- **Severidade:** 🟡 **MÉDIA** (CVSS: 4.8)
- **Localização:** `backend/auth.py:L60-L71`
- **Descrição & Mecanismo:**
  Ao definir os cookies de sessão (`pontinho_session` e `pontinho_user_id`), o parâmetro `httponly` é explicitamente configurado como `False`:
  ```python
  response.set_cookie(
      key=SESSION_COOKIE_NAME,
      value=token,
      httponly=False,
      samesite="lax"
  )
  ```
- **Cenário de Ataque:**
  Caso ocorra qualquer injeção de script (XSS) no frontend, o invasor pode executar `document.cookie` e roubar o token assinado de sessão para sequestrar a conta remotamente.
- **Impacto:** Facilidade de sequestro de sessão em caso de vulnerabilidades XSS.
- **Remediação Recomendada:**
  Configurar `httponly=True` em `pontinho_session`. Para ambientes HTTPS de produção, adicionar também `secure=True`.

---

### [VULN-11] Política de Senhas com Comprimento Mínimo Muito Curto
- **Severidade:** 🔵 **BAIXA** (CVSS: 3.1)
- **Localização:** `backend/models.py:L10`
- **Descrição & Mecanismo:**
  O modelo `RegisterRequest` exige apenas 4 caracteres para a senha:
  ```python
  password: str = Field(..., min_length=4, description="Senha de acesso")
  ```
- **Cenário de Ataque:**
  Senhas de 4 caracteres possuem um espaço de busca minúsculo e são facilmente descobertas por dicionários básicos (ex: "1234", "ufab").
- **Impacto:** Criação de contas com senhas extremamente vulneráveis.
- **Remediação Recomendada:**
  Aumentar o requisito mínimo para pelo menos 8 caracteres (conforme diretrizes NIST SP 800-63B).

---

## 📋 3. Plano de Ação Recomendado (Roadmap de Hardening)

### Fase 1: Correções Críticas Imediatas
1. **Fechar o bypass de autenticação** em `backend/auth.py` removendo a aceitação de IDs numéricos simples sem validação de assinatura.
2. **Eliminar a chave de sessão hardcoded**, exigindo variável de ambiente em produção.
3. **Bloquear vazamento de PII no feed** em `backend/routers/feed.py` retirando `ra` e `email` do payload.

### Fase 2: Fortalecimento de Acesso e Controles
4. **Desativar `/api/auth/demo-accounts`** ou restringi-lo a modo estrito de desenvolvimento.
5. **Proteger `POST /api/users`** com autenticação de administrador (`require_admin`).
6. **Bloquear SSRF em `backend/teaser.py`** rejeitando URLs externas para fotos privadas.
7. **Marcar cookies de sessão com `httponly=True`**.

### Fase 3: Modernização Criptográfica & Resiliência
8. **Substituir o hash SHA-256 por Argon2id ou Bcrypt** em `backend/database.py`.
9. **Implementar Rate Limiting** em rotas de login e cadastro.
10. **Aumentar requisito mínimo de senha** para 8 caracteres em `backend/models.py`.
