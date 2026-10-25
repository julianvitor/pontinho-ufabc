import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
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
});
