import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { ProfilePage } from '../pages/ProfilePage.jsx';

describe('ProfilePage Component', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pontinho_user_id', '123');
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: 123,
    name: 'Ana Júlia',
    age: 22,
    email: 'ana.julia@aluno.ufabc.edu.br',
    campus: 'Santo André',
    course: 'BC&T - Bacharelado em Ciência e Tecnologia',
    specific_course: 'Ciência da Computação',
    entity: 'Atlética Geral',
    looking_for: 'Algo sério',
    gender: 'Mulher',
    target_gender: 'Todos',
    bio: 'Estudante de computação e apaixonada por café.',
    interests: ['Café', 'RPG', 'Música'],
    photos: ['/uploads/photo1.webp', '/uploads/photo2.webp'],
    private_photos: ['/uploads/private1.webp'],
    private_bio: 'Bio secreta para autorizados...',
    songs: ['Chico Buarque - Construção', 'Arctic Monkeys - 505'],
    prompt1_q: 'O melhor lugar para relaxar e fugir da rotina é...',
    prompt1_a: 'O jardim do bloco A',
    prompt2_q: 'Minha opinião impopular sobre primeiro encontro...',
    prompt2_a: 'Ir ao bandejão é válido sim!',
    prompt3_q: 'No intervalo entre as obrigações você me encontra...',
    prompt3_a: 'Na salinha do CA',
    is_verified: 0
  };

  const mockMetadata = {
    base_courses: [
      { name: 'BC&T - Bacharelado em Ciência e Tecnologia' },
      { name: 'BC&H - Bacharelado em Ciências e Humanidades' }
    ],
    specific_courses: [
      { name: 'Ciência da Computação' },
      { name: 'Neurociência' }
    ],
    entities: [
      { name: 'Atlética Geral' },
      { name: 'Bateria Universitária' }
    ],
    prompts: [
      { question: 'O melhor lugar para relaxar e fugir da rotina é...' },
      { question: 'Minha opinião impopular sobre primeiro encontro...' },
      { question: 'No intervalo entre as obrigações você me encontra...' }
    ]
  };

  it('renders profile loaded data and academic fields properly', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/metadata')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockMetadata
        });
      }
      if (url.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockUser
        });
      }
      return Promise.reject(new Error('not found'));
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ana Júlia')).toBeTruthy();
      expect(screen.getByDisplayValue('ana.julia@aluno.ufabc.edu.br')).toBeTruthy();
      expect(screen.getByDisplayValue('22')).toBeTruthy();
      expect(screen.getByDisplayValue('Estudante de computação e apaixonada por café.')).toBeTruthy();
    });

    // Verificação de status pendente
    expect(screen.getByText('Verifique seu Perfil')).toBeTruthy();
    expect(screen.getByText('Verificar Agora')).toBeTruthy();

    // Verificação de tags de interesse
    expect(screen.getByText('#Café')).toBeTruthy();
    expect(screen.getByText('#RPG')).toBeTruthy();

    // Verificação de músicas
    expect(screen.getByDisplayValue('Chico Buarque - Construção')).toBeTruthy();
    expect(screen.getByDisplayValue('Arctic Monkeys - 505')).toBeTruthy();

    // Verificação de LGPD
    expect(screen.getByText('Privacidade & Direitos LGPD')).toBeTruthy();
    expect(screen.getByText('Baixar Meus Dados (Portabilidade JSON)')).toBeTruthy();
    expect(screen.getByText('Excluir Minha Conta (Esquecimento)')).toBeTruthy();
  });

  it('renders verified badge when is_verified is 1', async () => {
    const verifiedUser = { ...mockUser, is_verified: 1 };
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/metadata')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockMetadata
        });
      }
      if (url.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => verifiedUser
        });
      }
      return Promise.reject(new Error('not found'));
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Perfil Verificado')).toBeTruthy();
      expect(screen.getByText('ATIVO')).toBeTruthy();
      expect(screen.getByText('Refazer Verificação 🔄')).toBeTruthy();
    });
  });

  it('allows adding and removing tags of interest', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/metadata')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockMetadata });
      }
      if (url.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockUser });
      }
      return Promise.reject(new Error('not found'));
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('#Café')).toBeTruthy();
    });

    const inputTag = screen.getByPlaceholderText('Nova tag (Ex: Vôlei, Anime, Café, RPG)');
    fireEvent.input(inputTag, { target: { value: 'Cinema' } });
    fireEvent.click(screen.getByText('+ Adicionar'));

    expect(screen.getByText('#Cinema')).toBeTruthy();
  });

  it('detects changes in profile and intercepts navigation with unsaved changes modal', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/metadata')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockMetadata });
      }
      if (url.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockUser });
      }
      return Promise.reject(new Error('not found'));
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ana Júlia')).toBeTruthy();
    });

    // Inicialmente não deve ter badge de alterações pendentes
    expect(document.getElementById('unsaved-badge')).toBeNull();

    // Modifica o campo bio
    const bioInput = screen.getByDisplayValue('Estudante de computação e apaixonada por café.');
    fireEvent.input(bioInput, { target: { value: 'Nova bio com alterações não salvas!' } });

    // Badge de alterações pendentes deve aparecer
    await waitFor(() => {
      expect(document.getElementById('unsaved-badge')).toBeTruthy();
      expect(screen.getByText(/Alterações pendentes/i)).toBeTruthy();
    });

    // Simula clique em link para navegar para fora da página
    const externalLink = document.createElement('a');
    externalLink.setAttribute('href', '/events');
    externalLink.textContent = 'Ir para Festas';
    document.body.appendChild(externalLink);

    fireEvent.click(externalLink);

    // O modal deve ser exibido com opções de Salvar e Descartar
    await waitFor(() => {
      expect(screen.getByText('Alterações Não Salvas')).toBeTruthy();
      expect(screen.getByText(/Se você sair agora, as novas alterações serão perdidas/i)).toBeTruthy();
      expect(screen.getByText(/Salvar Alterações e Sair/i)).toBeTruthy();
      expect(screen.getByText(/Descartar Alterações/i)).toBeTruthy();
      expect(screen.getByText(/Continuar Editando o Perfil/i)).toBeTruthy();
    });

    // Clica em "Continuar Editando o Perfil"
    const cancelBtn = screen.getByText(/Continuar Editando o Perfil/i);
    fireEvent.click(cancelBtn);

    // Modal deve fechar
    await waitFor(() => {
      expect(document.getElementById('unsaved-changes-modal')).toBeNull();
    });

    externalLink.remove();
  });
});
