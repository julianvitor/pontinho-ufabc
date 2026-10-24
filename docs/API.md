# 📡 Documentação Oficial da API REST - Pontinho

A API do **Pontinho** é construída com **FastAPI** (Python 3.11+), seguindo rigorosamente os princípios RESTful, com payloads JSON, respostas padronizadas, autenticação criptográfica via tokens HMAC-SHA256 assinados, proteção ativa de privacidade segundo a **LGPD (Lei nº 13.709/2018)** e controles de acesso recomendados pela **OWASP**.

---

## 🔒 Autenticação e Autorização

A autenticação é exigida para a quase totalidade dos endpoints privados e pode ser transmitida por três mecanismos simultâneos:

1. **Cookie Seguro**: `pontinho_session={user_id}.{timestamp}.{signature}` (injetado automaticamente pelo endpoint de login com flags `HttpOnly=True`, `SameSite=Lax` e `Secure` dinâmico em HTTPS).
2. **Cabeçalho Bearer Padrão**: `Authorization: Bearer {token}`
3. **Cabeçalho Customizado**: `X-Session-Token: {token}`
4. **Query Parameter (Exclusivo para Mídia Privada)**: `GET /api/media/private/{filename}?token={token}` (para renderização transparente em tags HTML `<img>`).

> [!IMPORTANT]
> **Identificadores numéricos não assinados (`X-User-Id`) foram terminantemente eliminados (VULN-01)**. Toda requisição autenticada é obrigatoriamente validada pela assinatura HMAC-SHA256 com a chave secreta de ambiente `PONTINHO_SECRET_KEY`.

### Domínios Acadêmicos Permitidos para Cadastro:
- `@aluno.ufabc.edu.br`
- `@ufabc.edu.br`

---

## 📑 Índice dos Endpoints

