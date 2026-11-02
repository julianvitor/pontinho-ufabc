# 🛡️ Relatório de Segurança, Auditoria & Proteções Implementadas - Pontinho UFABC

> **Última Revisão:** Novembro de 2026  
> **Tipo de Avaliação:** Análise Estática de Código-Fonte (White-Box Code Audit), Pentest & Verificação de Remediações  
> **Escopo:** Backend FastAPI, Banco SQLite, Gerenciamento de Sessão HMAC, Criptografia Argon2id, Uploads e Privacidade  
> **Padrões de Referência:** OWASP Top 10 (2021), NIST SP 800-63B, LGPD (Lei nº 13.709/2018) e ECA Digital (Lei nº 14.811/2024)  
> **Status Geral:** ✅ **100% das vulnerabilidades identificadas foram sanadas e verificadas no código-fonte.**

---

## 📊 1. Matriz Geral de Risco e Status das Remediações

Todas as 11 vulnerabilidades apontadas na auditoria inicial foram devidamente corrigidas com implementação de controles defensivos em múltiplas camadas (Defense in Depth):

| ID | Vulnerabilidade Original | Severidade | Categoria OWASP | Arquivo Principal | Status Atual |
|:---|:---|:---:|:---|:---|:---:|
| **VULN-01** | Bypass de Autenticação / Account Takeover via Headers & Cookies Legados | 🔴 **CRÍTICA** | A07:2021 – Identification and Auth Failures | `backend/auth.py` | ✅ **Sanada** |
| **VULN-02** | Chave Secreta de Assinatura de Sessão (HMAC) Hardcoded ou Fraca | 🔴 **CRÍTICA** | A02:2021 – Cryptographic Failures | `backend/auth.py` | ✅ **Sanada** |
| **VULN-03** | Algoritmo Criptográfico de Hash de Senhas Rápido (SHA-256 com Salt Estático) | 🟠 **ALTA** | A02:2021 – Cryptographic Failures | `backend/database.py` | ✅ **Sanada** |
| **VULN-04** | Exposição Pública de Contas, Privilégios e Senhas em `/demo-accounts` | 🟠 **ALTA** | A01:2021 – Broken Access Control | `backend/routers/auth.py` | ✅ **Sanada** |
| **VULN-05** | Vazamento de Dados Pessoais (E-mail Institucional) no Feed de Swipes | 🟠 **ALTA** | A01:2021 – Security Misconfiguration / LGPD | `backend/routers/feed.py` | ✅ **Sanada** |
| **VULN-06** | Blind Server-Side Request Forgery (SSRF) no Gerador de Teasers Borrados | 🟠 **ALTA** | A10:2021 – Server-Side Request Forgery | `backend/teaser.py` | ✅ **Sanada** |
| **VULN-07** | Endpoint Não Autenticado de Injeção de Contas Arbitrárias (`POST /api/users`) | 🟠 **ALTA** | A04:2021 – Insecure Design | `backend/routers/users.py` | ✅ **Sanada** |
| **VULN-08** | Ausência de Rate Limiting no Login & Enumeração de E-mails Cadastrados | 🟡 **MÉDIA** | A07:2021 – Identification and Auth Failures | `backend/routers/auth.py` | ✅ **Sanada** |
| **VULN-09** | Armazenamento Estático de Imagens Privadas Sem Controle de Acesso | 🟡 **MÉDIA** | A01:2021 – Broken Access Control (BOLA) | `backend/routers/media.py` | ✅ **Sanada** |
| **VULN-10** | Cookies de Sessão Autenticada sem Flags de Proteção `HttpOnly` e `Secure` | 🟡 **MÉDIA** | A05:2021 – Security Misconfiguration | `backend/auth.py` | ✅ **Sanada** |
| **VULN-11** | Política de Senhas com Comprimento Mínimo Inseguro (4 caracteres) | 🔵 **BAIXA** | A07:2021 – Identification and Auth Failures | `backend/models.py` | ✅ **Sanada** |

