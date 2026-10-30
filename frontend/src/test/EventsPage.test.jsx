import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { EventsPage } from '../pages/EventsPage.jsx';

describe('EventsPage Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders party list with dates, titles and locations', async () => {
    const mockEvents = [
      {
        id: 1,
        title: 'Cervejada Geral UFABC',
        description: 'Open bar com a Bateria Universitária!',
        event_date: '2026-11-14 22:00',
        location: 'Espaço Modular - Santo André',
        attendees_count: 42,
        is_attending: false
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockEvents
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cervejada Geral UFABC')).toBeTruthy();
      expect(screen.getByText(/Espaço Modular/i)).toBeTruthy();
      expect(screen.getByText('14')).toBeTruthy();
      expect(screen.getByText('NOV')).toBeTruthy();
      expect(screen.getByText(/42 confirmados/i)).toBeTruthy();
      expect(screen.getByText(/Vou Colar!/i)).toBeTruthy();
      expect(screen.getByText(/Ver Quem Vai/i)).toBeTruthy();
    });
  });

  it('opens attendees modal in document.body when clicking Ver Quem Vai with locked list', async () => {
    const mockEvents = [
      {
        id: 1,
        title: 'Cervejada Geral UFABC',
        description: 'Open bar',
        event_date: '2026-11-14 22:00',
        location: 'Santo André',
        attendees_count: 42,
        is_attending: false
      }
    ];

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockEvents
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          attendees_locked: true,
          attendees_message: 'Apenas estudantes da UFABC conectados podem ver a lista de confirmados nesta festa.'
        })
      });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Ver Quem Vai/i)).toBeTruthy();
    });

    screen.getByText(/Ver Quem Vai/i).click();

    await waitFor(() => {
      expect(screen.getByText('Lista de Confirmados Privada')).toBeTruthy();
      expect(screen.getByText(/Entrar com e-mail institucional/i)).toBeTruthy();
      expect(screen.getByText('Lista privada')).toBeTruthy();
    });
  });

  it('renders Cadastrar Festa button for admin users and opens modal', async () => {
    localStorage.setItem('pontinho_user_id', '999');

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 999, is_admin: 1 })
        });
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => []
        });
      }
      return Promise.reject(new Error('not found'));
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Cadastrar Festa/i)).toBeTruthy();
    });

    screen.getByText(/Cadastrar Festa/i).click();

    await waitFor(() => {
      expect(screen.getByText('Cadastrar Nova Festa')).toBeTruthy();
      expect(screen.getByPlaceholderText(/Cervejada Geral BC&T/i)).toBeTruthy();
      expect(screen.getByText(/Flyer da Festa/i)).toBeTruthy();
    });
  });
});
