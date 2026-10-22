# 📡 Documentação Oficial da API REST - Pontinho

A API do **Pontinho** é construída com **FastAPI** (Python 3.11+), seguindo os princípios REST com payloads JSON, respostas padronizadas, autenticação criptográfica via HMAC-SHA256 e segurança ativa contra extração de dados privados.

---

## 🔒 Autenticação e Autorização

A autenticação pode ser enviada por três mecanismos suportados simultaneamente:
1. **Cookie seguro**: `pontinho_session={user_id}.{timestamp}.{signature}` (injetado automaticamente pelo login).
2. **Cabeçalho Bearer**: `Authorization: Bearer {token}`
3. **Cabeçalho Customizado**: `X-Session-Token: {token}` (ou `X-User-Id: {user_id}` para testes locais).

### Domínios Acadêmicos Permitidos:
- `@aluno.ufabc.edu.br`
- `@ufabc.edu.br`

---

## 📑 Índice dos Endpoints

1. [Autenticação & Sessão (`/api/auth`)](#1-autenticação--sessão-apiauth)
2. [Feed & Swipes (`/api/feed` & `/api/swipe`)](#2-feed--swipes-apifeed--apiswipe)
3. [Festas & Eventos Universitários (`/api/events`)](#3-festas--eventos-universitários-apievents)
4. [Matches, Chat & Álbum Secreto (`/api/matches`)](#4-matches-chat--álbum-secreto-apimatches)
5. [Usuários, Perfil & Moderação (`/api/users`)](#5-usuários-perfil--moderação-apiusers)
6. [Upload de Mídia & GIFs Animados (`/api/upload`)](#6-upload-de-mídia--gifs-animados-apiupload)
7. [Painel Administrativo (`/api/admin`)](#7-painel-administrativo-apiadmin)

---

## 1. Autenticação & Sessão (`/api/auth`)

### `POST /api/auth/register`
Cadastra um novo estudante na plataforma.

- **Autenticação**: Não exigida.
- **Payload**:
```json
{
  "email": "estudante@aluno.ufabc.edu.br",
  "password": "senha_segura_123",
  "name": "Nome do Estudante",
  "ra": "11202021001",
  "terms_accepted": true
}
```
- **Resposta (200 OK)**:
```json
{
  "success": true,
  "token": "15.1729621200.7f8a9b...",
  "user": {
    "id": 15,
    "ra": "11202021001",
    "name": "Nome do Estudante",
    "email": "estudante@aluno.ufabc.edu.br",
    "is_admin": 0
  }
}
```

---

### `POST /api/auth/login`
Autentica o estudante e emite a sessão criptograficamente assinada.

- **Autenticação**: Não exigida.
- **Payload**:
```json
{
  "email": "estudante@aluno.ufabc.edu.br",
  "password": "senha_segura_123"
}
```
- **Resposta (200 OK)**:
```json
{
  "success": true,
  "token": "15.1729621200.7f8a9b...",
  "user": {
    "id": 15,
    "ra": "11202021001",
    "name": "Nome do Estudante",
    "email": "estudante@aluno.ufabc.edu.br",
    "is_admin": 0
  }
}
```

---

### `POST /api/auth/logout`
Encerra a sessão ativa removendo os cookies de autenticação.

- **Resposta (200 OK)**:
```json
{
  "success": true,
  "message": "Desconectado com sucesso."
}
```

---

### `GET /api/auth/me`
Retorna os dados do usuário autenticado na requisição.

- **Resposta (200 OK)**:
```json
{
  "authenticated": true,
  "user": {
    "id": 15,
    "name": "Nome do Estudante",
    "email": "estudante@aluno.ufabc.edu.br",
    "is_admin": 0,
    "photos": ["/uploads/abc.webp"]
  }
}
```

---

### `GET /api/auth/demo-accounts`
Retorna as contas do banco de dados para renderização dos atalhos de login rápido demo.

---

## 2. Feed & Swipes (`/api/feed` & `/api/swipe`)

### `GET /api/feed`
Obtém o feed de perfis disponíveis para swipe, intercalado com anúncios publicitários.

- **Filtros e Regras Aplicadas**:
  - Exclui o próprio usuário.
  - Exclui perfis já avaliados (`swipes`).
  - Exclui perfis com bloqueio mútuo (`blocks`).
  - Respeita o filtro de gênero (`target_gender`).
  - Intercala anúncios com base na frequência cadastrada pelo Admin.
  - **Segurança do Álbum Secreto**: Fotos privadas são removidas da resposta. Caso o perfil possua fotos secretas, o backend entrega em `secret_teaser_photo` apenas a **primeira foto já irreversivelmente borrada no servidor** (Server-Side Blur via Pillow), impedindo extração de conteúdo não autorizado.
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
      "bio": "Apaixonada por neurociência e música indie...",
      "photos": [
        "https://images.unsplash.com/photo-1516726817505-f5?w=800"
      ],
      "songs": ["Arctic Monkeys - 505", "Duda Beat - Bixinho"],
      "has_private_content": true,
      "private_photos_count": 2,
      "secret_teaser_photo": "/uploads/teasers/teaser_2_1747c85bb0ea57ed.webp",
      "is_ad": false
    },
    {
      "id": 78,
      "title": "🦊 Kit Exclusivo & Caneca Oficial",
      "description": "Caneca de tirante de alumínio 850ml e abadá exclusivo.",
      "image_url": "https://images.unsplash.com/photo-1527529482837?w=800",
      "button_text": "Pedir Kit",
      "link_url": "https://pontinho.app",
      "is_ad": true
    }
  ],
  "total_profiles": 18
}
```

---

### `POST /api/swipe`
Registra uma ação de swipe (*Curtir* ou *Passar*). Se houver like recíproco, detecta o Match instantaneamente.

- **Payload**:
```json
{
  "to_user_id": 2,
  "action": "like"
}
```
*(Valores de `action`: `"like"` ou `"pass"`)*

- **Resposta (200 OK - Match)**:
```json
{
  "success": true,
  "match": true,
  "partner": {
    "id": 2,
    "name": "Mariana Silva",
    "photos": ["https://images.unsplash.com/photo-1516726817505-f5?w=800"]
  }
}
```

---

## 3. Festas & Eventos Universitários (`/api/events`)

### `GET /api/events`
Lista todas as festas e eventos universitários ordenados cronologicamente, com contagem de confirmados e indicação de RSVP do usuário logado.

- **Resposta (200 OK)**:
```json
[
  {
    "id": 1,
    "title": "Cervejada Geral UFABC",
    "description": "6 horas de open bar, funk universitário e eletrônica.",
    "event_date": "2026-11-14 22:00",
    "location": "Espaço Modular - Santo André",
    "image_url": "https://images.unsplash.com/photo-1516450360452?w=1000",
    "ticket_url": "https://blacktag.com.br",
    "attendees_count": 14,
    "is_attending": true,
    "attendees_preview": [
      {
        "id": 4,
        "name": "Bia Costa",
        "course": "Engenharia Aeroespacial",
        "avatar": "/uploads/bia.webp"
      }
    ]
  }
]
```

---

### `GET /api/events/{event_id}`
Detalhes completos da festa com a lista de todos os estudantes que confirmaram presença.

---

### `POST /api/events/{event_id}/rsvp`
Confirma ou desmarca presença na festa.

- **Payload**:
```json
{
  "status": "going"
}
```
*(Valores aceitos: `"going"` ou `"not_going"`)*

- **Resposta (200 OK)**:
```json
{
  "success": true,
  "is_attending": true,
  "attendees_count": 15,
  "message": "Presença confirmada! Nos vemos lá! 🎉"
}
```

---

### `POST /api/events` *(Exclusivo Administrador)*
Cadastra uma nova festa universitária.

- **Regra de Validação**: O campo `title` tem **limite estrito de no máximo 25 caracteres**.
- **Payload**:
```json
{
  "title": "Cervejada Geral UFABC",
  "description": "Open bar universitário de integração.",
  "event_date": "2026-11-14 22:00",
  "location": "Espaço Modular - Santo André",
  "image_url": "/uploads/banner_festa.webp",
  "ticket_url": "https://blacktag.com.br"
}
```

---

### `PUT /api/events/{event_id}` *(Exclusivo Administrador)*
Atualiza os dados de uma festa existente (título limitado a 25 caracteres).

---

### `DELETE /api/events/{event_id}` *(Exclusivo Administrador)*
Remove o evento e apaga em cascata todos os registros de presença confirmada.

---

## 4. Matches, Chat & Álbum Secreto (`/api/matches`)

### `GET /api/matches`
Retorna todas as conversas ativas do usuário logado, incluindo a última mensagem e contador de mensagens não lidas.

---

### `GET /api/matches/{partner_id}/messages`
Retorna o histórico de mensagens e o status de autorização do álbum secreto bilateral entre os dois estudantes.

- **Resposta (200 OK)**:
```json
{
  "messages": [
    {
      "id": 101,
      "sender_id": 2,
      "text": "Oi! Vi que você também curte Tame Impala!",
      "created_at": "2026-10-22 17:30:00",
      "is_mine": false
    }
  ],
  "partner": {
    "id": 2,
    "name": "Mariana Silva",
    "private_photos": ["/uploads/privada1.webp"],
    "private_bio": "Minha bio picante e exclusiva..."
  },
  "private_access": {
    "status": "approved",
    "is_approved": true,
    "am_i_requester": true
  }
}
```
*(Nota: `private_photos` e `private_bio` só são entregues se `is_approved == true`)*.

---

### `POST /api/matches/{partner_id}/messages`
Envia uma mensagem no chat com o match.

- **Payload**:
```json
{
  "content": "Bora na Cervejada da Geral esse fim de semana?"
}
```

---

### `POST /api/matches/{partner_id}/private-access/request`
Envia no chat a solicitação para visualizar o álbum secreto do parceiro.

---

### `POST /api/matches/{partner_id}/private-access/respond`
Aprova ou recusa o pedido de visualização do álbum secreto feito pelo parceiro.

- **Payload**:
```json
{
  "action": "approve"
}
```
*(Valores: `"approve"` ou `"reject"`)*

---

### `POST /api/matches/{partner_id}/unmatch`
Desfaz o match com o usuário (remove a conexão e apaga as mensagens trocadas).

---

## 5. Usuários, Perfil & Moderação (`/api/users`)

### `GET /api/users/me`
Retorna o perfil completo do próprio usuário autenticado (incluindo fotos públicas, privadas, bio e músicas).

---

### `PUT /api/users/me`
Atualiza os dados cadastrais do perfil.
- **Regras**:
  - Mínimo de 2 fotos públicas obrigatórias (`photos`).
  - Se fotos privadas forem informadas em `private_photos`, o backend **gera ou atualiza imediatamente o teaser borrado** no servidor.

---

### `GET /api/users/{user_id}`
Visualiza o perfil público de outro estudante.

---

### `POST /api/users/report`
Registra uma denúncia contra um usuário por conduta imprópria.
- **Payload**:
```json
{
  "reported_id": 25,
  "reason": "Conteúdo impróprio / Assédio",
  "details": "Mensagens desrespeitosas no chat."
}
```

---

### `POST /api/users/block`
Bloqueia um usuário. Cria um bloqueio bidirecional permanente, impedindo que ambos apareçam no feed ou conversem.

- **Payload**:
```json
{
  "blocked_id": 25,
  "reason": "Bloqueado pelo usuário"
}
```

---

## 6. Upload de Mídia & GIFs Animados (`/api/upload`)

### `POST /api/upload/photo`
Realiza o upload seguro de fotos e **GIFs animados**.

- **Content-Type**: `multipart/form-data`
- **Campo**: `file` (arquivo JPG, PNG, WEBP ou GIF)
- **Pipelines de Segurança e Performance**:
  1. **Streaming em Chunks (64 KB)**: Limite de 10 MB, protegendo contra estouro de memória RAM.
  2. **Proteção contra Decompression Bomb**: Limite máximo de pixels configurado no Pillow.
  3. **Preservação de GIFs Animados**: Se for GIF, redimensiona proporcionalmente mantendo todos os frames e timings originais.
  4. **Fotos Estáticas**: Correção de rotação EXIF de smartphones, downscale Lanczos (máx 1200x1200px) e compressão em WebP otimizado (redução de até 90% do tamanho).
  5. **Remoção de Metadados EXIF**: Privacidade garantida com exclusão de GPS e dados do aparelho.
  6. **Moderação Automática com NudeNet**: Detecção e bloqueio automático de conteúdo ilegal ou proibido.
- **Resposta (200 OK)**:
```json
{
  "success": true,
  "url": "/uploads/c3d18e...webp",
  "filename": "c3d18e...webp",
  "original_size": 2450000,
  "compressed_size": 185000,
  "compression_ratio": "92.4%"
}
```

---

## 7. Painel Administrativo (`/api/admin`)

*(Exclusivo para contas com `is_admin = 1`)*

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/admin/stats` | Estatísticas gerais (usuários, swipes, matches, mensagens, denúncias, eventos, ads) |
| `GET` | `/api/admin/reports` | Lista de usuários denunciados com contagem e detalhes de quem denunciou |
| `GET` | `/api/admin/users` | Lista de estudantes com filtros e paginação |
| `DELETE` | `/api/admin/users/{id}` | Exclusão de conta em cascata total (swipes, matches, mensagens, uploads) |
| `GET` | `/api/admin/ads` | Lista todos os anúncios publicitários |
| `POST` | `/api/admin/ads` | Cadastra anúncio (título, link, imagem, frequência) |
| `PUT` | `/api/admin/ads/{id}` | Edita anúncio e frequência de exibição |
| `DELETE` | `/api/admin/ads/{id}` | Remove anúncio |
| `GET` | `/api/admin/courses` | Lista cursos cadastrados |
| `POST` | `/api/admin/courses` | Cadastra novo curso |
| `DELETE` | `/api/admin/courses/{id}` | Exclui curso |
| `GET` | `/api/admin/entities` | Lista entidades/atléticas universitárias |
| `POST` | `/api/admin/entities` | Cadastra nova entidade |
| `DELETE` | `/api/admin/entities/{id}` | Exclui entidade |
| `GET` | `/api/admin/prompts` | Lista quebra-gelos disponíveis para o perfil |
| `POST` | `/api/admin/prompts` | Cadastra nova pergunta de perfil |
| `DELETE` | `/api/admin/prompts/{id}` | Remove pergunta de perfil |

---

## 8. Arquivos Estáticos & Teasers

- **`/uploads/{filename}`**: Imagens públicas dos perfis, avatares e banners de festas.
- **`/uploads/teasers/{filename}`**: Imagens de teaser do Álbum Secreto processadas com **desfoque irreversível no servidor** (`radius=35`).