1. [Autenticação & Sessão (`/api/auth`)](#1-autenticação--sessão-apiauth)
2. [Feed & Swipes (`/api/feed` & `/api/swipe`)](#2-feed--swipes-apifeed--apiswipe)
3. [Festas & Eventos Universitários (`/api/events`)](#3-festas--eventos-universitários-apievents)
4. [Matches, Chat & Álbum Secreto (`/api/matches`)](#4-matches-chat--álbum-secreto-apimatches)
5. [Mídia Privada do Álbum Secreto (`/api/media`)](#5-mídia-privada-do-álbum-secreto-apimedia)
6. [Usuários, Perfil & Direitos LGPD (`/api/users`)](#6-usuários-perfil--direitos-lgpd-apiusers)
7. [Upload de Mídia & GIFs Animados (`/api/upload`)](#7-upload-de-mídia--gifs-animados-apiupload)
8. [Central de Ajuda & Ouvidoria Pública (`/api/help`)](#8-central-de-ajuda--ouvidoria-pública-apihelp)
9. [Painel Administrativo & Moderação (`/api/admin`)](#9-painel-administrativo--moderação-apiadmin)

---

## 1. Autenticação & Sessão (`/api/auth`)

### `POST /api/auth/register`
Cadastra um novo estudante na plataforma.

- **Autenticação**: Não exigida.
- **Validação de Senha**: Mínimo de 8 caracteres (conforme NIST SP 800-63B).
- **Validação do ECA Digital (Lei nº 14.811/2024)**: Exige validação biométrica com prova de vida anti-fraude e idade $\ge 18$ anos processada via modelo open source on-device (`@vladmandic/face-api`).
- **Payload**:
```json
{
  "email": "estudante@aluno.ufabc.edu.br",
  "password": "senha_segura_8chars",
  "name": "Nome do Estudante",
  "terms_accepted": true,
  "age_verified": true,
  "liveness_passed": true,
  "estimated_age": 21,
  "face_snapshot": "data:image/jpeg;base64,..."
}
```
- **Resposta (200 OK)**:
```json
{
  "success": true,
  "user_id": 15,
  "token": "15.1792723162.8671c38f65d454c8dcd453bec31233ba...",
  "name": "Nome do Estudante",
  "email": "estudante@aluno.ufabc.edu.br",
  "message": "Cadastro realizado com sucesso!"
}
```

---

### `POST /api/auth/login`
Autentica o estudante, verifica o hash Argon2id (com migração transparente de senhas legadas) e emite a sessão assinada com cookies `HttpOnly`.

- **Rate Limiting**: Máximo de 5 tentativas por minuto por IP (retorna HTTP 429 com tempo restante).
- **Mensagem Genérica Anti-Enumeração**: Retorna `"E-mail acadêmico ou senha incorretos."` para qualquer erro.
- **Payload**:
```json
{
  "email": "estudante@aluno.ufabc.edu.br",
  "password": "senha_segura_8chars"
}
```
- **Resposta (200 OK)**:
```json
{
  "success": true,
  "token": "15.1792723162.8671c38f65d454c8dcd453bec31233ba...",
  "user": {
    "id": 15,
    "name": "Nome do Estudante",
    "email": "estudante@aluno.ufabc.edu.br",
    "is_admin": 0
  }
}
```

---

### `POST /api/auth/logout`
Encerra a sessão ativa removendo os cookies criptografados.

- **Resposta (200 OK)**:
```json
{
  "success": true,
  "message": "Desconectado com sucesso."
}
```

---

### `GET /api/auth/me`
Retorna os dados cadastrais do usuário autenticado na requisição.

- **Resposta (200 OK)**:
```json
{
  "authenticated": true,
  "user": {
    "id": 15,
    "name": "Nome do Estudante",
    "email": "estudante@aluno.ufabc.edu.br",
    "is_admin": 0
  }
}
```

---

## 2. Feed & Swipes (`/api/feed` & `/api/swipe`)

### `GET /api/feed`
Obtém o deck de cards de estudantes disponíveis para swipe, intercalado com anúncios institucionais/publicitários.

- **Regras e Proteções**:
  - Exclui o próprio usuário.
  - Exclui perfis já avaliados (`swipes`).
  - Exclui perfis com bloqueio mútuo (`blocks`).
  - Respeita o filtro de gênero (`target_gender`).
  - **Minimização LGPD & Allowlist Estrita (VULN-05)**: Remove dados cadastrais privados (`email`, `password_hash`).
  - **Teaser do Álbum Secreto (VULN-06)**: Apenas a primeira foto secreta é entregue e **com desfoque destrutivo Gaussiano irreversível gerado no servidor** (`secret_teaser_photo`), impedindo acesso à imagem original por inspeção.
- **Resposta (200 OK)**:
```json
{
  "cards": [
    {
      "id": 2,
      "name": "Mariana Silva",
      "age": 21,
      "campus": "Santo André",
      "course": "Neurociência",
      "specific_course": "Neurociência Computacional",
      "entity": "Enactus",
      "looking_for": "Algo sério",
      "bio": "Pesquisa em inteligência computacional e indie rock.",
      "interests": ["Neurociência", "Música Indie", "Café"],
      "photos": ["/uploads/mariana_1.webp", "/uploads/mariana_2.webp"],
      "songs": ["Arctic Monkeys - 505"],
      "has_private_content": true,
      "private_photos_count": 2,
      "secret_teaser_photo": "/uploads/teasers/teaser_2_1747c85b.webp",
      "is_ad": false
    }
  ],
  "total_profiles": 18
}
```

---

### `POST /api/swipe`
Registra uma ação de swipe (*Curtir* ou *Passar*). Caso haja like mútuo, formaliza o Match automaticamente.

- **Payload**:
```json
{
  "target_user_id": 2,
  "action": "like"
}
```
*(Valores de `action`: `"like"` ou `"pass"`)*

- **Resposta (200 OK)**:
```json
{
  "success": true,
  "match": true,
  "partner": {
    "id": 2,
    "name": "Mariana Silva",
    "photos": ["/uploads/mariana_1.webp"]
  }
}
```

---

### `POST /api/feed/reset`
Reseta o histórico de swipes do próprio usuário autenticado para permitir a reexibição dos cards de perfis no feed ("Rever perfis").

- **Autenticação**: Exigida (`get_current_user_id`).
- **Resposta (200 OK)**:
```json
{
  "success": true,
  "message": "Histórico de swipes resetado! Agora você pode ver todos os perfis novamente."
}
```

---

### `GET /api/youtube/search`
Resolve o ID de vídeo do YouTube para músicas e hinos favoritos cadastrados no perfil do estudante.

- **Autenticação**: Exigida (`get_current_user_id`).
- **Rate Limiting**: Máximo de 15 buscas por minuto por usuário autenticado (proteção contra abuso como Open Scraping Proxy).
- **Parâmetros**: `q: str` (termo de busca ou link).
- **Cache**: Respostas cacheadas em memória para reprodução instantânea.
- **Resposta (200 OK)**:
```json
{
  "videoId": "suia_i5dEZc",
  "query": "chico buarque - construção"
}
```

---


## 3. Festas & Eventos Universitários (`/api/events`)

### `GET /api/events`
Lista todas as festas e eventos universitários da UFABC ordenados cronologicamente.

- **Acesso Aberto**: Visível para visitantes públicos deslogados e usuários autenticados.
- **Proteção da Lista de Presença**:
  - Usuários **não logados**: `attendees_sample = []` e `attendees_locked: true`.
  - Usuários **autenticados**: `attendees_sample` inclui avatares dos estudantes confirmados.

---

### `GET /api/events/{event_id}`
Detalhes específicos de uma festa universitária.

- **Acesso**: Público.
- **Proteção de Dados**: A lista completa de estudantes confirmados (`attendees`) é entregue **estritamente para estudantes logados**. Visitantes recebem `attendees = []` e instrução para entrar no app.

---

### `POST /api/events/{event_id}/rsvp`
Confirma ou cancela presença na festa (exige autenticação).

- **Payload**:
```json
{
  "status": "going"
}
```
*(Valores: `"going"` ou `"not_going"`)*

---

### `POST /api/events` *(Exclusivo Administrador)*
Cadastra um novo evento universitário.
- **Regra**: O campo `title` tem limite estrito de **máximo 25 caracteres**.

---

### `PUT /api/events/{event_id}` & `DELETE /api/events/{event_id}` *(Exclusivo Administrador)*
Edita ou exclui uma festa com exclusão em cascata das confirmações de presença.

---

## 4. Matches, Chat & Álbum Secreto (`/api/matches`)

### `GET /api/matches`
Retorna as conexões ativas do estudante autenticado, última mensagem trocada e quantidade de mensagens não lidas.

---

### `GET /api/matches/{match_id}/messages`
Retorna o histórico de mensagens de texto e marca as mensagens recebidas como lidas (`read_at`).

---

### `POST /api/matches/{match_id}/messages`
Envia uma mensagem no chat do match.

- **Payload**:
```json
{
  "text": "Bora na Cervejada Geral neste sábado?"
}
```

---

### `GET /api/matches/{match_id}/private-status`
Consulta o status das autorizações do Álbum Secreto mútuo.

- **Resposta (200 OK)**:
```json
{
  "partner_id": 2,
  "partner_name": "Mariana Silva",
  "partner_has_private": true,
  "partner_private_count": 2,
  "my_request_status": "approved",
  "their_request_status": "none",
  "unlocked_content": {
    "private_photos": ["/api/media/private/626e719a6eb948e4.webp"],
    "private_bio": "Minha bio exclusiva do álbum secreto..."
  }
}
```
*(Nota: `unlocked_content` só é entregue caso `my_request_status == 'approved'`)*.

---

### `POST /api/matches/{match_id}/request-private`
Envia uma solicitação para visualizar o Álbum Secreto do parceiro de conversa.

---

### `POST /api/matches/{match_id}/respond-private`
Aprova ou recusa o acesso ao seu Álbum Secreto solicitado pelo parceiro.

- **Payload**:
```json
{
  "action": "approved"
}
```
*(Valores: `"approved"` ou `"rejected"`)*

---

### `DELETE /api/matches/{match_id}`
Desfaz a conexão (Unmatch), excluindo permanentemente a conversa e revogando qualquer autorização de álbum secreto.

---

## 5. Mídia Privada do Álbum Secreto (`/api/media`)

### `GET /api/media/private/{filename}`
Entrega protegida de fotos originais do Álbum Secreto (VULN-09).

- **Autenticação**: Obrigatória (Bearer Token, Cookie `pontinho_session` ou Query Parameter `?token=`).
- **Validação de Autorização**:
  - O solicitante deve ser o **próprio proprietário** da foto,
  - Ou **administrador** do sistema para auditoria,
  - Ou um match com solicitação **aprovada** na tabela `private_access_requests`.
- **Headers de Segurança**: `Cache-Control: private, no-cache, no-store`, impedindo cache em proxies públicos e CDNs.
- **Proteção contra Path Traversal**: Arquivo confinado estritamente ao diretório `private_uploads`.

---

## 6. Usuários, Perfil & Direitos LGPD (`/api/users`)

### `GET /api/users/me`
Retorna o perfil completo do próprio usuário (dados públicos e privados).

---

### `PUT /api/users/me`
Atualiza dados cadastrais, bio, interesses, fotos públicas e privadas. Ao salvar fotos privadas, atualiza automaticamente o teaser borrado no servidor.
- **Proteção do Selo de Verificado (Continuous Verification)**: Se o usuário possui o selo oficial de verificado (`is_verified = 1`) e atualiza/remove suas fotos sem que pelo menos uma foto contenha o rosto biométrico registrado (distância facial $\ge 0.40$), o selo de verificação é automaticamente revogado no servidor.

---

### `POST /api/users/me/verify-face`
Valida a identidade do usuário através dos descritores faciais de 128 dimensões extraídos pelo cliente e cálculo estrito de distância euclidiana ($< 0.40$) executado no backend. Concede o selo de perfil verificado (`is_verified = 1`).

- **Payload**:
```json
{
  "live_descriptor": [0.123, -0.456, ...],
  "photo_descriptors": [
    [0.120, -0.450, ...],
    [0.098, -0.412, ...]
  ]
}
```
- **Resposta (200 OK)**:
```json
{
  "success": true,
  "is_verified": true,
  "message": "Identidade confirmada! Seu perfil agora possui o selo oficial de verificado (🔵)."
}
```

---

### `GET /api/users/me/export` *(LGPD Art. 18 - Direito à Portabilidade)*
Exporta integralmente todos os dados do estudante no Pontinho em formato JSON (perfil, swipes, matches, mensagens, confirmações de festas, denúncias registradas e registros de consentimento).

---

### `DELETE /api/users/me` *(LGPD Art. 18 - Direito à Eliminação de Dados)*
Exclui permanentemente a conta e elimina todos os dados em cascata (`ON DELETE CASCADE`), limpando a sessão.

---

### `POST /api/users/{target_user_id}/block` & `POST /api/users/{target_user_id}/unblock`
Bloqueia ou desbloqueia um usuário, desfazendo conexões ativas e impedindo reaparição no feed.

---

### `POST /api/users/{target_user_id}/report`
Denuncia um usuário por violação de conduta.

- **Payload**:
```json
{
  "reason": "Uso de foto fake / Não é estudante",
  "details": "Perfil utilizando fotos de terceiros.",
  "block_user": true
}
```

---

## 7. Upload de Mídia & GIFs Animados (`/api/upload`)

### `POST /api/upload/photo`
Processa e sanitiza imagens com proteção contra DoS e Image Bombs.

- **Query Param**: `is_private=true` para direcionar a imagem ao armazenamento protegido `private_uploads` (Álbum Secreto).
- **Formatos Aceitos**: JPEG, PNG, WEBP, GIF animado (preserva frames e timings).
- **Pipelines**: Remoção total de EXIF, downscale seguro para máximo 1200x1200px, compressão WebP e moderação NudeNet.

---

## 8. Central de Ajuda & Ouvidoria Pública (`/api/help`)

### `POST /api/help/complaint`
Canal aberto para qualquer pessoa (inclusive sem conta ou login) registrar denúncias de perseguição, assédio, perfis fakes ou uso não autorizado de fotos.

- **Payload**:
```json
{
  "reporter_name": "Nome (Opcional)",
  "reporter_contact": "contato@email.com",
  "complaint_type": "fake_profile",
  "target_description": "Perfil alegando ser estudante de BC&T",
  "details": "Estão usando minhas fotos sem consentimento."
}
```

---

## 9. Painel Administrativo & Moderação (`/api/admin`)

*(Exclusivo para contas autenticadas com `is_admin = 1`)*

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/admin/overview` | Métricas gerais da plataforma (usuários, matches, mensagens, festas, denúncias) |
| `GET` | `/api/admin/reports` | Lista de usuários denunciados por outros estudantes |
| `PUT` | `/api/admin/reports/{id}/status` | Atualiza status de denúncia interna |
| `DELETE` | `/api/admin/reports/{id}` | Descarta ou arquiva denúncia interna |
| `GET` | `/api/admin/users` | Lista e gerenciamento de contas cadastradas |
| `PATCH` | `/api/admin/users/{id}/toggle-admin` | Promove ou revoga privilégios de administrador de um usuário |
| `DELETE` | `/api/admin/users/{id}` | Exclusão de conta de usuário com expurgo completo |
| `GET` | `/api/admin/ads` / `POST` / `PUT` / `DELETE` | Gestão de anúncios e campanhas intercaladas no feed |
| `GET` | `/api/admin/courses` / `POST` / `DELETE` | Gestão de cursos de graduação e pós |
| `GET` | `/api/admin/entities` / `POST` / `DELETE` | Gestão de entidades acadêmicas e atléticas |
| `GET` | `/api/admin/prompts` / `POST` / `DELETE` | Gestão de perguntas quebra-gelo para perfis |
| `GET` | `/api/admin/complaints` | Lista denúncias registradas na Ouvidoria Pública |
| `PUT` | `/api/admin/complaints/{id}/status` | Atualiza status de denúncia da ouvidoria |
| `DELETE` | `/api/admin/complaints/{id}` | Exclui denúncia da ouvidoria |
| `GET` | `/api/metadata` | Metadados públicos (cursos, entidades, perguntas, campi) |