---

## 🔍 2. Detalhamento Técnico das Proteções Implementadas

---

### [VULN-01] Autenticação Obrigatória e Blindagem de Sessão HMAC-SHA256
- **Problema Original:** O backend aceitava identificadores numéricos puros via header `X-User-Id` ou cookie `pontinho_user_id` sem assinatura digital, permitindo personificação de qualquer usuário.
- **Proteção Implementada:**
  - Removido qualquer parser de IDs numéricos simples.
  - Toda requisição autenticada passa obrigatoriamente por `get_current_user_id()`, que exige token assinado no formato `{user_id}.{timestamp}.{hmac_sha256}`.
  - Validação em tempo constante contra *timing attacks* via `hmac.compare_digest()`.
  - Expiração forçada de sessão após 30 dias (`SESSION_MAX_AGE`).
- **Arquivos:** [`backend/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/auth.py#L45-L81) e [`backend/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/auth.py#L137-L173)

---

### [VULN-02] Obrigatoriedade Estrita de Segredo Criptográfico (`PONTINHO_SECRET_KEY`)
- **Problema Original:** Existência de chave estática padrão hardcoded caso a variável de ambiente não estivesse definida, abrindo brecha para forjamento de tokens offline.
- **Proteção Implementada:**
  - O backend valida a presença e a entropia da variável `PONTINHO_SECRET_KEY` no bootstrap do aplicativo.
  - Se a chave for inexistente, menor que 16 caracteres ou corresponder ao valor de exemplo inseguro, um `RuntimeError` bloqueia a inicialização do container/servidor.
- **Arquivo:** [`backend/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/auth.py#L32-L40)

---

### [VULN-03] Hashing Robusto de Senhas com Argon2id & Migração Transparente
- **Problema Original:** Uso de SHA-256 com salt estático global, suscetível a ataques massivos de força bruta com GPU e Rainbow Tables.
- **Proteção Implementada:**
  - Adoção de **Argon2id** (padrão ouro OWASP) com salt individual aleatório de 16 bytes via `argon2-cffi`.
  - Parâmetros configurados para balancear segurança e consumo de RAM: `time_cost=2`, `memory_cost=19456 KB` (19 MB), `parallelism=1`, `hash_len=32`.
  - Rotina de verificação retrocompatível com auto-migração (`needs_rehash`): quando um usuário com hash legado efetua login com sucesso, sua senha é automaticamente re-hasheada para Argon2id no banco de dados.
- **Arquivos:** [`backend/database.py`](file:///home/julian/dev/pontinho-ufabc/backend/database.py#L28-L72) e [`backend/routers/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/auth.py#L192-L203)

---

### [VULN-04] Isolamento de Ambiente e Proteção de Dados em `/demo-accounts`
- **Problema Original:** Rota exposta em produção revelando lista completa de usuários, flags de privilégio de administrador e senhas padrão.
- **Proteção Implementada:**
  - O endpoint `/api/auth/demo-accounts` é restrito a ambientes com `DEV_MODE=true` ou `DEBUG=true`. Em produção, retorna array vazio (`[]`).
  - Filtragem estrita `WHERE is_admin = 0` (administradores nunca são listados).
  - Projeção seletiva de campos: o atributo `password` foi totalmente excluído da serialização JSON.
- **Arquivo:** [`backend/routers/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/auth.py#L250-L277)

---

### [VULN-05] Princípio da Minimização de Dados (LGPD) no Feed de Descoberta
- **Problema Original:** Consulta `SELECT * FROM users` expunha os e-mails acadêmicos de todos os usuários do feed na resposta de rede do navegador.
- **Proteção Implementada:**
  - Substituição por projeção SQL explícita em *Allowlist*: apenas campos públicos necessários para o card de swipe são selecionados (`id, name, age, campus, course, specific_course, entity, looking_for, bio, interests, photos, songs, prompts, gender, is_verified`).
  - O campo `email` e identificadores sensíveis não são requisitados nem transmitidos, em plena conformidade com o Art. 6º, III da LGPD.
- **Arquivo:** [`backend/routers/feed.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/feed.py#L188-L240)

---

### [VULN-06] Blindagem contra SSRF e Path Traversal no Módulo de Teasers
- **Problema Original:** Carregamento de imagens via `urllib.request.urlopen` a partir de links arbitrários permitia varredura interna de rede e requisições a serviços locais (SSRF).
- **Proteção Implementada:**
  - Bloqueio imediato de esquemas de rede (`http://`, `https://`, `ftp://`, `//`). Teasers são gerados exclusivamente a partir de uploads locais do próprio app.
  - Confinamento rígido de diretório: resolução de caminhos com `Path.resolve()` e verificação `.is_relative_to(UPLOAD_DIR)` e `.is_relative_to(PRIVATE_UPLOAD_DIR)` para barrar ataques de *Path Traversal* (`../`).
  - Aplicação de desfoque Gaussiano destrutivo permanente (`radius=35`) e redimensionamento no servidor, garantindo que a foto privada original não possa ser recuperada.
- **Arquivo:** [`backend/teaser.py`](file:///home/julian/dev/pontinho-ufabc/backend/teaser.py#L45-L109)

---

### [VULN-07] Eliminação de Rota Não Autenticada de Injeção de Contas
- **Problema Original:** Existência de um endpoint `POST /api/users` sem autenticação permitia a injeção arbitrária de contas falsas no banco de dados.
- **Proteção Implementada:**
  - O endpoint inseguro `POST /api/users` foi **completamente eliminado**.
  - O registro de usuários agora é centralizado exclusivamente em `POST /api/auth/register`, que aplica:
    - Validação de domínio acadêmico institucional obrigatório (`@aluno.ufabc.edu.br` ou `@ufabc.edu.br`).
    - Verificação de maioridade ($\ge 18$ anos) e prova de vida facial (ECA Digital).
    - Aceite formal dos Termos de Uso e LGPD.
- **Arquivos:** [`backend/routers/users.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/users.py) e [`backend/routers/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/auth.py#L20-L130)

---

### [VULN-08] Rate Limiting no Login & Resposta Genérica Anti-Enumeração
- **Problema Original:** Ausência de limitação de tentativas de autenticação e mensagens distintas para e-mail incorreto versus senha incorreta, permitindo ataques de força bruta e enumeração de estudantes.
- **Proteção Implementada:**
  - Limitador de taxa em memória por endereço IP (`LOGIN_RATE_LIMIT_WINDOW = 60s`, `MAX_LOGIN_ATTEMPTS = 5`). Requisições excedentes recebem HTTP 429 (*Too Many Requests*).
  - Resposta unificada em caso de falha: `"E-mail institucional ou senha incorretos."` (HTTP 401), impossibilitando a inferência sobre a existência do e-mail na base.
- **Arquivo:** [`backend/routers/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/auth.py#L132-L188)

---

### [VULN-09] Segregação Física e Autorização Estrita para Fotos Privadas (Álbum Secreto)
- **Problema Original:** Arquivos privados do Álbum Secreto eram armazenados no mesmo diretório estático público `/uploads`, acessíveis por URL direta.
- **Proteção Implementada:**
  - **Segregação física**: Fotos marcadas como privadas são salvas no diretório isolado `private_uploads`, que **não** possui rota estática pública montada no Starlette/FastAPI.
  - **Endpoint autenticado de entrega**: O acesso ocorre exclusivamente via `GET /api/media/private/{filename}`.
  - **Regra de autorização**: O servidor consulta o banco e autoriza o acesso somente se:
    1. O solicitante for o proprietário do arquivo;
    2. O solicitante for Administrador do sistema;
    3. Houver registro na tabela `private_access_requests` com `status = 'approved'` concedido pelo proprietário.
  - **Cabeçalhos de proteção**: Respostas entregam cabeçalhos `Cache-Control: private, no-cache, no-store, must-revalidate` e `X-Content-Type-Options: nosniff` para impedir cache em CDNs públicas ou proxies intermediários.
- **Arquivos:** [`backend/routers/upload.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/upload.py#L114-L115) e [`backend/routers/media.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/media.py#L25-L104)

---

### [VULN-10] Cookies com Flags `HttpOnly`, `SameSite=Lax` e `Secure` Dinâmico
- **Problema Original:** O cookie de sessão autenticada era emitido com `httponly=False`, facilitando o roubo de tokens em cenários de Cross-Site Scripting (XSS).
- **Proteção Implementada:**
  - O cookie sensível `pontinho_session` é gravado com `httponly=True`, impedindo leitura via JavaScript (`document.cookie`).
  - Atributo `SameSite="lax"` configurado para mitigar ataques de Cross-Site Request Forgery (CSRF).
  - Flag `secure` ativada dinamicamente: habilitada via `SECURE_COOKIES=true` no `.env` ou automaticamente quando a requisição for HTTPS (`x-forwarded-proto` / `scheme`).
- **Arquivo:** [`backend/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/auth.py#L82-L136)

---

### [VULN-11] Política de Senhas com Mínimo de 8 Caracteres
- **Problema Original:** Limite mínimo de 4 caracteres no formulário de cadastro, permitindo senhas fracas.
- **Proteção Implementada:**
  - Validação estrita em nível de esquema Pydantic: `password: str = Field(..., min_length=8)`.
  - Validação redundante na lógica da rota `register_user`: rejeição com HTTP 400 se `len(cleaned_pw) < 8`.
- **Arquivos:** [`backend/models.py`](file:///home/julian/dev/pontinho-ufabc/backend/models.py#L10) e [`backend/routers/auth.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/auth.py#L38-L42)

---

## 🛡️ 3. Camadas Adicionais de Segurança & Resiliência

### 1. Offloading de Mídia e Mitigação de DoS por Transcodificação
- **Problema:** Envio de vídeos pesados ou imagens gigantes para processamento em servidor VPS consome CPU/RAM excessivos, levando a indisponibilidade (DoS).
- **Controles Implementados:**
  - **Conversão no Cliente**: A conversão de fotos para WebP e de vídeos curtos para GIF animado é realizada diretamente no navegador (HTML5 Canvas e biblioteca `gifenc`).
  - **Formatos Estritos no Servidor**: O backend aceita exclusivamente `ALLOWED_IMAGE_FORMATS = {"WEBP", "GIF"}`. Arquivos de vídeo direto são rejeitados com HTTP 400.
  - **Anti-Image Bomb**: Configurado `Image.MAX_IMAGE_PIXELS = 25_000_000` no Pillow para bloquear descompressão desproporcional.
  - **Remoção de Metadados**: Limpeza automática de dados sensíveis de localização GPS e EXIF no salvamento.
  - **Moderação Inteligente**: Integração com **NudeNet** (`check_image_safety`) para bloqueio prévio de conteúdo impróprio.
- **Arquivo:** [`backend/routers/upload.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/upload.py#L38-L224)

### 2. Verificação Biométrica Facial Contínua & Integridade de Selo
- **Problema:** Usuário aprovado na verificação facial poderia trocar suas fotos por imagens de terceiros ou celebridades mantendo o selo de verificado.
- **Controles Implementados:**
  - Ao atualizar o perfil (`PUT /api/users/me`), se o usuário já possui o selo `is_verified = 1`, o backend calcula a distância euclidiana entre o descritor facial armazenado da verificação ao vivo e os descritores faciais das novas fotos.
  - Se a menor distância exceder o limiar de similaridade (`FACE_SIMILARITY_THRESHOLD = 0.50`), o selo oficial é automaticamente revogado no banco de dados.
- **Arquivo:** [`backend/routers/users.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/users.py#L65-L94)

### 3. Proteção contra Open Proxy no YouTube Search
- **Problema:** Endpoint aberto de busca no YouTube poderia ser explorado como proxy anônimo para scraping abusivo.
- **Controles Implementados:**
  - A rota `GET /api/youtube/search` exige autenticação obrigatória de sessão (`get_current_user_id`).
  - Aplicação de limitador de 15 requisições por minuto por usuário autenticado e cache local em memória de termos frequentes.
- **Arquivo:** [`backend/routers/feed.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/feed.py#L73-L97)

### 4. CORS Dinâmico com Regex para Ambientes Pré-Produção
- **Problema:** Falhas de CORS em domínios dinâmicos ou wildcard excessivamente permissivo (`*`) com `allow_credentials=True`.
- **Controles Implementados:**
  - Implementado construtor de regex dinâmico (`build_cors_regex()`) que suporta curingas seguros de subdomínios (ex: `https://*.workers.dev`, `https://*.pages.dev`, domínios institucionais) permitindo cookies com integridade.
- **Arquivo:** [`backend/main.py`](file:///home/julian/dev/pontinho-ufabc/backend/main.py#L65-L93)

### 5. Conformidade com Direitos dos Titulares (LGPD)
- **Art. 18 (Direito de Acesso e Exportação):** Rota `GET /api/users/me/export` gera um dump estruturado em JSON com todos os dados pessoais, fotos, mensagens e interações vinculadas ao estudante.
- **Art. 16 (Direito à Eliminação):** Rota `DELETE /api/users/me` executa a exclusão definitiva e irreversível da conta e de todos os registros associados em cascata (swipes, matches, mensagens, fotos físicas e registros de auditoria).
- **Arquivo:** [`backend/routers/users.py`](file:///home/julian/dev/pontinho-ufabc/backend/routers/users.py#L170-L290)

---

## 🧪 4. Cobertura de Testes Automatizados de Segurança

A suíte de testes em [`backend/tests/test_api.py`](file:///home/julian/dev/pontinho-ufabc/backend/tests/test_api.py) valida de forma contínua as regras de segurança implementadas:

```bash
# Executar a suíte de testes automatizados
poetry run pytest backend/tests/test_api.py -v
```

### Casos de Teste Chave Implementados:
- `test_session_token_security`: Validação de tokens HMAC, rejeição de tokens adulterados ou com payload corrompido.
- `test_register_validation_short_password`: Rejeição com HTTP 400 de senhas menores que 8 caracteres.
- `test_register_validation_non_ufabc_email`: Rejeição de e-mails de provedores externos genéricos (@gmail, etc.).
- `test_register_validation_underage_blocked`: Bloqueio automático de cadastros com idade estimada $< 18$ anos.
- `test_protected_routes_require_authentication`: Confirmação de HTTP 401 para rotas privadas sem credenciais válidas.
- `test_upload_webp_image_accepted` & `test_upload_raw_jpeg_rejected`: Aceite estrito de WebP e rejeição de formatos não otimizados no servidor.
- `test_upload_direct_video_rejected`: Bloqueio de upload direto de streams de vídeo para o backend.
- `test_cors_preflight_dev_subdomain`: Validação do casamento de padrões de CORS para subdomínios confiáveis.

---

## 📋 5. Checklist de Verificação Periódica

Para novos endpoints ou módulos que venham a ser adicionados:

1. [ ] **Autenticação:** Toda rota não explicitamente pública utiliza `get_current_user_id(request)` ou `require_admin(request)`.
2. [ ] **Minimização (LGPD):** Consultas ao banco utilizam projeção explícita de colunas (evitar `SELECT *`).
3. [ ] **Validação de Entrada:** Schemas Pydantic tipados com restrições mínimas/máximas em todos os campos.
4. [ ] **Mídias Privadas:** Fotos confidenciais salvas unicamente em `private_uploads` e acessadas via rota controlada.
5. [ ] **Rate Limiting:** Endpoints de autenticação, upload e consumo de APIs externas protegidos contra *flooding*.
6. [ ] **Segurança de Segredos:** Nenhuma chave criptográfica ou credencial versionada em código (`.env` obrigatório).
