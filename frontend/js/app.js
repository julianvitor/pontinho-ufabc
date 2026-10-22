// Utilitários compartilhados e Engine de Demonstração Estática do Pontinho UFABC

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

    try {
      const response = await fetch(url, {
        ...options,
        headers
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
        console.warn(`[Pontinho UFABC] Backend não encontrado em ${url}. Ativando modo de demonstração estática automática.`);
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
        console.warn(`[Pontinho UFABC] Falha de rede ao conectar à API (${err.message}). Chaveando para modo de demonstração estática.`);
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
    if (!localStorage.getItem('pontinho_mock_initialized_v2')) {
      const defaultUsers = [
        {
          id: 1,
          ra: "admin",
          email: "admin@ufabc.edu.br",
          name: "Administrador UFABC",
          age: 28,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Ciência da Computação",
          entity: "Centro Acadêmico BC&T",
          looking_for: "Amizade",
          gender: "Outro",
          target_gender: "Todos",
          bio: "Conta de administração do Pontinho UFABC. Modero as entidades, cursos e publicidades.",
          interests: ["Tecnologia", "Gestão", "Café", "Open Source"],
          photos: [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "O melhor lugar para descansar na UFABC é...",
          prompt1_a: "Os puffs do piso vermelho no Bloco A.",
          prompt2_q: "Minha opinião impopular sobre o RU...",
          prompt2_a: "O suco de caju deles é injustiçado, eu acho ótimo.",
          prompt3_q: "No intervalo entre as aulas você me encontra...",
          prompt3_a: "Programando no laboratório ou caçando tomada no mezanino.",
          songs: ["Daft Punk - Harder Better Faster Stronger", "Kraftwerk - The Robots"],
          is_admin: 1
        },
        {
          id: 2,
          ra: "11202021001",
          email: "mariana.silva@aluno.ufabc.edu.br",
          name: "Mariana Silva",
          age: 21,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Neurociência",
          entity: "Atlética Geral UFABC",
          looking_for: "Algo sério",
          gender: "Mulher",
          target_gender: "Todos",
          bio: "Estudante do BC&T no 5º quadri. Amo o RU quando tem estrogonofe, viciada em café com leite do Bloco B e nos treinos de vôlei da Atlética.",
          interests: ["Vôlei", "Neurociência", "Café", "Praia", "Música Indie"],
          photos: [
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "O melhor lugar para descansar na UFABC é...",
          prompt1_a: "No gramado do Bloco A tomando sol nos dias sem prova de FUV.",
          prompt2_q: "Minha técnica infalível pra conseguir vaga no SIGAA...",
          prompt2_a: "Abrir 4 navegadores 1 minuto antes e rezar para todos os deuses do quadrimestre.",
          prompt3_q: "Um date ideal pelo ABC ou Santo André tem...",
          prompt3_a: "Pastel na feira de Santo André e depois um café pra papear sem pressa.",
          songs: ["Chico Buarque - Construção", "Arctic Monkeys - 505", "Duda Beat - Bixinho"],
          is_admin: 0
        },
        {
          id: 3,
          ra: "11202021002",
          email: "lucas.mendes@aluno.ufabc.edu.br",
          name: "Lucas Mendes",
          age: 22,
          campus: "São Bernardo do Campo",
          course: "BC&H - Bacharelado em Ciências e Humanidades",
          specific_course: "Relações Internacionais",
          entity: "Caiás",
          looking_for: "Algo casual",
          gender: "Homem",
          target_gender: "Mulheres",
          bio: "RI em SBC. Me chama pra tomar uma cerveja depois das 21h ou debater geopolítica no pátio. Gosto de cinema cult e viajar de carona.",
          interests: ["Cinema", "Geopolítica", "Cervejada", "Livros", "Rock"],
          photos: [
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "Minha opinião impopular sobre o RU...",
          prompt1_a: "A fila de SBC anda bem mais rápido que a de Santo André, aceitem.",
          prompt2_q: "A matéria que quase me fez trancar o curso foi...",
          prompt2_a: "Introdução às Humanidades com fichamento semanal de 20 páginas.",
          prompt3_q: "No intervalo entre as aulas você me encontra...",
          prompt3_a: "Na banquinha discutindo o último filme da A24.",
          songs: ["Tame Impala - The Less I Know The Better", "Tim Maia - Não Quero Dinheiro", "The Strokes - Someday"],
          is_admin: 0
        },
        {
          id: 4,
          ra: "11202021003",
          email: "beatriz.costa@aluno.ufabc.edu.br",
          name: "Bia Costa",
          age: 20,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Engenharia Aeroespacial",
          entity: "UFABC Rocket Design",
          looking_for: "Amizade",
          gender: "Mulher",
          target_gender: "Todos",
          bio: "Quero mandar foguetes pro espaço 🚀. Quando não estou no laboratório de propulsão, estou ouvindo Taylor Swift ou maratonando ficção científica.",
          interests: ["Astronomia", "Foguetes", "Taylor Swift", "Anime", "Jogos"],
          photos: [
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "O melhor lugar para descansar na UFABC é...",
          prompt1_a: "A biblioteca do Bloco B, no silêncio absoluto do último andar.",
          prompt2_q: "Se você me pagar um salgado na lanchonete do Bloco A...",
          prompt2_a: "Eu te explico como funciona a órbita de Hohmann sem complicar.",
          prompt3_q: "Minha técnica infalível pra conseguir vaga no SIGAA...",
          prompt3_a: "Fazer amizade com os veteranos pra saber quais professores não reprovam 80%.",
          songs: ["Taylor Swift - Cruel Summer", "Daft Punk - Instant Crush", "Coldplay - Yellow"],
          is_admin: 0
        },
        {
          id: 5,
          ra: "11202021004",
          email: "gabriel.santos@aluno.ufabc.edu.br",
          name: "Gabriel Santos",
          age: 23,
          campus: "Santo André",
          course: "BC&T - Bacharelado em Ciência e Tecnologia",
          specific_course: "Ciência da Computação",
          entity: "Bateria UFABC",
          looking_for: "Algo sério",
          gender: "Homem",
          target_gender: "Mulheres",
          bio: "Dev full-stack de dia, ritmista da Bateria à noite. Se você curte maratona de séries, jogar videogame e rir de memes de programação, já temos match.",
          interests: ["Programação", "Samba", "Nintendo", "Gatos", "Pizza"],
          photos: [
            "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "No intervalo entre as aulas você me encontra...",
          prompt1_a: "No ensaio da bateria tirando o estresse na caixa.",
          prompt2_q: "A matéria que quase me fez trancar o curso foi...",
          prompt2_a: "Processamento da Informação com o temido C.",
          prompt3_q: "Um date ideal pelo ABC ou Santo André tem...",
          prompt3_a: "Hambúrguer artesanal no Bairro Jardim e muitas risadas.",
          songs: ["Criolo - Não Existe Amor em SP", "Kendrick Lamar - All The Stars", "Jorge Ben Jor - Taj Mahal"],
          is_admin: 0
        },
        {
          id: 6,
          ra: "11202021005",
          email: "camila.rocha@aluno.ufabc.edu.br",
          name: "Camila Rocha",
          age: 21,
          campus: "São Bernardo do Campo",
          course: "BC&H - Bacharelado em Ciências e Humanidades",
          specific_course: "Ciências Econômicas",
          entity: "Enactus UFABC",
          looking_for: "Algo casual",
          gender: "Mulher",
          target_gender: "Todos",
          bio: "Economia em SBC, foco em projetos sociais com a Enactus. Adoro trilhas, gatos e experimentar cafés diferentes pelo ABC.",
          interests: ["Economia", "Sustentabilidade", "Trilhas", "Fotografia", "Yoga"],
          photos: [
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
          ],
          prompt1_q: "Minha opinião impopular sobre o RU...",
          prompt1_a: "A opção vegetariana muitas vezes é mais gostosa que a tradicional.",
          prompt2_q: "O melhor lugar para descansar na UFABC é...",
          prompt2_a: "Os bancos sob as árvores no pátio de São Bernardo.",
          prompt3_q: "Se você me pagar um salgado na lanchonete do Bloco A...",
          prompt3_a: "Eu te passo os melhores resumos de Economia Política.",
          songs: ["Liniker - Baby 95", "Silva - A Cor É Rosa", "Caetano Veloso - Sozinho"],
          is_admin: 0
        }
      ];

      const defaultAds = [
        {
          id: 1,
          title: "🍻 Choppada da Federal 2026",
          description: "A maior integração universitária do ABC! Open bar, 3 palcos e atrações imperdíveis no Espaço Modular.",
          image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
          button_text: "Garantir Ingresso",
          link_url: "https://ufabc.edu.br",
          is_active: 1,
          frequency: 3
        },
        {
          id: 2,
          title: "🖨️ Copiadora & Gráfica Bloco A",
          description: "Imprima suas listas de Funções de Uma Variável, slides e relatórios com 20% de desconto.",
          image_url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80",
          button_text: "Pegar Cupom",
          link_url: "https://ufabc.edu.br",
          is_active: 1,
          frequency: 4
        }
      ];

      const defaultMatches = [
        { id: 1, user1_id: 2, user2_id: 5, created_at: new Date(Date.now() - 3600000).toISOString() }
      ];

      const defaultMessages = [
        { id: 1, match_id: 1, sender_id: 5, text: "Oi Mariana! Tudo bem? Vi que você também é do BC&T!", created_at: new Date(Date.now() - 3000000).toISOString() },
        { id: 2, match_id: 1, sender_id: 2, text: "Oie Gabriel! Tudo ótimo! Você toca na Bateria né? Sempre vejo os ensaios!", created_at: new Date(Date.now() - 1500000).toISOString() },
        { id: 3, match_id: 1, sender_id: 5, text: "Toco sim! Na caixa! Bora tomar um café no Bloco A qualquer dia desses?", created_at: new Date(Date.now() - 500000).toISOString() }
      ];

      const defaultSwipes = [
        { from_user_id: 2, to_user_id: 5, action: "like" },
        { from_user_id: 5, to_user_id: 2, action: "like" }
      ];

      localStorage.setItem('pontinho_mock_users', JSON.stringify(defaultUsers));
      localStorage.setItem('pontinho_mock_ads', JSON.stringify(defaultAds));
      localStorage.setItem('pontinho_mock_matches', JSON.stringify(defaultMatches));
      localStorage.setItem('pontinho_mock_messages', JSON.stringify(defaultMessages));
      localStorage.setItem('pontinho_mock_swipes', JSON.stringify(defaultSwipes));
      localStorage.setItem('pontinho_mock_initialized_v2', 'true');
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
        throw new Error('Apenas e-mails acadêmicos da UFABC são permitidos no cadastro.');
      }

      const users = this.getUsers();
      if (users.some(u => u.email.toLowerCase() === email)) {
        throw new Error('Este e-mail já está cadastrado no Pontinho UFABC.');
      }

      const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
      const newUser = {
        id: newId,
        ra: email.split('@')[0],
        email: email,
        name: body.name || 'Estudante UFABC',
        age: 20,
        campus: 'Santo André',
        course: 'BC&T - Bacharelado em Ciência e Tecnologia',
        specific_course: 'Ciência da Computação',
        entity: 'Nenhuma / Foco no CR',
        looking_for: 'Amizade',
        gender: 'Não informado',
        target_gender: 'Todos',
        bio: 'Estudante da UFABC!',
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
        feedCards.push({ ...p, is_ad: false });
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

    // 10. Matches
    if (url.includes('/api/matches')) {
      const matches = this.getMatches();
      const users = this.getUsers();
      const messages = this.getMessages();

      const userMatches = matches.filter(m => m.user1_id === currentUserId || m.user2_id === currentUserId);
      return userMatches.map(m => {
        const partnerId = m.user1_id === currentUserId ? m.user2_id : m.user1_id;
        const partner = users.find(u => u.id === partnerId) || { name: 'Estudante UFABC', photos: [] };
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

    // Fallback genérico
    return { success: true };
  }
};

window.Pontinho = Pontinho;
window.PontinhoMock = PontinhoMock;
