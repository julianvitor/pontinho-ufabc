// Utilitários compartilhados e Engine de Demonstração Estática do Pontinho

const Pontinho = {
  getCurrentUserId() {
    const id = localStorage.getItem('pontinho_user_id');
    return id ? parseInt(id, 10) : null;
  },

  setCurrentUserId(id) {
    if (id === null || id === undefined) {
      localStorage.removeItem('pontinho_user_id');
      document.cookie = 'pontinho_user_id=; path=/; max-age=0';
    } else {
      localStorage.setItem('pontinho_user_id', id.toString());
      document.cookie = `pontinho_user_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
    }
  },

  // Retorna a URL base da API quando o frontend for servido em porta desacoplada (ex: 3000 com live refresh)
  getApiBase() {
    if (window.PONTINHO_API_URL) {
      return window.PONTINHO_API_URL;
    }
    if (window.location.port && window.location.port !== '8000') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return '';
  },

  // Realiza requisição para a API FastAPI ou faz fallback automático para o MockStore local
  async apiFetch(url, options = {}) {
    const headers = options.headers || {};
    const userId = this.getCurrentUserId();
    if (userId) {
      headers['X-User-Id'] = userId.toString();
    }
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    // Se estiver em protocolo file:// ou já tiver sido detectado modo estático, usa MockStore direto
    if (window.location.protocol === 'file:' || window._PONTINHO_STATIC_MODE) {
      return PontinhoMock.handle(url, options);
    }

    const targetUrl = url.startsWith('http') ? url : `${this.getApiBase()}${url}`;

    try {
      const response = await fetch(targetUrl, {
        ...options,
        headers,
        credentials: 'include'
      });

      if (response.status === 401 && !window.location.pathname.includes('login.html')) {
        // Se a rota retornou 401, remove sessão e redireciona
        this.setCurrentUserId(null);
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
          return { authenticated: false };
        }
        window.location.href = './login.html';
        throw new Error('Sessão expirada. Faça login com seu e-mail institucional.');
      }

      // Se a rota deu 404 e é uma rota da API (/api/...), muito provavelmente o frontend está sendo hospedado estaticamente (ex: GitHub Pages)
      if (response.status === 404 && url.startsWith('/api/')) {
        console.warn(`[Pontinho] Backend não encontrado em ${url}. Ativando modo de demonstração estática automática.`);
        window._PONTINHO_STATIC_MODE = true;
        return PontinhoMock.handle(url, options);
      }

      if (!response.ok) {
        let errorMsg = 'Ocorreu um erro na requisição.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      return response.json();
    } catch (err) {
      // Falha de rede (ex: servidor desligado ou site estático no GitHub Pages)
      if (url.startsWith('/api/')) {
        console.warn(`[Pontinho] Falha de rede ao conectar à API (${err.message}). Chaveando para modo de demonstração estática.`);
        window._PONTINHO_STATIC_MODE = true;
        return PontinhoMock.handle(url, options);
      }
      throw err;
    }
  },

  // Validação de autenticação
  async requireAuth() {
    const isLoginPage = window.location.pathname.includes('login.html');
    const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '';

    const userId = this.getCurrentUserId();
    if (!userId) {
      if (!isLoginPage && !isIndexPage) {
        window.location.href = './login.html';
      }
      return null;
    }

    try {
      const data = await this.apiFetch('/api/auth/me');
      if (!data || !data.authenticated) {
        this.setCurrentUserId(null);
        if (!isLoginPage && !isIndexPage) {
          window.location.href = './login.html';
        }
        return null;
      }
      return data.user;
    } catch (e) {
      if (!isLoginPage && !isIndexPage) {
        window.location.href = './login.html';
      }
      return null;
    }
  },

  // Login rápido como conta de teste demo
  loginAsDemo(userId, reload = true) {
    this.setCurrentUserId(userId);
    this.showToast('Conectando como conta de demonstração...', 'success');
    if (reload) {
      setTimeout(() => {
        window.location.href = './index.html';
      }, 300);
    }
  },

  async logout() {
    try {
      await this.apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.setCurrentUserId(null);
    window.location.href = './index.html';
  },

  // Utilitário para resolução de IDs do YouTube (usado offline ou como fallback)
  resolveLocalYouTubeId(query) {
    if (!query) return 'suia_i5dEZc';
    const q = query.trim();

    // Se já for link ou ID direto do YouTube
    const ytMatch = q.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) return ytMatch[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(q)) return q;

    const lower = q.toLowerCase();
    const dictionary = {
      'chico buarque - construção': 'suia_i5dEZc',
      'chico buarque': 'suia_i5dEZc',
      'construção': 'suia_i5dEZc',
      'arctic monkeys - 505': 'CKI8iQTgZKU',
      'arctic monkeys': 'CKI8iQTgZKU',
      '505': 'CKI8iQTgZKU',
      'duda beat - bixinho': 'gFUuxGOsMow',
      'duda beat': 'gFUuxGOsMow',
      'bixinho': 'gFUuxGOsMow',
      'tim maia - não quero dinheiro': 'FM2tZnIPZUk',
      'tim maia': 'FM2tZnIPZUk',
      'não quero dinheiro': 'FM2tZnIPZUk',
      'tame impala - the less i know the better': '2SUwOgmvzK4',
      'tame impala': '2SUwOgmvzK4',
      'daft punk - harder better faster stronger': 'gAjR4_CbPpQ',
      'daft punk - instant crush': 'a5uQMwRMHcs',
      'daft punk': 'gAjR4_CbPpQ',
      'taylor swift - cruel summer': 'ic8j13piAhQ',
      'taylor swift': 'ic8j13piAhQ',
      'gilsons - várias queixas': 'bBHPq3UQFsw',
      'gilsons': 'bBHPq3UQFsw',
      'várias queixas': 'bBHPq3UQFsw',
      'the strokes - someday': 'knU9gRUWCno',
      'the strokes': 'knU9gRUWCno',
      'coldplay - yellow': 'yKNxeF4KMsY',
      'coldplay': 'yKNxeF4KMsY',
      'criolo - não existe amor em sp': '0PfevkndCPU',
      'criolo': '0PfevkndCPU',
      'kendrick lamar - all the stars': 'JQbjS0_ZfJ0',
      'kendrick lamar': 'JQbjS0_ZfJ0',
      'jorge ben jor - taj mahal': 'rfrpOhC6858',
      'jorge ben jor': 'rfrpOhC6858',
      'liniker - baby 95': '9nbYJm9FYa0',
      'liniker': '9nbYJm9FYa0',
      'silva - a cor é rosa': 'KnJwCg-zh4w',
      'silva': 'KnJwCg-zh4w',
      'caetano veloso - sozinho': 'j9UbE1slI-Q',
      'caetano veloso': 'j9UbE1slI-Q',
      'kraftwerk - the robots': '-wop47G2qeY',
      'kraftwerk': '-wop47G2qeY',
      'the weeknd - blinding lights': '4NRXx6U8ABQ',
      'the weeknd': '4NRXx6U8ABQ',
      'vintage culture - in the dark': '8p2p5cR_jHY',
      'vintage culture': '8p2p5cR_jHY',
      'alok - hear me now': 'yFvLcxX3Y80',
      'alok': 'yFvLcxX3Y80',
      'dua lipa - levitating': 'TUVcZfQe-Kw',
      'dua lipa': 'TUVcZfQe-Kw',
      'doja cat - kiss me more': '0EVVKs6D654',
      'doja cat': '0EVVKs6D654',
      'marina sena - por supuesto': '_i_b8wFqT74',
      'marina sena': '_i_b8wFqT74',
      'baco exu do blues - me desculpa jay z': 'wz4YFq8kSjA',
      'baco exu do blues': 'wz4YFq8kSjA',
      'djonga - leal': '4e7lWfQWw-o',
      'djonga': '4e7lWfQWw-o',
      'matuê - anos luz': 'K3O_wBf_o0s',
      'matuê': 'K3O_wBf_o0s',
      'anitta - envolver': 'sa-42q_o5x8',
      'legião urbana - tempo perdido': 'rQ6n_gO758I'
    };

    for (const [key, id] of Object.entries(dictionary)) {
      if (lower.includes(key) || key.includes(lower)) {
        return id;
      }
    }

    return 'suia_i5dEZc';
  },

  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-600/30' : type === 'error' ? 'bg-rose-600 text-white shadow-rose-600/30' : 'bg-slate-800 text-white shadow-slate-900/30';
    toast.className = `${bgClass} px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-300 transform translate-y-4 opacity-0 text-xs sm:text-sm font-semibold pointer-events-auto border border-white/10`;
    toast.innerHTML = `
      <span class="text-base">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  async initNavbarUserSwitcher(selector = '#user-switcher-select') {
    const select = document.querySelector(selector);
    if (!select) return;

    try {
      const users = await this.apiFetch('/api/users/list');
      const currentId = this.getCurrentUserId();

      select.innerHTML = users.map(u => `
        <option value="${u.id}" ${u.id === currentId ? 'selected' : ''}>
          ${u.name} (${u.ra || u.email})
        </option>
      `).join('');

      select.addEventListener('change', (e) => {
        this.setCurrentUserId(parseInt(e.target.value, 10));
        this.showToast(`Perfil alternado para ${select.options[select.selectedIndex].text}`);
        setTimeout(() => window.location.reload(), 400);
      });
    } catch (e) {
      console.error('Falha ao carregar lista de usuários:', e);
    }
  }
};

// =========================================================================
// MOCK STORE & ENGINE PARA HOSPEDAGEM 100% ESTÁTICA (GITHUB PAGES / DEMO)
// =========================================================================

const PontinhoMock = {
  initStorage() {
    if (!localStorage.getItem('pontinho_mock_initialized_v4')) {
      const defaultUsers = [
        {
          id: 1,
          ra: "admin",
          email: "admin@pontinho.app",
          name: "Administrador",
          age: 28,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Ciência da Computação",
          entity: "Centro Acadêmico BC&T",
          looking_for: "Amizade",
          gender: "Outro",
          target_gender: "Todos",
          bio: "Conta de administração do Pontinho. Modero as entidades, cursos e publicidades.",
          interests: ["Tecnologia", "Gestão", "Café", "Open Source"],
          photos: [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "O melhor lugar para relaxar e fugir da rotina é...",
          prompt1_a: "No mezanino do Bloco A com um bom café e fone de ouvido.",
          prompt2_q: "Minha opinião impopular sobre primeiro encontro...",
          prompt2_a: "Conversa olho no olho supera qualquer restaurante sofisticado.",
          prompt3_q: "No intervalo entre as obrigações você me encontra...",
          prompt3_a: "Programando no laboratório ou testando novidades no Pontinho.",
          songs: ["Daft Punk - Harder Better Faster Stronger", "Kraftwerk - The Robots"],
          private_photos: [],
          private_bio: "",
          is_admin: 1
        },
        {
          id: 2,
          ra: "11202021001",
          email: "mariana.silva@pontinho.app",
          name: "Mariana Silva",
          age: 21,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Neurociência",
          entity: "Atlética Geral",
          looking_for: "Algo sério",
          gender: "Mulher",
          target_gender: "Todos",
          bio: "Pesquisadora de neurociência, vôlei de praia e viciada em café com leite. Amo dias de sol, papos profundos e boa música.",
          interests: ["Vôlei", "Neurociência", "Café", "Praia", "Música Indie"],
          photos: [
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "O melhor lugar para relaxar e fugir da rotina é...",
          prompt1_a: "No gramado tomando sol ouvindo uma playlist tranquila nos dias sem prova.",
          prompt2_q: "Minha opinião impopular sobre primeiro encontro...",
          prompt2_a: "Date em café descontraído ou pastel na feira supera qualquer lugar caro.",
          prompt3_q: "Um date ideal no fim de noite tem...",
          prompt3_a: "Vinho tinto, risada fácil e zero pressa pra ir embora.",
          songs: ["Chico Buarque - Construção", "Arctic Monkeys - 505", "Duda Beat - Bixinho"],
          private_photos: [
            "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "De dia pareço tímida e focada, mas adoro noites animadas, beijo demorado e química sem tabu. Quer descobrir mais? 🔥",
          is_admin: 0
        },
        {
          id: 3,
          ra: "11202021002",
          email: "lucas.mendes@pontinho.app",
          name: "Lucas Mendes",
          age: 22,
          campus: "São Bernardo do Campo",
          course: "BC&H - Bacharelado em Ciências e Humanidades",
          specific_course: "Relações Internacionais",
          entity: "Caiás",
          looking_for: "Algo casual",
          gender: "Homem",
          target_gender: "Mulheres",
          bio: "Relações Internacionais. Me chama pra tomar uma cerveja depois das 21h ou debater geopolítica. Gosto de cinema cult e viajar na estrada.",
          interests: ["Cinema", "Geopolítica", "Cervejada", "Livros", "Rock"],
          photos: [
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "Minha opinião impopular sobre primeiro encontro...",
          prompt1_a: "Se o papo não fluir nos primeiros 15 minutos, pedir a saideira é sinal de maturidade.",
          prompt2_q: "No intervalo entre as obrigações você me encontra...",
          prompt2_a: "No pátio tomando uma com quem quiser trocar ideia boa.",
          prompt3_q: "Um date ideal no fim de noite tem...",
          prompt3_a: "Carona ouvindo indie rock pelas avenidas desertas da cidade.",
          songs: ["Tame Impala - The Less I Know The Better", "Tim Maia - Não Quero Dinheiro", "The Strokes - Someday"],
          private_photos: [
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "Gosto de olhares provocantes, pele quente e química daquelas que não precisa de explicação formal. 😉",
          is_admin: 0
        },
        {
          id: 4,
          ra: "11202021003",
          email: "beatriz.costa@pontinho.app",
          name: "Bia Costa",
          age: 20,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Engenharia Aeroespacial",
          entity: "Rocket Design",
          looking_for: "Amizade",
          gender: "Mulher",
          target_gender: "Todos",
          bio: "Quero mandar foguetes pro espaço 🚀. Quando não estou em projetos de propulsão, estou maratonando sci-fi ou ouvindo Taylor Swift.",
          interests: ["Astronomia", "Foguetes", "Taylor Swift", "Anime", "Jogos"],
          photos: [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "O melhor lugar para relaxar e fugir da rotina é...",
          prompt1_a: "O mezanino silencioso da biblioteca no final da tarde.",
          prompt2_q: "Se você me chamar pra sair agora...",
          prompt2_a: "Eu aceito se envolver açaí ou hambúrguer bem recheado.",
          prompt3_q: "Minha técnica infalível pra quebrar o gelo...",
          prompt3_a: "Perguntar qual teoria da conspiração você secretamente acredita.",
          songs: ["Taylor Swift - Cruel Summer", "Daft Punk - Instant Crush", "Coldplay - Yellow"],
          private_photos: [
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "Mente lógica com um lado nada comportado: beijo no pescoço, quarto escuro e conexões que pegam fogo. Me peça acesso. 🚀✨",
          is_admin: 0
        },
        {
          id: 5,
          ra: "11202021004",
          email: "gabriel.santos@pontinho.app",
          name: "Gabriel Santos",
          age: 23,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Ciência da Computação",
          entity: "Bateria Universitária",
          looking_for: "Algo sério",
          gender: "Homem",
          target_gender: "Mulheres",
          bio: "Programador de dia, ritmista da bateria à noite. Curto maratona de séries, jogar videogame e rir de memes de tecnologia.",
          interests: ["Programação", "Samba", "Nintendo", "Gatos", "Pizza"],
          photos: [
            "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "No intervalo entre as obrigações você me encontra...",
          prompt1_a: "No ensaio tirando o estresse na caixa ou jogando Smash.",
          prompt2_q: "A matéria ou desafio que quase me enlouqueceu...",
          prompt2_a: "Entender ponteiros em C na primeira semana do semestre.",
          prompt3_q: "Um date ideal no fim de noite tem...",
          prompt3_a: "Hambúrguer artesanal e aquela sintonia que não cansa.",
          songs: ["Criolo - Não Existe Amor em SP", "Kendrick Lamar - All The Stars", "Jorge Ben Jor - Taj Mahal"],
          private_photos: [
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "Pegada firme e ritmo intenso dentro e fora dos palcos. Me conquista com atitude e iniciativa. Se pedir com carinho, libero meu álbum secreto. 🔥",
          is_admin: 0
        },
        {
          id: 6,
          ra: "11202021005",
          email: "camila.rocha@pontinho.app",
          name: "Camila Rocha",
          age: 21,
          campus: "São Bernardo do Campo",
          course: "BC&H - Bacharelado em Ciências e Humanidades",
          specific_course: "Ciências Econômicas",
          entity: "Enactus",
          looking_for: "Algo casual",
          gender: "Mulher",
          target_gender: "Todos",
          bio: "Economia e sustentabilidade. Adoro trilhas, gatos e descobrir cafeterias aconchegantes para ler ou prosear.",
          interests: ["Economia", "Sustentabilidade", "Trilhas", "Fotografia", "Yoga"],
          photos: [
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "Minha opinião impopular sobre primeiro encontro...",
          prompt1_a: "Quem escolhe o local primeiro tem direito a provar a sobremesa do outro.",
          prompt2_q: "O melhor lugar para relaxar e fugir da rotina é...",
          prompt2_a: "No meio da natureza respirando ar puro e sem sinal no celular.",
          prompt3_q: "Se você me chamar pra sair agora...",
          prompt3_a: "Coloco meu melhor look em 15 minutos e topo a aventura.",
          songs: ["Liniker - Baby 95", "Silva - A Cor É Rosa", "Caetano Veloso - Sozinho"],
          private_photos: [
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "Equilíbrio entre calmaria de dia e intensidade quente à noite. Se você for ousado e direto ao ponto, ganha pontos comigo. 💋",
          is_admin: 0
        },
        {
          id: 7,
          ra: "11202021006",
          email: "rodrigo.alves@pontinho.app",
          name: "Rodrigo Alves",
          age: 24,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Engenharia de Gestão",
          entity: "Baja",
          looking_for: "Algo sério",
          gender: "Homem",
          target_gender: "Mulheres",
          bio: "Treino pesado, fã de eletrônica e viagens de última hora. Gosto de quem tem energia contagiante e não tem medo de viver momentos intensos.",
          interests: ["Musculação", "Baja", "Eletrônica", "Viagens", "Churrasco"],
          photos: [
            "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "Minha opinião impopular sobre primeiro encontro...",
          prompt1_a: "Primeiro date tem que ter energia lá em cima, nada de sono ou lamentação.",
          prompt2_q: "Se você me chamar pra sair agora...",
          prompt2_a: "Passo aí em meia hora e a gente decide o destino na estrada.",
          prompt3_q: "Um date ideal no fim de noite tem...",
          prompt3_a: "Música alta, beijo que rouba o fôlego e vontade de não dormir.",
          songs: ["The Weeknd - Blinding Lights", "Vintage Culture - In The Dark", "Alok - Hear Me Now"],
          private_photos: [
            "https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "Gosto de conduzir, abraço forte e uma boa dose de adrenalina a dois. Quer ver o que não mostro pra qualquer um? Clica em pedir acesso. 🔥",
          is_admin: 0
        },
        {
          id: 8,
          ra: "11202021007",
          email: "isabela.martins@pontinho.app",
          name: "Isabela Martins",
          age: 22,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Biotecnologia",
          entity: "Centro Acadêmico BC&T",
          looking_for: "Algo casual",
          gender: "Mulher",
          target_gender: "Todos",
          bio: "Pesquisadora de bancada, fã de festivais e apaixonada por vinho tinto. Se você tiver papo interessante e me fizer rir, metade do caminho tá feito.",
          interests: ["Biotecnologia", "Vinho", "Festivais", "Moda", "Fotografia"],
          photos: [
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "Minha técnica infalível pra quebrar o gelo...",
          prompt1_a: "Olhar nos olhos, dar um sorriso de lado e dizer o que ninguém tem coragem de falar.",
          prompt2_q: "O melhor lugar para relaxar e fugir da rotina é...",
          prompt2_a: "Em um rooftop tomando um drink com boa vista.",
          prompt3_q: "Um date ideal no fim de noite tem...",
          prompt3_a: "Provocações sutis que viram algo muito mais quente.",
          songs: ["Dua Lipa - Levitating", "Doja Cat - Kiss Me More", "Marina Sena - Por Supuesto"],
          private_photos: [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "Intensa, curiosa e sem tempo pra joguinhos mornos. Gosto de cumplicidade quente entre quatro paredes. Peça acesso se tiver atitude. 😉✨",
          is_admin: 0
        },
        {
          id: 9,
          ra: "11202021008",
          email: "felipe.ramos@pontinho.app",
          name: "Felipe Ramos",
          age: 23,
          campus: "São Bernardo do Campo",
          course: "BC&H - Bacharelado em Ciências e Humanidades",
          specific_course: "Ciências Econômicas",
          entity: "Caiás",
          looking_for: "Algo casual",
          gender: "Homem",
          target_gender: "Mulheres",
          bio: "Debates acalorados, hip-hop, basquete de rua e rolês espontâneos. Se o plano for bom e a companhia melhor ainda, tô dentro.",
          interests: ["Hip-Hop", "Basquete", "Economia", "Streetwear", "Cinema"],
          photos: [
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "A matéria ou desafio que quase me enlouqueceu...",
          prompt1_a: "Provas longas de cálculo emendadas com entrega de artigo no mesmo dia.",
          prompt2_q: "Minha opinião impopular sobre primeiro encontro...",
          prompt2_a: "Se não houver química no beijo, não adianta forçar segundo date.",
          prompt3_q: "Um date ideal no fim de noite tem...",
          prompt3_a: "Conversa sussurrada e zero vontade de ir embora.",
          songs: ["Baco Exu do Blues - Me Desculpa Jay Z", "Djonga - Leal", "Matuê - Anos Luz"],
          private_photos: [
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80"
          ],
          private_bio: "Voz firme, beijo com pegada e zero limites pra quem desperta meu lado mais quente. Vem conferir. 🔥",
          is_admin: 0
        }
      ];

      const defaultAds = [
        {
          id: 1,
          title: "🍻 Festa Integração 2026",
          description: "A maior integração universitária! Open bar, 3 palcos e atrações imperdíveis. Lote 2 esgotando!",
          image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
          button_text: "Garantir Ingresso",
          link_url: "https://pontinho.app",
          is_active: 1,
          frequency: 3
        },
        {
          id: 2,
          title: "🖨️ Gráfica & Coworking Universitário",
          description: "Imprima suas apostilas, projetos e relatórios com desconto especial para membros do Pontinho.",
          image_url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80",
          button_text: "Pegar Cupom",
          link_url: "https://pontinho.app",
          is_active: 1,
          frequency: 4
        }
      ];

      const defaultMatches = [
        { id: 1, user1_id: 2, user2_id: 5, created_at: new Date(Date.now() - 3600000).toISOString() }
      ];

      const defaultMessages = [
        { id: 1, match_id: 1, sender_id: 5, text: "Oi Mariana! Tudo bem? Vi que você também curte indie e vôlei!", created_at: new Date(Date.now() - 3000000).toISOString() },
        { id: 2, match_id: 1, sender_id: 2, text: "Oie Gabriel! Tudo ótimo! Você toca na Bateria né? Curti muito sua vibe!", created_at: new Date(Date.now() - 1500000).toISOString() },
        { id: 3, match_id: 1, sender_id: 5, text: "Toco sim! Na caixa! Bora tomar um drink ou café qualquer dia desses?", created_at: new Date(Date.now() - 500000).toISOString() }
      ];

      const defaultSwipes = [
        { from_user_id: 2, to_user_id: 5, action: "like" },
        { from_user_id: 5, to_user_id: 2, action: "like" }
      ];

      const defaultPrivateRequests = [];

      localStorage.setItem('pontinho_mock_users', JSON.stringify(defaultUsers));
      localStorage.setItem('pontinho_mock_ads', JSON.stringify(defaultAds));
      localStorage.setItem('pontinho_mock_matches', JSON.stringify(defaultMatches));
      localStorage.setItem('pontinho_mock_messages', JSON.stringify(defaultMessages));
      localStorage.setItem('pontinho_mock_swipes', JSON.stringify(defaultSwipes));
      localStorage.setItem('pontinho_mock_private_requests', JSON.stringify(defaultPrivateRequests));
      localStorage.setItem('pontinho_mock_initialized_v4', 'true');
    }
  },

  getUsers() {
    this.initStorage();
    return JSON.parse(localStorage.getItem('pontinho_mock_users') || '[]');
  },

  saveUsers(users) {
    localStorage.setItem('pontinho_mock_users', JSON.stringify(users));
  },

  getSwipes() {
    this.initStorage();
    return JSON.parse(localStorage.getItem('pontinho_mock_swipes') || '[]');
  },

  saveSwipes(swipes) {
    localStorage.setItem('pontinho_mock_swipes', JSON.stringify(swipes));
  },

  getMatches() {
    this.initStorage();
    return JSON.parse(localStorage.getItem('pontinho_mock_matches') || '[]');
  },

  saveMatches(matches) {
    localStorage.setItem('pontinho_mock_matches', JSON.stringify(matches));
  },

  getMessages() {
    this.initStorage();
    return JSON.parse(localStorage.getItem('pontinho_mock_messages') || '[]');
  },

  saveMessages(messages) {
    localStorage.setItem('pontinho_mock_messages', JSON.stringify(messages));
  },

  getAds() {
    this.initStorage();
    return JSON.parse(localStorage.getItem('pontinho_mock_ads') || '[]');
  },

  saveAds(ads) {
    localStorage.setItem('pontinho_mock_ads', JSON.stringify(ads));
  },

  getPrivateRequests() {
    this.initStorage();
    return JSON.parse(localStorage.getItem('pontinho_mock_private_requests') || '[]');
  },

  savePrivateRequests(reqs) {
    localStorage.setItem('pontinho_mock_private_requests', JSON.stringify(reqs));
  },

  // Roteador de endpoints estáticos
  async handle(url, options = {}) {
    this.initStorage();
    const method = (options.method || 'GET').toUpperCase();
    const currentUserId = Pontinho.getCurrentUserId();
    const body = options.body ? JSON.parse(options.body) : {};

    // 1. Auth Me
    if (url.includes('/api/auth/me')) {
      const users = this.getUsers();
      const user = users.find(u => u.id === currentUserId);
      return {
        authenticated: !!user,
        user: user || null
      };
    }

    // 2. Auth Login
    if (url.includes('/api/auth/login')) {
      const email = (body.email || '').toLowerCase().trim();
      const users = this.getUsers();
      const user = users.find(u => {
        const uEmail = (u.email || '').toLowerCase();
        const uRa = (u.ra || '').toLowerCase();
        return uEmail === email || uRa === email || uEmail.startsWith(email + '@');
      });

      if (!user) {
        throw new Error('E-mail ou RA não encontrado no sistema.');
      }

      Pontinho.setCurrentUserId(user.id);
      return {
        success: true,
        user: user,
        message: 'Login realizado com sucesso!'
      };
    }

    // 3. Auth Register
    if (url.includes('/api/auth/register')) {
      let email = (body.email || '').toLowerCase().trim();
      if (!email.includes('@')) {
        email += '@aluno.ufabc.edu.br';
      }
      if (!email.endsWith('@aluno.ufabc.edu.br') && !email.endsWith('@ufabc.edu.br')) {
        throw new Error('E-mail institucional necessário no cadastro.');
      }

      const users = this.getUsers();
      if (users.some(u => u.email.toLowerCase() === email)) {
        throw new Error('Este e-mail já está cadastrado no Pontinho.');
      }

      const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
      const newUser = {
        id: newId,
        ra: email.split('@')[0],
        email: email,
        name: body.name || 'Estudante',
        age: 20,
        campus: 'Santo André',
        course: 'BC&T - Bacharelado em Ciência e Tecnologia',
        specific_course: 'Ciência da Computação',
        entity: 'Nenhuma / Foco no CR',
        looking_for: 'Amizade',
        gender: 'Não informado',
        target_gender: 'Todos',
        bio: 'Estudante no Pontinho!',
        interests: ['UFABC'],
        photos: [
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80'
        ],
        prompt1_q: 'O melhor lugar para descansar na UFABC é...',
        prompt1_a: 'Biblioteca',
        prompt2_q: 'Minha opinião impopular sobre o RU...',
        prompt2_a: 'Gosto da comida',
        prompt3_q: 'No intervalo entre as aulas você me encontra...',
        prompt3_a: 'Bloco A',
        is_admin: 0
      };

      users.push(newUser);
      this.saveUsers(users);
      Pontinho.setCurrentUserId(newUser.id);

      return {
        success: true,
        user_id: newId,
        name: newUser.name,
        email: newUser.email,
        message: 'Cadastro realizado com sucesso!'
      };
    }

    // 4. Auth Logout
    if (url.includes('/api/auth/logout')) {
      Pontinho.setCurrentUserId(null);
      return { success: true };
    }

    // 5. Metadata
    if (url.includes('/api/metadata')) {
      return {
        base_courses: [
          { name: "BC&T - Bacharelado em Ciência e Tecnologia" },
          { name: "BC&H - Bacharelado em Ciências e Humanidades" },
          { name: "LC&T - Licenciatura em Ciências e Tecnologia" },
          { name: "LCH - Licenciatura em Ciências Humanas" }
        ],
        specific_courses: [
          { name: "Ciência da Computação" },
          { name: "Engenharia de Gestão" },
          { name: "Engenharia Aeroespacial" },
          { name: "Engenharia Biomédica" },
          { name: "Engenharia de Energia" },
          { name: "Neurociência" },
          { name: "Biotecnologia" },
          { name: "Relações Internacionais" },
          { name: "Ciências Econômicas" },
          { name: "Filosofia" }
        ],
        entities: [
          { name: "Atlética Geral UFABC" },
          { name: "Bateria UFABC" },
          { name: "Caiás" },
          { name: "Baja UFABC" },
          { name: "Centro Acadêmico BC&T" },
          { name: "UFABC Rocket Design" },
          { name: "Enactus UFABC" },
          { name: "Nenhuma / Foco no CR" }
        ],
        prompts: [
          { question: "O melhor lugar para descansar na UFABC é..." },
          { question: "Minha técnica infalível pra conseguir vaga no SIGAA..." },
          { question: "Minha opinião impopular sobre o RU..." },
          { question: "No intervalo entre as aulas você me encontra..." },
          { question: "A matéria que quase me fez trancar o curso foi..." },
          { question: "Um date ideal pelo ABC ou Santo André tem..." },
          { question: "Se você me pagar um salgado na lanchonete do Bloco A..." }
        ]
      };
    }

    // 6. Feed de Swipes
    if (url.includes('/api/feed')) {
      const users = this.getUsers();
      const currentUser = users.find(u => u.id === currentUserId) || users[0];
      const targetGender = currentUser.target_gender || 'Todos';

      const swipes = this.getSwipes().filter(s => s.from_user_id === currentUserId);
      const swipedUserIds = new Set(swipes.map(s => s.to_user_id));

      let availableProfiles = users.filter(u => u.id !== currentUserId && !swipedUserIds.has(u.id));

      // Aplica filtro de gênero que busca
      if (targetGender === 'Mulheres') {
        availableProfiles = availableProfiles.filter(u => u.gender === 'Mulher');
      } else if (targetGender === 'Homens') {
        availableProfiles = availableProfiles.filter(u => u.gender === 'Homem');
      } else if (targetGender === 'Não-binário') {
        availableProfiles = availableProfiles.filter(u => u.gender === 'Não-binário');
      }

      const ads = this.getAds().filter(a => a.is_active);
      const feedCards = [];
      let cardCount = 0;
      let adIdx = 0;
      const freq = (ads[0] && ads[0].frequency) || 3;

      for (const p of availableProfiles) {
        const privPhotos = p.private_photos || [];
        const privBio = p.private_bio || '';
        const hasPrivate = Boolean(privPhotos.length || (privBio && privBio.trim()));
        const countPrivate = privPhotos.length;
        const sanitized = { 
          ...p, 
          has_private_content: hasPrivate, 
          private_photos_count: countPrivate, 
          is_ad: false 
        };
        delete sanitized.private_photos;
        delete sanitized.private_bio;
        feedCards.push(sanitized);
        cardCount++;
        if (ads.length > 0 && cardCount % freq === 0) {
          feedCards.push({ ...ads[adIdx % ads.length], is_ad: true });
          adIdx++;
        }
      }

      return {
        cards: feedCards,
        total_profiles: availableProfiles.length
      };
    }

    // 7. Post Swipe
    if (url.includes('/api/swipe') && method === 'POST') {
      const { target_user_id, action } = body;
      const swipes = this.getSwipes();
      const existingIdx = swipes.findIndex(s => s.from_user_id === currentUserId && s.to_user_id === target_user_id);
      if (existingIdx >= 0) {
        swipes[existingIdx].action = action;
      } else {
        swipes.push({ from_user_id: currentUserId, to_user_id: target_user_id, action });
      }
      this.saveSwipes(swipes);

      let matched = false;
      let matchUser = null;

      if (action === 'like') {
        // Verifica se o outro usuário deu like ou se é mock like recíproco
        const reciprocal = swipes.find(s => s.from_user_id === target_user_id && s.to_user_id === currentUserId && s.action === 'like');
        // Para demo estática, dá match se o recíproco existe OU 50% de chance para interatividade se não existir
        if (reciprocal || Math.random() > 0.4) {
          matched = true;
          const users = this.getUsers();
          matchUser = users.find(u => u.id === target_user_id);

          const matches = this.getMatches();
          const u1 = Math.min(currentUserId, target_user_id);
          const u2 = Math.max(currentUserId, target_user_id);
          if (!matches.some(m => Math.min(m.user1_id, m.user2_id) === u1 && Math.max(m.user1_id, m.user2_id) === u2)) {
            const newMatchId = matches.length > 0 ? Math.max(...matches.map(m => m.id)) + 1 : 1;
            matches.push({ id: newMatchId, user1_id: u1, user2_id: u2, created_at: new Date().toISOString() });
            this.saveMatches(matches);
          }
        }
      }

      return {
        success: true,
        matched: matched,
        match_user: matchUser
      };
    }

    // 8. Users Me
    if (url.includes('/api/users/me')) {
      const users = this.getUsers();
      const user = users.find(u => u.id === currentUserId);
      if (method === 'GET') {
        if (!user) throw new Error('Usuário não encontrado.');
        return user;
      }
      if (method === 'PUT') {
        const idx = users.findIndex(u => u.id === currentUserId);
        if (idx < 0) throw new Error('Usuário não encontrado.');
        users[idx] = { ...users[idx], ...body, id: currentUserId };
        this.saveUsers(users);
        return { success: true, message: 'Perfil atualizado com sucesso!' };
      }
    }

    // 9. Users List
    if (url.includes('/api/users/list')) {
      return this.getUsers().map(u => ({ id: u.id, name: u.name, ra: u.ra, email: u.email }));
    }

    // 9.1 Private Access Status
    if (url.includes('/private-status')) {
      const matchId = parseInt(url.split('/api/matches/')[1].split('/private-status')[0], 10);
      const matches = this.getMatches();
      const match = matches.find(m => m.id === matchId && (m.user1_id === currentUserId || m.user2_id === currentUserId));
      if (!match) throw new Error('Match não encontrado ou acesso não autorizado.');
      const partnerId = match.user1_id === currentUserId ? match.user2_id : match.user1_id;
      const users = this.getUsers();
      const partner = users.find(u => u.id === partnerId);
      const partnerPrivPhotos = (partner && partner.private_photos) || [];
      const partnerPrivBio = (partner && partner.private_bio) || '';
      const partnerHasPrivate = Boolean(partnerPrivPhotos.length || (partnerPrivBio && partnerPrivBio.trim()));

      const reqs = this.getPrivateRequests();
      const reqByMe = reqs.find(r => r.match_id === matchId && r.requester_id === currentUserId && r.target_id === partnerId);
      const reqByThem = reqs.find(r => r.match_id === matchId && r.requester_id === partnerId && r.target_id === currentUserId);

      const myStatus = reqByMe ? reqByMe.status : 'none';
      const theirStatus = reqByThem ? reqByThem.status : 'none';

      let unlockedContent = null;
      if (myStatus === 'approved' && partnerHasPrivate) {
        unlockedContent = {
          private_photos: partnerPrivPhotos,
          private_bio: partnerPrivBio
        };
      }

      return {
        partner_id: partnerId,
        partner_name: partner ? partner.name : '',
        partner_has_private: partnerHasPrivate,
        partner_private_count: partnerPrivPhotos.length,
        my_request_status: myStatus,
        their_request_status: theirStatus,
        unlocked_content: unlockedContent
      };
    }

    // 9.2 Request Private Access
    if (url.includes('/request-private') && method === 'POST') {
      const matchId = parseInt(url.split('/api/matches/')[1].split('/request-private')[0], 10);
      const matches = this.getMatches();
      const match = matches.find(m => m.id === matchId && (m.user1_id === currentUserId || m.user2_id === currentUserId));
      if (!match) throw new Error('Match não encontrado ou acesso não autorizado.');
      const partnerId = match.user1_id === currentUserId ? match.user2_id : match.user1_id;

      const reqs = this.getPrivateRequests();
      const existingIdx = reqs.findIndex(r => r.requester_id === currentUserId && r.target_id === partnerId);
      if (existingIdx >= 0) {
        reqs[existingIdx].status = 'pending';
        reqs[existingIdx].match_id = matchId;
      } else {
        reqs.push({ match_id: matchId, requester_id: currentUserId, target_id: partnerId, status: 'pending' });
      }
      this.savePrivateRequests(reqs);

      // Injeta mensagem no chat
      const messages = this.getMessages();
      const newMsgId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;
      messages.push({
        id: newMsgId,
        match_id: matchId,
        sender_id: currentUserId,
        text: '🔒 Pediu acesso às suas fotos e bio privadas.',
        created_at: new Date().toISOString()
      });
      this.saveMessages(messages);

      return { success: true, status: 'pending', message: 'Solicitação enviada!' };
    }

    // 9.3 Respond Private Access
    if (url.includes('/respond-private') && method === 'POST') {
      const matchId = parseInt(url.split('/api/matches/')[1].split('/respond-private')[0], 10);
      const matches = this.getMatches();
      const match = matches.find(m => m.id === matchId && (m.user1_id === currentUserId || m.user2_id === currentUserId));
      if (!match) throw new Error('Match não encontrado ou acesso não autorizado.');
      const partnerId = match.user1_id === currentUserId ? match.user2_id : match.user1_id;

      const action = body.action;
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const reqs = this.getPrivateRequests();
      const existingIdx = reqs.findIndex(r => r.requester_id === partnerId && r.target_id === currentUserId);
      if (existingIdx >= 0) {
        reqs[existingIdx].status = newStatus;
      } else {
        reqs.push({ match_id: matchId, requester_id: partnerId, target_id: currentUserId, status: newStatus });
      }
      this.savePrivateRequests(reqs);

      // Injeta mensagem no chat
      const messages = this.getMessages();
      const newMsgId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;
      const notice = newStatus === 'approved' ? '🔓 Liberou o acesso às fotos e bio privadas!' : '🚫 Recusou o pedido de acesso privado.';
      messages.push({
        id: newMsgId,
        match_id: matchId,
        sender_id: currentUserId,
        text: notice,
        created_at: new Date().toISOString()
      });
      this.saveMessages(messages);

      return { success: true, status: newStatus };
    }

    // 10. Matches
    if (url.includes('/api/matches')) {
      const matches = this.getMatches();
      const users = this.getUsers();
      const messages = this.getMessages();

      const userMatches = matches.filter(m => m.user1_id === currentUserId || m.user2_id === currentUserId);
      return userMatches.map(m => {
        const partnerId = m.user1_id === currentUserId ? m.user2_id : m.user1_id;
        const partner = users.find(u => u.id === partnerId) || { name: 'Estudante', photos: [] };
        const matchMsgs = messages.filter(msg => msg.match_id === m.id);
        const lastMsg = matchMsgs[matchMsgs.length - 1] || null;

        return {
          match_id: m.id,
          matched_at: m.created_at,
          partner: partner,
          last_message: lastMsg
        };
      });
    }

    // 11. Messages
    if (url.includes('/api/messages/')) {
      const matchId = parseInt(url.split('/api/messages/')[1].split('?')[0], 10);
      const messages = this.getMessages();

      if (method === 'GET') {
        const matchMsgs = messages.filter(m => m.match_id === matchId);
        return {
          match_id: matchId,
          messages: matchMsgs.map(m => ({
            id: m.id,
            match_id: m.id,
            sender_id: m.sender_id,
            is_me: m.sender_id === currentUserId,
            text: m.text,
            created_at: m.created_at
          }))
        };
      }

      if (method === 'POST') {
        const text = (body.text || '').trim();
        if (!text) throw new Error('Mensagem vazia');
        const newMsgId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;
        const newMsg = {
          id: newMsgId,
          match_id: matchId,
          sender_id: currentUserId,
          text: text,
          created_at: new Date().toISOString()
        };
        messages.push(newMsg);
        this.saveMessages(messages);

        return {
          success: true,
          message: {
            ...newMsg,
            is_me: true
          }
        };
      }
    }

    // 12. Admin Overview
    if (url.includes('/api/admin/overview')) {
      const users = this.getUsers();
      const matches = this.getMatches();
      const messages = this.getMessages();
      const ads = this.getAds();
      return {
        total_users: users.length,
        total_matches: matches.length,
        total_messages: messages.length,
        total_ads: ads.length
      };
    }

    // 13. Admin Reset Swipes
    if (url.includes('/api/admin/reset-swipes')) {
      const swipes = this.getSwipes().filter(s => s.from_user_id !== currentUserId);
      this.saveSwipes(swipes);
      return { success: true, message: 'Histórico de swipes resetado!' };
    }

    // 14. YouTube Search Mock
    if (url.includes('/api/youtube/search')) {
      const qMatch = url.match(/[?&]q=([^&]+)/);
      const query = qMatch ? decodeURIComponent(qMatch[1]) : '';
      const videoId = Pontinho.resolveLocalYouTubeId(query);
      return { videoId, query };
    }

    // Fallback genérico
    return { success: true };
  }
};

window.Pontinho = Pontinho;
window.PontinhoMock = PontinhoMock;
