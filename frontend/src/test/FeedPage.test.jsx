import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { FeedPage } from '../pages/FeedPage.jsx';
import { setCurrentUserId } from '../services/api.js';

describe('FeedPage Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders landing hero and CTAs when not logged in', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => []
    });

    render(<FeedPage />);
    expect(screen.getByText(/apenas para membros da UFABC/i)).toBeTruthy();
    expect(screen.getByText('Criar Conta')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
  });

  it('renders card with student details when logged in', async () => {
    setCurrentUserId(1, 'mock_token');

    const mockFeed = {
      cards: [
        {
          id: 2,
          name: 'Sabrina Carpenter',
          age: 21,
          campus: 'São Bernardo do Campo',
          course: 'BC&H',
          specific_course: 'Relações Internacionais',
          entity: 'Bateria Universitária',
          looking_for: 'Algo casual',
          photos: ['https://images.unsplash.com/photo-1'],
          songs: ['Sabrina Carpenter - Espresso'],
          is_verified: true
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockFeed
    });

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText('Sabrina Carpenter')).toBeTruthy();
      expect(screen.getByText('21')).toBeTruthy();
      expect(screen.getByText(/Relações Internacionais/i)).toBeTruthy();
      expect(screen.getByText(/Bateria Universitária/i)).toBeTruthy();
      expect(screen.getByText(/Espresso/i)).toBeTruthy();
    });
  });

  it('renders like and nope stamps on card', async () => {
    setCurrentUserId(1, 'mock_token');

    const mockFeed = {
      cards: [
        {
          id: 3,
          name: 'Eren Jaeger',
          age: 22,
          campus: 'Santo André',
          course: 'BC&T',
          entity: 'Atlética Geral',
          looking_for: 'Algo sério',
          photos: ['https://images.unsplash.com/photo-2']
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockFeed
    });

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText('CURTI')).toBeTruthy();
      expect(screen.getByText('PASSO')).toBeTruthy();
    });
  });

  it('opens and renders 100% identical profile details modal', async () => {
    setCurrentUserId(1, 'mock_token');

    const mockFeed = {
      cards: [
        {
          id: 4,
          name: 'Mikasa Ackerman',
          age: 20,
          campus: 'Santo André',
          course: 'BCT',
          specific_course: 'Engenharia Aeroespacial',
          entity: 'DA Livre',
          looking_for: 'Amizades',
          bio: 'Adoro treinar e ouvir música.',
          photos: ['https://images.unsplash.com/photo-3', 'https://images.unsplash.com/photo-4'],
          songs: ['Linked Horizon - Guren no Yumiya'],
          is_verified: true,
          has_private_content: true,
          private_photos_count: 2,
          interests: ['Academia', 'Anime'],
          prompt1_q: 'Um fato sobre mim',
          prompt1_a: 'Nunca me atraso para aulas.',
          prompt2_q: 'Melhor lugar na UFABC',
          prompt2_a: 'O terraço do bloco A.',
          prompt3_q: 'Não vivo sem',
          prompt3_a: 'Meu cachecol vermelho.'
        }
      ]
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/youtube/search')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ videoId: 'dQw4w9WgXcQ' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockFeed
      });
    });

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getByText('Mikasa Ackerman')).toBeTruthy();
    });

    const detailsBtn = screen.getByTitle('Ver perfil completo e músicas');
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByText('Detalhes do Perfil')).toBeTruthy();
      expect(screen.getByText('Adoro treinar e ouvir música.')).toBeTruthy();
      expect(screen.getAllByText(/Linked Horizon - Guren no Yumiya/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Álbum & Bio Secreta/i)).toBeTruthy();
      expect(screen.getByText('#Academia')).toBeTruthy();
      expect(screen.getByText('#Anime')).toBeTruthy();
      expect(screen.getByText('Um fato sobre mim')).toBeTruthy();
      expect(screen.getByText('"Nunca me atraso para aulas."')).toBeTruthy();
      expect(screen.getByText(/Denunciar ou Bloquear este perfil/i)).toBeTruthy();
    });
  });

  it('triggers pre-fetch of more cards when 5 or fewer cards remain', async () => {
    setCurrentUserId(1, 'mock_token');

    const initialCards = Array.from({ length: 6 }, (_, i) => ({
      id: i + 10,
      name: `User ${i + 10}`,
      age: 20 + i,
      campus: 'Santo André',
      course: 'BC&T',
      photos: ['https://images.unsplash.com/photo-10']
    }));

    const moreCards = [
      {
        id: 99,
        name: 'User 99',
        age: 25,
        campus: 'São Bernardo do Campo',
        course: 'BC&H',
        photos: ['https://images.unsplash.com/photo-99']
      }
    ];

    let fetchCount = 0;
    const calledUrls = [];
    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/feed?limit=20')) {
        fetchCount++;
        calledUrls.push(url);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            cards: fetchCount === 1 ? initialCards : moreCards,
            total_profiles: 10,
            has_more: true
          })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({})
      });
    });

    render(<FeedPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/User 1[0-5]/).length).toBeGreaterThan(0);
    });

    // Clica no botão de like para swipar o primeiro card (restando 5 cards)
    const likeBtn = screen.getByTitle('Curtir');
    fireEvent.click(likeBtn);

    await waitFor(() => {
      // Como restaram 5 cards, deve ter disparado uma segunda requisição em background com exclude dos cards ativos
      expect(fetchCount).toBeGreaterThanOrEqual(2);
      expect(calledUrls.some((u) => u.includes('&exclude='))).toBe(true);
    });
  });
});

